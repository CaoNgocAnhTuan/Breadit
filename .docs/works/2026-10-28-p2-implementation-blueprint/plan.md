# Plan: Implementation blueprint

Status: approved · 2026-10-28
Design: [design.md](design.md) · Folder: `.docs/works/2026-10-28-p2-implementation-blueprint/`

---

## How to read this plan

- This task has no app code. Docker, the backend and the database are not used. It needs `python3` (standard library only), `git` and `shasum`. Run every command from the repo root.
- **Who does what.** Sonnet does Steps 1 to 7. Claude does the checks, the super-plan edit and the Result (see "Claude's part" and Acceptance). Sonnet does not touch `.docs/super-plan.md`.
- **Rules that apply to every step.**
  - The blueprint copies the decisions of design.md §3.1 to §3.8. It adds no new decision. If something in the design cannot be written as it is, stop and report.
  - No number from super-plan §7 is copied without "§7" in the same sentence or table header (DW8). Better: write "§7, <row name>" and no number. The values to watch: the seed, the base epoch, the window of 7 days, the pool cap of 2,000, the 10,000 resamples, 95%, the Holm level 0.05, `m` and its sweep, the α and β grid, the dataset sizes, the published BL4 and BL5 values and the BL2 age weight.
  - Simple words, short sentences (CLAUDE.md "How to write"). Names, numbers and frozen values exact.
  - The blueprint is at most 400 lines (DW1).
  - Do not change `design.md`, `literature.md`, `datasets.md`, `related-work.md`, `supervisor-note.md`, `Latex/`, `docs/` or `.docs/super-plan.md`.
- **Python.** Run scripts with `python3 -I`. `-I` removes the script folder from the import path, so the test file loads `check_cut_time.py` by its path with `importlib.util.spec_from_file_location`, and the script loads `digg_stats.py` (for `rows_of`) the same way from `.docs/works/2026-10-27-p1-digg-archive-check/` (design §3.9).
- **Digg inputs.** The zips are in `datasets/raw/digg2009/` (git ignores them). The password is on the Digg page, quoted in `.docs/datasets.md` §4. The window and the pool cap are passed from super-plan §7, row "Window W / pool cap N_max".
- **Commits** go on `test-app` and are never pushed. A step's commit holds its own files and this `plan.md` (the ticks). End every commit message with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Approving this plan approves the commits listed.
- Effort scale: XS under 30 minutes, S under 2 hours, M half a day.

## Steps

#### Step 1: Skeleton and the rules, before any Digg count (effort S)

- [x] Create `.docs/implementation-plan.md` with the title block and the headings of design §3.1.
- [x] Write section 3 "Cut time T and Holm family" in full from design §3.4 and §3.5: the rule for T with `q` = 0.8 and the fallback, the threshold of 100 kept test users in bucket 0–4, what "kept" means, the two families F1 and F2, the reading of H1 (marked "for the author to confirm"), and the H0 gate. Where the Digg numbers will go, write one line: "Digg numbers: added in Step 4 of the P2 plan, after this rule was committed."
- [x] Also write the window rule the check uses: a story is in the window when `t_u − W ≤ created_at < t_u`.
- [x] Commit: `docs: implementation blueprint skeleton, T rule and Holm family before the Digg count`. This commit also adds `design.md`, `plan.md` and the `.gitignore` line for `datasets/raw/`. It must come before any commit that holds Digg counts (design F3).

#### Step 2: Tests for the check script, first (effort S)

- [x] Write `test_check_cut_time.py` in the task folder with TC1 to TC11 below. Fixtures are small Python lists of rows, plus two tiny zip files made in a `tempfile` folder for TC10.
- [x] Run it before `check_cut_time.py` exists. It must fail because the module is missing, not because of a typo in the test.
- [x] Commit: `docs: tests for the Digg cut-time check`

#### Step 3: The check script (effort M)

