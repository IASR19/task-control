export type LiveTimer = {
  id: string;
  taskId: string;
  startedAt: string;
  taskTitle: string;
  elapsedSeconds: number;
};

export type ClosedSlice = {
  taskId: string;
  seconds: number;
};

export type TimerEventDetail = {
  session?: LiveTimer | null;
  closed?: ClosedSlice;
};

export const TIMER_EVENT = "lousa-timer";

export function sessionElapsed(startedAt: string) {
  return Math.max(1, Math.round((Date.now() - Date.parse(startedAt)) / 1000));
}

export function emitTimer(session: LiveTimer | null, closed?: ClosedSlice) {
  window.dispatchEvent(new CustomEvent(TIMER_EVENT, { detail: { session, closed } }));
}

export function emitClosed(closed: ClosedSlice) {
  window.dispatchEvent(new CustomEvent(TIMER_EVENT, { detail: { closed } }));
}

export function readTimerDetail(event: Event): TimerEventDetail | undefined {
  const detail = (event as CustomEvent<TimerEventDetail>).detail;
  if (!detail) return undefined;
  if (detail.session === undefined && !detail.closed) return undefined;
  return { session: detail.session, closed: detail.closed };
}
