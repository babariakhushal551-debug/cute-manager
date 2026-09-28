// AI processing pipeline — Tier 1/2 operations per PRD §9, with a provider abstraction.
// Providers: heuristic (offline, always works) + OpenAI / Gemini / Groq adapters.
// If a provider call fails, we gracefully fall back to heuristics and mark "needs review".

import type { Item, Task } from "../data/types";

export interface AIConfig {
  provider: "auto" | "openai" | "gemini" | "groq" | "heuristic";
  apiKey: string;
  model?: string;
}

export interface Classification {
  category: string;
  intent: "try" | "learn" | "reference" | "watch" | "read" | "other";
  actionability: number; // 0..1
  confidence: "high" | "medium" | "low";
  summary: string;
  tags: string[];
}

export interface TaskBreakdown {
  projectTitle: string;
  projectDescription: string;
  tasks: { title: string; estimatedMin: number; ifThenPlan?: string }[];
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
  { re: /\b(podcast|episode|interview)\b/i, category: "Podcast", intent: "listen", weight: 0.35 } as never,
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
async function chatLLM(system: string, user: string, cfg: AIConfig): Promise<string> {
  const model = cfg.model || undefined;
  if (cfg.provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: model ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }
  if (cfg.provider === "groq") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: model ?? "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }
  if (cfg.provider === "gemini") {
    const gm = model ?? "gemini-2.0-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${gm}:generateContent?key=${cfg.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }
  throw new Error("no provider");
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
  "You classify saved content for a personal action manager. Respond ONLY with JSON: " +
  '{"category": string (2-3 words), "intent": "try"|"learn"|"reference"|"watch"|"read", ' +
  '"actionability": number 0..1, "confidence": "high"|"medium"|"low", ' +
  '"summary": string (max 2 short sentences), "tags": string[] (2-4 lowercase-kebab tags)}';

async function llmClassify(text: string, platform: string | undefined, cfg: AIConfig): Promise<Classification | null> {
  try {
    const out = await chatLLM(
      CLASSIFY_SYSTEM,
      `Platform: ${platform ?? "unknown"}\nContent:\n${text.slice(0, 4000)}`,
      cfg,
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
    };
  } catch {
    return null;
  }
}

// ---------- public API (Tier 1 + Tier 2) ----------
export async function classifyItem(text: string, platform?: string, cfg?: AIConfig): Promise<Classification> {
  if (cfg && cfg.provider !== "heuristic" && cfg.apiKey) {
    const llm = await llmClassify(text, platform, cfg);
    if (llm) return llm;
  }
  return heuristicClassify(text, platform);
}

export async function summarizeItem(text: string, cfg?: AIConfig): Promise<string> {
  if (cfg && cfg.provider !== "heuristic" && cfg.apiKey) {
    try {
      const out = await chatLLM(
        "Summarize the content in one crisp sentence (max 140 chars). Respond ONLY with JSON: {\"summary\": string}",
        text.slice(0, 4000),
        cfg,
      );
      const obj = extractJSON(out);
      if (obj?.summary) return String(obj.summary).slice(0, 200);
    } catch {
      // fall through
    }
  }
  const s = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s/).slice(0, 2).join(" ");
  return s.slice(0, 180);
}

export async function breakDownGoal(title: string, context: string, cfg?: AIConfig): Promise<TaskBreakdown> {
  if (cfg && cfg.provider !== "heuristic" && cfg.apiKey) {
    try {
      const out = await chatLLM(
        "Break a goal into 3-7 tiny tasks (each under 30 minutes). Respond ONLY with JSON: " +
          '{"projectTitle": string, "projectDescription": string, "tasks": [{"title": string, "estimatedMin": number, "ifThenPlan": string}]} ' +
          "ifThenPlan is optional and phrased like: If it's 7pm and I'm at my desk, then I will ...",
        `Goal: ${title}\nContext: ${context.slice(0, 1500)}`,
        cfg,
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
    } catch {
      // fall through to heuristic
    }
  }

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
