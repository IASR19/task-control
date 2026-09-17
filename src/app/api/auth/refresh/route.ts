import { z } from "zod";
import { rotateRefresh } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";

const schema = z.object({
  refreshToken: z.string().min(10),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    return jsonOk(await rotateRefresh(body.refreshToken));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, "Refresh ausente."));
    }
    return handleError(error);
  }
}
