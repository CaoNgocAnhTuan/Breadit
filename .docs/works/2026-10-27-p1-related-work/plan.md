# Plan: P1 Step 5: related-work survey for Chapter 2

Status: approved · 2026-10-27
Design: [design.md](design.md) · Folder: `.docs/works/2026-10-27-p1-related-work/`

---

## How to read this plan

- This task has no app code. Docker, the backend and the database are not used. It needs `python3` (standard library only), `git` and `shasum`. Run every command from the repo root.
- **Who does what.** Sonnet does Steps 1 to 6. Claude does the checks and the super-plan edit that follow (see "Claude's part" and Acceptance). Sonnet does not touch `.docs/super-plan.md`.
- **Rules from the design that apply to every step.**
  - Use only the entries of `.docs/literature.md` named in the outline (Design: Approach, step 3). No outside facts, no new search, no memory. A sentence with no `[n]` must be about C2 or our design and must say so ("C2", "our design").
  - The ceiling rule (Design: Approach, step 1): full text may give the method and numbers that `literature.md` records for that paper. Abstract only: authors, year, aim and method, with "the abstract says", no number except a year, no result, no judgment. Index record: the name only.
  - Wording that is fixed:
    - `[5]` is "in the spirit of RealGraph", never "the same as RealGraph".
    - The model of `[3]` is called DiffNet, and the paper title is "A Neural Influence Diffusion Model for Social Recommendation".
    - The gap sentence (3.4) must contain the date `2026-10-24`, the word "abstracts" and the words "not proof" (claim 10).
    - No "no one", "nobody", "first", "never", "novel", "unique".
  - Short sentences, simple words, none over 35 words (CLAUDE.md "How to write"). Names, numbers and frozen values exact.
  - Never copy text from `Latex/chapters/literature_review.tex`. Part 2.3 is one sentence and a pointer to the platform chapter.
  - Do not cite `[45]` to `[50]`. They belong to Chapter 3.
  - Do not change `literature.md`, `datasets.md`, `supervisor-note.md`, `design.md`, `Latex/`, `docs/` or `.docs/super-plan.md`.
- **Python.** Run scripts with `python3 -I`. Because `-I` removes the script folder from the import path, the test file loads `check_survey.py` by its path with `importlib.util.spec_from_file_location`. The tests make their fixtures in `tempfile` folders.
- **Commits** go on `test-app` and are never pushed. A step's commit holds its own files and this `plan.md` (the ticks). The first commit also adds the task folder (`design.md`, `plan.md`). End every commit message with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Approving this plan approves the commits listed.
- Effort scale: XS under 30 minutes, S under 2 hours, M half a day.

## Steps

#### Step 1: Tests for the checker, first (effort S)

- [x] Write `test_check_survey.py` in the task folder (Design: Code files). It holds TC1 to TC11 below, with short hand-written fixtures: a tiny `super-plan` §10 (five lines, with "verified", "search only" and "do not cite"), a tiny `literature.md` §1 table (with "full text", "abstract only" and "index record" rows), and survey texts with one planted fault each, plus one clean text.
- [x] Run it before `check_survey.py` exists. It must fail because the module is missing, not because of a typo in the test.
- [x] Commit: `docs: tests for the related-work survey checker` (also adds `design.md` and `plan.md`)

#### Step 2: The checker (effort S)

- [x] Write `check_survey.py` in the task folder (Design: Approach, step 4). Standard library only. `main(survey_path, superplan_path, literature_path)` and a command line with the same three paths. It prints PASS or FAIL for DW1, DW2, DW3 (machine half), DW4, DW6, DW7 and Refs, then these lists for the reviewer: sentences that cite an abstract-only or index-record paper, sentences with no `[n]` and no "C2" or "our design", the five longest sentences, and numbers not found. It reads three files and writes nothing.
- [x] Parse §10 by line: number, then the word after the first " · ". Parse the `literature.md` §1 table by its columns (Ref, Short name, Type, Verified, Read). A `[n]` that is not in the §1 table is a FAIL for DW3.
- [x] All of TC1 to TC11 pass. TC11 (the clean text) passes every check.
- [x] Commit: `docs: check_survey.py for the related-work survey`

