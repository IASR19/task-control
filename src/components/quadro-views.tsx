"use client";

import { PriorityStamp } from "@/components/priority-stamp";
import { IconPlay, IconStop } from "@/components/icons";
import { formatDuration } from "@/lib/format";
import { PRIORITY_COLUMNS } from "@/lib/priority";
import type { Priority, Project, Task } from "@/lib/types";

function statusNote(task: Task) {
  if (task.status === "remanejada" && task.previousPriority !== null) {
    return `remanejada de ${PRIORITY_COLUMNS.find((c) => c.value === task.previousPriority)?.stamp}`;
  }
  if (task.status === "done") return "saiu da lousa";
  if (task.status === "in_progress") return "em curso";
  return null;
}

export function TaskRow({
  task,
  onOpen,
  onTimer,
  runningId,
}: {
  task: Task;
  onOpen: (task: Task) => void;
  onTimer: (task: Task) => void;
  runningId: string | null;
}) {
  const note = statusNote(task);
  const running = runningId === task.id;
  return (
    <article className={`task-row ${task.status}`}>
      <button type="button" className="task-main" onClick={() => onOpen(task)}>
        <PriorityStamp priority={task.priority} />
        <div>
          <p className="task-title">{task.title}</p>
          <p className="task-meta">
            <span className="proj-name">{task.projectName}</span>
            {note ? <span className="task-flag">{note}</span> : null}
            {task.effortSeconds > 0 ? (
              <span className="task-time">{formatDuration(task.effortSeconds)}</span>
            ) : null}
          </p>
        </div>
      </button>
      {task.status !== "done" ? (
        <button
          type="button"
          className={running ? "timer-btn on" : "timer-btn"}
          onClick={() => onTimer(task)}
          aria-label={running ? "Encerrar timer" : "Começar timer"}
        >
          {running ? <IconStop width={13} height={13} /> : <IconPlay width={13} height={13} />}
        </button>
      ) : null}
    </article>
  );
}

export function PriorityBoard({
  tasks,
  onOpen,
  onTimer,
  runningId,
}: {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onTimer: (task: Task) => void;
  runningId: string | null;
}) {
  return (
    <div className="priority-board">
      {PRIORITY_COLUMNS.map((column) => {
        const items = tasks.filter((task) => task.priority === column.value);
        return (
          <section key={column.value} className="board-col">
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
                <p className="empty-col">Nada nesse carimbo.</p>
              ) : (
                items.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onOpen={onOpen}
                    onTimer={onTimer}
                    runningId={runningId}
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
  runningId,
}: {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onTimer: (task: Task) => void;
  runningId: string | null;
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
      {tasks.map((task) => (
        <div key={task.id} className={`list-row ${task.status}`}>
          <PriorityStamp priority={task.priority} />
          <button type="button" className="linkish" onClick={() => onOpen(task)}>
            {task.title}
            {statusNote(task) ? <small>{statusNote(task)}</small> : null}
          </button>
          <span className="proj-name">{task.projectName}</span>
          <span className="mono">{task.effortSeconds ? formatDuration(task.effortSeconds) : "—"}</span>
          {task.status !== "done" ? (
            <button type="button" className="timer-btn" onClick={() => onTimer(task)}>
              {runningId === task.id ? <IconStop width={13} height={13} /> : <IconPlay width={13} height={13} />}
            </button>
          ) : (
            <span />
          )}
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
  runningId,
}: {
  projects: Project[];
  tasks: Task[];
  onOpen: (task: Task) => void;
  onTimer: (task: Task) => void;
  runningId: string | null;
}) {
  return (
    <div className="mural">
      {projects.map((project) => {
        const items = tasks.filter((task) => task.projectId === project.id);
        return (
          <section key={project.id} className="mural-cell">
            <h2>{project.name}</h2>
            {items.length === 0 ? (
              <p className="empty-col">Sem linhas.</p>
            ) : (
              items.map((task, index) => (
                <div key={task.id} className="mural-line">
                  <span className="idx">{index + 1})</span>
                  <button type="button" className="linkish" onClick={() => onOpen(task)}>
                    {task.title}
                  </button>
                  <PriorityStamp priority={task.priority} />
                  {task.status !== "done" ? (
                    <button type="button" className="timer-btn tiny" onClick={() => onTimer(task)}>
                      {runningId === task.id ? (
                        <IconStop width={11} height={11} />
                      ) : (
                        <IconPlay width={11} height={11} />
                      )}
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
