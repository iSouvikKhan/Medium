import { z } from "zod";

/**
 * Request schemas shared by the API (validation) and the web app (form checks and types).
 * Consumed as TypeScript source through npm workspaces; nothing needs to be published.
 */

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

export const signupInput = z.object({
  username: email,
  password: z.string().min(8, "Use at least 8 characters").max(128, "Use at most 128 characters"),
  name: z.string().trim().min(1, "Enter your name").max(60, "Use at most 60 characters"),
});
export type SignupInput = z.infer<typeof signupInput>;

export const signinInput = z.object({
  username: email,
  password: z.string().min(1, "Enter your password").max(128),
});
export type SigninInput = z.infer<typeof signinInput>;

export const TITLE_MAX = 150;
export const CONTENT_MAX = 100_000;

const title = z.string().trim().min(1, "Add a title").max(TITLE_MAX, `Keep the title under ${TITLE_MAX} characters`);
const content = z
  .string()
  .trim()
  .min(1, "Write something before publishing")
  .max(CONTENT_MAX, "The story is too long");

export const createPostInput = z.object({
  title,
  content,
  published: z.boolean().default(true),
});
export type CreatePostInput = z.input<typeof createPostInput>;

export const updatePostInput = z
  .object({ title: title.optional(), content: content.optional(), published: z.boolean().optional() })
  .refine((v) => v.title !== undefined || v.content !== undefined || v.published !== undefined, {
    message: "Nothing to update",
  });
export type UpdatePostInput = z.infer<typeof updatePostInput>;

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const postIdParam = z.object({ id: z.coerce.number().int().positive("Invalid post id") });

/** Shapes returned by the API. */
export interface Author {
  id: number;
  name: string;
}

export interface PostSummary {
  id: number;
  title: string;
  excerpt: string;
  readingMinutes: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  author: Author;
}

export interface Post extends PostSummary {
  content: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PublicUser {
  id: number;
  name: string;
  username: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

const WORDS_PER_MINUTE = 225;

/** Estimated reading time in whole minutes (at least 1). */
export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** First ~`max` characters of the text, cut on a word boundary. */
export function excerpt(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).trimEnd()}…`;
}
