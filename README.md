# Medium Clone

A Medium-style blogging platform with a clean, distraction-free reading and writing experience. The API is a **Hono** app on **Cloudflare Workers** that stores data in **PostgreSQL** through **Prisma**. The frontend is **React + TypeScript + Tailwind CSS**. Request schemas are shared between both through a small `common` workspace package.

## Features

- **Accounts**: sign up and sign in with email and password. Passwords are hashed with PBKDF2-SHA256 (Web Crypto, built into Workers), and sessions use 7-day JWTs (HS256) sent as `Authorization: Bearer <token>`.
- **Writing**: a distraction-free editor with an auto-growing title and body, word count and reading time, **Publish** or **Save draft**, and a warning before leaving with unsaved changes.
- **Editing and deleting**: only the author can change or delete a story (`403` for anyone else). Edit pages for other people's stories show a clear message.
- **Drafts**: drafts are visible only to their author and never appear in the feed.
- **Reading**: a public feed (newest first, paginated) and story pages with serif typography, paragraphs, author, date and reading time.
- **Your stories**: published and draft tabs with edit and delete actions.
- **Shared validation**: Zod schemas in `common/` validate requests on the API and forms in the UI, with the same messages.
- **Robust UI**: loading skeletons, empty states, error states with retry, a not-found page, automatic sign-out on expired sessions, and a responsive layout.
- **Upgrade path**: accounts created by the first version (which stored plain-text passwords) are re-hashed automatically on their next sign-in, and a migration keeps existing posts visible.

## Architecture

```mermaid
flowchart LR
    subgraph Browser
        UI[React SPA<br/>feed · story · editor · your stories]
    end

    subgraph CF[Cloudflare Worker]
        H[Hono app<br/>secure headers · CORS · errors]
        AUTH[JWT auth<br/>required / optional]
        R1[/api/v1/user/]
        R2[/api/v1/blog/]
        S[Store interface]
        P[Prisma Client<br/>+ node-postgres adapter]
    end

    DB[(PostgreSQL<br/>User · Blog)]
    C[common/<br/>Zod schemas + types]

    UI -- "fetch JSON (Bearer JWT)" --> H --> AUTH --> R1 & R2 --> S --> P -- "TCP (nodejs_compat)" --> DB
    C -. validates .-> R1 & R2
    C -. validates .-> UI
```

- Routes depend on a small `Store` interface. In production it is implemented with Prisma; the tests use an in-memory implementation, so they need no database.
- Workers cannot reuse database connections between requests, so a Prisma client with the `@prisma/adapter-pg` driver adapter is created per request and closed after the response (`waitUntil`).
- Secrets (`DATABASE_URL`, `JWT_SECRET`) come from `.dev.vars` locally and from Wrangler secrets in production. Nothing secret is stored in `wrangler.toml`.

## Tech stack

| Part | Technologies |
|---|---|
| API | Hono 4, Cloudflare Workers (Wrangler 4, `nodejs_compat`), Prisma 7 (`prisma-client` generator, `workerd` runtime, `@prisma/adapter-pg`), PostgreSQL, TypeScript |
| Web | React 19, React Router 7, Vite 8, Tailwind CSS 4, TypeScript |
| Shared | Zod 4 schemas and TypeScript types (`@medium/common`, an npm workspace) |
| Quality | Vitest, Testing Library, ESLint (typescript-eslint), GitHub Actions |
| Optional | Docker, Docker Compose |

## Project structure

