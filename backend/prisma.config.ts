import { defineConfig } from "prisma/config";

// Used by the Prisma CLI (migrate, generate, studio). The Worker gets DATABASE_URL from
// wrangler (.dev.vars locally, `wrangler secret put` in production) instead.
try {
  process.loadEnvFile(".dev.vars");
} catch {
  /* fall back to the shell environment */
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
