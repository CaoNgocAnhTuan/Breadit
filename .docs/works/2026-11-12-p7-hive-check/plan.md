# Plan: Hive side check for the community term

Status: approved · 2026-11-12
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-12-p7-hive-check/`

---

## How to read this plan

- **Who does what.** This task needs the author in the BigQuery console, so it has three kinds of steps:
  - **Sonnet** writes and tests code: Steps 1–2 (Stage 1), and Steps 6–9 (Stage 2, only on a pass).
  - **Claude and the author** get the data: Steps 3–4. Claude writes the SQL, and the author runs it and saves the files.
  - **Claude** runs the gate and decides: Step 5. Claude also does "Claude's part" and the Acceptance.
  - Steps 1–2 do not need the data, so Sonnet can do them while the author opens the Google Cloud project.
- **Stops.**
  - **Stop G** after Step 5: Claude shows `gate.md` to the author. On a fail, Stage 2 does not start (design F8), and Claude closes the task with the docs of DW3.
  - **Stop T** in Step 8: Claude asks the author to freeze the cut time T of `hive-2021q1` (Spec Open question 6).
  - **Stop B** in Step 9: Claude shows the tuned α and β, and the test split runs only after the author's yes (Design Open question 2).
- **Design Open question 1 (D1 on Hive).** The author approved the Design with the recommendation: `checkFormat` skips `community-non-member` for `source.kind` = `"hive"`, and blueprint §2.2 gets the exception. Step 7 does this.
- **Files.** Only the files of design "Code files", plus this `plan.md` (ticks) and `run_output.txt` in this folder. In Stage 1 no file under `eval/`, `packages/` or `apps/` changes (DW4). Never touch `apps/`, the Prisma schema, `Latex/`, `docs/Pre-thesis/`, `.env`, `.claude/`, `design.md`, `eval/config/synthetic-v1.json` or `eval/config/digg2009.json`. Only Claude, after the author's OK, changes `eval/config/frozen-v1.json` (Stop T).
- **Needs.**
  - The pinned Node from `.nvmrc` (`nvm use`); `node -v` must print it. The `.ts` files run directly on it.
  - `@breadit/ranking` built, before any eval test or run.
  - No Docker in any step.
  - Stage 2 needs the raw files in `datasets/raw/hive/` (git-ignored) from Step 4.
- **Rules for every code step.**
  - **Tests first.** Write the test, run it, see it fail for the right reason, then write the code.
  - **Determinism** (`.claude/rules/determinism.md`). No clock, no `Math.random`, no `localeCompare`, `toLocaleString` or `Intl`, and every `.sort()` has a compare function. Strings sort by byte order (`a < b`), as in `eval/src/canonical/manifest.ts`. The rule applies to the task-folder `.ts` files too, because they move into `eval/` in Stage 2.
  - **Reuse, do not copy.** `gate.ts` imports the eval functions the design names. It never re-implements the pool or the buckets.
  - **Frozen values.** Read them with `loadFrozen()`. Never write a §7 number into code.
  - **No new dependency.** CSV reading uses the strict readers or a strict split (design: the transform's regexes).
  - **When stuck**, stop and report what and why. Do not work around it.
- **Commits** go on `test-app` and are never pushed. One commit per step, with its own files and the ticks in this `plan.md`.
  - Stage files by path. Never stage `datasets/`, `eval/data/` or `eval/results/`.
  - End every commit message with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (Sonnet's steps) or `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (Claude's steps).
  - Approving this plan approves the commits listed.
- **The run log.** `run_output.txt` in this folder gets every real run: the command, its printed lines, the run time and the peak memory. It also gets the dry-run bytes and the row counts of each query (Step 4).
- Effort scale: XS under 30 minutes, S under 2 hours, M half a day.

## Steps

### Stage 1: the gate

#### Step 1: The transform, in the task folder (Sonnet, effort S)

- [x] Tests first: **TC1** in `hive-transform.test.ts` (task folder).
- [x] `hive-transform.ts` (design: Approach, "Transform rules" and "Ids"). Types `HiveRaw` (the six raw tables as string rows: posts, votes, replies, reblogs, subscribes, follows, matching the columns of `queries/q2`–`q6`), `HiveCounts` (rows read and rows dropped by each rule) and `toHiveCanonical(raw: HiveRaw, communities: readonly string[]): { tables: CanonicalTables; counts: HiveCounts }`. `CanonicalTables` is imported from `eval/src/adapters/digg.ts`. Strict parse: a field that fails its regex, or a time that is not an integer, throws with the file and row number.
- [x] Commit: `feat: Hive transform for the p7-hive-check gate`

#### Step 2: The gate script (Sonnet, effort S)

- [ ] Tests first: **TC2** in `gate.test.ts` (task folder, the test file of design `gate.ts`).
- [ ] `gate.ts` (design: Approach, "The gate reuses the eval code"). `runGate(rawDir, scratchDir): GateResult`:
  - read `sources.json`, check every raw file's SHA-256, and stop on any difference;
  - call `toHiveCanonical`, write the six tables with `writeTable` to `scratchDir`, with a manifest whose `source.kind` is `"hive"`;
  - run `checkFormat` and keep its result lines (the `community-non-member` count is reported, not fatal; any other error stops the gate);
  - `loadDataset`, then `bucketReport` with `cutQuantile`, `windowDays` and `poolCap` from `loadFrozen()`;
  - walk the test users with `testItems`, `earlierEvents`, `buildIndex`, `inPool` and `bucketOf`, and count the kept users of bucket 0–4 with a membership whose `joined_at < t_u`;
  - the share of likes within 300 seconds of their post (design F9).
- [ ] A small CLI at the bottom of `gate.ts` (raw folder and scratch folder as arguments) writes `gate.md` in the task folder: verdict (pass if the gate number is at least `KEPT_THRESHOLD`), T in Unix seconds and ISO, the bucket table, the gate number, the drop counts, the `checkFormat` lines and the 5-minute share. The scratch folder is outside the repo (design F10).
- [ ] Commit: `feat: gate script for p7-hive-check`

#### Step 3: The queries (Claude and the author, effort S)

- [ ] Claude writes `queries/q0.sql` (design: Code files): the table list and the column names of `steemit-307308.hive_zurich`, with each table's first and last block time.
- [ ] The author opens a Google Cloud project (sandbox first, Spec Open question 1), runs Q0, and gives Claude the result. If Q0 cannot run, this is design F1: the author decides on billing at once, or the gate fails.
- [ ] Claude writes `queries/q1.sql` to `q6.sql` with the real column names and the `_TABLE_SUFFIX` ranges from Q0 (design F2, F3). Every query returns plain strings and integer Unix seconds, in the columns `HiveRaw` expects.
- [ ] Commit: `docs: p7-hive-check queries`

#### Step 4: The data (the author, with Claude; effort S)

- [ ] For Q1, then Q2–Q6: dry run, the author gives Claude the bytes, Claude writes them in the run log. If a dry run is above 200 GB, stop and ask the author (design F2). Then run, and save the CSV to `datasets/raw/hive/` (by month if it is too big, design F4).
- [ ] Q1's 20 communities go into Q2–Q6 before they run.
- [ ] Claude writes `sources.json` (design: Code files): per file, its query, the query SHA-256, the date, the bytes processed, the rows and the file SHA-256.
- [ ] Commit: `docs: p7-hive-check sources` (`sources.json`, the queries if changed, the run log).

#### Step 5: Run the gate, then Stop G (Claude, effort XS)

- [ ] Run the gate CLI on `datasets/raw/hive/`. Copy the printed lines to the run log.
- [ ] Commit: `chore: p7-hive-check gate result` (`gate.md`, the run log).
- [ ] **Stop G.** Show the author `gate.md`. On a fail, or if Step 3 or 4 was not done by 11-14: skip to "Claude's part, on a fail". On a pass: Stage 2.

### Stage 2: only on a pass

#### Step 6: Move the transform into eval (Sonnet, effort XS)

- [ ] `git mv` `hive-transform.ts` and `hive-transform.test.ts` to `eval/src/adapters/`. Fix only the import paths, in them and in `gate.ts`.
- [ ] `npm run verify -w @breadit/eval` passes, including `forbidden.test.ts` and `imports.test.ts`. TC1 runs there now.
- [ ] Commit: `refactor: move the Hive transform into eval adapters`

#### Step 7: The Hive adapter and the checks (Sonnet, effort S)

- [ ] Tests first: **TC3** (`hive.test.ts`, new) and **TC4** (`format.test.ts`, `run.test.ts`).
- [ ] `eval/config/hive-2021q1.json` (design: Code files): dataset id, the slice dates, the 20 communities from Q1, each raw file with its SHA-256 (from `sources.json`), the query SHA-256 values, the SoChainDB citation (Nguyen et al., SIGIR '22, DOI 10.1145/3477495.3531735) and the license CC BY-SA 4.0.
- [ ] `eval/src/adapters/hive.ts`: `loadHiveConfig()` and `adaptHive(rawDir, outDir)`, in the order of `adaptDigg`: check the folder path, check every SHA-256, read, transform, then delete the old folder and write `eval/data/hive-2021q1/` with a manifest (`source.kind` `"hive"`, the files with their hashes, the counts and the rules).
- [ ] `eval/src/cli/adapt-hive.ts` and the `adapt:hive` script in `eval/package.json` (with `--max-old-space-size=4096`, design F12).
- [ ] `eval/src/checks/format.ts`: no `community-non-member` when `source.kind` is `"hive"` (Design Open question 1). Every other check stays.
- [ ] `eval/src/checks/run.ts`: `hive-2021q1` in `BUCKET_TABLE_IDS`.
- [ ] Commit: `feat: Hive adapter (hive-2021q1)`

#### Step 8: Build the dataset twice, then Stop T (Sonnet, then Claude; effort XS)

- [ ] Run `adapt:hive` into an empty folder, then again into a second empty folder. The two manifests must be byte-identical (DW6, design F11). Then run the eval `check`. Write both in the run log.
- [ ] Commit: `chore: build hive-2021q1 twice` (the run log only).
- [ ] **Stop T.** Sonnet stops. Claude shows the author T of `hive-2021q1` from the check output. After the author's OK, Claude adds it to `cutTimes` in `eval/config/frozen-v1.json` and to super-plan §7 with a change-log line. Commit (Claude): `chore: freeze the cut time of hive-2021q1 (author's decision)`.

#### Step 9: Tuning, Stop B, then the test split (Sonnet, effort S)

- [ ] `eval/config/runs/p7-hive-tune.json` (design: Approach): dataset `hive-2021q1`, split validation, methods BL2, H-comm, H-follow and H, α and β `"grid"`, `m` `"frozen"`, pool normal. Run it. Commit: `chore: P7 Hive tuning on the validation split`.
- [ ] **Stop B.** Sonnet stops and reports every `chosen` = 1 row of `tuning.csv`, and any value at a grid edge. Run nothing on the test split.
- [ ] After the author's yes (Claude passes it on): `eval/config/runs/p7-hive.json`, split test, the chosen numbers in `datasetParams` for `hive-2021q1`, `compare` `{ mode: "none", ref: "BL2" }`, `testApprovedBy` `"author"`. Commit it first: `chore: the author approves the Hive test split`. Then run it once (design F14). Commit: `chore: P7 Hive test-split results`.

#### Step 10: The report (Sonnet, effort S)

- [ ] Tests first: **TC5** (the report tests).
- [ ] `eval/src/report/*`: one Hive table (H-comm, H-follow and H, each − BL2, NDCG@10 per bucket with the bootstrap interval, n per bucket) in `results.md` and its `.tex`, and its macros, all named from the parts `hive`, the method and the bucket. The existing rows, tables and macros stay byte-identical.
- [ ] Run `report`. Check with git that only Hive lines were added to `.docs/results/p7-report/`.
- [ ] Commit: `feat: Hive table and macros in the eval report`

## Claude's part

- [ ] After Steps 1–2: read the commits and the diff against the design. Check that `git diff --stat` shows nothing under `eval/` (DW4).
- [ ] Steps 3–5 with the author, as written above.
- [ ] **On a fail (at Stop G).** Docs (DW3), one commit `docs: close p7-hive-check (gate failed)`:
  - `.docs/super-plan.md`: §4 row P7 (`p7-hive-check` closed, gate failed), the "Hive side check" paragraph gets a status line with the gate number, §8 the Hive risk with what was found, §11 item 8 closed, a change-log line. Decision Q2 stays.
  - `.docs/implementation-plan.md`: row 9b "gate failed" with the date, and a change-log line.
  - `.docs/datasets.md`: a short Hive section (source, slice, gate number, why not used).
  - `docs/Guidance-Manual/en/04-data.md` and `vi/04-data.md`: one sentence that Hive was checked and why it was not used.
- [ ] **On a pass.** After each Sonnet return: read the commits and the diff. Do Stop T and Stop B with the author. After Step 10, docs in one commit `docs: close p7-hive-check`:
  - `.docs/super-plan.md`: P7 "Method" (H-comm, H-follow and H against BL2, Spec Open question 7), a status line with the results, §4 row P7, §8, §11 item 8 (tell the supervisor), a change-log line (decision Q2 changes).
  - `.docs/implementation-plan.md`: §2.2 (dataset id `hive-2021q1`, the D1 exception for Hive), §4 Hive row (methods), §5 row 9b ✅, the new dates of tasks 10–13, and a change-log line.
  - `.docs/datasets.md`: the Hive section (source, slice, rules, counts, limits: exposure bias, bot votes, unsubscribe and unfollow dropped) and the change to Q2.
  - `docs/Guidance-Manual/{en,vi}/04-data.md` (Hive data), `05-evaluation-protocol.md` (the Hive run, no family) and `10-defense-qa.md` (a question on the community term on real data); same content in both languages.
  - `docs/System_Architecture.md`: the Hive adapter, config and results in the tree.
  - `CLAUDE.md`: the `adapt:hive` command.
- [ ] `bash .claude/hooks/verify.sh`, the Acceptance items, the Result, then close the task.

## Tests

Eval tests run under `node --test` with no Docker. The task-folder tests run the same way, on their own path, until Step 6 moves them.

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW2, F5, F6, F11 | unit (task folder, then eval) | On a hand-made `HiveRaw`: an edited post keeps its first time; a changed vote keeps the first positive vote; a downvote and a weight-0 vote are dropped; a self-vote and a self-reply are dropped; a vote in the same second as its post is dropped; a reply to a reply is dropped; an unsubscribe and an unfollow are dropped; a follow with a user outside the slice is dropped; a post outside the 20 communities is dropped. Ids follow the byte-order rules of the design. Every drop is counted in `HiveCounts`. A bad account name, a bad community name and a non-integer time each throw with the file and row. Two calls give equal output. The output passes `checkFormat` except `community-non-member` |
| TC2 | DW2, F7, F10 | unit (task folder) | On a raw fixture folder with its `sources.json`: a changed file stops `runGate` before any write; the bucket table equals `bucketReport` on the same tables; the gate number counts only kept bucket 0–4 users with a membership before `t_u` (a membership at exactly `t_u` does not count); a post by a non-member is reported, not fatal; the verdict is pass at 100 and fail at 99 (with `KEPT_THRESHOLD`); `gate.md` from two runs is byte-identical; nothing is written inside the repo except `gate.md` |
| TC3 | DW6 | unit (eval) | `adaptHive` on a raw fixture folder and a fixture config: a wrong SHA-256 stops it before the old folder is deleted; two runs into two folders give byte-identical files and manifests; the manifest has `source.kind` `"hive"`, the citation and every file hash |
| TC4 | DW6 | unit (eval) | `checkFormat` gives no `community-non-member` for a `"hive"` manifest, and still gives it for `"synthetic"` and `"digg"` ones. The check runner prints the bucket table for `hive-2021q1` |
| TC5 | DW7 | unit (eval) | The report tests on a fixture with and without a `p7-hive` results folder: without it, every existing output is byte-identical to today's; with it, the Hive table and macros appear, each macro equals its cell, and two runs are byte-identical |
| TC6 | DW4 | unit (eval) | `npm run verify -w @breadit/eval` passes at the end of Stage 1 and at the end of Stage 2 |

## Acceptance

- [ ] DW1: the run log and `gate.md` hold the dry-run bytes and the row counts of Q1–Q6, with the date → present for every query (or `gate.md` says why BigQuery could not run).
- [ ] DW2: `gate.md` has the verdict, T, the bucket table and the gate number → "pass" exactly when the gate number is at least 100.
- [ ] DW3: `git diff` of the super-plan and the blueprint at the close → the lines of "Claude's part" for the outcome, and no change to §5, §6 or the rest of §7 (only the new T, on a pass).
- [ ] DW4: at Stop G, `git diff --stat` since the task's first commit → nothing under `eval/`, `packages/` or `apps/`; `npm run verify -w @breadit/eval` passes.
- [ ] DW5: `git status --ignored datasets/raw/` → the Hive files are ignored; no list of Hive account names and no name-to-id map in any commit of the task (the 20 community ids `hive-NNNNNN` may be committed).
- [ ] DW6 (pass only): the two adapter manifests are byte-identical, and the eval `check` passes for `hive-2021q1`.
- [ ] DW7 (pass only): `.docs/results/p7-hive/` has `summary.csv` and `compare.csv` with H-comm, H-follow and H − BL2 and no p-value; its manifest hashes match the files.
- [ ] Pass only: every value in `p7-hive.json` equals a `chosen` = 1 row of `p7-hive-tune/tuning.csv`.
- [ ] `bash .claude/hooks/verify.sh` → every check passes.

## Result

