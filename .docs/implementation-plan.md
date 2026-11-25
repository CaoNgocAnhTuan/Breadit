# Implementation blueprint

Version 1.28 · 2026-11-23 · Status: approved 2026-10-28
Super-plan: [super-plan.md](super-plan.md) · Task: `.docs/works/2026-10-28-p2-implementation-blueprint/`

How the pieces of P3 to P10 fit together in the code. A thing is here only if two or more tasks share it. Detail that one task owns stays in that task's `design.md`. Frozen values live in super-plan §7. This file points to them as "§7, <row name>" and does not copy them.

## 1. Module map

| Module | Owner task | May import | What it holds |
|---|---|---|---|
| `packages/ranking` (`@breadit/ranking`) | `p5-ranking-package` ✅ (2026-11-02) | the Node standard library only | Types, `buildPool`, as-of feature functions, every scorer, `rankPool`, and `computeExploreScoreFixed` moved from `posts.service.ts`. Pure: no Nest, Prisma, Redis, clock or randomness. Builds to `dist/` with `tsc`, like `@breadit/shared` |
| `eval/` (`@breadit/eval`, added to the root `workspaces`) | `p3-synthetic-generator` creates it ✅ (2026-11-02; `rng.ts`, `canonical/`, `generator/`, `checks/`, `config/`; `adapters/digg.ts` by `p4-digg-adapter` ✅; `harness/`, `metrics.ts`, `stats.ts` by `p5-eval-harness` ✅; `loader/` by `p3-postgres-loader` ✅ (2026-11-10); `report/` by `p7-offline-experiments` ✅ (2026-11-12); `bench/` by `p7-cost-benchmark` ✅ (2026-11-12); `repro/` (the merged manifest) by `p8-repro` ✅ (2026-11-19)) | `@breadit/ranking`; `@prisma/client` in `src/loader/` only | `src/rng.ts`, `src/canonical/` (CSV and manifest), `src/generator/`, `src/loader/`, `src/adapters/digg.ts`, `src/harness/`, `src/metrics.ts`, `src/stats.ts`, `src/report/`, `src/bench/`, `src/repro/`, `config/` |
| Backend feed module `apps/backend/src/feed/` | `p6-social-feed` ✅ (2026-11-10) | `@breadit/ranking`, `PrismaService`, `BlockService` | A thin service that loads data and calls `buildPool` and a scorer. `PostsService.findAll` calls it when `algo` is set. Explore imports `computeExploreScoreFixed` from `@breadit/ranking` (done in `p5-ranking-package`) |
| Frontend toggle | `p6-social-feed` ✅ (2026-11-10) | the API only | `algo` in `app/(board)/page.tsx`, `Feed.tsx`, `InfiniteFeed.tsx` |

Rules:
- Nothing imports `eval`.
- The harness never touches Postgres, Redis or HTTP (super-plan §2). Only the loader writes to Postgres.
- `getFolloweesIds` and `getCommunityIds` stay in `PostsService`. P6 decides how the feed module reaches them. Decided in task 8: it does not use them, because they hold ids without times; it reads follows and memberships with their `createdAt`.
- The determinism rule and hook already cover `packages/ranking/**` and `eval/**`.

## 2. Data contracts

### 2.1 Hand-offs

| Hand-off | From to | Contract |
|---|---|---|
| H-a | generator to loader | canonical dataset and manifest (2.2, 2.3) |
| H-b | generator and Digg adapter to harness | the same canonical dataset and manifest |
| H-c | `packages/ranking` to backend and harness | the TypeScript signatures (2.6) |
| H-d | harness to report to macros | results CSVs, `macros.csv`, `results-macros.tex` (2.7, 2.8) |
| H-e | harness to the P6 parity test | the `rank` command and the parity sample (2.9) |

### 2.2 Canonical dataset

One folder per dataset, `eval/data/<datasetId>/`. It is not in git: it is rebuilt, and its hashes are in the manifest. Files follow super-plan §2 (CSV, UTF-8, LF, header row, fixed column order, sorted rows). Every id is a non-negative integer. Every time is integer seconds from the epoch named in the manifest: the base epoch of §7 for synthetic data, the Unix epoch for Digg.

| File | Columns | Sort order | Notes |
|---|---|---|---|
| `users.csv` | `user_id, joined_at` | `user_id` | |
| `follows.csv` | `follower_id, followee_id, created_at` | `follower_id, followee_id` | no self-link, no duplicate pair |
| `communities.csv` | `community_id, created_at` | `community_id` | header only for Digg |
| `memberships.csv` | `user_id, community_id, joined_at` | `user_id, community_id` | header only for Digg |
| `posts.csv` | `post_id, author_id, community_id, created_at` | `post_id` | `community_id` is empty when none. Every post is approved and not deleted. A community post's author is a member at `created_at` (D1 assumption, section 6) |
| `interactions.csv` | `event_id, user_id, post_id, type, created_at` | `created_at, event_id` | `type` is `like`, `comment` or `repost`. All are positives. Only additions: no unlike, unfollow or leave (super-plan §3). `event_id` breaks ties in time |

Dataset ids: `syn-<world>-<size>` with world `W0`, `W1`, `W2L`, `W2M` or `W2H`, and size `S` or `M` (§7, row "Dataset sizes"); and `digg2009`.

### 2.3 Manifest

`manifest.json` in each output folder, keys sorted, two-space JSON, LF:
- `schemaVersion`
- `datasetId` or `runId`
- `source`: synthetic, the config path and its SHA-256; Digg, each raw zip with URL and SHA-256
- `masterSeed`, when used
- `epoch`
- `node` (`process.version`)
- `files`: name to `rows` and `sha256`

P8 merges all of them into `.docs/results/manifest.json` and compares. Done (task 11, 2026-11-18): the file holds the SHA-256 of the manifest of each results folder (`p7-e7` is marked Class R and not compared) and of each dataset manifest; `npm run results:manifest -w @breadit/eval` compares the tree with it (`eval/src/repro/merged.ts`), and `npm run thesis:repro` ends with that compare.

### 2.4 PRNG

