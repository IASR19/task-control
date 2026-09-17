import type { Effort, Priority, Task, TaskStatus } from "@/lib/types";

export type SortKey = "priority" | "effort" | "updated" | "title" | "completed";

export type TaskFilters = {
  query: string;
  projectIds: string[];
  priorities: Priority[];
  efforts: Effort[];
  statuses: TaskStatus[];
  sort: SortKey;
};

export const EMPTY_FILTERS: TaskFilters = {
  query: "",
  projectIds: [],
  priorities: [],
  efforts: [],
  statuses: [],
  sort: "priority",
};

export function toggleValue<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function filtersActive(filters: TaskFilters) {
  return Boolean(
    filters.query.trim() ||
      filters.projectIds.length ||
      filters.priorities.length ||
      filters.efforts.length ||
      filters.statuses.length,
  );
}

export function applyTaskFilters(tasks: Task[], filters: TaskFilters) {
  const query = filters.query.trim().toLowerCase();
  const filtered = tasks.filter((task) => {
    if (filters.projectIds.length && !filters.projectIds.includes(task.projectId)) return false;
    if (filters.priorities.length && !filters.priorities.includes(task.priority)) return false;
    if (filters.efforts.length && !filters.efforts.includes(task.effort)) return false;
    if (filters.statuses.length && !filters.statuses.includes(task.status)) return false;
    if (query) {
      const hay = `${task.title} ${task.notes} ${task.projectName}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (filters.sort === "effort") return b.effort - a.effort || a.priority - b.priority;
    if (filters.sort === "updated") return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    if (filters.sort === "title") return a.title.localeCompare(b.title, "pt-BR");
    if (filters.sort === "completed") {
      return Date.parse(b.completedAt ?? b.updatedAt) - Date.parse(a.completedAt ?? a.updatedAt);
    }
    return a.priority - b.priority || b.effort - a.effort;
  });
  return sorted;
}

export type FilterPreset = {
  id: string;
  label: string;
  patch: Partial<TaskFilters>;
};

export const QUADRO_PRESETS: FilterPreset[] = [
  { id: "hoje", label: "Hoje", patch: { priorities: [0], statuses: [] } },
  { id: "semana", label: "Semana", patch: { priorities: [0, 1, 2], statuses: [] } },
  { id: "pesado", label: "L/XL", patch: { efforts: [4, 5] } },
  { id: "sem-esforco", label: "Sem esforço", patch: { efforts: [0] } },
  { id: "curso", label: "Em curso", patch: { statuses: ["in_progress"] } },
  { id: "remanejada", label: "Remanejadas", patch: { statuses: ["remanejada"] } },
];

export function presetOn(filters: TaskFilters, preset: FilterPreset) {
  const patch = preset.patch;
  if (patch.priorities) {
    return (
      filters.priorities.length === patch.priorities.length &&
      patch.priorities.every((value) => filters.priorities.includes(value))
    );
  }
  if (patch.efforts) {
    return (
      filters.efforts.length === patch.efforts.length &&
      patch.efforts.every((value) => filters.efforts.includes(value))
    );
  }
  if (patch.statuses) {
    return (
      filters.statuses.length === patch.statuses.length &&
      patch.statuses.every((value) => filters.statuses.includes(value))
    );
  }
  return false;
}
