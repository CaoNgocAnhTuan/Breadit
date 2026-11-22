# Demo script for the progress check

Spec status: approved · 2026-11-22
Design status: approved · 2026-11-22
Type: feature · Folder: `.docs/works/2026-11-22-p10-demo-script/`
Row: `.docs/implementation-plan.md` §5 row 22 (`p10-demo-script`, P10, depends on row 21, 1 day, no bugs placed here). Super-plan §4 P10 "Do": "A demo script on generated data loaded with `--rebase-to`, showing the three `algo` options side by side."

## 1. Spec

### Problem

The supervisor checks progress on 2026-11-30 and wants to see the demo. Row 23 (Chapter 8) also needs a demo rehearsal and about eight screenshots. Today there is no demo script: `scripts/demo/` does not exist. Each part works on its own, but nobody has put them together on the demo data.

What exists today (checked on 2026-11-22):
- **The data.** `eval/data/syn-W2M-M/` has 1,000 users, 20,000 posts, 12,126 follows, 1,773 memberships, 20 communities and 22,258 interactions (its `manifest.json`). `npm run load -w @breadit/eval -- syn-W2M-M [--schema eval_x] [--rebase-to YYYY-MM-DDTHH:MM:SSZ]` writes it into an `eval_` schema (`eval/src/cli/load.ts`, `eval/src/loader/target.ts`: the name must match `^eval_[a-z0-9_]+$`). `--rebase-to` moves every time by one shift so the last event lands on the given time (`rebaseShift`, `eval/src/loader/time.ts`). The time is an argument, because `eval/` never reads the clock.
- **The users it writes.** Username and id `u0000000042`, email `u0000000042@example.com`, email verified, the seed password `password` (`PASSWORD_HASH`, `eval/src/loader/ids.ts`), display name `User 42`. Post text is `Post <id>` and comment text is `Comment <id>` (`toAppRows`, `eval/src/loader/map.ts`). Every user has the role USER, so **the loaded data has no admin**, and the ban flow needs one.
- **The schema `eval_load` belongs to the parity test.** `apps/backend/test/parity/global-setup.ts` stops when `eval_load` does not hold `syn-W2M-M` as loaded **without** `--rebase-to`. `npm run thesis:repro` also empties and refills it. So a demo load into `eval_load` breaks `npm run test:parity` until the next plain load.
- **Redis is shared.** `.claude/hooks/run-safe.sh` uses `redis://localhost:6378` (database 0), the same as the dev app on schema `public`. Post ids of the two schemas overlap, so cached post and feed entries of one can show in the other. The loader task saw this and left it to the demo task (`.docs/works/2026-11-10-p3-postgres-loader/design.md`, failure mode F11). The parity test uses database 2.
- **The app side.** `run-safe.sh` starts the backend with no real email and no Cloudinary, and keeps `DATABASE_URL` and `REDIS_URL` from the shell. The For You page has the three `algo` links (`/?algo=chrono|engagement|social`, `apps/frontend/src/app/(board)/page.tsx`). Explore uses the clock, so it needs the rebased data inside its 7-day window. `FEED_ASOF_ENABLED` stays off. The demo sweep (row 21) walked every page and the flows DM, notification and ban on schema `public` with `user1`, `user2` and `admin`, all PASS after `p10-demo-fixes`.
- **Not checked:** how long a load of `syn-W2M-M` takes, and whether the three `algo` feeds of a loaded user give clearly different first pages (the sweep checked this on the seed data only).

### Scope

