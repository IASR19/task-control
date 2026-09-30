import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { taskExecutors, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { requireTaskAccess, setTaskExecutor } from "@/lib/sharing";

// Uma pessoa por vez: { on: true } adiciona, { on: false } remove.
const schema = z.object({
  taskId: z.string().uuid(),
  userId: z.string().uuid(),
  on: z.boolean(),
});

async function listExecutors(taskId: string) {
  return db()
    .select({ id: users.id, name: users.name })
    .from(taskExecutors)
    .innerJoin(users, eq(users.id, taskExecutors.userId))
    .where(eq(taskExecutors.taskId, taskId))
    .orderBy(asc(users.name));
}

// Executores: qualquer pessoa com acesso à task (dono do quadro ou membro do projeto) troca.
export async function PUT(request: Request) {
  try {
    const user = await requireUser(request);
    const body = schema.parse(await request.json());
    const { task } = await requireTaskAccess(user.id, body.taskId);
    await setTaskExecutor(task.projectId, body.taskId, body.userId, body.on);
    return jsonOk({ executors: await listExecutors(body.taskId) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, "Executor inválido."));
    }
    return handleError(error);
  }
}
