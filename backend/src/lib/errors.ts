import type { ContentfulStatusCode } from "hono/utils/http-status";

export interface FieldError {
  field: string | null;
  message: string;
}

/** An error whose message is safe to show to API clients. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string,
    readonly details?: FieldError[],
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: FieldError[]) => new ApiError(400, message, details);
export const unauthorized = (message = "Please sign in to continue") => new ApiError(401, message);
export const forbidden = (message = "You are not allowed to do that") => new ApiError(403, message);
export const notFound = (message = "Not found") => new ApiError(404, message);
export const conflict = (message: string) => new ApiError(409, message);