#### Step 3: Draft parts 1 and 2 (effort M)

- [x] Create `.docs/related-work.md` with the title block (one line on what the file is, the date, "draft", and one sentence on what C2 is) and the headings of the layout (Design: Approach, step 2). Write parts 1 and 2 from paragraphs 1.1 to 1.5 and 2.1 to 2.5 of the outline, in order, inside the word budgets.
- [x] Run the checker. DW1 and Refs may fail now, because the text is not complete. DW2, DW3, DW4, DW6 and DW7 must pass for the text written so far. Fix the text, not the checker.
- [x] Commit: `docs: related-work survey, parts 1 and 2`

#### Step 4: Draft parts 3 and 4 (effort M)

- [x] Write parts 3 and 4 from paragraphs 3.1 to 3.4 and 4.1 to 4.5. For the five nearest works (`[33]`, `[31]`, `[32]`, `[39]`, `[40]`) copy the idea of the "How C2 differs" line of `literature.md` §7, in your own simple words, and keep the "the abstract says" form. Paragraphs 1.5, 2.5 and 4.5 are positions: they say what C2 does and mark it "our design".
- [x] Same checks as Step 3.
- [x] Commit: `docs: related-work survey, parts 3 and 4`

#### Step 5: Citation table and references (effort S)

- [x] Add `## Citation table` after part 4. One row per cited reference: `| Ref | Depth | What the survey says |`. The depth is copied from `literature.md` §1. Add `## References` after it, with the cited references only, each line copied from super-plan §10 up to the " · verified" part, numbers kept, in number order.
- [x] Run all checks. Every check must PASS now, including DW1 (1,500 to 2,200 words) and Refs. If the count is over 2,200, cut 3.3 first and then 2.3 (Design: F5).
- [x] Commit: `docs: related-work citation table and references`

#### Step 6: Self-review and report (effort XS)

- [ ] Read the lists the checker prints. For each sentence that cites an abstract-only paper, check by eye that it gives an aim or a method and no result. For each full-text paper, check one number against the entry of `literature.md`. Fix what you find, and commit as `docs: related-work fixes after the self-review` only if something changed.
- [ ] Stop. Report to Claude: the word count, the output of the checker, the commits, and anything in the outline you could not follow and why. Do not work around a step that cannot be done as written.

## Tests

All tests are in `test_check_survey.py` and run with `python3 -I -m unittest` (by file path). Level: script test on fixtures. The survey text itself is checked by the checker and by Acceptance.

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW1 | script | A body of 1,499 words fails, 1,500 and 2,200 pass, 2,201 fails. Words in the citation table and the references are not counted |
| TC2 | DW2 | script | A cited `[n]` marked "search only" or "do not cite" fails. A number missing from §10 fails. The form `[3, 4]` is read as two references |
| TC3 | DW3 | script | A sentence that cites an abstract-only paper and has a number (not a year) fails |
| TC4 | DW3 | script | A sentence that cites an abstract-only paper and has no "abstract" fails. A sentence that cites an index-record paper in a description (not a name list) is listed for the reviewer |
| TC5 | DW3 | script | A cited number that is not in the §1 table (for example `[47]`) fails. A citation table row with a depth different from §1 fails. A cited reference with no row fails |
| TC6 | DW4 | script | Each of "no one", "nobody", "first", "never", "novel", "unique" fails. A gap sentence without "2026-10-24" or without "not proof" fails. Whole words only: "firstly" or "worst" does not trigger |
| TC7 | DW6 | script | A number that is not in `literature.md` fails and is printed. A number with commas, a point or a percent sign is read as one number. A year is checked too |
| TC8 | DW7 | script | A sentence of 36 words fails and one of 35 passes. "e.g." and "[3]" do not split a sentence wrongly |
| TC9 | Refs | script | A reference line that differs from §10 fails. A missing reference for a cited number fails. A reference that is not cited is listed |
| TC10 | DW3 (F8) | script | A sentence with no `[n]` and no "C2" or "our design" is listed for the reviewer |
| TC11 | all | script | The clean fixture passes every check and prints no failure |

