// AI processing pipeline with a provider abstraction.
// Providers: heuristic (offline, always works) + Gemini / Groq / OpenAI / OpenRouter.
// Built-in keys ship with the app (from EXPO_PUBLIC_ env at build time) so AI works
// out of the box; the user can override with their own key in Settings, or choose
// Offline-only to keep everything on device.
// If a provider call fails, we gracefully fall back to heuristics.

import type { Item, Task } from "../data/types";

export interface AIConfig {
  provider: "auto" | "openai" | "gemini" | "groq" | "openrouter" | "heuristic";
  apiKey: string;
  model?: string;
}

// Keys baked in at build time from .env (see GitHub Actions secrets).
// Empty string means "not provided" — the provider resolver skips it.
const BUILTIN = {
  gemini: process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "",
  groq: process.env.EXPO_PUBLIC_GROQ_API_KEY ?? "",
  openrouter: process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? "",
};

const DEFAULT_MODELS: Record<string, string> = {
  // Preferred models validated against the built-in keys (owner's .env lists).
  gemini: "gemini-3.8-flash",
  groq: "openai/gpt-oss-20b",
  openai: "gpt-4o-mini",
  openrouter: "openrouter/free",
};

/** Priority order for provider="auto". Vision-capable providers first so image items get real understanding. */
const AUTO_PRIORITY: AIConfig["provider"][] = ["gemini", "openrouter", "groq"];

export interface Classification {
  category: string;
  intent: "try" | "learn" | "reference" | "watch" | "read" | "other";
  actionability: number; // 0..1
  confidence: "high" | "medium" | "low";
  summary: string;
  tags: string[];
  /** Vision models: what the attached image shows (stored as ocrText). */
  imageDescription?: string;
}

export interface TaskBreakdown {
  projectTitle: string;
  projectDescription: string;
  tasks: { title: string; estimatedMin: number; ifThenPlan?: string }[];
}

// ---------- provider resolution ----------

export function hasBuiltinAI(): boolean {
  return AUTO_PRIORITY.some((p) => BUILTIN[p as keyof typeof BUILTIN]);
}

/**
 * All built-in providers in failover order. Vision-needing calls skip groq
 * (its chat models have no image input).
 */
function builtinProviderList(needsVision = false): AIConfig[] {
  const list: AIConfig[] = [];
  for (const p of AUTO_PRIORITY) {
    if (needsVision && p === "groq") continue;
    const key = BUILTIN[p as keyof typeof BUILTIN];
    if (key) list.push({ provider: p, apiKey: key, model: DEFAULT_MODELS[p] });
  }
  return list;
}

/**
 * Run `fn` against the right provider(s), failing over through the built-in
 * chain when an explicit user provider isn't configured. `fn` must catch its
 * own errors and return null on failure.
 */
async function tryProviders<T>(
  cfg: Partial<AIConfig> | undefined,
  needsVision: boolean,
  fn: (c: AIConfig) => Promise<T | null>,
): Promise<T | null> {
  const userProvider = cfg?.provider ?? "auto";
  const userKey = cfg?.apiKey?.trim() ?? "";
  if (userProvider !== "auto" && userProvider !== "heuristic" && userKey) {
    return fn({ provider: userProvider, apiKey: userKey, model: cfg?.model });
  }
  for (const c of builtinProviderList(needsVision)) {
    const result = await fn(c);
    if (result !== null) return result;
  }
  return null;
}

// ---------- platform detection ----------
export function detectPlatform(url: string): string | undefined {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  if (u.includes("instagram.com")) return "Instagram";
  if (u.includes("tiktok.com")) return "TikTok";
  if (u.includes("twitter.com") || u.includes("x.com")) return "X";
  if (u.includes("reddit.com")) return "Reddit";
  if (u.includes("wa.me") || u.includes("whatsapp")) return "WhatsApp";
  if (u.includes("facebook.com")) return "Facebook";
  if (u.includes("linkedin.com")) return "LinkedIn";
  if (u.includes("spotify.com")) return "Spotify";
  if (u.includes("github.com")) return "GitHub";
  if (u.includes("substack.com") || u.includes("medium.com")) return "Article";
  if (u.includes("pinterest.")) return "Pinterest";
  return undefined;
}

export function guessTypeFromText(text: string): "link" | "text" {
  return /^https?:\/\/\S+$/im.test(text.trim()) || /^https?:\/\//.test(text.trim())
    ? "link"
    : "text";
}

