"use client";

import { useState } from "react";
import { IconClose } from "@/components/icons";
import { PriorityStamp } from "@/components/priority-stamp";
import { PRIORITY_COLUMNS } from "@/lib/priority";
import type { Priority, Project, Task, TaskStatus } from "@/lib/types";

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
    status?: TaskStatus;
  }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
};

export function TaskEditor({ open, task, projects, onClose, onSave, onDelete }: Props) {
  const [projectId, setProjectId] = useState(task?.projectId ?? projects[0]?.id ?? "");
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 0);
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "open");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  return (
    <aside className="sheet">
      <div className="sheet-head">
        <p className="kicker">{task ? "Corrigir linha" : "Nova linha"}</p>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
          <IconClose width={16} height={16} />
        </button>
      </div>
      <form
        className="sheet-body"
        onSubmit={async (event) => {
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
              status: task ? status : "open",
            });
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Não salvou.");
          } finally {
            setBusy(false);
          }
        }}
      >
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
          Tarefa
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>
          Notas
          <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <fieldset>
          <legend>Prioridade da lousa</legend>
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
            {busy ? "Salvando…" : "Guardar"}
          </button>
          {task && onDelete ? (
            <button
              type="button"
              className="text-btn danger"
              onClick={async () => {
                if (!window.confirm("Apagar essa linha de vez?")) return;
                await onDelete(task.id);
                onClose();
              }}
            >
              Excluir
            </button>
          ) : null}
        </div>
      </form>
    </aside>
  );
}
