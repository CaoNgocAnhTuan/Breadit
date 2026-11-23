# Plan: Overlap check: compare only the quotes of the extracts

Status: done · 2026-11-23
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-23-p10-overlap-quotes-only/`

Code under `scripts/thesis-check/` only, then one sentence of Chapter 2 and its draft, then `CLAUDE.md`. No Docker. Node 22 (`nvm use`) and `latexmk` are on this machine. The extracts and `docs/Pre-thesis/` are read, never written. All commits go on `test-app` and are never pushed. Approving this plan approves the commits below.

## Steps

- [x] 1. **Keep the old output.** Run `npm run thesis:check -- --no-build` once and keep its output in a temporary file outside the repo, for the comparison in step 4. (Design: Failure modes F4.)

- [x] 2. **Tests first.** In `scripts/thesis-check/lib.test.mjs`, write TC1–TC5 below. Run the tests and see the new ones fail for the right reason (`quotePieces` and `sourcePieces` not exported, `md-quotes` not handled). (Design: Code files, `lib.test.mjs`.)

- [x] 3. **Code.** In `scripts/thesis-check/lib.mjs`: `quotePieces`, `sourcePieces`, and `checkOverlap` looping over the pieces of each source, keeping the best match per file and counting files in "n more files"; the summary says "(quotes only)" for the `md-quotes` sources. In `check.mjs`, the extract sources use `kind: 'md-quotes'`. Nothing else changes. Run all tests of `scripts/thesis-check/` until they pass. Commit steps 2–3. (Design: Approach; Code files, `lib.mjs`, `check.mjs`.) Commit: `feat(thesis-check): the overlap check reads only the quotes of the extracts`

- [x] 4. **Run it before the text fix.** Run `npm run thesis:check -- --no-build` and compare with step 1: check 4 has 1 extract match (Chapter 2 line 26, `extracts/02.md:9`, FAIL) instead of 8, pre-thesis still 0; checks 1, 2, 3 and 5 give the same lines as before. Write the two summaries into a new file `run.txt` in the task folder. (Design: Approach; DW3.)

- [x] 5. **Chapter 2, line 26.** Put the SoRec words in ``…'' in `.docs/Thesis-Report/chapters/literature-review.tex` line 26 and in `"…"` in `drafts/02-literature-review.md` line 17, exactly as the Design says. Run the full command (with the build): check 4 lists the match as INFO, the command exits 0, the page count is still 97 with no new warning. Run it a second time and compare the two outputs byte for byte (DW4). Add the final output to `run.txt`. (Design: Approach, "Chapter 2, line 26"; Failure modes F5.)

- [x] 6. **Docs.** `CLAUDE.md` Commands, the `thesis:check` paragraph: check 4 compares with the quoted parts of the P1 extracts only (a quote must open and close on one line). Commit steps 4–6. (Design: Code files, `CLAUDE.md`.) Commit: `docs: Chapter 2 quotes the SoRec abstract; thesis:check reads only quotes of the extracts`

- [x] 7. **Acceptance and close (Opus).** Do the Acceptance items. Fill the Result. Commit: `docs: p10-overlap-quotes-only close`

## Tests

All are unit tests of `scripts/thesis-check/lib.mjs` with `node:test`, on small made-up inputs.

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW1, F1, F3 | unit | `quotePieces`: two quotes on one line give two pieces with that line; a quote on line 3 has line 3; a line with an unclosed quote gives no piece for it; a text with no quote gives none |
| TC2 | DW1 | unit | `checkOverlap` with an `md-quotes` source: 8 shared words in the note text (outside quotes) → no finding; 8 shared words inside one quote → FAIL with the source's real line |
| TC3 | DW1 | unit | 8 shared words split over two quotes on the same line (4 + 4), or over a quote and the note text next to it → no finding |
| TC4 | DW1 | unit | an `md-quotes` match whose thesis words are inside ``…'' with a `\refcite` within 200 characters → INFO |
| TC5 | DW2, F4 | unit | "n more files" counts two files that both quote the run as 1 more file, and two quotes in the same file as 0 more files; the `tex` and `md` cases of the existing tests still pass unchanged |

## Acceptance

Claude does these after step 6.

- [x] A1 (DW1, DW2). The tests of `scripts/thesis-check/` → all pass, the old ones and the new ones.
- [x] A2 (DW3). `run.txt` → before the text fix, check 4 has 1 extract match (line 26, FAIL), 0 from note lines and 0 pre-thesis; after it, the match is INFO and the command exits 0.
- [x] A3 (DW4). Two runs → the same output byte for byte.
- [x] A4 (DW5). `verify.sh` → all checks pass.
- [x] A5. The PDF → 97 pages, no new warning; Chapter 2 shows the SoRec words in quotation marks. `git status` → no change under `docs/Pre-thesis/` or the extracts.

## Result
Done 2026-11-23. Delivered: check 4 of `npm run thesis:check` compares the thesis with the quoted parts of the P1 extracts only (`quotePieces`, `sourcePieces`, kind `md-quotes`), each quote on its own; Chapter 2 line 26 puts the SoRec words in quotation marks (chapter and draft).

**Tests.** `scripts/thesis-check/`: 48 → 56 tests, all pass; the new ones (except the unchanged INFO rule, TC4) failed first. `verify.sh`: all 9 checks PASS.

**Acceptance.** A1–A5 PASS.
- A2: before the change check 4 had 8 extract matches (8 FAIL); after the code change 1 (Chapter 2 line 26, FAIL); after the text fix 1 INFO ("quotation with citation"); pre-thesis 0 throughout. Checks 1, 2, 3 and 5 gave the same lines as before.
- A3: two full runs by Opus, byte-identical; exit 0, `7 PASS, 0 WARN, 0 FAIL`.
- A5: 97 pages, the same warnings as before; no change under `docs/Pre-thesis/` or the P1 extracts.

**Commits.** `5397236` feat(thesis-check): the overlap check reads only the quotes of the extracts · `81039ae` docs: Chapter 2 quotes the SoRec abstract; thesis:check reads only quotes of the extracts · the closing commit.

**Different from the plan.** The `--no-build` run of step 4 was done before the first commit (no file changes). The new tests are named "quotes-only TC1–TC5" so they do not clash with the old TC1–TC10.

**Docs updated.** `CLAUDE.md` (the `thesis:check` paragraph). The triage of `p10-final-checks` stays as its record.
