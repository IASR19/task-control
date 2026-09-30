import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectMembers, projects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { pruneTaskPeople } from "@/lib/sharing";

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new HttpError(400, "Informe o membro.");
    const [member] = await db()
      .select({ id: projectMembers.id, projectId: projectMembers.projectId })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(and(eq(projectMembers.id, id), eq(projects.userId, user.id)))
      .limit(1);
    if (!member) throw new HttpError(404, "Membro não encontrado.");
    await db().delete(projectMembers).where(eq(projectMembers.id, member.id));
    await pruneTaskPeople({ projectId: member.projectId });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
