import { sign } from "hono/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { hashPassword, isHashed, verifyPassword } from "../src/lib/password";
import { createMemoryStore } from "./memoryStore";

const ENV = { DATABASE_URL: "postgresql://unused", JWT_SECRET: "test-secret-0123456789", CORS_ORIGINS: "http://localhost:5173" };

let store: ReturnType<typeof createMemoryStore>;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  store = createMemoryStore();
  app = createApp({ createStore: () => store });
});

function call(path: string, init: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...init.headers };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  return app.request(
    path,
    { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body) },
    ENV,
  );
}

async function signup(name = "Ada", username = "ada@example.com") {
  const res = await call("/api/v1/user/signup", { method: "POST", body: { name, username, password: "password123" } });
  expect(res.status).toBe(201);
  return (await res.json()) as { token: string; user: { id: number } };
}

async function createPost(token: string, body: Record<string, unknown> = {}) {
  const res = await call("/api/v1/blog", {
    method: "POST",
    token,
    body: { title: "Hello world", content: "First paragraph.\n\nSecond paragraph.", ...body },
  });
  return { res, json: (await res.json()) as { post: { id: number; published: boolean } } };
}

describe("passwords", () => {
  it("hashes with PBKDF2 and verifies", async () => {
    const hash = await hashPassword("password123");
    expect(isHashed(hash)).toBe(true);
    expect(await verifyPassword("password123", hash)).toEqual({ valid: true, needsRehash: false });
    expect((await verifyPassword("wrong", hash)).valid).toBe(false);
  });

  it("recognises legacy plain-text passwords and asks for a rehash", async () => {
    expect(await verifyPassword("secret1", "secret1")).toEqual({ valid: true, needsRehash: true });
    expect((await verifyPassword("nope", "secret1")).valid).toBe(false);
  });
});

describe("auth", () => {
  it("signs up with a hashed password and returns a usable bearer token", async () => {
    const { token, user } = await signup();
    expect(isHashed(store.users_[0].password)).toBe(true);
    const me = await call("/api/v1/user/me", { token });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ user: { id: user.id, name: "Ada", username: "ada@example.com" } });
  });

  it("rejects duplicate emails case-insensitively", async () => {
    await signup();
    const res = await call("/api/v1/user/signup", {
      method: "POST",
      body: { name: "Other", username: "ADA@example.com", password: "password123" },
    });
    expect(res.status).toBe(409);
  });

  it("validates signup input with field details", async () => {
    const res = await call("/api/v1/user/signup", { method: "POST", body: { username: "bad", password: "1", name: "" } });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { details: { field: string }[] };
    expect(body.details.map((d) => d.field).sort()).toEqual(["name", "password", "username"]);
  });

  it("signs in, and rejects wrong passwords with 401", async () => {
    await signup();
    const ok = await call("/api/v1/user/signin", { method: "POST", body: { username: "Ada@Example.com", password: "password123" } });
    expect(ok.status).toBe(200);
    const bad = await call("/api/v1/user/signin", { method: "POST", body: { username: "ada@example.com", password: "wrong-one" } });
    expect(bad.status).toBe(401);
    const ghost = await call("/api/v1/user/signin", { method: "POST", body: { username: "nobody@example.com", password: "x" } });
    expect(ghost.status).toBe(401);
  });

  it("upgrades legacy plain-text passwords on sign-in", async () => {
    store.users_.push({ id: 99, username: "old@example.com", name: "Old", password: "legacy-pass" });
    const res = await call("/api/v1/user/signin", { method: "POST", body: { username: "old@example.com", password: "legacy-pass" } });
    expect(res.status).toBe(200);
    expect(isHashed(store.users_.find((u) => u.id === 99)!.password)).toBe(true);
  });

  it("rejects missing, malformed, forged and expired tokens", async () => {
    expect((await call("/api/v1/user/me")).status).toBe(401);
    expect((await call("/api/v1/user/me", { headers: { Authorization: "Token abc" } })).status).toBe(401);
    const forged = await sign({ sub: "1", exp: Math.floor(Date.now() / 1000) + 60 }, "another-secret-here", "HS256");
    expect((await call("/api/v1/user/me", { token: forged })).status).toBe(401);
    const expired = await sign({ sub: "1", exp: Math.floor(Date.now() / 1000) - 60 }, ENV.JWT_SECRET, "HS256");
    const res = await call("/api/v1/user/me", { token: expired });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { message: string }).message).toMatch(/expired/);
  });
});

