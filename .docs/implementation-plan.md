# Implementation blueprint

Version 1.0 · 2026-10-28 · Status: draft for the author's approval
Super-plan: [super-plan.md](super-plan.md) · Task: `.docs/works/2026-10-28-p2-implementation-blueprint/`

How the pieces of P3 to P10 fit together in the code. A thing is here only if two or more tasks share it. Detail that one task owns stays in that task's `design.md`. Frozen values live in super-plan §7. This file points to them as "§7, <row name>" and does not copy them.

## 1. Module map

| Module | Owner task | May import | What it holds |
|---|---|---|---|
| `packages/ranking` (`@breadit/ranking`) | `p5-ranking-package` | the Node standard library only | Types, `buildPool`, as-of feature functions, every scorer, `rankPool`, and `computeExploreScoreFixed` moved from `posts.service.ts`. Pure: no Nest, Prisma, Redis, clock or randomness. Builds to `dist/` with `tsc`, like `@breadit/shared` |
| `eval/` (`@breadit/eval`, added to the root `workspaces`) | `p3-synthetic-generator` creates it | `@breadit/ranking`; `@prisma/client` in `src/loader/` only | `src/rng.ts`, `src/canonical/` (CSV and manifest), `src/generator/`, `src/loader/`, `src/adapters/digg.ts`, `src/harness/`, `src/metrics.ts`, `src/stats.ts`, `src/report/`, `config/` |
| Backend feed module `apps/backend/src/feed/` | `p6-social-feed` | `@breadit/ranking`, `PrismaService`, `BlockService` | A thin service that loads data and calls `buildPool` and a scorer. `PostsService.findAll` calls it when `algo` is set. Explore imports `computeExploreScoreFixed` from `@breadit/ranking` (done in `p5-ranking-package`) |
| Frontend toggle | `p6-social-feed` | the API only | `algo` in `app/(board)/page.tsx`, `Feed.tsx`, `InfiniteFeed.tsx` |

Rules:
- Nothing imports `eval`.
- The harness never touches Postgres, Redis or HTTP (super-plan §2). Only the loader writes to Postgres.
- `getFolloweesIds` and `getCommunityIds` stay in `PostsService`. P6 decides how the feed module reaches them.
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

P8 merges all of them into `.docs/results/manifest.json` and compares.

### 2.4 PRNG

`eval/src/rng.ts` has `rng(masterSeed, stage)` as in super-plan §2. The stage names are fixed: `users`, `follows`, `communities`, `posts`, `interactions` (P3); `bootstrap`, `permutation` (P5); `parity` (P6); `shuffle` (P7). A new stage gets a new name. Names are never reused.

### 2.5 User ids in the app and in the CSVs

The app has string user ids and the CSVs have integers. One rule for both sides: inside `packages/ranking` a user id is a string, `u` plus the integer padded to 10 digits (`u0000000042`). The loader writes the same string as `User.id`. So the live app and the harness sort users the same way (plain `<` on strings, never `localeCompare`). Post ids stay integers: `Post.id` is an autoincrement integer, and the loader sets it explicitly.

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

### 2.7 Results files (H-d)

Written by the harness into `.docs/results/<runId>/`. Class D (super-plan §2). Metrics have 6 decimals.

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

### 2.8 Macros (H-d)

The report reads only the CSVs above. It writes `macros.csv` (`name, value, file, row_key`) and `results-macros.tex`. A macro name has letters only, because LaTeX does not allow digits. It is built from: experiment, dataset, metric, K in words, what. Example: `\eTwoDiggNdcgTenGain`. Every macro traces to one CSV cell through `macros.csv`.

### 2.9 Parity sample (H-e)

`eval rank --dataset <id> --method <m> --user <u> --asof <t> --top <n>` prints post ids in order. The 100 (user, `asOf`) pairs of the P6 test are drawn with the `parity` stream from users and times of `syn-W2M-M`. They are written to a committed CSV, so P6 and the harness use the same pairs.

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
- Everything else gets bootstrap confidence intervals and no p-value. That covers W0, W1, W2L, W2H, the ablations, E6, E8 and the density bins.
- Holm stays valid when tests overlap, and bucket 0–4 contains 0 and 1–4. So the overlap does not break it.
- Holm level and confidence level: §7, row "Confidence level / Holm level".

### 3.4 Reading of H1 (for the author to confirm)

H1 passes on a dataset when, for the F1 row (NDCG@10, group 0–4), both hold:
- the Holm-adjusted p of the randomization test is below the Holm level (§7, row "Confidence level / Holm level"), and
- the lower end of the bootstrap confidence interval (same row) is above 0.

The super-plan says "the paired 95% confidence interval of the difference is above 0 after Holm correction". Holm adjusts p-values, not intervals. So this is the closest standard reading.

### 3.5 H0 gate

In `syn-W0-M`, the bootstrap confidence interval of H − BL2 (NDCG@10, all users) must not lie above 0. It is a gate and not a member of a family. If it fails, stop (super-plan §1).

### 3.6 Synthetic data

The same rule. P3 must print the same bucket table for `syn-W2M-M`. Proposal for the P3 spec, not a frozen value: at least 100 kept test users in bucket 0–4 at size M. Below that, P3 changes a parameter that is "chosen" (not calibrated) before any ranking run.

### 3.7 Digg numbers

Counted on 2026-10-28 by `check_cut_time.py` on the two Digg zips (SHA-256 as in `.docs/datasets.md` §4). Full output: `.docs/works/2026-10-28-p2-implementation-blueprint/cut_time_output.txt`. Two runs gave the same output hash. Window and pool cap were passed from §7, row "Window W / pool cap N_max".

What the check did with the Digg data: 3,018,197 vote rows, of which 7,299 repeat a (voter, story) pair and are dropped; 3,553 stories; 3,007,345 positives (the first vote of each story is the author's post). Of 1,731,658 links, 1,670 have date 0 and 5 are self-links; both kinds are dropped. P4 decides these choices for real.

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

To be written (Step 6 of the P2 plan).

## 5. Task list

To be written (Step 6 of the P2 plan).

## 6. Assumptions and open points

To be written (Step 6 of the P2 plan).
