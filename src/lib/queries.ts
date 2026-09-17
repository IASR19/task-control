import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks, timeSessions } from "@/db/schema";
import { HttpError } from "@/lib/http";
import type { Priority, Task, TaskStatus } from "@/lib/types";

export async function listProjects(userId: string) {
  const rows = await db()
    .select({
      id: projects.id,
      name: projects.name,
      sortOrder: projects.sortOrder,
      openCount: sql<number>`coalesce(count(${tasks.id}) filter (where ${tasks.status} <> 'done'), 0)::int`,
    })
    .from(projects)
    .leftJoin(tasks, and(eq(tasks.projectId, projects.id), eq(tasks.userId, userId)))
    .where(eq(projects.userId, userId))
    .groupBy(projects.id)
    .orderBy(projects.sortOrder, projects.name);
  return rows;
}

export async function listTasks(userId: string) {
  const rows = await db()
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      projectName: projects.name,
      title: tasks.title,
      notes: tasks.notes,
      priority: tasks.priority,
      previousPriority: tasks.previousPriority,
      status: tasks.status,
      source: tasks.source,
      sortOrder: tasks.sortOrder,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      effortSeconds: sql<number>`coalesce((
        select sum(${timeSessions.durationSeconds})
        from ${timeSessions}
        where ${timeSessions.taskId} = ${tasks.id}
      ), 0)::int`,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.userId, userId))
    .orderBy(tasks.priority, projects.sortOrder, tasks.sortOrder, tasks.createdAt);

  return rows.map(
    (row): Task => ({
      ...row,
      priority: row.priority as Priority,
      previousPriority: (row.previousPriority as Priority | null) ?? null,
      status: row.status as TaskStatus,
      source: row.source as Task["source"],
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }),
  );
}

export async function getProjectForUser(userId: string, projectId: string) {
  const rows = await db()
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  const project = rows[0];
  if (!project) throw new HttpError(404, "Projeto não encontrado.");
  return project;
}

export async function getTaskForUser(userId: string, taskId: string) {
  const rows = await db()
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  const task = rows[0];
  if (!task) throw new HttpError(404, "Tarefa não encontrada.");
  return task;
}
