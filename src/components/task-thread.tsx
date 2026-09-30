"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";
import { saoPauloKey } from "@/lib/dates";
import { formatClockTime, formatDuration, formatStamp } from "@/lib/format";
import { emitClosed, TIMER_EVENT } from "@/lib/timer-sync";
import type { TaskCheck, TaskComment, TaskRef, TimeSession } from "@/lib/types";

// Iterações + lançar tempo, checklist, referências e comentários de uma task.
// Usado pelo editor do dono e pelo card do projeto compartilhado (sem referências).
export function TaskThread({
  taskId,
  isBoardOwner,
  showRefs = isBoardOwner,
  layout = "stack",
  onSessions,
  onChanged,
}: {
  taskId: string;
  isBoardOwner: boolean;
  showRefs?: boolean;
  // "stack": tudo empilhado (editor do dono). "tabs": Checklist · Tempo · Comentários (card compartilhado).
  layout?: "stack" | "tabs";
  onSessions?: (sessions: TimeSession[]) => void;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [refs, setRefs] = useState<TaskRef[]>([]);
  const [checks, setChecks] = useState<TaskCheck[]>([]);
  const [checkTitle, setCheckTitle] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [refUrl, setRefUrl] = useState("");
  const [refLabel, setRefLabel] = useState("");
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [now, setNow] = useState(Date.now());
  const [logHours, setLogHours] = useState("0");
  const [logMinutes, setLogMinutes] = useState("30");
  const [logDate, setLogDate] = useState(saoPauloKey());
  const [logStart, setLogStart] = useState("");
  const [logBusy, setLogBusy] = useState(false);
  const [logError, setLogError] = useState("");
  const [tab, setTab] = useState<"checks" | "time" | "comments">("checks");
  const [logOpen, setLogOpen] = useState(false);
  const tabs = layout === "tabs";

  const load = useCallback(async () => {
    const [commentData, refData, checkData, sessionData] = await Promise.all([
      api<{ comments: TaskComment[] }>(`/api/tasks/comments?taskId=${taskId}`),
      showRefs ? api<{ refs: TaskRef[] }>(`/api/tasks/refs?taskId=${taskId}`) : Promise.resolve({ refs: [] }),
      api<{ checks: TaskCheck[] }>(`/api/tasks/checks?taskId=${taskId}`),
      api<{ sessions: TimeSession[] }>(`/api/sessions?taskId=${taskId}`),
    ]);
    setComments(commentData.comments);
    setRefs(refData.refs);
    setChecks(checkData.checks);
    setSessions(sessionData.sessions);
  }, [taskId, showRefs]);

  useEffect(() => {
    void load().catch(() => undefined);
    const onTimer = () => void load().catch(() => undefined);
    window.addEventListener(TIMER_EVENT, onTimer);
    return () => window.removeEventListener(TIMER_EVENT, onTimer);
  }, [load]);

  useEffect(() => {
    onSessions?.(sessions);
  }, [sessions, onSessions]);

  useEffect(() => {
    if (!sessions.some((item) => !item.endedAt)) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [sessions]);

  async function logTime(event: FormEvent) {
    event.preventDefault();
    const hours = Math.max(0, Number(logHours) || 0);
    const minutes = Math.max(0, Number(logMinutes) || 0);
    const durationSeconds = hours * 3600 + minutes * 60;
    if (durationSeconds < 60) {
      setLogError("Lança pelo menos 1 minuto.");
      return;
    }
    const startedAt = logStart
      ? new Date(`${logDate}T${logStart}:00`)
      : logDate === saoPauloKey()
        ? new Date(Date.now() - durationSeconds * 1000)
        : new Date(`${logDate}T09:00:00`);
    if (Number.isNaN(startedAt.getTime())) {
      setLogError("Data de início inválida.");
      return;
    }
    setLogBusy(true);
    setLogError("");
    try {
      const created = await api<{ session: TimeSession }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          taskId,
          durationSeconds,
          startedAt: startedAt.toISOString(),
        }),
      });
      setSessions((current) => [created.session, ...current]);
      emitClosed({ taskId, seconds: durationSeconds });
      onChanged?.();
      setLogHours("0");
      setLogMinutes("30");
      setLogStart("");
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "Não lançou o tempo.");
    } finally {
      setLogBusy(false);
    }
  }

  const iterationsSection = (
    <section>
      {tabs ? null : <p className="kicker">Iterações</p>}
      {sessions.length === 0 ? (
        <p className="empty-col">Ainda não ligou o timer. Lança à mão se esqueceu o play.</p>
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
                  <strong>
                    {item.personId && item.personId !== user?.id ? (
                      <Avatar person={{ id: item.personId, name: item.personName ?? "" }} size={16} hint="rodou" />
                    ) : null}
                    {formatStamp(item.startedAt)}
                  </strong>
                  <span>
                    {formatClockTime(item.startedAt)} → {running ? "agora" : formatClockTime(item.endedAt ?? item.startedAt)}
                  </span>
                </div>
                <span className="dur">{formatDuration(seconds)}</span>
                {running || !(item.personId === user?.id || isBoardOwner) ? null : (
                  <button
                    type="button"
                    className="text-btn"
                    onClick={async () => {
                      if (!window.confirm("Apagar esse lançamento?")) return;
                      await api(`/api/sessions?id=${item.id}`, { method: "DELETE" });
                      setSessions((current) => current.filter((row) => row.id !== item.id));
                      emitClosed({ taskId, seconds: -item.durationSeconds });
                      onChanged?.();
                    }}
                  >
                    apagar
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {tabs && !logOpen ? (
        <button type="button" className="btn-ghost log-open" onClick={() => setLogOpen(true)}>
          + Lançar tempo
        </button>
      ) : (
      <form className="time-log" onSubmit={(event) => void logTime(event)}>
        <label>
          h
          <input
            type="number"
            min={0}
            max={24}
            inputMode="numeric"
            value={logHours}
            onChange={(event) => setLogHours(event.target.value)}
          />
        </label>
        <label>
          min
          <input
            type="number"
            min={0}
            max={59}
            inputMode="numeric"
            value={logMinutes}
            onChange={(event) => setLogMinutes(event.target.value)}
          />
        </label>
        <label>
          dia
          <input type="date" value={logDate} onChange={(event) => setLogDate(event.target.value)} required />
        </label>
        <label>
          início
          <input type="time" value={logStart} onChange={(event) => setLogStart(event.target.value)} />
        </label>
        <button type="submit" className="btn-ghost" disabled={logBusy}>
          {logBusy ? "Lançando…" : "Lançar tempo"}
        </button>
        {logError ? <p className="form-error">{logError}</p> : null}
      </form>
      )}
    </section>
  );

  const checklistSection = (
    <section>
      {tabs ? null : <p className="kicker">Checklist</p>}
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
                  onChanged?.();
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
                  onChanged?.();
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
            body: JSON.stringify({ taskId: taskId, title: checkTitle }),
          });
          setChecks((current) => [...current, created.check]);
          setCheckTitle("");
          onChanged?.();
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
  );

  const refsSection = showRefs ? (
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
            body: JSON.stringify({ taskId: taskId, url: refUrl, label: refLabel }),
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
  ) : null;

  const commentsSection = (
    <section>
      {tabs ? null : <p className="kicker">Comentários</p>}
      <form
        className="comment-add"
        onSubmit={async (event) => {
          event.preventDefault();
          const created = await api<{ comment: TaskComment }>("/api/tasks/comments", {
            method: "POST",
            body: JSON.stringify({ taskId: taskId, body: commentBody }),
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
              <time>
                {item.authorId !== user?.id ? (
                  <Avatar person={{ id: item.authorId, name: item.authorName }} size={16} />
                ) : null}
                {new Date(item.createdAt).toLocaleString("pt-BR")}
                {item.authorId !== user?.id ? ` · ${item.authorName}` : ""}
              </time>
              <p>{item.body}</p>
              {item.authorId === user?.id || isBoardOwner ? (
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
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );

  if (tabs) {
    const totalSeconds = sessions.reduce(
      (sum, item) =>
        sum + (item.endedAt ? item.durationSeconds : Math.max(0, Math.floor((now - Date.parse(item.startedAt)) / 1000))),
      0,
    );
    const tabButton = (id: typeof tab, label: string, count: string) => (
      <button type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
        {label} <em>{count}</em>
      </button>
    );
    return (
      <div className="thread-tabs">
        <div className="view-tabs thread-tab-bar" role="tablist">
          {tabButton("checks", "Checklist", `${checks.filter((item) => item.done).length}/${checks.length}`)}
          {tabButton("time", "Tempo", `${formatDuration(totalSeconds)} · ${sessions.length}`)}
          {tabButton("comments", "Comentários", String(comments.length))}
        </div>
        {tab === "checks" ? checklistSection : tab === "time" ? iterationsSection : commentsSection}
      </div>
    );
  }

  return (
    <>
      {iterationsSection}
      {checklistSection}
      {refsSection}
      {commentsSection}
    </>
  );
}
