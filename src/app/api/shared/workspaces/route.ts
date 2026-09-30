import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { projectMembers, projectShares, projects, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const workspaces = await db()
      .select({ projectId: projects.id, projectName: projects.name, ownerName: users.name })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .innerJoin(users, eq(users.id, projects.userId))
      .innerJoin(
        projectShares,
        and(eq(projectShares.projectId, projects.id), isNull(projectShares.revokedAt)),
      )
      .where(eq(projectMembers.userId, user.id))
      .orderBy(asc(projects.name));
    return jsonOk({ workspaces });
  } catch (error) {
    return handleError(error);
  }
}
