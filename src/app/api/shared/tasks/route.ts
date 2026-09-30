import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { taskImages, tasks, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { normalizeKey } from "@/lib/priority";
import { taskAssigneesJson, taskOwnerId } from "@/lib/queries";
import { replaceAssignees, requireMembership, resolveAssignees } from "@/lib/sharing";
import { imageDataSchema, insertTaskImages, MAX_TASK_IMAGES } from "@/lib/task-images";
import type { GuestTask, TaskStatus } from "@/lib/types";

const GUEST_PRIORITY = 3;
const owners = alias(users, "owners");

const createSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1, "Escreva a tarefa."),
  notes: z.string().optional().default(""),
  deadlineAt: z.iso.datetime({ offset: true }).nullable().optional(),
  images: z.array(imageDataSchema).max(MAX_TASK_IMAGES, "Imagens demais.").optional().default([]),
  assigneeIds: z.array(z.string().uuid()).max(30).optional().default([]),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) throw new HttpError(400, "Informe o projeto.");
    const workspace = await requireMembership(user.id, projectId);
    const rows = await db()
      .select({
        id: tasks.id,
        title: tasks.title,
        notes: tasks.notes,
        status: tasks.status,
        ownerId: owners.id,
        ownerName: owners.name,
        assignees: taskAssigneesJson,
        deadlineAt: tasks.deadlineAt,
        createdAt: tasks.createdAt,
        completedAt: tasks.completedAt,
        imageCount: sql<number>`(select count(*) from ${taskImages} where ${taskImages.taskId} = ${tasks.id})::int`,
      })
      .from(tasks)
      .innerJoin(owners, sql`${owners.id} = ${taskOwnerId}`)
      .where(eq(tasks.projectId, projectId))
      .orderBy(desc(tasks.createdAt));
    return jsonOk({
      workspace: {
        projectId: workspace.projectId,
        projectName: workspace.projectName,
        ownerName: workspace.ownerName,
      },
      tasks: rows.map(
        (row): GuestTask => ({
          ...row,
          status: row.status as TaskStatus,
          assignees: row.assignees ?? [],
          imageCount: Number(row.imageCount) || 0,
          deadlineAt: row.deadlineAt ? row.deadlineAt.toISOString() : null,
          createdAt: row.createdAt.toISOString(),
          completedAt: row.completedAt ? row.completedAt.toISOString() : null,
        }),
      ),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = createSchema.parse(await request.json());
    const workspace = await requireMembership(user.id, body.projectId);
    const assigneeIds = await resolveAssignees(body.projectId, user.id, body.assigneeIds);
    const [peak] = await db()
      .select({ max: sql<number>`coalesce(max(${tasks.sortOrder}), -1)` })
      .from(tasks)
      .where(and(eq(tasks.userId, workspace.ownerId), eq(tasks.priority, GUEST_PRIORITY)));
    const created = await db().transaction(async (tx) => {
      const [row] = await tx
        .insert(tasks)
        .values({
          userId: workspace.ownerId,
          projectId: body.projectId,
          createdBy: user.id,
          title: body.title,
          notes: body.notes,
          priority: GUEST_PRIORITY,
          deadlineAt: body.deadlineAt ? new Date(body.deadlineAt) : null,
          status: "open",
          source: "manual",
          sortOrder: Number(peak?.max ?? -1) + 1,
          boardKey: normalizeKey(body.title),
        })
        .returning({ id: tasks.id });
      await insertTaskImages(tx, workspace.ownerId, row.id, body.images);
      await replaceAssignees(tx, row.id, assigneeIds);
      return row;
    });
    return jsonOk({ id: created.id }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, error.issues[0]?.message ?? "Dados inválidos."));
    }
    return handleError(error);
  }
}