**In scope:**
- A `scripts/demo/` folder with one entry point and three commands:
  - **start:** check that db and redis are up, load `syn-W2M-M` into a demo schema with `--rebase-to` set to the current UTC time (whole seconds), add one admin account to that schema, start the backend (from `run-safe.sh`) and the frontend dev server on that schema and a Redis database of its own, then print the URLs and the logins.
  - **users:** pick the two demo users by a fixed rule from the loaded data: one with little history (history 1–4) and one with long history (20 or more). History means the user's positives (like, comment, repost) before the start time, the same word as `.docs/implementation-plan.md` §3.2. Both must follow at least one user. Print each one with its history, its follow count and the first 10 post ids of For You under each `algo`.
  - **stop (cleanup):** lift any ban made during the demo, stop the backend and the frontend the script started, and empty the demo Redis database.
- A checklist for the presenter in `scripts/demo/` with each step and its expected result: sign in, the three `algo` side by side for both demo users, Explore, a live direct message, a live notification, an admin ban that logs the user out, then cleanup. It says which window does what (two browser windows, Open question 3).
- A rehearsal by Claude in Chrome on the demo data, with the result of each checklist step written to `rehearsal.md` in the task folder.
- The docs that name the demo: `CLAUDE.md` (Commands), `docs/System_Architecture.md` (the schema table and the row "Slides and demo"), the Guidance Manual 04 (en and vi), `.docs/implementation-plan.md` §5 row 22.

**Out of scope:**
- Any change under `apps/`, `packages/` or `eval/src/` (Open question 4 says what happens if one is needed).
- Nicer demo text or pictures (posts say `Post 123`, users have no avatar).
- The Chapter 8 screenshots and test table (row 23) and the defense demo script (row 30).
- A shared server or deploy (row 29, the P2 bugs).
- The P10 security bugs B5 and R6 (R6: an admin can ban themselves). The checklist simply never does that.

### Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | the start command, with db and redis up and ports 3000 and 4000 free | ends with exit 0; prints the rebase time, the schema, the Redis database, the two URLs, the admin login and the two demo user logins; `GET /api/health` on :4000 and `GET /` on :3000 answer 200 |
| DW2 | the start command with db or redis down, or a port in use | stops before loading, with a message that says what to start or free; nothing is loaded |
| DW3 | `npm run test:parity -w @breadit/backend` after the start command (with `eval_load` loaded plainly before) | passes: the demo does not touch `eval_load` or Redis database 2 |
| DW4 | number of keys in Redis database 0 before and after start and a few demo page views | the same (the demo writes to its own Redis database) |
| DW5 | the users command | prints two users: one with history 1–4 and one with history 20 or more, each with at least one follow; for each user, the three first pages (10 ids) are not all the same order; two runs on the same load print the same users |
| DW6 | sign in through `POST /api/auth/login` as each demo user and as the demo admin | 200 or 201 with the `breadit_session` cookie |
| DW7 | Explore and For You (all three `algo`) for a demo user, in Chrome | each shows 10 posts, the newest dated within the last day |
| DW8 | the rehearsal in Chrome, following the checklist step by step | every step PASS in `rehearsal.md` (what was done, the result, a screenshot name). The DM and the notification arrive without a reload; the ban logs the other window out |
| DW9 | the stop command after the rehearsal | ports 3000 and 4000 are free; the demo Redis database has 0 keys; the banned demo user can sign in again; `public` and `eval_load` are unchanged (row counts of `User` and `Post` the same as before start) |
| DW10 | `git diff` of the task | no change under `apps/`, `packages/` or `eval/src/`; the docs of the Scope are updated, the Guidance Manual in both languages |

### Open questions

1. **Which schema?** My proposal: a new schema `eval_demo` (the loader allows any `eval_` name). It keeps `eval_load` for the parity test and `thesis:repro`, and `public` for the dev data. Other options: `eval_load` (breaks `test:parity` until a plain reload), or `public` (wipes the seed and `humans_v1`).
2. **Which Redis database?** My proposal: database 3 for the demo backend, emptied by start and by stop. 0 is dev and 2 is the parity test.
3. **Who plays the second user?** My proposal: the presenter uses two browser windows (a normal one and a private one), one demo user in each, and the admin in the normal window for the ban. This shows the live parts for real in front of the supervisor. Other option: a small helper script for the second user, like `second-user.mjs` of the demo sweep. That is easier for one person, but it hides the second screen.
4. **What if the rehearsal finds a bug in the app?** My proposal: this task records it in the Bugs Report and does not fix it, the same rule as row 21. A short fix task follows only if the bug is on the demo path.