describe("posts", () => {
  it("creates, reads publicly and lists newest first with pagination", async () => {
    const { token } = await signup();
    for (const t of ["One", "Two", "Three"]) await createPost(token, { title: t });

    const page1 = await call("/api/v1/blog/bulk?page=1&pageSize=2");
    const body = (await page1.json()) as { items: { title: string; author: { name: string }; readingMinutes: number }[]; total: number; totalPages: number };
    expect(body.items.map((p) => p.title)).toEqual(["Three", "Two"]);
    expect(body.total).toBe(3);
    expect(body.totalPages).toBe(2);
    expect(body.items[0].author.name).toBe("Ada");
    expect(body.items[0].readingMinutes).toBe(1);

    const one = await call("/api/v1/blog/1");
    expect(one.status).toBe(200);
    expect(((await one.json()) as { post: { content: string } }).post.content).toContain("Second paragraph.");
  });

  it("requires auth to write and validates input", async () => {
    expect((await call("/api/v1/blog", { method: "POST", body: { title: "x", content: "y" } })).status).toBe(401);
    const { token } = await signup();
    const { res } = await createPost(token, { title: "   " });
    expect(res.status).toBe(400);
    const bad = await call("/api/v1/blog", { method: "POST", token, body: "{not json" });
    expect(bad.status).toBe(400);
  });

  it("keeps drafts private to their author", async () => {
    const ada = await signup();
    const bob = await signup("Bob", "bob@example.com");
    const { json } = await createPost(ada.token, { published: false });
    const id = json.post.id;

    expect((await call(`/api/v1/blog/${id}`)).status).toBe(404);
    expect((await call(`/api/v1/blog/${id}`, { token: bob.token })).status).toBe(404);
    expect((await call(`/api/v1/blog/${id}`, { token: ada.token })).status).toBe(200);
    const feed = (await (await call("/api/v1/blog/bulk")).json()) as { total: number };
    expect(feed.total).toBe(0);
    const mine = (await (await call("/api/v1/blog/mine", { token: ada.token })).json()) as { items: unknown[] };
    expect(mine.items).toHaveLength(1);
  });

  it("only lets the author edit or delete a story", async () => {
    const ada = await signup();
    const bob = await signup("Bob", "bob@example.com");
    const { json } = await createPost(ada.token);
    const id = json.post.id;

    const hijack = await call(`/api/v1/blog/${id}`, { method: "PUT", token: bob.token, body: { title: "Mine now" } });
    expect(hijack.status).toBe(403);
    expect((await call(`/api/v1/blog/${id}`, { method: "DELETE", token: bob.token })).status).toBe(403);

    const edit = await call(`/api/v1/blog/${id}`, { method: "PUT", token: ada.token, body: { title: "Edited", published: false } });
    expect(edit.status).toBe(200);
    expect(((await edit.json()) as { post: { title: string; published: boolean } }).post).toMatchObject({ title: "Edited", published: false });

    expect((await call(`/api/v1/blog/${id}`, { method: "PUT", token: ada.token, body: {} })).status).toBe(400);
    expect((await call(`/api/v1/blog/${id}`, { method: "DELETE", token: ada.token })).status).toBe(204);
    expect((await call(`/api/v1/blog/${id}`, { token: ada.token })).status).toBe(404);
  });

  it("returns 400 for invalid ids and 404 for unknown stories", async () => {
    expect((await call("/api/v1/blog/abc")).status).toBe(400);
    expect((await call("/api/v1/blog/999")).status).toBe(404);
    const { token } = await signup();
    expect((await call("/api/v1/blog/999", { method: "PUT", token, body: { title: "x" } })).status).toBe(404);
  });
});

describe("app", () => {
  it("allows configured origins only", async () => {
    const ok = await call("/api/v1/blog/bulk", { headers: { Origin: "http://localhost:5173" } });
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    const other = await call("/api/v1/blog/bulk", { headers: { Origin: "https://evil.example" } });
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("hides unexpected errors and closes the store", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    store.posts.listPublished = async () => {
      throw new Error("connection refused: secret details");
    };
    const res = await call("/api/v1/blog/bulk");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
    expect(store.closed).toBeGreaterThan(0);
    spy.mockRestore();
  });

  it("reports missing configuration clearly", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await app.request("/api/v1/blog/bulk", {}, { DATABASE_URL: "", JWT_SECRET: "" });
    expect(res.status).toBe(500);
    expect(((await res.json()) as { message: string }).message).toBe("Server is not configured");
    spy.mockRestore();
  });

  it("returns JSON 404 for unknown routes", async () => {
    expect((await call("/api/v1/nope")).status).toBe(404);
  });
});
