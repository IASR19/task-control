import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { taskImages, tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { requireMembership } from "@/lib/sharing";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const taskId = new URL(request.url).searchParams.get("taskId");
    if (!taskId) throw new HttpError(400, "Informe a tarefa.");
    const [task] = await db()
      .select({ projectId: tasks.projectId })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);
    if (!task) throw new HttpError(404, "Tarefa não encontrada.");
    await requireMembership(user.id, task.projectId);
    const images = await db()
      .select({ id: taskImages.id, data: taskImages.data })
      .from(taskImages)
      .where(eq(taskImages.taskId, taskId))
      .orderBy(asc(taskImages.sortOrder), asc(taskImages.createdAt));
    return jsonOk({ images });
  } catch (error) {
    return handleError(error);
  }
}