`eval/src/rng.ts` has `rng(masterSeed, stage)` as in super-plan §2. The stage names are fixed: `users`, `follows`, `communities`, `posts`, `interactions` (P3); `bootstrap`, `permutation` (P5); `parity` (P6); `shuffle`, `bootstrap-median` (P7). A new stage gets a new name. Names are never reused.

### 2.5 User ids in the app and in the CSVs

The app has string user ids and the CSVs have integers. One rule for both sides: inside `packages/ranking` a user id is a string, `u` plus the integer padded to 10 digits (`u0000000042`). The loader writes the same string as `User.id`. So the live app and the harness sort users the same way (plain `<` on strings, never `localeCompare`). Post ids stay integers: `Post.id` is an autoincrement integer, and the loader sets it explicitly.

What the loader writes (task 7, 2026-11-10), for task 8 to read:
- **Positives come from three tables.** A like is a `Like` row and a comment is a `Comment` row, each with `id` = `event_id`. A repost is a `Post` row with `rePostId` = the reposted post and `id` = R + `event_id`, where R is the largest canonical post id.
- **The live pool must leave out `Post` rows with a `rePostId`.** The harness pool holds only canonical posts. The live features must count reposts from those rows, like the harness does.
- **Times are whole seconds:** the manifest epoch plus the CSV seconds. The schema is `eval_load`.

### 2.6 `packages/ranking` signatures (H-c)

Signatures only. P5 writes the code.

```ts
type UserId = string;  type PostId = number;  type Sec = number;   // integer seconds
interface AsOf { t: Sec; beforeEventId?: number }
// An event e is visible at asOf iff e.t < asOf.t, or e.t === asOf.t and e.id < asOf.beforeEventId.
// The harness passes the test event's id. The live app passes no id (strictly before t).

interface Post { id: PostId; authorId: UserId; communityId: number | null; createdAt: Sec;
  isApproved: boolean; deleted: boolean }
interface Positive { id: number; userId: UserId; postId: PostId; type: 'like' | 'comment' | 'repost'; t: Sec }

interface PoolParams { windowSec: number; maxPosts: number }          // values: §7, "Window W / pool cap N_max"
function buildPool(a: { user: UserId; asOf: AsOf; candidates: readonly Post[];
  blocked: ReadonlySet<UserId>; earlierPositives: ReadonlySet<PostId> }, p: PoolParams): Post[];

interface UserFeatures { followees: UserId[]; communities: number[];      // distinct, sorted
  nByAuthor: ReadonlyMap<UserId, number>; nByCommunity: ReadonlyMap<number, number>; nTotal: number }
interface PostFeatures { likes: number; comments: number; reposts: number; createdAt: Sec;
  engagedBy: UserId[] }                                                   // distinct, sorted
type MethodId = 'BL0'|'BL1'|'BL2'|'BL2t'|'BL3'|'BL4'|'BL5'|'BL6'|'H'|'H-follow'|'H-comm'
  |'H-noauthor'|'H-noengager';
interface ScoreContext { user: UserId; asOf: AsOf; uf: UserFeatures; params: Readonly<Record<string, number>> }
type Scorer = (ctx: ScoreContext, post: Post, pf: PostFeatures) => number;   // scoreFixed, an integer
function scorer(method: MethodId): Scorer;
function rankPool(pool: readonly Post[], score: (p: Post) => number): PostId[]; // (scoreFixed desc, postId desc)
```

- The harness builds `UserFeatures` and `PostFeatures` from the canonical files with the `AsOf` rule. The live app builds them from Prisma. Both call the same `buildPool`, `scorer` and `rankPool`, so only the loading differs.
- The live query loads every candidate in the window, with no row limit below `maxPosts` plus the user's earlier positives. So `buildPool` sees the same set as the harness.
- The E4 `m` sweep is a parameter (`params.m`), not a method id.
- **Feature builders** (added by task 5, `p5-ranking-package`; both sides call them, so only the loading differs):

```ts
interface Follow { followerId: UserId; followeeId: UserId; t: Sec }
interface Membership { userId: UserId; communityId: number; t: Sec }
interface PostInfo { authorId: UserId; communityId: number | null }
interface UserFeatureData { follows: readonly Follow[]; memberships: readonly Membership[];
  positives: readonly Positive[]; postInfo: ReadonlyMap<PostId, PostInfo> }
function userFeaturesAsOf(user: UserId, asOf: AsOf, data: UserFeatureData): UserFeatures;
function postFeaturesAsOf(post: Pick<Post, 'id' | 'createdAt'>, asOf: AsOf, positives: readonly Positive[]): PostFeatures;
function visibleAt(e: { id: number; t: Sec }, asOf: AsOf): boolean;
function ageHours(createdAt: Sec, asOf: AsOf): number;
```

  Follows and memberships count when `t < asOf.t` (they have no event id). Positives use the `AsOf` rule above.
- **Params per method** (task 5). `scorer` throws on a missing param: BL2t `ageWeight`; BL4 `divisor`; BL5 `gravity`; BL6 `alpha`; H, H-noauthor and H-noengager `alpha`, `beta`, `m`; H-follow `alpha`, `m`; H-comm `beta`, `m`. Extra params are ignored. BL5 is the natural log of the HN score (task 5 Open question 1); a post with no like gets `−2^31`.

### 2.7 Results files (H-d)

Written by the harness into `.docs/results/<runId>/`. Class D (super-plan §2). Metrics have 6 decimals. A `per_user.csv` over 5 MB goes to `eval/results/<runId>/` (git-ignored) instead, and its SHA-256 stays in the committed run manifest (task 6, 2026-11-02). In `compare.csv` every comparison is on NDCG@K per user.

| File | Columns | One row per |
|---|---|---|
| `per_user.csv` | `dataset, split, method, user_id, bucket, n_history, n_followees, test_post_id, rank` | method and kept user. `rank` is 1-based in the full pool |
| `summary.csv` | `dataset, split, method, k, bucket, n_users, recall, ndcg` | method, K and bucket, plus bucket `0-4` and `all` |
| `coverage.csv` | `dataset, split, method, k, coverage` | method and K |
| `leftout.csv` | `dataset, split, bucket, n_test_users, n_left_out` | bucket |
| `tuning.csv` | `dataset, method, param, value, val_ndcg10, chosen` | grid point |
| `compare.csv` | `dataset, family, method, ref, k, bucket, n, mean_diff, ci_low, ci_high, p_raw, p_holm` | comparison (section 3.3) |
| `density.csv` | `dataset, density_bin, method, ref, n, mean_diff, ci_low, ci_high` | density bin (E3) |