## 2. Impact

**Who it affects.** The author at the progress check on 2026-11-30, and row 23, which takes its screenshots from this demo. Without the script, the demo is set up by hand on the day, with the risk of a wrong schema, stale Redis entries from the dev data, or no admin for the ban.

**Code areas.** None in the app (DW10). The script calls what exists: the loader CLI (`eval/src/cli/load.ts`), `.claude/hooks/run-safe.sh`, the frontend dev server, and the HTTP API for the users command and the checks. The new files are under `scripts/demo/`, next to `scripts/e7/` and `scripts/repro/`.

**Data.** It writes only the demo schema (proposal: `eval_demo`) and its own Redis database (proposal: 3). It reads `eval/data/syn-W2M-M/`, which must exist (`npm run gen -w @breadit/eval`). The admin row added after the load means `npm run load:check` on the demo schema shows a difference; that is expected (loader failure mode F12) and the checklist does not run it.

**Thesis link.** P10 and Chapter 8. No hypothesis, no frozen value (super-plan §7) and no reported number changes: `--rebase-to` is demo only, and every Class D number comes from the CSV files, never from Postgres. `test:parity` must stay green (DW3).

**Bugs on the same path.** Known and not fixed here: T6 (duplicate follow rows; the loaded data has no duplicates, so the demo does not show it), R6 (an admin can ban themselves), B5 (the verify banner; demo users are already verified). No bug is placed in this row.

## 3. Design

The open questions are answered by the proposals of the approved Spec: schema `eval_demo`, Redis database 3, two browser windows for the presenter, and bugs found in the rehearsal are only recorded.

### Approach

**One Node script, three commands.** `scripts/demo/demo.mjs start|users|stop`, run from the repo root through three root scripts `npm run demo:start`, `demo:users`, `demo:stop`. Node, not bash, the same as `scripts/e7/run-e7.mjs` and `scripts/repro/thesis-repro.mjs`: it uses only Node built-ins and child processes (`docker`, `npm`, `bash`), and parses JSON from the API. It never imports app code. The small pure parts (the rebase time, the choice of a demo user, the page compare) live in `scripts/demo/lib.mjs`, with `node:test` tests next to it.

**Fixed targets.** The script sets its own `DATABASE_URL` (`postgresql://breadit:breaditpassword@localhost:5433/breadit?schema=eval_demo`) and `REDIS_URL` (`redis://localhost:6378/3`) for every child it starts. It ignores the values in the shell, so a shell that points at `public` cannot send the demo there. The SQL goes through `docker exec <db container> psql -U breadit -d breadit`, and Redis through `docker exec <redis container> redis-cli -n 3`, with the container names found by `docker ps`, as in `run-e7.mjs` (`containerName`).

