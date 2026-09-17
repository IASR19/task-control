import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { parsePriority } from "@/lib/priority";
import { getProjectForUser } from "@/lib/queries";

const schema = z.object({
  movedId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1),
  priority: z.number().int().min(0).max(3).optional(),
  projectId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = schema.parse(await request.json());
    if (!body.orderedIds.includes(body.movedId)) {
      throw new HttpError(400, "A task movida precisa estar na ordem.");
    }

    const database = db();
    const owned = await database
      .select({
        id: tasks.id,
        priority: tasks.priority,
        status: tasks.status,
        previousPriority: tasks.previousPriority,
      })
      .from(tasks)
      .where(and(eq(tasks.userId, user.id), inArray(tasks.id, body.orderedIds)));
    if (owned.length !== body.orderedIds.length) {
      throw new HttpError(400, "Há tarefa fora do seu quadro.");
    }

    const moved = owned.find((row) => row.id === body.movedId);
    if (!moved) throw new HttpError(404, "Tarefa não encontrada.");
    if (body.projectId) await getProjectForUser(user.id, body.projectId);

    const nextPriority =
      body.priority === undefined ? moved.priority : parsePriority(body.priority);
    const remanejada =
      body.priority !== undefined && body.priority !== moved.priority
        ? {
            previousPriority: moved.priority,
            status: moved.status === "in_progress" ? "in_progress" : ("remanejada" as const),
          }
        : {};

    await Promise.all(
      body.orderedIds.map((id, index) =>
        database
          .update(tasks)
          .set({
            sortOrder: index,
            updatedAt: new Date(),
            ...(id === body.movedId
              ? {
                  priority: nextPriority,
                  ...(body.projectId ? { projectId: body.projectId } : {}),
                  previousPriority: remanejada.previousPriority ?? moved.previousPriority,
                  status: remanejada.status ?? moved.status,
                }
              : {}),
          })
          .where(and(eq(tasks.id, id), eq(tasks.userId, user.id))),
      ),
    );

    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, "Pedido de ordem inválido."));
    }
    return handleError(error);
  }
}
