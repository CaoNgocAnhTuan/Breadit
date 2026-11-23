# Plan: Final checks of the thesis (re-runnable)

Status: done · 2026-11-23
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-23-p10-final-checks/`

New files under `scripts/thesis-check/` only, plus comments in `references.tex`, the allow-list, a few text fixes the first run finds, and the docs. No Docker. Node 22 (`nvm use`), `latexmk` and Ghostscript are on this machine. `docs/Pre-thesis/` is read, never written. All commits go on `test-app` and are never pushed. Approving this plan approves the commits below.

## Steps

- [x] 1. **Tests first.** Write `scripts/thesis-check/lib.test.mjs` with `node:test` and `node:assert/strict`: TC1–TC10 below, on small strings made in the test (no real thesis file). Run it and see it fail because `lib.mjs` does not exist yet. (Design: Code files, `lib.test.mjs`.)

- [x] 2. **Helpers.** Write `scripts/thesis-check/lib.mjs` with the pure functions of the Design (Code files, `lib.mjs`), Node built-ins only, no clock, every sort with a compare function, no file write. Run the tests until they pass. Commit steps 1–2. (Design: Approach, the five checks; Failure modes F1–F4, F10, F11.) Commit: `feat(thesis-check): check helpers and their tests`

- [x] 3. **The command.** Write `scripts/thesis-check/check.mjs`: read the inputs of the Design (Approach, "Inputs"), run the five checks on the thesis and checks 1 and 2 on the slides, run `latexmk` in `.docs/Thesis-Report/` unless `--no-build`, print in the format of the Design (Approach, "Output"), exit 1 on any FAIL. The page limits 120 (total, FAIL) and 100 (Chapters 1–9, WARN) are constants at the top. Create `allow-numbers.tsv` with its header line only. Add `thesis:check` to the root `package.json`. Run it once with `--no-build` to see that it runs to the end (it will FAIL: no allow-list entries and no `§10` comments yet). (Design: Approach; Workflow; Code files, `check.mjs`, `package.json`.)

- [x] 4. **The §10 links.** Add `% §10 [n]` at the end of each of the 45 `\item` lines of `.docs/Thesis-Report/chapters/references.tex`, matching each entry to its item of `.docs/super-plan.md` §10 by authors, year and title. Write the 45 pairs (key → n) into a new file `section10-links.md` in the task folder. Build the PDF once: it must not change (same page count, no new warning). Run the command again: check 2 must say 45 used, 45 defined, 45 verified (DW3). (Design: Approach, check 2; Failure modes F5.)

- [x] 5. **First run and triage.** Run the full command (with the build). For each check 1 finding, decide by the Design (Approach, "First run"): a typed result that has a macro in `results-macros.tex` → replace it in the chapter (and in its Markdown draft in `drafts/`); a setting, a version, a number quoted from a paper or a test timing → one line in `allow-numbers.tsv` with a clear reason; a typed result with no macro → leave it and list it in a new file `triage.md` in the task folder. List every check 4 WARN and INFO in `triage.md` too, grouped by chapter, with the length and the first words; fix no overlap. Then run the command twice and compare the two outputs byte for byte (DW6). Save the last output as `first-run.txt` in the task folder. Commit steps 3–5. (Design: Approach, "First run"; Failure modes F6–F9.) Commit: `feat(thesis-check): npm run thesis:check, the §10 links and the first run`

- [x] 6. **Docs.** `CLAUDE.md` Commands: `npm run thesis:check` (what it checks, `--no-build`, that it builds the PDF, reads `docs/Pre-thesis/` only, and its tests `node --test 'scripts/thesis-check/*.test.mjs'`). `docs/System_Architecture.md`: one line for `scripts/thesis-check/` in the directory tree, next to `scripts/demo/`. Commit. (Design: Code files, the docs rows.) Commit: `docs: thesis:check command`

- [x] 7. **Acceptance and close (Opus).** Do the Acceptance items. Set `.docs/implementation-plan.md` §5 row 28 to ✅, add "run `npm run thesis:check` again" to rows 30 and 31, and a change-log line. Fill the Result. Commit: `docs: p10-final-checks first run and close`

## Tests

All are unit tests of `scripts/thesis-check/lib.mjs` with `node:test`, on small made-up inputs. No Docker, no LaTeX build. Run them with `node --test 'scripts/thesis-check/*.test.mjs'`.

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | F1 | unit | `stripTex` keeps the number of lines; removes `%` comments but keeps `\%`; blanks the arguments of `\url`, `\path`, `\href`, `\label`, `\ref`, `\refcite`, `\input`, `\includegraphics`, `\thesisdiagram`, and the body of `verbatim` and `lstlisting` |
| TC2 | DW2, F2 | unit | `numberCandidates`: finds `0.054` and `95\%` with their line; skips `15.1.6`, `v3.13`, `Node 22`, `K = 10` (integer) and a number inside a blanked URL |
| TC3 | DW2, DW5 | unit | `parseAllowList` + `applyAllowList`: an entry with file, number and context allows the candidate; the same number on a line without the context is not allowed; an entry with an empty reason gives FAIL; an entry that matches nothing gives WARN |
| TC4 | DW2, F3 | unit | `macroUses` + `parseMacros`: a defined macro passes; `\eOneUnknownValue{}` gives FAIL; the longest letter run is the name (`\eOneWTwoMNdcgHTenAllValue{}` is one name); `\macromissing{` outside the `\providecommand` line gives FAIL |
| TC5 | DW2 | unit | `refKeys`, `parseReferences`, `checkCitations`: a used key not defined → FAIL; a defined key never used → FAIL; an entry with no `% §10 [n]` → FAIL; a `§10` number that is not an item → FAIL; an item with status `search only` → FAIL; a status that starts with `verified` passes; an item whose note says `do not cite a finding` gives an INFO line per citing sentence |
| TC6 | F4 | unit | `parseSection10`: reads only the lines `^\d+\. ` between `## 10.` and the next `## `; the status is the text after the last ` · ` |
| TC7 | DW2 | unit | `checkAbstract`: a macro of the abstract not in Chapter 6 → FAIL; all present → PASS |
| TC8 | DW2, F6, F7 | unit | `words` + `overlaps`: an 8-word run shared with a pre-thesis source → WARN with both lines; a 7-word run → nothing; two touching runs merge into one match; a shared run with an extract → FAIL, but inside `` ``…'' `` followed by `\refcite` within 200 characters → INFO |
| TC9 | DW2 | unit | `parsePages` + `checkPages`: reads the total from `Output written on main.pdf (97 pages` and the Chapter 1 and References pages from `main.toc` lines; total 121 → FAIL; Chapters 1–9 at 101 → WARN; 97 and 73 → PASS |
| TC10 | DW6, F10, F11 | unit | `formatFindings` sorts by path, line, message whatever the input order, and prints no absolute path; the source of `lib.mjs` and `check.mjs` has no `writeFile`, `appendFile` or `Date` |

## Acceptance

Claude does these after step 6.

- [x] A1 (DW1). `npm run thesis:check` on the tree after step 5 → one line per check (5 thesis, 2 slides), findings as `path:line: message`, exit code 0 if no FAIL (or non-zero with the FAILs listed in `triage.md` as left for the author).
- [x] A2 (DW2). The tests → all pass; each check has a pass case and a fail case.
- [x] A3 (DW3). Check 2 → 45 used, 45 defined, 45 verified; `section10-links.md` has 45 pairs, and a sample of 5 pairs read by hand against §10 is right.
- [x] A4 (DW4). Check 4 → it read the 15 pre-thesis LaTeX files, the 29 pre-thesis Markdown files and the 22 extracts; a count per chapter is printed; `git status` shows no change under `docs/Pre-thesis/`.
- [x] A5 (DW5). An allow-list line with an empty reason, added for the test and removed after → the command FAILs on it.
- [x] A6 (DW6). Two runs → the same output byte for byte.
- [x] A7 (DW7). `first-run.txt` and `triage.md` exist; every finding of the first run is fixed or listed in `triage.md`; every replaced number gives the same PDF text as before (same value through the macro).
- [x] A8 (DW8). `verify.sh` → all checks pass.
- [x] A9 (DW9). `CLAUDE.md` names the command; `docs/System_Architecture.md` names the folder; implementation plan row 28 and its change-log line are updated.

## Result
Done 2026-11-23. Delivered: `npm run thesis:check` (`scripts/thesis-check/check.mjs`, `lib.mjs`, `allow-numbers.tsv`) with the five checks on the thesis and checks 1–2 on the slides; a `% §10 [n]` comment on each entry of `references.tex` (`section10-links.md` lists the 44 pairs); the first run (`first-run.txt`) and its triage (`triage.md`).

**Tests.** `scripts/thesis-check/lib.test.mjs`: 48 `node:test` tests (TC1–TC10), 48 pass; they failed first because `lib.mjs` was missing. `verify.sh`: all 9 checks PASS (ranking 85, backend unit 211, IT 171, eval verify). The new tests are not part of `verify.sh` (like the demo tests).

**First run.** 6 PASS, 0 WARN, 1 FAIL, exit 1:
- numbers: 127 decimals and percentages (76 chapters, 51 slides), all allowed with a reason (83 lines: mostly layout widths, then the 95\% level, numbers quoted from papers, frozen settings); 0 typed results; 0 undefined macros.
- citations: 44 used, 44 defined, 44 verified; 26 INFO lines (sentences citing an "abstract only" source, for one reading).
- abstract: 10 of 10 macros also in Chapter 6.
- overlap: 0 runs of 8 words shared with the pre-thesis text (LaTeX and Markdown); 8 runs shared with the P1 extracts, all in Chapter 2 (FAIL). Only one (line 26, words of the SoRec abstract without quotation marks) is text of a paper; the other 7 repeat the extracts' own summary lines. Left for the author (`triage.md`).
- pages: 97 in total, 73 for Chapters 1–9.

**Acceptance.** A1–A9 PASS. A1: exit 1, with the one FAIL listed in `triage.md`. A3: 10 of the 44 pairs read by hand against §10 (among them the two Twitter and three Digg entries): all right. A4: no change under `docs/Pre-thesis/`. A5: a line with an empty reason gives `FAIL [numbers] allow-list entry has no reason`; the file was restored. A6: two runs by Opus byte-identical; the same as `first-run.txt` apart from the first line (`--no-build`).

**Commits.** `0c018d5` feat(thesis-check): check helpers and their tests · `378bdd3` feat(thesis-check): npm run thesis:check, the §10 links and the first run · `b54e39f` docs: thesis:check command · the closing commit (this folder and `.docs/implementation-plan.md` v1.28).

**Different from the plan.**
1. 44 references, not 45: the plan's count included the example `\item\label{ref:<key>}` in a comment of `references.tex`. The same mistake was in Opus's chat counts of 2026-11-23 (44 before Hogg and Lerman was added, 45 after); the true numbers are 43 and 44.
2. `allow-numbers.tsv` was filled before step 4, not in step 5 (order only).
3. `lib.mjs` exports more helpers than the Design lists; overlap findings are merged per thesis match and source group ("+n more files").
4. Check 1 found 127 candidates, not the 138 of the Design's probe (the script strips more commands than the probe did).

**Docs updated.** `CLAUDE.md` (Commands), `docs/System_Architecture.md` (directory tree), `.docs/implementation-plan.md` (row 28 ✅, rows 30 and 31, v1.28).

**Open for the author.**
1. Chapter 2 line 26: put the SoRec words in quotation marks, or reword them.
2. The other 7 overlap FAILs repeat the author's own notes. The command will keep failing on them. Either reword them, or decide that the extract check compares only the quoted parts of the extracts (a small change to the check, in a new task).
3. Run `npm run thesis:check` again after the feedback (rows 30 and 31).
