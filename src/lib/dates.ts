export function saoPauloKey(date = new Date()) {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function shiftKey(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function keyToDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
}

export function startOfMonthKey(key = saoPauloKey()) {
  return `${key.slice(0, 7)}-01`;
}

export function startOfToday() {
  return keyToDate(saoPauloKey());
}

export function startOfWeekKey(key = saoPauloKey()) {
  const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
  const diff = weekday === 0 ? 6 : weekday - 1;
  return shiftKey(key, -diff);
}

export function startOfWeek() {
  return keyToDate(startOfWeekKey());
}

export function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatLogHeading(iso: string) {
  const key = iso.slice(0, 10);
  const today = saoPauloKey();
  const yesterday = shiftKey(today, -1);
  if (key === today) return "Hoje";
  if (key === yesterday) return "Ontem";
  const date = new Date(`${key}T12:00:00`);
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });
}

export function formatLead(seconds: number) {
  if (!seconds || seconds < 0) return "—";
  const hours = Math.round(seconds / 3600);
  if (hours < 24) return `${Math.max(1, hours)}h`;
  return `${Math.round(hours / 24)}d`;
}
