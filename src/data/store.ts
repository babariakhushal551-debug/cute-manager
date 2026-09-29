// Data layer: local-first store persisted in AsyncStorage.
// Mirrors the PRD schema: items, projects, tasks, goals, tags, itemTags, relationships, weeklyReviews.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { randomUUID } from "expo-crypto";
import type {
  AppState,
  Goal,
  Item,
  ItemTag,
  ItemType,
  Project,
  Relationship,
  Settings,
  Tag,
  Task,
  WeeklyReview,
} from "./types";

const KEY = "@curio/state-v1";
// Pre-rename storage key ("Cute Manager" era) — migrated once on first hydrate.
const LEGACY_KEY = "@cute-manager/state-v1";

export const DEFAULT_SETTINGS: Settings = {
  ai: { provider: "auto", apiKey: "" },
  reminders: { enabled: true, morningHour: 8, eveningHour: 21 },
  profile: { name: "" },
};

function emptyState(userId: string): AppState {
  return {
    userId,
    items: [],
    projects: [],
    tasks: [],
    goals: [],
    tags: [],
    itemTags: [],
    relationships: [],
    weeklyReviews: [],
    settings: DEFAULT_SETTINGS,
  };
}

interface Actions {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addItem: (input: Partial<Item> & { type: ItemType; title: string }) => Item;
  updateItem: (id: string, patch: Partial<Item>) => void;
  removeItem: (id: string) => void;
  addProject: (input: Partial<Project> & { title: string }) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  removeProject: (id: string) => void;
  addTask: (input: Partial<Task> & { title: string }) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  addGoal: (input: Partial<Goal> & { title: string }) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  addTag: (name: string) => Tag;
  linkItemTag: (itemId: string, tagId: string) => void;
  addRelationship: (input: Omit<Relationship, "id" | "userId">) => void;
  addWeeklyReview: (input: Omit<WeeklyReview, "id" | "userId" | "createdAt">) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  importState: (json: string) => boolean;
  resetAll: () => void;
}

export type Store = AppState & Actions;

function touch(now = Date.now()) {
  return now;
}

