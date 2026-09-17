"use client";

import { useMemo, useState } from "react";
import { PRIORITY_COLUMNS } from "@/lib/priority";
import type { ExtractedBoard, ExtractedProject, Priority } from "@/lib/types";

type DraftTask = {
  key: string;
  title: string;
  priority: Priority;
};

type DraftProject = {
  key: string;
  name: string;
  tasks: DraftTask[];
};

type Props = {
  extracted: ExtractedBoard;
  busy: boolean;
  error: string;
  onApply: (extracted: ExtractedBoard) => Promise<void>;
  onDiscard: () => void;
};

function uid() {
  return crypto.randomUUID();
}

function toDraft(extracted: ExtractedBoard): DraftProject[] {
  return extracted.projects.map((project) => ({
    key: uid(),
    name: project.name,
    tasks: project.tasks.map((task) => ({
      key: uid(),
      title: task.title,
      priority: task.priority,
    })),
  }));
}

function fromDraft(draft: DraftProject[]): ExtractedBoard {
  return {
    projects: draft
      .map((project, projectIndex) => ({
        name: project.name.trim(),
        tasks: project.tasks
          .map((task, index) => ({
            title: task.title.trim(),
            priority: task.priority,
            order: index + 1,
          }))
          .filter((task) => task.title.length > 0),
      }))
      .filter((project: ExtractedProject) => project.name.length > 0),
  };
}

export function IngestReview({ extracted, busy, error, onApply, onDiscard }: Props) {
  const [draft, setDraft] = useState(() => toDraft(extracted));
  const lineCount = useMemo(
    () => draft.reduce((sum, project) => sum + project.tasks.filter((task) => task.title.trim()).length, 0),
    [draft],
  );

  function patchProject(key: string, patch: Partial<DraftProject>) {
    setDraft((current) => current.map((project) => (project.key === key ? { ...project, ...patch } : project)));
  }

  function patchTask(projectKey: string, taskKey: string, patch: Partial<DraftTask>) {
    setDraft((current) =>
      current.map((project) =>
        project.key === projectKey
          ? {
              ...project,
              tasks: project.tasks.map((task) => (task.key === taskKey ? { ...task, ...patch } : task)),
            }
          : project,
      ),
    );
  }

  return (
    <section className="ingest-review">
      <header className="ingest-review-head">
        <div>
          <p className="kicker">/review</p>
          <h2>Confere o que a foto puxou.</h2>
        </div>
        <p className="ingest-count">
          {draft.length} proj · {lineCount} linhas
        </p>
      </header>
      <p className="lead" style={{ maxWidth: "40rem", color: "var(--ink-soft)", marginTop: 0 }}>
        Corrige nome de projeto, título e prioridade antes de gravar. Linha que você apagar não entra no quadro.
      </p>

      <div className="ingest-stack">
        {draft.map((project, projectIndex) => (
          <article key={project.key} className="ingest-project">
            <div className="ingest-project-head">
              <span className="idx">{String(projectIndex + 1).padStart(2, "0")}</span>
              <input
                value={project.name}
                onChange={(event) => patchProject(project.key, { name: event.target.value })}
                placeholder="Nome do projeto"
                aria-label="Nome do projeto"
              />
              <button
                type="button"
                className="text-btn danger"
                onClick={() => setDraft((current) => current.filter((item) => item.key !== project.key))}
              >
                tirar
              </button>
            </div>
            <div className="ingest-lines">
              {project.tasks.map((task, index) => (
                <div key={task.key} className="ingest-line">
                  <span className="idx">{index + 1})</span>
                  <input
                    value={task.title}
                    onChange={(event) => patchTask(project.key, task.key, { title: event.target.value })}
                    placeholder="Tarefa"
                    aria-label="Título da tarefa"
                  />
                  <select
                    value={task.priority}
                    onChange={(event) =>
                      patchTask(project.key, task.key, { priority: Number(event.target.value) as Priority })
                    }
                    aria-label="Prioridade"
                  >
                    {PRIORITY_COLUMNS.map((column) => (
                      <option key={column.value} value={column.value}>
                        {column.stamp} · {column.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() =>
                      patchProject(project.key, {
                        tasks: project.tasks.filter((item) => item.key !== task.key),
                      })
                    }
                    aria-label="Remover linha"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-ghost ingest-add"
                onClick={() =>
                  patchProject(project.key, {
                    tasks: [...project.tasks, { key: uid(), title: "", priority: 3 }],
                  })
                }
              >
                + linha
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="ingest-actions">
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            setDraft((current) => [...current, { key: uid(), name: "", tasks: [{ key: uid(), title: "", priority: 3 }] }])
          }
        >
          + projeto
        </button>
        <div className="toolbar">
          <button type="button" className="btn-ghost" onClick={onDiscard} disabled={busy}>
            Descartar
          </button>
          <button
            type="button"
            className="btn-ink"
            disabled={busy || lineCount === 0}
            onClick={() => void onApply(fromDraft(draft))}
          >
            {busy ? "Gravando…" : "Aplicar no quadro"}
          </button>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
