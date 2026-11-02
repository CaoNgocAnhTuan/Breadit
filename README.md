# Breadit

A full-stack X (Twitter) clone built with Next.js 15, NestJS, PostgreSQL, Redis, and Socket.IO. It is also the platform of a thesis on a **social-graph-aware "For You" feed** (see [Thesis](#thesis)).

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TanStack Query, Socket.IO client |
| Backend | NestJS 10 on Fastify, Prisma 6, JWT (httpOnly cookie) |
| Database | PostgreSQL 16 |
| Cache / Pub-Sub | Redis 7 |
| Media | sharp (image re-encode), local disk or Cloudinary |
| Email | nodemailer SMTP |
| Ranking (thesis) | `@breadit/ranking`, pure TypeScript, shared by the backend and the evaluation |

## Features

- **Auth** — register, email OTP verify, login, logout, forgot/reset password
- **Feeds** — "For You" (you and the people you follow, newest first), "Following", "Communities", and "Explore" (engagement score with time decay, at most 3 posts per author in a window)
- **Posts** — create with images/video, soft-delete, hashtag parsing, `@mentions`
- **Interactions** — like, repost, quote-repost, save, comment, share link
- **Profiles** — followers/following lists, post/replies/media/likes tabs
- **Search** — debounced dropdown across users, hashtags, and posts
- **Hashtag pages** — infinite-scroll feed per `#tag`
- **Communities** — join, post, approve or remove posts, moderators
- **Direct messages** and **real-time notifications** — Socket.IO gateway with a Redis adapter
- **Safety** — block, report, ban; admin console

## Thesis

The thesis adds a hybrid "For You" score: the Explore engagement score plus **follow trust** and **community affinity**, smoothed so that a new user still gets a personal feed. It is measured offline, without data leakage, on seeded synthetic worlds and on the real Digg 2009 dataset, and every number is reproducible.

| Read | What it covers |
|---|---|
| [docs/System_Architecture.md](docs/System_Architecture.md) | the proposed system, diagrams, the annotated directory tree |
| [docs/Guidance-Manual/](docs/Guidance-Manual/Guidance-Manual.md) | 10 topics in English and Vietnamese, from the problem to the defense questions |
| [.docs/super-plan.md](.docs/super-plan.md) | the thesis plan: research questions, phases, protocol, frozen values |
| [.docs/implementation-plan.md](.docs/implementation-plan.md) | module map, data contracts, task list |

## Getting Started

### Prerequisites

- Docker + Docker Compose
- Node.js **22**, the exact version in `.nvmrc` (v22.23.4). `.npmrc` has `engine-strict=true`, so another major version is refused. With nvm: `nvm use`.

### Quick start (Docker)

```bash
cp .env.example .env      # fill in JWT_SECRET and SMTP_* values
docker compose up --build # the backend runs `prisma migrate deploy` on start
```

Services:

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| PostgreSQL | localhost:5433 |
| Redis | localhost:6378 |

### Local dev (outside Docker)

```bash
# 1. Pinned Node and the database
nvm use
docker compose up db redis -d

# 2. Install dependencies, build the shared packages, generate the Prisma client
npm install
npm run build -w @breadit/shared
npm run build -w @breadit/ranking
npx prisma generate --schema=apps/backend/prisma/schema.prisma

# 3. Apply the migrations and seed
npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma
npx prisma db seed --schema=apps/backend/prisma/schema.prisma

# 4. Start both services (two terminals)
npm run dev                                  # frontend — port 3000
npm run dev -w @breadit/backend              # backend  — port 4000
```

The backend reads `.env` from its working directory (`apps/backend`), so put a `.env` there too or export the variables.

Do not use `prisma db push` or `npm run dev:reset`: the schema must come from the committed migrations, which also hold data migrations (Bugs Report R7).

Seed users: `admin` / `123456` (admin) and `user1`–`user50` / `password`.

### Environment variables

Copy `.env.example` to `.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `FRONTEND_URL` | Frontend origin, for CORS, Socket.IO and the password-reset link (default `http://localhost:3000`) |
| `JWT_SECRET` | Secret for signing JWT cookies (`openssl rand -base64 32`) |
| `SMTP_HOST` | SMTP server hostname (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (e.g. `587`) |
| `SMTP_USERNAME` | SMTP login / sender address |
| `SMTP_PASSWORD` | SMTP password (Gmail: use an App Password) |
| `SMTP_FROM` | From address for outgoing emails |
| `COOKIE_DOMAIN` | Cookie domain (leave empty for localhost) |
| `BACKEND_INTERNAL_URL` | SSR-to-backend URL (default `http://localhost:4000`) |
| `NEXT_PUBLIC_BACKEND_URL` | Browser-to-backend URL (default `http://localhost:4000`) |
| `UPLOAD_DIR` | Where uploaded files are stored when Cloudinary is off (set to `./uploads` for host dev) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Upload to Cloudinary when the cloud name is set; otherwise files go to `UPLOAD_DIR` |
| `REDIS_HTTP_CACHE_ENABLED` | `false` turns off the Redis JSON cache (default `true`) |

`STORAGE_DRIVER` is in `.env.example` but the code does not read it (Bugs Report R4).

## Project Structure

```
apps/
  frontend/        Next.js 15 — App Router, TanStack Query, Socket.IO client
  backend/         NestJS + Fastify — REST API, WebSocket gateway, Prisma
packages/
  shared/          Shared TypeScript types (Post, User, …)
  ranking/         Thesis ranking code: candidate pool, as-of features, 13 scorers, sort
eval/              Thesis evaluation: synthetic generator, Digg adapter, harness, statistics
datasets/          humans_v1.sql; raw/ holds hand-downloaded datasets (git-ignored)
docs/
  System_Architecture.md   the proposed system and the directory tree
  Guidance-Manual/         bilingual study guide for the thesis
  Pre-thesis/              the pre-thesis report material (frozen)
.docs/             Thesis working docs: plans, task folders, results
Latex/             Pre-thesis report template (frozen)
```

The full annotated tree is in [docs/System_Architecture.md §10](docs/System_Architecture.md).

## Useful Commands

```bash
# Prisma (always from the repo root with --schema)
npx prisma generate --schema=apps/backend/prisma/schema.prisma
npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma
npx prisma migrate dev --name <name> --schema=apps/backend/prisma/schema.prisma
npx prisma studio --schema=apps/backend/prisma/schema.prisma

# Tests
npm run test:backend                         # backend unit + integration tests (needs db and redis)
npm run test -w @breadit/ranking             # ranking package tests
npm run verify -w @breadit/eval              # eval typecheck + tests

# Thesis evaluation (no Docker needed; build @breadit/ranking first)
npm run gen -w @breadit/eval                 # the eight synthetic datasets
npm run adapt:digg -w @breadit/eval          # convert the Digg 2009 zips (see .docs/datasets.md §4)
npm run check -w @breadit/eval               # check every dataset
npm run harness -w @breadit/eval -- <runId>  # run eval/config/runs/<runId>.json

# Docker helpers (via Makefile)
make up                  # docker compose up -d
make down                # docker compose down
make logs                # follow all logs
make rebuild             # full rebuild of all images
make frontend-restart    # restart frontend container only
make backend-restart     # restart backend container only
```

## Roadmap

| Phase | Status | Theme |
|---|---|---|
| 0–5 | ✅ done | Foundation, auth, posts, interactions, real-time, discovery |
| 6–12 | ✅ done | Mentions, Safety, Profile edit, DMs, Communities, Admin console |
| Thesis P0–P10 | in progress | Social-graph-aware "For You" feed and its evaluation; status in [.docs/super-plan.md §4](.docs/super-plan.md) |
| 13 | future | Notification preferences & email digests |
