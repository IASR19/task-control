import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { taskComments, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { requireTaskAccess } from "@/lib/sharing";

// Comentários são da task (todo mundo do projeto lê); apagar só o autor ou o dono do quadro.

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const taskId = new URL(request.url).searchParams.get("taskId");
    if (!taskId) throw new HttpError(400, "Informe a tarefa.");
    await requireTaskAccess(user.id, taskId);
    const rows = await db()
      .select({
        id: taskComments.id,
        body: taskComments.body,
        createdAt: taskComments.createdAt,
        authorId: taskComments.userId,
        authorName: users.name,
      })
      .from(taskComments)
      .innerJoin(users, eq(users.id, taskComments.userId))
      .where(eq(taskComments.taskId, taskId))
      .orderBy(desc(taskComments.createdAt));
    return jsonOk({
      comments: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
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
    await requireTaskAccess(user.id, body.taskId);
    const [inserted] = await db()
      .insert(taskComments)
      .values({ userId: user.id, taskId: body.taskId, body: body.body })
      .returning();
    return jsonOk(
      {
        comment: {
          id: inserted.id,
          body: inserted.body,
          createdAt: inserted.createdAt.toISOString(),
          authorId: user.id,
          authorName: user.name,
        },
      },
      201,
    );
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
    const [comment] = await db().select().from(taskComments).where(eq(taskComments.id, id)).limit(1);
    if (!comment) throw new HttpError(404, "Comentário não encontrado.");
    const { isBoardOwner } = await requireTaskAccess(user.id, comment.taskId);
    if (comment.userId !== user.id && !isBoardOwner) {
      throw new HttpError(403, "Só quem escreveu (ou o dono do projeto) apaga o comentário.");
    }
    await db().delete(taskComments).where(eq(taskComments.id, comment.id));
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
