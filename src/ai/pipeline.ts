// Pipeline: run AI over newly captured items and update the store.
import { classifyItem, itemToText, detectPlatform, breakDownGoal } from "../ai/aiService";
import { getCached, setCached, flush } from "../ai/cache";
import { findSimilar } from "../ai/duplicates";
import { transcribeAudio } from "../services/transcription";
import { useStore } from "../data/store";
import type { Item, Project, Task } from "../data/types";

function aiConfig() {
  const s = useStore.getState().settings.ai;
  return { provider: s.provider, apiKey: s.apiKey, model: s.model };
}

/** Process an inbox item: fill category, summary, intent, actionability, tags + duplicate check. */
export async function processItem(item: Item) {
  const store = useStore.getState();
  store.updateItem(item.id, { status: "PROCESSING", processedAt: Date.now() });

  // Voice items: attempt transcription first so classification sees the words.
  if (item.type === "voice" && item.fileUri && !item.transcript) {
    const { transcript } = await transcribeAudio(item.fileUri);
    if (transcript) {
      useStore.getState().updateItem(item.id, { transcript });
      item = { ...item, transcript };
    }
  }

  const text = itemToText(item);
  const platform = item.sourcePlatform ?? (item.sourceUrl ? detectPlatform(item.sourceUrl) : undefined);

  let classification = await getCached(text);
  if (!classification) {
    classification = await classifyItem(text, platform, aiConfig());
    await setCached(text, classification);
    void flush();
  }

  // tag linking
  const tagIds = classification.tags.map((t) => useStore.getState().addTag(t).id);
  tagIds.forEach((tagId) => useStore.getState().linkItemTag(item.id, tagId));

  useStore.getState().updateItem(item.id, {
    status: "INBOX", // stays in inbox until user decides, but now enriched
    category: classification.category,
    intent: classification.intent,
    actionability: classification.actionability,
    summary: classification.summary,
    processedAt: Date.now(),
  });

  // Duplicate check (after enrichment so similarity uses the best text).
  const enriched = useStore.getState().items.find((i) => i.id === item.id);
  if (enriched) {
    const dupes = findSimilar(enriched, useStore.getState().items);
    if (dupes.length > 0) {
      duplicateStore.set(item.id, { existingId: dupes[0].existing.id, score: dupes[0].score, reason: dupes[0].reason });
    }
  }

  return classification;
}

// In-memory duplicate map (session-scoped; recomputed cheaply on demand).
export const duplicateStore = new Map<string, { existingId: string; score: number; reason: string }>();

/** Turn an item into a project with a small task breakdown (user already confirmed intent). */
export async function createProjectFromItem(item: Item): Promise<{ project: Project; tasks: Task[] }> {
  const text = itemToText(item);
  const breakdown = await breakDownGoal(
    item.title || "New project",
    [item.summary, item.content, item.ocrText, item.transcript].filter(Boolean).join(". ").slice(0, 1200),
    aiConfig(),
  );

  const store = useStore.getState();
  const project = store.addProject({
    title: breakdown.projectTitle,
    description: breakdown.projectDescription,
    goal: item.category,
    status: "ACTIVE",
    sourceItemId: item.id,
  });

  const tasks: Task[] = [];
  for (const t of breakdown.tasks) {
    tasks.push(
      store.addTask({
        projectId: project.id,
        title: t.title,
        estimatedMin: t.estimatedMin,
        ifThenPlan: t.ifThenPlan,
        status: "TODO",
      }),
    );
  }

  useStore.getState().updateItem(item.id, { status: "ACTIONABLE", projectId: project.id });
  return { project, tasks };
}

/** Mark an item as reference/library material. */
export function saveAsReference(item: Item) {
  useStore.getState().updateItem(item.id, { status: "REFERENCE" });
}

/** Dismiss (no blame). */
export function dismissItem(item: Item) {
  useStore.getState().updateItem(item.id, { status: "DISMISSED" });
}

/** Archive (stale ideas, gentle declutter). */
export function archiveItem(item: Item) {
  useStore.getState().updateItem(item.id, { status: "ARCHIVED" });
}
