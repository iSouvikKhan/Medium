# Blog

A Medium-style blogging application. Users can sign up, sign in, browse posts, read a single post, and publish new posts. The project is split into three parts:

- **backend** - a REST API built with Hono that runs on Cloudflare Workers and stores data in PostgreSQL through Prisma (with Prisma Accelerate).
- **frontend** - a React + TypeScript single-page app built with Vite and styled with Tailwind CSS.
- **common** - a small shared package (`@souvik97381/medium-common`) with Zod schemas and TypeScript types used to validate request bodies on both sides.

## Features

- User sign up and sign in with JWT-based authentication
- Create and update blog posts (authenticated)
- List all posts and view a single post with its author's name (authenticated)
- Request validation with shared Zod schemas
- Loading skeletons and a spinner while data is fetched

## Tech Stack

| Part     | Technologies                                                        |
|----------|---------------------------------------------------------------------|
| Backend  | Hono, Cloudflare Workers (Wrangler), Prisma, Prisma Accelerate, PostgreSQL, TypeScript |
| Frontend | React 18, React Router, Axios, Vite, Tailwind CSS, TypeScript       |
| Common   | Zod, TypeScript                                                      |

## Project Structure

```
Blog/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # User and Blog models (PostgreSQL)
│   │   └── migrations/
│   ├── src/
│   │   ├── index.ts             # Hono app, CORS, route mounting
│   │   └── routes/
│   │       ├── user.ts          # /api/v1/user (signup, signin)
│   │       └── blog.ts          # /api/v1/blog (create, update, list, get)
│   ├── wrangler.toml            # Worker name and variables
│   └── package.json
├── common/
│   ├── src/index.ts             # Zod schemas and inferred types
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.tsx              # Routes
    │   ├── config.ts            # BACKEND_URL
    │   ├── hooks/index.ts       # useBlog, useBlogs
    │   ├── components/          # Appbar, Auth, BlogCard, FullBlog, Quote, ...
    │   └── pages/               # Signup, Signin, Blogs, Blog, Publish
    └── package.json
```

## API

All routes are prefixed with `/api/v1`. Blog routes require an `Authorization` header containing the JWT returned by sign up / sign in.

| Method | Route            | Description                                   |
|--------|------------------|-----------------------------------------------|
| POST   | `/user/signup`   | Create a user (`username` as email, `password` min 6 chars, optional `name`) and return a JWT |
| POST   | `/user/signin`   | Sign in with `username` and `password` and return a JWT |
| POST   | `/blog`          | Create a post (`title`, `content`)            |
| PUT    | `/blog`          | Update a post (`id`, `title`, `content`)      |
| GET    | `/blog/bulk`     | List all posts with author names              |
| GET    | `/blog/:id`      | Get a single post                             |

## Frontend Routes

| Path         | Page                       |
|--------------|----------------------------|
| `/signup`    | Sign up form               |
| `/signin`    | Sign in form               |
| `/blogs`     | List of all posts          |
| `/blog/:id`  | Single post                |
| `/publish`   | Write and publish a post   |

## Prerequisites

- Node.js and npm
- A PostgreSQL database
- A Prisma Accelerate connection string for that database (the backend uses the Prisma edge client)
- A Cloudflare account if you want to deploy the backend

## Setup

Clone the repository:

```bash
git clone https://github.com/iSouvikKhan/Blog.git
cd Blog
```

### Backend

```bash
cd backend
npm install
```

The Worker reads two variables: `DATABASE_URL` (the Prisma Accelerate URL) and `JWT_SECRET`. They are defined under `[vars]` in `backend/wrangler.toml`; replace them with your own values. You can also keep them out of version control by putting them in a `backend/.dev.vars` file (already ignored by `.gitignore`) for local development.

Prisma CLI commands such as migrations need a direct database connection string. Set it in your shell before running them:

```bash
# Linux / macOS
export DATABASE_URL="postgresql://..."

# Windows (PowerShell)
$env:DATABASE_URL="postgresql://..."
```

Then apply the migrations and generate the client:

```bash
npx prisma migrate deploy
npx prisma generate --no-engine
```

Run the API locally:

```bash
npm run dev
```

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

### Frontend

```bash
cd frontend
npm install
```

The API base URL is hardcoded in `frontend/src/config.ts` (`BACKEND_URL`). Change it to point at your own deployed Worker or to the local URL printed by `npm run dev` in the backend.

```bash
npm run dev       # start the Vite dev server
npm run build     # type-check and build for production
npm run preview   # preview the production build
npm run lint      # run ESLint
```

### Common

The shared schemas are published to npm as `@souvik97381/medium-common` and installed as a dependency by both the backend and frontend. If you change `common/src/index.ts`, build it with the TypeScript compiler (output goes to `common/dist`) and publish a new version:

```bash
cd common
npm install
npx -p typescript tsc
npm publish --access public
```

## Notes

- This is a learning project. Passwords are stored in plain text and the blog list has no pagination, so it is not intended for production use.
- The backend returns the token as `{ jwtToken, message }`, while the frontend's `Auth` component stores the whole response object in `localStorage`. If authenticated requests fail from the UI, store `response.data.jwtToken` instead.
