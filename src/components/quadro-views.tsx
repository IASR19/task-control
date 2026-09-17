"use client";

import { useEffect, useState } from "react";
import { PriorityStamp } from "@/components/priority-stamp";
import { ProjectNameField } from "@/components/project-name-field";
import { IconCheck, IconPlay, IconStop } from "@/components/icons";
import { formatDuration } from "@/lib/format";
import { effortStamp } from "@/lib/effort";
import { columnOrder, listOrder } from "@/lib/order";
import { PRIORITY_COLUMNS } from "@/lib/priority";
import type { Priority, Project, Task } from "@/lib/types";

function TaskClock({ seconds, liveStartedAt }: { seconds: number; liveStartedAt?: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!liveStartedAt) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [liveStartedAt]);
  const live = liveStartedAt ? Math.max(0, Math.floor((now - Date.parse(liveStartedAt)) / 1000)) : 0;
  const total = seconds + live;
  if (total <= 0) return null;
  return <span className="task-time">{formatDuration(total)}</span>;
}

function statusNote(task: Task) {
  if (task.status === "remanejada" && task.previousPriority !== null) {
    return `remanejada de ${PRIORITY_COLUMNS.find((c) => c.value === task.previousPriority)?.stamp}`;
  }
  if (task.status === "done") return "fechada";
  if (task.status === "in_progress") return "em curso";
  return null;
}

export function DoneToggle({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (task: Task) => void;
}) {
  const done = task.status === "done";
  return (
    <button
      type="button"
      className={done ? "done-toggle on" : "done-toggle"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(task);
      }}
      aria-label={done ? "Reabrir tarefa" : "Marcar como concluída"}
      title={done ? "Reabrir" : "Marcar como concluída"}
    >
      <IconCheck width={12} height={12} />
    </button>
  );
}

function TaskActions({
  task,
  running,
  onTimer,
  onToggleDone,
  tiny,
}: {
  task: Task;
  running: boolean;
  onTimer: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  tiny?: boolean;
}) {
  return (
    <div className={tiny ? "task-actions tiny" : "task-actions"}>
      {task.status !== "done" ? (
        <button
          type="button"
          className={running ? `timer-btn${tiny ? " tiny" : ""} on` : `timer-btn${tiny ? " tiny" : ""}`}
          onClick={() => onTimer(task)}
          aria-label={running ? "Encerrar timer" : "Começar timer"}
        >
          {running ? (
            <IconStop width={tiny ? 11 : 13} height={tiny ? 11 : 13} />
          ) : (
            <IconPlay width={tiny ? 11 : 13} height={tiny ? 11 : 13} />
          )}
        </button>
      ) : null}
      <DoneToggle task={task} onToggle={onToggleDone} />
    </div>
  );
}

export function TaskRow({
  task,
  onOpen,
  onTimer,
  onToggleDone,
  runningId,
  timerStartedAt,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  dropBefore,
  seq,
}: {
  task: Task;
  onOpen: (task: Task) => void;
  onTimer: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  runningId: string | null;
  timerStartedAt?: string | null;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: (event: React.DragEvent, task: Task) => void;
  onDragEnd?: () => void;
  onDragOver?: (event: React.DragEvent, task: Task) => void;
  dropBefore?: boolean;
  seq?: number;
}) {
  const note = statusNote(task);
  const running = runningId === task.id;
  return (
    <article
      className={`task-row ${task.status}${dragging ? " dragging" : ""}${dropBefore ? " drop-before" : ""}`}
      draggable={draggable}
      onDragStart={onDragStart ? (event) => onDragStart(event, task) : undefined}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver ? (event) => onDragOver(event, task) : undefined}
    >
      {seq ? <span className="seq">{seq}</span> : null}
      <div
        className="task-main"
        role="button"
        tabIndex={0}
        onClick={() => onOpen(task)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(task);
          }
        }}
      >
        <PriorityStamp priority={task.priority} />
        <div>
          <p className="task-title">{task.title}</p>
          <p className="task-meta">
            <span className="proj-name">{task.projectName}</span>
            {note ? <span className="task-flag">{note}</span> : null}
            {task.effort ? <span className="effort-chip">{effortStamp(task.effort)}</span> : null}
            {task.checkTotal > 0 ? (
              <span className="check-chip">
                {task.checkDone}/{task.checkTotal}
              </span>
            ) : null}
            <TaskClock seconds={task.effortSeconds} liveStartedAt={running ? timerStartedAt : null} />
          </p>
        </div>
      </div>
      <TaskActions task={task} running={running} onTimer={onTimer} onToggleDone={onToggleDone} />
    </article>
  );
}

