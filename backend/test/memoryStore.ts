import { DuplicateUsernameError, type PostRecord, type Store, type UserRecord } from "../src/store/types";

/** In-memory Store used by the tests instead of PostgreSQL. */
export function createMemoryStore() {
  const users: UserRecord[] = [];
  const posts: Omit<PostRecord, "author">[] = [];
  let clock = Date.parse("2026-01-01T00:00:00Z");
  const tick = () => new Date((clock += 1000));

  const withAuthor = (p: Omit<PostRecord, "author">): PostRecord => {
    const u = users.find((x) => x.id === p.authorId)!;
    return { ...p, author: { id: u.id, name: u.name } };
  };

  const store: Store & { users_: UserRecord[]; closed: number } = {
    users_: users,
    closed: 0,
    users: {
      findByUsername: async (username) => users.find((u) => u.username === username) ?? null,
      findById: async (id) => users.find((u) => u.id === id) ?? null,
      async create(data) {
        if (users.some((u) => u.username === data.username)) throw new DuplicateUsernameError();
        const user = { id: users.length + 1, ...data };
        users.push(user);
        return user;
      },
      async updatePassword(id, password) {
        users.find((u) => u.id === id)!.password = password;
      },
    },
    posts: {
      async listPublished({ skip, take }) {
        const published = posts
          .filter((p) => p.published)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return { items: published.slice(skip, skip + take).map(withAuthor), total: published.length };
      },
      listByAuthor: async (authorId) => posts.filter((p) => p.authorId === authorId).map(withAuthor),
      async findById(id) {
        const p = posts.find((x) => x.id === id);
        return p ? withAuthor(p) : null;
      },
      async create(data) {
        const now = tick();
        const post = { id: posts.length + 1, ...data, createdAt: now, updatedAt: now };
        posts.push(post);
        return withAuthor(post);
      },
      async update(id, changes) {
        const p = posts.find((x) => x.id === id)!;
        Object.assign(p, changes, { updatedAt: tick() });
        return withAuthor(p);
      },
      async delete(id) {
        posts.splice(
          posts.findIndex((p) => p.id === id),
          1,
        );
      },
    },
    async close() {
      store.closed++;
    },
  };
  return store;
}
