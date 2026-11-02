# Plan: Evaluation harness, metrics, statistics and the baseline table

Status: approved · 2026-11-02
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-02-p5-eval-harness/`

---

## How to read this plan

- **What changes.** New code goes in `eval/`. Changed: `eval/package.json`, `eval/config/frozen-v1.json`, `eval/src/frozen.ts`, `eval/src/frozen.test.ts`, `.gitignore`. New results: `.docs/results/p5-baseline/`. Do not touch `packages/ranking/`, `apps/`, the Prisma schema, `docs/`, `Latex/`, `.env` or `.claude/`.
- **Needs:**
  - the pinned Node (`source ~/.nvm/nvm.sh`, then `nvm use` in the repo root);
  - a built `@breadit/ranking` (`npm run build -w @breadit/ranking`);
  - the nine datasets in `eval/data/` (rebuild with `gen` and `adapt:digg` if missing);
  - network access once, in Step 3, to install `numpy` and `scipy` into a virtual environment **outside the repo**.

  No Docker is needed except for Claude's `verify.sh` run.
- **Who does what.**
  - **Claude does Step 0 before Sonnet starts.** It writes the approved §7 values, so the frozen test of Step 1 has its numbers.
  - **Sonnet does Steps 1 to 9.**
  - **Claude does "Claude's part" and the Acceptance.**
  - Sonnet does not edit `.docs/super-plan.md`, `.docs/implementation-plan.md`, `CLAUDE.md`, `design.md`, or any file in this task folder except `run_output.txt`, `stats_crosscheck.py`, `stats_reference.json` and the ticks in this plan.
- **Rules for every step.**
  - Tests first: write the test, run it, see it fail for the right reason, then write the code.
  - Follow `.claude/rules/determinism.md` and `.claude/rules/evaluation.md`. The eval grep test must stay green.
  - **Never run the test split on real data.** Never type `--split test`. Never add `testApprovedBy` to a run config. Only the golden test runs the test split, in memory (design F6).
  - Do not change `@breadit/ranking`. If the package seems wrong, stop and report.
  - If a step cannot be done as written, stop and report what and why. Do not work around it.
- **Commits** go on `test-app` and are never pushed. One commit per step, holding its own files and this `plan.md` (the ticks). Stage files by path; never stage `docs/supervisor-note.md`, `refs-manual/`, `datasets/`, `eval/data/` or `eval/results/`. End every commit message with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Approving this plan approves the commits listed.
- Effort scale (work size, not model effort): XS under 30 minutes, S under 2 hours, M half a day.

## Steps

#### Step 0 (Claude): the approved §7 values (effort XS)

- [ ] **The §7 rows.** In `.docs/super-plan.md` §7, fill three rows:
  - **"Larger pool (W_L, N_L) for E8":** 14 days / 4,000.
  - **"Baseline grids":** BL2t age weight 0.0625, 0.125, 0.25, 0.5, 1 per hour; BL4 time divisor 11,250, 22,500, 45,000, 90,000, 180,000 s; BL5 gravity 1.2, 1.5, 1.8, 2.1, 2.4.
  - **"Cut time T":** `q` = 0.8. The S datasets get 21393508, the M datasets 21412417 (both in seconds from the base epoch), and `digg2009` 1246068297 (Unix seconds). These values were computed on 2026-11-02 with `cutTime` of `eval/src/checks/buckets.ts`.
- [ ] **The change log.** Add a line, and give each of the three rows "frozen 2026-11-02".
- [ ] Commit: `docs: super-plan §7, the P5 frozen values (grids, larger pool, T)`

#### Step 1: Frozen values in code (effort XS)

- [ ] Tests first (TC1): extend `frozen.test.ts` so it reads the three §7 rows of Step 0 and compares them with `frozen-v1.json`. For "Cut time T", every dataset id must have its value.
- [ ] Add `cutTimes`, `poolLarge` and `baselineGrids` to `eval/config/frozen-v1.json`, and to the `Frozen` type and `loadFrozen` in `eval/src/frozen.ts` (design: Approach "T is checked against §7").
- [ ] Commit: `feat: eval frozen values for P5 (T, larger pool, baseline grids)`

#### Step 2: Metrics (effort XS)

- [ ] Tests first (TC4): `recallAt` and `ndcgAt` on hand ranks: rank 1, rank K, rank K + 1, and a large rank. `summarize` covers the groups (each bucket, `0-4`, `all`), the means in `user_id` order and 6 decimals. `coverage` covers two methods with overlapping top-K lists.
- [ ] Write `eval/src/metrics.ts` (design: Approach "Metrics").
- [ ] Commit: `feat: eval metrics (Recall/HitRate, NDCG, Coverage)`

#### Step 3: Statistics and the scipy cross-check (effort M)

- [ ] **The fixture.** Write `eval/src/stats-fixture.csv` with 14 paired values. Some of them must be tied, and at least one difference must be zero.
- [ ] **The scipy reference.** Make a Python virtual environment **outside the repo**, for example in the scratchpad, and install pinned `numpy` and `scipy`. Write `stats_crosscheck.py` in this task folder; it reads the fixture and writes `stats_reference.json` with:
  - the exact p of `scipy.stats.permutation_test(..., permutation_type="samples")`;
  - the CI of `scipy.stats.bootstrap(..., paired=True, method="percentile")`;
  - the Python, numpy and scipy versions.

  If the install fails, stop and report (design F11).
- [ ] **Tests first (TC5).**
  - `exactRandomizationTest` equals the scipy exact p to `1e-12`.
  - `randomizationTest` is within 3 standard errors of it.
  - The `pairedBootstrap` CI bounds are within 0.02 of scipy's.
  - `holm` equals a worked example from Holm (1979), written out in the test.
  - Two runs give identical numbers.
  - Each comparison restarts its stream: computing comparison B before or after comparison A gives the same B.
  - `h1Verdict` and `h0Gate` match blueprint §3.4 and §3.5 on hand-made rows.
- [ ] **The code.** Write `eval/src/stats.ts`, including `writeCompare` with the columns of blueprint §2.7 (design: Approach "Statistics", "The scipy cross-check").
- [ ] Commit: `feat: eval statistics (paired bootstrap, randomization, Holm) and scipy cross-check`

#### Step 4: Split (effort XS)

- [ ] Tests first (TC6, part 1): `validationItems` picks each user's last positive with `t ≤ T` by `(t, event_id)`. An event at exactly T is validation. A user with nothing at or before T has no validation item. On `syn-W2M-S`, the test items of the harness equal `testItems` of `buckets.ts`.
- [ ] Write `eval/src/harness/split.ts` (design: Approach "The split").
- [ ] Commit: `feat: eval harness split (validation and test items)`

#### Step 5: Indexes and post features (effort S)

- [ ] Tests first (TC9): on random fixtures and on `syn-W2M-S`, for random (user, post, `asOf`):
  - the counts of `fastPostFeatures` equal those of `postFeaturesAsOf`;
  - its `engagedBy` equals `postFeaturesAsOf(...).engagedBy` ∩ the user's followees;
  - every scorer gives the same `scoreFixed` with either one.
- [ ] Write `eval/src/harness/index-data.ts` and `eval/src/harness/post-features.ts` (design: Approach "One fast path").
- [ ] Commit: `feat: eval harness indexes and fast post features`

#### Step 6: The run, the golden dataset and the leakage test (effort M)

- [ ] **Golden (TC2, DW1).** Write the golden dataset by hand in `eval/src/harness/fixtures/golden/`: about 6 users, 12 posts, a few follows, one community, interactions on both sides of its T.
  - For two users, work out in the test's comments the item, the pool, each method's rank and the metrics.
  - The harness, for all 13 methods and both splits in memory, must give the files in `golden-expected/` byte for byte.
- [ ] **Leakage (TC3, DW2).** For each golden user, and for 30 users of `syn-W2M-S` chosen with the `bootstrap` stream:
  - change or delete every follow, membership, post and interaction after that user's item time;
  - hold T fixed and rank again;
  - the user's `per_user` rows must not change.
- [ ] **Reference mode (TC9).** On `syn-W2M-S`, the `fast` and `reference` modes give byte-identical `per_user.csv`.
- [ ] **Guards (TC10).**
  - A config with `split: "test"` and no `testApprovedBy` stops before loading data.
  - A T that differs from `cutTimes` stops with both values.
  - A missing method param stops before loading data.
- [ ] **The code.** Write `eval/src/harness/run.ts` and `eval/src/harness/write.ts`, with the 5 MB rule for `per_user.csv` and the run manifest (design: Approach "Runs are configs", "Output").
- [ ] Commit: `feat: eval harness run, results files, golden and leakage tests`

#### Step 7: Tuning (effort S)

- [ ] Tests first (TC7): on the golden dataset:
  - a grid for BL2t and one for H gives the `tuning.csv` rows;
  - the choice is by NDCG@10, ties to the smaller value, and for H to the smaller `(α, β)`;
  - the grids come from `frozen-v1.json`;
  - a test-split config is refused for tuning.
- [ ] Write `eval/src/harness/tuning.ts` (design: Approach "Tuning").
- [ ] Commit: `feat: eval harness tuning on the validation split`

#### Step 8: Commands (effort S)

- [ ] Tests first (TC8, DW10): for 5 (dataset, method, user, `asOf`) cases on `syn-W2M-S`, `rank` prints the order behind the user's `per_user` rank. The item's position in the printed list equals its rank.
- [ ] Write `eval/src/cli/harness.ts` and `eval/src/cli/rank.ts`. Add the `harness` and `rank` scripts to `eval/package.json` with `--max-old-space-size=4096`. Add `eval/results/` to `.gitignore`.
- [ ] Commit: `feat: eval harness and rank commands`

#### Step 9: Real runs (effort M)

- [ ] **The baseline table (DW7).** Write `eval/config/runs/p5-baseline.json`: BL0–BL5 on `syn-W0-S`, `syn-W1-S` and `syn-W2M-S`, validation split, BL4 `divisor` 45000, BL5 `gravity` 1.8, normal pool. Run it into `.docs/results/p5-baseline/`.
- [ ] **Double run (DW3).** Run it again into a folder outside the repo and compare every file.
- [ ] **T on all nine datasets (DW6).** Compute T and count the validation items, with no ranking. Every T must equal `cutTimes`. Write the counts per bucket to `run_output.txt`.
- [ ] **Size (DW9).** Run BL2 and H (`m` from §7, `alpha` 1, `beta` 1) on the validation split of `syn-W2M-M` and `digg2009`, into a folder outside the repo, with a config that is not committed. Write the run time and peak memory to `run_output.txt`. If `digg2009` takes more than 30 minutes, stop and report (design F4).
- [ ] Commit: `chore: P5 baseline table and harness runs` (the config, `.docs/results/p5-baseline/`, `run_output.txt`)

## Claude's part

- [ ] Read the commits and the diff against the design. Check that no results folder has `split = test` (DW8).
- [ ] `bash .claude/hooks/verify.sh` with db and redis up (DW11).
- [ ] **The supervisor note.** Write `baseline-note.md` in this task folder (the ★ checkpoint): the table from `summary.csv`, what was run, and what comes next (tuning, then the experiments).
- [ ] **Docs:**
  - `CLAUDE.md`: the `harness` and `rank` commands in the eval line.
  - `.docs/implementation-plan.md`: §2.7 (the 5 MB rule and `eval/results/`), §3.4 confirmed by the author on 2026-11-02, task 6 ✅, a change-log line.
  - `.docs/super-plan.md`: the P5 status and the §4 row (P5 ✅ when DW1–DW12 pass), a change-log line.
  - Commit: `docs: close p5-eval-harness`.
- [ ] Fill in the Result, then close the task.

## Tests

All tests are unit tests in `eval/src/**/*.test.ts` (`node --test`, pinned Node). They read `eval/data/` for the S datasets. None needs Docker.

| ID | Covers | What it checks |
|---|---|---|
| TC1 | DW6, design F2 | `frozen-v1.json` equals the three new §7 rows |
| TC2 | DW1 | Golden: hand-checked ranks and metrics; all CSV files byte-identical to the expected ones |
| TC3 | DW2 | Leakage: later events changed or deleted, the same rows |
| TC4 | DW4 | Metrics on hand ranks, groups, coverage |
| TC5 | DW5 | Statistics against scipy and Holm's example; restarted streams; H1 verdict and H0 gate |
| TC6 | DW6 | Validation and test items; test items equal `buckets.ts` |
| TC7 | — (tuning rule) | Grid choice and ties |
| TC8 | DW10 | `rank` prints the order behind `per_user` |
| TC9 | design F3 | Fast and reference post features give the same scores and the same `per_user.csv` |
| TC10 | DW8, design F2, F6, F10 | The test-split guard, the T check, missing params |

## Acceptance

- [ ] `.docs/results/p5-baseline/` → `summary.csv`, `coverage.csv`, `leftout.csv`, `per_user.csv` and `manifest.json` for BL0–BL5 on the three S datasets, validation split (DW7)
- [ ] Rerun `p5-baseline` into an empty folder outside the repo → every file is byte-identical (DW3)
- [ ] `run_output.txt` → the T of all nine datasets equals §7; the validation counts per bucket are printed (DW6)
- [ ] `run_output.txt` → BL2 and H finish on `syn-W2M-M` and `digg2009`, with the time and memory noted (DW9)
- [ ] `grep` for `"split": "test"` under `.docs/results/` and `eval/config/runs/` → no match (DW8)
- [ ] The eval tests → TC1–TC10 pass (DW1, DW2, DW4, DW5, DW10)
- [ ] `bash .claude/hooks/verify.sh` with db and redis up → every check passes (DW11)
- [ ] `git diff --stat` of the task commits → only the files of DW12 (DW12)

## Result
