import type { z } from "zod";
import { badRequest } from "./errors";

/** Parses `value` with a Zod schema, throwing a 400 with per-field details on failure. */
export function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.length ? i.path.join(".") : null,
      message: i.message,
    }));
    throw badRequest(details.map((d) => d.message).join("; "), details);
  }
  return result.data;
}

/** Reads a JSON body, turning malformed JSON into a 400 instead of a 500. */
export async function readJson(req: { json: () => Promise<unknown> }): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
}
