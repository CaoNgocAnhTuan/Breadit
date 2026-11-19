# Plan: Figure data for Chapter 6 (E2, E5)

Status: approved · 2026-11-19
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-19-p9-figure-data/`

All commits go on `test-app` and are never pushed. No step needs Docker. Run `nvm use` first: the `eval/` files run directly on the pinned Node; build `@breadit/ranking` if the eval tests need it. Before Step 1, Claude commits `design.md` and this plan: `docs: p9-figure-data spec, design and plan`.

## Steps

- [ ] 1. **Tests first.** In `eval/src/report/report.test.ts`, add the two files to `FILES`, and write TC1 (fig-e2) and TC2 (fig-e5) of the table below. Run them and see them fail for the right reason (the files are not written yet). (Design: Code files, `report.test.ts`; F3, F5, F8.) No commit yet.

- [ ] 2. **The row builders and the files.** In `eval/src/report/tables.ts`: add `figE2Rows` (reusing `FigRow`, `pick`, `cellOf`, `MAIN`, `F1_GROUPS`), the `FigE5Row` interface, the `E5_ROWS` list of the Design table, and `figE5Rows`; change `e5Table` to read `E5_ROWS`, keeping its labels and its order. In `eval/src/report/report.ts`: write `fig-e2-history.csv` with `FIG_HEADER` and `fig-e5-worlds.csv` with `FIG_E5_HEADER`, and update the top comment. Do not change `read.ts`, `macros.ts`, `round.ts` or `fixture.ts`; if a fixture row is missing for the new rows, stop and report. Run the eval verify (typecheck and all tests). (Design: Approach 1–3; Code files, `tables.ts`, `report.ts`; F1, F2, F4.) Commit Steps 1 and 2 together: `feat(eval): figure data for E2 and E5 in the report`

- [ ] 3. **Rebuild the report and the merged manifest.** Run the report on the committed results. Check with `git status` that in `.docs/results/p7-report/` there are exactly two new files and `manifest.json` changed, and every other file is byte-identical (DW2); if a table, `results.md`, a macro file or `fig-e3-density.csv` changed, stop and report. Then write the merged manifest with `results:manifest` in write mode and run the check mode: exit 0, 162 files, and only the `p7-report` entry changed in `.docs/results/manifest.json` (DW5). Never edit a committed result by hand. (Design: Approach 4; F6.) Commit the report folder and the merged manifest together: `chore: p7-report with the E2 and E5 figure data`

- [ ] 4. **Docs.** Update, in this order (Design: Approach 5; Code files, docs rows):
  - `.docs/implementation-plan.md`: §2.8 (the report also writes the figure data of E2, E3 and E5), the Thesis column of the E2 and E5 rows of §4 ("table, figure"), version 1.18 and a change log line. Do not touch §5.
  - `docs/System_Architecture.md`: the Report line names the three figure files.
  - `CLAUDE.md` "Commands": the files of `npm run report` include the figure data.
  - `docs/Guidance-Manual/en/11-experiments-and-results.md` §6 and §9: one line each naming `fig-e2-history.csv` and `fig-e5-worlds.csv`; then the same in `vi/`.
  Do not change the super-plan; Claude does that when the task closes. Commit: `docs: figure data of E2 and E5`

## Tests

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW1, DW3 (F3, F5) | unit (`eval/src/report/report.test.ts`, `node --test`) | On the fixture, `fig-e2-history.csv` has the header `dataset,bin,n,mean_diff,ci_low,ci_high`, 10 rows: `syn-W2M-M` then `digg2009`, each with the groups 0, 1-4, 0-4, 5-19, 20+ in that order; every `n`, `mean_diff`, `ci_low`, `ci_high` equals, as a string, the cell of the F1 K 10 row of `p7-main/compare.csv`; and at 3 decimals each gain and interval equals the matching cells of table e2. |
| TC2 | DW1, DW3 (F2, F3, F4, F5) | unit (`eval/src/report/report.test.ts`) | On the fixture, `fig-e5-worlds.csv` has the header `dataset,variant,n,mean_diff,ci_low,ci_high`, 8 rows in the order of `E5_ROWS` (five `own-tuning` rows for `syn-W0-M`, `syn-W1-M`, `syn-W2L-M`, `syn-W2M-M`, `syn-W2H-M`, then `h0-gate`, `topic-signal`, `shuffled`); every cell equals its source `compare.csv` cell as a string; at 3 decimals the gains and intervals equal table e5; no cell has a space. |
| TC3 | DW4 (F8) | unit (existing "two runs give byte-identical files" in `report.test.ts`) | Passes with the two new files in `FILES`. |
| TC4 | DW2 (F2) | unit (existing table tests in `report.test.ts`) | Pass unchanged: table e5 has the same rows and numbers in `.tex`, `results.md` and the macros. |
| — | all | all | The eval verify and `verify.sh` pass. |

## Acceptance

Claude does these after Step 4.

- [ ] DW2: `git show --stat` of the Step 3 commit → in `p7-report/` only the two new files and `manifest.json`, plus `.docs/results/manifest.json`.
- [ ] DW3: on the real files, `fig-e2-history.csv` has 10 rows; its `syn-W2M-M` 0-4 row is n 174, 0.023061, −0.002358, 0.051290 and its `digg2009` 0-4 row is n 20644, 0.000117, 0.000015, 0.000225; `fig-e5-worlds.csv` has 8 rows; at 3 decimals the `syn-W2M-M` `own-tuning` row is 0.045 and the `h0-gate` row is 0.001 (−0.004 to 0.006).
- [ ] DW4: the report written into an empty temp folder → every file byte-identical to the committed `p7-report/`.
- [ ] DW5: `results:manifest` in check mode → exit 0, 162 files.
- [ ] DW6: a pgfplots test build of each new file in a temp folder (as the E3 test build of 2026-11-19) → `pdflatex` exit 0, no error.
- [ ] DW1: the eval verify and `verify.sh` pass.

When these pass, Claude commits the super-plan update (P9 status line, change log; no frozen value changes), the blueprint §5 row 14 ✅ (and row 15 ▶) and the Result below. Commit: `docs: p9-figure-data status`.

## Result

<!-- Claude fills this in at the end: what was done, test counts, commits, and anything that differed from the plan (and why). -->