// ---------- heuristic engine (offline) ----------
const CATEGORY_RULES: { re: RegExp; category: string; intent: Classification["intent"]; weight: number }[] = [
  { re: /\b(recipe|cook|bake|ingredient|meal)\b/i, category: "Recipe", intent: "try", weight: 0.7 },
  { re: /\b(workout|gym|fitness|exercise|run|yoga)\b/i, category: "Fitness", intent: "try", weight: 0.7 },
  { re: /\b(startup|business|saas|idea|monetiz|revenue|market)\b/i, category: "Business idea", intent: "try", weight: 0.75 },
  { re: /\b(tutorial|how to|guide|course|learn|study|lesson)\b/i, category: "Learning", intent: "learn", weight: 0.7 },
  { re: /\b(design|ui|ux|logo|brand|color|typography)\b/i, category: "Design inspiration", intent: "reference", weight: 0.4 },
  { re: /\b(code|programming|javascript|python|swift|react|api)\b/i, category: "Coding", intent: "learn", weight: 0.65 },
  { re: /\b(travel|trip|itinerary|hotel|flight|visit)\b/i, category: "Travel", intent: "reference", weight: 0.45 },
  { re: /\b(buy|shop|deal|price|cart|wishlist)\b/i, category: "Shopping", intent: "try", weight: 0.6 },
  { re: /\b(motivation|mindset|habit|productivity|focus)\b/i, category: "Motivation", intent: "reference", weight: 0.3 },
];

function heuristicClassify(text: string, platform?: string): Classification {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  let best: { category: string; intent: Classification["intent"]; weight: number } | null = null;
  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(lower)) {
      if (!best || rule.weight > best.weight) best = rule;
    }
  }

  const isVideo = platform === "YouTube" || platform === "Instagram" || platform === "TikTok";
  const isLong = raw.length > 280;
  const hasHowTo = /\b(how to|step \d|tutorial|guide)\b/i.test(lower);

  let actionability = 0.3;
  if (best) actionability = Math.max(actionability, best.weight);
  if (isVideo && (best?.intent === "try" || hasHowTo)) actionability += 0.15;
  if (hasHowTo) actionability += 0.1;
  if (isLong && !hasHowTo) actionability -= 0.1;
  actionability = Math.min(0.95, Math.max(0.05, actionability));

  const category = best?.category ?? (isVideo ? "Video" : platform ? "Link" : "Note");
  const intent: Classification["intent"] = best?.intent ?? (isVideo ? "watch" : "reference");

  const firstSentences = raw.replace(/\s+/g, " ").split(/(?<=[.!?])\s/).slice(0, 2).join(" ");
  const summary = firstSentences.slice(0, 180) || (platform ? `${platform} link` : "Quick note");
  const confidence = best ? "medium" : "low";

  const tags = [category.toLowerCase().replace(/\s+/g, "-")];
  if (platform) tags.push(platform.toLowerCase());

  return { category, intent, actionability, confidence, summary, tags };
}

// ---------- LLM adapters ----------
type ChatPart = { text: string } | { inlineData: { mimeType: string; data: string } };

/** Base64 attachment (no data-uri prefix) sent to a multimodal model. */
export interface AIAttachment {
  base64: string;
  mimeType: string; // e.g. image/jpeg, audio/m4a
}

/**
 * Unified chat call. Returns the model's text output.
 * `attachments` are base64 payloads (images and/or audio) for multimodal providers.
 */
