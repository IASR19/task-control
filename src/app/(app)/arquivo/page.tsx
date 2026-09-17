"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DoneToggle } from "@/components/quadro-views";
import { Spinner } from "@/components/spinner";
import { TaskEditor } from "@/components/task-editor";
import { TaskFilters } from "@/components/task-filters";
import { PriorityStamp } from "@/components/priority-stamp";
import { api } from "@/lib/api";
import { formatLead, formatLogHeading } from "@/lib/dates";
import { effortStamp } from "@/lib/effort";
import { applyTaskFilters, EMPTY_FILTERS, type FilterPreset, type TaskFilters as Filters } from "@/lib/filters";
import { formatDayLabel, formatDuration } from "@/lib/format";
import { PRIORITY_COLUMNS } from "@/lib/priority";
import type { AnalyticsPayload, Effort, Priority, Project, Task, TaskStatus } from "@/lib/types";

const ARQUIVO_PRESETS: FilterPreset[] = [
  { id: "pesado", label: "L/XL", patch: { efforts: [4, 5] } },
  { id: "sem-esforco", label: "Sem esforço", patch: { efforts: [0] } },
];

function heatLevel(count: number, max: number) {
  if (!count) return 0;
  if (max <= 1) return 4;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

export default function ArquivoPage() {
  const [tab, setTab] = useState<"log" | "sinal">("log");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS, sort: "completed" });
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sinalLoading, setSinalLoading] = useState(false);

  const loadLog = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const [projectData, taskData] = await Promise.all([
        api<{ projects: Project[] }>("/api/projects"),
        api<{ tasks: Task[] }>("/api/tasks?status=done"),
      ]);
      setProjects(projectData.projects);
      setTasks(taskData.tasks);
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  const loadSinal = useCallback(async () => {
    if (data) return;
    setSinalLoading(true);
    try {
      setData(await api<AnalyticsPayload>("/api/analytics"));
    } finally {
      setSinalLoading(false);
    }
  }, [data]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "insights" || params.get("tab") === "sinal") setTab("sinal");
    void loadLog(true).catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar"));
  }, [loadLog]);

  useEffect(() => {
    if (tab !== "sinal") return;
    void loadSinal().catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar"));
  }, [tab, loadSinal]);

  const visible = useMemo(() => applyTaskFilters(tasks, filters), [tasks, filters]);

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of visible) {
      const key = (task.completedAt ?? task.updatedAt).slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [visible]);

  async function reopen(task: Task) {
    setTasks((current) => current.filter((item) => item.id !== task.id));
    try {
      await api("/api/tasks", {
        method: "PATCH",
        body: JSON.stringify({ id: task.id, status: "open" }),
      });
    } catch (err) {
      setTasks((current) => [task, ...current]);
      setError(err instanceof Error ? err.message : "Não deu para reabrir.");
    }
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
    await api("/api/tasks", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    await loadLog();
  }

  const maxHeat = Math.max(1, ...(data?.heatmap.map((cell) => cell.count) ?? [1]));
  const maxWeek = Math.max(1, ...(data?.weeklyClosed.map((row) => row.count) ?? [1]));
  const maxProjectTime = Math.max(1, ...(data?.byProject.map((row) => row.seconds) ?? [1]));
  const maxProjectDone = Math.max(1, ...(data?.doneByProject.map((row) => row.count) ?? [1]));
  const maxDay = Math.max(1, ...(data?.byDay.map((row) => row.seconds) ?? [1]));

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">/log</p>
          <h1>O que saiu.</h1>
        </div>
        <div className="view-tabs">
          <button type="button" className={tab === "log" ? "on" : ""} onClick={() => setTab("log")}>
            Fechadas
          </button>
          <button type="button" className={tab === "sinal" ? "on" : ""} onClick={() => setTab("sinal")}>
            Sinal
          </button>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {loading ? (
        <Spinner label="Puxando o arquivo…" />
      ) : tab === "log" ? (
        <>
          <TaskFilters
            filters={filters}
            projects={projects}
            resultCount={visible.length}
            presets={ARQUIVO_PRESETS}
            sorts={[
              { value: "completed", label: "Fechada" },
              { value: "effort", label: "Esforço" },
              { value: "priority", label: "Prioridade" },
              { value: "title", label: "A–Z" },
            ]}
            onChange={setFilters}
          />
          {visible.length === 0 ? (
            <div className="empty-state">
              <p>
                O arquivo está vazio. Fecha uma linha no quadro (o quadrado à esquerda) ou deixa a
                foto marcar o que saiu da parede.
              </p>
            </div>
          ) : (
            groups.map(([day, items]) => (
              <section key={day} className="log-day">
                <header>
                  <h2>{formatLogHeading(day)}</h2>
                  <span className="mono">{items.length}</span>
                </header>
                {items.map((task) => (
                  <div key={task.id} className="log-row">
                    <DoneToggle task={task} onToggle={reopen} />
                    <PriorityStamp priority={task.priority} />
                    <button type="button" className="linkish" onClick={() => setEditing(task)}>
                      {task.title}
                    </button>
                    <span className="proj-name">{task.projectName}</span>
                    <span className="mono">
                      {task.effort ? effortStamp(task.effort) : "—"}
                      {task.effortSeconds ? ` · ${formatDuration(task.effortSeconds)}` : ""}
                    </span>
                  </div>
                ))}
              </section>
            ))
          )}
        </>
      ) : sinalLoading || !data ? (
        <Spinner label="Lendo o sinal…" />
      ) : (
        <div className="sinal">
          <section className="sinal-hero">
            <div>
              <p className="kicker">fechadas esta semana</p>
              <p className="effort-number">{data.closedThisWeek}</p>
            </div>
            <p className="sinal-line">
              <span>{data.openedThisWeek} in</span>
              <span>{data.closedThisWeek} out</span>
              <span>hoje {data.closedToday}</span>
              <span>streak {data.streak}d</span>
              <span>lead {formatLead(data.avgLeadSeconds)}</span>
              <span>{formatDuration(data.weekSeconds)} no relógio</span>
            </p>
          </section>

          <section>
            <p className="kicker">12 semanas</p>
            <h2 className="sinal-h">Ritmo de fechamento</h2>
            <div className="heat-wrap">
              <div className="heat-grid">
                {Array.from({ length: 12 }, (_, week) => (
                  <div key={week} className="heat-col">
                    {data.heatmap.slice(week * 7, week * 7 + 7).map((cell) => (
                      <span
                        key={cell.date}
                        className={`heat-cell lv-${heatLevel(cell.count, maxHeat)}`}
                        title={`${cell.date}: ${cell.count}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <p className="sheet-hint">Cada célula é um dia. Vermelho cheio = o dia que mais fechou.</p>
            </div>
          </section>

          <section>
            <p className="kicker">8 semanas</p>
            <h2 className="sinal-h">Throughput</h2>
            <div className="bars">
              {data.weeklyClosed.map((row) => (
                <div key={row.week} className="bar-row">
                  <span className="mono">{row.week.slice(5)}</span>
                  <div className="bar-track">
                    <div className="bar-fill marker" style={{ width: `${(row.count / maxWeek) * 100}%` }} />
                  </div>
                  <span className="mono">{row.count}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="sinal-split">
            <section>
              <p className="kicker">esta semana</p>
              <h2 className="sinal-h">Por projeto</h2>
              {data.doneByProject.length === 0 ? (
                <p className="empty-col">Nenhuma fechada nesta semana.</p>
              ) : (
                <div className="bars">
                  {data.doneByProject.map((row) => (
                    <div key={row.name} className="bar-row">
                      <span className="proj-name">{row.name}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${(row.count / maxProjectDone) * 100}%` }} />
                      </div>
                      <span className="mono">{row.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <p className="kicker">histórico</p>
              <h2 className="sinal-h">Mix de esforço</h2>
              <div className="mix">
                {data.doneByEffort.map((row) => (
                  <div key={row.effort} className="mix-cell">
                    <span className="mono">{row.effort === 0 ? "—" : effortStamp(row.effort)}</span>
                    <strong>{row.count}</strong>
                  </div>
                ))}
              </div>
              <div className="mix" style={{ marginTop: 12 }}>
                {data.doneByPriority.map((row) => (
                  <div key={row.priority} className="mix-cell">
                    <span className="mono">{PRIORITY_COLUMNS[row.priority]?.stamp}</span>
                    <strong>{row.count}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section>
            <p className="kicker">relógio</p>
            <h2 className="sinal-h">Tempo medido nesta semana</h2>
            <p className="sheet-hint" style={{ marginTop: 0 }}>
              Hoje {formatDuration(data.todaySeconds)}. Quadro ainda tem {data.openCount} abertas,{" "}
              {data.doneCount} no arquivo, {data.remanejadaCount} remanejadas.
            </p>
            {data.byProject.length === 0 ? (
              <p className="empty-col">Ainda não ligou o timer em nada.</p>
            ) : (
              <div className="bars">
                {data.byProject.map((row) => (
                  <div key={row.name} className="bar-row">
                    <span className="proj-name">{row.name}</span>
                    <div className="bar-track">
                      <div className="bar-fill navy" style={{ width: `${(row.seconds / maxProjectTime) * 100}%` }} />
                    </div>
                    <span className="mono">{formatDuration(row.seconds)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="day-bars">
              {data.byDay.map((row) => (
                <div key={row.date} className="day-col">
                  <div
                    className="day-fill"
                    style={{ height: `${Math.max(4, (row.seconds / maxDay) * 100)}%` }}
                    title={`${formatDuration(row.seconds)} · ${row.closed} fechadas`}
                  />
                  <span>{formatDayLabel(row.date)}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="kicker">relógio</p>
            <h2 className="sinal-h">Onde parou mais</h2>
            <table className="review-table">
              <thead>
                <tr>
                  <th>Tarefa</th>
                  <th>Projeto</th>
                  <th>Tempo</th>
                </tr>
              </thead>
              <tbody>
                {data.topTasks.length === 0 ? (
                  <tr>
                    <td colSpan={3}>Nenhuma sessão fechada ainda.</td>
                  </tr>
                ) : (
                  data.topTasks.map((row) => (
                    <tr key={row.id}>
                      <td>{row.title}</td>
                      <td className="proj-name">{row.projectName}</td>
                      <td className="mono">{formatDuration(row.seconds)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </div>
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
          await loadLog();
        }}
      />
    </div>
  );
}
