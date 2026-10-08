import { describe, expect, it } from "vitest";
import {
  createPostInput,
  excerpt,
  paginationQuery,
  postIdParam,
  readingMinutes,
  signupInput,
  updatePostInput,
} from "./index";

describe("schemas", () => {
  it("normalises signup input", () => {
    const parsed = signupInput.parse({ username: " Ada@Example.COM ", password: "longenough", name: " Ada " });
    expect(parsed).toEqual({ username: "ada@example.com", password: "longenough", name: "Ada" });
  });

  it("rejects short passwords and missing names", () => {
    const result = signupInput.safeParse({ username: "ada@example.com", password: "short", name: "" });
    expect(result.success).toBe(false);
  });

  it("defaults new posts to published and trims fields", () => {
    expect(createPostInput.parse({ title: "  Hello ", content: " Body " })).toEqual({
      title: "Hello",
      content: "Body",
      published: true,
    });
    expect(createPostInput.safeParse({ title: "   ", content: "x" }).success).toBe(false);
  });

  it("requires at least one field to update", () => {
    expect(updatePostInput.safeParse({}).success).toBe(false);
    expect(updatePostInput.safeParse({ published: false }).success).toBe(true);
  });

  it("coerces and bounds pagination and ids", () => {
    expect(paginationQuery.parse({ page: "2", pageSize: "5" })).toEqual({ page: 2, pageSize: 5 });
    expect(paginationQuery.parse({})).toEqual({ page: 1, pageSize: 10 });
    expect(paginationQuery.safeParse({ pageSize: "500" }).success).toBe(false);
    expect(postIdParam.safeParse({ id: "abc" }).success).toBe(false);
    expect(postIdParam.parse({ id: "42" }).id).toBe(42);
  });
});

describe("helpers", () => {
  it("estimates reading time from words", () => {
    expect(readingMinutes("one two three")).toBe(1);
    expect(readingMinutes("word ".repeat(900))).toBe(4);
  });

  it("cuts excerpts on word boundaries", () => {
    expect(excerpt("short text")).toBe("short text");
    const long = excerpt("lorem ipsum ".repeat(50), 40);
    expect(long.endsWith("…")).toBe(true);
    expect(long.length).toBeLessThanOrEqual(41);
  });
});
