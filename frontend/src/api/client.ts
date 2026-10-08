import type {
  AuthResponse,
  CreatePostInput,
  Paginated,
  Post,
  PostSummary,
  PublicUser,
  SigninInput,
  SignupInput,
  UpdatePostInput,
} from "@medium/common";

const BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const TOKEN_KEY = "medium.token";

export interface FieldError {
  field: string | null;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: FieldError[] = [],
  ) {
    super(message);
  }

  /** First message per field, for inline form errors. */
  fieldErrors(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const d of this.details) if (d.field && !map[d.field]) map[d.field] = d.message;
    return map;
  }
}

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function request<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const token = tokenStore.get();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "Can't reach the server. Is the API running?");
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(res.status, data.message ?? `Request failed (${res.status})`, data.details);
  }
  return data as T;
}

export const api = {
  signup: (body: SignupInput) => request<AuthResponse>("/user/signup", { method: "POST", body }),
  signin: (body: SigninInput) => request<AuthResponse>("/user/signin", { method: "POST", body }),
  me: () => request<{ user: PublicUser }>("/user/me"),
  feed: (page: number, signal?: AbortSignal) =>
    request<Paginated<PostSummary>>(`/blog/bulk?page=${page}&pageSize=10`, { signal }),
  myPosts: () => request<{ items: PostSummary[] }>("/blog/mine"),
  post: (id: number | string, signal?: AbortSignal) => request<{ post: Post }>(`/blog/${id}`, { signal }),
  createPost: (body: CreatePostInput) => request<{ post: Post }>("/blog", { method: "POST", body }),
  updatePost: (id: number, body: UpdatePostInput) => request<{ post: Post }>(`/blog/${id}`, { method: "PUT", body }),
  deletePost: (id: number) => request<void>(`/blog/${id}`, { method: "DELETE" }),
};