- [x] Write `check_cut_time.py` in the task folder (design §3.9). The core functions take plain lists: `dedupe_votes`, `stories`, `positives`, `follows`, `cut_time`, `test_items`, `bucket`, `in_pool`, `report`. The command line takes the two zip paths, `--password`, `--window-days`, `--max-posts` and `--q` (default `0.7,0.8,0.9`).
- [x] Before it reads any row, it checks the SHA-256 of both zips against the two values in `.docs/datasets.md` §4 and stops with exit code 2 on a mismatch.
- [x] It reads the rows with `rows_of` from `digg_stats.py`. If that import does not work, copy the function into the script, say so at the top of the file, and say it in the report (design F14).
- [x] Output: `key = value` lines, sorted by key, shares with 6 decimals, times in UTC. It ends with the chosen `q` and, if needed, the word "underpowered" (design §3.4).
- [x] All of TC1 to TC11 pass.
- [x] Commit: `docs: check_cut_time.py for the Digg cut time`

#### Step 4: Run on the real Digg files (effort S)

- [ ] Run the script on the two zips in `datasets/raw/digg2009/`, with the window and the pool cap from super-plan §7. Save the output as `cut_time_output.txt` in the task folder.
- [ ] Run it a second time and compare the SHA-256 of the two outputs. They must be equal (DW5). If they differ, stop and report.
- [ ] In blueprint section 3, replace the placeholder line with the numbers for each `q`: `n`, T in UTC, users with a test item, and per bucket (0, 1–4, 0–4, 5–19, ≥20) the test users, kept, left out and kept with at least one followee; the pool size at T and the median pool size. Then write the chosen `q` by the rule. Copy the numbers from the output file; type none by hand.
- [ ] Commit: `docs: Digg cut-time counts in the blueprint`

#### Step 5: Module map and data contracts (effort M)

- [ ] Write blueprint section 1 from design §3.2 and section 2 from design §3.3: the module table and its rules, the hand-off table H-a to H-e, the canonical dataset files, dataset ids, the manifest, the PRNG stage names, the user id rule, the `packages/ranking` signatures, the results files, the macros, and the parity sample.
- [ ] The signatures block may be shortened, but every name in design §3.3 stays (`AsOf`, `Post`, `Positive`, `PoolParams`, `buildPool`, `UserFeatures`, `PostFeatures`, `MethodId`, `ScoreContext`, `Scorer`, `scorer`, `rankPool`) with the visibility rule of `AsOf`.
- [ ] Commit: `docs: blueprint module map and data contracts`

#### Step 6: Measurement plan, task list, assumptions (effort S)

- [ ] Write section 4 from design §3.6, section 5 from design §3.7 (task table, spare days, cut triggers, the note on checkpoints), and section 6 from design §3.8. Mark the rows that depend on the supervisor's answer (task 4, H1 test 2, the Digg rows of E1 to E6).
- [ ] Add `## Change log` with one line: version 1.0, 2026-10-28, task `p2-implementation-blueprint`.
- [ ] Commit: `docs: blueprint measurement plan and task list`

#### Step 7: Self-check and report (effort XS)

- [ ] Count lines (at most 400). Grep the blueprint for the §7 values listed under "Rules" and check each hit has "§7" in its sentence or table header. Check that every hand-off H-a to H-e has a contract, and that the measurement table names E1 to E8.
- [ ] Fix what you find. Commit as `docs: blueprint fixes after the self-check` only if something changed.
- [ ] Stop. Report to Claude: the line count, the chosen `q` and the bucket 0–4 counts, the commits, and anything in the design you could not follow and why. Do not work around a step that cannot be done as written.

### Claude's part (after Step 7)

