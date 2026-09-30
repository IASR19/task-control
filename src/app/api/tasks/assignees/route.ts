import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { taskAssigneesJson, taskOwnerId } from "@/lib/queries";
import { requireProjectAccess, setTaskAssignee } from "@/lib/sharing";
import type { Person } from "@/lib/types";

// Uma pessoa por vez: { on: true } adiciona, { on: false } remove.
const schema = z.object({
  taskId: z.string().uuid(),
  userId: z.string().uuid(),
  on: z.boolean(),
});

// Quem mexe nos responsáveis: o dono do quadro ou o owner (criador) da task.
export async function PUT(request: Request) {
  try {
    const user = await requireUser(request);
    const body = schema.parse(await request.json());
    const [task] = await db()
      .select({ projectId: tasks.projectId, boardOwnerId: tasks.userId, ownerId: sql<string>`${taskOwnerId}` })
      .from(tasks)
      .where(eq(tasks.id, body.taskId))
      .limit(1);
    if (!task) throw new HttpError(404, "Tarefa não encontrada.");
    await requireProjectAccess(user.id, task.projectId);
    if (user.id !== task.boardOwnerId && user.id !== task.ownerId) {
      throw new HttpError(403, "Só quem criou a task ou o dono do projeto define responsáveis.");
    }
    if (!body.on && body.userId === task.ownerId) {
      throw new HttpError(400, "Quem criou a task é sempre responsável.");
    }
    await setTaskAssignee(task.projectId, body.taskId, body.userId, body.on);
    const [row] = await db()
      .select({ assignees: taskAssigneesJson })
      .from(tasks)
      .where(eq(tasks.id, body.taskId));
    return jsonOk({ assignees: (row?.assignees ?? []) as Person[] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, "Responsável inválido."));
    }
    return handleError(error);
  }
}
