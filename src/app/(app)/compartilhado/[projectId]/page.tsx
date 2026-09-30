"use client";

import { FormEvent, use, useCallback, useEffect, useMemo, useState } from "react";
import { AssigneePicker, TaskPeople } from "@/components/avatar";
import { Spinner } from "@/components/spinner";
import { DescriptionFields, type DraftImage } from "@/components/task-description";
import { useAuth } from "@/context/auth-context";
import { useTour } from "@/context/tour-context";
import { api } from "@/lib/api";
import { fromLocalInput } from "@/lib/deadline";
import { formatStamp } from "@/lib/format";
import { demoGuestTask, isDemo } from "@/lib/tour-demo";
import { sharedKey } from "@/lib/tour-steps";
import type { GuestTask, Person, SharedWorkspace, TaskImage, TaskStatus } from "@/lib/types";

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Na fila",
  remanejada: "Na fila",
  in_progress: "Em execução",
  done: "Concluída",
};

type Scope = "all" | "mine" | "assigned";

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function GuestTaskCard({
  task,
  people,
  isOwner,
  onAssigned,
  onDeleted,
}: {
  task: GuestTask;
  people: Person[];
  isOwner: boolean;
  onAssigned: (taskId: string, assignees: Person[]) => void;
  onDeleted: (taskId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<TaskImage[] | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || images || !task.imageCount) return;
    api<{ images: TaskImage[] }>(`/api/shared/images?taskId=${task.id}`)
      .then((data) => setImages(data.images))
      .catch(() => setImages([]));
  }, [open, images, task.id, task.imageCount]);

  const demo = isDemo(task.id);

  async function assign(id: string) {
    if (demo) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<{ assignees: Person[] }>("/api/tasks/assignees", {
        method: "PUT",
        body: JSON.stringify({ taskId: task.id, userIds: toggle(task.assignees.map((person) => person.id), id) }),
      });
      onAssigned(task.id, data.assignees);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não salvou os responsáveis.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (demo) return;
    if (!window.confirm("Apagar essa task? Ela some do quadro de todo mundo.")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/tasks?id=${task.id}`, { method: "DELETE" });
      onDeleted(task.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não apagou a task.");
      setBusy(false);
    }
  }

  return (
    <li className={`guest-task ${task.status}`} data-tour="shared-card">
      <button type="button" className="guest-task-head" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="guest-title">
          {demo ? <span className="demo-chip">Exemplo</span> : null}
          {task.title}
        </span>
        <span className={`guest-status ${task.status}`}>{STATUS_LABEL[task.status]}</span>
      </button>
      <div className="guest-meta">
        <TaskPeople owner={{ id: task.ownerId, name: task.ownerName }} assignees={task.assignees} size={20} />
        <span>criada {formatStamp(task.createdAt)}</span>
        {task.deadlineAt ? <span>limite {formatStamp(task.deadlineAt)}</span> : null}
        {task.completedAt ? <span>fechada {formatStamp(task.completedAt)}</span> : null}
        {task.imageCount ? <span>{task.imageCount} img</span> : null}
      </div>
      {open ? (
        <div className="guest-body">
          {task.notes ? <p className="desc-text">{task.notes}</p> : <p className="empty-col">Sem descrição.</p>}
          {images?.length ? (
            <ul className="desc-images">
              {images.map((image) => (
                <li key={image.id}>
                  <button type="button" className="desc-thumb" onClick={() => setPreview(image.data)} aria-label="Ampliar imagem">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.data} alt="" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {isOwner ? (
            <div className="guest-assign">
              <span className="field-hint">Responsáveis</span>
              <AssigneePicker
                people={people}
                selected={task.assignees.map((person) => person.id)}
                onToggle={(id) => void assign(id)}
                disabled={busy || demo}
                lockedId={task.ownerId}
              />
            </div>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}
          {isOwner ? (
            <button type="button" className="text-btn danger guest-delete" disabled={busy || demo} onClick={() => void remove()}>
              Apagar task
            </button>
          ) : null}
        </div>
      ) : null}
      {preview ? (
        <button type="button" className="desc-lightbox" onClick={() => setPreview(null)} aria-label="Fechar imagem">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" />
        </button>
      ) : null}
    </li>
  );
}

export default function SharedWorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { user } = useAuth();
  const { offer, isRunningOn } = useTour();
  const [workspace, setWorkspace] = useState<SharedWorkspace | null>(null);
  const [tasks, setTasks] = useState<GuestTask[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<DraftImage[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [deadlineAt, setDeadlineAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [taskData, peopleData] = await Promise.all([
      api<{ workspace: SharedWorkspace; tasks: GuestTask[] }>(`/api/shared/tasks?projectId=${projectId}`),
      api<{ people: Person[] }>(`/api/projects/people?projectId=${projectId}`),
    ]);
    setWorkspace(taskData.workspace);
    setTasks(taskData.tasks);
    setPeople(peopleData.people);
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Não carregou o projeto."))
      .finally(() => setLoading(false));
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

  const visible = useMemo(() => {
    if (demoTask) return [demoTask];
    if (scope === "mine") return tasks.filter((task) => task.ownerId === user?.id);
    if (scope === "assigned") return tasks.filter((task) => task.assignees.some((person) => person.id === user?.id));
    return tasks;
  }, [demoTask, tasks, scope, user?.id]);

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
      </div>

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
            <p className="kicker">Tasks do projeto · {visible.length}</p>
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
            <p className="empty-col">Nada por aqui ainda.</p>
          ) : (
            <ul className="guest-list">
              {visible.map((task) => (
                <GuestTaskCard
                  key={task.id}
                  task={task}
                  people={people}
                  isOwner={task.ownerId === user?.id}
                  onAssigned={(taskId, assignees) =>
                    setTasks((current) => current.map((item) => (item.id === taskId ? { ...item, assignees } : item)))
                  }
                  onDeleted={(taskId) => setTasks((current) => current.filter((item) => item.id !== taskId))}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
