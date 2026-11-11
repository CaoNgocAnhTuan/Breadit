# Plan: P7 offline experiments E1–E6, E8, report and macros

Status: approved · 2026-11-11
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-11-p7-offline-experiments/`

---

## How to read this plan

- **Files.** Only the files of design "Code files", plus this `plan.md` (ticks) and `run_output.txt` in this folder. Do not touch `apps/`, the Prisma schema or migrations, `eval/config/frozen-v1.json`, `eval/config/synthetic-v1.json`, `eval/data/`, `Latex/`, `docs/`, `.env`, `.claude/`, `CLAUDE.md`, `README.md`, `.docs/super-plan.md`, `.docs/implementation-plan.md`, `.docs/Thesis-Report/` or `design.md`. Claude writes the docs and the supervisor note.
- **Needs:**
  - The pinned Node: `source ~/.nvm/nvm.sh`, then `nvm use` in the repo root. `node -v` must print the `.nvmrc` version.
  - `@breadit/ranking` built again after Step 1, before any eval test or run (eval reads its `dist/`). `@breadit/shared` built before a commit (the pre-commit hook runs the frontend typecheck).
  - The nine datasets in `eval/data/` (git-ignored). If one is missing, run the eval `gen` command, or `adapt:digg` for `digg2009`.
  - No Docker for Sonnet's steps. Claude's DW8 check needs db, redis and `syn-W2M-M` in `eval_load`.
- **Who does what.**
  - Sonnet does Steps 1 to 7, then stops at **Stop A** and reports.
  - Claude shows the tuning to the author. After the author's OK, Claude sends Sonnet back for Steps 8 to 11.
  - Sonnet stops again at **Stop B** if the H0 gate fails.
  - Claude does "Claude's part" and the Acceptance.
- **Rules for every step.**
  - **Tests first.** Write the test, run it, see it fail for the right reason, then write the code.
  - **The test split.** Before the approval commit of Step 8, nothing runs the test split on a P7 dataset (`syn-*-M`, `digg2009`). Tests use the golden fixture, `syn-*-S`, or hand-made rows only, and never the test split of an M dataset or of Digg. No `--split` flag exists or is added.
  - **Determinism** (`.claude/rules/determinism.md`). No clock, no `Math.random`, no `localeCompare`, `toLocaleString` or `Intl`, and every `.sort()` has a compare function. Randomness comes only from `rng(masterSeed, "shuffle")`. `forbidden.test.ts` must stay green.
  - **Ranking logic stays in `@breadit/ranking`.** Eval only calls it.
  - **Frozen values.** Read them with `loadFrozen()`. Never change one, and never copy a number from super-plan §7 into code or comments.
  - **The stats code.** `eval/src/stats.ts` is called as it is and not changed. `write.ts` is not changed.
  - **Dependencies.** None are new.
  - **When stuck.** If a step cannot be done as written, stop and report what and why. Do not work around it. Never cut an experiment on your own: cuts are Claude's and the author's call.
- **Commits** go on `test-app` and are never pushed. One commit per step (Step 7 and Step 8 have two each), holding its own files and the ticks in this `plan.md`.
  - Stage files by path. Never stage `eval/data/`, `eval/results/` or `datasets/`.
  - End every commit message with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
  - Approving this plan approves the commits listed.
- **The run log.** `run_output.txt` in this folder gets, for every real run (Steps 7 to 11): the command, its printed lines, the run time and the peak memory (the macOS `time` tool with `-l`, as in P5). These are Class R numbers, never compared.
- Effort scale: XS under 30 minutes, S under 2 hours, M half a day.

## Steps

#### Step 1: Reversed tie-break in `@breadit/ranking` (effort XS)

- [x] Tests first: **TC1** in `packages/ranking/src/rank.spec.ts`.
- [x] `types.ts`: `export type TieBreak = "id-desc" | "id-asc"`, exported from `index.ts`. `rank.ts`: `rankPool(pool, score, tieBreak: TieBreak = "id-desc")`. With `"id-asc"`, equal scores sort by post id ascending. Nothing else changes (design: Approach, "Reversed tie-break").
- [x] The ranking tests pass, then build the package.
- [x] Commit: `feat: rankPool takes a tie-break order (E6)`

#### Step 2: Run config keys and `variantsFor` (effort S)

- [x] Tests first: **TC2** in `eval/src/harness/config.test.ts`.
- [x] `config.ts` (design: Approach, the six keys). Add the optional keys `datasetParams`, `tieBreak`, `shuffle`, `compare`, `density` and `h0Gate` to `RunConfig` and to the allowed key list. `validateConfig` checks, before any data is loaded:
  - `datasetParams`: its dataset keys are in `datasets`, its methods are in `methods`, its params are required by the method (`REQUIRED_PARAMS`), and every value is a finite number (a `divisor` above 0). A config with any `"grid"` param cannot have it.
  - `tieBreak` is `"id-desc"` or `"id-asc"`. `shuffle`, `density` and `h0Gate` are booleans.
  - `compare` is `{ mode, ref }`, with `mode` `"families"` or `"none"` and `ref` in `methods`. `families` needs every dataset to be `syn-W2M-M` or `digg2009`, `ref` = BL2, and `methods` to hold H, BL2 and all seven F2 baselines (design F13).
  - `density` needs `compare` and H in `methods`. `h0Gate` needs `compare` mode `none` with `ref` BL2, H in `methods`, and `syn-W0-M` in `datasets`.
- [x] `variantsFor(cfg, datasetId)`: the variants of `fixedVariants`, with that dataset's `datasetParams` replacing the params it names.
- [x] Commit: `feat: eval run config keys for P7`

#### Step 3: Shuffle, per-dataset variants, tie-break and lighter tuning in the run (effort S–M)

- [x] Tests first: **TC3** (`shuffle.test.ts`, new), **TC4** (`run.test.ts`), **TC5** (`tuning.test.ts`).
- [x] `eval/src/harness/shuffle.ts`: `shuffleWithinPosts(rows, masterSeed)` exactly as design "Shuffle". Posts in id order. Inside a post, the slots are its rows sorted by `(createdAt, eventId)`. Each slot keeps `eventId`, `createdAt` and `type`, and the post's users go back in a Fisher–Yates order from one `rng(masterSeed, "shuffle")` stream for the whole dataset. The output is sorted by `(createdAt, eventId)`.
- [x] `run.ts` (design: Code files):
  - `RunParams.tieBreak` (default `"id-desc"`), passed by `scoreItem` to `rankPool`.
  - `DatasetRunOptions.keepPerUser` (default true). When it is false, no `PerUserRow` is kept, but the ranks still go to `summarize` and coverage.
  - `DatasetRunOptions.label`: the dataset name written in every row (default: the dataset id).
  - In `runConfig`, for each dataset id:
    - the variants are `o.variants?.[id]`, else `variantsFor(cfg, id)`;
    - with `cfg.shuffle`, the interactions are replaced by `shuffleWithinPosts(…, masterSeed)` and the label is `<id>-shuffled`;
    - `expectedT` is always `cutTimes[id]`, the source id;
    - `inputs` stays keyed by the source id.
  - `rankAt` and the `rank` command keep the default order.
- [x] `tuning.ts`: `tuneDataset` runs with `keepPerUser: false` (design: "Tuning memory").
- [x] The golden, leakage and double-run tests of P5 pass unchanged.
- [x] Commit: `feat: eval shuffle, per-dataset params, tie-break and lighter tuning`

#### Step 4: `compare.csv`, `density.csv` and the verdicts (effort M)

- [ ] Tests first: **TC6** (`compare.test.ts`, new) and **TC7** (`commands.test.ts`).
- [ ] `eval/src/harness/compare.ts` (design: Approach, "Statistics" and "Density"). It reuses `compareRow`, `applyHolm`, `pairedBootstrap`, `h1Verdict`, `h0Gate` and `writeCompare` from `stats.ts`, `ndcgAt` and `groupsOf` from `metrics.ts`, `bucketOf` from `checks/buckets.ts`, and `statOpts()`.
  - `compareRows(result, cfg, o)`. Per dataset, the user's NDCG@K per method comes from the `perUser` ranks.
    - `families`: F1 (15 rows) and F2 (84 rows) exactly as the design lists them. A family row with n = 0 stops the run and names the row (F6).
    - `none`: every method except `ref`, each K and each group; a row with n = 0 has empty numbers.
    - Then `applyHolm` over all rows.
  - `densityRows(run, ref, o)`: H − ref on NDCG@10. The bins come from `bucketOf(nFollowees)`, in the order of the history buckets. A bin with no user gets n = 0 and empty numbers.
  - `writeDensity(dir, rows)`: the columns of blueprint §2.7, 6 decimals, rows sorted by dataset, then bin order.
  - `verdictLines(rows, cfg)`: in `families` mode, one `H1 <dataset>: pass|fail` line per dataset with `p_holm` and `ci_low`; with `h0Gate`, the `H0 gate: pass|fail` line with `ci_low`; and `gateFailed`.
- [ ] `commands.ts`: after `runConfig`, when `compare` is set, write `compare.csv` (and `density.csv` when `density` is set) and pass them to `writeResults` through `extraFiles`. Print the verdict lines. If `gateFailed`, throw `H0 gate failed …` after every file and the manifest are written. `CommandEnv` gets an optional `cutTimes` for tests, as `RunConfigOptions` already has.
- [ ] Commit: `feat: eval compare.csv, density.csv and the H1 and H0 verdicts`

#### Step 5: The `freeze` command (effort M)

- [ ] Tests first: **TC8** (`freeze.test.ts`, new).
- [ ] `eval/src/harness/freeze.ts` and `eval/src/cli/freeze.ts` (with `checkNode`); script `freeze` in `eval/package.json`. Design: Approach, "Freeze", and the two tables of "The runs".
  - **Inputs.** It reads `.docs/results/p7-tune-main/` and `.docs/results/p7-tune-worlds/` (a `--results-dir` option for tests). It checks the SHA-256 of `tuning.csv` and `summary.csv` against their run manifest and stops on a difference (F5).
  - **The §5 rule (DW1).** For each (dataset, tuned method), exactly one row has `chosen` = 1, and it has the highest `val_ndcg10`; ties go to the smaller value or pair, compared as `pickBest` does. Any violation stops the command. It prints one line with the number of checked groups and `0 violations`.
  - **`TEST_RUNS`.** The ten test configs of the design table, in that order.
    - Params come only from chosen rows. `p7-h0` gets the H values chosen on `syn-W2M-M`. The E4 runs get H's α and β of each dataset, and `m` = 0, 2 or 10 in the sweep runs.
    - The E8 baseline is the highest `ndcg` (K 10, group all, `syn-W2M-M`) among BL0, BL1, BL2, BL2t, BL3, BL4, BL5 and BL6 in `p7-tune-main/summary.csv`, ties to the method order. If it is BL2, `p7-e8-pool` has only BL2 and H.
    - `mode` is `"fast"` for every config.
  - **Output.** Canonical JSON (`canonicalJson`) to `eval/config/runs/<runId>.json`, with no `testApprovedBy`. `--approve <name>` writes the same configs with `testApprovedBy` = name. `--check` rebuilds the configs in memory and compares them with the files, ignoring `testApprovedBy`. It prints `equal` or each difference, and exits non-zero on a difference.
- [ ] Commit: `feat: eval freeze command (test configs from the tuning)`

#### Step 6: The report (effort M)

- [ ] Tests first: **TC9** (`report/round.test.ts`), **TC10** (`report/macros.test.ts`), **TC11** (`report/report.test.ts`), all new.
- [ ] `eval/src/report/` with `read.ts`, `round.ts`, `macros.ts`, `tables.ts` and `report.ts`, and `eval/src/cli/report.ts` (with `checkNode`); script `report` in `eval/package.json`. Design: Approach, "Report", and "Macros and tables".
  - `readRun` reads a run folder and checks the SHA-256 of every file it reads against the run manifest. `per_user.csv` is never read.
  - `roundDecimal` works on the decimal string, half away from zero, and a negative zero prints without the sign. `formatP` gives `<0.001` under 0.001.
  - `MACRO_SPECS` holds the groups of the design table. `macroName` builds names from the words of the design, throws on anything but letters, and throws on a repeat.
  - `macros.csv` has the columns `name, value, file, row_key, column`. `file` is relative to `.docs/results/`. `row_key` is the row's key columns joined with `|`.
  - `buildTables` builds the nine tables of the design. `toLatex` gives a booktabs `tabular` with no float. `toMarkdown` gives a Markdown table. Both use `roundDecimal` and `formatP`.
  - `reportCommand` reads `REPORT_RUNS` (the twelve run ids), then writes `.docs/results/p7-report/` (a `--results-dir` and an `--out` for tests): `macros.csv`, `results-macros.tex`, `tables/<id>.tex`, `results.md`, `fig-e3-density.csv` (the four datasets of DW6) and `manifest.json`. It then runs `verifyMacros` and stops on any mismatch.
- [ ] `npm run verify -w @breadit/eval` passes (DW11).
- [ ] Commit: `feat: eval report (macros, tables, results.md)`

#### Step 7: Tuning, then the test configs, then Stop A (effort S, plus about 30 minutes of runs)

- [ ] Write `eval/config/runs/p7-tune-main.json` and `p7-tune-worlds.json` by hand, as in the design's tuning table: split validation, pool normal, mode fast, every tuned param `"grid"`, `m` `"frozen"`.
- [ ] Run the harness on each and add both to the run log. If Digg runs out of memory, stop and report (F2); do not split the config on your own.
- [ ] Commit: `chore: P7 tuning on the validation split` (the two configs and `.docs/results/p7-tune-*/`).
- [ ] Run `freeze`, then `freeze --check` (must print `equal`). Add both outputs to the run log.
- [ ] Commit: `chore: P7 test configs from the tuning (not approved)` (the ten configs and the run log).
- [ ] **Stop A.** Report the chosen values (every `chosen` = 1 row of both `tuning.csv` files), the E8 baseline, the freeze rule line, and the Digg tuning time and memory. Run nothing on the test split.

#### Step 8: Approval and the H0 gate (effort XS, after the author's OK)

- [ ] Run `freeze --approve author`, then `freeze --check` (must print `equal`). Commit: `chore: the author approves the P7 test split`.
- [ ] Run the harness on `p7-h0` and add it to the run log.
  - **If the gate fails, this is Stop B.** Commit nothing more. Report the gate line and the compare row. Do not run anything else (design F1).
  - If it passes, commit: `chore: P7 H0 gate on the test split`.

#### Step 9: The other test runs (effort S, plus the run time)

- [ ] Run the harness on `p7-main`, `p7-e5-worlds`, `p7-e4-terms`, `p7-e4-m0`, `p7-e4-m2`, `p7-e4-m10`, `p7-e6-ties`, `p7-e8-pool` and `p7-e5-shuffle`, in this order, each added to the run log with its H1 lines where there are any.
- [ ] Commit: `chore: P7 test-split results (E1–E6, E8)` (`.docs/results/p7-*/` of these runs and the run log).

#### Step 10: The report (effort XS)

- [ ] Run `report` and add its output to the run log.
- [ ] Commit: `chore: P7 report, macros and tables` (`.docs/results/p7-report/` and the run log).

#### Step 11: Double run (effort XS, plus the run time)

- [ ] Delete `.docs/results/p7-*/` and `eval/results/p7-*/`. Run the two tuning runs, `freeze --approve author`, the ten test runs in the Step 8 and Step 9 order, and `report`, all into their default folders (design: "Double run").
- [ ] Check that git shows no change under `.docs/results/` and `eval/config/runs/`, and that each `eval/results/p7-*/per_user.csv` has the SHA-256 written in its manifest. Write the result in the run log.
- [ ] If anything differs, stop and report it. Leave the files as they are and commit nothing.
- [ ] Commit: `chore: P7 double run` (the run log only).

## Claude's part

- [ ] At Stop A: read the commits and the diff against the design, then show the author the chosen values and ask for the test split OK (OQ7). Then send Sonnet back for Steps 8 to 11.
- [ ] If time runs short before Step 9 ends, propose the cuts of super-plan §8 to the author (the shuffle, then E8, then the finer E4). Do not cut quietly.
- [ ] After Step 11: read the commits and the diff; `bash .claude/hooks/verify.sh`; the Acceptance items below.
- [ ] Write `results-note.md` in this folder (DW13): the H0 gate, both H1 verdicts, the E1 and E2 tables from `results.md`, a short reading of E3 to E8, and the question of super-plan §11, item 7 (the default feed rule). English first, then a Vietnamese copy, as `.docs/supervisor-note.md`.
- [ ] Docs (DW14):
  - **`docs/System_Architecture.md`:** the report ✅, `freeze` and `report`, the P7 run configs and results in the tree, and the status table (task 9 ✅, task 10 next).
  - **Guidance Manual, en and vi, with the same content:** 05 (the tuning, the H0 gate params, the test split run once), 06 (`compare.csv`, the families, `density.csv`), 07 (the freeze, the report hashes, the double run), 09 (macro, freeze) and 10 (the "(after P7)" answers for E1, E4, E5, E6, Q22 and coverage, each naming its results file).
  - **`CLAUDE.md`:** the eval commands `freeze` and `report`.
  - **`.docs/implementation-plan.md`:** the three lines of design "Contract changes" (§2.7, §2.8, §3.5), §5 task 9 ✅ and task 10 next, and a change-log line.
  - **`.docs/super-plan.md`:** a P7 status paragraph, the §4 row (P7: 1 of its tasks done), §11 item 7 (sent with the results), and a change-log line. No §7 change.
  - Commit: `docs: close p7-offline-experiments`.
- [ ] Fill in the Result, then close the task.

## Tests

Eval tests run under `node --test` with no Docker. Ranking tests are Jest (`packages/ranking`). No backend test is added.

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW8, F10 | unit (ranking) | `rankPool` with no third argument gives the same order as before on a pool with tied scores (ties by id desc). With `"id-asc"`, only the tied posts change order (id asc), and posts with different scores keep their order |
| TC2 | F13 | unit (eval) | Each new key: a good value is accepted and a bad one is refused before any data is loaded (an unknown key still refused; `datasetParams` with a dataset or method not in the config, a missing param, a non-number, a `"grid"` config with `datasetParams`; `tieBreak` "x"; `families` on `syn-W1-M`, without BL6, or with ref BL0; `density` without `compare`; `h0Gate` without `syn-W0-M`). `variantsFor` replaces only the named params of the named dataset, and gives `fixedVariants` for any other dataset |
| TC3 | F8, F9 | unit (eval) | On the golden fixture and on `syn-W2M-S`: the output is sorted by `(createdAt, eventId)`; each post keeps its multiset of users and its exact list of `(createdAt, eventId, type)` slots; `cutTime` of the output equals `cutTime` of the input; no author engages with their own post; two calls give equal output; at least one post with two or more engagers gets a different order of users |
| TC4 | DW7, DW11 | unit (eval) | The golden CSV files stay byte-identical with no new key (the existing test). On a fixture with tied scores, `tieBreak` `"id-asc"` changes ranks only where scores tie. A two-dataset config with `datasetParams` gives each dataset the same rows as a one-dataset run with those params. A `shuffle` run of `syn-W2M-S` has the label `syn-W2M-S-shuffled` in every row, passes the T check with `cutTimes["syn-W2M-S"]`, and keys `inputs` by `syn-W2M-S` |
| TC5 | F2 | unit (eval) | On `syn-W2M-S` with a small grid, `tuneDataset` gives the same `rows` and `variants` with `keepPerUser` false as with true. A run with `keepPerUser` false has an empty `perUser` and the same `summary` and `coverage` |
| TC6 | DW3, DW4, DW5, DW6, F6, F7 | unit (eval) | On hand-made `DatasetRun` rows: `families` gives 15 F1 and 84 F2 rows for each of `syn-W2M-M` and `digg2009`, every one with `p_raw` and `p_holm`, Holm applied per (dataset, family); a family row with no user throws and names it; `none` gives each method × K × group with empty p, and n = 0 rows with empty numbers. `densityRows` bins by `bucketOf(n_followees)`, its `n` sums to the kept users, and an empty bin has empty numbers. `verdictLines` gives the `h1Verdict` result for each dataset and the `h0Gate` result, and `gateFailed` matches |
| TC7 | DW3, DW7 | unit (eval) | The harness command on the golden data copied to a temp folder named `syn-W0-M` (validation split, `cutTimes` from `CommandEnv`, compare none, density, `h0Gate`) writes `compare.csv` and `density.csv`, lists both in the manifest with their SHA-256, and prints one `H0 gate:` line. When the gate fails, the command throws after the files and the manifest exist |
| TC8 | DW1, DW2, F4, F5 | unit (eval) | On hand-made tuning folders: the ten configs, in order, with every number equal to a chosen row; the H0 run uses the `syn-W2M-M` values; the E4 runs use H's values and `m` 0, 2, 10; the E8 baseline rule with a tie; BL2 as the best gives a two-method E8 run. Without `--approve` a test config is refused by `parseRunConfig`; with it, every config parses. `--check` prints `equal`, and reports a changed number. Two chosen rows, a chosen row that is not the best, or a tuning file whose SHA-256 differs from its manifest each stops the command. Two writes are byte-identical |
| TC9 | DW10, F12 | unit (eval) | `roundDecimal` to 3 places: `0.012500` → `0.013`, `-0.012500` → `-0.013`, `0.999500` → `1.000`, `-0.000400` → `0.000`, `12.000000` → `12.000`. `formatP`: `0.000999` → `<0.001`, `0.001000` → `0.001`, `1.000000` → `1.000` |
| TC10 | DW10, F12 | unit (eval) | `macroName` gives letters only (`eTwoDiggNdcgTenZeroFourGain`), and throws on a digit and on a repeated name. On a fixture results folder, every macro value equals its cell after `roundDecimal`/`formatP`; `verifyMacros` throws when a cell is changed; `macrosTex` has one `\newcommand` per row |
| TC11 | DW6, DW9, DW10 | unit (eval) | `reportCommand` on a hand-made results folder for the twelve run ids writes every file of the design and a manifest with their SHA-256. Two runs are byte-identical. An input file that differs from its run manifest stops it. `fig-e3-density.csv` has exactly the four datasets of DW6. Each table has the same rounded numbers in its `.tex` and in `results.md` |
| TC12 | DW11 | unit (eval) | `npm run verify -w @breadit/eval`: the typecheck and every eval test, including `forbidden.test.ts` and `imports.test.ts` |

DW1 to DW10 and DW12 to DW15 are also Acceptance items on the real results. DW8 is the Acceptance parity check.

## Acceptance

- [ ] The freeze line on the committed tuning: every (dataset, tuned method) checked, `0 violations` (DW1)
- [ ] `freeze --check` prints `equal`. In `git log`, the commit with the ten test configs comes before the approval commit, and both come before the first test-split results commit (DW2)
- [ ] The run log has the `H0 gate:` line of `p7-h0` with `ci_low`, and the gate passed before any other test run (DW3)
- [ ] `p7-main/compare.csv`: 15 F1 rows and 84 F2 rows for each of `syn-W2M-M` and `digg2009`, all with `p_raw` and `p_holm`. Every row of family none in the other runs has both empty (DW4)
- [ ] The run log has one `H1` line for each of `syn-W2M-M` and `digg2009`, and each equals the §3.4 rule applied by hand to its F1 row (DW5)
- [ ] `p7-report/fig-e3-density.csv`: the four datasets with four bins each. Per dataset, the `n` over the bins equals the kept test users of its run's `leftout.csv`, group all (DW6)
- [ ] The folders of `p7-e4-*`, `p7-e5-*`, `p7-e6-ties` and `p7-e8-pool` each hold `summary.csv` and a manifest. `p7-e6-ties` has the nine methods of `p7-main`. The E5 runs have their compare rows (DW7)
- [ ] `npm run test -w @breadit/ranking` passes. With db and redis up and `syn-W2M-M` in `eval_load`, `npm run test:parity -w @breadit/backend` gives 300 of 300 full orders and 300 of 300 first two pages (DW8)
- [ ] The Step 11 lines of the run log: no change under `.docs/results/` and `eval/config/runs/`, and every ignored `per_user.csv` matches its manifest (DW9)
- [ ] The report's own check passed. Every name in `macros.csv` matches `^[A-Za-z]+$`, and `results-macros.tex` has as many `\newcommand` lines as `macros.csv` has rows. Five macros picked by hand equal their cells (DW10)
- [ ] `npm run verify -w @breadit/eval` passes (DW11), and `bash .claude/hooks/verify.sh` passes
- [ ] The run log has the command, time and peak memory of every run (DW12)
- [ ] `results-note.md` has the H0 gate, both H1 verdicts, the main tables and the §11 item 7 question (DW13)
- [ ] The docs of "Claude's part": the report and task 9 are ✅, and the "(after P7)" answers are written, the same in en and vi (DW14)
- [ ] `git diff --stat` of the task commits: only the paths DW15 allows (DW15)

## Result

