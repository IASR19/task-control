import type { SessionPayload } from "./types";

const STORAGE_KEY = "lousa.session";

export function readSession(): SessionPayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionPayload;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: SessionPayload) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function isAccessValid(session: SessionPayload | null, skewMs = 45_000) {
  if (!session) return false;
  return Date.parse(session.accessExpiresAt) - skewMs > Date.now();
}

export function isRefreshValid(session: SessionPayload | null) {
  if (!session) return false;
  return Date.parse(session.refreshExpiresAt) > Date.now();
}
