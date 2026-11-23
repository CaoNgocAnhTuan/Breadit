# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Breadit is an X/Twitter clone built as an npm-workspaces monorepo:

- `apps/frontend` (`@breadit/frontend`): Next.js 15 App Router, React 19, TanStack Query, Tailwind, Socket.IO client
- `apps/backend` (`@breadit/backend`): NestJS 10 on **Fastify** (not Express), Prisma 6, PostgreSQL 16, Redis 7, Socket.IO
- `packages/shared` (`@breadit/shared`): shared TS types imported by the frontend. Its `types` point at `dist/`, so run `npm run build -w @breadit/shared` before typechecking or building the frontend.
- `packages/ranking` (`@breadit/ranking`): the pure ranking code of the thesis (pool, as-of features, every scorer, `computeExploreScoreFixed`), used by the backend's Explore and by `eval/`. It is CommonJS built to `dist/`, so run `npm run build -w @breadit/ranking` before the backend build, the backend tests or `eval` (`verify.sh` and the backend Dockerfile do this). Its tests: `npm run test -w @breadit/ranking`.
- `eval` (`@breadit/eval`): the thesis evaluation (synthetic generator, Digg 2009 adapter, harness, metrics, statistics). ESM; the `.ts` files run directly on the pinned Node, and it never touches Postgres, Redis or HTTP (only the loader in `src/loader/` writes to Postgres, into its own schema: `eval_load`, or `eval_demo` for the demo). Nothing imports it. Commands are under "Commands" below.

