import type { Effort } from "./types";

export const EFFORT_SCALE: {
  value: Effort;
  stamp: string;
  label: string;
}[] = [
  { value: 1, stamp: "XS", label: "Mínimo" },
  { value: 2, stamp: "S", label: "Curto" },
  { value: 3, stamp: "M", label: "Médio" },
  { value: 4, stamp: "L", label: "Pesado" },
  { value: 5, stamp: "XL", label: "Maratona" },
];

export function parseEffort(value: unknown): Effort {
  const n = Number(value);
  if (n === 0 || n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
  return 0;
}

export function effortStamp(effort: Effort) {
  return EFFORT_SCALE.find((item) => item.value === effort)?.stamp ?? "—";
}
