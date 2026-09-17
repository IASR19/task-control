import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, issueSession } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2, "Nome curto demais."),
  email: z.string().trim().email("E-mail inválido.").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const existing = await db()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);
    if (existing[0]) {
      throw new HttpError(409, "Já existe conta com esse e-mail.");
    }
    const inserted = await db()
      .insert(users)
      .values({
        name: body.name,
        email: body.email,
        passwordHash: await hashPassword(body.password),
      })
      .returning();
    const user = inserted[0];
    return jsonOk(
      await issueSession({ id: user.id, email: user.email, name: user.name }),
      201,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, error.issues[0]?.message ?? "Dados inválidos."));
    }
    return handleError(error);
  }
}
