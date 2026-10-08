import { createPostInput, paginationQuery, postIdParam, updatePostInput, type Paginated, type PostSummary } from "@medium/common";
import { Hono, type Context } from "hono";
import { optionalAuth, requireAuth } from "../lib/auth";
import { forbidden, notFound } from "../lib/errors";
import { toPost, toSummary } from "../lib/present";
import { parse, readJson } from "../lib/validate";
import type { AppEnv } from "../types";

export const blogRouter = new Hono<AppEnv>();

/** Published stories, newest first. Public. */
blogRouter.get("/bulk", async (c) => {
  const { page, pageSize } = parse(paginationQuery, c.req.query());
  const { items, total } = await c.get("store").posts.listPublished({ skip: (page - 1) * pageSize, take: pageSize });
  const body: Paginated<PostSummary> = {
    items: items.map(toSummary),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
  return c.json(body);
});

/** The signed-in author's stories, including drafts. */
blogRouter.get("/mine", requireAuth, async (c) => {
  const posts = await c.get("store").posts.listByAuthor(c.get("userId"));
  return c.json({ items: posts.map(toSummary) });
});

/** One story. Drafts are only visible to their author. */
blogRouter.get("/:id", optionalAuth, async (c) => {
  const { id } = parse(postIdParam, { id: c.req.param("id") });
  const post = await c.get("store").posts.findById(id);
  if (!post || (!post.published && post.authorId !== c.get("userId"))) throw notFound("Story not found");
  return c.json({ post: toPost(post) });
});

blogRouter.post("/", requireAuth, async (c) => {
  const input = parse(createPostInput, await readJson(c.req));
  const post = await c.get("store").posts.create({ ...input, authorId: c.get("userId") });
  return c.json({ post: toPost(post) }, 201);
});

async function ownedPost(c: Context<AppEnv>) {
  const { id } = parse(postIdParam, { id: c.req.param("id") });
  const post = await c.get("store").posts.findById(id);
  if (!post) throw notFound("Story not found");
  if (post.authorId !== c.get("userId")) throw forbidden("You can only change your own stories");
  return post;
}

blogRouter.put("/:id", requireAuth, async (c) => {
  const post = await ownedPost(c);
  const changes = parse(updatePostInput, await readJson(c.req));
  const updated = await c.get("store").posts.update(post.id, changes);
  return c.json({ post: toPost(updated) });
});

blogRouter.delete("/:id", requireAuth, async (c) => {
  const post = await ownedPost(c);
  await c.get("store").posts.delete(post.id);
  return c.body(null, 204);
});
