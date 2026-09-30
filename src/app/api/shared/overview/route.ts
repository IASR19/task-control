import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks, timeSessions, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { keyToDate, saoPauloKey, shiftKey, startOfWeekKey } from "@/lib/dates";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { requireProjectAccess } from "@/lib/sharing";
import type { SharedOverview, TaskStatus } from "@/lib/types";

const DAYS = 14;
const WEEKS = 8;

function liveSeconds(startedAt: Date, endedAt: Date | null, stored: number) {
  if (endedAt) return stored;
  return Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000));
}

// Visão do projeto compartilhado: tempo por task/pessoa/dia e fechadas por semana. Dono ou membro.
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) throw new HttpError(400, "Informe o projeto.");
    await requireProjectAccess(user.id, projectId);

    const [projectTasks, sessions] = await Promise.all([
      db()
        .select({ id: tasks.id, title: tasks.title, status: tasks.status, completedAt: tasks.completedAt })
        .from(tasks)
        .where(eq(tasks.projectId, projectId)),
      db()
        .select({
          taskId: timeSessions.taskId,
          personId: users.id,
          personName: users.name,
          startedAt: timeSessions.startedAt,
          endedAt: timeSessions.endedAt,
          durationSeconds: timeSessions.durationSeconds,
        })
        .from(timeSessions)
        .innerJoin(tasks, eq(tasks.id, timeSessions.taskId))
        .innerJoin(users, eq(users.id, timeSessions.userId))
        .where(eq(tasks.projectId, projectId)),
    ]);

    const today = saoPauloKey();
    const weekStart = keyToDate(startOfWeekKey(today));
    const firstDay = shiftKey(today, -(DAYS - 1));
    const byTask = new Map<string, number>();
    const byPerson = new Map<string, { id: string; name: string; seconds: number; sessions: number }>();
    const byDay = new Map<string, number>();
    let total = 0;
    let weekSeconds = 0;

    for (const session of sessions) {
      const seconds = liveSeconds(session.startedAt, session.endedAt, session.durationSeconds);
      total += seconds;
      if (session.startedAt >= weekStart) weekSeconds += seconds;
      byTask.set(session.taskId, (byTask.get(session.taskId) ?? 0) + seconds);
      const person = byPerson.get(session.personId) ?? {
        id: session.personId,
        name: session.personName,
        seconds: 0,
        sessions: 0,
      };
      person.seconds += seconds;
      person.sessions += 1;
      byPerson.set(session.personId, person);
      const day = saoPauloKey(session.startedAt);
      if (day >= firstDay) byDay.set(day, (byDay.get(day) ?? 0) + seconds);
    }

    const thisWeek = startOfWeekKey(today);
    const weekly = new Map<string, number>();
    for (const task of projectTasks) {
      if (task.status !== "done" || !task.completedAt) continue;
      const week = startOfWeekKey(saoPauloKey(task.completedAt));
      weekly.set(week, (weekly.get(week) ?? 0) + 1);
    }

    const payload: SharedOverview = {
      totals: {
        seconds: total,
        weekSeconds,
        openCount: projectTasks.filter((task) => task.status !== "done").length,
        doneCount: projectTasks.filter((task) => task.status === "done").length,
        closedThisWeek: weekly.get(thisWeek) ?? 0,
      },
      byTask: projectTasks
        .map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status as TaskStatus,
          seconds: byTask.get(task.id) ?? 0,
        }))
        .filter((row) => row.seconds > 0)
        .sort((a, b) => b.seconds - a.seconds),
      byPerson: [...byPerson.values()].sort((a, b) => b.seconds - a.seconds),
      byDay: Array.from({ length: DAYS }, (_, index) => {
        const date = shiftKey(firstDay, index);
        return { date, seconds: byDay.get(date) ?? 0 };
      }),
      weeklyClosed: Array.from({ length: WEEKS }, (_, index) => {
        const week = shiftKey(thisWeek, -7 * (WEEKS - 1 - index));
        return { week, count: weekly.get(week) ?? 0 };
      }),
    };
    return jsonOk(payload);
  } catch (error) {
    return handleError(error);
  }
}
