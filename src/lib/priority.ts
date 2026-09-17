import type { Priority } from "./types";

export const PRIORITY_COLUMNS: {
  value: Priority;
  label: string;
  stamp: string;
  hint: string;
}[] = [
  { value: 0, label: "Hoje", stamp: "0", hint: "Cai no dia" },
  { value: 1, label: "Amanhã", stamp: "1", hint: "Segura até amanhã" },
  { value: 2, label: "Esta semana", stamp: "2", hint: "Ainda nesta semana" },
  { value: 3, label: "Sem prioridade", stamp: "3", hint: "Sem carimbo de urgência" },
];

export function stampFor(priority: Priority) {
  return PRIORITY_COLUMNS.find((column) => column.value === priority)?.stamp ?? "3";
}

export function labelFor(priority: Priority) {
  return PRIORITY_COLUMNS.find((column) => column.value === priority)?.label ?? "Sem prioridade";
}

export function parsePriority(value: unknown): Priority {
  const n = Number(value);
  if (n === 0 || n === 1 || n === 2 || n === 3) return n;
  return 3;
}

export function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
