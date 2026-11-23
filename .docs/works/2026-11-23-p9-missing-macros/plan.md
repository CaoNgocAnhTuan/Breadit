# Plan: The two missing macros of Chapter 6

Status: done · 2026-11-23
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-23-p9-missing-macros/`

Code under `eval/src/report/` only, then the report outputs, then the chapter. No Docker is needed. Run `nvm use` first (the `.ts` files run on the pinned Node) and build `@breadit/ranking` before the eval tests. All commits go on `test-app` and are never pushed. Approving this plan approves the commits below.

## Steps

- [x] 1. **Keep the old values.** Before any change, copy `.docs/results/p7-report/macros.csv` to a temporary file outside the repo (for DW4 in step 5). (Design: Failure modes F2.)

- [x] 2. **Tests first.** In `eval/src/report/macros.test.ts`, write TC1–TC4 below, and in `report.test.ts` TC5. Run the eval tests and see the new ones fail for the right reason (count 153 not 172, the new names missing, `tieChanges` and `checkTieChanges` not exported). (Design: Code files, the two test files.)

- [x] 3. **Fixture.** In `eval/src/report/fixture.ts`, change the summary rows of the run `p7-e6-ties` with `k = 10` and `bucket = all`: they take the seed of `p7-main`, so they equal E1, except BL4 on `syn-W2M-M`, which is the E1 value minus 0.010000 (6 decimals, as the other cells). Nothing else in the fixture changes. (Design: Approach, "The test fixture".)

- [x] 4. **Code.** In `eval/src/report/macros.ts`: the 3 E3 `n` specs, the E6 loop over `NINE_METHODS`, the 2 `Full` specs of the BL4 pair, the comment count 172; then `TieChange`, `E6_LARGEST`, `tieChanges` (whole millionths, total order with a compare function) and `checkTieChanges` (largest pair, no tie for the largest, H and BL2 equal at 3 decimals). In `report.ts`, call `checkTieChanges(runs)` after `buildMacros` and before any file is written. Run the eval tests until they all pass, and `npm run verify -w @breadit/eval` (typecheck and tests). Commit steps 2–4. (Design: Approach; Code files, `macros.ts`, `report.ts`.) Commit: `feat(report): E3 bin 1-4 counts, E6 macros for all methods, and the tie-change check`

- [x] 5. **Report outputs.** Build `@breadit/ranking`, run the report, and check that it prints 172 macros and passes the tie check. Run it a second time and compare the bytes of every file of `p7-report/` (DW5). Compare the new `macros.csv` with the copy of step 1: the 153 old rows are the same, and only 19 rows are new (DW4). Then run `results:manifest -- --write`, and `results:manifest` once more: it must say "equal" (DW6). Commit `p7-report/` and `.docs/results/manifest.json`. (Design: Approach, "Outputs"; Failure modes F2, F7.) Commit: `results: p7-report with the 19 new macros, merged manifest`

- [x] 6. **Chapter 6.** In `.docs/Thesis-Report/chapters/experiments-and-results.tex`, replace the two sentences of lines 262 and 345 with the text of the Design (Approach, "Chapter 6 text"). Keep the `\providecommand{\macromissing}` line and its comment. Build the thesis with `latexmk -pdf main.tex` in `.docs/Thesis-Report/`: exit 0, no "Undefined control sequence" and no new overfull box in the log, and no `[MACRO?` in the PDF text (DW2, DW7, DW8). Add the change-log line 1.27 to `.docs/implementation-plan.md` (the two marks of Chapter 6 are filled; 172 macros). Commit. (Design: Approach, "Chapter 6 text", "Outputs"; Failure modes F8, F9.) Commit: `docs: Chapter 6 uses the new E3 and E6 macros (no missing macro left)`

## Tests

All are unit tests of `eval/src/report/` with `node:test`, on the fixture (no Docker).

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW1, DW3 | unit | `MACRO_SPECS` has 172 specs: 157 of the P7 runs and 15 of E7; every name is letters only and none repeats |
| TC2 | DW3 | unit | `buildMacros` on the fixture has the 19 new names: the 3 `eThree…OneFourN` are the `n` cells of `p7-e5-worlds/density.csv` (bin `1-4`) as plain integers; the 18 `eSix…TenAllValue` (9 methods × 2 datasets) are their `ndcg` cells at 3 decimals; the 2 `…BLFourTenAllValueFull` have 6 decimals and come from `p7-main` and `p7-e6-ties` |
| TC3 | DW8 | unit | `tieChanges` on the fixture: 18 rows, largest first; the first is BL4 on `syn-W2M-M` with `changeMicro` 10000; H and BL2 have 0; the order is the same on a second call |
| TC4 | DW8 | unit | `checkTieChanges`: passes on the fixture; throws with a message that names the pair when `want` is another pair; throws on a table where two pairs share the largest change; throws when the E6 value of H (or BL2) differs from E1 at 3 decimals (each built by editing one cell of the fixture, with the fixture's edit helper) |
| TC5 | DW5, F3 | unit | the report on a fixture where another pair has the largest change stops with the tie-check message and writes no file into an empty output folder; the existing test "two runs give byte-identical files" still passes |

## Acceptance

Claude does these after step 6.

- [x] A1 (DW1, DW9). `verify.sh` → all checks pass; the eval test count is the old count plus the new tests.
- [x] A2 (DW2). `\macromissing` in `chapters/*.tex` → only the `\providecommand` line and comment lines remain; the PDF text has no `[MACRO?`.
- [x] A3 (DW3). `results-macros.tex` → `\eThreeWTwoLNdcgTenOneFourN`, `\eThreeWTwoMNdcgTenOneFourN`, `\eThreeWTwoHNdcgTenOneFourN` are `1`; `\eOneWTwoMNdcgBLFourTenAllValueFull` is 0.009075 and `\eSixWTwoMNdcgBLFourTenAllValueFull` is 0.007869; each has a row in `macros.csv` that names its file, row key and column.
- [x] A4 (DW4). The old 153 rows of `macros.csv` → unchanged (names and values).
- [x] A5 (DW5, DW6). The report run twice → the same bytes; `results:manifest` → "equal".
- [x] A6 (DW7, DW8). The PDF, Section E3 and E6 → the counts and the two 6-decimal values show; the E6 paragraph names BL4 on `syn-W2M-M` and says H and BL2 do not change; no undefined reference or control sequence in the log.
- [x] A7. `git diff` of the task's commits → no change outside `eval/src/report/`, `.docs/results/p7-report/`, `.docs/results/manifest.json`, the chapter, the implementation plan and this task folder.

## Result
Done 2026-11-23. Delivered: 19 new macros of the report (3 E3 counts of the bin 1–4, 14 E6 NDCG@10 values so E6 has all nine methods like E1, 2 `Full` values of BL4 on `syn-W2M-M`), the check `checkTieChanges` that stops the report when the E6 text is no longer true, and Chapter 6 with no `\macromissing` mark left.

**Tests.** Eval tests 434 → 438 (TC2–TC5 new, TC1 and the `Full` count test updated); the new ones failed first for the planned reasons. `verify.sh`: all 9 checks PASS (ranking 85, backend unit 211, IT 171, eval verify).

**Acceptance.** A1–A7 PASS:
- A3: the three `eThree…OneFourN` are 1; `eOneWTwoMNdcgBLFourTenAllValueFull` 0.009075, `eSixWTwoMNdcgBLFourTenAllValueFull` 0.007869; each traces to its cell in `macros.csv`.
- A4: the 153 old rows of `macros.csv` are unchanged; 19 rows are new.
- A5: the report run again by Opus wrote the same bytes (no change in `git status`); `results:manifest`: "equal: 162 files in 16 folders and 9 datasets".
- A6: `latexmk` exit 0, 96 pages, 0 undefined control sequences, 1 overfull box (the old one, also there before); the PDF text has no `[MACRO?` and shows the new E3 and E6 sentences.
- A7: only the files of the Design's table changed.

**Commits.** `dc29020` feat(report): E3 bin 1-4 counts, E6 macros for all methods, and the tie-change check · `57e5b68` results: p7-report with the 19 new macros, merged manifest · `02ae098` docs: Chapter 6 uses the new E3 and E6 macros (no missing macro left) · the closing commit with this task folder.

**Different from the plan.** None in substance. The test helper `fixtureWithE6Shift` is local to each test file, so `fixture.ts` has only the one change of the Design. The task folder is committed in the closing commit (the plan listed no commit for it).

**Docs updated.** `.docs/implementation-plan.md` (v1.27, change-log line). No doc names the macro count, so `docs/` did not change.

**Open for the author.** The E3 sentence reads "1, 1 and 1 users": exact, but you may want to reword it in row 28.
