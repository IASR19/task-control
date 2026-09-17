import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks, timeSessions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, jsonOk } from "@/lib/http";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek() {
  const date = startOfToday();
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  return date;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const database = db();
    const weekStart = startOfWeek();
    const todayStart = startOfToday();
    const fourteen = new Date(todayStart);
    fourteen.setDate(fourteen.getDate() - 13);

    const [counts] = await database
      .select({
        openCount: sql<number>`coalesce(count(*) filter (where ${tasks.status} in ('open', 'in_progress')), 0)::int`,
        doneCount: sql<number>`coalesce(count(*) filter (where ${tasks.status} = 'done'), 0)::int`,
        remanejadaCount: sql<number>`coalesce(count(*) filter (where ${tasks.status} = 'remanejada'), 0)::int`,
      })
      .from(tasks)
      .where(eq(tasks.userId, user.id));

    const [week] = await database
      .select({
        seconds: sql<number>`coalesce(sum(${timeSessions.durationSeconds}), 0)::int`,
      })
      .from(timeSessions)
      .where(and(eq(timeSessions.userId, user.id), gte(timeSessions.startedAt, weekStart)));

    const [today] = await database
      .select({
        seconds: sql<number>`coalesce(sum(${timeSessions.durationSeconds}), 0)::int`,
      })
      .from(timeSessions)
      .where(and(eq(timeSessions.userId, user.id), gte(timeSessions.startedAt, todayStart)));

    const byProject = await database
      .select({
        name: projects.name,
        seconds: sql<number>`coalesce(sum(${timeSessions.durationSeconds}), 0)::int`,
        tasks: sql<number>`count(distinct ${timeSessions.taskId})::int`,
      })
      .from(timeSessions)
      .innerJoin(tasks, eq(tasks.id, timeSessions.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(and(eq(timeSessions.userId, user.id), gte(timeSessions.startedAt, weekStart)))
      .groupBy(projects.name)
      .orderBy(sql`sum(${timeSessions.durationSeconds}) desc`);

    const dayRows = await database
      .select({
        date: sql<string>`to_char(${timeSessions.startedAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
        seconds: sql<number>`coalesce(sum(${timeSessions.durationSeconds}), 0)::int`,
      })
      .from(timeSessions)
      .where(and(eq(timeSessions.userId, user.id), gte(timeSessions.startedAt, fourteen)))
      .groupBy(sql`to_char(${timeSessions.startedAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${timeSessions.startedAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`);

    const topTasks = await database
      .select({
        id: tasks.id,
        title: tasks.title,
        projectName: projects.name,
        seconds: sql<number>`coalesce(sum(${timeSessions.durationSeconds}), 0)::int`,
      })
      .from(timeSessions)
      .innerJoin(tasks, eq(tasks.id, timeSessions.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(eq(timeSessions.userId, user.id))
      .groupBy(tasks.id, tasks.title, projects.name)
      .orderBy(sql`sum(${timeSessions.durationSeconds}) desc`)
      .limit(8);

    const byDay = [];
    for (let i = 0; i < 14; i += 1) {
      const cursor = new Date(fourteen);
      cursor.setDate(fourteen.getDate() + i);
      const key = cursor.toISOString().slice(0, 10);
      const found = dayRows.find((row) => row.date === key);
      byDay.push({ date: key, seconds: found?.seconds ?? 0 });
    }

    return jsonOk({
      weekSeconds: week?.seconds ?? 0,
      todaySeconds: today?.seconds ?? 0,
      openCount: counts?.openCount ?? 0,
      doneCount: counts?.doneCount ?? 0,
      remanejadaCount: counts?.remanejadaCount ?? 0,
      byProject,
      byDay,
      topTasks,
    });
  } catch (error) {
    return handleError(error);
  }
}
