import { z } from "zod";
import { revokeRefresh } from "@/lib/auth";
import { handleError, jsonOk } from "@/lib/http";

const schema = z.object({
  refreshToken: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json().catch(() => ({})));
    if (body.refreshToken) {
      await revokeRefresh(body.refreshToken);
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
