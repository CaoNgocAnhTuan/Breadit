# Evaluation harness, metrics, statistics and the baseline table

Spec status: draft · 2026-11-02
Design status: pending
Type: feature · Folder: `.docs/works/2026-11-02-p5-eval-harness/`

## 1. Spec

### Problem

Every number in Chapter 5 comes from one program: the harness. It takes a canonical dataset and a split, finds each user's test or validation item, builds the pool and ranks it with each method. Then it writes metrics and statistics to CSV files that the report turns into tables. Super-plan P5 part 2 asks for it, with three tests that must pass (golden, leakage, double run) and a first output for the supervisor (★): a baseline table on the validation split before tuning starts. This is task 6 in the blueprint (`.docs/implementation-plan.md` §5): "harness, metrics, stats, scipy cross-check, golden, leakage and double-run tests, baseline table", 2 days, planned end 2026-11-08. The four "freeze at P5" rows of super-plan §7 were moved here by task 5 (its Open question 2): the baseline grids, the larger pool (W_L, N_L), the value of T, and the use of `m` and the α/β grid as they are.

What exists today (checked on 2026-11-02):
- **The data.** `eval/data/` holds the eight synthetic datasets (P3) and `digg2009` (P4), with manifests. `loadDataset` (`eval/src/canonical/dataset.ts`) reads any of them. `digg2009/interactions.csv` is 100 MB; the synthetic ones are under 1 MB each.
- **The ranking code.** `@breadit/ranking` (task 5) has `visibleAt`, `userFeaturesAsOf`, `postFeaturesAsOf`, `buildPool`, `scorer` for 13 method ids and `rankPool` (blueprint §2.6). It uses string user ids (`u` plus 10 digits, blueprint §2.5); the canonical files use integers.
- **The split rule exists once.** `eval/src/checks/buckets.ts` has `cutTime`, `testItems`, `historyCount` and `bucketOf` (blueprint §3.1–§3.2). It already gives T = 1246068297 for `digg2009` and T = 21412417 for `syn-W2M-M` at `q` = 0.8 (P3 and P4 `check_output.txt`). There is no validation-item rule in code yet. Super-plan §5: a user's validation item is their last positive before T, on a post they had not touched before.
- **The PRNG streams** `bootstrap` and `permutation` are reserved in `eval/src/rng.ts` for this task (blueprint §2.4).
- **The contracts.** Blueprint §2.7 gives the results files (`per_user.csv`, `summary.csv`, `coverage.csv`, `leftout.csv`, `tuning.csv`, `compare.csv`, `density.csv`) under `.docs/results/<runId>/`. §2.9 gives the `rank` command. §3.3 gives the Holm families F1 and F2, §3.4 the reading of H1 ("for the author to confirm"), §3.5 the H0 gate, §4 the measurement plan. `.docs/results/` does not exist yet.
- **The guard.** `.claude/hooks/pre-bash.cjs` asks the author before any command with `--split test` (super-plan §5: the test split runs once, after tuning is frozen).
- **scipy is not usable on this Mac.** Python 3.13 imports a broken numpy ("exit the numpy source tree"); the Homebrew, 3.14 and system Pythons have no scipy. statsmodels is not installed anywhere. The planned scipy cross-check needs an environment first (Open question 5).
- **Size not checked.** The harness on `digg2009` has about 68,000 test users with a pool of about 800 posts each. Its run time and memory are not known.

### Scope

**In scope:**
- **The harness** in `eval/src/harness/`. It reads one canonical dataset and one split (`validation` or `test`) and does these steps:
  1. Compute T by the blueprint §3.1 rule, reusing `buckets.ts`.
  2. Find each user's item (validation: last positive at or before T; test: last positive after T, both on a post not touched before).
  3. Build the features and the pool at the item's time with `@breadit/ranking`.
  4. Rank the pool with each requested method, and find the item's rank.
