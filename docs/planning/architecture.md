# Architecture — Breadit (Frontend / Backend split)

> Companion to `docs/planning/usecase.md` and `docs/planning/implementation_plan.md`.
> Describes the target system after splitting the current single-Next.js app into two independently containerised services.

---

## 1. Goals

- One Next.js process for UI / SSR (**frontend**), one NestJS process for API + realtime + persistence (**backend**).
- Each service has its own Dockerfile and runs in its own container.
- Every use case in `usecase.md` (v1 + future) is reachable through this architecture without further restructure.
- Horizontal scale: every stateful concern moves out of process memory into Postgres or Redis.

## 2. High-level topology

```
                    ┌──────────────────────────────┐
                    │         Browser (SPA+SSR)    │
                    └──────────────┬───────────────┘
                          httpOnly cookie (JWT)
                                   │
              ┌────────────────────┴───────────────────┐
              │ apps/frontend  — Next.js 15 (port 3000) │
              │  • Pages / Server Components            │
              │  • Components, providers, client socket │
              │  • SSR fetch → backend (cookie fwd)     │
              └────────────────────┬───────────────────┘
                                   │ REST + WS
                                   │
              ┌────────────────────┴───────────────────┐
              │ apps/backend  — NestJS/Fastify (4000)  │
              │  • REST controllers (/api/*)            │
              │  • Socket.IO gateway (/socket.io)       │
              │  • Auth: bcrypt + jose (JWT issuer)     │
              │  • Prisma (Postgres)                    │
              │  • Resend (email), sharp (uploads)      │
              └──┬───────────────┬───────────────┬──────┘
                 │               │               │
        ┌────────▼─────┐  ┌──────▼─────┐  ┌─────▼──────┐
        │ Postgres 16  │  │  Redis 7   │  │ uploads vol│
        │ (data)       │  │ (cache+pub)│  │ (media)    │
        └──────────────┘  └────────────┘  └────────────┘
```

## 3. Repo layout (npm workspaces monorepo)

```
breadit/
├── apps/
│   ├── frontend/         # Next.js 15 (UI only)
│   │   ├── src/
│   │   ├── public/
│   │   ├── next.config.ts
│   │   └── Dockerfile
│   └── backend/          # NestJS + Fastify
│       ├── src/
│       ├── prisma/
│       └── Dockerfile
├── packages/
│   └── shared/           # zod schemas, DTO types, constants
├── docker-compose.yml    # 4 services: db, redis, backend, frontend
├── package.json          # workspaces root
└── docs/
```

## 4. Service responsibilities

### 4.1 `apps/frontend` (Next.js)

- Pages & layouts: route groups `(board)`, `sign-in`, `sign-up`, `verify`, `forgot-password`, `reset`.
- Components: `Post`, `Feed`, `InfiniteFeed`, `LeftBar`, `RightBar`, `Recommendations`, `Notification`, `Socket`, `PostInteractions`, etc.
- Client state: TanStack Query, Socket.IO client.
- SSR data flow: server components call `fetch(BACKEND_INTERNAL_URL + ...)` and forward the request cookie via `next/headers`.
- Middleware (`src/middleware.ts`): only cookie-presence check → redirect to `/sign-in` for protected routes. The verified-write gate is no longer the frontend's job.
- **Does not** import Prisma, NextAuth, Resend, Sharp, or talk to the database.

### 4.2 `apps/backend` (NestJS + Fastify)

Modules:

| Module | Responsibility |
|---|---|
| `AuthModule` | register, login, logout, me, verify, forgot/reset password; JWT issuer (`jose`), bcrypt password hashing, cookie helper |
| `MailModule` | Resend client, template rendering for verification + reset emails |
| `UsersModule` | profile reads, follow toggle, block (Phase 7), recommendations |
| `PostsModule` | feed (followed + public), post detail with thread, post create, soft-delete |
| `InteractionsModule` | like / save / repost toggles |
| `CommentsModule` | reply create |
| `UploadsModule` | multipart receive, sharp pipeline, write to volume, serve `/uploads/*` |
| `NotificationsModule` | Socket.IO gateway, persisted notifications (Phase 6), Redis pub/sub |
| `HealthModule` | `GET /api/health` for compose healthcheck |

Cross-cutting:

- `JwtAuthGuard` — cookie → JWT verification → `req.user` injection.
- `EmailVerifiedGuard` — applied to write endpoints (`POST/PUT/PATCH/DELETE`) to enforce the verification rule from Phase 1.
- `@nestjs/throttler` with Redis store — rate limit on `/api/auth/*` (strict) and writes (lenient).
- `class-validator` DTOs at the controller boundary; the same shapes are exposed as zod schemas in `packages/shared` for the frontend.

### 4.3 `packages/shared`

- Zod schemas for request/response payloads (post, comment, auth).
- TS types / enums (e.g. `NotificationType`, `ImgType`).
- Constants — `POST_DESC_MAX = 140`, route names, cookie name `breadit_session`.

## 5. Auth flow (replaces NextAuth)

1. `POST /api/auth/register` → create user (`emailVerified: null`), create verification token (24h), send email.
2. `POST /api/auth/login` → bcrypt-verify password, sign JWT `{ sub, username, emailVerified }` (7d), `Set-Cookie: breadit_session=...; HttpOnly; SameSite=Lax; Secure (prod); Domain=COOKIE_DOMAIN`.
3. `GET /api/auth/me` → returns `{ user } | null`. Frontend SSR uses this to populate the equivalent of the old `auth()` call.
4. `POST /api/auth/logout` → clear cookie.
5. `GET /api/auth/verify?token=…` → consume token, set `emailVerified`, 302 → `${FRONTEND_URL}/sign-in?verified=1`.
6. `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` — same logic as Phase 1 today, just on the backend.

