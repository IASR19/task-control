import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks, timeSessions, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { requireTaskAccess } from "@/lib/sharing";

function serializeSession(row: {
  id: string;
  taskId: string;
  taskTitle: string;
  projectName: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number;
  personId?: string;
  personName?: string;
}) {
  return {
    ...row,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const taskId = new URL(request.url).searchParams.get("taskId");
    // Numa task, as iterações de todo mundo que tem acesso; sem task, só as próprias.
    if (taskId) await requireTaskAccess(user.id, taskId);
    const rows = await db()
      .select({
        id: timeSessions.id,
        taskId: timeSessions.taskId,
        taskTitle: tasks.title,
        projectName: projects.name,
        startedAt: timeSessions.startedAt,
        endedAt: timeSessions.endedAt,
        durationSeconds: timeSessions.durationSeconds,
        personId: users.id,
        personName: users.name,
      })
      .from(timeSessions)
      .innerJoin(tasks, eq(tasks.id, timeSessions.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .innerJoin(users, eq(users.id, timeSessions.userId))
      .where(taskId ? eq(timeSessions.taskId, taskId) : eq(timeSessions.userId, user.id))
      .orderBy(desc(timeSessions.startedAt))
      .limit(taskId ? 200 : 80);

    return jsonOk({
      sessions: rows.map(serializeSession),
    });
  } catch (error) {
    return handleError(error);
  }
}

const createSchema = z.object({
  taskId: z.string().uuid(),
  durationSeconds: z.number().int().min(60, "Lança pelo menos 1 minuto.").max(24 * 3600, "No máximo 24 horas."),
  startedAt: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = createSchema.parse(await request.json());
    const { task } = await requireTaskAccess(user.id, body.taskId);
    const startedAt = body.startedAt ? new Date(body.startedAt) : new Date(Date.now() - body.durationSeconds * 1000);
    if (Number.isNaN(startedAt.getTime())) {
      throw new HttpError(400, "Data de início inválida.");
    }
    const endedAt = new Date(startedAt.getTime() + body.durationSeconds * 1000);
    if (endedAt.getTime() > Date.now() + 60_000) {
      throw new HttpError(400, "Não lança tempo no futuro.");
    }

    const inserted = (
      await db()
        .insert(timeSessions)
        .values({
          userId: user.id,
          taskId: body.taskId,
          startedAt,
          endedAt,
          durationSeconds: body.durationSeconds,
        })
        .returning()
    )[0];
    await db().update(tasks).set({ updatedAt: new Date() }).where(eq(tasks.id, body.taskId));

    const project = (
      await db().select({ name: projects.name }).from(projects).where(eq(projects.id, task.projectId)).limit(1)
    )[0];

    return jsonOk(
      {
        session: serializeSession({
          id: inserted.id,
          taskId: inserted.taskId,
          taskTitle: task.title,
          projectName: project?.name ?? "",
          startedAt: inserted.startedAt,
          endedAt: inserted.endedAt,
          durationSeconds: inserted.durationSeconds,
          personId: user.id,
          personName: user.name,
        }),
      },
      201,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, error.issues[0]?.message ?? "Pedido de tempo inválido."));
    }
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new HttpError(400, "Informe a iteração.");
    const [current] = await db().select().from(timeSessions).where(eq(timeSessions.id, id)).limit(1);
    if (!current) throw new HttpError(404, "Iteração não encontrada.");
    const { isBoardOwner } = await requireTaskAccess(user.id, current.taskId);
    if (current.userId !== user.id && !isBoardOwner) {
      throw new HttpError(403, "Só quem rodou (ou o dono do projeto) apaga a iteração.");
    }
    if (!current.endedAt) throw new HttpError(400, "Encerra o timer antes de apagar.");
    await db().delete(timeSessions).where(eq(timeSessions.id, current.id));
    await db().update(tasks).set({ updatedAt: new Date() }).where(eq(tasks.id, current.taskId));
    return jsonOk({
      ok: true,
      taskId: current.taskId,
      durationSeconds: current.durationSeconds,
    });
  } catch (error) {
    return handleError(error);
  }
}
