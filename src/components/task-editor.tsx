"use client";

import { FormEvent, useEffect, useState } from "react";
import { IconClose } from "@/components/icons";
import { PriorityStamp } from "@/components/priority-stamp";
import { api } from "@/lib/api";
import { EFFORT_SCALE } from "@/lib/effort";
import { formatClockTime, formatDuration, formatStamp } from "@/lib/format";
import { PRIORITY_COLUMNS } from "@/lib/priority";
import { TIMER_EVENT } from "@/lib/timer-sync";
import type { Effort, Priority, Project, Task, TaskCheck, TaskComment, TaskRef, TaskStatus, TimeSession } from "@/lib/types";

type Props = {
  open: boolean;
  task: Task | null;
  projects: Project[];
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    projectId: string;
    title: string;
    notes: string;
    priority: Priority;
    effort: Effort;
    status?: TaskStatus;
  }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
};

export function TaskEditor({ open, task, projects, onClose, onSave, onDelete }: Props) {
  const [projectId, setProjectId] = useState(task?.projectId ?? projects[0]?.id ?? "");
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 3);
  const [effort, setEffort] = useState<Effort>(task?.effort ?? 0);
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "open");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [refs, setRefs] = useState<TaskRef[]>([]);
  const [checks, setChecks] = useState<TaskCheck[]>([]);
  const [checkTitle, setCheckTitle] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [refUrl, setRefUrl] = useState("");
  const [refLabel, setRefLabel] = useState("");
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [now, setNow] = useState(Date.now());

  async function loadThread(taskId: string) {
    const [commentData, refData, checkData, sessionData] = await Promise.all([
      api<{ comments: TaskComment[] }>(`/api/tasks/comments?taskId=${taskId}`),
      api<{ refs: TaskRef[] }>(`/api/tasks/refs?taskId=${taskId}`),
      api<{ checks: TaskCheck[] }>(`/api/tasks/checks?taskId=${taskId}`),
      api<{ sessions: TimeSession[] }>(`/api/sessions?taskId=${taskId}`),
    ]);
    setComments(commentData.comments);
    setRefs(refData.refs);
    setChecks(checkData.checks);
    setSessions(sessionData.sessions);
  }

  useEffect(() => {
    if (!open || !task) {
      setComments([]);
      setRefs([]);
      setChecks([]);
      setSessions([]);
      return;
    }
    void loadThread(task.id).catch(() => undefined);
  }, [open, task]);

  useEffect(() => {
    if (!open || !task) return;
    const onTimer = () => {
      void loadThread(task.id).catch(() => undefined);
    };
    window.addEventListener(TIMER_EVENT, onTimer);
    return () => window.removeEventListener(TIMER_EVENT, onTimer);
  }, [open, task]);

  useEffect(() => {
    if (!sessions.some((item) => !item.endedAt)) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [sessions]);

  if (!open) return null;

  async function saveCore(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({
        id: task?.id,
        projectId,
        title,
        notes,
        priority,
        effort,
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
          <label>
            Brief
            <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contexto, critério de pronto, bloqueio…" />
          </label>
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
            {task && onDelete ? (
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
                  <dd>{formatStamp(task.createdAt)}</dd>
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

            <section>
              <p className="kicker">Iterações</p>
              {sessions.length === 0 ? (
                <p className="empty-col">Ainda não ligou o timer nesta linha.</p>
              ) : (
                <ol className="session-list">
                  {sessions.map((item, index) => {
                    const running = !item.endedAt;
                    const seconds = running
                      ? Math.max(0, Math.floor((now - Date.parse(item.startedAt)) / 1000))
                      : item.durationSeconds;
                    return (
                      <li key={item.id} className={running ? "live" : ""}>
                        <span className="idx">#{sessions.length - index}</span>
                        <div className="when">
                          <strong>{formatStamp(item.startedAt)}</strong>
                          <span>
                            {formatClockTime(item.startedAt)} → {running ? "agora" : formatClockTime(item.endedAt ?? item.startedAt)}
                          </span>
                        </div>
                        <span className="dur">{formatDuration(seconds)}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <section>
              <p className="kicker">Checklist</p>
              <ul className="check-list">
                {checks.length === 0 ? (
                  <li className="empty-col">Quebra em passos. Marca o que já morreu.</li>
                ) : (
                  checks.map((item) => (
                    <li key={item.id} className={item.done ? "on" : ""}>
                      <button
                        type="button"
                        className={item.done ? "done-toggle on" : "done-toggle"}
                        onClick={async () => {
                          const updated = await api<{ check: TaskCheck }>("/api/tasks/checks", {
                            method: "PATCH",
                            body: JSON.stringify({ id: item.id, done: !item.done }),
                          });
                          setChecks((current) =>
                            current.map((row) => (row.id === item.id ? updated.check : row)),
                          );
                        }}
                        aria-label={item.done ? "Desmarcar" : "Marcar"}
                      />
                      <span>{item.title}</span>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={async () => {
                          await api(`/api/tasks/checks?id=${item.id}`, { method: "DELETE" });
                          setChecks((current) => current.filter((row) => row.id !== item.id));
                        }}
                      >
                        x
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <form
                className="inline-add check-add"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const created = await api<{ check: TaskCheck }>("/api/tasks/checks", {
                    method: "POST",
                    body: JSON.stringify({ taskId: task.id, title: checkTitle }),
                  });
                  setChecks((current) => [...current, created.check]);
                  setCheckTitle("");
                }}
              >
                <input
                  value={checkTitle}
                  onChange={(event) => setCheckTitle(event.target.value)}
                  placeholder="próximo passo"
                  required
                />
                <button type="submit" className="btn-ghost">
                  Item
                </button>
              </form>
            </section>

            <section>
              <p className="kicker">Referências</p>
              <ul className="ref-list">
                {refs.map((item) => (
                  <li key={item.id}>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.label || item.url}
                    </a>
                    <button
                      type="button"
                      className="text-btn"
                      onClick={async () => {
                        await api(`/api/tasks/refs?id=${item.id}`, { method: "DELETE" });
                        setRefs((current) => current.filter((row) => row.id !== item.id));
                      }}
                    >
                      x
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="inline-add"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const created = await api<{ ref: TaskRef }>("/api/tasks/refs", {
                    method: "POST",
                    body: JSON.stringify({ taskId: task.id, url: refUrl, label: refLabel }),
                  });
                  setRefs((current) => [created.ref, ...current]);
                  setRefUrl("");
                  setRefLabel("");
                }}
              >
                <input
                  value={refLabel}
                  onChange={(event) => setRefLabel(event.target.value)}
                  placeholder="rótulo"
                />
                <input
                  value={refUrl}
                  onChange={(event) => setRefUrl(event.target.value)}
                  placeholder="https://"
                  required
                />
                <button type="submit" className="btn-ghost">
                  Anexar
                </button>
              </form>
            </section>

            <section>
              <p className="kicker">Comentários</p>
              <form
                className="comment-add"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const created = await api<{ comment: TaskComment }>("/api/tasks/comments", {
                    method: "POST",
                    body: JSON.stringify({ taskId: task.id, body: commentBody }),
                  });
                  setComments((current) => [created.comment, ...current]);
                  setCommentBody("");
                }}
              >
                <textarea
                  rows={3}
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder="Nota de andamento, decisão, blocker…"
                  required
                />
                <button type="submit" className="btn-ink">
                  Registrar
                </button>
              </form>
              <ul className="comment-list">
                {comments.length === 0 ? (
                  <li className="empty-col">Nenhum comentário ainda.</li>
                ) : (
                  comments.map((item) => (
                    <li key={item.id}>
                      <time>{new Date(item.createdAt).toLocaleString("pt-BR")}</time>
                      <p>{item.body}</p>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={async () => {
                          await api(`/api/tasks/comments?id=${item.id}`, { method: "DELETE" });
                          setComments((current) => current.filter((row) => row.id !== item.id));
                        }}
                      >
                        apagar
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        ) : (
          <p className="sheet-hint">Cria a task para soltar links e comentários nela.</p>
        )}
      </aside>
    </>
  );
}
