import { z } from "zod";
import { db } from "@/db";
import { boardSnapshots } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";
import { parsePriority } from "@/lib/priority";
import { reconcileBoard } from "@/lib/reconcile";

export const maxDuration = 60;

const schema = z.object({
  extracted: z.object({
    projects: z.array(
      z.object({
        name: z.string().trim().min(1),
        tasks: z.array(
          z.object({
            title: z.string().trim().min(1),
            priority: z.number().int().min(0).max(3),
            order: z.number().optional(),
          }),
        ),
      }),
    ),
  }),
  imageBase64: z.string().optional(),
  mimeType: z.string().optional().default("image/jpeg"),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = schema.parse(await request.json());
    const extracted = {
      projects: body.extracted.projects.map((project) => ({
        name: project.name.trim(),
        tasks: project.tasks.map((task, index) => ({
          title: task.title.trim(),
          priority: parsePriority(task.priority),
          order: task.order ?? index + 1,
        })),
      })),
    };
    if (extracted.projects.length === 0) {
      throw new HttpError(400, "Não tem nada para aplicar.");
    }
    const summary = await reconcileBoard(user.id, extracted);
    const raw = body.imageBase64 ?? "";
    const thumb = raw
      ? raw.startsWith("data:")
        ? raw
        : `data:${body.mimeType};base64,${raw}`
      : "";
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
      return handleError(new HttpError(400, error.issues[0]?.message ?? "Leitura inválida."));
    }
    return handleError(error);
  }
}
