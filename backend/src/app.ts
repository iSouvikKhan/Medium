import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { ApiError } from "./lib/errors";
import { blogRouter } from "./routes/blog";
import { userRouter } from "./routes/user";
import type { Store } from "./store/types";
import type { AppEnv, Bindings } from "./types";

export interface AppDeps {
  createStore: (env: Bindings) => Store;
}

const DEFAULT_ORIGINS = "http://localhost:5173";

export function createApp({ createStore }: AppDeps) {
  const app = new Hono<AppEnv>();

  app.use("*", secureHeaders());
  app.use("/api/*", async (c, next) => {
    const allowed = (c.env.CORS_ORIGINS || DEFAULT_ORIGINS).split(",").map((o) => o.trim());
    return cors({
      origin: (origin) => (allowed.includes("*") || allowed.includes(origin) ? origin : null),
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      maxAge: 600,
    })(c, next);
  });

  // Fail fast with a clear message when secrets are missing.
  app.use("/api/*", async (c, next) => {
    if (!c.env.JWT_SECRET || !c.env.DATABASE_URL) {
      console.error("DATABASE_URL and JWT_SECRET must be set (backend/.dev.vars locally, wrangler secrets in production)");
      return c.json({ message: "Server is not configured" }, 500);
    }
    const store = createStore(c.env);
    c.set("store", store);
    try {
      await next();
    } finally {
      const closing = store.close().catch(() => {});
      try {
        c.executionCtx.waitUntil(closing);
      } catch {
        await closing; // no execution context (tests)
      }
    }
  });

  app.get("/", (c) => c.json({ name: "medium-api", status: "ok" }));
  app.route("/api/v1/user", userRouter);
  app.route("/api/v1/blog", blogRouter);

  app.notFound((c) => c.json({ message: `Route ${c.req.method} ${c.req.path} not found` }, 404));
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json({ message: err.message, ...(err.details ? { details: err.details } : {}) }, err.status);
    }
    console.error("Unhandled error", err);
    return c.json({ message: "Something went wrong. Please try again." }, 500);
  });

  return app;
}
