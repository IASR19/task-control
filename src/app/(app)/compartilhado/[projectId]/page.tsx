"use client";

import { FormEvent, use, useCallback, useEffect, useMemo, useState } from "react";
import { AssigneePicker } from "@/components/avatar";
import { GuestTaskCard } from "@/components/shared/guest-task-card";
import { SharedArchive, SharedSignal } from "@/components/shared/shared-overview";
import { Spinner } from "@/components/spinner";
import { DescriptionFields, type DraftImage } from "@/components/task-description";
import { useAuth } from "@/context/auth-context";
import { useTour } from "@/context/tour-context";
import { api } from "@/lib/api";
import { fromLocalInput } from "@/lib/deadline";
import { emitTimer, readTimerDetail, sessionElapsed, TIMER_EVENT } from "@/lib/timer-sync";
import { demoGuestTask, isDemo } from "@/lib/tour-demo";
import { sharedKey } from "@/lib/tour-steps";
import type { GuestTask, Person, SharedOverview, SharedWorkspace } from "@/lib/types";

type Scope = "all" | "mine" | "assigned";
type Tab = "tasks" | "arquivo" | "sinal";

type TimerResponse = {
  session: { id: string; taskId: string; startedAt: string; durationSeconds?: number } | null;
  closed?: { taskId: string; durationSeconds: number };
};

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export default function SharedWorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { user } = useAuth();
  const { offer, isRunningOn } = useTour();
  const [workspace, setWorkspace] = useState<SharedWorkspace | null>(null);
  const [tasks, setTasks] = useState<GuestTask[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [overview, setOverview] = useState<SharedOverview | null>(null);
  const [tab, setTab] = useState<Tab>("tasks");
  const [scope, setScope] = useState<Scope>("all");
  const [runningId, setRunningId] = useState<string | null>(null);
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<DraftImage[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [deadlineAt, setDeadlineAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [taskData, peopleData, overviewData] = await Promise.all([
      api<{ workspace: SharedWorkspace; tasks: GuestTask[] }>(`/api/shared/tasks?projectId=${projectId}`),
      api<{ people: Person[] }>(`/api/projects/people?projectId=${projectId}`),
      api<SharedOverview>(`/api/shared/overview?projectId=${projectId}`),
    ]);
    setWorkspace(taskData.workspace);
    setTasks(taskData.tasks);
    setPeople(peopleData.people);
    setOverview(overviewData);
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      load(),
      api<TimerResponse>("/api/tasks/timer").then((data) => {
        setRunningId(data.session?.taskId ?? null);
        setTimerStartedAt(data.session?.startedAt ?? null);
      }),
    ])
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Não carregou o projeto."))
      .finally(() => setLoading(false));
  }, [load]);

  // O timer é um só por pessoa: acompanha o dock do topo e recarrega os tempos quando uma iteração fecha.
  useEffect(() => {
    const onTimer = (event: Event) => {
      const detail = readTimerDetail(event);
      if (!detail) return;
      if (detail.session !== undefined) {
        setRunningId(detail.session?.taskId ?? null);
        setTimerStartedAt(detail.session?.startedAt ?? null);
      }
      if (detail.closed) void load().catch(() => undefined);
    };
    window.addEventListener(TIMER_EVENT, onTimer);
    return () => window.removeEventListener(TIMER_EVENT, onTimer);
  }, [load]);

  // Projeto sem tasks durante o tutorial: uma task de exemplo, só na tela.
  const demoTask = useMemo(
    () =>
      isRunningOn("/compartilhado/") && tasks.length === 0 && workspace && user
        ? demoGuestTask({ id: user.id, name: user.name }, workspace.ownerName)
        : null,
    [isRunningOn, tasks.length, workspace, user],
  );

  useEffect(() => {
    if (workspace) offer("shared", sharedKey(workspace.projectId));
  }, [workspace, offer]);

  // Os alvos do tutorial (formulário, lista, card) estão na aba Tasks.
  useEffect(() => {
    if (isRunningOn("/compartilhado/")) setTab("tasks");
  }, [isRunningOn]);

  const openTasks = useMemo(() => tasks.filter((task) => task.status !== "done"), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((task) => task.status === "done"), [tasks]);

  const visible = useMemo(() => {
    if (demoTask) return [demoTask];
    if (scope === "mine") return openTasks.filter((task) => task.ownerId === user?.id);
    if (scope === "assigned") return openTasks.filter((task) => task.assignees.some((person) => person.id === user?.id));
    return openTasks;
  }, [demoTask, openTasks, scope, user?.id]);

  async function toggleTimer(task: GuestTask) {
    if (isDemo(task.id)) return;
    const stopping = runningId === task.id;
    setActionError("");
    try {
      const data = await api<TimerResponse>("/api/tasks/timer", {
        method: "POST",
        body: JSON.stringify({ taskId: task.id, action: stopping ? "stop" : "start" }),
      });
      if (stopping) {
        emitTimer(
          null,
          data.session?.durationSeconds != null
            ? { taskId: task.id, seconds: data.session.durationSeconds }
            : timerStartedAt
              ? { taskId: task.id, seconds: sessionElapsed(timerStartedAt) }
              : undefined,
        );
      } else if (data.session) {
        emitTimer(
          { id: data.session.id, taskId: task.id, startedAt: data.session.startedAt, taskTitle: task.title, elapsedSeconds: 0 },
          data.closed ? { taskId: data.closed.taskId, seconds: data.closed.durationSeconds } : undefined,
        );
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não deu para mudar o timer.");
    }
  }

  async function toggleDone(task: GuestTask) {
    if (isDemo(task.id)) return;
    const next = task.status === "done" ? "open" : "done";
    setActionError("");
    try {
      if (next === "done" && runningId === task.id) {
        const data = await api<TimerResponse>("/api/tasks/timer", {
          method: "POST",
          body: JSON.stringify({ taskId: task.id, action: "stop" }),
        });
        emitTimer(null, data.session?.durationSeconds != null ? { taskId: task.id, seconds: data.session.durationSeconds } : undefined);
      }
      await api("/api/tasks", { method: "PATCH", body: JSON.stringify({ id: task.id, status: next }) });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não deu para mudar o status.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/shared/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          title,
          notes,
          images: images.map((image) => image.data),
          assigneeIds,
          deadlineAt: fromLocalInput(deadlineAt),
        }),
      });
      setTitle("");
      setNotes("");
      setImages([]);
      setAssigneeIds([]);
      setDeadlineAt("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não enviou a task.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Abrindo o projeto…" />;

  if (loadError || !workspace) {
    return (
      <div className="empty-state">
        <p>{loadError || "Projeto indisponível."} Se o link foi desativado, peça um novo para quem compartilhou.</p>
      </div>
    );
  }

  return (
    <div className="guest-page">
      <div className="page-head" data-tour="shared-head">
        <div>
          <p className="kicker">Compartilhado por {workspace.ownerName}</p>
          <h1>{workspace.projectName}</h1>
        </div>
        <div className="view-tabs" data-tour="shared-tabs">
          <button type="button" className={tab === "tasks" ? "on" : ""} onClick={() => setTab("tasks")}>
            Tasks
          </button>
          <button type="button" className={tab === "arquivo" ? "on" : ""} onClick={() => setTab("arquivo")}>
            Arquivo
          </button>
          <button type="button" className={tab === "sinal" ? "on" : ""} onClick={() => setTab("sinal")}>
            Sinal
          </button>
        </div>
      </div>

      {actionError ? <p className="form-error">{actionError}</p> : null}

      {tab === "arquivo" ? (
        <SharedArchive done={doneTasks} overview={overview} onReopen={(task) => void toggleDone(task)} />
      ) : tab === "sinal" ? (
        <SharedSignal overview={overview} />
      ) : (
        <div className="guest-grid">
          <form className="guest-form sheet-body" onSubmit={submit} data-tour="shared-form">
            <p className="kicker">Nova task</p>
            <label>
              Título
              <input value={title} onChange={(event) => setTitle(event.target.value)} required />
            </label>
            <div className="desc-block">
              <div className="desc-head">
                <span>Descrição</span>
              </div>
              <DescriptionFields text={notes} images={images} onText={setNotes} onImages={setImages} />
            </div>
            <fieldset data-tour="shared-assignees">
              <legend>Responsáveis</legend>
              <AssigneePicker
                people={people}
                selected={assigneeIds}
                onToggle={(id) => setAssigneeIds((current) => toggle(current, id))}
                lockedId={user?.id}
              />
            </fieldset>
            <label>
              Data limite (opcional)
              <input type="datetime-local" value={deadlineAt} onChange={(event) => setDeadlineAt(event.target.value)} />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button type="submit" className="btn-ink" disabled={busy}>
              {busy ? "Enviando…" : "Enviar task"}
            </button>
          </form>

          <section>
            <div className="guest-list-head" data-tour="shared-list">
              <p className="kicker">Em aberto · {visible.length}</p>
              <div className="view-tabs">
                <button type="button" className={scope === "all" ? "on" : ""} onClick={() => setScope("all")}>
                  Todas
                </button>
                <button type="button" className={scope === "mine" ? "on" : ""} onClick={() => setScope("mine")}>
                  Criei
                </button>
                <button type="button" className={scope === "assigned" ? "on" : ""} onClick={() => setScope("assigned")}>
                  Comigo
                </button>
              </div>
            </div>
            {visible.length === 0 ? (
              <p className="empty-col">Nada em aberto por aqui. O que já saiu está na aba Arquivo.</p>
            ) : (
              <ul className="guest-list">
                {visible.map((task) => (
                  <GuestTaskCard
                    key={task.id}
                    task={task}
                    people={people}
                    isOwner={task.ownerId === user?.id}
                    running={runningId === task.id}
                    timerStartedAt={timerStartedAt}
                    onTimer={(item) => void toggleTimer(item)}
                    onToggleDone={(item) => void toggleDone(item)}
                    onAssigned={(taskId, assignees) =>
                      setTasks((current) => current.map((item) => (item.id === taskId ? { ...item, assignees } : item)))
                    }
                    onDeleted={(taskId) => setTasks((current) => current.filter((item) => item.id !== taskId))}
                    onChanged={() => void load().catch(() => undefined)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