- **The results files.** The harness writes `per_user.csv`, `summary.csv`, `coverage.csv`, `leftout.csv` and a manifest with hashes (blueprint §2.7, §2.3).
- **Metrics** (`eval/src/metrics.ts`): Recall@K (= HitRate@K), NDCG@K and Coverage@K for K of §7 (super-plan §5).
- **Statistics** (`eval/src/stats.ts`): paired bootstrap 95% CI and paired randomization test with the seeded `bootstrap` and `permutation` streams, the resample counts of §7, and Holm per family of blueprint §3.3. The code that writes `compare.csv`. One cross-check against scipy on a small fixture, with the fixture result committed.
- **Tuning support.** For each tuned method, a grid run on the validation split writes `tuning.csv` and picks the value with the rule of super-plan §5. It is tested on the golden fixture, and run on real data only in task 9.
- **The `rank` command** of blueprint §2.9, for the P6 parity test.
- **The three P5 tests:** golden, leakage, double run (super-plan P5 "Done when").
- **The baseline table ★:** BL0–BL5 on `syn-W0-S`, `syn-W1-S` and `syn-W2M-S`, validation split, with the production and published parameters. It is written as a short note in this task folder, ready to send.
- **The P5 frozen values,** proposed in Open questions 1 to 3 and written into §7 at the end of the task: the baseline grids, W_L and N_L, and the value of T for each dataset.

**Out of scope:**
- Any run of the test split. The harness supports it, but this task never runs it.
- Tuning runs on real data, E1–E8, `density.csv`, the report, `macros.csv` and `results-macros.tex` (task 9, `p7-offline-experiments`).
- The parity sample CSV of blueprint §2.9 (task 8 draws it with the `parity` stream).
- Any change to `@breadit/ranking`'s formulas, the backend or the frontend.

### Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | **Golden.** A tiny committed dataset (a few users and posts, written by hand) through the harness, all methods, validation and test split | The CSV files equal the committed expected files byte for byte. For at least two users, the expected rank and metrics are worked out by hand in the test |
| DW2 | **Leakage.** For each user of the golden dataset and of a sample from `syn-W2M-S`, change or delete every event after that user's item time (follows, memberships, interactions, later posts), then rank again | The user's `per_user.csv` rows are unchanged for every method |
| DW3 | **Double run.** The baseline-table run twice into two empty folders | Every results file and the manifest are byte-identical |
| DW4 | **Metrics** on hand-made ranks | Recall@K equals HitRate@K; NDCG@K = `1/log2(r+1)` for `r ≤ K`, else 0; Coverage@K as super-plan §5 |
| DW5 | **Statistics** on a small committed fixture | Bootstrap CI, randomization p-value and Holm-adjusted p agree with the scipy reference within the tolerance the Design states. Two runs give identical numbers |
| DW6 | **T and items** on all nine datasets, both splits counted but only validation ranked | T for `digg2009` is 1246068297 and for `syn-W2M-M` 21412417. The test-split kept and left-out counts per bucket equal the P3 and P4 bucket tables |
| DW7 | **Baseline table ★** | `summary.csv`, `coverage.csv` and `leftout.csv` for BL0–BL5 on the three S datasets, validation split, and a one-page note in this task folder with the table and how it was made |
| DW8 | **No test-split run** | No results folder has `split = test`, except the golden fixture's. The hook never asked during the task |
| DW9 | **Size.** Validation run of BL2 and H (frozen `m`, α = β = 1 as a plain setting) on `syn-W2M-M` and on `digg2009` | Both finish. Run time and peak memory are reported (Class R, not compared) |
| DW10 | **`rank` command** for a few (dataset, method, user, `asOf`) cases | The printed order equals the order behind that user's `per_user.csv` rank |
| DW11 | `bash .claude/hooks/verify.sh` with db and redis up | Every check passes, and the eval grep test covers the new files |
| DW12 | `git diff --stat` of the task commits | Only `eval/`, `.docs/results/` (if Open question 4 keeps it), `.gitignore`, `CLAUDE.md`, `.docs/super-plan.md`, `.docs/implementation-plan.md` and this task folder |

### Open questions

1. **Baseline grids (§7, freeze at P5).** Each grid needs 3 to 5 values that include the published or production value. Recommendation:
   - BL2t age weight: 0.0625, 0.125, 0.25, 0.5, 1 per hour;
   - BL4 time divisor: 11,250, 22,500, 45,000, 90,000, 180,000 seconds;
   - BL5 gravity: 1.2, 1.5, 1.8, 2.1, 2.4.

   The first two step by a factor of 2 around the published value, because they scale time. Gravity is an exponent, so it steps evenly. Other option: 3 values each, which is cheaper to tune and less fair to the baselines.
