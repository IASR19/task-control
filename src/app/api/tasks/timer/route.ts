import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { tasks, timeSessions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { getTaskForUser } from "@/lib/queries";

const schema = z.object({
  taskId: z.string().uuid(),
  action: z.enum(["start", "stop"]),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = schema.parse(await request.json());
    await getTaskForUser(user.id, body.taskId);
    const database = db();

    const openRows = await database
      .select()
      .from(timeSessions)
      .where(and(eq(timeSessions.userId, user.id), isNull(timeSessions.endedAt)))
      .limit(1);
    const open = openRows[0];

    if (body.action === "start") {
      if (open?.taskId === body.taskId) {
        return jsonOk({
          session: {
            id: open.id,
            taskId: open.taskId,
            startedAt: open.startedAt.toISOString(),
            durationSeconds: 0,
          },
        });
      }
      let closed: { taskId: string; durationSeconds: number } | undefined;
      if (open) {
        const endedAt = new Date();
        const duration = Math.max(
          1,
          Math.round((endedAt.getTime() - open.startedAt.getTime()) / 1000),
        );
        await database
          .update(timeSessions)
          .set({ endedAt, durationSeconds: duration })
          .where(eq(timeSessions.id, open.id));
        closed = { taskId: open.taskId, durationSeconds: duration };
        if (open.taskId !== body.taskId) {
          await database
            .update(tasks)
            .set({ status: "open", updatedAt: endedAt })
            .where(and(eq(tasks.id, open.taskId), eq(tasks.status, "in_progress")));
        }
      }

      const started = await database
        .insert(timeSessions)
        .values({ userId: user.id, taskId: body.taskId })
        .returning();
      await database
        .update(tasks)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(eq(tasks.id, body.taskId));
      return jsonOk({
        session: {
          id: started[0].id,
          taskId: started[0].taskId,
          startedAt: started[0].startedAt.toISOString(),
          durationSeconds: 0,
        },
        closed,
      });
    }

    if (!open || open.taskId !== body.taskId) {
      return jsonOk({ session: null });
    }
    const endedAt = new Date();
    const duration = Math.max(
      1,
      Math.round((endedAt.getTime() - open.startedAt.getTime()) / 1000),
    );
    const stopped = await database
      .update(timeSessions)
      .set({ endedAt, durationSeconds: duration })
      .where(eq(timeSessions.id, open.id))
      .returning();
    await database
      .update(tasks)
      .set({ status: "open", updatedAt: endedAt })
      .where(eq(tasks.id, body.taskId));
    return jsonOk({
      session: {
        id: stopped[0].id,
        taskId: stopped[0].taskId,
        startedAt: stopped[0].startedAt.toISOString(),
        endedAt: stopped[0].endedAt ? stopped[0].endedAt.toISOString() : endedAt.toISOString(),
        durationSeconds: duration,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, "Pedido de timer inválido."));
    }
    return handleError(error);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const active = (
      await db()
        .select()
        .from(timeSessions)
        .where(and(eq(timeSessions.userId, user.id), isNull(timeSessions.endedAt)))
        .orderBy(desc(timeSessions.startedAt))
        .limit(1)
    )[0];

    if (!active) return jsonOk({ session: null });

    const task = (
      await db().select().from(tasks).where(eq(tasks.id, active.taskId)).limit(1)
    )[0];

    return jsonOk({
      session: {
        id: active.id,
        taskId: active.taskId,
        startedAt: active.startedAt.toISOString(),
        taskTitle: task?.title ?? "Tarefa",
        elapsedSeconds: Math.max(
          0,
          Math.round((Date.now() - active.startedAt.getTime()) / 1000),
        ),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
