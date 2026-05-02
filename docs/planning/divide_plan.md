# Divide Plan — Splitting Breadit into Frontend + Backend

> Companion to `docs/planning/architecture.md`. Describes the staged migration from the current single Next.js app to the two-service layout.

## Current state (entering this plan)

- Single Next.js 15 app on a custom `server.js` (Next + Socket.IO on port 3000).
- NextAuth v5 Credentials provider, Prisma + MySQL, server actions in `src/action.ts`, API routes under `src/app/api/**`, uploads on `public/uploads/`.
- Phases 0 and 1 of `docs/planning/implementation_plan.md` are done (auth, email verification, password reset).
- `docker-compose.yml` runs `db` (MySQL) + `app` (Next).

## Progress snapshot (2026-04-27)

Stages 0–4 are complete and verified (`docker compose up --build` green, all four containers healthy):

| Stage | Status | Notes |
|---|---|---|
| 0 — Repo restructure | ✅ done | npm workspaces, `apps/frontend`, `apps/backend`, `packages/shared` |
| 1 — MySQL → Postgres | ✅ done | Postgres 16, fresh migrations |
| 2 — Backend skeleton | ✅ done | NestJS/Fastify on port 4000, `GET /api/health` |
| 3 — Port auth | ✅ done | JWT cookie auth, NextAuth removed |
| 4 — Port read endpoints | ✅ done | Posts/Users/Feed via backend REST; `src/prisma.ts` and `src/utils.ts` deleted from frontend |
| 5 — Port write endpoints | 🔲 next | Server actions → REST mutations |
| 6 — Port Socket.IO | 🔲 pending | |
| 7 — Cleanup & hardening | 🔲 pending | |

### Fixes applied during Stage 4 verification

- `apps/frontend/src/lib/session.ts` — `serverFetch` now accepts an optional `RequestInit` second argument (was typed for 1 arg, called with 2).
- `apps/frontend/Dockerfile` — added `@breadit/shared` to the `npm ci` workspace set; builds shared package before frontend.
- `apps/frontend/src/components/Post.tsx` — `post.rePostId` → `post.rePost` (field renamed in shared type).
- `docker-compose.yml` — corrected port mappings (`5433:5432`, `6378:6379`) and inter-container URLs; removed stale `prisma db push` from frontend startup command.
- `apps/backend/Dockerfile` — runner now copies workspace-specific `node_modules` (where `jose` is placed by npm) from the deps stage and runs from `/app/apps/backend`; also copies the generated Prisma client from the builder stage.

> **Stages 5–7 are superseded.** They have been folded into `docs/planning/implementation_plan.md` (Phases 3–4, 5, and 9 respectively), which is now the single roadmap to follow.

## Target state

Per `docs/planning/architecture.md` — two containers (`apps/frontend`, `apps/backend`) plus `db` (Postgres 16) and `redis` (Redis 7). Auth becomes a backend-issued JWT in an httpOnly cookie. Server actions and direct Prisma calls in pages/components are replaced by REST calls.

## Staging principle

Each stage ends with a green build:

```bash
npm run lint
npm run typecheck
docker compose up --build
```

Stages are merged independently; the app stays runnable between them.

---

## Stage 0 — Repo restructure (no behaviour change)

- Add npm workspaces to root `package.json`:
  ```json
  { "private": true, "workspaces": ["apps/*", "packages/*"] }
  ```
