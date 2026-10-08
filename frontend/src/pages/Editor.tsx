import { CONTENT_MAX, TITLE_MAX, createPostInput, readingMinutes } from "@medium/common";
import { useEffect, useRef, useState, type TextareaHTMLAttributes } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Header } from "../components/Header";
import { Button, EmptyState, ErrorState, Spinner } from "../components/ui";
import { wordCount } from "../utils/format";

function AutoGrowTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

type Load = { status: "loading" } | { status: "ready" } | { status: "notfound" } | { status: "forbidden" } | { status: "error"; message: string };

/** Distraction-free editor for new stories (/write) and edits (/edit/:id). */
export function Editor() {
  const { id } = useParams();
  const editing = id !== undefined;
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [published, setPublished] = useState(false);
  const [saved, setSaved] = useState({ title: "", content: "" });
  const [load, setLoad] = useState<Load>(editing ? { status: "loading" } : { status: "ready" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    api
      .post(id)
      .then(({ post }) => {
        if (cancelled) return;
        if (post.author.id !== user?.id) return setLoad({ status: "forbidden" });
        setTitle(post.title);
        setContent(post.content);
        setPublished(post.published);
        setSaved({ title: post.title, content: post.content });
        setLoad({ status: "ready" });
      })
      .catch((err: ApiError) => {
        if (cancelled) return;
        setLoad(err.status === 404 || err.status === 400 ? { status: "notfound" } : { status: "error", message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [editing, id, user?.id]);

  const dirty = title !== saved.title || content !== saved.content;

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const save = async (publish: boolean) => {
    setError(null);
    const check = createPostInput.safeParse({ title, content, published: publish });
    if (!check.success) {
      const map: Record<string, string> = {};
      for (const issue of check.error.issues) map[String(issue.path[0])] ??= issue.message;
      setErrors(map);
      return;
    }
    setErrors({});
    setSaving(publish ? "publish" : "draft");
    try {
      const { post } = editing
        ? await api.updatePost(Number(id), check.data)
        : await api.createPost(check.data);
      setSaved({ title: post.title, content: post.content });
      navigate(`/blog/${post.id}`, { replace: true });
    } catch (err) {
      const e = err as ApiError;
      setErrors(e.fieldErrors());
      setError(e.message);
      setSaving(null);
    }
  };

  const words = wordCount(content);
  const status = editing ? (published ? "Published" : "Draft") : "New draft";

  const actions = (
    <>
      <span className="hidden text-sm text-neutral-500 sm:inline">
        {status}
        {dirty && " · unsaved changes"}
      </span>
      {load.status === "ready" && (
        <>
          <Button variant="ghost" loading={saving === "draft"} disabled={saving !== null} onClick={() => save(false)}>
            {editing && published ? "Unpublish" : "Save draft"}
          </Button>
          <Button variant="accent" loading={saving === "publish"} disabled={saving !== null} onClick={() => save(true)}>
            {editing && published ? "Save" : "Publish"}
          </Button>
        </>
      )}
    </>
  );

  let body;
  if (load.status === "loading") {
    body = (
      <div className="flex justify-center py-24">
        <Spinner className="h-7 w-7 text-neutral-400" />
      </div>
    );
  } else if (load.status === "notfound") {
    body = <EmptyState title="Story not found" />;
  } else if (load.status === "forbidden") {
    body = <EmptyState title="You can only edit your own stories" />;
  } else if (load.status === "error") {
    body = (
      <div className="py-16">
        <ErrorState message={load.message} />
      </div>
    );
  } else {
    body = (
      <form className="pt-10 pb-24" onSubmit={(e) => e.preventDefault()} noValidate>
        {error && (
          <p role="alert" className="mb-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <label htmlFor="title" className="sr-only">
          Title
        </label>
        <AutoGrowTextarea
          id="title"
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
          placeholder="Title"
          aria-invalid={errors.title ? true : undefined}
          className="w-full resize-none overflow-hidden border-0 bg-transparent font-serif text-4xl leading-tight text-neutral-950 outline-none placeholder:text-neutral-300 sm:text-[42px]"
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
        <label htmlFor="content" className="sr-only">
          Story
        </label>
        <AutoGrowTextarea
          id="content"
          value={content}
          maxLength={CONTENT_MAX}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Tell your story… (leave a blank line between paragraphs)"
          aria-invalid={errors.content ? true : undefined}
          className="mt-6 min-h-[50vh] w-full resize-none overflow-hidden border-0 bg-transparent font-serif text-xl leading-[1.75] text-neutral-800 outline-none placeholder:text-neutral-300"
        />
        {errors.content && <p className="mt-1 text-sm text-red-600">{errors.content}</p>}
        <p className="mt-6 text-xs text-neutral-400">
          {words} {words === 1 ? "word" : "words"} · {readingMinutes(content || " ")} min read
        </p>
      </form>
    );
  }

  return (
    <>
      <Header actions={actions} />
      <main className="mx-auto max-w-[740px] px-4 sm:px-6">
        {body}
        {load.status !== "ready" && (
          <p className="text-center">
            <Link to="/" className="text-sm text-neutral-500 underline">
              Back to home
            </Link>
          </p>
        )}
      </main>
    </>
  );
}
