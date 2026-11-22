# Appendix

> **Draft, 2026-11-22.** Appendix A only. Appendix B (full tables) is written by a later task. Every file and count was checked against the repository on 2026-11-22 (see the notes at the end). Remove this box and the notes at the end before the final version.

## Appendix A. Full test list

### A.1 Ranking package unit tests

Seven suites, 85 tests. Run with `npm run test -w @breadit/ranking`.

**Table A.1. Unit tests of `packages/ranking/src`.**

| File | Tests | What it covers |
|---|---|---|
| `asof.spec.ts` | 5 | The as-of rule and the age of a post:<br>- an event before `asOf.t` is visible, whatever its id<br>- an event at `asOf.t` is visible only with an id smaller than `beforeEventId`<br>- an event at `asOf.t` is not visible when there is no `beforeEventId`<br>- an event after `asOf.t` is never visible<br>- the age is (`asOf.t` - `createdAt`) / 3600 |
| `determinism.spec.ts` | 3 | No clock, no randomness, no outside import:<br>- the detector finds each forbidden pattern and honours `harness-allow`<br>- it allows `node:` modules and relative files, and finds every other import<br>- the package source has no forbidden pattern and no import outside `node:` modules and package files |
| `explore.spec.ts` | 4 | The Explore score:<br>- it equals the old backend function on a fixed table of inputs<br>- it equals the old backend function on a grid of small inputs<br>- it gives hand-computed values (1 per like, 2 per comment, 3 per repost, minus 0.25 per hour, times 100)<br>- it returns an integer |
| `features.spec.ts` | 14 | The as-of features of a user (follows, memberships, positives) and of a post (likes, comments, reposts, engagers); events at or after `asOf` do not count |
| `pool.spec.ts` | 13 | `buildPool`: the window edges, own posts, earlier positives, blocked authors, deleted and unapproved posts, the cap and ties |
| `rank.spec.ts` | 9 | `rankPool`: order by score and post id, input order does not matter, a NaN score throws, the `id-asc` tie rule |
| `scorers.spec.ts` | 37 | The 13 scorers: BL0 and BL1, BL2, BL2t and BL3, BL4 and BL5, BL6, H and its ablations, the errors of `scorer`, and random fixtures |
| **Total** | **85** |  |

### A.2 Backend unit tests

Eighteen suites, 211 tests. Run with `npm run test -w @breadit/backend` (the Jest project `unit`). Prisma and Redis are replaced by test doubles.

**Table A.2. Unit tests of `apps/backend/src`.**