async function chatLLM(
  system: string,
  user: string,
  cfg: AIConfig,
  attachments?: AIAttachment[],
): Promise<string> {
  const model = cfg.model || DEFAULT_MODELS[cfg.provider] || undefined;

  // Gemini: native multimodal parts.
  if (cfg.provider === "gemini") {
    const parts: ChatPart[] = [{ text: user }];
    for (const a of attachments ?? []) {
      parts.push({ inlineData: { mimeType: a.mimeType, data: a.base64 } });
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  // OpenAI-compatible: OpenAI, Groq, OpenRouter.
  const endpoint =
    cfg.provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : cfg.provider === "openrouter"
        ? "https://openrouter.ai/api/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (cfg.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://curio.app";
    headers["X-Title"] = "Curio";
  }

  const wantsAttachments = !!attachments && attachments.length > 0;
  let content: string | { type: "text" | "image_url"; text?: string; image_url?: { url: string } }[] = user;
  if (wantsAttachments) {
    content = [
      { type: "text", text: user },
      ...attachments!
        .filter((a) => a.mimeType.startsWith("image/"))
        .map((a) => ({ type: "image_url" as const, image_url: { url: `data:${a.mimeType};base64,${a.base64}` } })),
    ];
    if (content.length === 1) content = user; // audio-only on openai-compatible path: no support
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`${cfg.provider} ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

function extractJSON(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

const CLASSIFY_SYSTEM =
  "You classify saved content for a personal action manager. Look at any attached image carefully " +
  "(screenshots of recipes, workouts, products, articles, UI, code — extract what you see, including " +
  "readable text) and classify what the CONTENT actually is. Respond ONLY with JSON: " +
  '{"category": string (2-3 words), "intent": "try"|"learn"|"reference"|"watch"|"read", ' +
  '"actionability": number 0..1, "confidence": "high"|"medium"|"low", ' +
  '"summary": string (max 2 short sentences), "tags": string[] (2-4 lowercase-kebab tags), ' +
  '"description": string (ONLY when an image is attached: what it shows in 1-3 short sentences, ' +
  "extracting the meaningful content — recipe steps, product, key text — not 'a screenshot')}";

async function llmClassify(
  text: string,
  platform: string | undefined,
  cfg: AIConfig,
  attachments?: AIAttachment[],
): Promise<Classification | null> {
  try {
    const out = await chatLLM(
      CLASSIFY_SYSTEM,
      `Platform: ${platform ?? "unknown"}\nContent:\n${text.slice(0, 4000)}`,
      cfg,
      attachments,
    );
    const obj = extractJSON(out);
    if (!obj) return null;
    return {
      category: String(obj.category ?? "Note").slice(0, 40),
      intent: (["try", "learn", "reference", "watch", "read"].includes(String(obj.intent))
        ? String(obj.intent)
        : "reference") as Classification["intent"],
      actionability: Math.min(1, Math.max(0, Number(obj.actionability ?? 0.3))),
      confidence: (["high", "medium", "low"].includes(String(obj.confidence))
        ? String(obj.confidence)
        : "medium") as Classification["confidence"],
      summary: String(obj.summary ?? "").slice(0, 300),
      tags: Array.isArray(obj.tags) ? obj.tags.slice(0, 4).map((t) => String(t)) : [],
      imageDescription:
        typeof obj.description === "string" && obj.description.trim()
          ? obj.description.trim().slice(0, 600)
          : undefined,
    };
  } catch {
    return null;
  }
}

// ---------- public API (Tier 1 + Tier 2) ----------

/**
 * Classify an item. `images` = base64 payloads (no data-uri prefix) from
 * screenshots/photos; sent to vision-capable providers for real understanding.
 */
export async function classifyItem(
  text: string,
  platform?: string,
  cfg?: AIConfig,
  images?: string[],
): Promise<Classification> {
  const attachments: AIAttachment[] | undefined = images?.length
    ? images.map((b64) => ({ base64: b64, mimeType: "image/jpeg" }))
    : undefined;
  const llm = await tryProviders(cfg, (images?.length ?? 0) > 0, (c) =>
    llmClassify(text, platform, c, attachments),
  );
  if (llm) return llm;
  return heuristicClassify(text, platform);
}

/**
 * Transcribe audio (voice notes) with whatever multimodal provider is
 * available. Gemini handles audio natively; there is no openai-compatible
 * fallback without a dedicated whisper endpoint + key, so null means
 * "no transcription available".
 */
export async function transcribeWithAI(
  audioBase64: string,
  mimeType: string,
  cfg?: AIConfig,
): Promise<string | null> {
  // Gemini handles audio natively; skip other providers (they'd need a
  // dedicated whisper endpoint). tryProviders still gives us failover across
  // models if several builtin keys exist.
  return tryProviders(cfg, false, async (c) => {
    if (c.provider !== "gemini") return null;
    try {
      const out = await chatLLM(
        "You transcribe voice memos. Output ONLY the transcribed words as plain JSON: {\"text\": string}. Keep the speaker's language. Do not add commentary.",
        "Transcribe this voice memo.",
        c,
        [{ base64: audioBase64, mimeType }],
      );
      const obj = extractJSON(out);
      const text = obj && typeof obj.text === "string" ? obj.text.trim() : out.trim();
      return text || null;
    } catch {
      return null;
    }
  });
}

/**
 * Describe what's inside an image (screenshot/photo). Returns null when no
 * vision-capable provider is available or the call fails.
 */
export async function classifyImageContent(
  imageBase64: string,
  context?: string,
  cfg?: AIConfig,
): Promise<string | null> {
  return tryProviders(cfg, true, async (c) => {
    try {
      const out = await chatLLM(
        "You describe images for a personal knowledge app. Describe what the image shows in 1-3 short sentences: " +
          "if it is a screenshot, extract the meaningful content (the recipe steps, the product, the code, the UI, " +
          "the key text) rather than saying 'a screenshot'. Respond ONLY with JSON: {\"description\": string}.",
        `Describe this image.${context ? ` Context from the user: ${context.slice(0, 500)}` : ""}`,
        c,
        [{ base64: imageBase64, mimeType: "image/jpeg" }],
      );
      const obj = extractJSON(out);
      if (obj && typeof obj.description === "string") return obj.description.trim().slice(0, 600) || null;
      const trimmed = out.trim();
      return trimmed ? trimmed.slice(0, 600) : null;
    } catch {
      return null;
    }
  });
}

export async function summarizeItem(text: string, cfg?: AIConfig): Promise<string> {
  const out = await tryProviders(cfg, false, async (c) => {
    try {
      const raw = await chatLLM(
        "Summarize the content in one crisp sentence (max 140 chars). Respond ONLY with JSON: {\"summary\": string}",
        text.slice(0, 4000),
        c,
      );
      const obj = extractJSON(raw);
      return obj?.summary ? String(obj.summary).slice(0, 200) : null;
    } catch {
      return null;
    }
  });
  if (out) return out;
  const s = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s/).slice(0, 2).join(" ");
  return s.slice(0, 180);
}

export async function breakDownGoal(title: string, context: string, cfg?: AIConfig): Promise<TaskBreakdown> {
  const llm = await tryProviders(cfg, false, async (c) => {
    try {
      const out = await chatLLM(
        "Break a goal into 3-7 tiny tasks (each under 30 minutes). Respond ONLY with JSON: " +
          '{"projectTitle": string, "projectDescription": string, "tasks": [{"title": string, "estimatedMin": number, "ifThenPlan": string}]} ' +
          "ifThenPlan is optional and phrased like: If it's 7pm and I'm at my desk, then I will ...",
        `Goal: ${title}\nContext: ${context.slice(0, 1500)}`,
        c,
      );
      const obj = extractJSON(out);
      if (obj && Array.isArray(obj.tasks) && obj.tasks.length > 0) {
        return {
          projectTitle: String(obj.projectTitle ?? title).slice(0, 80),
          projectDescription: String(obj.projectDescription ?? "").slice(0, 400),
          tasks: obj.tasks.slice(0, 7).map((t) => ({
            title: String((t as Record<string, unknown>).title ?? "Step").slice(0, 120),
            estimatedMin: Math.min(60, Math.max(5, Number((t as Record<string, unknown>).estimatedMin ?? 15))),
            ifThenPlan: (t as Record<string, unknown>).ifThenPlan
              ? String((t as Record<string, unknown>).ifThenPlan).slice(0, 200)
              : undefined,
          })),
        };
      }
      return null;
    } catch {
      return null;
    }
  });
  if (llm) return llm;

  // Heuristic breakdown — sensible default skeleton
  const templates: Record<string, { title: string; estimatedMin: number }[]> = {
    default: [
      { title: `Clarify: what does "${title}" success look like?`, estimatedMin: 10 },
      { title: `Research basics of ${title} (save 3 sources)`, estimatedMin: 20 },
      { title: `Write a tiny first draft / first attempt`, estimatedMin: 25 },
      { title: `Review what worked, adjust plan`, estimatedMin: 10 },
    ],
  };
  const tasks = templates.default.map((t) => ({
    title: t.title,
    estimatedMin: t.estimatedMin,
    ifThenPlan: `If it's a free evening and I'm at my desk, then I will: ${t.title.toLowerCase()}`,
  }));
  return {
    projectTitle: title.slice(0, 80),
    projectDescription: context.slice(0, 300) || `Project created from saved idea: ${title}`,
    tasks,
  };
}

// ---------- daily plan (Tier 2) ----------
export interface PlannedSlot {
  taskId: string;
  title: string;
  estimatedMin: number;
  ifThenPlan?: string;
  reason: string;
}

export function generateDailyPlan(tasks: Task[], projects: { id: string; title: string; status: string }[], now = new Date()): PlannedSlot[] {
  const open = tasks
    .filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS")
    .filter((t) => !t.scheduledFor || t.scheduledFor <= now.toISOString().slice(0, 10))
    .sort((a, b) => (a.priority === "high" ? -1 : 0) - (b.priority === "high" ? -1 : 0) || a.createdAt - b.createdAt);

  const evening = now.getHours() >= 17;
  const slots: PlannedSlot[] = [];
  const budget = evening ? 45 : 90; // minutes remaining-ish
  let used = 0;
  for (const t of open) {
    const est = t.estimatedMin ?? 15;
    if (used + est > budget && slots.length > 0) continue;
    const project = projects.find((p) => p.id === t.projectId);
    slots.push({
      taskId: t.id,
      title: t.title,
      estimatedMin: est,
      ifThenPlan: t.ifThenPlan,
      reason: project ? `Moves ${project.title} forward` : "Standalone task",
    });
    used += est;
    if (slots.length >= 3) break;
  }
  return slots;
}

// ---------- helpers for item intake ----------
export function extractFirstUrl(text: string): string | undefined {
  const m = text.match(/https?:\/\/[^\s]+/i);
  return m ? m[0] : undefined;
}

export function itemToText(item: Item): string {
  return [item.title, item.content, item.ocrText, item.transcript, item.sourceUrl]
    .filter(Boolean)
    .join("\n");
}
