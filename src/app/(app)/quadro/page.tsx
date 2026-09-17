"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconGrid, IconList, IconMark } from "@/components/icons";
import { ProjectNameField } from "@/components/project-name-field";
import { PriorityBoard, ProjectMural, TaskListView } from "@/components/quadro-views";
import { TaskEditor } from "@/components/task-editor";
import { Spinner } from "@/components/spinner";
import { TaskFilters } from "@/components/task-filters";
import { api } from "@/lib/api";
import { applyTaskFilters, EMPTY_FILTERS, toggleValue, type TaskFilters as Filters } from "@/lib/filters";
import { columnOrder, insertBefore, sameOrder } from "@/lib/order";
import { emitTimer, readTimerDetail, sessionElapsed, TIMER_EVENT } from "@/lib/timer-sync";
import type { Effort, Priority, Project, Task, TaskStatus } from "@/lib/types";

type View = "prioridade" | "lista" | "mural";
const FILTER_KEY = "lousa.quadro.filters";

export default function QuadroPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<View>("prioridade");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const skipFilterPersist = useRef(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const runningIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const timerQueue = useRef(Promise.resolve());
  const timerPending = useRef(0);
  const effortBanked = useRef<Record<string, number>>({});
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);

  function setRunning(next: string | null) {
    runningIdRef.current = next;
    setRunningId(next);
  }

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const [projectData, taskData, timerData] = await Promise.all([
        api<{ projects: Project[] }>("/api/projects"),
        api<{ tasks: Task[] }>("/api/tasks"),
        api<{ session: { taskId: string; startedAt?: string } | null }>("/api/tasks/timer"),
      ]);
      setProjects(projectData.projects);
      const liveId = runningIdRef.current;
      setTasks(
        taskData.tasks.map((item) => {
          const banked = effortBanked.current[item.id];
          const effortSeconds = Math.max(item.effortSeconds, banked ?? 0);
          if (banked != null && item.effortSeconds >= banked) delete effortBanked.current[item.id];
          if (timerPending.current > 0 && item.id === liveId) {
            return { ...item, status: "in_progress", effortSeconds };
          }
          if (timerPending.current > 0 && item.status === "in_progress" && item.id !== liveId) {
            return { ...item, status: "open", effortSeconds };
          }
          return { ...item, effortSeconds };
        }),
      );
      if (timerPending.current === 0) {
        const startedAt = timerData.session?.startedAt ?? null;
        setRunning(timerData.session?.taskId ?? null);
        startedAtRef.current = startedAt;
        setTimerStartedAt(startedAt);
      }
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FILTER_KEY);
      if (raw) setFilters({ ...EMPTY_FILTERS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (skipFilterPersist.current) {
      skipFilterPersist.current = false;
      return;
    }
    window.localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    void load(true).catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar"));
  }, [load]);

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = readTimerDetail(event);
      if (!detail) return;
      if (detail.closed) {
        setTasks((current) =>
          current.map((item) => {
            if (item.id !== detail.closed?.taskId) {
              return item.status === "in_progress" && item.id !== detail.session?.taskId
                ? { ...item, status: "open" }
                : item;
            }
            const next = item.effortSeconds + detail.closed.seconds;
            effortBanked.current[item.id] = next;
            return {
              ...item,
              status: detail.session?.taskId === item.id ? "in_progress" : "open",
              effortSeconds: next,
            };
          }),
        );
      }
      if (detail.session) {
        startedAtRef.current = detail.session.startedAt;
        setTimerStartedAt(detail.session.startedAt);
        setRunning(detail.session.taskId);
        setTasks((current) =>
          current.map((item) => {
            if (item.id === detail.session?.taskId) return { ...item, status: "in_progress" };
            if (item.status === "in_progress") return { ...item, status: "open" };
            return item;
          }),
        );
        return;
      }
      startedAtRef.current = null;
      setTimerStartedAt(null);
      setRunning(null);
      if (!detail.closed) {
        setTasks((current) =>
          current.map((item) => (item.status === "in_progress" ? { ...item, status: "open" } : item)),
        );
      }
    };
    window.addEventListener(TIMER_EVENT, onChange);
    return () => window.removeEventListener(TIMER_EVENT, onChange);
  }, []);

  const live = useMemo(() => tasks.filter((task) => task.status !== "done"), [tasks]);
  const visible = useMemo(() => applyTaskFilters(live, filters), [live, filters]);
  const muralProjects = useMemo(() => {
    if (!filters.projectIds.length) return projects;
    return projects.filter((project) => filters.projectIds.includes(project.id));
  }, [projects, filters.projectIds]);

  async function saveTask(payload: {
    id?: string;
    projectId: string;
    title: string;
    notes: string;
    priority: Priority;
    effort: Effort;
    status?: TaskStatus;
  }) {
    if (payload.id) {
      await api("/api/tasks", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    await load();
  }

  async function toggleTimer(task: Task) {
    const current = runningIdRef.current;
    const action = current === task.id ? "stop" : "start";
    const closed =
      action === "stop"
        ? startedAtRef.current
          ? { taskId: task.id, seconds: sessionElapsed(startedAtRef.current) }
          : undefined
        : current && current !== task.id && startedAtRef.current
          ? { taskId: current, seconds: sessionElapsed(startedAtRef.current) }
          : undefined;

    if (action === "start") {
      emitTimer(
        {
          id: "local",
          taskId: task.id,
          startedAt: new Date().toISOString(),
          taskTitle: task.title,
          elapsedSeconds: 0,
        },
        closed,
      );
    } else {
      emitTimer(null, closed);
    }

    timerPending.current += 1;
    timerQueue.current = timerQueue.current
      .then(async () => {
        try {
          const payload = await api<{
            session: { durationSeconds?: number } | null;
            closed?: { taskId: string; durationSeconds: number };
          }>("/api/tasks/timer", {
            method: "POST",
            body: JSON.stringify({ taskId: task.id, action }),
          });
          const serverClosed = action === "stop"
            ? payload.session?.durationSeconds != null && closed
              ? { taskId: task.id, seconds: payload.session.durationSeconds }
              : null
            : payload.closed
              ? { taskId: payload.closed.taskId, seconds: payload.closed.durationSeconds }
              : null;
          if (serverClosed && closed && serverClosed.seconds !== closed.seconds && serverClosed.taskId === closed.taskId) {
            const delta = serverClosed.seconds - closed.seconds;
            setTasks((currentTasks) =>
              currentTasks.map((item) =>
                item.id === serverClosed.taskId ? { ...item, effortSeconds: item.effortSeconds + delta } : item,
              ),
            );
            effortBanked.current[serverClosed.taskId] =
              (effortBanked.current[serverClosed.taskId] ?? 0) + delta;
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Não deu para mudar o timer.");
          try {
            const timerData = await api<{ session: { taskId: string; startedAt: string; taskTitle: string } | null }>(
              "/api/tasks/timer",
            );
            emitTimer(
              timerData.session
                ? {
                    id: "sync",
                    taskId: timerData.session.taskId,
                    startedAt: timerData.session.startedAt,
                    taskTitle: timerData.session.taskTitle,
                    elapsedSeconds: 0,
                  }
                : null,
            );
          } catch {
            /* ignore */
          }
        } finally {
          timerPending.current = Math.max(0, timerPending.current - 1);
        }
      })
      .catch(() => undefined);
  }

  async function toggleDone(task: Task) {
    const next: TaskStatus = task.status === "done" ? "open" : "done";
    const snapshot = task;
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: next,
              completedAt: next === "done" ? new Date().toISOString() : null,
            }
          : item,
      ),
    );
    try {
      if (next === "done" && runningIdRef.current === task.id) {
        emitTimer(
          null,
          startedAtRef.current ? { taskId: task.id, seconds: sessionElapsed(startedAtRef.current) } : undefined,
        );
        timerQueue.current = timerQueue.current.then(async () => {
          await api("/api/tasks/timer", {
            method: "POST",
            body: JSON.stringify({ taskId: task.id, action: "stop" }),
          }).catch(() => undefined);
        });
      }
      await api("/api/tasks", {
        method: "PATCH",
        body: JSON.stringify({ id: task.id, status: next }),
      });
    } catch (err) {
      setTasks((current) => current.map((item) => (item.id === task.id ? snapshot : item)));
      setError(err instanceof Error ? err.message : "Não deu para mudar o status.");
    }
  }

  async function moveTask(
    task: Task,
    next: { priority?: Priority; projectId?: string; beforeId?: string | null },
  ) {
    const byPriority = next.priority !== undefined;
    const destPriority = next.priority ?? task.priority;
    const destProjectId = next.projectId ?? task.projectId;
    const beforeId = next.beforeId === undefined ? null : next.beforeId;
    const dest = columnOrder(
      tasks.filter((item) =>
        item.id === task.id
          ? false
          : byPriority
            ? item.priority === destPriority
            : item.projectId === destProjectId,
      ),
    );
    const moved: Task = {
      ...task,
      priority: destPriority,
      previousPriority:
        byPriority && destPriority !== task.priority ? task.priority : task.previousPriority,
      status:
        byPriority && destPriority !== task.priority && task.status !== "in_progress"
          ? "remanejada"
          : task.status,
      projectId: destProjectId,
      projectName: projects.find((item) => item.id === destProjectId)?.name ?? task.projectName,
    };
    const ordered = insertBefore(dest, moved, beforeId);
    const orderedIds = ordered.map((item) => item.id);
    const currentIds = columnOrder(
      tasks.filter((item) =>
        byPriority ? item.priority === destPriority : item.projectId === destProjectId,
      ),
    ).map((item) => item.id);
    if (
      sameOrder(currentIds, orderedIds) &&
      destPriority === task.priority &&
      destProjectId === task.projectId
    ) {
      return;
    }

    const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
    const snapshot = tasks;
    setTasks((current) =>
      current.map((item) => {
        if (item.id === task.id) {
          return { ...moved, sortOrder: orderMap.get(item.id) ?? ordered.length };
        }
        const index = orderMap.get(item.id);
        return index === undefined ? item : { ...item, sortOrder: index };
      }),
    );
    try {
      await api("/api/tasks/reorder", {
        method: "POST",
        body: JSON.stringify({
          movedId: task.id,
          orderedIds,
          ...(byPriority ? { priority: destPriority } : {}),
          ...(next.projectId ? { projectId: destProjectId } : {}),
        }),
      });
    } catch (err) {
      setTasks(snapshot);
      setError(err instanceof Error ? err.message : "Não deu para mover a task.");
    }
  }

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    if (!projectName.trim()) return;
    await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: projectName.trim() }),
    });
    setProjectName("");
    await load();
  }

  async function renameProject(id: string, name: string) {
    await api("/api/projects", {
      method: "PATCH",
      body: JSON.stringify({ id, name }),
    });
    await load();
  }

  function openTask(task: Task) {
    setEditing(task);
    setEditorOpen(true);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">/quadro</p>
          <h1>Backlog vivo.</h1>
        </div>
        <div className="toolbar">
          <div className="view-tabs">
            <button type="button" className={view === "prioridade" ? "on" : ""} onClick={() => setView("prioridade")}>
              <IconMark width={12} height={12} /> Prioridade
            </button>
            <button type="button" className={view === "lista" ? "on" : ""} onClick={() => setView("lista")}>
              <IconList width={12} height={12} /> Lista
            </button>
            <button type="button" className={view === "mural" ? "on" : ""} onClick={() => setView("mural")}>
              <IconGrid width={12} height={12} /> Mural
            </button>
          </div>
          <button
            type="button"
            className="btn-ink"
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
            disabled={projects.length === 0}
          >
            Nova task
          </button>
        </div>
      </div>

      <TaskFilters
        filters={filters}
        projects={projects}
        resultCount={visible.length}
        showProjects={false}
        onChange={setFilters}
      />

      <div className="project-rail">
        {projects.map((project) => (
          <ProjectNameField
            key={project.id}
            project={project}
            selected={filters.projectIds.includes(project.id)}
            onToggle={() => setFilters((current) => ({ ...current, projectIds: toggleValue(current.projectIds, project.id) }))}
            onRename={renameProject}
          />
        ))}
        <form onSubmit={createProject} className="project-create">
          <input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="+ projeto"
            aria-label="Novo projeto"
          />
        </form>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {loading ? (
        <Spinner label="Puxando o quadro…" />
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <p>
            A lousa está apagada. Vai em <strong>Foto</strong> e manda um print do quadro, ou cria o
            primeiro projeto aqui e escreve as linhas à mão.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <p>Nada nesse recorte. Afrouxa o filtro ou cria uma linha nova.</p>
        </div>
      ) : view === "prioridade" ? (
        <PriorityBoard
          tasks={visible}
          onOpen={openTask}
          onTimer={toggleTimer}
          onToggleDone={toggleDone}
          runningId={runningId}
          timerStartedAt={timerStartedAt}
          visiblePriorities={filters.priorities}
          onMove={(task, priority, beforeId) => void moveTask(task, { priority, beforeId })}
        />
      ) : view === "lista" ? (
        <TaskListView
          tasks={visible}
          onOpen={openTask}
          onTimer={toggleTimer}
          onToggleDone={toggleDone}
          runningId={runningId}
          timerStartedAt={timerStartedAt}
        />
      ) : (
        <ProjectMural
          projects={muralProjects}
          tasks={visible}
          onOpen={openTask}
          onTimer={toggleTimer}
          onToggleDone={toggleDone}
          runningId={runningId}
          timerStartedAt={timerStartedAt}
          onRenameProject={renameProject}
          onMoveProject={(task, projectId, beforeId) => void moveTask(task, { projectId, beforeId })}
        />
      )}

      <TaskEditor
        key={editing?.id ?? (editorOpen ? "new" : "closed")}
        open={editorOpen}
        task={editing ? (tasks.find((item) => item.id === editing.id) ?? editing) : null}
        projects={projects}
        onClose={() => setEditorOpen(false)}
        onSave={saveTask}
        onDelete={async (id) => {
          await api(`/api/tasks?id=${id}`, { method: "DELETE" });
          await load();
        }}
      />
    </div>
  );
}
