"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";
import { formatClock } from "@/lib/format";
import { emitTimer, readTimerDetail, TIMER_EVENT, type LiveTimer } from "@/lib/timer-sync";
import { IconStop } from "@/components/icons";
import { ThemeSwitch } from "@/components/theme-switch";

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState<LiveTimer | null>(null);
  const [now, setNow] = useState(0);

  async function loadTimer() {
    try {
      const data = await api<{ session: LiveTimer | null }>("/api/tasks/timer");
      setActive(data.session);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadTimer();
    const poll = window.setInterval(() => void loadTimer(), 20000);
    const onChange = (event: Event) => {
      const detail = readTimerDetail(event);
      if (!detail) {
        void loadTimer();
        return;
      }
      setActive(detail.session);
    };
    window.addEventListener(TIMER_EVENT, onChange);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener(TIMER_EVENT, onChange);
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
    { href: "/atividades", label: "Atividades" },
    { href: "/arquivo", label: "Arquivo" },
    { href: "/lousa", label: "Foto" },
  ];

  return (
    <div className="frame">
      <header className="rail">
        <div className="brand-block">
          <p className="brand">Lousa</p>
          <p className="brand-sub">ops</p>
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
          <ThemeSwitch />
          <p className="user-name">{user?.name}</p>
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
            onClick={() => {
              const snapshot = active;
              emitTimer(null, {
                taskId: snapshot.taskId,
                seconds: Math.max(1, Math.round((Date.now() - Date.parse(snapshot.startedAt)) / 1000)),
              });
              void api("/api/tasks/timer", {
                method: "POST",
                body: JSON.stringify({ taskId: snapshot.taskId, action: "stop" }),
              }).catch(() => {
                emitTimer(snapshot);
              });
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
