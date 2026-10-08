import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../generated/prisma/client";
import type { Bindings } from "../types";
import { DuplicateUsernameError, type PostRecord, type Store } from "./types";

const postInclude = { author: { select: { id: true, name: true } } } as const;

/**
 * Prisma-backed store. Workers cannot share database connections between requests, so a
 * client (with the node-postgres driver adapter) is created per request and closed after
 * the response is sent.
 */
export function createPrismaStore(env: Bindings): Store {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });

  return {
    users: {
      findByUsername: (username) => prisma.user.findUnique({ where: { username } }),
      findById: (id) => prisma.user.findUnique({ where: { id } }),
      async create(data) {
        try {
          return await prisma.user.create({ data });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            throw new DuplicateUsernameError();
          }
          throw err;
        }
      },
      async updatePassword(id, password) {
        await prisma.user.update({ where: { id }, data: { password } });
      },
    },
    posts: {
      async listPublished({ skip, take }) {
        const where = { published: true };
        const [items, total] = await prisma.$transaction([
          prisma.blog.findMany({ where, include: postInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take }),
          prisma.blog.count({ where }),
        ]);
        return { items: items as PostRecord[], total };
      },
      async listByAuthor(authorId) {
        return (await prisma.blog.findMany({
          where: { authorId },
          include: postInclude,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        })) as PostRecord[];
      },
      async findById(id) {
        return (await prisma.blog.findUnique({ where: { id }, include: postInclude })) as PostRecord | null;
      },
      async create(data) {
        return (await prisma.blog.create({ data, include: postInclude })) as PostRecord;
      },
      async update(id, changes) {
        return (await prisma.blog.update({ where: { id }, data: changes, include: postInclude })) as PostRecord;
      },
      async delete(id) {
        await prisma.blog.delete({ where: { id } });
      },
    },
    close: () => prisma.$disconnect(),
  };
}