- [ ] Before the edit, record the SHA-256 of super-plan §5, §6 and §7 (each from its heading to the next `## ` heading).
- [ ] Do the Acceptance items below.
- [ ] Edit `.docs/super-plan.md` (design: Code files): the P2 status, the Tasks column of §4 from the blueprint task list, "E1–E7" to "E1–E8" in the phase table, the P5 sentence on the `leakage-auditor` and `designer` agents, open item 6 (a) and (c) pointing to the blueprint, header version 0.12, one change-log line. Then compare the three hashes again.
- [ ] Commit: `docs: super-plan 0.12, P2 implementation blueprint written`

## Tests

All tests are in `test_check_cut_time.py` and run with `python3 -I -m unittest` (by file path). Level: script test on fixtures. The blueprint text is checked by Acceptance.

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW5 | script | The first vote of a story makes its author and its `created_at`. That vote is not a positive |
| TC2 | DW5 | script | A repeated (voter, story) row is kept once, the earliest |
| TC3 | DW5 | script | T is the time of the positive at rank `ceil(q · n)` in `(t, voter_id, story_id)` order. Event ids follow that order |
| TC4 | DW5 | script | A positive at exactly T is validation, not test. The test item is the user's last positive with `t > T`. A user with no positive after T has no test item |
| TC5 | DW5 | script | History at `t_u` counts events with `t < t_u`, and events with `t = t_u` only when their event id is smaller than the test event's id |
| TC6 | DW5 | script | Bucket edges: 0 → `0`; 1 and 4 → `1-4`; 5 and 19 → `5-19`; 20 → `20+`. Bucket `0-4` is the union |
| TC7 | DW5 | script | Pool: a story created exactly `W` before `t_u` is in, one second earlier is out; a story created at `t_u` is out; the user's own story and earlier positives are out; with more than `N_max` eligible stories, only the newest `N_max` are in. A test story outside the pool is "left out" |
| TC8 | DW5 | script | Links with date 0 and self-links are dropped. A follow dated exactly `t_u` does not count; one second earlier counts |
| TC9 | DW5 | script | The `q` rule: 100 kept in 0–4 at 0.8 → 0.8; 99 at 0.8 and 100 at 0.7 → 0.7; 99 at both → 0.8 and "underpowered" |
| TC10 | DW6 | script | A zip whose SHA-256 does not match stops with exit code 2 before any row is read |
| TC11 | DW5 | script | `report` on the same fixture twice gives the same text, keys sorted, shares with 6 decimals |

## Acceptance

Claude checks these after Step 7.

- [ ] DW1: the blueprint has the four parts (module map, data contracts, measurement plan, task list) and at most 400 lines → pass.
- [ ] DW2: the hand-off table has H-a to H-e. Each points to a contract that names columns or signatures, types, units and sort order → pass.
- [ ] DW3: the measurement table has rows for H0, H1 test 1, H1 test 2, H2, and E1 to E8 appear in its Row column. Each row names an output file and a chapter → pass.
- [ ] DW4: the task list has rows for P0 and P3 to P10, each with depends-on and days. The last task ends on or before 2026-11-18. Each cut of super-plan §8 points to a task → pass.
- [ ] DW5: `git log` shows the Step 1 commit (rule) before the Step 4 commit (counts). The two runs had equal output hashes. Every Digg number in the blueprint is in `cut_time_output.txt`. All tests pass when Claude reruns them → pass.
- [ ] DW6: `shasum -a 256` of both zips in `datasets/raw/digg2009/` equals `.docs/datasets.md` §4, and `git status` does not list them → pass.
- [ ] DW7: the blueprint lists F1 and F2 with their comparisons, and super-plan open item 6(c) points to it after the closing edit → pass.
- [ ] DW8: the SHA-256 of super-plan §5, §6 and §7 is the same before and after the closing edit. Each §7 value in the blueprint has "§7" in its sentence or table header → pass.
- [ ] DW9: `git diff --stat` over the task commits lists only `.docs/implementation-plan.md`, the task folder, `.docs/super-plan.md` and `.gitignore` → pass.
- [ ] Claude reads the blueprint once against design §3.2 to §3.8 and fixes any place where it differs from the design.

## Result

