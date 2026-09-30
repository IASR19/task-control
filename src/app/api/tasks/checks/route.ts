import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { taskChecks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { requireTaskAccess } from "@/lib/sharing";

// A checklist é da task: dono do quadro e membros do projeto veem e mexem nos mesmos itens.

function serialize(row: typeof taskChecks.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    done: row.done,
    sortOrder: row.sortOrder,
  };
}

async function findCheck(userId: string, id: string) {
  const [check] = await db().select().from(taskChecks).where(eq(taskChecks.id, id)).limit(1);
  if (!check) throw new HttpError(404, "Item não encontrado.");
  await requireTaskAccess(userId, check.taskId);
  return check;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const taskId = new URL(request.url).searchParams.get("taskId");
    if (!taskId) throw new HttpError(400, "Informe a tarefa.");
    await requireTaskAccess(user.id, taskId);
    const rows = await db()
      .select()
      .from(taskChecks)
      .where(eq(taskChecks.taskId, taskId))
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
    await requireTaskAccess(user.id, body.taskId);
    const existing = await db()
      .select({ id: taskChecks.id })
      .from(taskChecks)
      .where(eq(taskChecks.taskId, body.taskId));
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
    const current = await findCheck(user.id, body.id);
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
    const current = await findCheck(user.id, id);
    await db().delete(taskChecks).where(eq(taskChecks.id, current.id));
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