```
Medium/
├── package.json              # npm workspaces: common, backend, frontend
├── common/
│   └── src/index.ts          # Zod schemas, API types, readingMinutes(), excerpt()
├── backend/
│   ├── src/
│   │   ├── index.ts          # Worker entry: createApp + Prisma store
│   │   ├── app.ts            # Hono app: headers, CORS, store per request, errors
│   │   ├── routes/           # user.ts (signup, signin, me), blog.ts (feed, CRUD, drafts)
│   │   ├── lib/              # auth (JWT), password (PBKDF2), validation, errors, presenters
│   │   └── store/            # Store interface + Prisma implementation
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/       # initial schema + timestamps/indexes/cascade
│   ├── prisma.config.ts      # Prisma CLI config (reads .dev.vars)
│   ├── wrangler.toml         # Worker config (no secrets)
│   ├── .dev.vars.example
│   └── test/                 # API tests with an in-memory store
├── frontend/
│   ├── src/
│   │   ├── api/client.ts     # typed fetch client, token storage, 401 handling
│   │   ├── auth/             # AuthContext, route guards
│   │   ├── components/       # Header, PostCard, UI kit
│   │   └── pages/            # Home, PostPage, Editor, MyStories, AuthPage
│   └── vite.config.ts        # dev proxy /api → wrangler dev (:8787)
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Prerequisites

- **Node.js 22.12+** (or 20.19+) and npm
- **PostgreSQL 14+**, local or hosted (any PostgreSQL that accepts TCP connections, e.g. Neon or Supabase)
- For deployment: a **Cloudflare account** (the free plan is enough)
- Optional: Docker with Docker Compose

## Local setup (without Docker)

### 1. Install

```bash
git clone https://github.com/iSouvikKhan/Medium.git
cd Medium
npm install          # installs all workspaces and generates the Prisma client
```

### 2. Create a database

**Windows**: install PostgreSQL from https://www.postgresql.org/download/windows/, then in *SQL Shell (psql)*:

```sql
CREATE USER medium WITH PASSWORD 'medium';
CREATE DATABASE medium OWNER medium;
```

**Linux**: `sudo apt install postgresql`, then `sudo -u postgres psql` and run the same two statements.
**macOS**: `brew install postgresql@17 && brew services start postgresql@17`, then `psql postgres` and run the same statements.

### 3. Configure the API

**Windows (PowerShell)**

```powershell
copy backend\.dev.vars.example backend\.dev.vars
```

**Linux / macOS**

```bash
cp backend/.dev.vars.example backend/.dev.vars
```

Edit `backend/.dev.vars`: set `DATABASE_URL` (e.g. `postgresql://medium:medium@localhost:5432/medium`) and a random `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Apply migrations

```bash
npm run db:migrate -w backend      # prisma migrate deploy (reads backend/.dev.vars)
```

### 5. Run

```bash
npm run dev
```

This starts:

- the API with **`wrangler dev`** on http://localhost:8787 (the Worker runs locally in `workerd`, with secrets from `.dev.vars`);
- the web app with Vite on http://localhost:5173. `/api` requests are proxied to `:8787`.

Run them separately if you prefer: `npm run dev -w backend` and `npm run dev -w frontend`.

## Running with Docker (optional)

```bash
# Linux/macOS
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") docker compose up --build
```

```powershell
# Windows PowerShell
$env:JWT_SECRET = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
docker compose up --build
```

- App: http://localhost:8080 (nginx serves the build and proxies `/api`)
- API (`wrangler dev` in a container): http://localhost:8787
- PostgreSQL: `localhost:5432` (user, password and database are all `medium`)

Migrations run automatically when the API container starts.

## Deploying to Cloudflare

### API (Worker)

1. Create a hosted PostgreSQL database and copy its connection string.
2. Apply the migrations to it. Set `DATABASE_URL` for this command only:
   ```bash
   # Linux/macOS
   DATABASE_URL="postgresql://..." npm run db:migrate -w backend
   # Windows PowerShell
   $env:DATABASE_URL="postgresql://..."; npm run db:migrate -w backend
   ```
3. Log in and store the secrets in Cloudflare:
   ```bash
   cd backend
   npx wrangler login
   npx wrangler secret put DATABASE_URL
   npx wrangler secret put JWT_SECRET
   ```
4. Set `CORS_ORIGINS` in `backend/wrangler.toml` to your frontend URL (comma-separated if several), for example `https://medium-clone.pages.dev`.
5. Deploy:
   ```bash
   npm run deploy        # wrangler deploy --minify
   ```
   Wrangler prints the Worker URL, for example `https://medium-api.<your-subdomain>.workers.dev`.

To check the bundle without deploying: `npx wrangler deploy --dry-run --outdir dist`.

