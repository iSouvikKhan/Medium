import type { Paginated, PostSummary } from "@medium/common";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Header } from "../components/Header";
import { PostCard, PostCardSkeleton } from "../components/PostCard";
import { EmptyState, ErrorState } from "../components/ui";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Paginated<PostSummary> };

export function Home() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .feed(page, controller.signal)
      .then((data) => setState({ status: "ready", data }))
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setState({ status: "error", message: (err as ApiError).message });
      });
    return () => controller.abort();
  }, [page, attempt]);

  const goTo = (p: number) => {
    setState({ status: "loading" });
    setParams(p === 1 ? {} : { page: String(p) });
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <Header />
      {!user && (
        <section className="border-b border-neutral-900 bg-[#f7f4ed]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <h1 className="max-w-2xl font-serif text-5xl leading-[1.05] tracking-tight text-neutral-950 sm:text-7xl">Stories worth reading.</h1>
            <p className="mt-6 max-w-md text-lg text-neutral-700 sm:text-xl">A quiet place to read, write and share ideas with anyone.</p>
            <Link to="/signup" className="mt-8 inline-block rounded-full bg-neutral-900 px-8 py-2.5 text-lg text-white hover:bg-neutral-700">
              Start reading
            </Link>
          </div>
        </section>
      )}

      <main className="mx-auto max-w-[728px] px-4 pb-20 sm:px-6">
        <h2 className="sr-only">Latest stories</h2>
        {state.status === "loading" ? (
          <div aria-label="Loading stories">
            {[0, 1, 2, 3].map((i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : state.status === "error" ? (
          <div className="pt-10">
            <ErrorState
              message={state.message}
              onRetry={() => {
                setState({ status: "loading" });
                setAttempt((a) => a + 1);
              }}
            />
          </div>
        ) : state.data.items.length === 0 ? (
          <EmptyState title="No stories yet">
            {user ? (
              <Link to="/write" className="font-medium text-emerald-700 hover:underline">
                Write the first one
              </Link>
            ) : (
              "Sign up to write the first one."
            )}
          </EmptyState>
        ) : (
          <>
            {state.data.items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            {state.data.totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-between text-sm" aria-label="Pagination">
                <button type="button" disabled={page <= 1} onClick={() => goTo(page - 1)} className="rounded-full border border-neutral-300 px-4 py-2 hover:border-neutral-900 disabled:invisible">
                  ← Newer
                </button>
                <span className="text-neutral-500">
                  Page {state.data.page} of {state.data.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= state.data.totalPages}
                  onClick={() => goTo(page + 1)}
                  className="rounded-full border border-neutral-300 px-4 py-2 hover:border-neutral-900 disabled:invisible"
                >
                  Older →
                </button>
              </nav>
            )}
          </>
        )}
      </main>
    </>
  );
}