**start** does these steps in order and stops at the first failure:
1. **Checks** (before anything is written): Node major version 22; Docker answers; the db and redis containers run; nothing listens on :3000 or :4000; `run-safe.sh status` says "not running"; `eval/data/syn-W2M-M/manifest.json` exists.
2. **Build** `@breadit/shared` and `@breadit/ranking` (the frontend and the backend build need them). `run-safe.sh` builds the backend itself.
3. **Rebase time.** The current UTC time, cut to whole seconds, as `YYYY-MM-DDTHH:MM:SSZ` (`rebaseIso(new Date())`). The script reads the clock. `eval/` does not: the time goes to the loader as `--rebase-to`.
4. **Load**: `npm run load -w @breadit/eval -- syn-W2M-M --schema eval_demo --rebase-to <time>`. The loader runs the migrations on the schema, empties it and writes every row in one transaction (`eval/src/loader/db.ts`).
5. **Admin.** One SQL `INSERT` into `eval_demo."User"`: id `demo-admin`, username `demo_admin`, email `demo-admin@example.com`, role `ADMIN`, email verified at the rebase time, display name `Demo admin`. The password is copied from a loaded user (`SELECT password FROM eval_demo."User" WHERE id <> 'demo-admin' LIMIT 1`), so it is the seed password `password` and the hash is not copied into the script.
6. **Redis.** `FLUSHDB` on database 3: no old feed pages, old login counters or old blacklisted tokens.
7. **Backend**: `bash .claude/hooks/run-safe.sh start` with the two URLs above. The feed cache stays on, as in normal use. `FEED_DEFAULT_ALGO` and `FEED_ASOF_ENABLED` stay unset.
8. **Frontend**: `npm run dev -w @breadit/frontend`, started detached (its own process group), with `BACKEND_INTERNAL_URL` and `NEXT_PUBLIC_BACKEND_URL` set to `http://localhost:4000`. Its pid and log go to `.claude/state/demo/` (git-ignored). The script waits up to 180 s for `GET http://localhost:3000/sign-in` to answer 200. Then it fetches `/`, `/explore` and `/sign-in` once, so that Next.js compiles them before the demo and not in front of the supervisor.
9. **Users**: it runs the users command (below) and writes `.claude/state/demo/demo.json` with the rebase time, the schema, the Redis database and the two users.
10. **Print**: the rebase time, `eval_demo`, Redis database 3, `http://localhost:3000` and `:4000`, the admin login, the two user logins, and the line "checklist: scripts/demo/CHECKLIST.md".

If a step after the load fails, start runs the stop steps for what it started (the frontend, the backend) and exits 1 with the error.

**users** picks the two demo users and shows that the three `algo` differ for them:
1. One SQL query over `eval_demo` gives, for each user (not `demo-admin`), the history and the follow count. History is the number of rows in `Like`, in `Comment` with `deletedAt` null, and in `Post` with `rePostId` set, with that user and `createdAt` before the rebase time (Spec: "positives before the start time"). The follow count is the number of `Follow` rows with that user as `followerId`.
2. Two groups: **little** = history 1 to 4, **long** = history 20 or more, both with at least one follow. In each group the candidates are sorted by follow count (high first), then by id (low first). The same load gives the same order.
3. For each group, the first candidate that passes is chosen. A candidate is tried like this: log in (`POST /api/auth/login`, email and the seed password), then `GET /api/posts?algo=chrono`, `engagement` and `social` (page 1, 10 posts each). The candidate passes when the three lists of post ids are not all the same order (`pagesNotAllSame`). At most 4 candidates per group, so at most 8 logins (the login route allows 10 per minute per IP, `auth.controller.ts`).
4. Print for each chosen user: username, email, history, follow count, and the 10 post ids per `algo`, with how many of the 10 the `social` list shares with `chrono` and with `engagement`. If start called it, it also returns the two users for `demo.json`.

**stop** works even when start failed half way, and each step says "nothing to do" when there is nothing to stop:
1. **Bans.** One SQL `UPDATE eval_demo."User" SET banned = false WHERE banned`. It prints the usernames it unbanned. SQL, not the admin API, so it does not need a login and works when the backend is already down.
2. **Frontend**: it kills the process group of the pid in `.claude/state/demo/frontend.pid`, then checks that :3000 is free (else it prints `lsof` of the port and exits 1).
3. **Backend**: `run-safe.sh stop`.
4. **Redis**: `FLUSHDB` on database 3.
5. The schema `eval_demo` is kept. The next start empties it. It is small (about 1,000 users, 20,000 posts, 22,258 interactions).

