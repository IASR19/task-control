export type Priority = 0 | 1 | 2 | 3;
export type Effort = 0 | 1 | 2 | 3 | 4 | 5;

export type TaskStatus = "open" | "in_progress" | "done" | "remanejada";

export type TaskSource = "board" | "manual";

export type Person = {
  id: string;
  name: string;
};

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
  shared: boolean;
};

export type ProjectShare = {
  token: string;
  createdAt: string;
};

export type ProjectMember = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  taskCount: number;
};

export type SharedWorkspace = {
  projectId: string;
  projectName: string;
  ownerName: string;
};

export type SharePreview = {
  projectId: string;
  projectName: string;
  ownerName: string;
};

export type GuestTask = {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  ownerId: string;
  ownerName: string;
  assignees: Person[];
  executors: Person[];
  deadlineAt: string | null;
  imageCount: number;
  effortSeconds: number;
  checkTotal: number;
  checkDone: number;
  completedByName: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type SharedOverview = {
  totals: {
    seconds: number;
    weekSeconds: number;
    openCount: number;
    doneCount: number;
    closedThisWeek: number;
  };
  byTask: { id: string; title: string; status: TaskStatus; seconds: number }[];
  byPerson: { id: string; name: string; seconds: number; sessions: number }[];
  byDay: { date: string; seconds: number }[];
  weeklyClosed: { week: string; count: number }[];
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
  effort: Effort;
  startAt: string | null;
  endAt: string | null;
  deadlineAt: string | null;
  ownerId: string;
  ownerName: string;
  assignees: Person[];
  executors: Person[];
  effortSeconds: number;
  checkTotal: number;
  checkDone: number;
};

export type TaskCheck = {
  id: string;
  title: string;
  done: boolean;
  sortOrder: number;
};

export type TaskImage = {
  id: string;
  data: string;
};

export type TaskSavePayload = {
  id?: string;
  projectId: string;
  title: string;
  notes?: string;
  images?: string[];
  assigneeIds?: string[];
  executorIds?: string[];
  priority: Priority;
  effort: Effort;
  startAt: string | null;
  endAt: string | null;
  deadlineAt: string | null;
  status?: TaskStatus;
};

export type TaskComment = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
};

export type TaskRef = {
  id: string;
  label: string;
  url: string;
  createdAt: string;
};

export type TimeSession = {
  id: string;
  taskId: string;
  projectId?: string;
  taskTitle: string;
  projectName: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  taskStatus?: TaskStatus;
  personId?: string;
  personName?: string;
};

export type ActivitiesPayload = {
  from: string;
  to: string;
  totals: {
    seconds: number;
    sessions: number;
    running: number;
    tasks: number;
  };
  byProject: { name: string; seconds: number; sessions: number }[];
  byDay: { date: string; seconds: number; sessions: number }[];
  byTask: {
    id: string;
    title: string;
    projectName: string;
    status: TaskStatus;
    seconds: number;
    sessions: number;
    running: boolean;
  }[];
  sessions: TimeSession[];
};

export type AnalyticsPayload = {
  weekSeconds: number;
  todaySeconds: number;
  openCount: number;
  doneCount: number;
  remanejadaCount: number;
  openedThisWeek: number;
  closedToday: number;
  closedThisWeek: number;
  streak: number;
  avgLeadSeconds: number;
  byProject: { name: string; seconds: number; tasks: number }[];
  byDay: { date: string; seconds: number; closed: number }[];
  topTasks: { id: string; title: string; projectName: string; seconds: number }[];
  heatmap: { date: string; count: number }[];
  weeklyClosed: { week: string; count: number }[];
  doneByProject: { name: string; count: number }[];
  doneByEffort: { effort: Effort; count: number }[];
  doneByPriority: { priority: Priority; count: number }[];
};

export type ExtractedTask = {
  title: string;
  priority: Priority;
  order?: number;
};

export type ExtractedProject = {
  name: string;
  tasks: ExtractedTask[];
};

export type ExtractedBoard = {
  projects: ExtractedProject[];
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
