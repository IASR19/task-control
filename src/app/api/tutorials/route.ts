import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userTutorials } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { requireProjectAccess } from "@/lib/sharing";

const keySchema = z
  .string()
  .regex(/^(lousa|shared:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/, "Tutorial inválido.");

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const rows = await db()
      .select({ key: userTutorials.tourKey })
      .from(userTutorials)
      .where(eq(userTutorials.userId, user.id));
    return jsonOk({ seen: rows.map((row) => row.key) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const { key } = z.object({ key: keySchema }).parse(await request.json());
    if (key.startsWith("shared:")) await requireProjectAccess(user.id, key.slice("shared:".length));
    await db().insert(userTutorials).values({ userId: user.id, tourKey: key }).onConflictDoNothing();
    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, error.issues[0]?.message ?? "Tutorial inválido."));
    }
    return handleError(error);
  }
}
