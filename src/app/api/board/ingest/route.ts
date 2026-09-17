import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { readBoardImage } from "@/lib/gemini";
import { handleError, HttpError, jsonOk } from "@/lib/http";

export const maxDuration = 60;

const schema = z.object({
  imageBase64: z.string().min(40, "Foto ausente."),
  mimeType: z.string().optional().default("image/jpeg"),
});

export async function POST(request: Request) {
  try {
    await requireUser(request);
    const body = schema.parse(await request.json());
    const extracted = await readBoardImage(body.imageBase64, body.mimeType);
    return jsonOk({ extracted });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, error.issues[0]?.message ?? "Foto inválida."));
    }
    return handleError(error);
  }
}
