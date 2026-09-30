import { z } from "zod";
import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { taskImages, tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { getTaskForUser } from "@/lib/queries";
import { imageDataSchema, insertTaskImages, MAX_TASK_IMAGES } from "@/lib/task-images";

const putSchema = z.object({
  taskId: z.string().uuid(),
  notes: z.string(),
  keepImageIds: z.array(z.string().uuid()).default([]),
  newImages: z.array(imageDataSchema).default([]),
});

async function listImages(userId: string, taskId: string) {
  return db()
    .select({ id: taskImages.id, data: taskImages.data })
    .from(taskImages)
    .where(and(eq(taskImages.taskId, taskId), eq(taskImages.userId, userId)))
    .orderBy(asc(taskImages.sortOrder), asc(taskImages.createdAt));
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const taskId = new URL(request.url).searchParams.get("taskId");
    if (!taskId) throw new HttpError(400, "Informe a tarefa.");
    const task = await getTaskForUser(user.id, taskId);
    return jsonOk({ notes: task.notes, images: await listImages(user.id, taskId) });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser(request);
    const body = putSchema.parse(await request.json());
    await getTaskForUser(user.id, body.taskId);

    const scope = and(eq(taskImages.taskId, body.taskId), eq(taskImages.userId, user.id));
    await db().transaction(async (tx) => {
      const kept = body.keepImageIds.length
        ? await tx
            .select({ id: taskImages.id, sortOrder: taskImages.sortOrder })
            .from(taskImages)
            .where(and(scope, inArray(taskImages.id, body.keepImageIds)))
        : [];
      if (kept.length + body.newImages.length > MAX_TASK_IMAGES) {
        throw new HttpError(400, `No máximo ${MAX_TASK_IMAGES} imagens por descrição.`);
      }

      await tx
        .delete(taskImages)
        .where(kept.length ? and(scope, notInArray(taskImages.id, kept.map((row) => row.id))) : scope);
      await insertTaskImages(
        tx,
        user.id,
        body.taskId,
        body.newImages,
        Math.max(-1, ...kept.map((row) => row.sortOrder)) + 1,
      );
      await tx
        .update(tasks)
        .set({ notes: body.notes, updatedAt: new Date() })
        .where(and(eq(tasks.id, body.taskId), eq(tasks.userId, user.id)));
    });

    return jsonOk({ notes: body.notes, images: await listImages(user.id, body.taskId) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, error.issues[0]?.message ?? "Dados inválidos."));
    }
    return handleError(error);
  }
}
