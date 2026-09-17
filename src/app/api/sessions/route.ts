import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks, timeSessions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const rows = await db()
      .select({
        id: timeSessions.id,
        taskId: timeSessions.taskId,
        taskTitle: tasks.title,
        projectName: projects.name,
        startedAt: timeSessions.startedAt,
        endedAt: timeSessions.endedAt,
        durationSeconds: timeSessions.durationSeconds,
      })
      .from(timeSessions)
      .innerJoin(tasks, eq(tasks.id, timeSessions.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(eq(timeSessions.userId, user.id))
      .orderBy(desc(timeSessions.startedAt))
      .limit(80);

    return jsonOk({
      sessions: rows.map((row) => ({
        ...row,
        startedAt: row.startedAt.toISOString(),
        endedAt: row.endedAt ? row.endedAt.toISOString() : null,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}
