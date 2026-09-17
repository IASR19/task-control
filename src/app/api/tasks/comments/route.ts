import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { taskComments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { getTaskForUser } from "@/lib/queries";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const taskId = new URL(request.url).searchParams.get("taskId");
    if (!taskId) throw new HttpError(400, "Informe a tarefa.");
    await getTaskForUser(user.id, taskId);
    const rows = await db()
      .select()
      .from(taskComments)
      .where(and(eq(taskComments.taskId, taskId), eq(taskComments.userId, user.id)))
      .orderBy(desc(taskComments.createdAt));
    return jsonOk({
      comments: rows.map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = z
      .object({
        taskId: z.string().uuid(),
        body: z.string().trim().min(1, "Escreve o comentário."),
      })
      .parse(await request.json());
    await getTaskForUser(user.id, body.taskId);
    const inserted = await db()
      .insert(taskComments)
      .values({ userId: user.id, taskId: body.taskId, body: body.body })
      .returning();
    return jsonOk({ comment: { ...inserted[0], createdAt: inserted[0].createdAt.toISOString() } }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, error.issues[0]?.message ?? "Dados inválidos."));
    }
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new HttpError(400, "Informe o comentário.");
    const deleted = await db()
      .delete(taskComments)
      .where(and(eq(taskComments.id, id), eq(taskComments.userId, user.id)))
      .returning();
    if (!deleted[0]) throw new HttpError(404, "Comentário não encontrado.");
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
