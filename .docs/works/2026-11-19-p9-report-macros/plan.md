# Plan: Report macros for Chapters 5 and 6

Status: approved · 2026-11-19
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-19-p9-report-macros/`

All commits go on `test-app` and are never pushed. Steps 1–4 need no Docker. Run `nvm use` first: the `eval/` files run directly on the pinned Node. The full `thesis:repro` run at the end needs `docker compose up db redis -d` and the two Digg zips; Claude runs it after Step 4. Before Step 1, Claude commits `design.md` and this plan: `docs: p9-report-macros spec, design and plan`.

## Steps

- [x] 1. **Grid values.** Write the `gridValue` cases of TC1 in `eval/src/report/round.test.ts` first and see them fail (no function yet). Then add `gridValue(cell: string): string` to `eval/src/report/round.ts`: it returns the cell as written when it is one decimal number, or two joined by `/`, and throws otherwise (empty cell, letters, `1/2/3`, a sign). Reuse the `DECIMAL` pattern of that file, without the minus sign. (Design: Approach 3; Code files, `round.ts`, `round.test.ts`; F5.) No commit yet.

- [x] 2. **The new macros.** Change `eval/src/report/macros.test.ts` first (TC2, TC3, TC4) and see the new checks fail for the right reason (the counts, the missing names, the `Full` value). Then change `eval/src/report/macros.ts` (Design: Approach 1–3; Code files, `macros.ts`):
  - `METHOD_WORD` gets the seven baselines, and `GRID_WORD` names `512/512` and `1024/1024`;
  - `build()` gets the specs of the Design table: tuning chosen values (10), the two tuning points with `Full` (2), E1 for all nine methods (H and BL2 keep their names), E2 for every F1 group and the five columns, built once per (dataset, group, column), the three Digg `Full` macros, and the three E5 topic macros from the H row of `p7-h0/compare.csv`;
  - `formatCell(column, cell, name)`: a name ending in `Full` gives `roundDecimal(cell, 6)`, the column `value` gives `gridValue(cell)`, every other column as today. `buildMacros` and `verifyMacros` pass the name;
  - the comment on `MACRO_SPECS` says 153.
  Do not change `report.ts`, `read.ts`, `tables.ts`, `fixture.ts` or `report.test.ts`. If a fixture row is missing for a new spec, stop and report (the Design says the fixture has them all). Run the eval verify (typecheck and all tests). Commit Steps 1 and 2 together: `feat(eval): report macros for Chapters 5 and 6`

- [x] 3. **Rebuild the report and the merged manifest.** Run the report on the committed results. Check with `git diff --stat` that in `.docs/results/p7-report/` only `macros.csv`, `results-macros.tex`, `results.md` and `manifest.json` changed (DW2). If a table, `fig-e3-density.csv` or any results CSV changed, stop and report. Check that every line of the committed `macros.csv` is still in the new one (DW3). Then write the merged manifest with `results:manifest` in write mode, and run it in check mode: it must exit 0, and the diff of `.docs/results/manifest.json` must touch only the `p7-report` entry (DW6). If a git-ignored dataset in `eval/data/` is missing on this machine, rebuild it with its existing command; never edit a committed result. (Design: Approach 4; Workflow; F3, F8, F9.) Commit the report folder and the merged manifest together: `chore: p7-report with the chapter macros`

- [x] 4. **Blueprint.** In `.docs/implementation-plan.md` §2.8, add one paragraph after the task 9 note, marked "Task `p9-report-macros` (2026-11-19)": a name that ends in `Full` holds its cell with all 6 decimals, for numbers that 3 decimals hide (the Digg H1 row and two tuning points); a tuning grid value is printed as written (for example `1024/1024`); the new name words (`tune`, `Chosen`, `ValNdcgTen`, `WZeroTopic`, `BLZero` to `BLSix`, the grid words). Set the version to 1.14 with today's date, and add a change log line. Do not touch other sections. Do not change the super-plan; Claude does that when the task closes. (Design: Approach 5; Code files, `.docs/implementation-plan.md`.) Commit: `docs: report macros rule in the blueprint`

## Tests

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW1 (F5) | unit (`eval/src/report/round.test.ts`, `node --test`) | `gridValue` returns `0.0625`, `720000`, `1024/1024` and `32/512` unchanged, and throws on `""`, `abc`, `1/2/3`, `-1` and `1/` . |
| TC2 | DW1, DW4 (F1, F2, F4) | unit (`eval/src/report/macros.test.ts`) | `MACRO_SPECS` has 138 specs of the P7 runs and 15 of E7, letters only, no repeat. `buildMacros` on the fixture: every value follows the rule (a `Full` name equals its 6-decimal cell text, the column `value` equals its cell, the rest as before). Hand picks: `eTwoDiggNdcgTenZeroFourGainFull`, `…CiLowFull`, `…CiHighFull` read `p7-main/compare.csv`, row `digg2009|F1|H|BL2|10|0-4`, and equal the cell text; `tuneWTwoMHChosen` reads `p7-tune-main/tuning.csv` and its row has `chosen` = 1 in the fixture; `tuneWTwoMHValNdcgTenFiveTwelveFull` reads the row with value `512/512`; `eOneDiggNdcgBLFourTenAllValue` has the row key `digg2009|test|BL4|10|all`; `eTwoWTwoMNdcgTenTwentyPlusPHolm` has the column `p_holm`; `eFiveWZeroTopicNdcgTenAllGain` has the row key `syn-W0-M|none|H|BL2|10|all`. Every name of the old hand picks still exists with the same file, row key and column. |
| TC3 | DW1 (F4) | unit (`eval/src/report/macros.test.ts`) | `verifyMacros` throws when a `Full` macro holds the 3-decimal value of its cell, and passes on a fresh build. |
| TC4 | DW1 (F6) | unit (`eval/src/report/macros.test.ts`) | The H0 check selects the macros by the name prefix `hZero`: there are 3, and each reads the H-follow row of `p7-h0`; `hZeroWZeroNdcgTenAllGain` does not exist. |
| TC5 | DW5 (F8, F11) | unit (existing `eval/src/report/report.test.ts`) | Passes unchanged: two runs give byte-identical files, and every table has the same numbers in `.tex`, `results.md` and the macros. |
| — | all | all | The eval verify and `verify.sh` pass. |

## Acceptance

Claude does these after Step 4.

- [ ] DW2: `git show --stat` of the Step 3 commit → in `p7-report/` only `macros.csv`, `results-macros.tex`, `results.md` and `manifest.json`, plus `.docs/results/manifest.json`.
- [ ] DW3: every line of `macros.csv` at `5df85f9` is in the new file → no line missing; the new file has 153 rows.
- [ ] DW4: the new names of the Design table are in `macros.csv` with the cells of the Spec table → the three Digg `Full` values are 0.000117, 0.000015 and 0.000225; `\tuneWTwoMHChosen` is `1024/1024`; `\tuneDiggBLTwoTChosen` is `4`.
- [ ] DW5: the report written into an empty temp folder → every file byte-identical to the committed `p7-report/`.
- [ ] DW6: `results:manifest` in check mode → exit 0.
- [ ] DW7: the chapter macro check over Chapters 5 and 6 → every `\name` is in `macros.csv`, and each `[MACRO?]` mark except the E6 one has a macro to use (the mapping goes in the Result).
- [ ] Full `npm run thesis:repro` (under `caffeinate -i`, about 2.5 hours) → exit 0, every hash equal, and `git status --short .docs/results/ eval/config/runs/` empty after it. The step lines and the run time go to `repro_output.txt` in this folder.
- [ ] DW1: the eval verify and `verify.sh` pass.

When these pass, Claude commits `repro_output.txt` with the super-plan update (§4 P9 row with the task, the status date, change log 0.31; no frozen value changes) and the Result below. Commit: `docs: p9-report-macros runs and status`. The Result proposes the tag `v2-thesis-experiments` on that commit. The author makes the tag.

## Result

<!-- Claude fills this in at the end: what was done, test counts, commits, and anything that differed from the plan (and why). -->