E7 timing goes to `latency.csv` with the same row rules. It is Class R: its hash is recorded and never compared.

**Task 9 (2026-11-12).** `density.csv` is on NDCG@10 (it has no `k` column), with bins of the user's number of followees on the history bucket edges. Rows of family none in `compare.csv` also serve E4, E5 and E8.

### 2.8 Macros (H-d)

The report reads only the CSVs above. It writes `macros.csv` (`name, value, file, row_key, column`) and `results-macros.tex`. The `column` column was added in task 9, because a row key alone does not name the cell. A macro name has letters only, because LaTeX does not allow digits. It is built from: experiment, dataset, metric, K in words, what. Example: `\eTwoDiggNdcgTenGain`. Every macro traces to one CSV cell through `macros.csv`. **Task 9 (2026-11-12).** A macro value is its cell rounded to 3 decimals on the decimal string; a p-value under 0.001 is written `<0.001`. The report also writes ten LaTeX tables and `results.md` (the same tables in Markdown) to `.docs/results/p7-report/`. **Task `p9-figure-data` (2026-11-19).** It also writes the figure data of E2, E3 and E5: `fig-e2-history.csv`, `fig-e3-density.csv` and `fig-e5-worlds.csv`. The columns are `dataset`, a label column (`bin` for the history group or the followee bin, `variant` for E5), `n`, `mean_diff`, `ci_low` and `ci_high`, with the cells as written in the source CSV.

**Task `p9-report-macros` (2026-11-19).** A name that ends in `Full` holds its cell with all 6 decimals, not 3. It is for numbers that 3 decimals hide: the Digg H1 row in group 0–4 (gain and interval) and two tuning points of H. A tuning grid value (the column `value` of `tuning.csv`) is printed as written, for example `1024/1024` or `0.0625`, and is never rounded. The new words in a name are: `tune` (the tuning run), `Chosen` (the row with `chosen` = 1), `ValNdcgTen` (validation NDCG@10) with `FiveTwelve` and `TenTwentyFour` (the grid values `512/512` and `1024/1024`), `TopicNdcg` (the E5 topic row, H on W0 from `p7-h0`, for example `\eFiveWZeroTopicNdcgTenAllGain`), and `BLZero` to `BLSix` for BL0 to BL6 (`BLTwoT` is BL2t). E1 now has all nine methods and E2 all five groups.

### 2.9 Parity sample (H-e)

`eval rank --dataset <id> --method <m> --user <u> --asof <t> --top <n>` prints post ids in order. The 100 (user, `asOf`) pairs of the P6 test are drawn with the `parity` stream from users and times of `syn-W2M-M`. They are written to a committed CSV, so P6 and the harness use the same pairs.

**Done (task 8, 2026-11-10).** `npm run parity -w @breadit/eval -- --param alpha=<a> --param beta=<b>` draws 25 pairs per history bucket and writes `.docs/results/p6-parity/`: `pairs.csv`, `expected.csv` (pool size, SHA-256 of the full harness order and top 20, for each pair and `algo`) and `manifest.json` (params, algo-to-method map, dataset hash, row counts and first post time). `npm run test:parity -w @breadit/backend` compares the live feed with it on `eval_load`.

**Drawn again (task 11, 2026-11-18)** with the tuned α and β that the app now uses (`SOCIAL_PARAMS`, the `syn-W2M-M` values of `eval/config/runs/p7-main.json`). `pairs.csv` is byte-identical, because the draw does not read α or β. Only `social` rows of `expected.csv` changed (95 of 100). The parity test gives 300 of 300 again.

## 3. Cut time T and Holm family

This part is written and committed before the script reads the real Digg files. So the Digg counts cannot bend the rule.

### 3.1 The rule for T

For each dataset, sort all positive events by `(t, event_id)`. A positive is a like, a comment or a repost. Let `n` be the number of positives. T is the time of the event at rank `ceil(q · n)`.

- A test item must have `t > T`. A validation item has `t ≤ T`. An event at exactly T is validation, not test.
- `q` is 0.8.
- If the Digg check keeps fewer than 100 test users in bucket 0–4 at `q` = 0.8, then `q` becomes 0.7.
- If that also gives fewer than 100, `q` stays 0.8 and H1 test 2 is reported as underpowered. It is not dropped.
- One `q` for every dataset.
- The value of T is computed by the harness and frozen in P5 (§7, row "Cut time T"). This part sets only the rule.

This is the global temporal split of [13], with the split point set by a share of events, not by a calendar date. A share works the same on synthetic data and on Digg, and it is easier to state than a date.

### 3.2 Words used by the rule

- **Test item.** The user's last positive with `t > T`, on a post the user had not touched before. A user with no positive after T has no test item and is left out of the count.
- **History.** The number of the user's positives before the test time `t_u`. An event with `t = t_u` counts only if its event id is smaller than the test event's id.
- **Bucket.** History 0, 1–4, 5–19 or 20 and more (§7, row "History buckets"). Bucket 0–4 is the union of 0 and 1–4.
- **Window rule.** A story is in the window when `t_u − W ≤ created_at < t_u`. `W` and the pool cap `N_max` are in §7, row "Window W / pool cap N_max".
- **Kept.** A test user is kept when the test post is in the user's pool. The pool holds the stories in the window, without the user's own stories and the stories the user touched before, and it keeps the newest `N_max`. A test user whose post is not in the pool is "left out".
- **Threshold.** At least 100 kept test users in bucket 0–4. The number was fixed before the Digg count (design Open question 6).

### 3.3 Holm families

Two families per dataset, each corrected with Holm on its own. The two co-primary tests of H1 are on different datasets (`syn-W2M-M` and `digg2009`), so they are different families and each is reported on its own.

