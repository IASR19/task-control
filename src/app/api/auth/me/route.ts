import { requireUser } from "@/lib/auth";
import { handleError, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return jsonOk({ user });
  } catch (error) {
    return handleError(error);
  }
}
