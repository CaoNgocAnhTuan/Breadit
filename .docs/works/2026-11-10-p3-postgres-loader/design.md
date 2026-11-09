# Postgres loader for canonical datasets

Spec status: approved · 2026-11-10
Design status: approved · 2026-11-10
Type: feature · Folder: `.docs/works/2026-11-10-p3-postgres-loader/`

## 1. Spec

### Problem

The live app cannot run on a canonical dataset yet. Three later tasks need it to:
- **Task 8 (`p6-social-feed`).** Its "Done when" is the parity test: 100 (user, `asOf`) pairs of `syn-W2M-M` loaded into Postgres, live order equal to harness order (super-plan P6, blueprint §2.9).
- **Task 10 (`p7-cost-benchmark`).** E7 runs on "live app with `syn-W2M-M` loaded" (blueprint §4).
- **Task 13 (`p10-defense-package`).** The demo uses generated data loaded with `--rebase-to` (super-plan P10).

Evidence that nothing does this today:
- `eval/src/` has no `loader/` folder, and `eval/package.json` has no `@prisma/client` dependency and no load script (file listing, 2026-11-10).
- The seed cannot replace it. `seed.ts` is not deterministic, and `humans_v1` has 0 follows and 0 likes (super-plan §3, "Data").
- `docs/System_Architecture.md` marks the loader 🔜 and lists "a separate schema or a separate database" as an open question for this task (its storage table).

The blueprint fixes what the loader must keep: the canonical files of §2.2 (hand-off H-a), user ids written as `u` plus the integer padded to 10 digits (`u0000000042`), and post ids written explicitly (§2.5). `eval` may import `@prisma/client` only in `src/loader/` (§1).

### Scope

**In scope:**
- **A load command** for one canonical dataset folder, `npm run load -w @breadit/eval -- <datasetId>`. It writes the six canonical tables into Postgres with the ids of the CSV files (blueprint §2.5). It is built and checked on the synthetic datasets, and `syn-W2M-M` is the one later tasks use.
- **A clean target every time.** The loader empties its target before writing, so two loads give the same state. Its target is never the dev schema `public` (Open question 1).
- **Mapping to app tables.** The app decides where each row goes, because the feed counts comments and reposts from different tables (`_count.comments` and `_count.rePosts` in `posts.service.ts`):

  | Canonical | App table | Note |
  |---|---|---|
  | `users.csv` | `User` | id and username `u0000000042`; email verified; the seed users' password, so the demo can sign in |
  | `follows.csv` | `Follow` | |
  | `communities.csv`, `memberships.csv` | `Community`, `CommunityMember` | role `MEMBER` |
  | `posts.csv` | `Post` | approved, not deleted, short text built from the ids |
  | `interactions.csv` `like` | `Like` | |
  | `interactions.csv` `comment` | `Comment` | short text built from the ids |
  | `interactions.csv` `repost` | `Post` with `rePostId` | a repost is a post row in the app |

  Every time is the manifest epoch plus the CSV seconds. Text comes from ids only, never from randomness.
- **Writable after a load.** Every id sequence is moved past the largest loaded id, so the app can still create posts, likes and follows (the demo needs this).
- **An export** that reads the six canonical tables back out of Postgres into canonical CSV files. The round-trip check (DW2) uses it.
- **`--rebase-to <ISO time>`, demo only.** It adds one constant shift to every time, so the dataset's last event lands at the given time. The time is an argument, because the determinism rule forbids the clock in `eval/` (super-plan §2). Experiments never use it.
- **Tests and docs.** Unit tests for the mapping and the shift, without a database. The docs that mention the loader or list the eval commands (DW7).

