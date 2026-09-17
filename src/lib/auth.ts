import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { db } from "@/db";
import { refreshTokens, users } from "@/db/schema";
import { HttpError } from "@/lib/http";
import type { AuthUser, SessionPayload } from "@/lib/types";

const ACCESS_FALLBACK = "8h";
const REFRESH_FALLBACK = "14d";

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new HttpError(503, "JWT_SECRET ausente ou curto demais.");
  }
  return new TextEncoder().encode(secret);
}

function accessTtl() {
  return process.env.JWT_ACCESS_EXPIRES_IN || ACCESS_FALLBACK;
}

function refreshTtl() {
  return process.env.JWT_REFRESH_EXPIRES_IN || REFRESH_FALLBACK;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toIso(seconds: number) {
  return new Date(seconds * 1000).toISOString();
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

async function signToken(
  payload: JWTPayload,
  expiresIn: string,
  type: "access" | "refresh",
) {
  return new SignJWT({ ...payload, typ: type })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

async function readToken(token: string) {
  const { payload } = await jwtVerify(token, secretKey());
  return payload;
}

export async function requireUser(request: Request): Promise<AuthUser> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Entre de novo — sessão ausente.");
  }
  try {
    const payload = await readToken(header.slice(7));
    if (payload.typ !== "access" || !payload.sub) {
      throw new Error("tipo inválido");
    }
    return {
      id: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
    };
  } catch {
    throw new HttpError(401, "Sessão expirada. Entre de novo.");
  }
}

export async function issueSession(user: AuthUser): Promise<SessionPayload> {
  const claims = { sub: user.id, email: user.email, name: user.name };
  const jti = randomUUID();
  const accessToken = await signToken(claims, accessTtl(), "access");
  const refreshToken = await signToken({ ...claims, jti }, refreshTtl(), "refresh");
  const accessPayload = await readToken(accessToken);
  const refreshPayload = await readToken(refreshToken);
  const accessExp = Number(accessPayload.exp);
  const refreshExp = Number(refreshPayload.exp);

  await db().insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(refreshExp * 1000),
  });

  return {
    user,
    accessToken,
    refreshToken,
    accessExpiresAt: toIso(accessExp),
    refreshExpiresAt: toIso(refreshExp),
  };
}

export async function rotateRefresh(refreshToken: string): Promise<SessionPayload> {
  let payload: JWTPayload;
  try {
    payload = await readToken(refreshToken);
  } catch {
    throw new HttpError(401, "Refresh expirado. Entre de novo.");
  }
  if (payload.typ !== "refresh" || !payload.sub) {
    throw new HttpError(401, "Refresh inválido.");
  }

  const tokenHash = hashToken(refreshToken);
  const rows = await db()
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
    .limit(1);
  const stored = rows[0];
  if (!stored || stored.expiresAt.getTime() < Date.now()) {
    throw new HttpError(401, "Refresh revogado ou vencido.");
  }

  await db()
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, stored.id));

  const userRows = await db().select().from(users).where(eq(users.id, payload.sub)).limit(1);
  const user = userRows[0];
  if (!user) {
    throw new HttpError(401, "Usuário não encontrado.");
  }

  return issueSession({ id: user.id, email: user.email, name: user.name });
}

export async function revokeRefresh(refreshToken: string) {
  try {
    await db()
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, hashToken(refreshToken)));
  } catch {
    // logout is best-effort
  }
}
