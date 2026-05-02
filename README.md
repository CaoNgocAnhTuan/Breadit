# Breadit

A full-stack X (Twitter) clone built with Next.js 15, NestJS, PostgreSQL, Redis, and Socket.IO.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router), TanStack Query, Socket.IO client |
| Backend | NestJS + Fastify, Prisma ORM, JWT (httpOnly cookie) |
| Database | PostgreSQL 16 |
| Cache / Pub-Sub | Redis 7 |
| Media | sharp (image re-encode), local disk / named Docker volume |
| Email | nodemailer SMTP |

## Features (Phases 0–5 complete)

- **Auth** — register, email OTP verify, login, logout, forgot/reset password
- **Feed** — paginated "For You" + "Explore" (trending by likes) tabs
- **Posts** — create with images/video, soft-delete, hashtag parsing
- **Interactions** — like, repost, quote-repost, save, comment, share link
- **Profiles** — followers/following lists, post/replies/media/likes tabs
- **Search** — debounced dropdown across users, hashtags, and posts
- **Hashtag pages** — infinite-scroll feed per `#tag`
- **Real-time** — Socket.IO gateway on the backend; live notification push
- **Follow** — toggle with optional notify flag

## Getting Started

### Prerequisites

- Docker + Docker Compose
- Node.js 20+ (for local dev outside Docker)

### Quick start (Docker)

```bash
cp .env.example .env      # fill in JWT_SECRET and SMTP_* values
docker compose up --build
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
# 1. Start DB + Redis only
docker compose up db redis -d

# 2. Install dependencies
npm install

# 3. Push schema and seed
npm run dev:reset

# 4. Start both services in parallel (two terminals)
npm run dev                                  # frontend — port 3000
npm run dev -w @breadit/backend              # backend  — port 4000
```

### Environment variables

Copy `.env.example` to `.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for signing JWT cookies (`openssl rand -base64 32`) |
| `SMTP_HOST` | SMTP server hostname (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (e.g. `587`) |
| `SMTP_USERNAME` | SMTP login / sender address |
| `SMTP_PASSWORD` | SMTP password (Gmail: use an App Password) |
| `SMTP_FROM` | From address for outgoing emails |
| `COOKIE_DOMAIN` | Cookie domain (leave empty for localhost) |
| `BACKEND_INTERNAL_URL` | SSR-to-backend URL (default `http://localhost:4000`) |
| `NEXT_PUBLIC_BACKEND_URL` | Browser-to-backend URL (default `http://localhost:4000`) |
| `UPLOAD_DIR` | Where uploaded files are stored (set to `./uploads` for host dev) |

## Project Structure

```
apps/
  frontend/   Next.js 15 — App Router, TanStack Query, Socket.IO client
  backend/    NestJS + Fastify — REST API, WebSocket gateway, Prisma
packages/
  shared/     Shared TypeScript types (Post, User, …)
docs/
  planning/   Implementation plan, use-case spec, architecture notes
```

## Useful Commands

```bash
# Prisma
npx prisma generate --schema=apps/backend/prisma/schema.prisma
npx prisma db push --schema=apps/backend/prisma/schema.prisma
npx prisma studio --schema=apps/backend/prisma/schema.prisma
npx prisma migrate dev --name <name> --schema=apps/backend/prisma/schema.prisma

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
| 13 | future | Notification preferences & email digests |