**Checklist** (`scripts/demo/CHECKLIST.md`). For the presenter, one step per line, each with what to do, in which window, and what must happen. Window A is a normal Chrome window, window B is a private window. Steps: (0) `npm run demo:start` on the day, close to the demo; (1) in A sign in as the long-history user, in B as the little-history user; (2) in A, For You with Chronological, Engagement, Social: the order changes; the same in B; (3) Explore in A; (4) B opens A's profile, Message, sends a text: it shows in A without a reload, with the typing sign; (5) B likes a post of A: A's notification count goes up without a reload; (6) A signs out and signs in as `demo_admin`, opens the admin console, bans B's user: B is logged out at once; (7) `npm run demo:stop`. It also says what to do if a sign-in says "too many requests" (wait one minute), and that the checklist never runs `load:check` on `eval_demo`.

**Rehearsal** (DW8). Claude follows the checklist in one Chrome tab as window A. The Chrome extension has one cookie jar, so window B is a small helper script in the task folder (`peer.mjs`), which signs in as the other demo user or as `demo_admin` and sends the DM, the like and the ban through the API and Socket.IO. It is based on `.docs/works/2026-11-20-p10-demo-sweep/second-user.mjs`, with the account taken from an argument instead of `user2`. For the ban step the roles swap: the tab is the banned user and the helper is the admin. The results go to `rehearsal.md`, with the same columns as the sweep record (`sweep.md`): step, what was done, expected, PASS or FAIL, evidence. The author does one real pass with two windows before 2026-11-30.

**Rejected options:**

| Option | Why not |
|---|---|
| A bash script | The users command reads JSON from the API and compares lists; that is clumsy in bash. The other runners (`run-e7.mjs`, `thesis-repro.mjs`) are Node |
| A `--admin` flag in the loader | A change under `eval/src/`, out of scope (DW10). The loader writes only the canonical dataset, and `load:check` compares exactly that |
| Create the admin through the API | Register makes a USER and needs an email code; no route makes an ADMIN. One SQL insert is the only way without an app change |
| `docker compose up` for the full stack | It reads `.env` (live SMTP and Cloudinary) and deploys on schema `public` |
| `next build` + `next start` for the frontend | About a minute more at start, and every rebuild needs it again. Dev mode with the three pages warmed up is enough for a local demo |
| Redis database 4 for the demo | E7 uses database 3 too (`run-e7.mjs`, `REDIS_DB = 3`), but the two can never run at the same time (both need :4000, and `run-safe.sh` refuses a second backend), and each empties database 3 when it starts. The approved Spec says 3 |

### Workflow and sequence diagrams

```mermaid
sequenceDiagram
    participant P as Presenter
    participant S as demo.mjs start
    participant L as eval loader
    participant DB as Postgres eval_demo
    participant R as Redis db 3
    participant B as Backend :4000
    participant F as Frontend :3000
    P->>S: npm run demo:start
    S->>S: checks (node 22, db, redis, ports, run-safe status, dataset)
    S->>S: build shared and ranking, t = now (whole seconds)
    S->>L: load syn-W2M-M --schema eval_demo --rebase-to t
    L->>DB: migrate, empty, write all rows (one transaction)
    S->>DB: INSERT demo_admin (role ADMIN, password of a loaded user)
    S->>R: FLUSHDB
    S->>B: run-safe.sh start (DATABASE_URL eval_demo, REDIS_URL /3)
    B-->>S: /api/health 200
    S->>F: npm run dev (detached), wait for /sign-in 200, warm up / and /explore
    S->>S: users (below), write .claude/state/demo/demo.json
    S-->>P: URLs, logins, checklist path
```

```mermaid
sequenceDiagram
    participant S as demo.mjs users
    participant DB as Postgres eval_demo
    participant B as Backend :4000
    S->>DB: history and follow count per user (before t)
    DB-->>S: candidates of "little" (1-4) and "long" (20+), sorted
    loop each group, at most 4 candidates
        S->>B: POST /api/auth/login (email, password)
        B-->>S: 200 + breadit_session
        S->>B: GET /api/posts?algo=chrono | engagement | social
        B-->>S: 3 pages of 10 posts
        S->>S: pagesNotAllSame? then choose this user
    end
    S-->>S: print users, ids per algo, overlap with social
```