| File | Tests | What it covers |
|---|---|---|
| `all-exceptions.filter.spec.ts` | 9 | `AllExceptionsFilter`: Prisma errors become 400, 404 or 409 (T7), no database detail in the message, other errors become 500 |
| `auth/banned-guard-coverage.spec.ts` | 6 | `BannedUserGuard` is on every write route, with `JwtAuthGuard` first (S3) |
| `auth/session.spec.ts` | 7 | `readSession`: good, bad, expired and logged-out tokens (S5) |
| `common/limits.spec.ts` | 4 | Text limits:<br>- they match the database column sizes<br>- an emoji counts as one character, like Postgres<br>- B3: exactly the maximum is allowed, one more is rejected<br>- `undefined` is not too long |
| `common/parse-cursor.spec.ts` | 15 | `parseCursor`: bad, missing and repeated cursors (T7) |
| `common/validators/image-ref.spec.ts` | 25 | The rule `@IsImageRef` for avatars and covers, and its allowed hosts (N4) |
| `communities/communities.service.spec.ts` | 5 | Cache after a ban or a delete of a community (B6):<br>- a ban clears `graph:communities` and bumps `v:user` of the target, after the transaction<br>- no cache change when the actor is not a mod or an owner<br>- no cache change when the target is the owner<br>- a delete reads the member ids inside the transaction, then clears and bumps every former member after it<br>- no cache change when the caller is not the owner |
| `feed/feed.config.spec.ts` | 11 | `readFeedConfig`: `FEED_DEFAULT_ALGO` and `FEED_ASOF_ENABLED`, wrong values, the flag in production |
| `feed/feed.constants.spec.ts` | 7 | The constants of the feed equal `frozen-v1.json` and the approved run config `p7-main.json` |
| `feed/feed.cursor.spec.ts` | 28 | The cursor `t:score:id`: reading, writing, the 24 hour rule, and the page after a cursor |
| `feed/feed.mapping.spec.ts` | 9 | Prisma rows to the plain types of the package, whole seconds, the bounds of the window |
| `feed/feed.options.spec.ts` | 18 | `resolveFeedOptions`: the rules for `algo` and `asOf` |
| `feed/feed.service.spec.ts` | 10 | `FeedService.rank` equals the package called by hand; the queries it makes; it does not read the clock |
| `notifications/notifications.gateway.spec.ts` | 20 | The gateway: authentication before the connection, own room, `joinConversation`, typing events (S1, S5) |
| `posts/engagement.spec.ts` | 6 | `engagementSelect`: counts ignore soft-deleted reposts and comments (T1, T2) |
| `posts/posts.service.spec.ts` | 3 | Cache version of the author (T3):<br>- create bumps the author after the row is written<br>- remove bumps the author after the row is updated<br>- remove of a post that is not yours bumps nothing |
| `throttle/throttle.config.spec.ts` | 14 | `readThrottleLimit`: the default 1,000 and the reading of `THROTTLE_LIMIT` (N6) |
| `users/users.service.spec.ts` | 14 | Follow, block, suggestions and private profile fields (T5, T8, T9, S2) |
| **Total** | **211** |  |

### A.3 Backend integration tests

Fourteen files, 171 tests. Run with `npm run test:it -w @breadit/backend` (the Jest project `it`). The tests start the real app on the Postgres schema `it_test` and Redis database 1. A table-driven test counts once for each row of its table.

**Table A.3. Integration tests of `apps/backend/test/it`.**

| File | Tests | What it covers |
|---|---|---|
| `avatar.it-spec.ts` | 8 | Avatar and cover URLs (N4) |
| `community-post.it-spec.ts` | 5 | Who may post in a community (D1):<br>- a non-member gets 403 and no post is made<br>- a banned user gets the ban 403, not the join one<br>- a plain member gets 201 and the post waits for approval<br>- the owner gets 201 and the post is approved<br>- a post with no community is not affected |
| `counts.it-spec.ts` | 8 | Counts ignore soft-deleted reposts and comments, likes are unchanged (T1, T2) |
| `demo-fixes.it-spec.ts` | 3 | Approving a community post:<br>- V3: approve keeps `updatedAt`, so the post does not look edited<br>- V4: after the owner approves, the owner reads the post at once<br>- V4: after a mod approves, the mod and the author read the post at once |
| `explore-asof.it-spec.ts` | 3 | Explore with `asOf` (T4):<br>- two calls with the same `asOf` give byte-identical pages and cursors<br>- a guest gets the same pages as a user with no blocks, byte for byte<br>- a post 8 days before `asOf` is not in Explore, one 1 day before is |
| `feed-algo.it-spec.ts` | 11 | The `algo` feeds: For You without `algo`, the fixture rules for each `algo`, the HTTP order equals `FeedService.rank`, a follow stored twice (T6), paging, an empty pool |
| `feed-default.it-spec.ts` | 3 | The default `algo`:<br>- For You without `algo` gives the same body as `algo=social` at the same `asOf`<br>- an explicit `algo` still wins over the default<br>- the default does not apply to a guest, to Following or to a profile |
| `feed-options.it-spec.ts` | 16 | The input rules of `algo` and `asOf`, the cursor, the flag `FEED_ASOF_ENABLED` and the refusal to start |
| `graph.it-spec.ts` | 11 | Follow and block rules, recommendations and the connect list (T5, T8, T9) |
| `health.it-spec.ts` | 2 | The test app:<br>- it boots the real app and answers `GET /api/health`<br>- it answers 401 on a protected route without a cookie |
| `input-errors.it-spec.ts` | 53 | Bad or missing ids, bad cursors on eleven routes, text length limits, empty posts and comments, other unknown ids (T7, B3, N1) |
| `quick-wins.it-spec.ts` | 22 | The fixes of task `p9-bug-quick-wins`: the logout blacklist on public routes (S5), no action on a pending post (R2), blocked comments (N2), reply counts (R1), trending hashtags (B7), the unread cache (B10), the community slug (B2) |
| `socket.it-spec.ts` | 9 | Real Socket.IO clients: a client cannot take another user's room or push a fake notification, typing events for members only, logged-out and missing cookies cannot connect, `accountBanned` arrives (S1, S5) |
| `visibility.it-spec.ts` | 17 | Posts waiting for approval, private profile fields, banned users cannot write (T10, S2, S3) |
| **Total** | **171** |  |

