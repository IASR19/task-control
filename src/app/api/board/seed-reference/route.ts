import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, jsonOk } from "@/lib/http";
import { normalizeKey } from "@/lib/priority";
import { REFERENCE_BOARD } from "@/lib/reference-board";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const database = db();
    const existing = await database
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.userId, user.id))
      .limit(1);
    if (existing[0]) {
      return jsonOk({ seeded: false, message: "Quadro já tem projetos — não sobrescrevi." });
    }

    for (const [index, project] of REFERENCE_BOARD.entries()) {
      const inserted = await database
        .insert(projects)
        .values({ userId: user.id, name: project.name, sortOrder: index })
        .returning();
      const projectRow = inserted[0];
      for (const [taskIndex, task] of project.tasks.entries()) {
        await database.insert(tasks).values({
          userId: user.id,
          projectId: projectRow.id,
          title: task.title,
          priority: task.priority,
          status: "open",
          source: "board",
          boardKey: normalizeKey(task.title),
          sortOrder: taskIndex,
        });
      }
    }

    return jsonOk({ seeded: true });
  } catch (error) {
    return handleError(error);
  }
}