```mermaid
sequenceDiagram
    participant P as Presenter
    participant S as demo.mjs stop
    participant DB as Postgres eval_demo
    participant F as Frontend
    participant B as Backend
    participant R as Redis db 3
    P->>S: npm run demo:stop
    S->>DB: UPDATE "User" SET banned = false WHERE banned
    S->>F: kill process group (pid file), check :3000 free
    S->>B: run-safe.sh stop
    S->>R: FLUSHDB
    S-->>P: what was stopped, who was unbanned
```

### Failure modes

| # | What can go wrong | How we notice | How we resolve it |
|---|---|---|---|
| F1 | db or redis is down, Docker is off | start check 1 | exit 1 before the load: "Start them: docker compose up db redis -d" (DW2) |
| F2 | :3000 or :4000 is in use (a dev server, a backend on `public`, E7) | start check 1 (`lsof`, `run-safe.sh status`) | exit 1 before the load, with the `lsof` line and how to stop it (DW2). The script never reuses a running server, because its schema is unknown |
| F3 | `eval/data/syn-W2M-M/` does not exist | start check 1 | exit 1: "Run npm run gen -w @breadit/eval" |
| F4 | the shell exports `DATABASE_URL` or `REDIS_URL` for `public` | — | the script sets both for every child, so the shell values are never used. The loader also refuses any schema that is not `eval_` (`target.ts`) |
| F5 | old Redis entries: dev feed pages, login counters, blacklisted tokens | wrong posts on a page, "too many requests" | database 3 is emptied at start and stop. Database 0 (dev) and 2 (parity) are never touched (DW4) |
| F6 | E7 and the demo share Redis database 3 | — | they cannot run at once (F2), and each empties it when it starts |
| F7 | the load fails half way | non-zero exit of the loader | the loader's transaction rolls back; start exits 1 before the backend starts |
| F8 | the frontend does not come up in 180 s, or the first page compile is slow | the wait times out | start prints the last 30 lines of the frontend log, stops the backend and the frontend, exits 1. The warm-up of `/`, `/explore`, `/sign-in` takes the slow first compile away from the demo |
| F9 | the login limit (10 per minute per IP) during users or the demo | HTTP 429 | users makes at most 8 logins, and start empties the counters first. The checklist says: wait one minute. Login counters live in database 3, so a demo:stop + demo:start also resets them |
| F10 | no candidate in a group passes | users finds no user | exit 1, naming the group and the candidates tried. Not expected: `chrono` and `engagement` rank on different keys |
| F11 | two runs choose different users | DW5 compares two runs | the SQL order is fixed by the load. The feed uses the clock, so a page can change over time, but a candidate fails only if all three pages are the same, which does not happen to the first candidate in practice. If it does, the output says which candidate was skipped and why |
| F12 | start runs the evening before; posts look old | newest post date in Explore | the checklist says: run start on the day, close to the demo. The newest post is at the rebase time, and the 7-day window keeps Explore full for a week |
| F13 | a ban is left on after the demo | DW9 sign-in check | stop unbans every banned user in `eval_demo` by SQL, even with the backend down |
| F14 | `next dev` children survive the kill | :3000 still in use after stop | the frontend is started in its own process group and stop kills the group; then it checks the port and prints `lsof` if it is still in use |
| F15 | `load:check` on `eval_demo` reports a difference | DIFF lines | expected: the admin row is extra (loader F12). The checklist never runs it |
| F16 | the demo touches `eval_load` or `public` | `test:parity` (DW3), row counts (DW9) | the schema name is one constant `eval_demo`, and it is the only schema the script loads into or writes SQL to |
| F17 | an old Node version | start check 1 | exit 1: "Run nvm use" (the loader `.ts` files need Node 22) |
| F18 | blocked users, pending community posts, soft-deleted rows | — | nothing new: the demo uses the app as it is. The loaded data has no blocks and no pending posts; the feeds filter as usual |