`docs/Pre-thesis/` holds the pre-thesis report and design material (ADRs, use cases, ERDs, k6 perf scripts), and its LaTeX in `docs/Pre-thesis/Latex/` (the school's format). Do not move or edit it. Thesis working docs (plans, task folders, results) go in `.docs/` at the repo root. The thesis itself is the LaTeX project in `.docs/Thesis-Report/` (the same school format; `main.tex`, `chapters/`, the Markdown drafts in `drafts/`; build with `latexmk -pdf main.tex` in that folder). It reads the macros and tables from `.docs/results/p7-report/` and never copies a number. The root of `docs/` holds thesis docs for the supervisor, reviewers and the defense:
- `docs/System_Architecture.md`: the proposed system, its diagrams and the annotated directory tree.
- `docs/Guidance-Manual/`: a study guide in 12 topics, each in `en/` and `vi/` with the same content. English is the reference; if the two differ, fix the Vietnamese one.

No application code lives in any of these folders.

**Keep the docs in step with the code.** When a task changes the architecture, the feed, the ranking, the data or the evaluation, update `docs/System_Architecture.md` and the Guidance Manual files on that topic (both languages) in the same task, and change their 🔜 or "(after P7)" marks when the planned part is built. The Result section of the task names the files it updated.

## How to write

The author reads English as a second language (upper-intermediate). This applies to chat replies and to every doc you write or change (thesis working docs go in `.docs/`, docs for the supervisor and reviewers in the root of `docs/`). In chat, talk like a thesis supervisor: explain, brainstorm, give an opinion.

- Short and direct. Give the answer first, then the reason. Add detail only when asked.
- Simple everyday words. If a word is rare or formal, use a simpler one.
- One idea per paragraph. Few headings and tables. Lists of 3–4 items at most.
- Project terms (cache, gateway, ADR) are fine. Explain a new technical word once, in one sentence.
- In docs, keep names, numbers and frozen values exact. Simpler words must not make the meaning vaguer.
- Brainstorming: one recommendation, at most two other options, then one question.
- Existing docs are not rewritten unless asked.

## Workflow

Every feature, super-plan item or bug fix goes through three approvals before any code. Each task is one folder `.docs/works/YYYY-MM-DD-<slug>/` with two files: `design.md` (max 800 lines) and `plan.md` (max 600 lines). The main model is Opus.

1. `/task <item>` or `/bugfix <ID>` investigates and writes Spec and Impact in `design.md`. The author reviews it and types `/approve`.
2. Claude writes the Design section of `design.md`: workflows, sequence diagrams, failure modes with how to resolve them, and the code files with their purpose. The author types `/approve`.
3. Claude writes `plan.md`: ordered steps that point back to the design, tests, acceptance checks. The author types `/approve`. Approving the plan also approves the commits it lists.
4. Claude starts a Sonnet agent to implement the plan (tests first, commits). Then Claude runs `verify.sh` and the acceptance checks, fills Result and closes the task.

**Writing tasks** (no code, no tests: a thesis chapter, a doc) use a light path, decided by the author on 2026-11-20. Claude opens the task folder with a `design.md` that holds the Spec only (no `Spec status:` line, so the hooks do not gate it, and no `plan.md`), then starts a Sonnet agent at once. Claude checks the result against the Spec's "Done when", fills Result and commits.

**Git.** Commit every change on the current branch, `test-app`. Never create a new branch for a change: no feature, task, fix or thesis branches. Tags, pushes and any change to `main` need the author's OK.

Only the author runs `/approve`. The hooks in `.claude/hooks/` enforce the rest: code edits ask the author unless the active task's plan is approved, `docs/Pre-thesis/` (with the pre-thesis LaTeX), `.env` and committed migrations cannot be edited, and commits go on `test-app` only. Thesis reports are written separately, not inside a task. A frozen value (super-plan §7) changes only when the author asks, with a line in the super-plan change log. See `.claude/README.md` for the full map.

## Commands

Root `npm run dev|build|start|lint|typecheck` only targets the **frontend**. Use `-w @breadit/backend` for the backend.

```bash
nvm use                                # Node version from .nvmrc (Node 22, pinned in P0)
docker compose up db redis -d          # Postgres on :5433, Redis on :6378
npm install                            # install first so npx uses the pinned Prisma 6, not the latest
                                       # after `npm ci`, run `npx prisma generate` (below) again: npm ci deletes the generated client
npm run dev                            # frontend on :3000
npm run dev -w @breadit/backend        # backend on :4000 (nest start --watch)
npm run build -w @breadit/backend

npm run lint                           # next lint (frontend only)
npm run typecheck                      # tsc --noEmit (frontend only)

docker compose up --build              # full stack; backend runs `prisma migrate deploy` on start
make rebuild | backend-rebuild | frontend-rebuild | logs   # see Makefile
```

Backend tests (Jest): `npm run test -w @breadit/backend` runs the unit tests, `npm run test:it -w @breadit/backend` runs the integration tests, and `npm run test:backend` runs both. The integration tests boot the real app, so they need `docker compose up db redis -d`. They use the Postgres schema `it_test` and Redis database 1, so the dev data in schema `public` is not touched. `npm run test:parity -w @breadit/backend` runs the parity test (live feed order equals harness order): it needs db and redis and `syn-W2M-M` loaded into `eval_load` without `--rebase-to`, only reads that schema, and uses Redis database 2. The frontend has no tests.

Eval (`eval/`, `@breadit/eval`, thesis evaluation code): run `nvm use` first, because the `.ts` files run directly on the pinned Node and do not load on an older one. `npm run verify -w @breadit/eval` runs the typecheck and the tests. `npm run gen -w @breadit/eval` writes the eight synthetic datasets to `eval/data/` (git-ignored, rebuilt from the seed), `npm run adapt:digg -w @breadit/eval` converts the Digg 2009 zips in `datasets/raw/digg2009/` (git-ignored, downloaded by hand, see `.docs/datasets.md` §4) to `eval/data/digg2009/`, and `npm run check -w @breadit/eval` checks every dataset. `npm run harness -w @breadit/eval -- <runId>` runs `eval/config/runs/<runId>.json` and writes `.docs/results/<runId>/` (a `per_user.csv` over 5 MB goes to the git-ignored `eval/results/`); `npm run rank -w @breadit/eval -- --dataset <id> --method <m> --user <u> --asof <t>` prints one ranking. The test split runs only when the run config has `"testApprovedBy": "author"`. `npm run freeze -w @breadit/eval` writes the ten P7 test configs from the committed tuning in `.docs/results/p7-tune-*/` (`--check` compares them, `--approve author` adds the author's approval), and `npm run report -w @breadit/eval` writes `.docs/results/p7-report/` (`macros.csv`, `results-macros.tex`, the tables, `results.md` and the figure data `fig-e2-history.csv`, `fig-e3-density.csv`, `fig-e5-worlds.csv`) from the P7 results. Build `@breadit/ranking` first. No Docker is needed, except for the loader: `npm run load -w @breadit/eval -- <datasetId>` writes a synthetic dataset into the Postgres schema `eval_load` (never `public`; it empties that schema first; needs `docker compose up db redis -d`; `--rebase-to <YYYY-MM-DDTHH:MM:SSZ>` is for the demo only), and `npm run load:check -w @breadit/eval -- <datasetId>` reads it back and compares the six hashes with the dataset manifest. To run the backend on it, export `DATABASE_URL` with `?schema=eval_load` before `run-safe.sh`. `npm run parity -w @breadit/eval -- --param alpha=<a> --param beta=<b>` draws the 100 parity pairs of `syn-W2M-M` and writes the harness orders to `.docs/results/p6-parity/` (the full orders go to the git-ignored `eval/results/p6-parity/`); α and β must equal `SOCIAL_PARAMS` in `apps/backend/src/feed/feed.constants.ts`, and the output is committed.

`npm run results:manifest -w @breadit/eval` compares every results manifest in `.docs/results/` and every dataset manifest in `eval/data/`, and every file they list, with `.docs/results/manifest.json` (the merged manifest; `-- --write` makes it, only from a tree that equals its own manifests). `npm run thesis:repro` (root, `scripts/repro/thesis-repro.mjs`) deletes every Class D result and `eval/data/`, rebuilds them (the datasets, the 13 harness runs, the parity sample and test, the report) and ends with that compare. It needs `nvm use`, `docker compose up db redis -d`, the two Digg zips with their SHA-256, and no uncommitted change in `.docs/results/` or `eval/config/` (it stops at once, before it deletes anything, when one is missing). It takes about 3 hours, it uses the schema `eval_load` and Redis database 2 (run nothing else on them), and it writes one log per step to `eval/results/repro/`. The E7 benchmark (Class R) is not part of it: `npm run bench:e7` runs it.

Demo (`scripts/demo/`, task `p10-demo-script`): run `nvm use` and `docker compose up db redis -d` first. `npm run demo:start` loads `syn-W2M-M` into the schema `eval_demo` with `--rebase-to` the current time, adds the admin `demo-admin@example.com` (password `password`), starts the backend (through `run-safe.sh`, on Redis database 3) and the frontend dev server, picks the two demo users (little and long history) and prints the URLs and the logins. It takes about 40 s. `npm run demo:users` prints the two users again, with the first 10 post ids of each `algo`. `npm run demo:stop` lifts every ban, stops both servers and empties Redis database 3. The presenter's steps are in `scripts/demo/CHECKLIST.md`. The demo never writes to `public` or `eval_load` (so `test:parity` still passes) or to Redis databases 0, 1 and 2. It starts its own servers, so run nothing else on :3000 and :4000. Its unit tests: `node --test 'scripts/demo/*.test.mjs'` (Node 22 does not take the folder name).

Thesis checks (`scripts/thesis-check/`, task `p10-final-checks`): run `nvm use` first. `npm run thesis:check` builds the PDF with `latexmk` and runs five checks on the thesis: (1) typed decimals and percentages that are not a result macro, an undefined result macro, a `\macromissing`; (2) every `\refcite` key defined, every entry of `chapters/references.tex` cited and "verified" in super-plan section 10 (the link is the `% §10 [n]` comment at the end of each `\item`); (3) every macro of the abstract also used in Chapter 6; (4) runs of 8 words shared with the pre-thesis text and with the quoted parts of the p1 paper extracts (the words inside `"…"`, which must open and close on one line; our own notes in the extracts are not compared); (5) the page count (FAIL above 120, WARN above 100 for Chapters 1-9). It runs checks 1 and 2 on the slides too. It prints one line per check, then `path:line: LEVEL [check] message`, then the PASS, WARN and FAIL counts, and exits 1 when a check FAILs. `npm run thesis:check -- --no-build` skips the build and reads the last `main.log` and `main.toc`. The reviewed exceptions of check 1 (settings, versions, numbers of cited papers, layout) are lines of `scripts/thesis-check/allow-numbers.tsv`, each with a reason (a line with no reason FAILs). It only reads files (`docs/Pre-thesis/` too, never writes there) and prints to stdout, so save the output with `>`. Run it again after the supervisor's feedback and before the freeze. Its tests: `node --test 'scripts/thesis-check/*.test.mjs'` (Node 22 does not take the folder name).

`scripts/verify-bug-sweep.sh` and `scripts/verify-socket.cjs` replay curl and Socket.IO checks against a running backend (see the header of the first one for how to start the backend without sending real email).

When you add a backend dependency, use `npm install --legacy-peer-deps`: `@nestjs/core` is 10 while `@nestjs/websockets` is 11, and plain `npm install` stops on that peer conflict.

The Husky pre-commit hook runs `lint-staged` (ESLint `--fix` on `apps/frontend/src/**`) and then `npm run typecheck`. It does not run the backend tests.

### Prisma

The schema is `apps/backend/prisma/schema.prisma`. The seed command is configured in the **root** `package.json`, so run Prisma from the repo root with `--schema`:

```bash
npx prisma migrate dev --name <name> --schema=apps/backend/prisma/schema.prisma
npx prisma generate --schema=apps/backend/prisma/schema.prisma
npx prisma db seed --schema=apps/backend/prisma/schema.prisma
npx prisma studio --schema=apps/backend/prisma/schema.prisma
```

- Because Docker deploys with `migrate deploy`, schema changes need a real migration. `db push` alone is not enough.
- Seed users: `admin` / `123456` (ADMIN role) and `user1`–`user50` / `password` (set `SEED_USERS` to change the count).
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

### Feeds and ranking (`src/posts/posts.service.ts`, `packages/ranking`)

- `GET /api/posts` → `PostsService.findAll` picks the mode from `algo`, `feed`, `user` and `communityId`: an `algo` feed, For You (you and your followees, no community posts, newest first), `following`, `communities`, `explore`, a profile, a community, or the guest feed. Pages have 10 posts and live 10 s in the cache under `feed:...:<v:user>:<asOf>`. The clock is read once per request.
- Explore takes the 400 newest posts of 7 days, scores them with `computeExploreScoreFixed` from `@breadit/ranking` (this is BL2 of the thesis), sorts by `(scoreFixed desc, id desc)` and caps posts per author. It uses one time per request: the clock, or the test-only `asOf` (T4).
- All ranking logic belongs in `@breadit/ranking`, never in the backend. The package is pure: no Nest, Prisma, Redis, clock or randomness. The backend loads plain arrays, calls `buildPool`, the as-of feature builders, `scorer(method)` and `rankPool`, and gets back ordered post ids. `eval/` calls the same functions, so offline numbers describe the live feed.
- The `algo` feeds (task `p6-social-feed`): `apps/backend/src/feed/`. `FeedService.rank(userId, algo, t)` loads the window's root posts (community posts included, repost rows left out, no row limit), the user's follows and memberships with their times, the user's positives, the blocked peers and the positives on the pool posts, then calls the package. It never reads the clock. `algo` is `chrono` (BL0), `engagement` (BL2) or `social` (H), only on the logged-in For You; the cursor is `t:score:id`, so every page ranks at the same t. `FEED_DEFAULT_ALGO` sets the default (unset = today's For You). `FEED_ASOF_ENABLED=true` turns on the test-only `asOf` (Unix seconds); the backend refuses to start with it in production. α and β of `social` in `feed/feed.constants.ts` are the tuned P7 values (1024 and 1024, the `syn-W2M-M` values of `eval/config/runs/p7-main.json`; a unit test checks that they are equal to that file). Any change or speed-up of the feed must keep `npm run test:parity` passing: the live order must equal the harness order. The details are in `docs/Guidance-Manual/en/08-system-and-feed.md`.

### Other cross-cutting pieces

- **Globals** (`main.ts`, `app.module.ts`):
  - `ValidationPipe({ whitelist: true, transform: true })`, so DTOs need `class-validator` decorators or their fields are stripped.
  - `AllExceptionsFilter`.
  - `ThrottlerGuard` backed by Redis.
  - A 500 MB body/multipart limit.
- **Uploads** (`src/uploads/`): if `CLOUDINARY_CLOUD_NAME` is set, files go to Cloudinary. Otherwise they go to local disk at `UPLOAD_DIR` and are served by `@fastify/static` at `/uploads/`. Images are re-encoded with `sharp`. New image hosts must also be added to `images.remotePatterns` in `apps/frontend/next.config.ts`.
- **Blocking** (`src/block/block.service.ts`): post, user, search, notification and message queries filter out blocked peers. New listing queries should do the same.
- Posts are soft-deleted (`deletedAt`). Hashtags are parsed from post text on write, and `@mentions` from both posts and comments.
