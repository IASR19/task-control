"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";
import { formatClock, formatSessionUntil } from "@/lib/format";
import { IconStop } from "@/components/icons";

type ActiveSession = {
  id: string;
  taskId: string;
  startedAt: string;
  taskTitle: string;
  elapsedSeconds: number;
};

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout, accessExpiresAt } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [now, setNow] = useState(0);

  async function loadTimer() {
    const data = await api<{ session: ActiveSession | null }>("/api/tasks/timer");
    setActive(data.session);
  }

  useEffect(() => {
    void loadTimer();
    const poll = window.setInterval(() => void loadTimer(), 20000);
    const onChange = () => void loadTimer();
    window.addEventListener("lousa-timer", onChange);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("lousa-timer", onChange);
    };
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const elapsed = active
    ? Math.floor((now - Date.parse(active.startedAt)) / 1000)
    : 0;

  const links = [
    { href: "/quadro", label: "Quadro" },
    { href: "/analise", label: "Esforço" },
    { href: "/lousa", label: "Foto" },
  ];

  return (
    <div className="frame">
      <header className="rail">
        <div className="brand-block">
          <p className="brand">Lousa</p>
          <p className="brand-sub">quadro vivo</p>
        </div>
        <nav className="main-nav">
          {links.map((link) => (
            <button
              key={link.href}
              type="button"
              className={pathname.startsWith(link.href) ? "nav-link active" : "nav-link"}
              onClick={() => router.push(link.href)}
            >
              {link.label}
            </button>
          ))}
        </nav>
        <div className="rail-meta">
          <p className="user-name">{user?.name}</p>
          <p className="session-exp">sessão até {formatSessionUntil(accessExpiresAt)}</p>
          <button type="button" className="text-btn" onClick={() => void logout().then(() => router.push("/login"))}>
            Sair
          </button>
        </div>
      </header>
      <div className="stage">{children}</div>
      {active ? (
        <div className="timer-dock">
          <p className="timer-kicker">em curso</p>
          <p className="timer-title">{active.taskTitle}</p>
          <p className="timer-clock">{formatClock(elapsed)}</p>
          <button
            type="button"
            className="dock-stop"
            onClick={async () => {
              await api("/api/tasks/timer", {
                method: "POST",
                body: JSON.stringify({ taskId: active.taskId, action: "stop" }),
              });
              setActive(null);
              window.dispatchEvent(new Event("lousa-timer"));
            }}
          >
            <IconStop width={14} height={14} />
            Encerrar
          </button>
        </div>
      ) : null}
    </div>
  );
}