DW5 (parts and "how C2 differs" sentences) and DW8 (files changed) have no script test. They are Acceptance items.

## Claude's part (after Sonnet returns)

These are done by Claude, not by Sonnet. They are listed here so that the author approves the exact super-plan wording now.

**Closing edit of `.docs/super-plan.md`.** One commit: `docs: super-plan 0.10, P1 survey written, stale P4 text`. It changes only these places.

| Place | Now | New |
|---|---|---|
| Header | `Version 0.9 · 2026-10-27` | `Version 0.10 · 2026-10-27` |
| §1, H1, end of the paragraph | `The other two cells are reported as a sweep.` | the same sentence, then: `Digg 2009 (P4) is a second test of H1 on real data, with the same pass rule, if its pool at the cut time T keeps enough users with 0–4 earlier interactions (P2 checks this).` |
| P1 Step 4 | `plus the chosen public dataset if P4 works` | `plus Digg 2009 (P4, last in the cut order of §8)` |
| P8 | `runs the adapter (if P4 is in)` | `runs the Digg adapter (P4, unless the cut order of §8 dropped it)` |
| P1 status paragraph | `Steps 4 and 5 are not started.` | `Step 4 is written (the note is `.docs/supervisor-note.md`, with a Vietnamese copy at the end) and waits for the supervisor. Step 5 is written (`.docs/related-work.md`, task `p1-related-work`, 2026-10-27).` |
| Change log | after 0.9 | `0.10 · 2026-10-27 · P1 Step 5: the related-work survey is written (`.docs/related-work.md`). Stale P4 text fixed in P1 Step 4 and P8. H1 now names Digg 2009 as a second test. The primary cell of H1 is unchanged (§7).` |

**This differs from the Design on one point.** The Design (Approach, step 6) said H1 would name Digg as the primary test. But §7 has a frozen row, "Primary W2 cell for H1 = the middle cell (P3)", and the supervisor has not yet confirmed RQ1 and H1. So the plan only adds a sentence: Digg as a second test. The primary cell and §7 stay as they are. If the author wants Digg to be the primary test, that is a separate decision that changes §7, with its own change-log line, after the supervisor answers.

§5 and §7 are checked byte for byte (SHA-256 before and after). Nothing else in the file changes.

## Acceptance

Claude ticks these.

- [ ] DW1 to DW4, DW6, DW7: run `check_survey.py` again on the final file → every check PASS, and the word count is between 1,500 and 2,200
- [ ] DW3, the reading half: read every sentence that cites an abstract-only or index-record paper, and its entry in `literature.md` → each gives an aim or a method (or a name), no result, no judgment; `[21]`, `[23]`, `[28]`, `[22]` appear by name only or not at all
- [ ] DW5: check the four parts and, for `[5]`, `[7]`, `[33]`, `[31]`, `[32]`, one "how C2 differs" sentence each; check the D4 (1 hop) and D5 (baselines) arguments; check the gap sentence is hedged as claim 10 says → all present
- [ ] DW6 by hand: pick five numbers from the full-text parts (for example 84, 2,151, 0.5284, 0.7630, 89.5%) and find each in `literature.md` and in its entry's source section → all match
- [ ] F6: compare part 2.3 with the section "Web Curation and Social Feed Ranking Algorithms" of `Latex/chapters/literature_review.tex` → no copied text
- [ ] DW7: the author reads the survey → readable without a dictionary for most sentences (the author's comment is recorded in the Result)
- [ ] F10: the Result states that, for Chapter 2, abstract-only papers are cited at the level of aim and method, and that rule 75 of `literature.md` was not edited
- [ ] Closing edit: the table above is applied and the SHA-256 of super-plan §5 and §7 is the same before and after → byte-identical, and `git diff` shows only the six places
- [ ] DW8: `git diff --stat` from the commit before this task to the last commit → only `.docs/related-work.md`, files in the task folder, and `.docs/super-plan.md`
- [ ] `bash .claude/hooks/verify.sh --no-it` → passes (no code changed)

## Result

<!-- Claude fills this in at the end: what was done, test counts, commits, and anything that differed from the plan (and why). -->
