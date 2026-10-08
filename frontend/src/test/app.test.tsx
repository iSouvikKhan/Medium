import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { paragraphs } from "../utils/format";

type Handler = (method: string, path: string, body: unknown) => [number, unknown] | Promise<[number, unknown]>;

function mockApi(handler: Handler) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    const path = String(url).replace(/^.*\/api\/v1/, "");
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const [status, json] = await handler(init?.method ?? "GET", path, body);
    return new Response(status === 204 ? null : JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
  });
}

function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  );
}

const ADA = { id: 1, name: "Ada Lovelace", username: "ada@example.com" };
const post = (over: Record<string, unknown> = {}) => ({
  id: 7,
  title: "On engines",
  excerpt: "The engine might compose music…",
  content: "The engine might compose music.\n\nSecond paragraph here.",
  readingMinutes: 1,
  published: true,
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
  author: { id: 1, name: "Ada Lovelace" },
  ...over,
});

describe("home feed", () => {
  it("shows stories with author, date and reading time", async () => {
    mockApi(() => [200, { items: [post()], page: 1, pageSize: 10, total: 1, totalPages: 1 }]);
    renderAt("/");
    expect(await screen.findByText("On engines")).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "Mar 1, 2026 · 1 min read")).toBeInTheDocument();
    expect(screen.getByText("Stories worth reading.")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    mockApi(() => [200, { items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 }]);
    renderAt("/");
    expect(await screen.findByText("No stories yet")).toBeInTheDocument();
  });

  it("shows errors with a retry", async () => {
    let calls = 0;
    mockApi(() => (++calls === 1 ? [500, { message: "Something went wrong. Please try again." }] : [200, { items: [post()], page: 1, pageSize: 10, total: 1, totalPages: 1 }]));
    renderAt("/");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("On engines")).toBeInTheDocument();
  });

  it("paginates", async () => {
    const fetch = mockApi((_m, path) => [200, { items: [post({ title: path.includes("page=2") ? "Older one" : "Newer one" })], page: path.includes("page=2") ? 2 : 1, pageSize: 10, total: 11, totalPages: 2 }]);
    renderAt("/");
    await screen.findByText("Newer one");
    await userEvent.click(screen.getByRole("button", { name: "Older →" }));
    expect(await screen.findByText("Older one")).toBeInTheDocument();
    expect(String(fetch.mock.calls.at(-1)?.[0])).toContain("page=2");
  });
});

describe("reading", () => {
  it("renders paragraphs and hides author actions from readers", async () => {
    mockApi(() => [200, { post: post() }]);
    renderAt("/blog/7");
    expect(await screen.findByRole("heading", { name: "On engines" })).toBeInTheDocument();
    expect(screen.getByText("Second paragraph here.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("shows edit and delete to the author", async () => {
    localStorage.setItem("medium.token", "jwt");
    mockApi((_m, path) => (path === "/user/me" ? [200, { user: ADA }] : [200, { post: post() }]));
    renderAt("/blog/7");
    expect(await screen.findByRole("link", { name: "Edit" })).toHaveAttribute("href", "/edit/7");
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("shows not found for missing stories", async () => {
    mockApi(() => [404, { message: "Story not found" }]);
    renderAt("/blog/999");
    expect(await screen.findByText("Story not found")).toBeInTheDocument();
  });
});

describe("auth", () => {
  it("validates the sign-up form before calling the API", async () => {
    const fetch = mockApi(() => [200, {}]);
    renderAt("/signup");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Enter your name")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stores the token (not the whole response) and goes home after sign in", async () => {
    mockApi((_m, path) =>
      path === "/user/signin" ? [200, { token: "jwt-token", user: ADA }] : [200, { items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 }],
    );
    renderAt("/signin");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("No stories yet")).toBeInTheDocument();
    expect(localStorage.getItem("medium.token")).toBe("jwt-token");
  });

  it("shows server errors on failed sign in", async () => {
    mockApi(() => [401, { message: "Incorrect email or password" }]);
    renderAt("/signin");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
  });

  it("redirects anonymous writers to sign in", async () => {
    mockApi(() => [200, {}]);
    renderAt("/write");
    expect(await screen.findByText("Welcome back.")).toBeInTheDocument();
  });
});

describe("editor", () => {
  it("validates and publishes a new story", async () => {
    localStorage.setItem("medium.token", "jwt");
    const fetch = mockApi((method, path, body) => {
      if (path === "/user/me") return [200, { user: ADA }];
      if (method === "POST" && path === "/blog") {
        expect(body).toEqual({ title: "My title", content: "Body text", published: true });
        return [201, { post: post({ id: 8, title: "My title", content: "Body text" }) }];
      }
      return [200, { post: post({ id: 8, title: "My title", content: "Body text" }) }];
    });
    renderAt("/write");

    await userEvent.click(await screen.findByRole("button", { name: "Publish" }));
    expect(screen.getByText("Add a title")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Title"), "My title");
    await userEvent.type(screen.getByLabelText("Story"), "Body text");
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByRole("heading", { name: "My title" })).toBeInTheDocument();
    await waitFor(() => expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
  });

  it("does not let others edit a story", async () => {
    localStorage.setItem("medium.token", "jwt");
    mockApi((_m, path) => (path === "/user/me" ? [200, { user: { ...ADA, id: 2 } }] : [200, { post: post() }]));
    renderAt("/edit/7");
    expect(await screen.findByText("You can only edit your own stories")).toBeInTheDocument();
  });
});

describe("paragraphs", () => {
  it("splits on blank lines", () => {
    expect(paragraphs("a\nb\n\n\nc  \r\n\r\nd")).toEqual(["a\nb", "c", "d"]);
  });
});
