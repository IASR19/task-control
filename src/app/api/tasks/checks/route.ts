import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { taskChecks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { getTaskForUser } from "@/lib/queries";

function serialize(row: typeof taskChecks.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    done: row.done,
    sortOrder: row.sortOrder,
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const taskId = new URL(request.url).searchParams.get("taskId");
    if (!taskId) throw new HttpError(400, "Informe a tarefa.");
    await getTaskForUser(user.id, taskId);
    const rows = await db()
      .select()
      .from(taskChecks)
      .where(and(eq(taskChecks.taskId, taskId), eq(taskChecks.userId, user.id)))
      .orderBy(asc(taskChecks.sortOrder), asc(taskChecks.createdAt));
    return jsonOk({ checks: rows.map(serialize) });
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
        title: z.string().trim().min(1, "Escreve o item."),
      })
      .parse(await request.json());
    await getTaskForUser(user.id, body.taskId);
    const existing = await db()
      .select({ id: taskChecks.id })
      .from(taskChecks)
      .where(and(eq(taskChecks.taskId, body.taskId), eq(taskChecks.userId, user.id)));
    const inserted = await db()
      .insert(taskChecks)
      .values({
        userId: user.id,
        taskId: body.taskId,
        title: body.title,
        sortOrder: existing.length,
      })
      .returning();
    return jsonOk({ check: serialize(inserted[0]) }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, error.issues[0]?.message ?? "Dados inválidos."));
    }
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request);
    const body = z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).optional(),
        done: z.boolean().optional(),
      })
      .parse(await request.json());
    const current = (
      await db()
        .select()
        .from(taskChecks)
        .where(and(eq(taskChecks.id, body.id), eq(taskChecks.userId, user.id)))
        .limit(1)
    )[0];
    if (!current) throw new HttpError(404, "Item não encontrado.");
    const updated = await db()
      .update(taskChecks)
      .set({
        title: body.title ?? current.title,
        done: body.done ?? current.done,
      })
      .where(eq(taskChecks.id, current.id))
      .returning();
    return jsonOk({ check: serialize(updated[0]) });
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
    if (!id) throw new HttpError(400, "Informe o item.");
    const deleted = await db()
      .delete(taskChecks)
      .where(and(eq(taskChecks.id, id), eq(taskChecks.userId, user.id)))
      .returning();
    if (!deleted[0]) throw new HttpError(404, "Item não encontrado.");
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