### Web app (Cloudflare Pages)

```bash
# from the repository root; point the build at your Worker
VITE_API_URL=https://medium-api.<your-subdomain>.workers.dev npm run build -w frontend
npx wrangler pages deploy frontend/dist --project-name medium-clone
```

On Windows PowerShell, set `$env:VITE_API_URL="https://..."` before `npm run build -w frontend`. Pages serves `index.html` for unknown paths, so client-side routes such as `/blog/1` work on refresh. Any other static host also works if it rewrites unknown paths to `index.html`.

## Environment variables

API (`backend/.dev.vars` locally, Wrangler secrets and vars in production):

| Variable | Kind | Description |
|---|---|---|
| `DATABASE_URL` | secret | PostgreSQL connection string (also used by the Prisma CLI) |
| `JWT_SECRET` | secret | Secret for signing JWTs. Use a long random string. |
| `CORS_ORIGINS` | var (`wrangler.toml`) | Comma-separated allowed browser origins. Default `http://localhost:5173`. |

If a secret is missing, the API answers `500 {"message": "Server is not configured"}` and logs which variables to set.

Web (`frontend/.env`, optional, see [`frontend/.env.example`](frontend/.env.example)):

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | empty (same origin) | API base URL for production builds |
| `VITE_PROXY_TARGET` | `http://localhost:8787` | Dev-server proxy target |

## API endpoints

Base path `/api/v1`. "Auth" means `Authorization: Bearer <token>` is required.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/user/signup` | no | `{ username (email), password (8+ chars), name }` → `201 { token, user }`. `409` if the email exists. |
| `POST` | `/user/signin` | no | `{ username, password }` → `{ token, user }`. `401` on bad credentials. |
| `GET` | `/user/me` | yes | `{ user }` |
| `GET` | `/blog/bulk?page=1&pageSize=10` | no | Published stories, newest first: `{ items, page, pageSize, total, totalPages }` |
| `GET` | `/blog/mine` | yes | The caller's stories, including drafts: `{ items }` |
| `GET` | `/blog/:id` | optional | `{ post }`. Drafts are only returned to their author; otherwise `404`. |
| `POST` | `/blog` | yes | `{ title, content, published? = true }` → `201 { post }` |
| `PUT` | `/blog/:id` | yes (author) | `{ title?, content?, published? }` → `{ post }`. `403` if not the author. |
| `DELETE` | `/blog/:id` | yes (author) | `204`. `403` if not the author. |

Stories in responses include `id, title, excerpt, readingMinutes, published, createdAt, updatedAt, author { id, name }`, and `content` on single-story responses. Errors are `{ "message": "...", "details"?: [{ "field", "message" }] }` with `400` (validation or malformed JSON), `401`, `403`, `404`, `409` or `500`.

## Testing

```bash
npm test            # all workspaces
npm run typecheck
npm run lint
npm run build
```

- **common**: schema normalisation and limits, reading time and excerpts.
- **backend** (Vitest, in-memory store, no database or Workers runtime needed): PBKDF2 hashing and legacy-password upgrade, sign-up/sign-in (validation, duplicate emails, wrong passwords), missing, malformed, forged and expired tokens, the feed with pagination and ordering, private drafts, author-only edit and delete, invalid ids, CORS allow-list, hidden internal errors and missing-configuration handling.
- **frontend** (Vitest + Testing Library, `fetch` mocked): feed (content, empty, error with retry, pagination), story page (paragraphs, author-only actions, not found), auth (client-side validation, token storage and redirect, server errors, protected routes) and the editor (validation, publishing, editing someone else's story).

CI also bundles the Worker with `wrangler deploy --dry-run` on every push.

## Upgrading from the first version

- Run `npm run db:migrate -w backend`. The new migration adds timestamps, indexes and cascading deletes, and marks existing posts as published so they stay in the feed.
- Existing users can sign in with their old passwords. They are re-hashed automatically on first sign-in.
- Tokens are now returned as `{ token, user }` and sent as `Authorization: Bearer <token>`. Stories are updated through `PUT /blog/:id`, which replaces `PUT /blog` with the id in the body.