2. **Larger pool for E8 (§7, freeze at P5).** Recommendation: W_L = 14 days, N_L = 4,000, twice W and N_max. At the Digg cut time this roughly doubles the pool (823 stories in 7 days, P4). Other option: W_L = 30 days with no change to N_max, which tests the window alone.
3. **The value of T (§7, freeze at P5).** T comes from the rule of blueprint §3.1 and the data, so it is not chosen. Recommendation: the harness computes it, the task writes the nine values into the §7 row "Cut time T", and from then on the harness checks the computed T against that row and stops if they differ. That protects against a silent change in a dataset.
4. **Where large results go.** Blueprint §2.7 puts every results file in `.docs/results/<runId>/`. For `digg2009`, `per_user.csv` would have about 68,000 users × 13 methods ≈ 900,000 rows (tens of MB) per split. Recommendation: `summary.csv`, `coverage.csv`, `leftout.csv`, `tuning.csv`, `compare.csv`, `density.csv` and the manifest stay in `.docs/results/<runId>/` and are committed. `per_user.csv` is committed only when it is under 5 MB. Otherwise it goes to `eval/results/<runId>/` (git-ignored), and its SHA-256 is still in the committed manifest. This changes the contract of §2.7 a little. Other option: commit every `per_user.csv` with Git LFS.
5. **The scipy cross-check environment.** Recommendation: a Python virtual environment outside the repo with pinned `numpy` and `scipy`, used once. The cross-check script and its output are committed in this task folder with the versions. scipy has no Holm function, so Holm is checked against a worked example by hand from the paper [22]. Other option: skip scipy and check every statistic against hand-computed small cases only.
6. **The reading of H1 (blueprint §3.4, "for the author to confirm").** The `compare.csv` code computes both the Holm-adjusted p and the bootstrap CI. Recommendation: confirm §3.4 as written. H1 passes on a dataset when, for NDCG@10 in group 0–4, the Holm-adjusted p is below 0.05 and the lower end of the 95% CI is above 0. Other option: the CI alone (the super-plan's words), which ignores the Holm step.

## 2. Impact

**Who and what it affects.**
- **Thesis results.** Every table and figure in Chapter 5 comes from these files: the split, the metrics, the statistics and the H1 verdict. A bug here is a wrong thesis. DW1 to DW5 test each layer: hand-checked numbers, no leak, determinism, and an outside reference for the statistics.
- **The supervisor checkpoint ★.** The baseline table is the first number the supervisor sees. It goes out before tuning, as a send, not a stop (blueprint §5).
- **Later tasks.** Task 9 runs E1–E8 through this harness and adds the report and macros. Task 8 uses the `rank` command for the parity test. P8's `thesis:repro` reruns everything and compares the manifests.
- **The live app.** None. No backend, frontend or database change.
- **If we do nothing.** No experiment can run; the thesis has no results.

**Frozen values.** This task proposes and, at the end, writes three §7 rows: the baseline grids, the larger pool and the value of T (Open questions 1–3). It uses `m`, the α/β grid, K, the buckets, the resample counts and the levels as they are. No existing frozen value changes.

**Schedule.** Budget 2 days, planned end 2026-11-08. Starting on 2026-11-02, it should end around 11-04. The cut triggers 1 and 2 (the shuffle part of E5, and E8) fire only if this task is not done on 11-09.

**Code areas.**
- New: `eval/src/harness/`, `eval/src/metrics.ts`, `eval/src/stats.ts`, `eval/src/cli/` (`harness`, `rank`), a golden fixture with expected CSVs, and tests.
- Changed: `eval/package.json` (scripts), `.gitignore` (Open question 4).
- Docs: `CLAUDE.md` (commands), super-plan §7 and P5 status, blueprint §2.7 if Open question 4 changes it.

**Other tasks and bugs on the same files.**
- `eval/src/checks/buckets.ts` is reused, not changed, unless the Design moves its split functions to a shared place.
- No bug in the Bugs Report touches `eval/`.

**Thesis link.**
- **Super-plan:** P5 part 2, §2 (Class D: every file hashed), §5 (the whole protocol), §7.
- **Blueprint:** §2.7, §2.9, §3.3–§3.5, §4.
- **Hypotheses:** RQ1 and H1 (the F1 family and the H1 reading), RQ2 and H2 (through task 9), H0 (the gate code).

## 3. Design

### Approach

**Rejected options:**

| Option | Why not |
|---|---|
| | |

### Workflow and sequence diagrams

```mermaid
sequenceDiagram
    participant C as Client
    participant B as Backend
```

### Failure modes

| # | What can go wrong | How we notice | How we resolve it |
|---|---|---|---|
| F1 | | | |

### Code files

| File | New or changed | Purpose |
|---|---|---|
| | | |

### Data, schema and cache changes
