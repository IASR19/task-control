"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { IconArchive, IconCamera, IconClock, IconMark, IconMenu, IconStop } from "@/components/icons";
import { ThemeSwitch } from "@/components/theme-switch";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";
import { formatClock } from "@/lib/format";
import { emitTimer, readTimerDetail, TIMER_EVENT, type LiveTimer } from "@/lib/timer-sync";

const LINKS = [
  { href: "/quadro", label: "Quadro", Icon: IconMark },
  { href: "/atividades", label: "Atividades", Icon: IconClock },
  { href: "/arquivo", label: "Arquivo", Icon: IconArchive },
  { href: "/lousa", label: "Foto", Icon: IconCamera },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState<LiveTimer | null>(null);
  const [now, setNow] = useState(0);
  const [menu, setMenu] = useState(false);

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
      if (detail.session !== undefined) setActive(detail.session);
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

  useEffect(() => {
    setMenu(false);
  }, [pathname]);

  const elapsed = active ? Math.floor((now - Date.parse(active.startedAt)) / 1000) : 0;

  function go(href: string) {
    router.push(href);
  }

  return (
    <div className="frame">
      <header className="rail">
        <BrandMark />
        <nav className="main-nav" aria-label="Principal">
          {LINKS.map((link) => (
            <button
              key={link.href}
              type="button"
              className={pathname.startsWith(link.href) ? "nav-link active" : "nav-link"}
              onClick={() => go(link.href)}
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
        <button
          type="button"
          className="menu-btn"
          aria-label={menu ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menu}
          onClick={() => setMenu((open) => !open)}
        >
          <IconMenu width={18} height={18} />
        </button>
        {menu ? (
          <div className="rail-drawer">
            <p className="user-name">{user?.name}</p>
            <ThemeSwitch />
            <button type="button" className="text-btn" onClick={() => void logout().then(() => router.push("/login"))}>
              Sair
            </button>
          </div>
        ) : null}
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
      <nav className="tabbar" aria-label="Principal">
        {LINKS.map((link) => {
          const on = pathname.startsWith(link.href);
          return (
            <button
              key={link.href}
              type="button"
              className={on ? "tab-link on" : "tab-link"}
              onClick={() => go(link.href)}
            >
              <link.Icon width={18} height={18} />
              {link.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
