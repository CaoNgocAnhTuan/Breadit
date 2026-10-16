# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Breadit is an X/Twitter clone built as an npm-workspaces monorepo:

- `apps/frontend` (`@breadit/frontend`): Next.js 15 App Router, React 19, TanStack Query, Tailwind, Socket.IO client
- `apps/backend` (`@breadit/backend`): NestJS 10 on **Fastify** (not Express), Prisma 6, PostgreSQL 16, Redis 7, Socket.IO
- `packages/shared` (`@breadit/shared`): shared TS types imported by the frontend. Its `types` point at `dist/`, so run `npm run build -w @breadit/shared` before typechecking or building the frontend.

`docs/` and `Latex/` hold the pre-thesis report and design material (ADRs, use cases, ERDs, k6 perf scripts). Do not move or edit them unless asked. Thesis-phase docs go in `.docs/` at the repo root. No application code lives in any of these folders.

## How to write

The author reads English as a second language (upper-intermediate). This applies to chat replies and to every doc you write or change (new thesis docs go in `.docs/`). In chat, talk like a thesis supervisor: explain, brainstorm, give an opinion.

- Short and direct. Give the answer first, then the reason. Add detail only when asked.
- Simple everyday words. If a word is rare or formal, use a simpler one.
- One idea per paragraph. Few headings and tables. Lists of 3–4 items at most.
- Project terms (cache, gateway, ADR) are fine. Explain a new technical word once, in one sentence.
- In docs, keep names, numbers and frozen values exact. Simpler words must not make the meaning vaguer.
- Brainstorming: one recommendation, at most two other options, then one question.
- Existing docs are not rewritten unless asked.

## Commands

Root `npm run dev|build|start|lint|typecheck` only targets the **frontend**. Use `-w @breadit/backend` for the backend.

```bash
docker compose up db redis -d          # Postgres on :5433, Redis on :6378
npm install                            # install first so npx uses the pinned Prisma 6, not the latest
npm run dev                            # frontend on :3000
npm run dev -w @breadit/backend        # backend on :4000 (nest start --watch)
npm run build -w @breadit/backend

npm run lint                           # next lint (frontend only)
npm run typecheck                      # tsc --noEmit (frontend only)

docker compose up --build              # full stack; backend runs `prisma migrate deploy` on start
make rebuild | backend-rebuild | frontend-rebuild | logs   # see Makefile
```

There is no test suite. The Husky pre-commit hook runs `lint-staged` (ESLint `--fix` on `apps/frontend/src/**`) and then `npm run typecheck`.

### Prisma

The schema is `apps/backend/prisma/schema.prisma`. The seed command is configured in the **root** `package.json`, so run Prisma from the repo root with `--schema`:

```bash
npx prisma migrate dev --name <name> --schema=apps/backend/prisma/schema.prisma
npx prisma generate --schema=apps/backend/prisma/schema.prisma
npx prisma db seed --schema=apps/backend/prisma/schema.prisma
npx prisma studio --schema=apps/backend/prisma/schema.prisma
```

- Because Docker deploys with `migrate deploy`, schema changes need a real migration. `db push` alone is not enough.
- Seed users: `admin` / `123456` (ADMIN role) and `user1`–`user5` / `password`.
- Migrations `*_data_humans_v1*` are data migrations that insert demo users `human01`–`human50` along with their posts. `datasets/humans_v1.sql` holds the same data for manual import (`npm run dataset:humans`, which is PowerShell plus `psql`).

### Env

Copy `.env.example` to `.env` (variables are documented in `README.md`). Nest's `ConfigModule` reads `.env` from the process cwd. `npm run dev -w @breadit/backend` runs in `apps/backend`, so put a `.env` there too or export the vars. Several code defaults use Docker hostnames (`redis://redis:6379`, `http://backend:4000`), so a missing env var on the host shows up as a connection failure.

## Architecture

### Request flow (frontend → backend)

