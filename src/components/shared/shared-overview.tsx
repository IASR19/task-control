"use client";

import { useMemo } from "react";
import { Avatar } from "@/components/avatar";
import { IconCheck } from "@/components/icons";
import { formatLogHeading } from "@/lib/dates";
import { formatDayLabel, formatDuration } from "@/lib/format";
import type { GuestTask, SharedOverview } from "@/lib/types";

function Bars({
  rows,
  tone,
}: {
  rows: { key: string; label: React.ReactNode; value: number; display: string }[];
  tone: "navy" | "marker" | "moss";
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="bars">
      {rows.map((row) => (
        <div key={row.key} className="bar-row">
          {row.label}
          <div className="bar-track">
            <div className={`bar-fill ${tone}`} style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
          <span className="mono">{row.display}</span>
        </div>
      ))}
    </div>
  );
}

// Aba "Arquivo" do projeto: concluídas por dia (com quem concluiu) + tempo por task e por pessoa.
export function SharedArchive({
  done,
  overview,
  onReopen,
}: {
  done: GuestTask[];
  overview: SharedOverview | null;
  onReopen: (task: GuestTask) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, GuestTask[]>();
    for (const task of done) {
      const key = (task.completedAt ?? task.createdAt).slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [done]);

  return (
    <div className="shared-archive">
      <section>
        <p className="kicker">concluídas · {done.length}</p>
        {groups.length === 0 ? (
          <div className="empty-state">
            <p>Nada concluído ainda. Marca o quadrado de uma task quando ela sair.</p>
          </div>
        ) : (
          groups.map(([day, items]) => (
            <section key={day} className="log-day">
              <header>
                <h2>{formatLogHeading(day)}</h2>
                <span className="mono">{items.length}</span>
              </header>
              {items.map((task) => (
                <div key={task.id} className="log-row shared">
                  <button
                    type="button"
                    className="done-toggle on"
                    onClick={() => onReopen(task)}
                    aria-label="Reabrir tarefa"
                    title="Reabrir"
                  >
                    <IconCheck width={12} height={12} />
                  </button>
                  <span className="log-title">{task.title}</span>
                  <span className="proj-name">{task.completedByName ? `por ${task.completedByName}` : "—"}</span>
                  <span className="mono">{task.effortSeconds ? formatDuration(task.effortSeconds) : "—"}</span>
                </div>
              ))}
            </section>
          ))
        )}
      </section>

      <div className="shared-time">
        <section>
          <p className="kicker">tempo por task</p>
          {!overview || overview.byTask.length === 0 ? (
            <p className="empty-col">Ninguém ligou o timer neste projeto ainda.</p>
          ) : (
            <Bars
              tone="navy"
              rows={overview.byTask.map((row) => ({
                key: row.id,
                label: <span className="bar-label">{row.title}</span>,
                value: row.seconds,
                display: formatDuration(row.seconds),
              }))}
            />
          )}
        </section>
        <section>
          <p className="kicker">tempo por pessoa</p>
          {!overview || overview.byPerson.length === 0 ? (
            <p className="empty-col">Sem tempo lançado.</p>
          ) : (
            <Bars
              tone="moss"
              rows={overview.byPerson.map((row) => ({
                key: row.id,
                label: (
                  <span className="bar-label person">
                    <Avatar person={{ id: row.id, name: row.name }} size={18} />
                    {row.name}
                  </span>
                ),
                value: row.seconds,
                display: `${formatDuration(row.seconds)} · ${row.sessions}×`,
              }))}
            />
          )}
        </section>
      </div>
    </div>
  );
}

// Aba "Sinal" do projeto: ritmo de fechamento e relógio.
export function SharedSignal({ overview }: { overview: SharedOverview | null }) {
  if (!overview) return <p className="empty-col">Lendo o sinal…</p>;
  const maxDay = Math.max(1, ...overview.byDay.map((row) => row.seconds));
  return (
    <div className="sinal">
      <section className="sinal-hero">
        <div>
          <p className="kicker">fechadas esta semana</p>
          <p className="effort-number">{overview.totals.closedThisWeek}</p>
        </div>
        <p className="sinal-line">
          <span>{overview.totals.openCount} abertas</span>
          <span>{overview.totals.doneCount} concluídas</span>
          <span>{formatDuration(overview.totals.weekSeconds)} nesta semana</span>
          <span>{formatDuration(overview.totals.seconds)} no total</span>
        </p>
      </section>

      <section>
        <p className="kicker">8 semanas</p>
        <h2 className="sinal-h">Fechadas por semana</h2>
        <Bars
          tone="marker"
          rows={overview.weeklyClosed.map((row) => ({
            key: row.week,
            label: <span className="mono">{row.week.slice(5)}</span>,
            value: row.count,
            display: String(row.count),
          }))}
        />
      </section>

      <section>
        <p className="kicker">14 dias</p>
        <h2 className="sinal-h">Tempo por dia</h2>
        <div className="day-bars">
          {overview.byDay.map((row) => (
            <div key={row.date} className="day-col">
              <div
                className="day-fill"
                style={{ height: `${Math.max(4, (row.seconds / maxDay) * 100)}%` }}
                title={formatDuration(row.seconds)}
              />
              <span>{formatDayLabel(row.date)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
