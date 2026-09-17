"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  clearSession,
  isAccessValid,
  isRefreshValid,
  readSession,
  writeSession,
} from "@/lib/token-store";
import type { AuthUser, SessionPayload } from "@/lib/types";

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function applySession(session: SessionPayload | null) {
  if (!session) {
    clearSession();
    return { user: null, accessExpiresAt: null, refreshExpiresAt: null };
  }
  writeSession(session);
  return {
    user: session.user,
    accessExpiresAt: session.accessExpiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessExpiresAt, setAccessExpiresAt] = useState<string | null>(null);
  const [refreshExpiresAt, setRefreshExpiresAt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const hydrate = useCallback((session: SessionPayload | null) => {
    const next = applySession(session);
    setUser(next.user);
    setAccessExpiresAt(next.accessExpiresAt);
    setRefreshExpiresAt(next.refreshExpiresAt);
  }, []);

  useEffect(() => {
    const boot = async () => {
      const stored = readSession();
      if (stored && isAccessValid(stored)) {
        hydrate(stored);
        setReady(true);
        return;
      }
      if (stored && isRefreshValid(stored)) {
        try {
          const next = await api<SessionPayload>("/api/auth/refresh", {
            method: "POST",
            body: JSON.stringify({ refreshToken: stored.refreshToken }),
          });
          hydrate(next);
        } catch {
          hydrate(null);
        }
        setReady(true);
        return;
      }
      hydrate(null);
      setReady(true);
    };
    void boot();
  }, [hydrate]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await api<SessionPayload>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      hydrate(session);
    },
    [hydrate],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const session = await api<SessionPayload>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      hydrate(session);
    },
    [hydrate],
  );

  const logout = useCallback(async () => {
    const stored = readSession();
    try {
      if (stored?.refreshToken) {
        await api("/api/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken: stored.refreshToken }),
        });
      }
    } finally {
      hydrate(null);
    }
  }, [hydrate]);

  const value = useMemo(
    () => ({
      user,
      ready,
      accessExpiresAt,
      refreshExpiresAt,
      login,
      register,
      logout,
    }),
    [user, ready, accessExpiresAt, refreshExpiresAt, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}
