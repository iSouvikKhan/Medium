import type { Post } from "@medium/common";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Header } from "../components/Header";
import { Avatar, Button, EmptyState, ErrorState, Spinner } from "../components/ui";
import { formatDate, paragraphs } from "../utils/format";

type State = { status: "loading" } | { status: "notfound" } | { status: "error"; message: string } | { status: "ready"; post: Post };

export function PostPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .post(id, controller.signal)
      .then(({ post }) => setState({ status: "ready", post }))
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        const e = err as ApiError;
        setState(e.status === 404 || e.status === 400 ? { status: "notfound" } : { status: "error", message: e.message });
      });
    return () => controller.abort();
  }, [id, attempt]);

  useEffect(() => {
    if (state.status === "ready") document.title = `${state.post.title} · Medium Clone`;
    return () => {
      document.title = "Medium Clone";
    };
  }, [state]);

  const onDelete = async (post: Post) => {
    if (!window.confirm("Delete this story? This cannot be undone.")) return;
    setDeleting(true);
    setActionError(null);
    try {
      await api.deletePost(post.id);
      navigate("/me/stories", { replace: true });
    } catch (err) {
      setActionError((err as ApiError).message);
      setDeleting(false);
    }
  };

  let body;
  if (state.status === "loading") {
    body = (
      <div className="flex justify-center py-24" aria-label="Loading story">
        <Spinner className="h-7 w-7 text-neutral-400" />
      </div>
    );
  } else if (state.status === "notfound") {
    body = (
      <EmptyState title="Story not found">
        It may have been deleted or is still a draft.{" "}
        <Link to="/" className="font-medium text-neutral-900 underline">
          Back to home
        </Link>
      </EmptyState>
    );
  } else if (state.status === "error") {
    body = (
      <div className="py-16">
        <ErrorState
          message={state.message}
          onRetry={() => {
            setState({ status: "loading" });
            setAttempt((a) => a + 1);
          }}
        />
      </div>
    );
  } else {
    const { post } = state;
    const isAuthor = user?.id === post.author.id;
    body = (
      <article className="pt-10 pb-24 sm:pt-14">
        {!post.published && (
          <p className="mb-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">This is a draft. Only you can see it.</p>
        )}
        <h1 className="text-[32px] leading-tight font-bold tracking-tight text-neutral-950 sm:text-[42px] sm:leading-[1.2]">{post.title}</h1>
        <div className="mt-8 flex items-center gap-3 border-y border-neutral-100 py-4">
          <Avatar name={post.author.name} size="md" />
          <div className="text-sm">
            <p className="font-medium text-neutral-900">{post.author.name}</p>
            <p className="text-neutral-500">
              {post.readingMinutes} min read · <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
              {post.updatedAt !== post.createdAt && <> · edited {formatDate(post.updatedAt)}</>}
            </p>
          </div>
          {isAuthor && (
            <div className="ml-auto flex gap-2">
              <Link to={`/edit/${post.id}`} className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm hover:border-neutral-900">
                Edit
              </Link>
              <Button variant="danger" loading={deleting} onClick={() => onDelete(post)} className="py-1.5">
                Delete
              </Button>
            </div>
          )}
        </div>
        {actionError && <p className="mt-4 text-sm text-red-600">{actionError}</p>}
        <div className="mt-10 space-y-8 font-serif text-[19px] leading-[1.75] text-neutral-800 sm:text-[20px]">
          {paragraphs(post.content).map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>
      </article>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[680px] px-4 sm:px-6">{body}</main>
    </>
  );
}