export function PriorityBoard({
  tasks,
  onOpen,
  onTimer,
  onToggleDone,
  onMove,
  runningId,
  visiblePriorities,
  timerStartedAt,
}: {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onTimer: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  onMove: (task: Task, priority: Priority, beforeId: string | null) => void;
  runningId: string | null;
  visiblePriorities?: Priority[];
  timerStartedAt?: string | null;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [over, setOver] = useState<{ priority: Priority; beforeId: string | null } | null>(null);
  const columns = visiblePriorities?.length
    ? PRIORITY_COLUMNS.filter((column) => visiblePriorities.includes(column.value))
    : PRIORITY_COLUMNS;

  function startDrag(event: React.DragEvent, task: Task) {
    if ((event.target as HTMLElement).closest(".task-actions")) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("text/plain", task.id);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(task.id);
  }

  function dropOn(event: React.DragEvent, priority: Priority, beforeId: string | null) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    const task = tasks.find((item) => item.id === id);
    if (task) onMove(task, priority, beforeId);
    setOver(null);
    setDraggingId(null);
  }

  return (
    <div className="priority-board" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
      {columns.map((column) => {
        const items = columnOrder(tasks.filter((task) => task.priority === column.value));
        return (
          <section
            key={column.value}
            className={over?.priority === column.value ? "board-col drop-on" : "board-col"}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if ((event.target as HTMLElement).closest(".task-row")) return;
              setOver({ priority: column.value, beforeId: null });
            }}
            onDrop={(event) => dropOn(event, column.value, over?.priority === column.value ? over.beforeId : null)}
          >
            <header>
              <PriorityStamp priority={column.value as Priority} large />
              <div>
                <h2>{column.label}</h2>
                <p>{column.hint}</p>
              </div>
              <span className="col-count">{items.length}</span>
            </header>
            <div className="col-body">
              {items.length === 0 ? (
                <p className="empty-col">{draggingId ? "Solta aqui." : "Nada nesse carimbo."}</p>
              ) : (
                items.map((task, index) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onOpen={onOpen}
                    onTimer={onTimer}
                    onToggleDone={onToggleDone}
                    runningId={runningId}
                    timerStartedAt={timerStartedAt}
                    draggable
                    dragging={draggingId === task.id}
                    dropBefore={over?.priority === column.value && over.beforeId === task.id}
                    seq={index + 1}
                    onDragStart={startDrag}
                    onDragOver={(event, hovered) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (hovered.id === draggingId) return;
                      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                      const before = event.clientY < rect.top + rect.height / 2;
                      const next = items[index + 1];
                      setOver({
                        priority: column.value,
                        beforeId: before ? hovered.id : (next && next.id !== draggingId ? next.id : null),
                      });
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOver(null);
                    }}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function TaskListView({
  tasks,
  onOpen,
  onTimer,
  onToggleDone,
  runningId,
  timerStartedAt,
}: {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onTimer: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  runningId: string | null;
  timerStartedAt?: string | null;
}) {
  return (
    <div className="list-view">
      <div className="list-head">
        <span>Pri.</span>
        <span>Tarefa</span>
        <span>Projeto</span>
        <span>Esforço</span>
        <span />
      </div>
      {listOrder(tasks).map((task) => (
        <div key={task.id} className={`list-row ${task.status}`}>
          <PriorityStamp priority={task.priority} />
          <button type="button" className="linkish" onClick={() => onOpen(task)}>
            {task.title}
            {statusNote(task) ? <small>{statusNote(task)}</small> : null}
          </button>
          <span className="proj-name">{task.projectName}</span>
          <span className="mono">
            {task.effort ? effortStamp(task.effort) : "—"}
            {task.checkTotal ? ` · ${task.checkDone}/${task.checkTotal}` : ""}
            {task.effortSeconds || runningId === task.id ? " · " : ""}
            <TaskClock
              seconds={task.effortSeconds}
              liveStartedAt={runningId === task.id ? timerStartedAt : null}
            />
          </span>
          <TaskActions
            task={task}
            running={runningId === task.id}
            onTimer={onTimer}
            onToggleDone={onToggleDone}
          />
        </div>
      ))}
    </div>
  );
}

export function ProjectMural({
  projects,
  tasks,
  onOpen,
  onTimer,
  onToggleDone,
  runningId,
  onRenameProject,
  onMoveProject,
  timerStartedAt,
}: {
  projects: Project[];
  tasks: Task[];
  onOpen: (task: Task) => void;
  onTimer: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  runningId: string | null;
  onRenameProject: (id: string, name: string) => Promise<void>;
  onMoveProject: (task: Task, projectId: string, beforeId: string | null) => void;
  timerStartedAt?: string | null;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [over, setOver] = useState<{ projectId: string; beforeId: string | null } | null>(null);

  return (
    <div className="mural">
      {projects.map((project) => {
        const items = columnOrder(tasks.filter((task) => task.projectId === project.id));
        return (
          <section
            key={project.id}
            className={over?.projectId === project.id ? "mural-cell drop-on" : "mural-cell"}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if ((event.target as HTMLElement).closest(".mural-line")) return;
              setOver({ projectId: project.id, beforeId: null });
            }}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/plain");
              const task = tasks.find((item) => item.id === id);
              if (task) {
                onMoveProject(
                  task,
                  project.id,
                  over?.projectId === project.id ? over.beforeId : null,
                );
              }
              setOver(null);
              setDraggingId(null);
            }}
          >
            <h2>
              <ProjectNameField project={project} variant="mural" onRename={onRenameProject} />
            </h2>
            {items.length === 0 ? (
              <p className="empty-col">{draggingId ? "Solta aqui." : "Sem linhas."}</p>
            ) : (
              items.map((task, index) => (
                <div
                  key={task.id}
                  className={`mural-line${draggingId === task.id ? " dragging" : ""}${
                    over?.projectId === project.id && over.beforeId === task.id ? " drop-before" : ""
                  }`}
                  draggable
                  onDragStart={(event) => {
                    if ((event.target as HTMLElement).closest(".task-actions")) {
                      event.preventDefault();
                      return;
                    }
                    event.dataTransfer.setData("text/plain", task.id);
                    event.dataTransfer.effectAllowed = "move";
                    setDraggingId(task.id);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (task.id === draggingId) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    const before = event.clientY < rect.top + rect.height / 2;
                    const next = items[index + 1];
                    setOver({
                      projectId: project.id,
                      beforeId: before ? task.id : (next && next.id !== draggingId ? next.id : null),
                    });
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOver(null);
                  }}
                >
                  <span className="idx">{index + 1})</span>
                  <div
                    className="linkish"
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpen(task)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpen(task);
                      }
                    }}
                  >
                    {task.title}
                  </div>
                  <PriorityStamp priority={task.priority} />
                  {task.effort ? <span className="effort-chip">{effortStamp(task.effort)}</span> : null}
                  <TaskClock
                    seconds={task.effortSeconds}
                    liveStartedAt={runningId === task.id ? timerStartedAt : null}
                  />
                  <TaskActions
                    task={task}
                    running={runningId === task.id}
                    onTimer={onTimer}
                    onToggleDone={onToggleDone}
                    tiny
                  />
                </div>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
