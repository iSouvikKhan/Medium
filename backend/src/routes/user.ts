import { signinInput, signupInput, type AuthResponse } from "@medium/common";
import { Hono } from "hono";
import { issueToken, requireAuth } from "../lib/auth";
import { conflict, notFound, unauthorized } from "../lib/errors";
import { hashPassword, verifyPassword } from "../lib/password";
import { toPublicUser } from "../lib/present";
import { parse, readJson } from "../lib/validate";
import { DuplicateUsernameError } from "../store/types";
import type { AppEnv } from "../types";

export const userRouter = new Hono<AppEnv>();

userRouter.post("/signup", async (c) => {
  const input = parse(signupInput, await readJson(c.req));
  const store = c.get("store");
  if (await store.users.findByUsername(input.username)) {
    throw conflict("An account with this email already exists");
  }
  try {
    const user = await store.users.create({
      username: input.username,
      name: input.name,
      password: await hashPassword(input.password),
    });
    const body: AuthResponse = { token: await issueToken(user.id, c.env.JWT_SECRET), user: toPublicUser(user) };
    return c.json(body, 201);
  } catch (err) {
    if (err instanceof DuplicateUsernameError) throw conflict("An account with this email already exists");
    throw err;
  }
});

userRouter.post("/signin", async (c) => {
  const input = parse(signinInput, await readJson(c.req));
  const store = c.get("store");
  const user = await store.users.findByUsername(input.username);
  const result = user ? await verifyPassword(input.password, user.password) : { valid: false, needsRehash: false };
  if (!user || !result.valid) throw unauthorized("Incorrect email or password");
  if (result.needsRehash) {
    await store.users.updatePassword(user.id, await hashPassword(input.password));
  }
  const body: AuthResponse = { token: await issueToken(user.id, c.env.JWT_SECRET), user: toPublicUser(user) };
  return c.json(body);
});

userRouter.get("/me", requireAuth, async (c) => {
  const user = await c.get("store").users.findById(c.get("userId"));
  if (!user) throw notFound("Account not found");
  return c.json({ user: toPublicUser(user) });
});
