import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks, timeSessions } from "@/db/schema";

// Várias pessoas podem rodar a mesma task (projeto compartilhado):
// ela só volta para "aberta" quando ninguém mais está com o timer ligado nela.
export async function releaseTaskIfIdle(taskId: string, at: Date) {
  const [running] = await db()
    .select({ id: timeSessions.id })
    .from(timeSessions)
    .where(and(eq(timeSessions.taskId, taskId), isNull(timeSessions.endedAt)))
    .limit(1);
  if (running) return;
  await db()
    .update(tasks)
    .set({ status: "open", updatedAt: at })
    .where(and(eq(tasks.id, taskId), eq(tasks.status, "in_progress")));
}

// Concluir a task encerra o timer de todo mundo que ainda estava rodando nela.
export async function closeOpenSessions(taskId: string) {
  await db()
    .update(timeSessions)
    .set({
      endedAt: sql`now()`,
      durationSeconds: sql`greatest(1, round(extract(epoch from (now() - ${timeSessions.startedAt}))))::int`,
    })
    .where(and(eq(timeSessions.taskId, taskId), isNull(timeSessions.endedAt)));
}
