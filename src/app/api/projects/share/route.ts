import { z } from "zod";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { projectMembers, projectShares, tasks, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { getProjectForUser } from "@/lib/queries";
import { activeShare, newShareToken } from "@/lib/sharing";

function shareDto(share: { token: string; createdAt: Date } | null) {
  return share ? { token: share.token, createdAt: share.createdAt.toISOString() } : null;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) throw new HttpError(400, "Informe o projeto.");
    await getProjectForUser(user.id, projectId);
    const members = await db()
      .select({
        id: projectMembers.id,
        name: users.name,
        email: users.email,
        createdAt: projectMembers.createdAt,
        taskCount: sql<number>`(
          select count(*) from ${tasks}
          where ${tasks.projectId} = ${projectMembers.projectId} and ${tasks.createdBy} = ${projectMembers.userId}
        )::int`,
      })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(asc(projectMembers.createdAt));
    return jsonOk({
      share: shareDto(await activeShare(projectId)),
      members: members.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        taskCount: Number(row.taskCount) || 0,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = z.object({ projectId: z.string().uuid() }).parse(await request.json());
    await getProjectForUser(user.id, body.projectId);
    const existing = await activeShare(body.projectId);
    if (existing) return jsonOk({ share: shareDto(existing) });
    // Dois cliques simultâneos: o índice único de link ativo barra o segundo, que devolve o link já criado.
    const [created] = await db()
      .insert(projectShares)
      .values({ projectId: body.projectId, ownerId: user.id, token: newShareToken() })
      .onConflictDoNothing()
      .returning();
    if (created) return jsonOk({ share: shareDto(created) }, 201);
    return jsonOk({ share: shareDto(await activeShare(body.projectId)) });
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
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) throw new HttpError(400, "Informe o projeto.");
    await getProjectForUser(user.id, projectId);
    await db()
      .update(projectShares)
      .set({ revokedAt: new Date() })
      .where(and(eq(projectShares.projectId, projectId), isNull(projectShares.revokedAt)));
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
