"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/spinner";
import { TaskEditor } from "@/components/task-editor";
import { api } from "@/lib/api";
import { formatLogHeading, saoPauloKey, shiftKey, startOfMonthKey, startOfWeekKey } from "@/lib/dates";
import { formatClockTime, formatDayLabel, formatDuration, formatStamp } from "@/lib/format";
import { TIMER_EVENT } from "@/lib/timer-sync";
import type { ActivitiesPayload, Effort, Priority, Project, Task, TaskStatus, TimeSession } from "@/lib/types";

type Preset = "hoje" | "ontem" | "semana" | "mes" | "14d" | "custom";
type RunFilter = "all" | "running" | "closed";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "ontem", label: "Ontem" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "14d", label: "14 dias" },
];

function rangeFor(preset: Preset, from: string, to: string) {
  const today = saoPauloKey();
  if (preset === "hoje") return { from: today, to: today };
  if (preset === "ontem") {
    const yesterday = shiftKey(today, -1);
    return { from: yesterday, to: yesterday };
  }
  if (preset === "semana") return { from: startOfWeekKey(), to: today };
  if (preset === "mes") return { from: startOfMonthKey(), to: today };
  if (preset === "14d") return { from: shiftKey(today, -13), to: today };
  return { from, to };
}

function sessionSeconds(session: TimeSession, now: number) {
  if (session.endedAt) return session.durationSeconds;
  return Math.max(0, Math.floor((now - Date.parse(session.startedAt)) / 1000));
}

