import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { projectPeople, requireProjectAccess } from "@/lib/sharing";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) throw new HttpError(400, "Informe o projeto.");
    await requireProjectAccess(user.id, projectId);
    return jsonOk({ people: await projectPeople(projectId) });
  } catch (error) {
    return handleError(error);
  }
}
