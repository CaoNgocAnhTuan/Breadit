# Plan: Repro command and freeze

Status: approved · 2026-11-18
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-18-p8-repro/`

All commits go on `test-app` and are never pushed. Steps 1–3 and most acceptance items need `docker compose up db redis -d`. Step 3 also needs k6 (installed at `/opt/homebrew/bin/k6`). Run one thing at a time that uses `eval_load` or Redis databases 2 and 3 (Design F10).

Sonnet does Steps 1–7. The two long runs (about 3 hours each, Design F11) are acceptance items that Claude runs after Step 7: first on this machine (DW1, DW2), then on the clean clone (DW6), never at the same time.

## Steps

- [x] 1. **Tuned α and β in the app.** Write TC1 in `apps/backend/src/feed/feed.constants.spec.ts` first and see it fail (the constant is still 1 and 1). Then set `SOCIAL_PARAMS` in `apps/backend/src/feed/feed.constants.ts` to the `syn-W2M-M` values of `eval/config/runs/p7-main.json`, and change the comment so it names that file as the source. Run the backend unit tests and the IT tests (TC4). (Design: Decisions 1; Approach Part A step 1; Code files, `feed.constants.ts` and its spec.) Commit: `feat(backend): social feed uses the tuned alpha and beta (P7)`

- [x] 2. **Parity sample with the new weights.** Run the parity draw with α and β of Step 1. Check that `pairs.csv` is byte-identical to the committed one and that in `expected.csv` only `social` rows changed. If `pairs.csv` changed, stop and report (the Design says the draw does not read α or β). Load `syn-W2M-M` into `eval_load` without `--rebase-to`, then run the parity test (TC3). (Design: Approach Part A step 2; Workflow Part A; Spec DW8.) Commit: `chore: p6-parity with the tuned alpha and beta`

- [x] 3. **E7 and the report again.** With `syn-W2M-M` still loaded from Step 2, run the E7 runner with its defaults on a quiet machine. Check: 15 runs, 0 failed requests, and `params` in `.docs/results/p7-e7/manifest.json` has α and β of Step 1. Commit the E7 results. Then run the report and check with `git diff` that in `.docs/results/p7-report/` only E7 lines changed (the `eSeven*` macros, the E7 table, the E7 lines of `results.md`, and the hashes in `manifest.json`). If a run fails, stop and report the round, the algo and the status codes; do not change the limit or the load profile (Design F12). (Design: Decisions 2; Approach Part A step 3; Spec DW9.) Commits: `chore: p7-e7 with the tuned alpha and beta` and `chore: p7-report with the new E7`

- [x] 4. **Merged manifest code.** Write TC2 in `eval/src/repro/merged.test.ts` first and see it fail (no module yet). Then add `eval/src/repro/merged.ts` (`CLASS_R`, `MergedManifest`, `buildMerged`, `checkTree`, `mergedCommand`), reusing `canonicalJson` and `sha256Hex`. Add the CLI `eval/src/cli/results-manifest.ts` (`checkNode`, then `mergedCommand`, exit code 1 on differences) and the script `results:manifest` in `eval/package.json`. Run the eval verify (typecheck and tests). (Design: Approach "The merged manifest"; Code files, `eval/src/repro/*`, `eval/src/cli/results-manifest.ts`, `eval/package.json`.) Commit: `feat(eval): merged results manifest (results:manifest)`

- [x] 5. **Write the merged manifest.** After Step 3, write `.docs/results/manifest.json` with the command of Step 4 in write mode. Then run check mode: it must print `equal` with 16 folders and 9 datasets (DW3). If a git-ignored file is missing on this machine (`eval/data/<id>/` or a `per_user.csv` in `eval/results/`), rebuild it with the existing command for that dataset or run, and never edit a committed result. (Design: Approach Part A step 4.) Commit: `chore: merged results manifest`

- [x] 6. **The repro command.** Add `scripts/repro/thesis-repro.mjs` and the root script `thesis:repro`. It does, in this order: the checks (Node, merged manifest present, clean `.docs/results` and `eval/config`, Digg zips with the SHA-256 of `eval/config/digg2009.json`, Docker with `db` and `redis` ready, and a warning under 8 GB of memory), the build, the clean step, the data, the runs in the Design order, the parity steps with α and β read from `p7-main.json`, the report and the compare. Each step logs to `eval/results/repro/<nn>-<name>.log`, prints one line, and the first failure stops the command with the last 30 log lines (Design F1–F5). Child processes get the env of the Design. Before you commit, try only the failure paths of DW5 (a missing zip, `db` stopped, an uncommitted file in `.docs/results/`): each must stop within seconds and delete nothing. Do not run the full command; Claude does that. (Design: Approach Part B; Workflow Part B; Failure modes F1–F5, F10; Code files, `scripts/repro/thesis-repro.mjs`, root `package.json`.) Commit: `feat: thesis:repro command`

- [x] 7. **Clean-clone script and docs.** Add `check_clean_clone.sh` to the task folder, in the style of the P0 script `.docs/works/2026-10-28-p0-baseline-freeze/check_clean_clone.sh`. It stops when a `thesis-repro.mjs` process already runs (F10), clones `test-app` of this repo into a `mktemp` folder, copies the two Digg zips, runs `npm ci` and then the repro command under `caffeinate -i`, checks that `git status --short` in the clone is empty, writes everything to `clean_clone_output.txt` and removes the clone. Do not run it; Claude does. Then update the docs (Design: Code files, docs rows):
  - `docs/System_Architecture.md`: `thesis:repro` ✅, α = β = 1024 in the `algo` paragraph, the tree (`scripts/repro/`, `eval/src/repro/`, `.docs/results/manifest.json`), the status table row of P8.
  - `docs/Guidance-Manual/en/` `07-determinism.md`, `08-system-and-feed.md` (the parameters paragraph and the parity date), `09-glossary.md`, `10-defense-qa.md`; then the same changes in `vi/`.
  - `CLAUDE.md`: "Commands" gets `thesis:repro` (what it needs and how long it takes) and `results:manifest`; "Feeds and ranking" says α and β are the tuned values.
  - `.docs/implementation-plan.md`: §2.3 says the merged manifest exists; §5 row 11 ▶ stays until Claude closes the task.
  The super-plan is changed by Claude when the task closes, with the results of the long runs. (Design: Code files.) Commit: `docs: P8 repro command, tuned alpha and beta`

## Tests

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW7 | unit (`apps/backend/src/feed/feed.constants.spec.ts`) | `SOCIAL_PARAMS` equals `datasetParams["syn-W2M-M"].H` of `eval/config/runs/p7-main.json` (α and β only). The existing test that α and β are in the frozen grid still passes. |
| TC2 | DW3, DW4 | unit (`eval/src/repro/merged.test.ts`, `node --test`) | On a small tree in a temp folder (two datasets, two Class D folders with one external file, one Class R folder): an equal tree gives no difference; one changed byte, a removed file, an extra file, a changed external file and a missing folder each give one line that names the path; a change in the Class R folder gives no difference; write mode twice gives the same bytes. |
| TC3 | DW8 | parity (existing `npm run test:parity`, needs db, redis and `syn-W2M-M` in `eval_load`) | 300 of 300 at the feed module and 300 of 300 over HTTP with the new weights; the parity manifest params equal `SOCIAL_PARAMS`. |
| TC4 | DW10 | IT (existing `apps/backend/test/it/`, needs db and redis) | The feed tests still pass with the new weights: For You without `algo` is as before, `social` pages and cursors work. |
| TC5 | DW9 | unit (existing `eval/src/report/*.test.ts`) and the E7 runner gates | The report tests pass unchanged; the runner's `http_req_failed` gate holds for all 15 runs. |
| — | all | all | `verify.sh` passes. |

## Acceptance

Claude does these after Step 7. Each long run uses `caffeinate -i`.

- [ ] DW5: with a Digg zip renamed, then with `db` stopped, then with an uncommitted change in `.docs/results/` → each run stops within a few seconds, names what is wrong, and deletes nothing. Restore each time.
- [ ] DW1: the repro command on this machine → exit 0, one line per step, the last line says every hash is equal. The step lines and the run time go to `repro_output.txt` in the task folder.
- [ ] DW2: right after DW1, `git status --short .docs/results/ eval/config/runs/` → no line.
- [ ] DW3: `.docs/results/manifest.json` → 16 folders (15 Class D, `p7-e7` Class R) and 9 datasets.
- [ ] DW6: `check_clean_clone.sh` after DW1 has finished → exit 0 and an empty `git status --short` in the clone; the output is in `clean_clone_output.txt`.
- [ ] DW7, DW8, DW9, DW10: TC1, TC3, TC5 and TC4 pass (from Steps 1–3).
- [ ] DW11: the grep of the Spec over `docs/System_Architecture.md` and `docs/Guidance-Manual/` → no line.
- [ ] `verify.sh` passes.

When the acceptance items pass, Claude commits the two output files with the super-plan P8 status, the §4 row, §11 item 4 (the tag proposal) and a change-log line (no frozen value changes), and the blueprint §5 row 11. Commit: `docs: p8-repro runs and status`. The Result proposes the tag `v2-thesis-experiments` on that commit. The author makes the tag.

## Result
