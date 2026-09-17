import type { Priority } from "./types";

export const PRIORITY_COLUMNS: {
  value: Priority;
  label: string;
  stamp: string;
  hint: string;
}[] = [
  { value: 1, label: "Hoje", stamp: "1", hint: "Cai no dia" },
  { value: 2, label: "Amanhã", stamp: "2", hint: "Segura até amanhã" },
  { value: 3, label: "Esta semana", stamp: "3", hint: "Ainda nesta semana" },
  { value: 0, label: "Baixa", stamp: "O", hint: "Sem pressa — o círculo da lousa" },
];

export function stampFor(priority: Priority) {
  return PRIORITY_COLUMNS.find((column) => column.value === priority)?.stamp ?? "O";
}

export function labelFor(priority: Priority) {
  return PRIORITY_COLUMNS.find((column) => column.value === priority)?.label ?? "Baixa";
}

export function parsePriority(value: unknown): Priority {
  const n = Number(value);
  if (n === 1 || n === 2 || n === 3 || n === 0) return n;
  return 0;
}

export function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