### A.4 Parity test

One file, `apps/backend/test/parity/parity.parity-spec.ts`, with 102 tests. Run with `npm run test:parity -w @breadit/backend` (the Jest project `parity`); it reads the schema `eval_load` and Redis database 2. One test checks that the map of `algo` to method and the parameters of the backend equal the parity sample. One test checks that the committed files are the ones the manifest describes: 100 pairs and 300 expected rows. Then one test for each of the 100 pairs: for each of the three `algo` values, the whole order of `FeedService.rank` and the first two pages of `GET /api/posts` equal the harness order.

### A.5 Evaluation tests

Forty-three files, 434 tests. Run with `npm run verify -w @breadit/eval`, which runs the type check (`tsc --noEmit`) and then `node --test`.

**Table A.4. Tests of `eval/src`.**

| File | Tests | What it covers |
|---|---|---|
| `adapters/digg-parse.test.ts` | 25 | The parser of the Digg vote and friend files: line ends, the last line, the error messages |
| `adapters/digg.test.ts` | 24 | The Digg adapter: the config, the hashes of the zips, the mapping, two runs give the same files |
| `adapters/zip.test.ts` | 11 | The reader of the password-protected zip files (ZipCrypto): right and wrong password, damaged data, kinds of zip that it refuses |
| `bench/e7.test.ts` | 17 | The helpers of the E7 benchmark: median, bootstrap median |
| `bench/write.test.ts` | 10 | The summary files of the E7 benchmark and their manifest |
| `canonical/canonical.test.ts` | 8 | The six canonical tables, the writer and the strict reader |
| `checks/buckets.test.ts` | 15 | The cut time T, the test items and the history groups |
| `checks/calibration.test.ts` | 9 | The calibration of the generated data to the Digg targets |
| `checks/format.test.ts` | 19 | The format checks of a dataset: follow and interaction rules, community membership at the time of the post, sorting, line ends, and the files against the manifest |
| `checks/lift.test.ts` | 5 | The social lift check:<br>- every action on an exposed post gives a lift above 1<br>- with no follows the lift is not computed, and the report says so<br>- a follow dated at or after the action does not count<br>- a post a followee acted on before is exposed<br>- an action by the followee after the follower's action does not expose it |
| `checks/pool-crosscheck.test.ts` | 1 | `buildPool` agrees with `inPool` and `poolSize` on random fixtures |
| `checks/run.test.ts` | 10 | `checkAll` on a generated dataset (it passes, it is repeatable, it fails on a changed file or an empty folder), the commands `check` and `gen`, and the bucket table for `digg2009` and `syn-W2M-M` |
| `forbidden.test.ts` | 2 | No clock and no unseeded randomness in `eval/src`:<br>- the detector finds each forbidden pattern and honours `harness-allow`<br>- there is no forbidden pattern in `eval/src` |
| `frozen.test.ts` | 10 | The frozen values (seed, epoch, sizes, history groups, window and pool cap, cut times, grids) equal the super-plan; the check of the Node version |
| `generator/config.test.ts` | 4 | The generator parameters:<br>- every parameter is marked calibrated or chosen, and a calibrated one has a target<br>- the targets come from the config<br>- `makeParams` reads the sizes and the epoch span from the frozen values<br>- the three W2 cells differ only in influence, at the same homophily as W1 |
| `generator/generate.test.ts` | 7 | The eight dataset ids, two runs give byte-identical files, the keys of the manifest |
| `generator/stages.test.ts` | 22 | The stages of the generator: users, follows, communities, posts, interactions and the activity counts |
| `harness/commands.test.ts` | 11 | The commands `harness` and `rank`: output, two runs equal, the approval of the test split, the H0 gate |
| `harness/compare.test.ts` | 11 | The comparison files: the families of tests, the p-values and the Holm correction |
| `harness/config.test.ts` | 13 | The validation of a run config: split approval, params, grids, pool, `datasetParams`, compare, density and the H0 gate |
| `harness/freeze.test.ts` | 9 | `freeze`: the ten test configs and the approval line |
| `harness/index-data.test.ts` | 5 | The index of the harness:<br>- user ids are `u` plus 10 digits and sort like the integers<br>- history counts equal `historyCount` of `buckets.ts`, ties broken by event id<br>- `positiveEvents` are sorted by (t, id), and the index accepts unsorted input<br>- `windowCandidates` gives the posts with t - W <= createdAt < t<br>- `followeeEngagement` lists, per post, the followees with a visible positive |
| `harness/post-features.test.ts` | 2 | Fast and reference post features:<br>- they give the same counts and scores on random datasets<br>- they give the same scores on `syn-W2M-S` |
| `harness/run.test.ts` | 21 | The harness run: golden dataset (hand work, files), leakage, fast against reference mode, the T guard, the large pool, tie rule, labels |
| `harness/shuffle.test.ts` | 8 | The shuffled-engagers control: valid output, repeatable, not a no-op |
| `harness/split.test.ts` | 6 | The validation and test items of a user |
| `harness/tuning.test.ts` | 9 | The frozen grids, the best value by NDCG@10, tuning on the golden dataset |
| `harness/write.test.ts` | 4 | Result files:<br>- the four files and a manifest with rows and SHA-256 of each<br>- a `per_user.csv` over the limit goes to the external folder, and its hash stays in the manifest<br>- two writes into two empty folders give byte-identical files (double run)<br>- rows are sorted by dataset, split, method order and user id |
| `imports.test.ts` | 3 | Where `@prisma/client` may be imported:<br>- the detector finds each form of import and ignores comments<br>- no file outside `src/loader/` imports it<br>- inside `src/loader/`, only `db.ts` imports it |
| `loader/ids.test.ts` | 5 | Ids of the loader:<br>- `appUserId` is `u` plus the integer padded to 10 digits<br>- `appUserId` refuses a number that is not a non-negative integer or has more than 10 digits<br>- `canonicalUserId` reverses `appUserId` and refuses anything else<br>- `repostOffset` is the largest post id, and 0 for no posts<br>- `PASSWORD_HASH` looks like a bcrypt hash of cost 10 |
| `loader/map.test.ts` | 16 | The mapping between the CSV tables and the app rows, and back |
| `loader/target.test.ts` | 7 | The target schema: only names `eval_...`, never `public` |
| `loader/time.test.ts` | 9 | `--rebase-to`: the accepted format and the shift |
| `metrics.test.ts` | 10 | Recall, NDCG and coverage, with hand values |
| `parity/expected.test.ts` | 5 | The expected orders of the parity sample:<br>- the map of `algo` to method is chrono BL0, engagement BL2, social H<br>- one row for each pair and `algo`, in a fixed order<br>- the expected orders equal `rankAt` for each pair and method<br>- the top of each row is what the `rank` command prints<br>- `orderSha256` is the SHA-256 of the ids joined by newlines |
| `parity/sample.test.ts` | 9 | The draw of the 100 parity pairs |
| `parity/write.test.ts` | 5 | The files of the parity sample:<br>- two writes give byte-identical files<br>- `pairs.csv` has the columns of the design<br>- `expected.csv` has one row for each pair and `algo`<br>- `orders.csv` has the whole orders and stays out of the committed folder<br>- `manifest.json` has the params, the map, the epoch, the counts and the hashes |
| `report/macros.test.ts` | 9 | The names and values of the LaTeX macros |
| `report/report.test.ts` | 13 | The report: every file of the design, the manifest, two runs give the same bytes |
| `report/round.test.ts` | 6 | Decimal rounding for the tables |
| `repro/merged.test.ts` | 16 | The merged manifest and its compare (Class D and Class R) |
| `rng.test.ts` | 7 | The seeded random streams: equal seed and stage give equal sequences, a known-answer vector, range and bias, an unknown stage |
| `stats.test.ts` | 16 | The paired bootstrap, the randomization test (exact and sampled), the Holm correction, the H1 and H0 decisions and the comparison file |
| **Total** | **434** |  |

