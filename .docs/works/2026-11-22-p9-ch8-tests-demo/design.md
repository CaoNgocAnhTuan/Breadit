# Chapter 8 Test Cases and Demonstration: draft and LaTeX

Type: writing (light path, no plan) · 2026-11-22 · Folder: `.docs/works/2026-11-22-p9-ch8-tests-demo/`
Row: `.docs/implementation-plan.md` §5 row 23 (P9, depends on row 22)

## 1. Spec

### Problem

Chapter 8 is empty: `drafts/08-test-cases-and-demonstration.md` has a title only and `chapters/test-cases-and-demonstration.tex` has two comment lines. `drafts/Report Architecture.md` gives it 9 pages: one summary table of the test levels and the demo with about eight screenshots. The full test list goes to the appendix ("Chapter 8 summarizes the tests; the full list goes in the appendix").

### Scope

**In scope:**
- A Markdown draft `drafts/08-test-cases-and-demonstration.md` (about 9 pages), then the same chapter in LaTeX in `chapters/test-cases-and-demonstration.tex`:
  - **8.1 Test strategy and summary table.** One table, one row per level: the ranking package unit tests (`packages/ranking`), the backend unit tests, the backend integration tests (`apps/backend/test/it/`, schema `it_test`, Redis database 1), the parity test (live order equals harness order, `syn-W2M-M`, 100 pairs), the eval checks (`npm run verify -w @breadit/eval`: typecheck and tests, golden, leakage, double-run), the demo-script helper tests (`scripts/demo/lib.test.mjs`), the HTTP and Socket.IO replay (`scripts/verify-bug-sweep.sh`, `scripts/verify-socket.cjs`), the manual UI sweep (`.docs/works/2026-11-20-p10-demo-sweep/sweep.md`: 28 pages, 15 flows) and the demo rehearsal (`.docs/works/2026-11-22-p10-demo-script/rehearsal.md`). Columns: level, what it checks, tool, how many tests or checks, result. The counts are the ones of today: count them from the code and from the latest records (`verify.sh` on 2026-11-22: ranking 85, backend unit 211, integration 171; parity 102 of 102; demo helpers 22). Count again any number you write and say where it comes from in Result.
  - **8.2 Selected test cases.** A short table of 8–12 test cases that matter most for the thesis (for example the parity test, the leakage test, the `asOf` guard, the cursor stays at one `t`, the ban logout, block filtering), each with ID, purpose, steps in one line, expected result, result. Take them from the real test files and name the file.
  - **8.3 The bugs the tests found.** A short paragraph with the numbers of the Bugs Report (`.docs/Bugs Report.md` §1): how many were found, fixed, and left as future work. No table.
  - **8.4 Demonstration.** The demo setup in a few sentences (`npm run demo:start`, the schema `eval_demo`, the data rebased to the start time, the two demo users, the checklist `scripts/demo/CHECKLIST.md`), then the eight figures below in this order, each with a caption and one or two sentences that say what the reader sees and which requirement or research point it shows. Use the macro `\thesisdiagram{<name>}{\textwidth}` of `main.tex` (it shows a framed placeholder until the image exists). Names: `fig8-1-foryou-chrono`, `fig8-2-foryou-engagement`, `fig8-3-foryou-social` (the same long-history user `u0000000064`; the three orders differ), `fig8-4-explore`, `fig8-5-direct-message` (a live message in an open conversation), `fig8-6-notification` ("User 787 liked your post"), `fig8-7-admin-ban` (the admin user table with the BANNED row), `fig8-8-banned-signin` (the banned user's page after the forced logout). Claude (Opus) takes the screenshots at the same time; do not wait for them.
- The first part of the appendix: `drafts/10-appendix.md` and `chapters/appendix.tex`, **Appendix A "Full test list"**: every test suite with its file and its number of tests, grouped by level (no individual test names unless a suite has 5 or fewer). Leave room for Appendix B (full tables), which another task writes later: add only Appendix A.

**Out of scope:** Chapters 1–7 and 9, the abstract, `main.tex`, `references.tex` (if a reference is needed, list it in Result), code, running the demo or the browser, taking screenshots, git commits.

### Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | `latexmk -pdf` of `main.tex`, built into the scratch folder given in the prompt | builds with no error; no undefined reference from Chapter 8 or Appendix A |
| DW2 | no typed result number of the experiments | none (a result number of Chapter 6 is a macro or a pointer to Chapter 6); test counts are facts and may be typed |
| DW3 | page count of Chapter 8 | 7–10 pages with the eight placeholders (budget 9) |
| DW4 | facts | every test file, command, count and script named exists today and the count matches |
| DW5 | the eight figures | each `\thesisdiagram` name is exactly one of the eight names above and is used by a sentence |

## 2. Impact

P9, Chapter 8 and Appendix A. No code change. Row 27 adds Appendix B later.

## Result

By Sonnet, 2026-11-22. Build: `latexmk -pdf -interaction=nonstopmode -outdir=<scratchpad>/build-ch8 main.tex` (exit 0, 89 pages, no `!` error, no undefined reference in the whole log, no overfull or underfull box in Chapter 8 or Appendix A).

**Files changed** (only these):
- `.docs/Thesis-Report/drafts/08-test-cases-and-demonstration.md` (draft with notes for the author at the end)
- `.docs/Thesis-Report/chapters/test-cases-and-demonstration.tex`
- `.docs/Thesis-Report/drafts/10-appendix.md` (made from the LaTeX tables, so the two are equal)
- `.docs/Thesis-Report/chapters/appendix.tex` (Appendix A only; a comment marks the place of Appendix B)
- this Result section

**Done when**

| # | Result | Evidence |
|---|---|---|
| DW1 | PASS | Build exit 0. No undefined reference anywhere in `main.log`. Labels used from other chapters all exist: `tab:design-fr`, `tab:design-nfr`, `tab:method-methods`, `sec:impl-realtime`, `sec:impl-tests`, `sec:results-e7`. New labels: `ch:tests`, `sec:test-*`, `tab:test-levels`, `tab:test-cases`, `fig:demo-*` (8), `tab:app-*` (4). |
| DW2 | PASS | No experiment result is typed and no macro is needed. The text points to Chapter 6 (and 7) for results. Typed numbers are test counts, bug counts of the Bugs Report and facts of the demo (28 and 2 positive actions, 426 and 273 follows, 17 s). |
| DW3 | PASS | Chapter 8 is 9 pages: printed pages 61 to 69 (Chapter 9 starts on page 70), with the eight screenshots in place (`images/fig8-1` to `fig8-8` exist, so no placeholder shows). Appendix A is 5 pages: 75 to 79. |
| DW4 | PASS | Every file, command and count was checked. Sources of the counts below. |
| DW5 | PASS | The eight `\thesisdiagram` names are exactly `fig8-1-foryou-chrono` to `fig8-8-banned-signin`; each figure has a label and a sentence with `\ref` before it. |

**Where each count comes from**

| Count | Source |
|---|---|
| Ranking 85 in 7 suites (9, 13, 3, 14, 5, 4, 37) | I ran `npm run test -w @breadit/ranking` today (85 passed), per-file counts from Jest `--json` |
| Backend unit 211 in 18 suites | I ran `npm run test -w @breadit/backend` today (211 passed, 18 suites), per-file counts from Jest `--json` |
| Demo helpers 22 | I ran `node --test 'scripts/demo/*.test.mjs'` today (22 passed) |
| Evaluation 434 in 43 files | I ran `node --test "src/**/*.test.ts"` in `eval/` (434 passed) and each of the 43 files alone for the per-file counts; `tsc --noEmit` is clean |
| Integration 171 in 14 files | Not run (no Docker). Counted from the files: 137 `it(` lines plus the `it.each` tables (`input-errors` 11 + 10 + 3 + 3 cases, `quick-wins` 5 + 4, `feed-algo` 3 + 3) = 171, per file 8, 5, 8, 3, 3, 11, 3, 16, 11, 2, 53, 22, 9, 17. It equals the `verify.sh` record of 2026-11-22 (`.docs/works/2026-11-22-p10-demo-script/plan.md`) and the Bugs Report |
| Parity 102 of 102 | Record in the same `plan.md` ("`test:parity` with the demo running: 102 of 102 pass"). The test file has 2 checks plus one test for each of the 100 pairs |
| 1,025 automatic tests | 85 + 211 + 171 + 102 + 434 + 22 |
| Replay 95 checks (84 + 11) | `.docs/works/2026-10-21-bugs-sweep/sweep-after.txt` (95 PASS lines), the record of `p9-bug-quick-wins` and `sweep.md` DW1; 11 = `record(` calls in `scripts/verify-socket.cjs`. Before the fixes: 42 passed, 53 failed (`sweep-before.txt`) |
| Sweep 28 pages, 15 flows | `sweep.md`: pages 24 PASS, 2 FAIL known T6, 2 FAIL V1; flows 15 PASS (some with a new V finding). V1 was checked again after the fix (`p10-demo-fixes/plan.md`, A1) |
| Rehearsal 9 steps | `rehearsal.md`: steps 0, 1, 2, 3, 4, 5, 6a, 6b, 7, all PASS; start took 17 s |
| Bugs 48 / 34 / 14 | `.docs/Bugs Report.md` section 1 and 6: 36 findings + 7 (R1 to R7) + 5 (V1 to V5) = 48; 34 resolved; 14 open = 8 future work (T6, N3, N10, R4, R5, N7, N9, B8) + 6 before sharing the app (B1, S4, S6, B5, R3, R6) |
| Demo users: history 28 and 2, follows 426 and 273 | `rehearsal.md` header; the screenshot facts (first post ids, "0 of 10 shared") are from the coordinator's message |

**Notes for the author**
1. **What I could not run.** The integration tests and the parity test need Docker, so their counts come from the files and from the records (above). The text says "counts of 2026-11-22".
2. **Test-case IDs.** `TC-01` to `TC-12` are only for Chapter 8, with the real file and test name in each row. Test files have their own labels (the parity file calls itself "TC15"), so the IDs are not the same on purpose.
3. **Figures 8.2 and 8.4** show the same first posts; the text says so (Engagement ranks the For You pool with the Explore score). The text says that Figures 8.1 to 8.3 show that the three orders differ, and "does not show that Social is better", with a pointer to Chapters 6 and 7. The second user in the screenshots was played by `peer.mjs`; the text says so in one sentence.
4. **Table 8.1, last two rows.** The sweep row says "24 pages pass, 4 fail" on purpose: it is the record of 2026-11-20. Two of the four (V1) are fixed since; two (T6) are still open. This is honest, but you may prefer to show only the final state.
5. **Appendix A layout.** The four tables use `\scriptsize` to keep Appendix A at 5 pages, because Appendix B must fit in the same page budget (about 10 pages for the whole appendix). Suites with 5 tests or fewer list their tests (23 suites); the others have one line of description that I wrote from the test names and the `describe` blocks.
6. **Chapter 6 section number.** The text reads "Section 6.12" for E7 by `\ref{sec:results-e7}`; it follows the chapter if the order changes.
7. **No reference is needed**, so `references.tex` is untouched. Chapter 9 has no label, so the text says "Chapter 9" in plain words (the 8 future-work items of section 8.3 should be in it).
8. **The first row of Table 8.1** sits alone at the bottom of page 61 (a `longtable` break). If you want it on the next page, add `\newpage` before the table in the final layout pass.

**Checked by Opus (2026-11-22).** Own full build in a separate folder: exit 0, no error, no undefined reference, 89 PDF pages. Page 67 rendered: Figures 17 and 18 (Social, Explore) show the real screenshots. The bug numbers (48 found, 34 fixed, 14 open) agree with the Bugs Report §1 (36 + R1–R7 + V1–V5; 34 resolved; 14 open). The eight screenshots were taken by Opus on 2026-11-22 from `npm run demo:start` (rebase time 2026-11-22T09:02:45Z), with `peer.mjs` as the second user, and saved as PNG (1440×727) in `images/`.
