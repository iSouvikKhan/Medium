import type { PostSummary } from "@medium/common";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { api, ApiError } from "../api/client";
import { Header } from "../components/Header";
import { Button, EmptyState, ErrorState, Spinner } from "../components/ui";
import { formatDate } from "../utils/format";

type Tab = "drafts" | "published";

export function MyStories() {
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("published");
  const [busy, setBusy] = useState<number | null>(null);

  const fetchPosts = useCallback(
    () =>
      api
        .myPosts()
        .then(({ items }) => setPosts(items))
        .catch((err: ApiError) => setError(err.message)),
    [],
  );

  // Initial load: state is only set when the request settles.
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const load = () => {
    setError(null);
    fetchPosts();
  };

  const remove = async (post: PostSummary) => {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    setBusy(post.id);
    try {
      await api.deletePost(post.id);
      setPosts((list) => list?.filter((p) => p.id !== post.id) ?? null);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const drafts = posts?.filter((p) => !p.published) ?? [];
  const published = posts?.filter((p) => p.published) ?? [];
  const visible = tab === "drafts" ? drafts : published;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[728px] px-4 pt-10 pb-24 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your stories</h1>
          <Link to="/write" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Write a story
          </Link>
        </div>
        <div role="tablist" className="mt-8 flex gap-6 border-b border-neutral-200 text-sm">
          {(
            [
              ["published", `Published ${published.length}`],
              ["drafts", `Drafts ${drafts.length}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b pb-3 ${tab === key ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6">
            <ErrorState message={error} onRetry={load} />
          </div>
        )}
        {posts === null && !error ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-neutral-400" />
          </div>
        ) : posts !== null && visible.length === 0 ? (
          <EmptyState title={tab === "drafts" ? "No drafts" : "Nothing published yet"}>
            <Link to="/write" className="font-medium text-emerald-700 hover:underline">
              Start writing
            </Link>
          </EmptyState>
        ) : (
          <ul>
            {visible.map((post) => (
              <li key={post.id} className="border-b border-neutral-100 py-6">
                <Link to={`/blog/${post.id}`} className="text-lg font-bold text-neutral-950 hover:underline">
                  {post.title}
                </Link>
                <p className="mt-1 line-clamp-2 font-serif text-neutral-600">{post.excerpt}</p>
                <div className="mt-3 flex items-center gap-4 text-[13px] text-neutral-500">
                  <span>
                    {post.published ? "Published" : "Last edited"} {formatDate(post.published ? post.createdAt : post.updatedAt)} · {post.readingMinutes} min read
                  </span>
                  <Link to={`/edit/${post.id}`} className="text-neutral-700 hover:underline">
                    Edit
                  </Link>
                  <Button variant="ghost" className="px-0 py-0 text-[13px] text-red-600 hover:text-red-800" loading={busy === post.id} onClick={() => remove(post)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
