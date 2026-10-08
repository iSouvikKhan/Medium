import type { PostSummary } from "@medium/common";
import { Link } from "react-router";
import { formatDate } from "../utils/format";
import { Avatar } from "./ui";

export function PostCard({ post }: { post: PostSummary }) {
  return (
    <article className="border-b border-neutral-100 py-7">
      <div className="flex items-center gap-2 text-[13px] text-neutral-700">
        <Avatar name={post.author.name} size="xs" />
        <span className="font-medium">{post.author.name}</span>
      </div>
      <Link to={`/blog/${post.id}`} className="group mt-2 block">
        <h2 className="text-xl leading-snug font-bold tracking-tight text-neutral-950 group-hover:underline sm:text-[22px]">{post.title}</h2>
        <p className="mt-1.5 line-clamp-3 font-serif text-[15px] leading-6 text-neutral-600 sm:text-base">{post.excerpt}</p>
      </Link>
      <p className="mt-3 text-[13px] text-neutral-500">
        <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time> · {post.readingMinutes} min read
      </p>
    </article>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="animate-pulse border-b border-neutral-100 py-7" aria-hidden="true">
      <div className="flex items-center gap-2">
        <span className="h-6 w-6 rounded-full bg-neutral-200" />
        <span className="h-3 w-24 rounded bg-neutral-200" />
      </div>
      <div className="mt-3 h-5 w-3/4 rounded bg-neutral-200" />
      <div className="mt-3 h-3 w-full rounded bg-neutral-100" />
      <div className="mt-2 h-3 w-5/6 rounded bg-neutral-100" />
      <div className="mt-4 h-3 w-32 rounded bg-neutral-100" />
    </div>
  );
}
