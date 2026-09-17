import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { issueSession, verifyPassword } from "@/lib/auth";
import { handleError, HttpError, jsonOk } from "@/lib/http";

const schema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const rows = await db().select().from(users).where(eq(users.email, body.email)).limit(1);
    const user = rows[0];
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new HttpError(401, "E-mail ou senha não conferem.");
    }
    return jsonOk(await issueSession({ id: user.id, email: user.email, name: user.name }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(new HttpError(400, "Informe e-mail e senha."));
    }
    return handleError(error);
  }
}
