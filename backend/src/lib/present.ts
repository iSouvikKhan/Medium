import { excerpt, readingMinutes, type Post, type PostSummary, type PublicUser } from "@medium/common";
import type { PostRecord, UserRecord } from "../store/types";

const authorName = (name: string | null) => name?.trim() || "Anonymous";

export function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, name: authorName(user.name), username: user.username };
}

export function toSummary(post: PostRecord): PostSummary {
  return {
    id: post.id,
    title: post.title,
    excerpt: excerpt(post.content),
    readingMinutes: readingMinutes(post.content),
    published: post.published,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: { id: post.author.id, name: authorName(post.author.name) },
  };
}

export function toPost(post: PostRecord): Post {
  return { ...toSummary(post), content: post.content };
}
