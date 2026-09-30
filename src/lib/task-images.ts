import { z } from "zod";
import { db } from "@/db";
import { taskImages } from "@/db/schema";

export const MAX_TASK_IMAGES = 12;

export const imageDataSchema = z
  .string()
  .max(4_000_000, "Imagem grande demais.")
  .regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/, "Imagem inválida.");

type Executor = Pick<ReturnType<typeof db>, "insert">;

export async function insertTaskImages(
  executor: Executor,
  userId: string,
  taskId: string,
  images: string[],
  offset = 0,
) {
  if (!images.length) return;
  await executor
    .insert(taskImages)
    .values(images.map((data, index) => ({ userId, taskId, data, sortOrder: offset + index })));
}