### A.6 Demo helper tests, replay and manual checks

**Demo helper tests.** One file, `scripts/demo/lib.test.mjs`, with 22 tests, run with `node --test`. They cover `rebaseIso` (3 tests), `feedIds` (3), `pagesNotAllSame` (4), `overlap` (1), `orderCandidates` (6) and `pickUser` (5).

**HTTP and Socket.IO replay.** `scripts/verify-bug-sweep.sh` makes 84 curl checks against a running backend and runs `scripts/verify-socket.cjs`, which makes 11 Socket.IO checks. The last run, on 2026-11-20, gave 95 passed and 0 failed.

**Manual checks.** The UI sweep of 2026-11-20 walked 28 pages and 15 flows in Chrome (`.docs/works/2026-11-20-p10-demo-sweep/sweep.md`). The demo rehearsal of 2026-11-22 played 9 steps (`.docs/works/2026-11-22-p10-demo-script/rehearsal.md`). Chapter 8 gives their results.

## Notes for the author (remove before the final version)

1. **Only Appendix A is here.** Appendix B (full tables) is added later by another task, below Appendix A in `chapters/appendix.tex` (a comment marks the place).
2. **Where the counts come from.**
   - Ranking (85, per file 9, 13, 3, 14, 5, 4, 37), backend unit (211, 18 files), demo helpers (22) and evaluation (434, 43 files): I ran the suites on 2026-11-22 and counted the tests of each file (Jest `--json`, and `node --test` one file at a time).
   - Integration (171, 14 files): not run (no Docker). Counted from the files: 137 `it(` lines, plus the cases of the `it.each` tables (`input-errors` 53, `quick-wins` 22, `feed-algo` 11), which gives 171. The same total is in `verify.sh` of 2026-11-22 (`.docs/works/2026-11-22-p10-demo-script/plan.md`).
   - Parity (102): the same record. The file has 2 checks of the sample and one test for each of the 100 pairs.
   - Replay: 95 checks, 11 from `scripts/verify-socket.cjs` (`record(` calls), so 84 from the bash script (the output `sweep-after.txt` has 95 `PASS` lines).
3. **The IDs in brackets** (T1, S5, N4, V3 and so on) are IDs of `.docs/Bugs Report.md`. D1 is its decision D1. I took each ID from the name of the test or the describe block.
4. **Layout.** The four tables use `\scriptsize` so that Appendix A is 5 pages (pages 75 to 79 in the build of 2026-11-22). The Table numbers run on from Chapter 8 in the PDF (Tables 31 to 34); the working names above are A.1 to A.4.
