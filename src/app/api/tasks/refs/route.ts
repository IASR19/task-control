import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { taskRefs } from "@/db/schema";
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
      .from(taskRefs)
      .where(and(eq(taskRefs.taskId, taskId), eq(taskRefs.userId, user.id)))
      .orderBy(desc(taskRefs.createdAt));
    return jsonOk({
      refs: rows.map((row) => ({
        id: row.id,
        label: row.label,
        url: row.url,
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
    const raw = z
      .object({
        taskId: z.string().uuid(),
        url: z.string().trim().min(4),
        label: z.string().trim().optional().default(""),
      })
      .parse(await request.json());
    const url = /^https?:\/\//i.test(raw.url) ? raw.url : `https://${raw.url}`;
    try {
      new URL(url);
    } catch {
      throw new HttpError(400, "URL inválida.");
    }
    await getTaskForUser(user.id, raw.taskId);
    const inserted = await db()
      .insert(taskRefs)
      .values({
        userId: user.id,
        taskId: raw.taskId,
        url,
        label: raw.label || url.replace(/^https?:\/\//, "").slice(0, 48),
      })
      .returning();
    return jsonOk({ ref: { ...inserted[0], createdAt: inserted[0].createdAt.toISOString() } }, 201);
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
    if (!id) throw new HttpError(400, "Informe a referência.");
    const deleted = await db()
      .delete(taskRefs)
      .where(and(eq(taskRefs.id, id), eq(taskRefs.userId, user.id)))
      .returning();
    if (!deleted[0]) throw new HttpError(404, "Referência não encontrada.");
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
