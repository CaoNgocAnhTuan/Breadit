# Plan: Social feed in the app

Status: approved · 2026-11-10
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-10-p6-social-feed/`

---

## How to read this plan

- **Files.** Only the files of design "Code files", plus this `plan.md` (ticks), `check_output.txt` in this folder, and the parity output in `.docs/results/p6-parity/` (Step 6). Do not touch `packages/ranking/`, the Prisma schema or its migrations, `Latex/`, `docs/`, `.env`, `.claude/`, `eval/data/`, `CLAUDE.md`, `README.md`, `.docs/super-plan.md`, `.docs/implementation-plan.md`, `.docs/Bugs Report.md` or `design.md`. Claude writes the docs.
- **Needs:**
  - The pinned Node (`source ~/.nvm/nvm.sh`, then `nvm use` in the repo root; `node -v` must print the `.nvmrc` version).
  - `@breadit/ranking` built before any backend test or build, and `@breadit/shared` built before the frontend typecheck (CLAUDE.md, Overview). A generated Prisma client (CLAUDE.md, Prisma).
  - Docker db and redis for the IT tests (Steps 3–5) and the parity test (Step 7).
  - `eval/data/syn-W2M-M/` and `eval/data/syn-W2M-S/` (git-ignored). If they are missing, run the eval `gen` command.
  - For Step 7: `syn-W2M-M` loaded into `eval_load` without `--rebase-to` (task 7 left it in that state). If the parity setup says otherwise, run the eval `load` command for `syn-W2M-M`.
- **Who does what.** Sonnet does Steps 1 to 8. Claude does "Claude's part" and the Acceptance.
- **Rules for every step.**
  - **Tests first.** Write the test, run it, see it fail for the right reason, then write the code.
  - **No clock in the feed module.** Nothing in `apps/backend/src/feed/` reads the clock. `PostsService.findAll` reads it once per request (design: Approach, "One rank function"). In `eval/`, follow `.claude/rules/determinism.md`; `forbidden.test.ts` must stay green.
  - **No ranking logic outside `@breadit/ranking`.** The feed module loads arrays and calls the package (design: Approach, "Loading, then the package").
  - **Frozen values.** `POOL_PARAMS` and `PRIOR_M` take their values from super-plan §7 (the same as `eval/config/frozen-v1.json`). TC2 checks them. Never change a frozen value.
  - **Database safety.** Never `prisma db push`. IT tests use `it_test` only. The parity test only reads `eval_load`; its setup never migrates or truncates.
  - **Dependencies.** None are new.
  - **When stuck.** If a step cannot be done as written, stop and report what and why. Do not work around it.
- **Commits** go on `test-app` and are never pushed. One commit per step (Step 6 has two), holding its own files and this `plan.md` (the ticks).
  - Stage files by path. Never stage `eval/data/`, `eval/results/` or `datasets/`.
  - The Husky pre-commit hook runs lint-staged and the frontend typecheck. Build `@breadit/shared` first.
  - End every commit message with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
  - Approving this plan approves the commits listed.
- Effort scale: XS under 30 minutes, S under 2 hours, M half a day.

## Steps

#### Step 1: Feed helpers: config, constants, mapping, cursor, options (effort S)

- [x] Tests first (unit, `apps/backend/src/feed/*.spec.ts`): **TC1** to **TC5** of the Tests table.
- [x] Write `feed/feed.config.ts`, `feed/feed.constants.ts`, `feed/feed.mapping.ts`, `feed/feed.cursor.ts` and `feed/feed.options.ts` with the signatures of design "Code files".
  - **Config** (design: Approach, "Options and config"; F12, F13). `FEED_DEFAULT_ALGO` unset or empty gives `null`; one of the three values gives that value; anything else throws, naming the allowed values. `FEED_ASOF_ENABLED` is `true` only for `'true'`. Unset, empty and `'false'` give `false`, and anything else throws. The flag on with `NODE_ENV=production` throws.
  - **Constants.** `ALGO_METHOD` is `chrono` → BL0, `engagement` → BL2, `social` → H. `SOCIAL_PARAMS` is `{ alpha: 1, beta: 1 }`, with a one-line comment: "placeholder until P7; task 11 writes the tuned values". `methodParams('social')` is `{ alpha, beta, m: PRIOR_M }`, and the other two give `{}`.
  - **Cursor** (design: Approach, "Paging pins the time"; F10).
    - `'1'` is the first page: t is `asOfSec`, or `nowSec` when there is no `asOf`.
    - Any other cursor must be three integers, `t:score:id` (the score may be negative).
    - Without `asOf`, t must be in `[nowSec − 86400, nowSec]`. With `asOf`, t must equal it.
    - Everything else throws `BadRequestException`, including digits-only cursors other than `'1'`.
    - `pageAfter` returns the items strictly after `(score, id)` in the order `(score desc, id desc)`, the first `limit` of them, and `hasMore`.
  - **Options** (design F14; Spec "`algo` on `GET /api/posts`"). Check in this order:
    1. `asOf` with the flag off → 400.
    2. `asOf` not a whole number of seconds → 400.
    3. An unknown `algo` → 400.
    4. `algo` with `feed`, `user` or `communityId` → 400. The string `'undefined'` for `user` counts as absent, as in `findAll`.
    5. `algo` from a guest → 401.
    6. Apply the default `algo` only to the logged-in For You (no `feed`, `user` or `communityId`).
    7. `asOf` when the result has no `algo` and `feed` is not `explore` → 400.
- [x] Commit: `feat: feed module helpers (config, constants, mapping, cursor, options)`

#### Step 2: `FeedService` and `FeedModule` (effort S–M)

- [ ] Tests first: **TC6** (`feed/feed.service.spec.ts`, mocked Prisma and `BlockService` as in `users/users.service.spec.ts`).
- [ ] Write `feed/feed.service.ts`: `rank(userId, algo, asOfSec): Promise<RankedPost[]>`, with the six parts of design "Loading, then the package", in that order.
  - Positives on the pool posts are loaded after `buildPool`, for the pool ids only, then grouped by post.
  - The score function passed to `rankPool` records each score in a map. The result is `rankPool`'s order with those scores.
- [ ] Write `feed/feed.module.ts`: import `BlockModule`; provide `FeedService` and `FEED_CONFIG` (`useFactory: () => readFeedConfig(process.env)`); export both.
- [ ] Commit: `feat: FeedService ranks the pool with @breadit/ranking`

#### Step 3: `algo` and `asOf` on `GET /api/posts` (effort M)

- [ ] Change `test/it/env.ts`: set `FEED_ASOF_ENABLED` to `'true'` and delete `FEED_DEFAULT_ALGO` (design: Code files).
- [ ] Tests first (IT): **TC7**, **TC8**, **TC9**.
- [ ] `posts/posts.module.ts` imports `FeedModule`. `posts/posts.controller.ts` reads `algo` and `asOf` and passes `{ algo, asOf }` as the last argument of `findAll`.
- [ ] `posts/posts.service.ts` (design: Code files; Approach, "Paging pins the time"; "Data, schema and cache changes"):
  - Inject `FeedService` and `FEED_CONFIG`.
  - `findAll` calls `resolveFeedOptions` first, then reads `nowSec` once.
  - The new `algo` branch (`algoPage`) comes before the other modes:
    - `parseAlgoCursor` gives t and the cursor;
    - `FeedService.rank` at t, then `pageAfter` with the page size of 10;
    - load the page posts with the same `include` as the other feeds (`rePost`, `postInclude(userId)`, `community`), and keep the rank order;
    - `nextCursor` comes from `makeAlgoCursor`.
  - Cache key: `modeKey` is `algo-<algo>` (after the default is applied), and `asOf` (empty when absent) is a new last part for every mode. The TTL stays 10 s.
  - Every other mode keeps its query and order.
- [ ] `docker-compose.yml`: add `FEED_DEFAULT_ALGO: ${FEED_DEFAULT_ALGO:-}` to the backend environment. Do not add `FEED_ASOF_ENABLED`.
- [ ] All unit tests and all IT tests pass, the old ones unchanged (DW4).
- [ ] Commit: `feat: algo and asOf options on GET /api/posts`

#### Step 4: Explore reads the clock once (T4) (effort XS)

- [ ] Tests first (IT): **TC10**.
- [ ] In the Explore branch of `findAll`, one `nowMs` is used for both the window and the age: `asOfSec * 1000` when `asOf` is given, otherwise `Date.now()` read once (design: Approach, "Explore (T4)"). Nothing else changes.
- [ ] Commit: `fix: Explore takes one time per request, or asOf (T4)`

#### Step 5: D1, B6 and T3 (effort S)

- [ ] Tests first: **TC11** and **TC12** (unit), **TC13** (IT).
- [ ] `posts/posts.service.ts`:
  - In `create`, after the ban check, a community post from a non-member throws `ForbiddenException('Join the community to post in it')` (D1, F20).
  - `create` and `remove` call `incrNumber('v:user', [userId])` for the author (T3).
- [ ] `communities/communities.service.ts` (B6, F21):
  - `banUser` deletes `graph:communities` and bumps `v:user` for the target, after the transaction.
  - `deleteCommunity` reads the member ids inside its transaction, then does the same for each of them after it.
- [ ] Commit: `fix: D1 community posts need membership; B6 and T3 cache bumps`

#### Step 6: Eval parity sample (effort S–M)

- [ ] Tests first (`eval/src/parity/*.test.ts`, `node --test`): **TC14**.
- [ ] Write `eval/src/parity/sample.ts`, `expected.ts`, `write.ts` and `eval/src/cli/parity.ts`, and add the `parity` script to `eval/package.json` (design: Approach, "Parity sample (eval)"; Code files, Eval).
  - **Draw.** Use `rng(masterSeed, "parity")` and the quota of 25 per history bucket of §7 (100 pairs). Stop with an error after 1,000,000 draws.
  - **Orders.** Use `prepare(…, "fast")` and `rankAt`, with the `normal` pool.
  - **`orderSha256`.** The SHA-256 of the ids as decimals, joined by `\n`, with no final newline.
  - **`manifest.json`** (`canonicalJson`) holds:
    - `runId` `p6-parity`, `schemaVersion`, `masterSeed`, `node`;
    - the dataset id and the SHA-256 of its manifest;
    - `params` (`alpha`, `beta`, `m`) and the algo-to-method map;
    - the epoch seconds and `firstPostUnix` (epoch plus the smallest post `created_at`);
    - `counts` (users, posts, interactions);
    - `files` with rows and SHA-256, and `external: ["orders.csv"]`.
  - **CLI.** `--param alpha=` and `--param beta=` are required. `m` comes from `frozen-v1.json`. It prints the pairs per bucket and the SHA-256 of each file.
- [ ] `npm run verify -w @breadit/eval` passes.
- [ ] Commit: `feat: eval parity sample command`
- [ ] Run `parity` on `syn-W2M-M` with `alpha=1` and `beta=1`, twice. The three committed files and `orders.csv` must be byte-identical between the runs, with 25 pairs in each bucket (DW2). Save the two outputs in `check_output.txt`.
- [ ] Commit: `chore: P6 parity sample of syn-W2M-M` (the three files of `.docs/results/p6-parity/` and `check_output.txt`)

#### Step 7: Backend parity test (effort S)

- [ ] Write `test/parity/env.ts`, `test/parity/global-setup.ts` and `test/parity/parity.parity-spec.ts`, add the `parity` project to `jest.config.js` and the script `test:parity` to `apps/backend/package.json` (design: Approach, "Parity test (backend)"; the parity sequence diagram; F1, F16, F18). This is **TC15**.
  - **Env.** Copy the stubs of `test/it/env.ts`. Use the `eval_load` URL (override `PARITY_DATABASE_URL`) and Redis database 2 (override `PARITY_REDIS_URL`). Cache off, `FEED_ASOF_ENABLED` `'true'`, `FEED_DEFAULT_ALGO` deleted.
  - **Global setup.** Read the parity manifest. With Prisma on `eval_load`, compare:
    - the count of `User`;
    - the count of `Post` with `rePostId` null;
    - `Like` + `Comment` + `Post` with `rePostId` set;
    - the smallest `createdAt` of `Post` with `rePostId` null, in Unix seconds, against `firstPostUnix`.
    
    On any difference, throw the F1 message. Then flush Redis database 2.
  - **Spec, first check (F16).** `ALGO_METHOD`, `SOCIAL_PARAMS` and `PRIOR_M` equal the manifest's map and params.
  - **Spec, one test per pair.** For each `algo`:
    - (a) `app.get(FeedService).rank(user, algo, as_of_unix)`: the length equals `pool_size`, `orderSha256` equals `order_sha256`, and the first 20 equal `top20`;
    - (b) over HTTP with `cookieFor(user)` (the user row read with `prisma()`): page 1 and, when `hasMore`, page 2 of `GET /api/posts?algo=…&asOf=…`. The ids equal the first `min(20, pool_size)` of `top20`.
    
    Give the spec a timeout long enough for 100 pairs.
- [ ] Run `test:parity`. All tests pass: 300 of 300 for (a) and 300 of 300 for (b) (DW3). If one fails, report the pair, the algo and the first differing position (use `eval/results/p6-parity/orders.csv`). Do not change the expected files or the feed to make it pass. Save the summary and the run time in `check_output.txt`.
- [ ] Commit: `test: parity test of the live feed against the harness`

#### Step 8: Frontend toggle and the community compose box (effort S)

- [ ] `app/(board)/page.tsx`: an `algo` whitelist (`chrono`, `engagement`, `social`), used only when `feed` is not set. On For You, a row of three links under the tabs (`/?algo=chrono`, `/?algo=engagement`, `/?algo=social`), labelled "Chronological", "Engagement" and "Social", with the active one marked like the tabs. Pass `algo` to `Feed`.
- [ ] `components/Feed.tsx` and `components/InfiniteFeed.tsx`: an `algo` prop, into the request params, the `key` and the `queryKey` (design: Code files, Frontend).
- [ ] `app/(board)/c/[slug]/page.tsx`: render `Share` only when `community.membership` exists (D1).
- [ ] `npm run typecheck` and `npm run lint` pass with no new warnings.
- [ ] Commit: `feat: feed toggle on For You; compose box for community members only`

## Claude's part

- [ ] Read the commits and the diff against the design.
- [ ] `bash .claude/hooks/verify.sh` with db and redis up (DW1).
- [ ] The Acceptance items below.
- [ ] Docs (DW11):
  - **`docs/System_Architecture.md`:** the feed module, `algo`, the default `algo`, the `asOf` flag, the toggle and the parity test ✅; §6.1 and §6.4 describe the built code; the tree and the status table.
  - **Guidance Manual 08, en and vi:** sections 4 to 6 describe the built code. They include the `chrono` = BL0 mapping, the cursor, and F8 (deletes are not replayed).
  - **Guidance Manual 04, 05, 07, 09 and 10, en and vi:** drop the 🔜 marks for task 8, with the same content in both languages.
  - **`CLAUDE.md`:** the feeds paragraph (task 8 is built, not planned) and the commands (`parity`, `test:parity`).
  - **`README.md` and `.env.example`:** `FEED_DEFAULT_ALGO` and `FEED_ASOF_ENABLED`.
  - **`.docs/Bugs Report.md`:** D1 done (§4); B6, T3 and T4 resolved (§3.1 to §5.1, with commits); R2: the pool part done and the interaction part still open; §1 counts; §6.
  - **`.docs/implementation-plan.md`:** §1 feed rows, §5 task 8 ✅ and task 9 next, and a change-log line.
  - **`.docs/super-plan.md`:**
    - a P6 status paragraph;
    - the P6 sentence about reusing `getFolloweesIds` and `getCommunityIds` (design: Approach, "Follows and memberships come with their times");
    - the §4 row (P6 ✅, `p6-social-feed` ✅; P7 ▶ next);
    - a change-log line.
  - Commit: `docs: close p6-social-feed`.
- [ ] Fill in the Result, then close the task.

## Tests

Unit tests are `apps/backend/src/**/*.spec.ts` (no Docker). IT tests are `apps/backend/test/it/*.it-spec.ts` (schema `it_test`, Redis db 1, needs db and redis). Eval tests run under `node --test` with no Docker. The parity test is its own Jest project (needs db, redis and `syn-W2M-M` in `eval_load`).

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW6, F12, F13 | unit | `readFeedConfig`: the default `algo` (unset, empty, each value, a typo throws); the flag (`'true'`, unset, `'false'`, other values throw); the flag on with `NODE_ENV=production` throws |
| TC2 | DW1, F19 | unit | `POOL_PARAMS.windowSec` equals `windowDays × 86400`, `maxPosts` equals `poolCap`, and `PRIOR_M` equals `priorStrength` of `eval/config/frozen-v1.json` (read with `fs`). `SOCIAL_PARAMS.alpha` and `.beta` are in `alphaBetaGrid`. For each `algo`, `scorer(ALGO_METHOD[a])` with `methodParams(a)` gives a finite integer on a sample post |
| TC3 | F2, F5 | unit | `toSec` rounds down (for example 1,999 ms gives 1). `windowBounds` gives `gte` (t − W)·1000 and `lt` t·1000. The row mappers give the package types: a like, a comment and a repost row become `Positive` with the right `postId` (a repost's is its `rePostId`) and type. `groupByPost` |
| TC4 | DW7, F10 | unit | `parseAlgoCursor`: `'1'` with and without `asOf`; a valid `t:score:id` with a negative score; t in the future, older than 24 h, or not equal to `asOf` → 400; two parts, non-integers, `'2'` → 400. `pageAfter`: ties on score are broken by id desc; the last page has `hasMore` false; an `after` past the end gives an empty page |
| TC5 | DW6, F14 | unit | `resolveFeedOptions`: each 400 and the 401 in the Step 1 order; the default `algo` applies only to the logged-in For You; `asOf` with `feed=explore` is allowed; `user='undefined'` counts as absent |
| TC6 | DW3 base, DW5, F3–F7 | unit | `FeedService.rank` on a small mocked fixture (follows with one pair twice, a membership, likes, a deleted comment, a deleted repost, a pending and a deleted candidate, a blocked author) equals the package called by hand on the same data (follow once, deleted rows left out), for each `algo`. The candidate query has `parentPostId: null`, `rePostId: null`, the window bounds and no `take`. The comment and repost queries have `deletedAt: null` |
| TC7 | DW4, DW5, DW7, F15 | IT | **DW4.** For You without `algo` returns own and followee posts, newest first, with no community posts. **DW5.** On a fixture at a fixed `asOf`, an `algo` feed leaves out the blocked author's post, the viewer's own post, a deleted post, a pending community post, a repost row and a post outside the window, and keeps an approved community post. With a follow stored twice, the `social` order equals the package result with the follow once. **DW7.** Walking every page at a fixed `asOf` gives each pool post once, in the `FeedService.rank` order. Without `asOf` (posts dated in the last hours), page 2 asked 2 s after page 1 has no repeat and no gap. **F15.** A pool with no posts gives `posts: []`, `hasMore: false`, `nextCursor: null` |
| TC8 | DW6 | IT | Unknown `algo` 400; `algo` with `feed=explore`, `user` or `communityId` 400; guest with `algo` 401; bad `asOf` 400; `asOf` on For You without `algo` 400; `asOf` with `feed=explore` 200; a cursor older than 24 h or in the future without `asOf` 400; a cursor t not equal to `asOf` 400. A second app with the flag off: `asOf` 400 |
| TC9 | DW5 | IT | With `FEED_DEFAULT_ALGO=social` (set before the app starts, restored in `afterAll`), For You without `algo` gives the same body as `algo=social` at the same `asOf` |
| TC10 | DW8 | IT | Two Explore calls with the same `asOf` give byte-identical bodies (pages and cursors). A post created 8 days before `asOf` is not in Explore; one created 1 day before is |
| TC11 | DW9 (T3) | unit | `PostsService.create` (text only) and `remove` call `incrNumber('v:user', [author])` |
| TC12 | DW9 (B6), F21 | unit | `banUser` calls `del('graph:communities', [target])` and `incrNumber('v:user', [target])` after the transaction. `deleteCommunity` does both for each member read inside the transaction |
| TC13 | DW9 (D1), F20 | IT | A non-member's community post gets 403 and no `Post` row is made. A banned user gets the ban 403. A member gets 201 with `isApproved` false. The owner gets 201 with `isApproved` true |
| TC14 | DW2 | unit (eval) | On `syn-W2M-S` with a small quota: two draws are equal; every quota is met; every pool is non-empty; one pair per user; every user joined before t. `expectedOrders` equals `rankAt` for each pair and method. `orderSha256` follows the rule. Two writes give byte-identical files |
| TC15 | DW3, F1, F16, F18 | parity | Step 7: the setup checks; the map and params check; then (a) and (b) for 100 pairs × 3 `algo` values |

DW10 and DW11 are Acceptance items. DW1 is `verify.sh`.

## Acceptance

- [ ] `bash .claude/hooks/verify.sh` with db and redis up → every check passes, with the new unit and IT tests (DW1, DW4–DW9)
- [ ] `parity` on `syn-W2M-M` run twice → byte-identical files; 100 pairs, 25 in each bucket (DW2)
- [ ] `test:parity` → all pass: 300 of 300 at the feed module and 300 of 300 over HTTP (DW3)
- [ ] The backend from `run-safe.sh` on `public`, signed in as a seed user:
  - `algo=social` page 1 → 200 with a `t:score:id` cursor, and page 2 works;
  - `algo=foo` → 400;
  - `asOf` → 400, because `run-safe.sh` does not set the flag (DW6).
  
  Stop the backend after.
- [ ] Chrome, with the backend and the frontend running (DW10):
  - on For You, each toggle link changes `algo` in the URL and the order of the feed, with no crash;
  - "For you" with no `algo` shows today's feed;
  - on a community page, a non-member sees no compose box; after joining, the box appears.
  
  If no browser is connected, the author checks this.
- [ ] The docs of "Claude's part" → task 8 ✅ everywhere, no 🔜 left for task 8, the same content in en and vi, and the env variables listed (DW11)
- [ ] `git diff --stat` of the task commits → only the files of design "Code files", this folder, and `.docs/results/p6-parity/`

## Result