Frontend pages keep their UX; their forms call the backend with `credentials: "include"`. NextAuth, `@auth/prisma-adapter`, and the `/api/auth/[...nextauth]` route are removed.

## 6. Realtime

- Backend exposes `/socket.io` on the same Fastify instance via `@nestjs/websockets` + `@nestjs/platform-socket.io`.
- Existing event contract preserved for now: `newUser`, `sendNotification`, `getNotification`, `disconnect`.
- Online users move from in-process `Map` to Redis: `SET breadit:online:<username> "1" EX 300`, refreshed on heartbeat.
- `@socket.io/redis-adapter` lets the backend run >1 replica without losing routing.

## 7. Data layer

### 7.1 Postgres 16

- Switch from MySQL: `prisma/schema.prisma` `provider = "postgresql"`. Migrations regenerated from scratch (no production data).
- Existing models (`User`, `Post`, `Follow`, `Like`, `SavedPosts`, `Account`, `Session`, `VerificationToken`) carry over verbatim.
- Future-phase models land natively: `Hashtag`, `PostTag` (Phase 5); `Notification` (Phase 6); `Block`, `Report` (Phase 7); `Community*` (Phase 11).
- Postgres `tsvector` + GIN unblocks UC-G-04 / UC-U-FD-03 search without bolt-on indexes.

### 7.2 Redis 7

- DB 0 — Socket.IO adapter (pub/sub channels).
- DB 1 — `@nestjs/throttler` rate-limit storage.
- DB 2 — application cache (public feed pages, recommendations) with TTL 30–60s; invalidated by post create/delete events.

## 8. Media / uploads

- `POST /api/uploads` — multipart, body `{ file, imgType: "original" | "square" | "wide" }`. Sharp pipeline identical to current `src/utils.ts`. Writes to `/var/lib/breadit/uploads/<uuid>.<ext>`.
- Backend serves `/uploads/*` via Fastify static middleware.
- Frontend `Image.tsx` / `Video.tsx` resolve URLs as `${NEXT_PUBLIC_BACKEND_URL}/uploads/<file>`.
- Volume `uploads_data` mounts into the backend container.

## 9. Environment matrix

| Var | Frontend | Backend |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | ✓ (browser) | — |
| `BACKEND_INTERNAL_URL` | ✓ (SSR, e.g. `http://backend:4000`) | — |
| `FRONTEND_URL` | — | ✓ (CORS, email links) |
| `DATABASE_URL` (Postgres) | — | ✓ |
| `REDIS_URL` | — | ✓ |
| `JWT_SECRET` | — | ✓ |
| `COOKIE_DOMAIN` | — | ✓ |
| `RESEND_API_KEY`, `EMAIL_FROM` | — | ✓ |
| `AUTH_SECRET`, `AUTH_URL` | *removed* | — |

## 10. Containers

`docker-compose.yml` declares 4 services:

| Service | Image | Port | Depends on |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5433 | — |
| `redis` | `redis:7-alpine` | 6378 | — |
| `backend` | built from `apps/backend/Dockerfile` | 4000 | db (healthy), redis |
| `frontend` | built from `apps/frontend/Dockerfile` | 3000 | backend (healthy) |

- Backend command: `prisma migrate deploy && node dist/main.js`.
- Frontend command: `next start`.
- `uploads_data` volume mounted into the backend.
- Each Dockerfile is a multi-stage build (deps → build → runtime).

## 11. Use-case alignment

| UC group | Owning module(s) |
|---|---|
| UC-G-01..04 (guest read) | `PostsModule`, `UsersModule`, search (Phase 5) — frontend SSR with no cookie still works |
| UC-G-05..06, UC-E-01..02 (auth/email) | `AuthModule`, `MailModule` |
| UC-U-FD-01..04 (feed/discovery) | `PostsModule`, `UsersModule` |
| UC-U-PM-01..05 (post mgmt) | `PostsModule`, `UploadsModule`, `EmailVerifiedGuard` |
| UC-U-PI-01..05 (interactions) | `InteractionsModule`, `CommentsModule` |
| UC-U-SG-01..02 (follow/block) | `UsersModule` |
| UC-U-PR-01..04 (profile) | `UsersModule` |
| UC-U-NT-01..04 (notifications, Phase 6) | `NotificationsModule` + Socket.IO gateway + Redis pub/sub |
| UC-U-MG-01..02 (DM, future) | new `MessagesModule`, same gateway |
| UC-U-CM-* / UC-M-* (communities, future) | new `CommunitiesModule` |
| UC-A-01..06 (admin, future) | new `AdminModule` with `RolesGuard` |
| UC-E-03..04 (security alerts / digests, future) | `MailModule` + scheduler |

Every flow currently served by Next route handlers / server actions has a one-to-one mapping to a Nest controller; no use case is regressed by the split.

## 12. Non-goals (for now)

- CDN / object storage for media — `/uploads` on a volume is fine until Phase 9 hardening.
- Background job queue — Resend send is inline; if email volume grows, introduce BullMQ on Redis.
- gRPC / message bus between services — only one backend service exists.
- Horizontal frontend scale across regions — single replica per environment.
