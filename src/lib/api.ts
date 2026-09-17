import {
  clearSession,
  isAccessValid,
  isRefreshValid,
  readSession,
  writeSession,
} from "@/lib/token-store";
import type { SessionPayload } from "@/lib/types";

let refreshInFlight: Promise<SessionPayload | null> | null = null;

async function refreshSession(): Promise<SessionPayload | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const current = readSession();
    if (!current || !isRefreshValid(current)) {
      clearSession();
      return null;
    }
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    if (!response.ok) {
      clearSession();
      return null;
    }
    const next = (await response.json()) as SessionPayload;
    writeSession(next);
    return next;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const isAuthCall =
    path.startsWith("/api/auth/login") ||
    path.startsWith("/api/auth/register") ||
    path.startsWith("/api/auth/refresh");

  let session = readSession();
  if (!isAuthCall && session && !isAccessValid(session) && isRefreshValid(session)) {
    session = await refreshSession();
  }

  const headers = new Headers(init.headers);
  if (!isAuthCall && session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, headers });
  if (response.status === 401 && retry && !isAuthCall) {
    const next = await refreshSession();
    if (next) return api<T>(path, init, false);
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login") &&
      !window.location.pathname.startsWith("/registro")
    ) {
      window.location.href = "/login";
    }
  }

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Falha na requisição");
  }
  return payload;
}
