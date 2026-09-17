"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconGrid, IconList, IconMark } from "@/components/icons";
import { PriorityBoard, ProjectMural, TaskListView } from "@/components/quadro-views";
import { TaskEditor } from "@/components/task-editor";
import { api } from "@/lib/api";
import type { Priority, Project, Task, TaskStatus } from "@/lib/types";

type View = "prioridade" | "lista" | "mural";

export default function QuadroPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<View>("prioridade");
  const [projectId, setProjectId] = useState("all");
  const [showDone, setShowDone] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [projectName, setProjectName] = useState("");

  const load = useCallback(async () => {
    const [projectData, taskData, timerData] = await Promise.all([
      api<{ projects: Project[] }>("/api/projects"),
      api<{ tasks: Task[] }>("/api/tasks"),
      api<{ session: { taskId: string } | null }>("/api/tasks/timer"),
    ]);
    setProjects(projectData.projects);
    setTasks(taskData.tasks);
    setRunningId(timerData.session?.taskId ?? null);
  }, []);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar"));
  }, [load]);

  const visible = useMemo(() => {
    return tasks.filter((task) => {
      if (!showDone && task.status === "done") return false;
      if (projectId !== "all" && task.projectId !== projectId) return false;
      return true;
    });
  }, [tasks, showDone, projectId]);

  async function saveTask(payload: {
    id?: string;
    projectId: string;
    title: string;
    notes: string;
    priority: Priority;
    status?: TaskStatus;
  }) {
    if (payload.id) {
      await api("/api/tasks", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    await load();
  }

  async function toggleTimer(task: Task) {
    await api("/api/tasks/timer", {
      method: "POST",
      body: JSON.stringify({
        taskId: task.id,
        action: runningId === task.id ? "stop" : "start",
      }),
    });
    window.dispatchEvent(new Event("lousa-timer"));
    await load();
  }

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    if (!projectName.trim()) return;
    await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: projectName.trim() }),
    });
    setProjectName("");
    await load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">O quadro</p>
          <h1>O que está na parede.</h1>
        </div>
        <div className="toolbar">
          <div className="view-tabs">
            <button type="button" className={view === "prioridade" ? "on" : ""} onClick={() => setView("prioridade")}>
              <IconMark width={12} height={12} /> Prioridade
            </button>
            <button type="button" className={view === "lista" ? "on" : ""} onClick={() => setView("lista")}>
              <IconList width={12} height={12} /> Lista
            </button>
            <button type="button" className={view === "mural" ? "on" : ""} onClick={() => setView("mural")}>
              <IconGrid width={12} height={12} /> Mural
            </button>
          </div>
          <button
            type="button"
            className="btn-ink"
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
            disabled={projects.length === 0}
          >
            Nova linha
          </button>
        </div>
      </div>

      <div className="filter-row">
        <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="all">Todos os projetos</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={showDone}
            onChange={(event) => setShowDone(event.target.checked)}
          />
          Mostrar o que saiu da lousa
        </label>
        <form onSubmit={createProject} className="toolbar">
          <input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Novo projeto"
            style={{ background: "transparent", border: 0, borderBottom: "1px solid var(--ink)", padding: "6px 0" }}
          />
          <button type="submit" className="btn-ghost">
            Criar projeto
          </button>
        </form>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {projects.length === 0 ? (
        <div className="empty-state">
          <p>
            A lousa está apagada. Vai em <strong>Foto</strong> e manda um print do quadro, ou cria o
            primeiro projeto aqui e escreve as linhas à mão.
          </p>
        </div>
      ) : view === "prioridade" ? (
        <PriorityBoard tasks={visible} onOpen={(task) => { setEditing(task); setEditorOpen(true); }} onTimer={toggleTimer} runningId={runningId} />
      ) : view === "lista" ? (
        <TaskListView tasks={visible} onOpen={(task) => { setEditing(task); setEditorOpen(true); }} onTimer={toggleTimer} runningId={runningId} />
      ) : (
        <ProjectMural
          projects={projectId === "all" ? projects : projects.filter((project) => project.id === projectId)}
          tasks={visible}
          onOpen={(task) => { setEditing(task); setEditorOpen(true); }}
          onTimer={toggleTimer}
          runningId={runningId}
        />
      )}

      <TaskEditor
        key={editing?.id ?? (editorOpen ? "new" : "closed")}
        open={editorOpen}
        task={editing}
        projects={projects}
        onClose={() => setEditorOpen(false)}
        onSave={saveTask}
        onDelete={async (id) => {
          await api(`/api/tasks?id=${id}`, { method: "DELETE" });
          await load();
        }}
      />
    </div>
  );
}
