import type { MiddlewareHandler } from "hono";
import { sign, verify } from "hono/jwt";
import type { AppEnv } from "../types";
import { unauthorized } from "./errors";

const ALG = "HS256";
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function issueToken(userId: number, secret: string, now = Math.floor(Date.now() / 1000)) {
  return sign({ sub: String(userId), iat: now, exp: now + TOKEN_TTL_SECONDS }, secret, ALG);
}

/** Returns the user id from a valid `Authorization: Bearer <jwt>` header, or null if absent. */
export async function userIdFromHeader(header: string | undefined, secret: string): Promise<number | null> {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) throw unauthorized("Malformed Authorization header");
  try {
    const payload = await verify(token, secret, ALG);
    const id = Number(payload.sub);
    if (!Number.isInteger(id) || id <= 0) throw new Error("bad subject");
    return id;
  } catch {
    throw unauthorized("Your session has expired, please sign in again");
  }
}

/** Requires a valid token and sets c.var.userId. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const id = await userIdFromHeader(c.req.header("Authorization"), c.env.JWT_SECRET);
  if (id === null) throw unauthorized();
  c.set("userId", id);
  await next();
};

/** Sets c.var.userId when a valid token is present; anonymous requests continue. */
export const optionalAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const id = await userIdFromHeader(c.req.header("Authorization"), c.env.JWT_SECRET);
  if (id !== null) c.set("userId", id);
  await next();
};
