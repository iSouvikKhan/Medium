import { createApp } from "./app";
import { createPrismaStore } from "./store/prisma";

/** Cloudflare Worker entry point. */
export default createApp({ createStore: createPrismaStore });