export const useStore = create<Store>((set, get) => ({
  ...emptyState("local-user"),
  hydrated: false,

  hydrate: async () => {
    try {
      let raw = await AsyncStorage.getItem(KEY);
      if (!raw) {
        // One-time migration from the pre-rename key.
        raw = await AsyncStorage.getItem(LEGACY_KEY);
      }
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppState>;
        set({
          ...emptyState(parsed.userId ?? "local-user"),
          ...parsed,
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
          hydrated: true,
        });
        return;
      }
    } catch {
      // corrupted state — start fresh
    }
    set({ hydrated: true });
  },

  addItem: (input) => {
    const now = touch();
    const item: Item = {
      id: randomUUID(),
      userId: get().userId,
      type: input.type,
      title: input.title,
      content: input.content ?? "",
      sourceUrl: input.sourceUrl,
      sourcePlatform: input.sourcePlatform,
      thumbnailUrl: input.thumbnailUrl,
      fileUri: input.fileUri,
      mimeType: input.mimeType,
      ocrText: input.ocrText,
      transcript: input.transcript,
      summary: input.summary,
      category: input.category,
      intent: input.intent,
      actionability: input.actionability ?? 0.3,
      importance: input.importance,
      status: input.status ?? "INBOX",
      projectId: input.projectId,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ items: [item, ...s.items] }));
    return item;
  },

  updateItem: (id, patch) =>
    set((s) => ({
      items: s.items.map((it) => (it.id === id ? { ...it, ...patch, updatedAt: touch() } : it)),
    })),

  removeItem: (id) =>
    set((s) => ({
      items: s.items.filter((it) => it.id !== id),
      itemTags: s.itemTags.filter((it) => it.itemId !== id),
    })),

  addProject: (input) => {
    const now = touch();
    const project: Project = {
      id: randomUUID(),
      userId: get().userId,
      title: input.title,
      description: input.description,
      goal: input.goal,
      status: input.status ?? "ACTIVE",
      priority: input.priority,
      deadline: input.deadline,
      sourceItemId: input.sourceItemId,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ projects: [project, ...s.projects] }));
    return project;
  },

  updateProject: (id, patch) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: touch() } : p)),
    })),

  removeProject: (id) =>
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      tasks: s.tasks.map((t) => (t.projectId === id ? { ...t, projectId: undefined } : t)),
      items: s.items.map((it) => (it.projectId === id ? { ...it, projectId: undefined } : it)),
    })),

  addTask: (input) => {
    const now = touch();
    const task: Task = {
      id: randomUUID(),
      userId: get().userId,
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      status: input.status ?? "TODO",
      priority: input.priority,
      estimatedMin: input.estimatedMin ?? 15,
      scheduledFor: input.scheduledFor,
      dueDate: input.dueDate,
      ifThenPlan: input.ifThenPlan,
      completedAt: undefined,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ tasks: [task, ...s.tasks] }));
    return task;
  },

  updateTask: (id, patch) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: touch() } : t)),
    })),

  removeTask: (id) =>
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  addGoal: (input) => {
    const now = touch();
    const goal: Goal = {
      id: randomUUID(),
      userId: get().userId,
      title: input.title,
      description: input.description,
      status: input.status ?? "ACTIVE",
      targetDate: input.targetDate,
      createdAt: now,
    };
    set((s) => ({ goals: [goal, ...s.goals] }));
    return goal;
  },

  updateGoal: (id, patch) =>
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),

  removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

  addTag: (name) => {
    const existing = get().tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const tag: Tag = { id: randomUUID(), userId: get().userId, name };
    set((s) => ({ tags: [...s.tags, tag] }));
    return tag;
  },

  linkItemTag: (itemId, tagId) =>
    set((s) => {
      if (s.itemTags.some((it) => it.itemId === itemId && it.tagId === tagId)) return s;
      const link: ItemTag = { itemId, tagId };
      return { itemTags: [...s.itemTags, link] };
    }),

  addRelationship: (input) =>
    set((s) => {
      const rel: Relationship = { ...input, id: randomUUID(), userId: get().userId };
      return { relationships: [rel, ...s.relationships] };
    }),

  addWeeklyReview: (input) =>
    set((s) => {
      const review: WeeklyReview = {
        ...input,
        id: randomUUID(),
        userId: get().userId,
        createdAt: Date.now(),
      };
      return { weeklyReviews: [review, ...s.weeklyReviews] };
    }),

  updateSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),

  importState: (json) => {
    try {
      const parsed = JSON.parse(json) as Partial<AppState>;
      if (!parsed || typeof parsed !== "object") return false;
      set({
        ...emptyState(parsed.userId ?? "local-user"),
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
        hydrated: true,
      });
      return true;
    } catch {
      return false;
    }
  },

  resetAll: () => set(emptyState(get().userId)),
}));

// ---------- persistence middleware ----------
let persistTimer: ReturnType<typeof setTimeout> | null = null;
useStore.subscribe((state) => {
  if (!state.hydrated) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const { hydrated, hydrate, ...persistable } = useStore.getState() as Store & {
      hydrate: unknown;
    };
    void hydrated;
    void hydrate;
    AsyncStorage.setItem(KEY, JSON.stringify(persistable)).catch(() => {});
  }, 250);
});

// ---------- selectors ----------
export const selectInbox = (s: Store) => s.items.filter((i) => i.status === "INBOX" || i.status === "PROCESSING");
export const selectOpenTasks = (s: Store) => s.tasks.filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS");
export const selectActiveProjects = (s: Store) =>
  s.projects.filter((p) => p.status === "ACTIVE" || p.status === "IDEA");

export function projectProgress(s: Store, projectId: string) {
  const tasks = s.tasks.filter((t) => t.projectId === projectId && t.status !== "CANCELLED");
  if (tasks.length === 0) return { done: 0, total: 0, pct: 0 };
  const done = tasks.filter((t) => t.status === "DONE").length;
  return { done, total: tasks.length, pct: done / tasks.length };
}
