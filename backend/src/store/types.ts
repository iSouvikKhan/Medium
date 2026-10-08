/** Persistence contract used by the routes. Prisma implements it; tests use an in-memory fake. */

export interface UserRecord {
  id: number;
  username: string;
  name: string | null;
  password: string;
}

export interface PostRecord {
  id: number;
  title: string;
  content: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorId: number;
  author: { id: number; name: string | null };
}

export interface NewPost {
  authorId: number;
  title: string;
  content: string;
  published: boolean;
}

export type PostChanges = Partial<Pick<PostRecord, "title" | "content" | "published">>;

export class DuplicateUsernameError extends Error {
  constructor() {
    super("Username already exists");
  }
}

export interface Store {
  users: {
    findByUsername(username: string): Promise<UserRecord | null>;
    findById(id: number): Promise<UserRecord | null>;
    /** @throws DuplicateUsernameError */
    create(data: { username: string; name: string; password: string }): Promise<UserRecord>;
    updatePassword(id: number, password: string): Promise<void>;
  };
  posts: {
    listPublished(page: { skip: number; take: number }): Promise<{ items: PostRecord[]; total: number }>;
    listByAuthor(authorId: number): Promise<PostRecord[]>;
    findById(id: number): Promise<PostRecord | null>;
    create(data: NewPost): Promise<PostRecord>;
    update(id: number, changes: PostChanges): Promise<PostRecord>;
    delete(id: number): Promise<void>;
  };
  /** Releases connections once the response has been sent. */
  close(): Promise<void>;
}
