export function insertBefore<T extends { id: string }>(list: T[], moved: T, beforeId: string | null) {
  const rest = list.filter((item) => item.id !== moved.id);
  const at = beforeId ? rest.findIndex((item) => item.id === beforeId) : -1;
  const index = at < 0 ? rest.length : at;
  const next = [...rest];
  next.splice(index, 0, moved);
  return next;
}

export function columnOrder<T extends { id: string; sortOrder: number; createdAt: string }>(tasks: T[]) {
  return [...tasks].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

export function listOrder<T extends { id: string; priority: number; sortOrder: number; createdAt: string }>(
  tasks: T[],
) {
  return [...tasks].sort(
    (a, b) => a.priority - b.priority || a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt),
  );
}

export function sameOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
