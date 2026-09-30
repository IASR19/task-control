"use client";

import { useEffect, useState } from "react";
import { PeopleRoles, TaskPeople } from "@/components/avatar";
import { IconCheck, IconPlay, IconStop } from "@/components/icons";
import { TaskThread } from "@/components/task-thread";
import { api } from "@/lib/api";
import { formatDuration, formatStamp } from "@/lib/format";
import { isDemo } from "@/lib/tour-demo";
import type { GuestTask, Person, TaskImage, TaskStatus } from "@/lib/types";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Na fila",
  remanejada: "Na fila",
  in_progress: "Em execução",
  done: "Concluída",
};

function LiveTime({ seconds, startedAt }: { seconds: number; startedAt: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [startedAt]);
  const total = seconds + (startedAt ? Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000)) : 0);
  return total > 0 ? <span className="task-time">{formatDuration(total)}</span> : null;
}

export function GuestTaskCard({
  task,
  people,
  isOwner,
  running,
  timerStartedAt,
  onTimer,
  onToggleDone,
  onPatched,
  onDeleted,
  onChanged,
}: {
  task: GuestTask;
  people: Person[];
  isOwner: boolean;
  running: boolean;
  timerStartedAt: string | null;
  onTimer: (task: GuestTask) => void;
  onToggleDone: (task: GuestTask) => void;
  onPatched: (taskId: string, patch: Partial<GuestTask>) => void;
  onDeleted: (taskId: string) => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<TaskImage[] | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const demo = isDemo(task.id);
  const done = task.status === "done";

  useEffect(() => {
    if (!open || images || !task.imageCount) return;
    api<{ images: TaskImage[] }>(`/api/shared/images?taskId=${task.id}`)
      .then((data) => setImages(data.images))
      .catch(() => setImages([]));
  }, [open, images, task.id, task.imageCount]);

  async function savePeople(role: "assignees" | "executors", id: string) {
    if (demo) return;
    setBusy(true);
    setError("");
    try {
      const current = role === "assignees" ? task.assignees : task.executors;
      const on = !current.some((person) => person.id === id);
      const data = await api<{ assignees?: Person[]; executors?: Person[] }>(`/api/tasks/${role}`, {
        method: "PUT",
        body: JSON.stringify({ taskId: task.id, userId: id, on }),
      });
      onPatched(task.id, role === "assignees" ? { assignees: data.assignees ?? [] } : { executors: data.executors ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não salvou as pessoas.");
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
      <div className="guest-task-row">
        <button type="button" className="guest-task-head" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <span className="guest-title">
            {demo ? <span className="demo-chip">Exemplo</span> : null}
            {task.title}
          </span>
          <span className={`guest-status ${task.status}`}>{STATUS_LABEL[task.status]}</span>
        </button>
        <div className="task-actions" data-tour="shared-actions">
          {done ? null : (
            <button
              type="button"
              className={running ? "timer-btn on" : "timer-btn"}
              onClick={() => onTimer(task)}
              disabled={demo}
              aria-label={running ? "Encerrar timer" : "Começar timer"}
            >
              {running ? <IconStop width={13} height={13} /> : <IconPlay width={13} height={13} />}
            </button>
          )}
          <button
            type="button"
            className={done ? "done-toggle on" : "done-toggle"}
            onClick={() => onToggleDone(task)}
            disabled={demo}
            aria-label={done ? "Reabrir tarefa" : "Marcar como concluída"}
            title={done ? "Reabrir" : "Marcar como concluída"}
          >
            <IconCheck width={12} height={12} />
          </button>
        </div>
      </div>
      <div className="guest-meta">
        <TaskPeople
          owner={{ id: task.ownerId, name: task.ownerName }}
          assignees={task.assignees}
          executors={task.executors}
          size={20}
        />
        <span>criada {formatStamp(task.createdAt)}</span>
        {task.deadlineAt ? <span>limite {formatStamp(task.deadlineAt)}</span> : null}
        {task.checkTotal ? (
          <span className="check-chip">
            {task.checkDone}/{task.checkTotal}
          </span>
        ) : null}
        <LiveTime seconds={task.effortSeconds} startedAt={running ? timerStartedAt : null} />
        {task.imageCount ? <span>{task.imageCount} img</span> : null}
      </div>
      {open ? (
        <div className="guest-body">
          <section className="guest-block">
            <p className="kicker">Descrição</p>
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
          </section>

          <section className="guest-block">
            <p className="kicker">Pessoas</p>
            <PeopleRoles
              owner={{ id: task.ownerId, name: task.ownerName }}
              assignees={task.assignees}
              executors={task.executors}
              people={people}
              canEditAssignees={isOwner && !demo}
              canEditExecutors={!demo}
              busy={busy}
              onToggleAssignee={(id) => void savePeople("assignees", id)}
              onToggleExecutor={(id) => void savePeople("executors", id)}
            />
            {error ? <p className="form-error">{error}</p> : null}
          </section>

          <section className="guest-block">
            {demo ? (
              <p className="empty-col">Numa task de verdade, aqui ficam a checklist, o tempo e os comentários.</p>
            ) : (
              <TaskThread taskId={task.id} isBoardOwner={false} layout="tabs" onChanged={onChanged} />
            )}
          </section>

          {isOwner ? (
            <div className="guest-footer">
              <button type="button" className="text-btn danger" disabled={busy || demo} onClick={() => void remove()}>
                Apagar task
              </button>
            </div>
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