export default function AtividadesPage() {
  const today = saoPauloKey();
  const [preset, setPreset] = useState<Preset>("semana");
  const [from, setFrom] = useState(startOfWeekKey());
  const [to, setTo] = useState(today);
  const [runFilter, setRunFilter] = useState<RunFilter>("all");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [data, setData] = useState<ActivitiesPayload | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const params = new URLSearchParams({ from, to, status: runFilter });
      if (projectId) params.set("projectId", projectId);
      const [projectData, activityData] = await Promise.all([
        api<{ projects: Project[] }>("/api/projects"),
        api<ActivitiesPayload>(`/api/activities?${params}`),
      ]);
      setProjects(projectData.projects);
      setData(activityData);
    } finally {
      if (initial) setLoading(false);
    }
  }, [from, to, runFilter, projectId]);

  useEffect(() => {
    void load(true).catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar"));
  }, [load]);

  useEffect(() => {
    const onChange = () => {
      void load().catch(() => undefined);
    };
    window.addEventListener(TIMER_EVENT, onChange);
    return () => window.removeEventListener(TIMER_EVENT, onChange);
  }, [load]);

  useEffect(() => {
    if (!data?.totals.running) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [data?.totals.running]);

  const liveTotal = useMemo(() => {
    if (!data) return 0;
    return data.sessions.reduce((sum, session) => sum + sessionSeconds(session, now), 0);
  }, [data, now]);

  const groups = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, TimeSession[]>();
    for (const session of data.sessions) {
      const key = session.startedAt.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(session);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [data]);

  const maxProject = Math.max(1, ...(data?.byProject.map((row) => row.seconds) ?? [1]));
  const maxDay = Math.max(1, ...(data?.byDay.map((row) => row.seconds) ?? [1]));
  const maxTask = Math.max(1, ...(data?.byTask.map((row) => row.seconds) ?? [1]));

  function applyPreset(next: Preset) {
    const range = rangeFor(next, from, to);
    setPreset(next);
    setFrom(range.from);
    setTo(range.to);
  }

  async function openTask(taskId: string) {
    const payload = await api<{ tasks: Task[] }>(`/api/tasks?id=${taskId}`);
    const task = payload.tasks[0];
    if (task) setEditing(task);
  }

  async function saveTask(payload: {
    id?: string;
    projectId: string;
    title: string;
    notes: string;
    priority: Priority;
    effort: Effort;
    status?: TaskStatus;
  }) {
    await api("/api/tasks", { method: "PATCH", body: JSON.stringify(payload) });
    await load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">/apontamentos</p>
          <h1>O que rodou.</h1>
        </div>
      </div>

      <div className="period-bar">
        <div className="view-tabs">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={preset === item.id ? "on" : ""}
              onClick={() => applyPreset(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="period-dates">
          <span>de</span>
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setPreset("custom");
              setFrom(event.target.value);
            }}
          />
          <span>até</span>
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setPreset("custom");
              setTo(event.target.value);
            }}
          />
        </label>
      </div>

      <div className="filter-pills">
        <span className="filter-label">Run</span>
        {(
          [
            ["all", "Todas"],
            ["running", "Em curso"],
            ["closed", "Encerradas"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={runFilter === id ? "pill on" : "pill"}
            onClick={() => setRunFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="filter-pills wrap">
        <span className="filter-label">Proj</span>
        <button
          type="button"
          className={!projectId ? "pill on" : "pill"}
          onClick={() => setProjectId("")}
        >
          Todos
        </button>
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            className={projectId === project.id ? "pill on" : "pill"}
            onClick={() => setProjectId(project.id === projectId ? "" : project.id)}
          >
            {project.name}
          </button>
        ))}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {loading || !data ? (
        <Spinner label="Puxando apontamentos…" />
      ) : (
        <>
          <section className="sinal-hero">
            <div>
              <p className="kicker">tempo no recorte</p>
              <p className="effort-number">{formatDuration(liveTotal)}</p>
            </div>
            <p className="sinal-line">
              <span>{data.totals.sessions} iterações</span>
              <span>{data.totals.tasks} tasks</span>
              <span>{data.totals.running} em curso</span>
              <span>
                {formatStamp(`${from}T12:00:00`).slice(0, 6)} — {formatStamp(`${to}T12:00:00`).slice(0, 6)}
              </span>
            </p>
          </section>

          <div className="sinal-split">
            <section>
              <p className="kicker">recorte</p>
              <h2 className="sinal-h">Por projeto</h2>
              {data.byProject.length === 0 ? (
                <p className="empty-col">Nenhum apontamento nesse período.</p>
              ) : (
                <div className="bars">
                  {data.byProject.map((row) => (
                    <div key={row.name} className="bar-row">
                      <span className="proj-name">{row.name}</span>
                      <div className="bar-track">
                        <div className="bar-fill navy" style={{ width: `${(row.seconds / maxProject) * 100}%` }} />
                      </div>
                      <span className="mono">{formatDuration(row.seconds)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <p className="kicker">recorte</p>
              <h2 className="sinal-h">Por task</h2>
              {data.byTask.length === 0 ? (
                <p className="empty-col">Nada executado aqui.</p>
              ) : (
                <div className="bars">
                  {data.byTask.slice(0, 8).map((row) => (
                    <button key={row.id} type="button" className="bar-row linkish-row" onClick={() => void openTask(row.id)}>
                      <span>
                        {row.title}
                        {row.running ? <small className="task-flag"> em curso</small> : null}
                      </span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${(row.seconds / maxTask) * 100}%` }} />
                      </div>
                      <span className="mono">{formatDuration(row.seconds)}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section>
            <p className="kicker">calendário</p>
            <h2 className="sinal-h">Ritmo do período</h2>
            <div className="day-bars">
              {data.byDay.map((row) => (
                <div key={row.date} className="day-col">
                  <div
                    className="day-fill"
                    style={{ height: `${Math.max(4, (row.seconds / maxDay) * 100)}%` }}
                    title={`${formatDuration(row.seconds)} · ${row.sessions} iterações`}
                  />
                  <span>{formatDayLabel(row.date)}</span>
                </div>
              ))}
            </div>
          </section>

          {groups.length === 0 ? (
            <div className="empty-state">
              <p>Nenhuma iteração nesse recorte. Dá play no quadro e o apontamento cai aqui.</p>
            </div>
          ) : (
            groups.map(([day, items]) => (
              <section key={day} className="log-day">
                <header>
                  <h2>{formatLogHeading(day)}</h2>
                  <span className="mono">
                    {formatDuration(items.reduce((sum, item) => sum + sessionSeconds(item, now), 0))}
                  </span>
                </header>
                {items.map((session) => {
                  const running = !session.endedAt;
                  return (
                    <div key={session.id} className={running ? "log-row apontamento running" : "log-row apontamento"}>
                      <span className={running ? "run-dot on" : "run-dot"} />
                      <button type="button" className="linkish" onClick={() => void openTask(session.taskId)}>
                        {session.taskTitle}
                      </button>
                      <span className="proj-name">{session.projectName}</span>
                      <span className="mono">
                        {formatClockTime(session.startedAt)}
                        {" → "}
                        {running ? "agora" : formatClockTime(session.endedAt ?? session.startedAt)}
                      </span>
                      <span className="mono">{formatDuration(sessionSeconds(session, now))}</span>
                    </div>
                  );
                })}
              </section>
            ))
          )}
        </>
      )}

      <TaskEditor
        key={editing?.id ?? "closed"}
        open={Boolean(editing)}
        task={editing}
        projects={projects}
        onClose={() => setEditing(null)}
        onSave={saveTask}
        onDelete={async (id) => {
          await api(`/api/tasks?id=${id}`, { method: "DELETE" });
          setEditing(null);
          await load();
        }}
      />
    </div>
  );
}
