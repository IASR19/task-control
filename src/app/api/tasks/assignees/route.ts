import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { taskAssignees, tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { taskAssigneesJson, taskOwnerId } from "@/lib/queries";
import { replaceAssignees, requireProjectAccess, resolveAssignees } from "@/lib/sharing";
import type { Person } from "@/lib/types";

const schema = z.object({
  taskId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).max(30),
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
    const current = await db()
      .select({ userId: taskAssignees.userId })
      .from(taskAssignees)
      .where(eq(taskAssignees.taskId, body.taskId));
    const userIds = await resolveAssignees(
      task.projectId,
      task.ownerId,
      body.userIds,
      current.map((row) => row.userId),
    );
    await db().transaction((tx) => replaceAssignees(tx, body.taskId, userIds));
    const [row] = await db()
      .select({ assignees: taskAssigneesJson })
      .from(tasks)
      .where(eq(tasks.id, body.taskId));
    return jsonOk({ assignees: (row?.assignees ?? []) as Person[] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, "Responsáveis inválidos."));
    }
    return handleError(error);
  }
}
