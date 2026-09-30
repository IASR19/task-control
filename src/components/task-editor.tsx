"use client";

import { FormEvent, useEffect, useState } from "react";
import { AssigneePicker, Avatar } from "@/components/avatar";
import { useAuth } from "@/context/auth-context";
import { IconClose } from "@/components/icons";
import { PriorityStamp } from "@/components/priority-stamp";
import { DescriptionFields, TaskDescription, type DraftImage } from "@/components/task-description";
import { TaskThread } from "@/components/task-thread";
import { api } from "@/lib/api";
import { fromLocalInput, lateReason, toLocalDate, toLocalDateTime } from "@/lib/deadline";
import { EFFORT_SCALE } from "@/lib/effort";
import { formatDuration, formatStamp } from "@/lib/format";
import { PRIORITY_COLUMNS } from "@/lib/priority";
import type {
  Effort,
  Person,
  Priority,
  Project,
  Task,
  TaskSavePayload,
  TaskStatus,
  TimeSession,
} from "@/lib/types";

type Props = {
  open: boolean;
  task: Task | null;
  projects: Project[];
  onClose: () => void;
  onSave: (payload: TaskSavePayload) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onRefresh?: () => void;
};

export function TaskEditor({ open, task, projects, onClose, onSave, onDelete, onRefresh }: Props) {
  const { user } = useAuth();
  const ownerId = task?.ownerId ?? user?.id;
  const [projectId, setProjectId] = useState(task?.projectId ?? projects[0]?.id ?? "");
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<DraftImage[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assignees.map((person) => person.id) ?? []);
  const [assigneeBusy, setAssigneeBusy] = useState(false);
  const [assigneeError, setAssigneeError] = useState("");
  const [startAt, setStartAt] = useState(toLocalDate(task?.startAt ?? null));
  const [endAt, setEndAt] = useState(toLocalDateTime(task?.endAt ?? null));
  const [deadlineAt, setDeadlineAt] = useState(toLocalDateTime(task?.deadlineAt ?? null));
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 3);
  const [effort, setEffort] = useState<Effort>(task?.effort ?? 0);
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "open");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Iterações vêm do TaskThread; aqui só alimentam o total em "Detalhes".
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!open || !projectId) return;
    let alive = true;
    api<{ people: Person[] }>(`/api/projects/people?projectId=${projectId}`)
      .then((data) => {
        if (!alive) return;
        setPeople(data.people);
        // Numa task nova, trocar de projeto descarta quem não está no projeto escolhido.
        if (!task) {
          const allowed = new Set(data.people.map((person) => person.id));
          setAssigneeIds((current) => current.filter((id) => allowed.has(id)));
        }
      })
      .catch(() => setPeople([]));
    return () => {
      alive = false;
    };
  }, [open, projectId, task]);

  useEffect(() => {
    if (!sessions.some((item) => !item.endedAt)) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [sessions]);

  if (!open) return null;

  async function toggleAssignee(id: string) {
    if (id === ownerId) return;
    const next = assigneeIds.includes(id) ? assigneeIds.filter((item) => item !== id) : [...assigneeIds, id];
    if (!task) {
      setAssigneeIds(next);
      return;
    }
    const previous = assigneeIds;
    setAssigneeIds(next);
    setAssigneeBusy(true);
    setAssigneeError("");
    try {
      await api("/api/tasks/assignees", {
        method: "PUT",
        body: JSON.stringify({ taskId: task.id, userIds: next }),
      });
      onRefresh?.();
    } catch (err) {
      setAssigneeIds(previous);
      setAssigneeError(err instanceof Error ? err.message : "Não salvou os responsáveis.");
    } finally {
      setAssigneeBusy(false);
    }
  }

  async function saveCore(event: FormEvent) {
    event.preventDefault();
    const start = fromLocalInput(startAt);
    const end = fromLocalInput(endAt);
    if (start && end && Date.parse(end) < Date.parse(start)) {
      setError("O End não pode ser antes do Start.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({
        id: task?.id,
        projectId,
        title,
        ...(task ? {} : { notes, images: images.map((image) => image.data), assigneeIds }),
        priority,
        effort,
        startAt: start,
        endAt: end,
        deadlineAt: fromLocalInput(deadlineAt),
        status: task ? status : "open",
      });
      if (!task) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não salvou.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="sheet-backdrop" aria-label="Fechar" onClick={onClose} />
      <aside className="sheet">
        <div className="sheet-head">
          <p className="kicker">{task ? "Task" : "Nova task"}</p>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <IconClose width={16} height={16} />
          </button>
        </div>
        <form className="sheet-body" onSubmit={saveCore}>
          <label>
            Projeto
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Título
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          {task ? (
            <TaskDescription taskId={task.id} initialNotes={task.notes} />
          ) : (
            <div className="desc-block">
              <div className="desc-head">
                <span>Descrição</span>
              </div>
              <DescriptionFields text={notes} images={images} onText={setNotes} onImages={setImages} />
            </div>
          )}
          <fieldset>
            <legend>Prazo</legend>
            <div className="date-picks">
              <label>
                Start
                <input type="date" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
              </label>
              <label>
                End
                <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
              </label>
              <label>
                Data limite
                <input type="datetime-local" value={deadlineAt} onChange={(event) => setDeadlineAt(event.target.value)} />
              </label>
            </div>
            {(() => {
              const reason = lateReason({
                status,
                endAt: fromLocalInput(endAt),
                deadlineAt: fromLocalInput(deadlineAt),
              });
              return reason ? <p className="late-note"><span className="late-mark">!</span> {reason}</p> : null;
            })()}
          </fieldset>
          <fieldset>
            <legend>Janela</legend>
            <div className="priority-picks">
              {PRIORITY_COLUMNS.map((column) => (
                <button
                  key={column.value}
                  type="button"
                  className={priority === column.value ? "pick on" : "pick"}
                  onClick={() => setPriority(column.value)}
                >
                  <PriorityStamp priority={column.value} />
                  <span>{column.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Esforço</legend>
            <div className="effort-picks">
              <button
                type="button"
                className={effort === 0 ? "pick on" : "pick"}
                onClick={() => setEffort(0)}
              >
                —
              </button>
              {EFFORT_SCALE.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={effort === item.value ? "pick on" : "pick"}
                  onClick={() => setEffort(item.value)}
                  title={item.label}
                >
                  <span className="mono">{item.stamp}</span>
                  <small>{item.label}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Pessoas</legend>
            {task ? (
              <p className="task-owner">
                <Avatar person={{ id: task.ownerId, name: task.ownerName }} size={22} />
                <span>
                  Owner: <strong>{task.ownerName}</strong>
                </span>
              </p>
            ) : null}
            <span className="field-hint">Responsáveis{task ? " (salva na hora)" : ""}</span>
            <AssigneePicker
              people={people}
              selected={assigneeIds}
              onToggle={(id) => void toggleAssignee(id)}
              disabled={assigneeBusy}
              lockedId={ownerId}
            />
            {assigneeError ? <p className="form-error">{assigneeError}</p> : null}
          </fieldset>
          {task ? (
            <label>
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
                <option value="open">Aberta</option>
                <option value="in_progress">Em curso</option>
                <option value="remanejada">Remanejada</option>
                <option value="done">Concluída</option>
              </select>
            </label>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}
          <div className="sheet-actions">
            <button type="submit" className="btn-ink" disabled={busy}>
              {busy ? "Salvando…" : task ? "Atualizar" : "Criar"}
            </button>
            {task && onDelete && task.ownerId === user?.id ? (
              <button
                type="button"
                className="text-btn danger"
                onClick={async () => {
                  if (!window.confirm("Apagar essa task?")) return;
                  await onDelete(task.id);
                  onClose();
                }}
              >
                Excluir
              </button>
            ) : null}
          </div>
        </form>

        {task ? (
          <div className="sheet-thread">
            <section>
              <p className="kicker">Detalhes</p>
              <dl className="task-facts">
                <div>
                  <dt>Criada</dt>
                  <dd>
                    {formatStamp(task.createdAt)}
                    {` · por ${task.ownerName}`}
                  </dd>
                </div>
                <div>
                  <dt>Atualizada</dt>
                  <dd>{formatStamp(task.updatedAt)}</dd>
                </div>
                <div>
                  <dt>Fechada</dt>
                  <dd>{task.completedAt ? formatStamp(task.completedAt) : "—"}</dd>
                </div>
                <div>
                  <dt>Tempo</dt>
                  <dd>
                    {formatDuration(
                      sessions.reduce((sum, item) => {
                        if (item.endedAt) return sum + item.durationSeconds;
                        return sum + Math.max(0, Math.floor((now - Date.parse(item.startedAt)) / 1000));
                      }, 0),
                    )}
                    {sessions.length ? ` · ${sessions.length} iteraç${sessions.length === 1 ? "ão" : "ões"}` : ""}
                  </dd>
                </div>
              </dl>
            </section>

            <TaskThread taskId={task.id} isBoardOwner onSessions={setSessions} onChanged={onRefresh} />
          </div>
        ) : (
          <p className="sheet-hint">Cria a task para soltar links e comentários nela.</p>
        )}
      </aside>
    </>
  );
}