**Out of scope:**
- **Loading `digg2009`.** No later task needs it in Postgres. It has 336,047 users and 3,007,345 likes (super-plan P4 status). Not checked.
- **The parity test, the `algo` option and the `asOf` flag.** They belong to task 8.
- **Any backend, frontend or schema change.** No new migration, no unique keys (T6 stays cut, super-plan §9).
- **Redis.** The loader never touches Redis, the same as the rest of `eval/` (blueprint §1). Clearing the cache for the demo is for task 13. The parity test runs with the cache off.
- **Rows with no canonical source:** notifications, hashtags, mentions, media, saved posts, blocks, bans.

### Done when

The Postgres checks need `docker compose up db redis -d`. The row counts come from the `syn-W2M-M` files on 2026-11-10 (`wc -l` and the `type` column of `interactions.csv`).

| # | Check | Expected result |
|---|---|---|
| DW1 | `npm run verify -w @breadit/eval` | Typecheck and every test pass, including the new loader tests and the forbidden-pattern test over `src/loader/`. A test shows that only files in `src/loader/` import `@prisma/client` |
| DW2 | Load `syn-W2M-M`, then export it | The six exported files have the same SHA-256 as `eval/data/syn-W2M-M/manifest.json` (6 of 6) |
| DW3 | Load `syn-W2M-M` a second time, then export again | Byte-identical with the first export. Row counts: `User` 1,000; `Follow` 12,126; `Community` 20; `CommunityMember` 1,773; `Post` 22,212 (20,000 posts and 2,212 reposts); `Like` 16,616; `Comment` 3,430 |
| DW4 | Count the rows of every table in `public` before and after a load | Equal |
| DW5 | Start the backend on the loaded target. Sign in as `u0000000001` with the seed password, then create one post through the API | Sign-in works, the post is created (no id clash), and its id is above the largest loaded post id |
| DW6 | Load with `--rebase-to 2026-11-18T12:00:00Z`, then export | The latest time in the export is 2026-11-18T12:00:00Z. After the shift is removed, the export has the same six hashes as in DW2 |
| DW7 | Read the updated docs | `docs/System_Architecture.md` marks the loader ✅ and answers its open storage question. `CLAUDE.md`, `README.md` and Guidance Manual 04 (en and vi) list the load command. `CLAUDE.md` no longer calls the loader "planned" |

### Open questions

1. **Where does the loader write?** My recommendation is (a).
   - **(a) A separate schema in the same database**, for example `eval_load`, chosen with `?schema=` in `DATABASE_URL`. The integration tests already work this way with `it_test`: `migrate deploy`, then `TRUNCATE ... RESTART IDENTITY CASCADE` (`apps/backend/test/it/global-setup.ts`). The dev data in `public` stays safe, and the backend runs on the loaded data by changing one env value.
   - **(b) The `public` schema, after emptying it.** The demo needs no env change, but every load wipes the seed users and the `humans_v1` rows, and the seed must be run again afterwards.
   - **(c) A separate database.** It needs a `CREATE DATABASE` step and gives nothing that a schema does not.

## 2. Impact

**Who needs it.** Tasks 8, 10 and 13. Without the loader, the P6 "Done when" cannot be checked, E7 has no data to run on, and the demo has only the seed. The parity test is the proof that the thesis numbers describe the live feed (super-plan P6, `docs/System_Architecture.md` §6.4).

**Thesis numbers.** None directly. Every Class D number comes from CSV files, never from Postgres (super-plan §2). The loader feeds the parity test, which checks correctness, and E7, which is Class R. No frozen value (super-plan §7) is touched, and `--rebase-to` is never used by an experiment.

