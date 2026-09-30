import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { normalizeKey, parsePriority } from "@/lib/priority";
import { parseEffort } from "@/lib/effort";
import { getProjectForUser, listTasks } from "@/lib/queries";
import { pruneAssignees, replaceAssignees, resolveAssignees } from "@/lib/sharing";
import { imageDataSchema, insertTaskImages, MAX_TASK_IMAGES } from "@/lib/task-images";

const stampSchema = z.iso.datetime({ offset: true }).nullable().optional();

function toDate(value: string | null | undefined, fallback: Date | null) {
  if (value === undefined) return fallback;
  return value === null ? null : new Date(value);
}

const createSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1, "Escreva a tarefa."),
  notes: z.string().optional().default(""),
  priority: z.number().int().min(0).max(3).optional(),
  effort: z.number().int().min(0).max(5).optional(),
  startAt: stampSchema,
  endAt: stampSchema,
  deadlineAt: stampSchema,
  images: z.array(imageDataSchema).max(MAX_TASK_IMAGES, "Imagens demais.").optional().default([]),
  assigneeIds: z.array(z.string().uuid()).max(30).optional().default([]),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  title: z.string().trim().min(1).optional(),
  notes: z.string().optional(),
  priority: z.number().int().min(0).max(3).optional(),
  effort: z.number().int().min(0).max(5).optional(),
  startAt: stampSchema,
  endAt: stampSchema,
  deadlineAt: stampSchema,
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
    const assigneeIds = await resolveAssignees(body.projectId, user.id, body.assigneeIds);
    const priority = parsePriority(body.priority ?? 3);
    const [peak] = await db()
      .select({ max: sql<number>`coalesce(max(${tasks.sortOrder}), -1)` })
      .from(tasks)
      .where(and(eq(tasks.userId, user.id), eq(tasks.priority, priority)));
    const created = await db().transaction(async (tx) => {
      const [row] = await tx
        .insert(tasks)
        .values({
          userId: user.id,
          projectId: body.projectId,
          createdBy: user.id,
          title: body.title,
          notes: body.notes ?? "",
          priority,
          effort: parseEffort(body.effort ?? 0),
          startAt: toDate(body.startAt, null),
          endAt: toDate(body.endAt, null),
          deadlineAt: toDate(body.deadlineAt, null),
          status: "open",
          source: "manual",
          sortOrder: Number(peak?.max ?? -1) + 1,
          boardKey: normalizeKey(body.title),
        })
        .returning();
      await insertTaskImages(tx, user.id, row.id, body.images);
      await replaceAssignees(tx, row.id, assigneeIds);
      return row;
    });
    return jsonOk({ task: created }, 201);
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
        startAt: toDate(body.startAt, current.startAt),
        endAt: toDate(body.endAt, current.endAt),
        deadlineAt: toDate(body.deadlineAt, current.deadlineAt),
        previousPriority: remanejada.previousPriority ?? current.previousPriority,
        status,
        boardKey: normalizeKey(body.title ?? current.title),
        completedAt: status === "done" ? current.completedAt ?? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, current.id))
      .returning();
    if (updated[0].projectId !== current.projectId) await pruneAssignees({ taskId: current.id });

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
