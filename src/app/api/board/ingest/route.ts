import { z } from "zod";
import { db } from "@/db";
import { boardSnapshots } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { readBoardImage } from "@/lib/gemini";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { reconcileBoard } from "@/lib/reconcile";

export const maxDuration = 60;

const schema = z.object({
  imageBase64: z.string().min(40, "Foto ausente."),
  mimeType: z.string().optional().default("image/jpeg"),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = schema.parse(await request.json());
    const extracted = await readBoardImage(body.imageBase64, body.mimeType);
    const summary = await reconcileBoard(user.id, extracted);
    const thumb = body.imageBase64.startsWith("data:")
      ? body.imageBase64
      : `data:${body.mimeType};base64,${body.imageBase64}`;
    const saved = await db()
      .insert(boardSnapshots)
      .values({
        userId: user.id,
        extracted,
        summary,
        imageMime: body.mimeType,
        imageThumb: thumb.slice(0, 180000),
      })
      .returning();
    return jsonOk({ extracted, summary, snapshot: saved[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, error.issues[0]?.message ?? "Foto inválida."));
    }
    return handleError(error);
  }
}
