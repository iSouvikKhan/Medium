import type { Store } from "./store/types";

export interface Bindings {
  /** postgresql:// connection string (secret: .dev.vars locally, `wrangler secret put` in production) */
  DATABASE_URL: string;
  /** Secret used to sign JWTs (secret) */
  JWT_SECRET: string;
  /** Comma-separated list of allowed browser origins (plain var in wrangler.toml) */
  CORS_ORIGINS?: string;
}

export interface Variables {
  userId: number;
  store: Store;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: Variables;
}