The frontend has no database access or API routes of its own. All data comes from the Nest backend, and every backend route is under `/api/...`. The prefix is written into each `@Controller('api/...')`; there is no global prefix.

There are two fetch paths, and the right one depends on where the code runs:
- **Server components** use `serverFetch()` / `getSession()` from `src/lib/session.ts`. These call `BACKEND_INTERNAL_URL` and forward the incoming cookies manually.
- **Client components** use `api()` / `apiMultipart()` from `src/lib/api.ts`. These call `NEXT_PUBLIC_BACKEND_URL` with `credentials: 'include'`. For uploads, do not set `Content-Type` yourself.

`src/middleware.ts` only checks that the `breadit_session` cookie exists and redirects to `/sign-in` if it doesn't. The real validation happens on the backend. The main app lives in the `(board)` route group: a three-column layout with a server-side session/ban check and a `@modal` parallel route for compose. `admin-console/` is separate.

### Auth (backend `src/auth/`)

- The JWT is HS256 via `jose`, stored in the httpOnly cookie `breadit_session` with a 30-day expiry. Logout blacklists the token's `jti` in Redis (`auth:blacklist:<jti>`).
- Guards are composed per route with `@UseGuards(...)`. `JwtAuthGuard` or `OptionalJwtAuthGuard` must come first because they populate `req.user`. The others build on it:
  - `EmailVerifiedGuard`: blocks write actions until the email is verified.
  - `BannedUserGuard`: re-checks the DB because the JWT payload can be up to 30 days stale.
  - `RolesGuard` with `@Roles('ADMIN')`.
- Email (OTP verify, password reset) goes out over nodemailer SMTP from `AuthService`. OTP and reset codes are stored in the `VerificationToken` table, keyed by `email-verify:<email>` or `password-reset:<email>`.

### Real-time (`src/notifications/notifications.gateway.ts`)

There is a single Socket.IO gateway using the Redis adapter. It authenticates from the cookie in the handshake.
- Each user's socket joins a room named after their **username**: the client emits `newUser` from `components/Socket.tsx`.
- DMs use rooms named `conversation:<id>`, plus `startTyping`/`stopTyping` events.
- Backend services push events through `gateway.server.to(username).emit(...)`. `NotificationsService.emit()` persists a `Notification` row and then pushes `getNotification`. Self-notifications are skipped.
- When an admin bans a user, an `accountBanned` event forces a client-side logout.
- The frontend socket is a module singleton in `src/socket.ts`.

### Caching (`src/cache/cache.service.ts`)

Read-heavy endpoints cache JSON in Redis under `prefix:part:part…`. Invalidation is **version-based** rather than by deleting keys:
- Read paths include `cache.getNumber('v:user', [userId])` in their cache key.
- Write paths call `incrNumber('v:user', [userId])`, which orphans the old entries until their TTL expires.
- When you add a cached read, include the relevant version in the key and bump that version on every write that affects it.

`getOrSetJson` adds a stampede lock. Setting `REDIS_HTTP_CACHE_ENABLED=false` disables the JSON cache.

### Other cross-cutting pieces

- **Globals** (`main.ts`, `app.module.ts`):
  - `ValidationPipe({ whitelist: true, transform: true })`, so DTOs need `class-validator` decorators or their fields are stripped.
  - `AllExceptionsFilter`.
  - `ThrottlerGuard` backed by Redis.
  - A 500 MB body/multipart limit.
- **Uploads** (`src/uploads/`): if `CLOUDINARY_CLOUD_NAME` is set, files go to Cloudinary. Otherwise they go to local disk at `UPLOAD_DIR` and are served by `@fastify/static` at `/uploads/`. Images are re-encoded with `sharp`. New image hosts must also be added to `images.remotePatterns` in `apps/frontend/next.config.ts`.
- **Blocking** (`src/block/block.service.ts`): post, user, search, notification and message queries filter out blocked peers. New listing queries should do the same.
- Posts are soft-deleted (`deletedAt`). Hashtags are parsed from post text on write, and `@mentions` from both posts and comments.
