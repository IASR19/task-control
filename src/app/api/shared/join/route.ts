import { z } from "zod";
import { db } from "@/db";
import { projectMembers } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { findShareByToken } from "@/lib/sharing";

// Público: mostra de quem é o convite antes de a pessoa criar conta.
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token");
    if (!token) throw new HttpError(400, "Link incompleto.");
    const share = await findShareByToken(token);
    return jsonOk({
      preview: { projectId: share.projectId, projectName: share.projectName, ownerName: share.ownerName },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = z.object({ token: z.string().min(8) }).parse(await request.json());
    const share = await findShareByToken(body.token);
    if (share.ownerId === user.id) return jsonOk({ projectId: share.projectId, owner: true });
    await db()
      .insert(projectMembers)
      .values({ projectId: share.projectId, userId: user.id })
      .onConflictDoNothing();
    return jsonOk({ projectId: share.projectId, owner: false });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, "Link inválido."));
    }
    return handleError(error);
  }
}
