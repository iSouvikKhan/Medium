import { signinInput, signupInput } from "@medium/common";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Wordmark } from "../components/Header";
import { Button, Field } from "../components/ui";

/** Sign-in and sign-up share one form; `mode` switches fields, copy and endpoint. */
export function AuthPage({ mode }: { mode: "signin" | "signup" }) {
  const isSignup = mode === "signup";
  const { startSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: "", username: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const check = isSignup ? signupInput.safeParse(form) : signinInput.safeParse(form);
    if (!check.success) {
      const map: Record<string, string> = {};
      for (const issue of check.error.issues) map[String(issue.path[0])] ??= issue.message;
      setErrors(map);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const data = isSignup ? await api.signup(signupInput.parse(form)) : await api.signin(signinInput.parse(form));
      startSession(data);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/signin" ? from : "/", { replace: true });
    } catch (err) {
      const apiErr = err as ApiError;
      setErrors(apiErr.fieldErrors());
      setError(apiErr.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#f7f4ed]">
      <div className="px-4 py-5 sm:px-6">
        <Link to="/" aria-label="Home">
          <Wordmark />
        </Link>
      </div>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-12">
        <div className="w-full max-w-md rounded-xl bg-white px-6 py-10 shadow-sm sm:px-10">
          <h1 className="text-center font-serif text-3xl text-neutral-950">{isSignup ? "Join the community." : "Welcome back."}</h1>
          <p className="mt-2 text-center text-sm text-neutral-500">
            {isSignup ? "Create an account to write and publish stories." : "Sign in to write and manage your stories."}
          </p>
          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
            {error && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {isSignup && <Field label="Name" name="name" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} maxLength={60} />}
            <Field label="Email" name="username" type="email" autoComplete="email" value={form.username} onChange={set("username")} error={errors.username} />
            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={form.password}
              onChange={set("password")}
              error={errors.password}
            />
            <Button type="submit" loading={submitting} className="w-full py-2.5">
              {isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-neutral-600">
            {isSignup ? "Already have an account? " : "No account? "}
            <Link to={isSignup ? "/signin" : "/signup"} className="font-semibold text-emerald-700 hover:underline">
              {isSignup ? "Sign in" : "Create one"}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
