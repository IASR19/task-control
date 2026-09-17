import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { boardSnapshots } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, jsonOk } from "@/lib/http";
import type { ReconcileSummary } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const rows = await db()
      .select({
        id: boardSnapshots.id,
        createdAt: boardSnapshots.createdAt,
        summary: boardSnapshots.summary,
      })
      .from(boardSnapshots)
      .where(eq(boardSnapshots.userId, user.id))
      .orderBy(desc(boardSnapshots.createdAt))
      .limit(20);

    return jsonOk({
      snapshots: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        summary: row.summary as ReconcileSummary,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}
