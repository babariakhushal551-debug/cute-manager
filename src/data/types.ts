// Data model — mirrors the PRD schema (items, projects, tasks, goals, tags, relationships, weekly reviews).

export type ItemType = "text" | "link" | "image" | "pdf" | "voice";

export type ItemStatus =
  | "INBOX"
  | "PROCESSING"
  | "ACTIONABLE"
  | "REFERENCE"
  | "ARCHIVED"
  | "DISMISSED";

export type ProjectStatus = "IDEA" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "DEFERRED" | "CANCELLED";
export type GoalStatus = "ACTIVE" | "COMPLETED" | "DROPPED";

export interface Item {
  id: string;
  userId: string;
  type: ItemType;
  title: string;
  content: string;
  sourceUrl?: string;
  sourcePlatform?: string;
  thumbnailUrl?: string;
  fileUri?: string; // local file uri for images / pdfs / voice
  mimeType?: string;
  ocrText?: string;
  transcript?: string;
  summary?: string;
  category?: string;
  intent?: string; // try | learn | reference | watch | read | other
  actionability: number; // 0..1
  importance?: "high" | "medium" | "low";
  status: ItemStatus;
  projectId?: string;
  createdAt: number;
  updatedAt: number;
  processedAt?: number;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  description?: string;
  goal?: string;
  status: ProjectStatus;
  priority?: "high" | "low";
  deadline?: number;
  sourceItemId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  userId: string;
  projectId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: "high" | "normal";
  estimatedMin?: number;
  scheduledFor?: string; // ISO date (yyyy-mm-dd)
  dueDate?: number;
  completedAt?: number;
  ifThenPlan?: string; // implementation intention, e.g. "If it's 8pm at my desk, then…"
  createdAt: number;
  updatedAt: number;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: GoalStatus;
  targetDate?: number;
  createdAt: number;
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
}

export interface ItemTag {
  itemId: string;
  tagId: string;
}

export interface Relationship {
  id: string;
  userId: string;
  sourceId: string;
  targetId: string;
  type: string; // related_to | part_of
  confidence: number;
}

export interface WeeklyReview {
  id: string;
  userId: string;
  period: string; // e.g. 2026-W39
  summary: string;
  stats: {
    saved: number;
    actionable: number;
    tasksDone: number;
    projectsActive: number;
  };
  createdAt: number;
}

export interface Settings {
  ai: {
    provider: "auto" | "openai" | "gemini" | "groq" | "heuristic";
    apiKey: string;
    model?: string;
  };
  reminders: {
    enabled: boolean;
    morningHour: number; // 0-23
    eveningHour: number;
  };
  profile: {
    name: string;
  };
}

export interface AppState {
  userId: string;
  items: Item[];
  projects: Project[];
  tasks: Task[];
  goals: Goal[];
  tags: Tag[];
  itemTags: ItemTag[];
  relationships: Relationship[];
  weeklyReviews: WeeklyReview[];
  settings: Settings;
}