| Family | Comparisons | Size per dataset |
|---|---|---|
| F1, confirmatory | H − BL2, for each K (§7, row "K") and each group 0, 1–4, 0–4, 5–19, ≥20 | 15 |
| F2, secondary | H − each of BL0, BL1, BL2t, BL3, BL4, BL5, BL6, for each K and each group 0–4, 5–19, ≥20, all | 84 |

- Only `syn-W2M-M` and `digg2009` get F1 and F2.
- Everything else gets bootstrap confidence intervals and no p-value. That covers W0, W1, W2L, W2H, the ablations, E6, E8, the density bins and the optional Hive side check (task 9b).
- Holm stays valid when tests overlap, and bucket 0–4 contains 0 and 1–4. So the overlap does not break it.
- Holm level and confidence level: §7, row "Confidence level / Holm level".

### 3.4 Reading of H1 (confirmed by the author on 2026-11-02, task 6)

H1 passes on a dataset when, for the F1 row (NDCG@10, group 0–4), both hold:
- the Holm-adjusted p of the randomization test is below the Holm level (§7, row "Confidence level / Holm level"), and
- the lower end of the bootstrap confidence interval (same row) is above 0.

The super-plan (§1) asks for the paired confidence interval of the difference to be above 0 after Holm correction. Holm adjusts p-values, not intervals. So this is the closest standard reading.

### 3.5 H0 gate

In `syn-W0-M`, the bootstrap confidence interval of H-follow − BL2 (NDCG@10, all users) must not lie above 0. H-follow uses the α chosen for H on `syn-W2M-M` and the frozen `m`. It is a gate and not a member of a family. If it fails, stop (super-plan §1). Until 2026-11-11 the gate was H − BL2. It changed before any test-split run, because the community term carries topic interest in W0 (task 9, Stop A; super-plan 0.25).

### 3.6 Synthetic data

The same rule. P3 must print the same bucket table for `syn-W2M-M`. Proposal for the P3 spec, not a frozen value: at least 100 kept test users in bucket 0–4 at size M. Below that, P3 changes a parameter that is "chosen" (not calibrated) before any ranking run.

**Done (task 3, 2026-11-02).** `syn-W2M-M` at `q` = 0.8: 590 test users, 174 kept in bucket 0–4, 59 of them in bucket 0 (`.docs/works/2026-11-02-p3-synthetic-generator/check_output.txt`).

### 3.7 Digg numbers

Counted on 2026-10-28 by `check_cut_time.py` on the two Digg zips (SHA-256 as in `.docs/datasets.md` §4). Full output: `.docs/works/2026-10-28-p2-implementation-blueprint/cut_time_output.txt`. Two runs gave the same output hash. Window and pool cap were passed from §7, row "Window W / pool cap N_max".