**Code areas.**
- New: `eval/src/loader/` and a CLI file in `eval/src/cli/`.
- Changed: `eval/package.json` (the `@prisma/client` dependency at the backend's version 6.2.1, plus scripts) and `package-lock.json`.
- No change to the backend, frontend, Prisma schema or migrations.

**Consequences for task 8.** Both follow from the mapping above.
- Reposts become `Post` rows with `rePostId`. The harness pool holds only canonical posts, so the live candidate query must leave repost rows out, or the pools differ.
- The live `engagedBy` must count likes, comments (`Comment`) and reposts (`Post.rePostId`), the same three positives as the harness.

**Related bugs.**
- **T6.** The tables have no unique keys. Loaded data has no duplicates, because the generator writes none.
- **R2.** Every loaded post is approved.
- **D1.** A community post's author is a member. The generator keeps this rule, and the loader copies the rows unchanged.
- **T4.** Explore still uses the clock until task 8, so loaded data from mid-2026 is outside its 7-day window. This is why the demo needs `--rebase-to`.
- **R7.** The target schema is built with `migrate deploy`, never `db push` (the hook refuses it too).

A fresh schema built with `migrate deploy` also gets the `humans_v1` rows from the two data migrations. The loader must empty them, as the integration test setup does.

**Risks, not checked yet.**
- **Prisma from ESM.** `eval` is ESM and runs `.ts` files directly. How `@prisma/client` (CommonJS) imports there is not checked.
- **`npm ci` deletes the generated client.** After it, the loader needs `npx prisma generate --schema=apps/backend/prisma/schema.prisma` again (CLAUDE.md, Commands).
- **Docker.** It was not reachable at the start of this session. DW2 to DW6 need it.

**Schedule.** Task 7 had a budget of 1 day and a planned end of 11-09 (blueprint §5). It starts on 11-10, so it is one day late. The blueprint's cut 5 (drop the frontend toggle) triggers when task 8 has not started on 11-10, which is today.

## 3. Design

### Approach

**Target: option (a) of Open question 1.** The approved Spec rules out `public`, so the loader writes into its own Postgres schema, `eval_load` by default. It never trusts the schema in `DATABASE_URL`. It takes the base URL (the shell's `DATABASE_URL`, else the Docker default `postgresql://breadit:breaditpassword@localhost:5433/breadit`, the same as `run-safe.sh` and `test/it/env.ts`). Then it overwrites the `schema` parameter with a name that must match `^eval_[a-z0-9_]+$`, so `public` and `it_test` are impossible targets. Like `run-safe.sh`, it never reads `.env`.

**One pure core, one thin database file.** All the mapping lives in pure functions with no Prisma import:
- `toAppRows` turns a canonical dataset into app rows.
- `fromAppRows` turns them back.
- The time helpers handle the shift.

Only `src/loader/db.ts` imports `@prisma/client` (blueprint §1). It runs the migrations, empties the schema, writes and reads rows. The unit tests cover the pure core with no database. The database steps are checked by the two commands below, as acceptance items.

**Load** (`npm run load -w @breadit/eval -- <datasetId> [--schema eval_x] [--rebase-to <ISO>]`):
1. Read the dataset with `loadDataset` (`src/canonical/dataset.ts`). Refuse a manifest whose `source.kind` is not `synthetic` (Digg is out of scope).
2. Build the app rows.
3. Run `npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma` from the repo root with the target URL, as `test/it/global-setup.ts` does. On a new schema this creates every table, plus the `humans_v1` rows of the two data migrations.
4. In one interactive transaction:
   - truncate every table of the schema except `_prisma_migrations` (`TRUNCATE ... RESTART IDENTITY CASCADE`, the same statement as `global-setup.ts`, which also removes the `humans_v1` rows);
   - insert the rows in foreign-key order with `createMany` in batches of 1,000;
   - move the six sequences with `setval`;
   - count the rows.

   A failure rolls everything back, so the schema keeps its previous state.

**Check** (`npm run load:check -w @breadit/eval -- <datasetId> [--schema eval_x] [--out <dir>]`):
1. Read the app rows back, ordered by id.
2. Find the shift: the latest time in the database minus the dataset's latest time.
3. Map the rows back to canonical rows with that shift and write them with `writeTable` (`src/canonical/csv.ts`), which sorts by the §2.2 keys. They go to `eval/results/load-check/<datasetId>/` (git-ignored).
4. Compare the six SHA-256 with the dataset manifest, and print one line per file, the shift and the latest time. Exit 1 on any difference.

This one command covers DW2, DW3 and DW6. A non-constant shift, a lost row or a changed id all break a hash.

**Ids** (blueprint §2.5):
- **User.** `id` and `username` are `u` plus the integer padded to 10 digits.
- **Post, Community.** The CSV id.
- **Like, Comment.** `id` is the `event_id`, so the export rebuilds `interactions.csv` exactly.
- **Repost rows** (`Post` with `rePostId`). `id` = R + `event_id`, where R is the largest canonical `post_id` (20,000 for `syn-W2M-M`). Repost ids then start after the posts, and event ids are unique, so nothing clashes. The export finds R again as the largest id among `Post` rows with no `rePostId`.
- **Follow, CommunityMember.** No canonical id. They get 1…n in canonical sort order, and the export ignores them.

**Fields that are not in the CSV.** All are fixed or built from ids, so two loads write the same rows:

| Table | Fields |
|---|---|
| `User` | `email` `u0000000042@example.com` (the seed style, `@IsEmail()` accepts it); `displayName` `User 42`; `password` one constant bcrypt hash of `password`, computed once with `bcryptjs` at cost 10 (as `seed.ts` does) and kept in the code; `emailVerified` = `createdAt`, so `EmailVerifiedGuard` lets writes through; `updatedAt` = `createdAt` |
| `Community` | `name` `Community 17`; `slug` `c17` |
| `CommunityMember` | `role` `MEMBER` |
| `Post` | `desc` `Post 42`; `isApproved` true; `deletedAt` null. A repost row has `desc` null and `communityId` null |
| `Comment` | `body` `Comment 123` (the event id) |
| `Follow` | `notify` false |

Every `updatedAt` equals `createdAt`. Prisma uses a given `@updatedAt` value instead of the clock (Prisma docs; not run yet).

**Time.** A time is `new Date((epoch.seconds + t + shift) * 1000)`, with the epoch from the manifest. Back from the database, a time that is not a whole second is an error. `--rebase-to` accepts only `YYYY-MM-DDTHH:MM:SSZ`. The shift is that time minus the epoch-based time of the dataset's latest event over all six tables. No clock is read.

**Checked on 2026-11-10:**
- `import { PrismaClient, Prisma } from '@prisma/client'` works in ESM from `eval/` on Node v22.23.4 (`PrismaClient` is a function, and `Prisma.ModelName` has 25 models). Prisma's `import` condition points at the CommonJS `default.js`, and Node finds the named exports.
- `run-safe.sh` keeps an exported `DATABASE_URL`, so DW5 starts the backend with `?schema=eval_load` and changes no script.

**Rejected options:**

| Option | Why not |
|---|---|
| Write through the backend API (register, follow, like) | It cannot set ids or times, and it sends email and notifications. It is also slow |
| Raw `COPY` with the `pg` package | A new dependency, and the blueprint names `@prisma/client` for the loader. 57,000 rows do not need `COPY` |
| `public` schema or a separate database | Open question 1, options (b) and (c) |
| Reposts with a fixed id offset of 1,000,000,000 | The `Post` sequence would jump past 10⁹, so new demo posts get huge ids. R = the largest post id keeps ids small |
| Store the shift in a table | It needs a schema change (out of scope). The check finds the shift from the data instead |
| Database tests inside `npm run verify` | `verify` would fail whenever Docker is down. The database steps are acceptance checks with `load:check` |
| Hash the password at load time | `bcryptjs` uses a random salt, so two loads would differ, and `eval` would need a new dependency |

### Workflow and sequence diagrams

Load:

```mermaid
sequenceDiagram
    participant A as Author
    participant L as cli/load.ts
    participant M as loader/map.ts, time.ts
    participant D as loader/db.ts
    participant P as Postgres (schema eval_load)
    A->>L: npm run load -- syn-W2M-M [--rebase-to T]
    L->>L: checkNode, parse args, targetUrl(base, schema)
    L->>M: loadDataset, rebaseShift, toAppRows
    M-->>L: AppRows (no Prisma types)
    L->>D: migrate(url)
    D->>P: npx prisma migrate deploy (child process)
    L->>D: load(url, rows)
    D->>P: BEGIN, TRUNCATE all tables except _prisma_migrations
    D->>P: createMany in FK order, 1,000 rows per batch
    D->>P: setval on six sequences, count rows, COMMIT
    D-->>L: counts
    L-->>A: counts per table, shift, latest time
```

Check:

```mermaid
sequenceDiagram
    participant A as Author
    participant C as cli/load-check.ts
    participant D as loader/db.ts
    participant M as loader/map.ts, time.ts
    participant F as canonical/csv.ts
    A->>C: npm run load:check -- syn-W2M-M
    C->>D: readBack(url)
    D-->>C: AppRows, ordered by id
    C->>M: detectShift(rows, dataset), fromAppRows(rows, epoch, shift)
    C->>F: writeTable x6 into eval/results/load-check/<id>/
    C->>C: compare six sha256 with the dataset manifest
    C-->>A: one line per file (ok or DIFF), shift, latest time, exit 0 or 1
```

### Failure modes

| # | What can go wrong | How we notice | How we resolve it |
|---|---|---|---|
| F1 | The target is `public`, `it_test` or a typo | `targetUrl` throws before connecting | The schema name must match `^eval_[a-z0-9_]+$`, and the URL's own `schema` is always overwritten. Unit test. DW4 checks `public` |
| F2 | Docker is down | `migrate deploy` fails | Exit 1 with "Is `docker compose up db redis -d` running?" (same words as `global-setup.ts`) |
| F3 | The Prisma client is missing after `npm ci` | The import or `tsc` fails | The error names `npx prisma generate --schema=apps/backend/prisma/schema.prisma`, as in CLAUDE.md |
| F4 | A load fails halfway | Exception inside the transaction | The transaction rolls back and the schema keeps its last good load. Exit 1 |
| F5 | The transaction times out | Prisma `P2028` | The timeout is set explicitly (300 s). The M dataset is 57,183 rows; its load time is not measured yet |
| F6 | `humans_v1` rows stay after `migrate deploy` | DW3 counts (`User` would be above 1,000) | The truncate runs after the migrations, in the same transaction as the inserts |
| F7 | A sequence is behind the loaded ids, so the app's next insert clashes | DW5 (create a post) | `setval` on `Post`, `Like`, `Comment`, `Follow`, `Community`, `CommunityMember` to their largest id |
| F8 | A repost id clashes with a post id | Unit test on the fixtures | R = largest post id, and event ids are unique |
| F9 | A time comes back with milliseconds, or the shift is not constant | `fromDate` throws, or `load:check` shows DIFF | Times are written as whole seconds. The check compares hashes after removing one shift |
| F10 | A bad `--rebase-to` (no `Z`, milliseconds, not a date) | Argument check | Exit 1 with the accepted format |
| F11 | Stale Redis entries when the backend switches to `eval_load` (Redis database 0 is shared with dev, and post ids overlap with dev posts) | Feed or post pages show dev content | The loader does not touch Redis (Spec). DW5 runs with `--no-cache`, and task 13 decides how the demo clears the cache |
| F12 | `load:check` runs after the demo added rows | DIFF lines | The check is only meant right after a load, and its output says so |
| F13 | A non-synthetic dataset (`digg2009`) | Manifest `source.kind` | Exit 1: only synthetic datasets are loaded (Spec, out of scope) |
| F14 | The constant password hash is wrong | DW5 sign-in fails | The constant is computed once with the backend's `bcryptjs` and checked by DW5 |
| F15 | The wall clock or an unstable sort enters the loader | `forbidden.test.ts` covers all of `eval/src` | Times come from the manifest and arguments only. Sorts have compare functions, and `writeTable` sorts by the §2.2 keys |

Bugs from the template list that do not apply: no fast requests (one writer), no feed cache key or `v:user` (no backend code), and no blocks, bans, deleted or pending posts (the canonical data has none, and every loaded post is approved).

### Code files

| File | New or changed | Purpose |
|---|---|---|
| `eval/src/loader/target.ts` | new | `DEFAULT_SCHEMA = 'eval_load'`, `DEFAULT_BASE_URL`, `targetUrl(base: string, schema: string): string` |
| `eval/src/loader/ids.ts` | new | `appUserId(n: number): string`, `canonicalUserId(s: string): number`, `repostOffset(posts: readonly {postId: number}[]): number`, `PASSWORD_HASH` |
| `eval/src/loader/time.ts` | new | `lastEventTime(d: DatasetTables): number`, `parseRebase(iso: string): number`, `rebaseShift(d, epochSec, iso): number`, `toDate(epochSec, t, shift): Date`, `fromDate(x: Date, epochSec, shift): number` |
| `eval/src/loader/map.ts` | new | `interface AppRows { users; communities; members; follows; posts; reposts; likes; comments }` (plain objects shaped like the Prisma create inputs); `toAppRows(d: DatasetTables, epochSec: number, shift: number): AppRows`; `fromAppRows(r: AppRows, epochSec: number, shift: number): DatasetTables`; `detectShift(r: AppRows, d: DatasetTables, epochSec: number): number` |
| `eval/src/loader/db.ts` | new | The only `@prisma/client` import. `migrate(url: string): void`, `load(url: string, rows: AppRows): Promise<Counts>`, `readBack(url: string): Promise<AppRows>` |
| `eval/src/cli/load.ts` | new | Load command: `checkNode`, arguments, prints counts, shift and latest time |
| `eval/src/cli/load-check.ts` | new | Check command: export, compare hashes, print, exit code |
| `eval/src/loader/map.test.ts` | new | Round trip `fromAppRows(toAppRows(d))` equals `d` on the golden fixture (`src/harness/fixtures/golden`, with 27 likes, 4 comments and 2 reposts) and on `randomDataset` with shift 0 and a nonzero shift; ids and fixed fields; repost ids above every post id |
| `eval/src/loader/time.test.ts` | new | Shift arithmetic, `--rebase-to` format, a non-whole second is refused |
| `eval/src/loader/target.test.ts` | new | `public`, `it_test`, an empty name and odd characters are refused; an existing `?schema=public` is overwritten |
| `eval/src/imports.test.ts` | new | Only files under `src/loader/` import `@prisma/client` (DW1) |
| `eval/package.json`, `package-lock.json` | changed | Dependency `@prisma/client` `^6.2.1` (the backend's range). Scripts `load` and `load:check` |
| `CLAUDE.md`, `README.md`, `docs/Guidance-Manual/en/04-data.md`, `docs/Guidance-Manual/vi/04-data.md` | changed | The two commands, and the loader is no longer "planned" (DW7) |
| `docs/System_Architecture.md` | changed | Loader ✅ in its rows and the tree, and the storage question answered with `eval_load` (DW7) |
| `.docs/super-plan.md`, `.docs/implementation-plan.md` | changed | P3 status, the P3 row and the change log; task 7 ✅, the `eval/` module map row and the change log |

Insert order in `load`: `User`, `Community`, `CommunityMember`, `Follow`, `Post` (canonical), `Post` (reposts), `Like`, `Comment`. `readBack` reads the same tables with `orderBy: { id: 'asc' }`.

### Data, schema and cache changes

- **Prisma schema and migrations:** none. The schema `eval_load` is created by `migrate deploy` with the committed migrations, never `db push`.
- **Existing rows:** `public` and `it_test` are never connected to. Inside `eval_load`, every table is emptied on each load.
- **Redis:** none. No cache key and no version bump.
