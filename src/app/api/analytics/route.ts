import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks, timeSessions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { keyToDate, saoPauloKey, shiftKey, startOfToday, startOfWeek, startOfWeekKey } from "@/lib/dates";
import { handleError, jsonOk } from "@/lib/http";
import type { Effort, Priority } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const database = db();
    const weekStart = startOfWeek();
    const todayStart = startOfToday();
    const todayKey = saoPauloKey();
    const heatStartKey = shiftKey(startOfWeekKey(), -77);
    const heatStart = keyToDate(heatStartKey);
    const fourteenKey = shiftKey(todayKey, -13);
    const fourteen = keyToDate(fourteenKey);
    const weekTs = weekStart.toISOString();
    const todayTs = todayStart.toISOString();

    const [counts] = await database
      .select({
        openCount: sql<number>`coalesce(count(*) filter (where ${tasks.status} in ('open', 'in_progress')), 0)::int`,
        doneCount: sql<number>`coalesce(count(*) filter (where ${tasks.status} = 'done'), 0)::int`,
        remanejadaCount: sql<number>`coalesce(count(*) filter (where ${tasks.status} = 'remanejada'), 0)::int`,
        openedThisWeek: sql<number>`coalesce(count(*) filter (where ${tasks.createdAt} >= ${weekTs}::timestamptz), 0)::int`,
        closedToday: sql<number>`coalesce(count(*) filter (where ${tasks.status} = 'done' and ${tasks.completedAt} >= ${todayTs}::timestamptz), 0)::int`,
        closedThisWeek: sql<number>`coalesce(count(*) filter (where ${tasks.status} = 'done' and ${tasks.completedAt} >= ${weekTs}::timestamptz), 0)::int`,
        avgLeadSeconds: sql<number>`coalesce(avg(extract(epoch from (${tasks.completedAt} - ${tasks.createdAt}))) filter (where ${tasks.status} = 'done' and ${tasks.completedAt} is not null), 0)::int`,
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
      .groupBy(sql`to_char(${timeSessions.startedAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`);

    const closedDayRows = await database
      .select({
        date: sql<string>`to_char(${tasks.completedAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(tasks)
      .where(
        and(eq(tasks.userId, user.id), eq(tasks.status, "done"), gte(tasks.completedAt, heatStart)),
      )
      .groupBy(sql`to_char(${tasks.completedAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`);

    const closedMap = new Map(closedDayRows.map((row) => [row.date, row.count]));

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

    const doneByProject = await database
      .select({
        name: projects.name,
        count: sql<number>`count(*)::int`,
      })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(and(eq(tasks.userId, user.id), eq(tasks.status, "done"), gte(tasks.completedAt, weekStart)))
      .groupBy(projects.name)
      .orderBy(sql`count(*) desc`);

    const doneByEffortRows = await database
      .select({
        effort: tasks.effort,
        count: sql<number>`count(*)::int`,
      })
      .from(tasks)
      .where(and(eq(tasks.userId, user.id), eq(tasks.status, "done")))
      .groupBy(tasks.effort);

    const doneByPriorityRows = await database
      .select({
        priority: tasks.priority,
        count: sql<number>`count(*)::int`,
      })
      .from(tasks)
      .where(and(eq(tasks.userId, user.id), eq(tasks.status, "done")))
      .groupBy(tasks.priority);

    const byDay = [];
    for (let i = 0; i < 14; i += 1) {
      const key = shiftKey(fourteenKey, i);
      const found = dayRows.find((row) => row.date === key);
      byDay.push({ date: key, seconds: found?.seconds ?? 0, closed: closedMap.get(key) ?? 0 });
    }

    const heatmap = [];
    for (let i = 0; i < 84; i += 1) {
      const key = shiftKey(heatStartKey, i);
      heatmap.push({ date: key, count: closedMap.get(key) ?? 0 });
    }

    const weeklyClosed = [];
    for (let i = 7; i >= 0; i -= 1) {
      const weekKey = startOfWeekKey(shiftKey(todayKey, -i * 7));
      let count = 0;
      for (let d = 0; d < 7; d += 1) {
        count += closedMap.get(shiftKey(weekKey, d)) ?? 0;
      }
      weeklyClosed.push({ week: weekKey, count });
    }

    let streak = 0;
    let cursor = closedMap.get(todayKey) ? todayKey : shiftKey(todayKey, -1);
    while ((closedMap.get(cursor) ?? 0) > 0) {
      streak += 1;
      cursor = shiftKey(cursor, -1);
    }

    const doneByEffort = [0, 1, 2, 3, 4, 5].map((effort) => ({
      effort: effort as Effort,
      count: doneByEffortRows.find((row) => row.effort === effort)?.count ?? 0,
    }));
    const doneByPriority = [0, 1, 2, 3].map((priority) => ({
      priority: priority as Priority,
      count: doneByPriorityRows.find((row) => row.priority === priority)?.count ?? 0,
    }));

    return jsonOk({
      weekSeconds: week?.seconds ?? 0,
      todaySeconds: today?.seconds ?? 0,
      openCount: counts?.openCount ?? 0,
      doneCount: counts?.doneCount ?? 0,
      remanejadaCount: counts?.remanejadaCount ?? 0,
      openedThisWeek: counts?.openedThisWeek ?? 0,
      closedToday: counts?.closedToday ?? 0,
      closedThisWeek: counts?.closedThisWeek ?? 0,
      streak,
      avgLeadSeconds: counts?.avgLeadSeconds ?? 0,
      byProject,
      byDay,
      topTasks,
      heatmap,
      weeklyClosed,
      doneByProject,
      doneByEffort,
      doneByPriority,
    });
  } catch (error) {
    return handleError(error);
  }
}
