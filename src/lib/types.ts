export type Priority = 0 | 1 | 2 | 3;

export type TaskStatus = "open" | "in_progress" | "done" | "remanejada";

export type TaskSource = "board" | "manual";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type SessionPayload = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
};

export type Project = {
  id: string;
  name: string;
  sortOrder: number;
  openCount: number;
};

export type Task = {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  notes: string;
  priority: Priority;
  previousPriority: Priority | null;
  status: TaskStatus;
  source: TaskSource;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  effortSeconds: number;
};

export type TimeSession = {
  id: string;
  taskId: string;
  taskTitle: string;
  projectName: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
};

export type AnalyticsPayload = {
  weekSeconds: number;
  todaySeconds: number;
  openCount: number;
  doneCount: number;
  remanejadaCount: number;
  byProject: { name: string; seconds: number; tasks: number }[];
  byDay: { date: string; seconds: number }[];
  topTasks: { id: string; title: string; projectName: string; seconds: number }[];
};

export type ReconcileSummary = {
  created: { title: string; project: string; priority: Priority }[];
  completed: { title: string; project: string }[];
  remanejadas: {
    title: string;
    project: string;
    from: Priority;
    to: Priority;
  }[];
  unchanged: number;
};

export type BoardSnapshot = {
  id: string;
  createdAt: string;
  summary: ReconcileSummary;
};