### Code files

| File | New or changed | Purpose |
|---|---|---|
| `scripts/demo/demo.mjs` | new | The entry point: `start`, `users`, `stop` as above. Constants `SCHEMA = 'eval_demo'`, `REDIS_DB = 3`, `DATASET = 'syn-W2M-M'`, the two URLs, `STATE_DIR = .claude/state/demo`. Helpers `containerName(service)`, `psql(sql)`, `redisFlush()`, `portFree(port)`, `waitFor(url, seconds)`, `login(email)`, `firstPage(cookie, algo)` |
| `scripts/demo/lib.mjs` | new | Pure helpers: `rebaseIso(d: Date): string` (UTC, whole seconds, `YYYY-MM-DDTHH:MM:SSZ`); `feedIds(body): number[]` (the post ids of a `GET /api/posts` page, `{ posts, hasMore, nextCursor }`); `pagesNotAllSame(pages: number[][]): boolean`; `overlap(a, b): number`; `orderCandidates(rows, group): rows` (the group filter and the sort of users step 2); `pickUser(candidates, tryOne, max = 4)` (the first that passes, plus the list of skipped ones with the reason) |
| `scripts/demo/lib.test.mjs` | new | `node:test` tests of `lib.mjs`: the time format (whole seconds, `Z`, a date with milliseconds), the group bounds (history 0, 1, 4, 5, 19, 20; follow count 0), the sort and its tie on id, `pagesNotAllSame` (three equal lists, two equal, all different), `pickUser` stops after `max` |
| `scripts/demo/CHECKLIST.md` | new | The presenter's steps and expected results (Approach, Checklist) |
| `package.json` (root) | changed | `demo:start`, `demo:users`, `demo:stop` → `node scripts/demo/demo.mjs <command>` |
| `.docs/works/2026-11-22-p10-demo-script/peer.mjs` | new | Rehearsal only, not part of the demo: the second user (any demo email, or `demo_admin`) with `dm`, `typing`, `like`, `ban`, `unban`, based on the sweep's `second-user.mjs` |
| `.docs/works/2026-11-22-p10-demo-script/rehearsal.md` | new | The rehearsal record (DW8) |
| `CLAUDE.md` | changed | Commands: the three demo commands, schema `eval_demo`, Redis database 3, "run nothing else on :3000 and :4000" |
| `docs/System_Architecture.md` | changed | the schema table gets `eval_demo`; the loader paragraph says the demo loads into `eval_demo`; the row "Slides and demo": the demo script ✅, the slides still 🔜 |
| `docs/Guidance-Manual/en/04-data.md`, `vi/04-data.md` | changed | "Into Postgres": the demo loads into `eval_demo` with `--rebase-to`, not into `eval_load` |
| `.docs/implementation-plan.md` | changed | §5 row 22 ✅ and a change log line |

No file under `apps/`, `packages/` or `eval/src/` changes (DW10).

### Data, schema and cache changes

- **Postgres.** A new schema `eval_demo`, made and filled by the loader with the normal migrations (no new migration, no change to `schema.prisma`). One extra row: the `demo-admin` user. Nothing is written to `public`, `eval_load` or `it_test`.
- **Redis.** Database 3 only: the backend's feed cache, `v:user` versions, login counters and the logout blacklist of the demo. Emptied at start and at stop. No new cache key and no new version.
- **Local files.** `.claude/state/demo/` (git-ignored by `.claude/state/*`): `frontend.pid`, `frontend.log`, `demo.json`. The backend keeps its own `backend.pid` and `backend.log` from `run-safe.sh`.