What the check did with the Digg data: 3,018,197 vote rows, of which 7,299 repeat a (voter, story) pair and are dropped; 3,553 stories; 3,007,345 positives (the first vote of each story is the author's post). Of 1,731,658 links, 1,670 have date 0 and 5 are self-links; both kinds are dropped. A repeated row keeps its earliest vote. A story's `created_at` is the time of its first vote. A follow counts at `t_u` when its date is before `t_u`. Votes are `like`. Events are numbered by `(t, voter_id, story_id)`. **Task 4 kept these choices (2026-11-02).** Its TypeScript bucket table on `digg2009` gives every number below exactly (`.docs/works/2026-11-02-p4-digg-adapter/check_output.txt`).

**q = 0.8.** `n` = 3,007,345 positives. T = 2009-06-27T02:04:57Z (unix 1246068297). Users with a test item: 68,120. Pool at T: 823 stories; median pool over kept test users: 783.

| Bucket | Test users | Kept | Left out | Kept with at least one followee |
|---|---|---|---|---|
| 0 | 7,141 | 6,638 | 503 | 2,557 |
| 1–4 | 14,887 | 14,006 | 881 | 6,843 |
| 0–4 | 22,028 | 20,644 | 1,384 | 9,400 |
| 5–19 | 21,818 | 20,787 | 1,031 | 11,839 |
| ≥20 | 24,274 | 23,142 | 1,132 | 15,510 |

**q = 0.7.** `n` = 3,007,345 positives. T = 2009-06-24T15:01:58Z (unix 1245855718). Users with a test item: 85,334. Pool at T: 816 stories; median pool over kept test users: 798.

| Bucket | Test users | Kept | Left out | Kept with at least one followee |
|---|---|---|---|---|
| 0 | 12,486 | 11,855 | 631 | 4,527 |
| 1–4 | 21,771 | 20,661 | 1,110 | 10,023 |
| 0–4 | 34,257 | 32,516 | 1,741 | 14,550 |
| 5–19 | 25,812 | 24,688 | 1,124 | 13,966 |
| ≥20 | 25,265 | 24,100 | 1,165 | 16,105 |

For the trend only, q = 0.9 gives 49,217 users with a test item and 11,384 kept test users in bucket 0–4.

**Chosen q: 0.8.** The kept test users in bucket 0–4 at q = 0.8 are 20,644, above the threshold of 100 (section 3.2). So `q` stays 0.8, H1 test 2 is not underpowered by this rule, and the fallback to 0.7 is not used.

Reading: kept test users with at least one followee are 0.455 of the kept users in bucket 0–4 at q = 0.8 (9,400 users). The rest have no followee at `t_u`. For them the social term is 0, and the community term is always 0 on Digg, so H and BL2 give the same score. The H1 test 2 gain can come only from the users with a followee.

## 4. Measurement plan

One table links RQ, hypothesis, experiment, output file, table and chapter. Methods are tuned per dataset on its own validation items (super-plan §5). On Digg the community term is always 0, so β has no effect and the tie rule picks the smallest β. A dagger (†) marks a row that depends on the supervisor's answer on Digg (section 6).

| Row | RQ and H | Question | Data | Methods | Output | Thesis | Chapter |
|---|---|---|---|---|---|---|---|
| Baseline table ★ | — | baseline table for the supervisor | `syn-W0-S`, `syn-W1-S`, `syn-W2M-S`, validation | BL0–BL5 | `summary.csv` | — | — |
| H0 / E5 | H0 | does the hybrid win where it must not? | `syn-W0-M` | H, BL2 | `compare.csv` (no family) | gate | 5 |
| H1 test 1 / E2 | RQ1, H1 | cold-start gain, synthetic | `syn-W2M-M` | H, BL2 | `compare.csv`, family F1 | table, figure | 5 |
| H1 test 2 / E2 † | RQ1, H1 | cold-start gain, real | `digg2009` | H, BL2 | `compare.csv`, family F1 | table, figure | 5 |
| H2 / E3 † | RQ2, H2 | gain against social density | `syn-W2L-M`, `syn-W2M-M`, `syn-W2H-M`, `digg2009` | H, BL2 | `density.csv` | figure | 5, 6 |
| E1 † | RQ1 | how do all methods compare? | `syn-W2M-M`, `digg2009` (W0 and W1 are in E5) | all, tuned | `summary.csv`, `coverage.csv`, `compare.csv` family F2 | table | 5 |
| E4 † | RQ1 | which term matters? | `syn-W2M-M`; `digg2009` without H-comm | H, H-follow, H-comm, H-noauthor, H-noengager, H with each `m` of §7 | `summary.csv` | table | 5 |
| E5 † | H0 | is the result built into the data? | `syn-W0-M`, `syn-W1-M`, the three W2 cells; shuffle on `syn-W2M-M` | H, BL2 | `summary.csv`, `compare.csv` (no family) | table, figure | 5, 6 |
| E6 † | RQ1 | do ties matter? | `syn-W2M-M`, `digg2009` | all | `summary.csv` with reversed tie-break | table | 5 |
| E7 | — | what does the new feed cost? (Class R) | live app with `syn-W2M-M` loaded | `chrono`, `engagement`, `social` | `latency.csv`, query count | table | 5 |
| E8 | RQ1 | does pool size matter? | `syn-W2M-M` | H, BL2, the baseline with the best validation NDCG@10; K as in the E8 row of super-plan P7 | `summary.csv` with the larger pool of §7 | table | 5 |
| Hive side check (optional) | RQ1, side evidence (no H) | does the community term help on real data? | a Hive slice from SoChainDB, only if task 9b passes its gate (id set by that task) | H-comm, BL2 | `summary.csv`, `compare.csv` (no family) | table | 6 |

`leftout.csv` and `tuning.csv` come with every run. They feed Chapter 3 (protocol) and the appendix.

## 5. Task list

Written on 2026-10-28; the Status column was last updated on 2026-11-25. ✅ means the task folder is closed, with the date it closed. ▶ is the next task. The day budget counts the three approvals of each task. One task runs at a time. Writing (P9) runs next to the code tasks, done by the author outside tasks. A dagger (†) marks a task that depends on the supervisor's answer (section 6).

| Status | # | Task | Phase | Depends on | Scope (short) | Days | Ends | Bugs placed here |
|---|---|---|---|---|---|---|---|---|
| ✅ 10-28 | 1 | `p2-implementation-blueprint` | P2 | P1 | this task | 2 | 10-29 | — |
| ✅ 10-28 | 2 | `p0-baseline-freeze` | P0 | — | `.nvmrc`, `engines`, image digests, clean clone check | 0.5 | 10-30 | — |
| ✅ 11-02 | 3 | `p3-synthetic-generator` | P3 | 1, 2, D1 | `eval/` workspace, `rng.ts`, canonical writer, config, worlds, bucket table (section 3) | 2.5 | 11-01 | — |
| ✅ 11-02 | 4 | `p4-digg-adapter` † | P4 | 3 (canonical writer) | adapter, the real Digg choices, the same bucket table | 2 | 11-03 | — |
| ✅ 11-02 | 5 | `p5-ranking-package` | P5 | 1 | `packages/ranking`, move `computeExploreScoreFixed`, backend imports it, Dockerfile build order | 3 | 11-06 | T4 (score takes `asOf`) |
| ✅ 11-02 | 6 | `p5-eval-harness` | P5 ★ | 3, 4, 5 | harness, metrics, stats, scipy cross-check, golden, leakage and double-run tests, baseline table | 2 | 11-08 | — |
| ✅ 11-10 | 7 | `p3-postgres-loader` | P3 | 3 | loader with explicit ids, `--rebase-to` | 1 | 11-09 | — |
| ✅ 11-10 | 8 | `p6-social-feed` | P6 | 5, 7 | feed module, `algo`, default `algo` from an env variable, `asOf` flag, parity test, frontend toggle, D1 product rule | 2 | 11-11 | T3, B6, R2, T6 (distinct followees) |
| ✅ 11-12 | 9 | `p7-offline-experiments` † | P7 ★ | 6 | E1–E6, E8, report and macros | 2 | 11-13 | — |
| ✅ 11-12 (gate failed) | 9b | `p7-hive-check` | P7 | 9, closed on 11-13 | gate: BigQuery runs and bucket 0–4 keeps at least 100 test users with a membership (section 3.2); then a Hive adapter and H-comm against BL2 (super-plan P7) | 0.5 for the gate | 11-14 | — |
| ✅ 11-12 | 10 | `p7-cost-benchmark` | P7 | 8 | E7, throttle limit as an env variable | 1 | 11-14 | N6, T3 (cache state) |
| ✅ 11-19 | 11 | `p8-repro` | P8 | 9, 10 | `npm run thesis:repro`, default `algo` by the P7 rule, tag proposal | 1 | 11-15 | — |
| ✅ 11-19 | 12 | `p9-report-macros` | P9 | 11 | the macros Chapters 6 and 7 need, the `Full` rule; closing: the full repro run, the results that commit `17e784f` deleted by mistake | 0.5 | — | — |
| ✅ 11-19 | 13 | Writing: Guidance Manual 11 §12 (one number from start to end) | P9 | 12 | one real user of `syn-W2M-M` from the test post to the macro, en and vi | 0.25 | — | — |
| ✅ 11-19 | 14 | `p9-figure-data` | P9 | 12 | the report also writes `fig-e2` (gain by history group) and `fig-e5` (gain by world), with intervals | 0.5 | — | — |
| ✅ 11-20 | 15 | Writing: Chapter 3 Methodology | P9 | — | draft, review, LaTeX | 1 | — | — |
| ✖ dropped 11-19 | 16 | ~~`p9-diagrams`~~ | P9 | — | no task: the author draws the diagrams by hand (draw.io; sequence diagrams in the Mermaid web editor) and adds them as images in row 18 | — | — | — |
| ✅ 11-20 | 17 | Writing: Chapters 6 and 7 in LaTeX | P9 ★ | 14 | macros only, the ten tables, three figures (E2, E3, E5) in pgfplots | 1 | — | — |
| ✅ 11-20 (figures to draw) | 18 | Writing: Chapter 4 System Analysis and Design | P9 | — | requirements, use cases, activity, sequence, architecture, ERD | 1 | — | — |
| ✅ 11-20 | 19 | Writing: Chapter 5 Implementation | P9 | — | the system as built (Guidance Manual 08 and 12) | 1 | — | — |
| ✅ 11-20 | 20 | `p9-bug-quick-wins` | P9 | — | the open bugs a demo shows; README corrections of Bugs Report §7; the parity test stays green | 1 | — | R2 (interaction part), N5, N8, B9, B10, B2, R1, N2, B7, S5 (HTTP part), R7 |
| ✅ 11-20 | 21 | `p10-demo-sweep` | P10 | 20 | run `verify-bug-sweep.sh` and `verify-socket.cjs` again, walk the demo path in Chrome, add new bugs to the Bugs Report | 0.5 | — | — |
| ✅ 11-20 | 21b | `p10-demo-fixes` | P10 | 21 | V1–V5 of the demo sweep | — | — | V1–V5 |
| ✅ 11-22 | 22 | `p10-demo-script` | P10 | 21 | `scripts/demo/`: load `syn-W2M-M` with `--rebase-to` now, start the app, two demo users (little and long history), a checklist (the three `algo` side by side, a live direct message, a notification, a ban that logs out), cleanup | 1 | — | — |
| ✅ 11-22 | 23 | Writing: Chapter 8 Test Cases and Demonstration | P9 | 22 | the test summary table, a demo rehearsal, about eight screenshots | 0.5 | — | — |
| ✅ 11-22 | 24 | Writing: Chapters 1 and 2 | P9 | — | introduction; literature review from `.docs/related-work.md` | 1 | — | — |
| ✅ 11-22 | 25 | Checks for the supervisor progress check | P9 ★ | 17–24 | `verify.sh`, `test:parity`, `results:manifest`, PDF build and page count, no typed numbers | 0.5 | — | — |
| ✅ 11-22 | 26 | Progress slides for the supervisor | P10 | 25 | status, results, demo | 0.5 | — | — |
| ✅ 11-22 (draft; feedback after 11-30) | 27 | Writing: supervisor feedback, Chapter 9, abstract, acknowledgements, appendix | P9 | 26 | after the progress check | 1–2 | — | — |
| ✅ 11-23 (run again after the feedback) | 28 | `p10-final-checks` | P10 | 27 | every number a macro, every citation verified in super-plan §10, the abstract matches Chapter 6, a local overlap check against the pre-thesis text and the paper extracts, at most 100 pages | 1 | — | — |
| ✅ 11-25 | 29 | `p10-security-fixes` (only for a shared server) | P10 | — | the P2 bugs of the Bugs Report | 1 | — | S4, S6, B1, R6, B5, R3 |
| ⬜ | 30 | `p10-defense-package` | P10 | 28 | defense slides from the same figures and macros, the defense demo script; then run `npm run thesis:check` again | 1 | — | — |
| ⬜ | 31 | Freeze | P10 | 30 | `npm run thesis:check` passes, clean clone, `thesis:repro` if the ranking or eval code changed, tag `v3-thesis-final`, fast-forward `main`, push (each needs the author) | 0.5 | — | — |

**Order from row 12 on** (decided by the author on 2026-11-19). No dates: the author works through the rows as fast as possible. One task runs at a time; "Writing" rows are not tasks and run next to them. Rows 12 to 26 come before the supervisor progress check on 2026-11-30, which needs Chapters 3 to 7 in PDF and the demo. Not done, and listed as future work in Chapter 9: the schema migration (T6, N3, N10, R4), R5, N7, N9, B8, and Hive.

Spare days: 11-19 and 11-20. P0 (task 2) was done on 10-28, before P3 wrote the first manifest. Task 3 closed one day after its planned end and task 4 one day before its planned end, so on 2026-11-02 the plan is on time. Task 7 closed on 11-10, one day after its planned end. Task 8 closed on 11-10, one day before its planned end, so the plan is on time again. Chapters 1 to 5 and 8 to 9 are written by the author between 10-30 and 11-15, next to the tasks. The bugs of the last column are placed here and fixed in those tasks, not in this one.

On 2026-11-18, task 11 started three days after its planned end. Its code and data steps were done the same day. The two full repro runs (one on this machine, one on a clean clone) both passed in the night, and the task closed on 11-19, four days after its planned end. The date 2026-11-20 was the author's own target; from row 12 on the list has no dates.

**Task 9b is optional** (added 2026-11-10). Its gate runs right after task 9, only if task 9 closes on 11-13, and takes at most half a day. Tasks 10 to 13 then move half a day later, into the spare day 11-19. The whole Hive work was estimated at 2–3 days, more than the spare days left. So if the gate passes, the author decides then whether to run the rest or to put Hive in future work.

**Cut triggers.** Order of super-plan §8, each tied to a date.

| Cut | Removes | Trigger |
|---|---|---|
| 1, shuffle | the shuffle part of E5 in task 9 | task 6 not done on 11-09 |
| 2, E8 | E8 in task 9 | task 6 not done on 11-09 |
| 3, finer E4 | H-noauthor, H-noengager and the `m` sweep in task 9 | task 9 not started on 11-12 |
| 4, E7 smaller | the `engagement` row in task 10 | task 10 not started on 11-14 |
| 5, toggle | the frontend part of task 8 | task 8 not started on 11-10 |
| 6, Digg | task 4 and H1 test 2 | only if task 4 fails its gate |
| Hive (not in the §8 order) | task 9b | task 9 not closed on 11-13, or the task 9b gate fails |

The supervisor checkpoints (★) are sends, not stops. The next task starts, and an answer that changes the plan comes back as a change to this file.

## 6. Assumptions and open points

- **D1.** A community post needs membership (author's decision, 2026-10-28). The generator follows it (task 3, done). The product rule in the backend is in task 8.
- **Supervisor.** No answer yet to the P1 note. Rows that depend on the answer are marked †: task 4, H1 test 2, the Digg rows of E1 to E6. If the answer changes the data choice, only these rows change, and a line is added to the change log.
- **P4 choices.** Decided in task 4 (2026-11-02): the simple choices of section 3.7 were kept, and the rerun bucket table equals section 3.7 in every number. The reading of H1 in section 3.4 is still for the author to confirm.
- **Hive (task 9b).** Closed on 2026-11-12, gate failed: the SoChainDB dataset on BigQuery gives `Access Denied` to an outside project, and HiveSQL is paid with no join times (super-plan P7 status). Decision Q2 of 2026-10-26 stays. Tasks 10 to 13 keep their dates.

## Change log

- 1.0 · 2026-10-28 · Task `p2-implementation-blueprint`. First version.
- 1.1 · 2026-11-02 · Status line: approved 2026-10-28 (it still said draft). Task 8 scope: the default `algo` from an env variable. Task 11 scope: set the default `algo` by the P7 rule (super-plan 0.15). No day budget or date changed.
- 1.2 · 2026-11-02 · Status marks after tasks 3 and 4: a Status column in the §5 task list (tasks 1–4 ✅, task 5 next), the module map row of `eval/`, the done notes in §3.6 and §3.7, the stale P0 sentence in §5, and §6 (D1 followed by the generator; the P4 choices decided). No contract, rule, day budget or date changed.
- 1.3 · 2026-11-02 · Task `p5-ranking-package`: §2.6 gets the feature-builder signatures (`userFeaturesAsOf`, `postFeaturesAsOf`, `visibleAt`, `ageHours`), the params per method, and the BL5 form. §1 and §5: task 5 ✅, task 6 next. The other signatures of §2.6 are unchanged.
- 1.4 · 2026-11-02 · Task `p5-eval-harness`: §2.7 the 5 MB rule for `per_user.csv` and the NDCG basis of `compare.csv`; §3.4 confirmed by the author; §1 and §5: task 6 ✅, task 7 next.
- 1.5 · 2026-11-10 · Optional task 9b `p7-hive-check` (super-plan 0.22): its row and a note in §5, a cut-trigger row, a row in the §4 measurement plan, the §3.3 list of runs with no family, and a §6 bullet. No contract, rule or other task changed. Dates move only if the gate runs (tasks 10 to 13 by half a day).
- 1.6 · 2026-11-10 · Task `p3-postgres-loader`: §2.5 says what the loader writes for task 8 (three tables of positives, repost rows left out of the live pool, the `eval_load` schema); §1 `eval/` row (loader done); §5 task 7 ✅, task 8 next, one line on the day late. No contract of task 7 changed.
- 1.7 · 2026-11-10 · Task `p6-social-feed`: §1 feed rows ✅ and the decision on `getFolloweesIds` / `getCommunityIds` (not used by the feed module); §2.9 the parity sample is done (command, files); §5 task 8 ✅, task 9 next, one line on the schedule. No contract changed: the feed module calls the §2.6 signatures as they are.
- 1.8 · 2026-11-11 · Task `p7-offline-experiments`, Stop A (super-plan 0.25): §3.5 gates H-follow − BL2 on W0, not H − BL2. The grids of super-plan §7 are wider; this file quotes none of them.
- 1.9 · 2026-11-12 · Task `p7-offline-experiments` closed: §2.7 (`density.csv` on NDCG@10; family-none rows for E4, E5, E8), §2.8 (`macros.csv` gets the column `column`; the rounding rule; the tables and `results.md`), §5 task 9 ✅ and task 10 next, one day before the planned end of task 9.
- 1.10 · 2026-11-12 · Task `p7-hive-check` closed, gate failed (super-plan 0.27): §5 row 9b ✅ (gate failed), §6 the Hive bullet. The Hive row of §4 is not run. No contract, rule or frozen value changed.
- 1.11 · 2026-11-12 · Task `p7-cost-benchmark` (E7): §2.4 the new stage name `bootstrap-median` (bootstrap of the E7 run medians); §5 task 10 ✅ and task 11 next. No contract, rule or frozen value changed.
- 1.12 · 2026-11-18 · Task `p8-repro` started: §1 `eval/` row (`report/`, `bench/`, `repro/`); §2.3 the merged manifest exists; §2.9 the parity sample drawn again with the tuned α and β; §5 task 11 started, one paragraph on the schedule. No contract, rule or frozen value changed.
- 1.13 · 2026-11-19 · Task `p8-repro` closed: §1 `eval/` row (`repro/` ✅); §5 task 11 ✅ and task 12 ▶, the schedule paragraph. No contract, rule or frozen value changed.
- 1.14 · 2026-11-19 · Task `p9-report-macros`: §2.8 the `Full` rule (6 decimals), grid values as written, the new name words. No other contract, rule or frozen value changed.
- 1.15 · 2026-11-19 · Nine thesis chapters (super-plan 0.32): §5 task 12 writes Chapters 6 and 7 (Experiments and Results, Discussion), and the schedule paragraph names Chapters 1 to 5 and 8 to 9. No contract, rule or frozen value changed.
- 1.16 · 2026-11-19 · §5: the order of the remaining work, rows 12 to 31 (approved by the author), with no end dates: the writing rows, the tasks `p9-figure-data`, `p9-diagrams`, `p9-bug-quick-wins`, `p10-demo-sweep`, `p10-demo-script`, `p10-final-checks`, `p10-security-fixes`, `p10-defense-package`, the checks and the freeze; the bugs placed in each; what stays future work. No contract, rule or frozen value changed.
- 1.17 · 2026-11-19 · §5 rows 12 and 13 ✅ (task `p9-report-macros` closed; Guidance Manual 11 §12 written), row 14 ▶. No contract, rule or frozen value changed.
- 1.18 · 2026-11-19 · Task `p9-figure-data`: §2.8 the report also writes the figure data of E2 and E5 (`fig-e2-history.csv`, `fig-e5-worlds.csv`) next to E3; §4 rows E2 and E5 are "table, figure". No contract, rule or frozen value changed.
- 1.19 · 2026-11-19 · §5 row 14 ✅ (task `p9-figure-data` closed), row 15 ▶ (the Chapter 3 draft is written; review and LaTeX remain); §2.8 says ten LaTeX tables, not nine. No contract, rule or frozen value changed.
- 1.20 · 2026-11-19 · §5 row 16 dropped by the author: no diagram task; the diagrams are drawn by hand (draw.io, and the Mermaid web editor for sequence diagrams) and added as images while Chapter 4 is written; row 18 no longer depends on row 16. No contract, rule or frozen value changed.
- 1.21 · 2026-11-20 · §5 rows 15, 17, 18 and 19 ✅: Chapters 3 to 7 are in LaTeX (writing tasks on the light path, CLAUDE.md Workflow; folders `2026-11-20-p9-ch3-latex`, `-p9-ch6-7-latex`, `-p9-ch4-text`, `-p9-ch5-implementation`). The Chapter 4 figures are placeholders until the author draws them. No contract, rule or frozen value changed.
- 1.22 · 2026-11-20 · §5 row 20 ✅: task `p9-bug-quick-wins` closed. R2 (interaction part), S5 (HTTP part), N2, R1, B7, B10, B2, B9, N5, N8 and R7 are fixed, and `dev:reset` is removed. No contract, rule or frozen value changed.
- 1.23 · 2026-11-20 · §5 row 21 ✅: task `p10-demo-sweep` closed. All 28 pages and 15 flows walked in Chrome; 5 new findings V1–V5 in the Bugs Report §3.5, proposed for a short task `p10-demo-fixes` before row 22 (the author decides). No contract, rule or frozen value changed.
- 1.24 · 2026-11-20 · §5 new row 21b ✅: task `p10-demo-fixes`. V1–V5 of the demo sweep are fixed (Bugs Report §5.5). No contract, rule or frozen value changed.
- 1.25 · 2026-11-22 · §5 row 22 ✅: task `p10-demo-script`. `npm run demo:start|users|stop` (`scripts/demo/`) loads `syn-W2M-M` rebased to now into the new schema `eval_demo` with Redis database 3, adds the admin `demo_admin`, and picks the two demo users (`u0000000787`, history 2; `u0000000064`, history 28). Rehearsal: every checklist step PASS, no new bug. `eval_load` and the parity test are not touched. No contract, rule or frozen value changed.
- 1.26 · 2026-11-22 · §5 rows 23–27 ✅ (writing, light path; task folders `2026-11-22-p9-ch8-tests-demo`, `p9-ch1-2`, `p10-progress-slides`, `p9-ch9-front-back`). Chapters 1, 2, 8 and 9, the abstract, the acknowledgements (names left as placeholders), Appendix A (full test list) and B (F1 at K = 5, 10, 20 and F2, read from `p7-main/compare.csv`), and the Beamer progress deck (`.docs/Thesis-Report/slides/`, 20 frames). Row 25 checks: `verify.sh` all PASS, `test:parity` 102/102, `results:manifest` equal (162 files), the thesis builds with no error or undefined reference, 96 PDF pages (Chapters 1–9 pp. 1–72, appendix pp. 77–85), no typed decimal in any chapter; two `\macromissing` marks remain in Chapter 6 (lines 262 and 345), for `p10-final-checks`. Row 27 still takes the supervisor's feedback after 2026-11-30. No contract, rule or frozen value changed.
- 1.27 · 2026-11-23 · §5 row 28 ("every number a macro"), first part: task `p9-missing-macros`. The two `\macromissing` marks of Chapter 6 (lines 262 and 345) are filled with macros. `p7-report` has 172 macros: 19 new (the E3 counts of the bin 1–4 in the three W2 cells, the E6 NDCG@10 of the nine methods on both datasets, two 6-decimal values of BL4 on `syn-W2M-M`), and the old 153 keep their names and values. The report now runs `checkTieChanges` before it writes: it stops when the largest E6 change is not BL4 on `syn-W2M-M`, when another pair has the same change, or when H or BL2 change at 3 decimals. The E6 text now says that BL4 is the most sensitive method and that H and BL2 do not change. `results:manifest` equal (162 files). Row 28 stays open (citations, abstract check, overlap check, page limit). No contract, rule or frozen value changed.
- 1.28 · 2026-11-23 · §5 row 28 ✅: task `p10-final-checks`. `npm run thesis:check` (`scripts/thesis-check/`) runs the five final checks (numbers, citations, abstract, overlap, pages) on the thesis and checks 1–2 on the slides. First run: numbers, citations (44 of 44 verified), abstract and pages (97 in total, 73 for Chapters 1–9) PASS; overlap FAILs on 8 runs of 8 words or more in Chapter 2 that repeat lines of the P1 literature extracts, listed in the task's `triage.md` for the author; 0 runs shared with the pre-thesis text. Rows 30 and 31 run the command again after the supervisor's feedback.
- 1.29 · 2026-11-25 · §5 row 29 ✅: task `p10-security-fixes`. B1, S4, S6, B5, R3 (the part that needs no major version) and R6 are fixed (Bugs Report §5.6): moderation and promote DTOs, no ban of self or admins, uploads keep only image and video types with `nosniff`, a start check for `JWT_SECRET` in production, a crypto email code, 5 code tries per email, a password reset ends older sessions (`User.passwordVersion`, claim `pwv`), `EmailVerifiedGuard` reads the database for an unverified token, `npm audit fix` and `next` 15.5.29. One new migration. No contract, rule or frozen value changed; the parity test still gives 102 of 102.
