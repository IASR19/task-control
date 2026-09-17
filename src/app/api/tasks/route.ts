import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { normalizeKey, parsePriority } from "@/lib/priority";
import { parseEffort } from "@/lib/effort";
import { getProjectForUser, listTasks } from "@/lib/queries";

const createSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1, "Escreva a tarefa."),
  notes: z.string().optional().default(""),
  priority: z.number().int().min(0).max(3).optional(),
  effort: z.number().int().min(0).max(5).optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  title: z.string().trim().min(1).optional(),
  notes: z.string().optional(),
  priority: z.number().int().min(0).max(3).optional(),
  effort: z.number().int().min(0).max(5).optional(),
  status: z.enum(["open", "in_progress", "done", "remanejada"]).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const params = new URL(request.url).searchParams;
    const status = params.get("status");
    const taskId = params.get("id") ?? undefined;
    const parsed =
      status === "open" || status === "in_progress" || status === "done" || status === "remanejada"
        ? status
        : undefined;
    return jsonOk({ tasks: await listTasks(user.id, parsed, taskId) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = createSchema.parse(await request.json());
    await getProjectForUser(user.id, body.projectId);
    const priority = parsePriority(body.priority ?? 3);
    const [peak] = await db()
      .select({ max: sql<number>`coalesce(max(${tasks.sortOrder}), -1)` })
      .from(tasks)
      .where(and(eq(tasks.userId, user.id), eq(tasks.priority, priority)));
    const inserted = await db()
      .insert(tasks)
      .values({
        userId: user.id,
        projectId: body.projectId,
        title: body.title,
        notes: body.notes ?? "",
        priority,
        effort: parseEffort(body.effort ?? 0),
        status: "open",
        source: "manual",
        sortOrder: Number(peak?.max ?? -1) + 1,
        boardKey: normalizeKey(body.title),
      })
      .returning();
    return jsonOk({ task: inserted[0] }, 201);
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
    const body = updateSchema.parse(await request.json());
    const current = (
      await db()
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, body.id), eq(tasks.userId, user.id)))
        .limit(1)
    )[0];
    if (!current) throw new HttpError(404, "Tarefa não encontrada.");
    if (body.projectId) await getProjectForUser(user.id, body.projectId);

    const nextPriority =
      body.priority === undefined ? current.priority : parsePriority(body.priority);
    const remanejada =
      body.priority !== undefined && body.priority !== current.priority
        ? {
            previousPriority: current.priority,
            status: "remanejada" as const,
          }
        : {};

    const status = body.status ?? remanejada.status ?? current.status;

    const updated = await db()
      .update(tasks)
      .set({
        projectId: body.projectId ?? current.projectId,
        title: body.title ?? current.title,
        notes: body.notes ?? current.notes,
        priority: nextPriority,
        effort: body.effort === undefined ? current.effort : parseEffort(body.effort),
        previousPriority: remanejada.previousPriority ?? current.previousPriority,
        status,
        boardKey: normalizeKey(body.title ?? current.title),
        completedAt: status === "done" ? current.completedAt ?? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, current.id))
      .returning();

    return jsonOk({ task: updated[0] });
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) throw new HttpError(400, "Informe a tarefa.");
    const deleted = await db()
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
      .returning();
    if (!deleted[0]) throw new HttpError(404, "Tarefa não encontrada.");
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
