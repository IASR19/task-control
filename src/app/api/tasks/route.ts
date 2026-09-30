import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { normalizeKey, parsePriority } from "@/lib/priority";
import { parseEffort } from "@/lib/effort";
import { getProjectForUser, listTasks, taskOwnerId } from "@/lib/queries";
import {
  pruneAssignees,
  replaceAssignees,
  requireProjectAccess,
  requireTaskAccess,
  resolveAssignees,
} from "@/lib/sharing";
import { imageDataSchema, insertTaskImages, MAX_TASK_IMAGES } from "@/lib/task-images";
import { closeOpenSessions } from "@/lib/timer";

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
    const { task: current, isBoardOwner } = await requireTaskAccess(user.id, body.id);

    // Membro do projeto compartilhado executa, mas não reorganiza: só conclui ou reabre.
    if (!isBoardOwner) {
      const touchesOther = Object.entries(body).some(
        ([key, value]) => key !== "id" && key !== "status" && value !== undefined,
      );
      if (touchesOther || (body.status !== "done" && body.status !== "open")) {
        throw new HttpError(403, "No projeto compartilhado você só conclui ou reabre a task.");
      }
      const done = body.status === "done";
      if (done) await closeOpenSessions(current.id);
      const [updated] = await db()
        .update(tasks)
        .set({
          status: body.status,
          completedAt: done ? current.completedAt ?? new Date() : null,
          completedBy: done ? current.completedBy ?? user.id : null,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, current.id))
        .returning();
      return jsonOk({ task: updated });
    }

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
    if (status === "done" && current.status !== "done") await closeOpenSessions(current.id);

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
        completedBy: status === "done" ? current.completedBy ?? user.id : null,
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
    const [task] = await db()
      .select({ projectId: tasks.projectId, ownerId: sql<string>`${taskOwnerId}` })
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);
    if (!task) throw new HttpError(404, "Tarefa não encontrada.");
    // Só quem criou apaga, inclusive o convidado (que precisa manter acesso ao projeto).
    await requireProjectAccess(user.id, task.projectId);
    if (task.ownerId !== user.id) throw new HttpError(403, "Só quem criou a task pode apagar.");
    await db().delete(tasks).where(eq(tasks.id, id));
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
