import { and, desc, eq, gte, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks, timeSessions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { keyToDate, saoPauloKey, shiftKey } from "@/lib/dates";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import type { TaskStatus } from "@/lib/types";

function liveSeconds(startedAt: Date, endedAt: Date | null, stored: number) {
  if (endedAt) return stored;
  return Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000));
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const params = new URL(request.url).searchParams;
    const from = params.get("from") || saoPauloKey();
    const to = params.get("to") || from;
    const projectId = params.get("projectId");
    const status = params.get("status") || "all";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new HttpError(400, "Período inválido.");
    }
    const fromDate = keyToDate(from);
    const toExclusive = keyToDate(shiftKey(to, 1));

    const range = and(
      eq(timeSessions.userId, user.id),
      lt(timeSessions.startedAt, toExclusive),
      or(isNull(timeSessions.endedAt), gte(timeSessions.endedAt, fromDate)),
    );
    const statusFilter =
      status === "running"
        ? isNull(timeSessions.endedAt)
        : status === "closed"
          ? isNotNull(timeSessions.endedAt)
          : undefined;
    const projectFilter = projectId ? eq(tasks.projectId, projectId) : undefined;

    const clauses = [range];
    if (statusFilter) clauses.push(statusFilter);
    if (projectFilter) clauses.push(projectFilter);

    const rows = await db()
      .select({
        id: timeSessions.id,
        taskId: timeSessions.taskId,
        taskTitle: tasks.title,
        taskStatus: tasks.status,
        projectId: tasks.projectId,
        projectName: projects.name,
        startedAt: timeSessions.startedAt,
        endedAt: timeSessions.endedAt,
        durationSeconds: timeSessions.durationSeconds,
      })
      .from(timeSessions)
      .innerJoin(tasks, eq(tasks.id, timeSessions.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(and(...clauses))
      .orderBy(desc(timeSessions.startedAt))
      .limit(2000);

    const sessions = rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      projectId: row.projectId,
      taskTitle: row.taskTitle,
      projectName: row.projectName,
      taskStatus: row.taskStatus as TaskStatus,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
      durationSeconds: liveSeconds(row.startedAt, row.endedAt, row.durationSeconds),
    }));

    const byProjectMap = new Map<string, { seconds: number; sessions: number }>();
    const byDayMap = new Map<string, { seconds: number; sessions: number }>();
    const byTaskMap = new Map<
      string,
      {
        id: string;
        title: string;
        projectName: string;
        status: TaskStatus;
        seconds: number;
        sessions: number;
        running: boolean;
      }
    >();

    for (const session of sessions) {
      const project = byProjectMap.get(session.projectName) ?? { seconds: 0, sessions: 0 };
      project.seconds += session.durationSeconds;
      project.sessions += 1;
      byProjectMap.set(session.projectName, project);

      const day = session.startedAt.slice(0, 10);
      const dayRow = byDayMap.get(day) ?? { seconds: 0, sessions: 0 };
      dayRow.seconds += session.durationSeconds;
      dayRow.sessions += 1;
      byDayMap.set(day, dayRow);

      const task = byTaskMap.get(session.taskId) ?? {
        id: session.taskId,
        title: session.taskTitle,
        projectName: session.projectName,
        status: session.taskStatus ?? "open",
        seconds: 0,
        sessions: 0,
        running: false,
      };
      task.seconds += session.durationSeconds;
      task.sessions += 1;
      if (!session.endedAt) task.running = true;
      byTaskMap.set(session.taskId, task);
    }

    const byDay = [];
    for (let key = from; key <= to; key = shiftKey(key, 1)) {
      const found = byDayMap.get(key);
      byDay.push({ date: key, seconds: found?.seconds ?? 0, sessions: found?.sessions ?? 0 });
    }

    return jsonOk({
      from,
      to,
      totals: {
        seconds: sessions.reduce((sum, item) => sum + item.durationSeconds, 0),
        sessions: sessions.length,
        running: sessions.filter((item) => !item.endedAt).length,
        tasks: byTaskMap.size,
      },
      byProject: [...byProjectMap.entries()]
        .map(([name, value]) => ({ name, ...value }))
        .sort((a, b) => b.seconds - a.seconds),
      byDay,
      byTask: [...byTaskMap.values()].sort((a, b) => b.seconds - a.seconds),
      sessions,
    });
  } catch (error) {
    return handleError(error);
  }
}