- Create skeletons:
  - `apps/frontend/` — receives current `src/`, `public/`, `next.config.ts`, `server.js`, `tailwind.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `eslint.config.mjs`.
  - `apps/backend/` — empty Nest project (`nest new --package-manager npm --skip-git apps/backend`).
  - `packages/shared/` — `package.json`, `tsconfig.json`, `src/index.ts`.
- Move `prisma/` → `apps/backend/prisma/`.
- Rewire imports: path alias `@/*` keeps working, only the workspace's `tsconfig` `baseUrl` moves.
- Root scripts fan out: `dev`, `build`, `lint`, `typecheck` each call the workspace equivalent.
- The current `Dockerfile` becomes `apps/frontend/Dockerfile` for now; backend Dockerfile is added in Stage 2.

**Verify:** `docker compose up --build` still works. Frontend still talks to MySQL via the current Prisma client (we have not split data ownership yet).

## Stage 1 — Database swap (MySQL → Postgres)

- `apps/backend/prisma/schema.prisma` → `provider = "postgresql"`.
- Delete `prisma/migrations/` (no production data; safe to regenerate).
- `docker-compose.yml`: replace MySQL service with `postgres:16-alpine`. New env: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`. New `DATABASE_URL`.
- Generate fresh init migration: `npx prisma migrate dev --name init`.
- Update `prisma/seed.ts` if it relied on MySQL-specific quirks (none expected).

**Verify:** `npx prisma studio` opens on Postgres; `prisma db seed` succeeds; existing endpoints still register/login a user.

## Stage 2 — Stand up backend skeleton

- In `apps/backend`, install: `prisma @prisma/client jose bcryptjs cookie @fastify/cookie @fastify/multipart @fastify/static resend sharp ioredis @nestjs/throttler @nestjs/throttler-storage-redis @nestjs/config @nestjs/platform-fastify @nestjs/websockets @nestjs/platform-socket.io socket.io @socket.io/redis-adapter class-validator class-transformer`.
- `main.ts` boots Fastify adapter on port 4000, registers `@fastify/cookie`, `@fastify/multipart`, CORS to `FRONTEND_URL`, global `ValidationPipe`.
- `PrismaModule` — singleton client (port the lazy-init pattern from `src/prisma.ts`).
- `RedisModule` — singleton `ioredis` client.
- `HealthModule` — `GET /api/health` for compose healthcheck.
- `apps/backend/Dockerfile` — multi-stage (deps → build → runtime). Final CMD: `npx prisma migrate deploy && node dist/main.js`.
- Redis service added to compose: `redis:7-alpine`. Backend depends on db (healthy) + redis. Frontend depends on backend (healthy). `uploads_data` volume moves from frontend to backend.

**Verify:** `curl http://localhost:4000/api/health` returns 200 from inside the compose network and from the host.

## Stage 3 — Port auth (and rip out NextAuth)

Single PR, ordered:

1. **Backend `AuthModule`** — controllers for `register`, `login`, `logout`, `me`, `verify`, `forgot-password`, `reset-password`. Move `src/lib/email.ts` and `src/lib/tokens.ts` into `apps/backend/src/auth/`. JWT signing/verification via `jose`.
2. **Backend guards** — `JwtAuthGuard` (cookie → `req.user`), `EmailVerifiedGuard` (write-only). Cookie helper sets `breadit_session` httpOnly + SameSite=Lax + Secure (prod) + Domain=`COOKIE_DOMAIN`.
3. **Frontend deletions** — `src/auth.ts`, `src/types/next-auth.d.ts`, `src/app/api/auth/**`. Drop deps `next-auth`, `@auth/prisma-adapter`.
4. **Frontend `src/lib/api.ts`** — typed fetcher. SSR mode forwards `cookies().toString()` as the `cookie` header; browser mode uses `credentials: "include"`.
5. **Frontend `src/lib/session.ts`** — `getSession()` calls `BACKEND_INTERNAL_URL/api/auth/me`, returns `{ user } | null`. Replaces every `auth()` call.
6. **Frontend `src/middleware.ts`** — replaced with a minimal cookie-presence check; redirects to `/sign-in` on protected routes. Verified-write enforcement now lives on the backend.
7. **Frontend forms** — `sign-in`, `sign-up`, `forgot-password`, `reset`, `verify` pages updated to `fetch` the backend (`credentials: "include"`).
8. **`(board)/layout.tsx`** — switches from `auth()` to `getSession()`.

**Verify:** full Phase 1 flow: register → email arrives → click verify link → cookie set → sign-in → forgot/reset round-trip.

## Stage 4 — Port read endpoints

1. **Backend `PostsModule`** — `GET /api/posts?cursor&user`. Port `src/app/api/posts/route.ts` verbatim. Add a public-feed branch when no cookie is present (UC-G-01).
2. **Backend `UsersModule.findByUsername`** — `GET /api/users/:username`.
3. **Backend `PostsModule.findOne`** — `GET /api/posts/:id` (post detail with thread).
4. **Frontend refactors** — `src/components/Feed.tsx`, `src/components/Recommendations.tsx`, `src/app/(board)/[username]/page.tsx`, `src/app/(board)/[username]/status/[postId]/page.tsx`. Replace direct `prisma.*` calls with `api.get(...)`.
5. **Frontend cleanup** — delete `src/prisma.ts`, drop `prisma`/`@prisma/client` from frontend deps.

**Verify:** UC-G-01..04 round-trip works logged out and logged in. Profile and permalink pages render via SSR fetch.

## Stage 5 — Port write endpoints (server actions → REST)

1. Backend modules:
   - `InteractionsModule` — `POST /api/posts/:id/like`, `/repost`, `/save` (toggle).
   - `UsersModule.toggleFollow` — `POST /api/users/:id/follow`.
   - `CommentsModule` — `POST /api/posts/:id/comments`.
   - `PostsModule.create` — `POST /api/posts` (multipart for media).
   - `UploadsModule` — `POST /api/uploads`.
2. Each guarded by `JwtAuthGuard` + `EmailVerifiedGuard`.
3. **Frontend** — replace `src/action.ts` server actions with TanStack Query mutations against the backend. Optimistic UI preserved via `useMutation({ onMutate })`.
4. Update components: `PostInteractions`, `FollowButton`, `Comments`, compose modal.
5. Delete `src/action.ts`, `src/utils.ts` (`uploadFile` lives only on the backend now).

**Verify:** UC-U-PI-01..05, UC-U-PM-01, UC-U-SG-01 all round-trip; counters update on the next render.

## Stage 6 — Port Socket.IO

1. **Backend `NotificationsModule`** — `@WebSocketGateway()` mounted on Fastify. Reimplement `newUser`, `sendNotification`, `getNotification`, `disconnect`.
2. Online users → Redis: `SET breadit:online:<username> "1" EX 300`, refreshed on activity.
3. `@socket.io/redis-adapter` for multi-replica.
4. **Frontend** `src/socket.ts` — change URL to `process.env.NEXT_PUBLIC_BACKEND_URL`.
5. Delete `server.js` from frontend; switch frontend Dockerfile CMD to `next start`.

**Verify:** two browsers; A follows B; B receives `getNotification`. Scaling backend to 2 replicas does not drop events (Redis adapter routes them).

## Stage 7 — Cleanup & hardening

- Remove `prisma`, `@prisma/client`, `bcryptjs`, `next-auth`, `@auth/prisma-adapter`, `resend`, `sharp`, `socket.io` from frontend `package.json`.
- Tighten CORS on backend to `FRONTEND_URL` only.
- Apply `@nestjs/throttler` (Redis-backed): `auth/*` 5/min, write endpoints 60/min.
- Confirm Phase 1 e2e flows still work end-to-end.
- Update `CLAUDE.md` to reflect the new layout (workspaces, two services, Postgres+Redis).

---

## File map

| Action | Path |
|---|---|
| NEW | `apps/backend/**` (Nest app, prisma, dockerfile) |
| NEW | `packages/shared/**` |
| NEW | `apps/frontend/src/lib/api.ts` |
| NEW | `apps/frontend/src/lib/session.ts` |
| MOVE | `src/**` → `apps/frontend/src/**` |
| MOVE | `prisma/**` → `apps/backend/prisma/**` |
| MOVE | `public/**`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs` → `apps/frontend/` |
| MODIFY | root `package.json` (workspaces), `docker-compose.yml`, `Dockerfile` (split) |
| DELETE (frontend) | `server.js`, `src/auth.ts`, `src/action.ts`, `src/types/next-auth.d.ts`, `src/lib/email.ts`, `src/lib/tokens.ts`, `src/utils.ts`, `src/prisma.ts`, `src/app/api/auth/**`, `src/app/api/posts/**` |

## Verification (full system, post-Stage 7)

Against `docker compose up --build`:

1. **Auth (UC-G-05..06, UC-E-01..02):** register → email → `/verify?token=…` → cookie set → `/api/auth/me` returns user → forgot/reset round-trip works.
2. **Guest read (UC-G-01..04):** `/` and `/<username>` render with no cookie via SSR fetch.
3. **Authed write (UC-U-PM-01, PM-03):** verified user composes a post with image and video; uploads land in the backend volume; feed shows it; delete removes it.
4. **Interactions (UC-U-PI-01..05, UC-U-SG-01):** like / save / repost / reply / follow round-trip; counters update via TanStack Query invalidation.
5. **Realtime (UC-U-NT-02):** two browsers; A follows B; B sees `getNotification`. Kill one of two backend replicas — Redis adapter still routes.
6. **Rate limit:** hammer `/api/auth/login` 10×/min → 429 from throttler.
7. **DB / cache:** `psql` shows post row; `redis-cli MONITOR` shows online-users SET on connect, throttler keys on auth requests.

Final gates:

- `npm run lint && npm run typecheck` at repo root (each workspace passes).
- `docker compose up --build` cold-start; smoke checklist above all green.
- Phase 0–1 exit checklists in `docs/planning/implementation_plan.md` re-validated.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| SSR cookie forwarding subtly broken (auth works in browser, not SSR) | Centralise in `src/lib/api.ts`; assert in a smoke test that `getSession()` returns the user in a server component when a cookie is present. |
| Cookie domain mismatch between localhost dev and prod | Drive via `COOKIE_DOMAIN` env; leave undefined in dev so the cookie is host-scoped. |
| Multipart upload regressions (sharp pipeline differences in Fastify vs Next) | Port `uploadFile` byte-for-byte; reuse `sharp` configuration; add a unit test on the backend. |
| Socket auth (currently relies on session being set up by NextAuth on the server) | Gateway reads the same JWT cookie via `@fastify/cookie` and validates with `jose` before joining rooms. |
| Postgres migration drift if Phase 2+ schema work happens during the split | Freeze schema changes during Stages 0–7; merge Stage 7 before resuming Phase 2 work. |
