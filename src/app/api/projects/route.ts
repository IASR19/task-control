import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { listProjects } from "@/lib/queries";

const schema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao projeto."),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return jsonOk({ projects: await listProjects(user.id) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = schema.parse(await request.json());
    const existing = await listProjects(user.id);
    const inserted = await db()
      .insert(projects)
      .values({
        userId: user.id,
        name: body.name,
        sortOrder: existing.length,
      })
      .returning();
    return jsonOk({ project: inserted[0] }, 201);
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
        name: z.string().trim().min(1),
      })
      .parse(await request.json());
    const updated = await db()
      .update(projects)
      .set({ name: body.name })
      .where(and(eq(projects.id, body.id), eq(projects.userId, user.id)))
      .returning();
    if (!updated[0]) throw new HttpError(404, "Projeto não encontrado.");
    return jsonOk({ project: updated[0] });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) throw new HttpError(400, "Informe o projeto.");
    const deleted = await db()
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
      .returning();
    if (!deleted[0]) throw new HttpError(404, "Projeto não encontrado.");
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
