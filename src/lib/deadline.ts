import type { Task } from "@/lib/types";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toLocalDate(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toLocalDateTime(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return `${toLocalDate(iso)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value: string) {
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : `${value}T00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function lateReason(
  task: Pick<Task, "status" | "endAt" | "deadlineAt">,
  now = Date.now(),
) {
  if (!task.deadlineAt || task.status === "done") return null;
  const deadline = Date.parse(task.deadlineAt);
  if (now > deadline) return "Passou do DL";
  if (task.endAt && Date.parse(task.endAt) > deadline) return "End depois do DL";
  return null;
}
