# Plan: Postgres loader for canonical datasets

Status: done · 2026-11-10
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-10-p3-postgres-loader/`

---

## How to read this plan

- **New code in `eval/` only**, plus `eval/package.json` and `package-lock.json`. Do not touch `apps/`, `packages/`, the Prisma schema or its migrations, `docs/`, `Latex/`, `.env`, `.claude/` or `eval/data/`.
- **Needs:**
  - The pinned Node (`source ~/.nvm/nvm.sh`, then `nvm use` in the repo root; `node -v` must print the `.nvmrc` version).
  - A generated Prisma client (CLAUDE.md, Prisma).
  - Docker db and redis (`docker compose up db redis -d`) for Step 5 only. Steps 1–4 need no Docker.
- **Who does what.** Sonnet does Steps 1 to 5. Claude does "Claude's part" and the Acceptance. Sonnet does not edit `CLAUDE.md`, `README.md`, `.docs/super-plan.md`, `.docs/implementation-plan.md` or `design.md`.
- **Rules for every step.**
  - **Tests first.** Write the test, run it, see it fail for the right reason, then write the code.
  - **Determinism.** Follow `.claude/rules/determinism.md`: no clock, no `Math.random`, `new Date(x)` always with an argument, and every `.sort` with a compare function. `forbidden.test.ts` must stay green.
  - **Dependencies.** The only new one is `@prisma/client` in `eval/package.json`, with the backend's range `^6.2.1` (design: Code files). If npm stops on the Nest peer conflict, use `--legacy-peer-deps` (CLAUDE.md).
  - **Database safety.** Never `prisma db push`. Never connect to `public` or `it_test`; the target always comes from `targetUrl` (design F1).
  - **When stuck.** If a step cannot be done as written, stop and report what and why. Do not work around it.
- **Commits** go on `test-app` and are never pushed. One commit per step, holding its own files and this `plan.md` (the ticks).
  - Stage files by path. Never stage `eval/data/`, `eval/results/` or `datasets/`.
  - End every commit message with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
  - Approving this plan approves the commits listed.
- Effort scale: XS under 30 minutes, S under 2 hours, M half a day.

## Steps

#### Step 1: Target, ids and time helpers (effort S)

- [x] Tests first:
  - **TC1** (`eval/src/loader/target.test.ts`): `targetUrl` refuses `public`, `it_test`, an empty name, upper case and odd characters. It sets `?schema=eval_load` on a URL with no schema, and overwrites an existing `?schema=public`. The rest of the URL is unchanged.
  - **TC2** (`eval/src/loader/time.test.ts`):
    - `parseRebase` takes only `YYYY-MM-DDTHH:MM:SSZ` (refuses no `Z`, milliseconds, an offset, a bad date);
    - `lastEventTime` is the largest time over all six tables;
    - `rebaseShift` lands the latest event exactly on the given time;
    - `toDate` and `fromDate` are inverses for a shift of 0 and a nonzero shift;
    - `fromDate` refuses a `Date` that is not a whole second.
  - In TC3 (Step 2) or here: `appUserId(42)` is `u0000000042`, `canonicalUserId` reverses it and refuses anything else, and `repostOffset` is the largest `postId` (0 for no posts).
- [x] Write `eval/src/loader/target.ts`, `eval/src/loader/ids.ts` and `eval/src/loader/time.ts` with the signatures of design Code files (design: Approach, the "Ids", "Time" and target paragraphs).
- [x] `PASSWORD_HASH` in `ids.ts`: compute it once, with the `bcryptjs` the backend already has, as a bcrypt hash of `password` at cost 10, and check it with `bcrypt.compare`. Paste it as a constant, with a one-line comment saying how it was made. Do not add `bcryptjs` to `eval` (design: rejected "Hash the password at load time").
- [x] Commit: `feat: eval loader target guard, ids and time helpers`

#### Step 2: Mapping both ways (effort S)

- [x] Tests first, **TC3** (`eval/src/loader/map.test.ts`):
  - **Round trip:** `fromAppRows(toAppRows(d, e, s), e, s)` deep-equals `d` (after the §2.2 sort) for the golden fixture (`src/harness/fixtures/golden`: 27 likes, 4 comments, 2 reposts, read with `loadDataset`) and for `randomDataset` (`src/harness/random-data.ts`), each with shift 0 and a nonzero shift.
  - **Ids:** user ids and usernames are `u` plus 10 digits. Post, community, like and comment ids are the CSV ids and event ids. Every repost id is `repostOffset + event_id`, above every post id, and unique. `Follow` and `CommunityMember` ids are 1…n in canonical sort order.
  - **Fixed fields** (design table "Fields that are not in the CSV"): email, display name, `PASSWORD_HASH`, `emailVerified` = `createdAt`, `updatedAt` = `createdAt`, community name and slug, role `MEMBER`, post and comment text, `isApproved` true, a repost's `desc` and `communityId` null, `notify` false.
  - **Two runs:** two calls of `toAppRows` on the same input give deep-equal output.
  - **`detectShift`:** finds 0 for unshifted rows and the right value for shifted rows.
- [x] Write `eval/src/loader/map.ts`: `AppRows`, `toAppRows`, `fromAppRows`, `detectShift` (design: Code files, Approach). No Prisma import here.
- [x] Commit: `feat: eval loader mapping between canonical and app rows`

#### Step 3: Prisma dependency, import guard and database file (effort S)

- [x] Add `@prisma/client` `^6.2.1` to `eval/package.json` dependencies. Check that `package-lock.json` changed only for this, and that the Prisma client still resolves (generate it again if the install removed it).
- [x] Tests first, **TC4** (`eval/src/imports.test.ts`): a detector finds `from "@prisma/client"` and `from '@prisma/client'` in sample text (and not in a comment that only names it). Then no file outside `src/loader/` imports it. Use the same file walk as `forbidden.test.ts`, with a sort compare function.
- [x] Write `eval/src/loader/db.ts` (design: Approach "Load" and "Check", insert order under Code files, F2–F7):
  - **`migrate(url)`** runs `prisma migrate deploy` with the backend schema from the repo root, as a child process with `DATABASE_URL` set to `url`. On failure it throws with the `global-setup.ts` wording about Docker.
  - **`load(url, rows)`** opens one interactive transaction with an explicit 300 s timeout. Inside it:
    - truncate every table of the target schema except `_prisma_migrations`, with `RESTART IDENTITY CASCADE`;
    - `createMany` in batches of 1,000, in the design's insert order;
    - `setval` on the six sequences;
    - count `User`, `Follow`, `Community`, `CommunityMember`, `Post` (and reposts separately), `Like`, `Comment`.
  - **`readBack(url)`** reads the same tables with `orderBy: { id: 'asc' }` into `AppRows`.
  - **Identifiers.** The schema name in raw SQL comes only from a name that passed `targetUrl`'s check.
  - **No unit test** needs a database. Typecheck must pass.
- [x] Commit: `feat: eval loader database steps (migrate, load, read back)`

#### Step 4: The two commands (effort S)

- [x] Write `eval/src/cli/load.ts` and `eval/src/cli/load-check.ts` (design: Approach "Load" and "Check", both sequence diagrams). Both call `checkNode()` first and take `<datasetId>` (folder `eval/data/<datasetId>/`) and `--schema`. `load` also takes `--rebase-to`, and `load-check` also takes `--out` (default `eval/results/load-check/<datasetId>/`).
  - **`load`** refuses a manifest whose `source.kind` is not `synthetic` (F13). It prints the schema name (not the full URL), the counts per table, the shift and the latest time as ISO, plus the run time in seconds (Class R, for F5).
  - **`load-check`** prints one line per file (`ok` or `DIFF` with both hashes), the shift and the latest time. It exits 1 on any `DIFF`, and says the check is meant right after a load (F12).
  - **Errors** go to stderr with exit code 1, in the style of `cli/adapt-digg.ts`.
- [x] Add the scripts `load` and `load:check` to `eval/package.json`.
- [x] `npm run verify -w @breadit/eval` passes.
- [x] Commit: `feat: eval load and load:check commands`

#### Step 5: Run on `syn-W2M-M` (effort S)

Needs Docker db and redis.
- [x] Count the rows of every table in `public` and save the counts (for DW4).
- [x] `load` `syn-W2M-M`, then `load:check`. All six lines must say `ok` (DW2), and the counts must equal DW3. If a hash differs, find the mapping rule that differs and report. Do not change the dataset or the check to make it pass.
- [x] `load` again, then `load:check` again. Both runs must give the same output apart from the run time (DW3).
- [x] `load --rebase-to 2026-11-18T12:00:00Z`, then `load:check`. The latest time must be 2026-11-18T12:00:00Z, and all six lines `ok` (DW6).
- [x] `load` once more without `--rebase-to`, so the schema ends in the plain state that task 8 uses.
- [x] Count the rows of every table in `public` again. They must equal the first counts (DW4).
- [x] Save the outputs of these runs (counts, check lines, shift, latest time, run times, both `public` counts) as `check_output.txt` in this task folder.
- [x] Commit: `chore: P3 syn-W2M-M loaded and checked in eval_load`

## Claude's part

- [x] Read the commits and the diff against the design.
- [x] `bash .claude/hooks/verify.sh` with db and redis up (DW1).
- [x] The Acceptance items below.
- [x] Docs (DW7):
  - **`CLAUDE.md`:** the Overview line ("only the planned loader writes to Postgres") and the Eval commands name `load` and `load:check`, the `eval_load` schema and the Docker need.
  - **`README.md`:** the eval commands.
  - **`docs/Guidance-Manual/en/04-data.md` and `vi/04-data.md`:** the load command, the same content in both.
  - **`docs/System_Architecture.md`:** the loader ✅ in its rows, the tree and the status table, and the storage row answered with `eval_load`.
  - **`.docs/super-plan.md`:** a P3 status paragraph, the §4 row (P3 ✅, `p3-postgres-loader` ✅) and a change-log line.
  - **`.docs/implementation-plan.md`:** the §1 `eval/` row (loader done), §5 row 7 ✅, and a change-log line.
  - Commit: `docs: close p3-postgres-loader`.
- [x] Fill in the Result, then close the task.

## Tests

All tests are unit tests in `eval/src/**/*.test.ts` under `node --test` and the pinned Node. None needs Docker, Postgres or the network. The database checks are Step 5 and the Acceptance items.

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW1, DW4, design F1 | unit | `targetUrl` refuses `public`, `it_test` and bad names, and always overwrites `schema` |
| TC2 | DW6, design F9, F10 | unit | Rebase format, latest event, shift, `toDate` and `fromDate`, whole seconds |
| TC3 | DW2, DW3, design F8 | unit | Round trip on the golden fixture and random data, ids, repost ids, fixed fields, two runs equal, `detectShift` |
| TC4 | DW1 | unit | Only `src/loader/` imports `@prisma/client` |
| — | DW1, design F15 | unit | The existing `forbidden.test.ts` now also walks `src/loader/` (no change needed) |

## Acceptance

- [x] `bash .claude/hooks/verify.sh` with db and redis up → every check passes, including eval verify with the new tests (DW1)
- [x] `load` then `load:check` on `syn-W2M-M` → 6 of 6 `ok`, equal to the dataset manifest (DW2)
- [x] A second `load` and `load:check` → the same output; counts `User` 1,000, `Follow` 12,126, `Community` 20, `CommunityMember` 1,773, `Post` 22,212 (2,212 of them reposts), `Like` 16,616, `Comment` 3,430 (DW3)
- [x] Row counts of every table in `public` before and after the loads → equal (DW4)
- [x] The backend from `run-safe.sh` with `DATABASE_URL` set to `?schema=eval_load` and `--no-cache`. Sign in as `u0000000001@example.com` with `password` → 200 and a session cookie. Then create one post → created, with an id above every `Post` id that was there before (DW5). Stop the backend after.
- [x] `load --rebase-to 2026-11-18T12:00:00Z` then `load:check` → latest time 2026-11-18T12:00:00Z and 6 of 6 `ok`. Then a plain `load` again (DW6)
- [x] The docs of "Claude's part" → loader ✅, the storage question answered, the commands listed in both languages, no "planned loader" left (DW7)
- [x] `git diff --stat` of the task commits → only the files of design Code files, this folder and `check_output.txt`

## Result

**Delivered, 2026-11-10.**
- **Load.** `npm run load -w @breadit/eval -- <datasetId>` writes a synthetic dataset into the Postgres schema `eval_load` (never `public`) with explicit ids, in one transaction.
- **Check.** `npm run load:check` reads it back and compares the six canonical files with the dataset manifest.
- **End state.** The schema ends in the plain `syn-W2M-M` state for task 8.

**Numbers.** Sonnet's runs are in `check_output.txt`, and Claude ran every check again.
- **Counts (DW3),** in every load: `User` 1,000; `Follow` 12,126; `Community` 20; `CommunityMember` 1,773; `Post` 22,212 (20,000 posts, 2,212 reposts); `Like` 16,616; `Comment` 3,430.
- **Hashes (DW2, DW3).** All six exported files equal the manifest (for example `interactions.csv` `512c7feb…6861`), in every plain load and in the rebase load. Two exports were byte-identical.
- **Rebase (DW6).** `--rebase-to 2026-11-18T12:00:00Z` gives a shift of 5,313,617 s and a latest time of 2026-11-18T12:00:00Z, with 6 of 6 `ok`. A plain load gives shift 0 and a latest time of 2026-09-17T23:59:43Z.
- **`public` (DW4).** Every row count was equal before and after, for example `User` 106, `Post` 890, `Like` 2,001.
- **App on the loaded schema (DW5).** With the backend from `run-safe.sh` (`?schema=eval_load`, `--no-cache`), signing in as `u0000000001@example.com` returned 200. A new post got id 42,251, above the largest loaded id 42,250. The final plain load removed that post.
- **Load time:** about 3 s (2.9–3.8 s; Class R, not compared).

**Tests.** Eval: 297 pass (was 257). `verify.sh`: all 9 checks pass (ranking 82, backend unit 99, integration 108, eval verify 297).

**Commits.**
- Docs: `e9030ff`.
- Steps 1–5: `95a9937`, `a5c7071`, `ed50b45`, `29cbc36`, `6667c2c`.
- Closing docs: the commit that holds this Result.

**Differences from the plan.**
- **`schemaOf(url)` in `target.ts`** (not in the design list). `db.ts` uses it, so every schema name that goes into raw SQL passes the `eval_` check.
- **Tests.**
  - The id tests are in their own `ids.test.ts`.
  - `imports.test.ts` also checks that only `db.ts` imports Prisma inside `src/loader/`.
- **Guards.**
  - `toAppRows` refuses an `event_id` below 1, which would clash with the largest post id.
  - `load` reads the manifest before the data, so `digg2009` is refused at once.
- **Implementation choices.**
  - Arguments use `node:util` `parseArgs`.
  - The run time uses `performance.now()` with a `harness-allow` comment (Class R, printed only).
  - `readBack` fills unused fields with fallbacks when they are null; `fromAppRows` ignores those fields.
- **Docs beyond the plan's list.**
  - Blueprint §2.5 now says what the loader writes for task 8: positives in three tables, repost rows left out of the live pool.
  - System_Architecture and the super plan mark task 8 as next.

**Open points.**
- **`randomDataset(SMALL)` repeats user id 11** (`eval/src/harness/random-data.ts`). This is an old bug in a shared test helper. `map.test.ts` works around it and says so. Fix it later in its own small change.
- **`load:check` against the wrong dataset** fails with an error (a negative canonical time) instead of DIFF lines. It still exits 1.
- **Redis for the demo.** The loader does not touch Redis. Task 13 must clear the cache or turn it off when the backend runs on `eval_load` (design F11).

