# Chapters 6 and 7 in LaTeX

Type: writing (light path, no plan) · 2026-11-20 · Folder: `.docs/works/2026-11-20-p9-ch6-7-latex/`
Row: `.docs/implementation-plan.md` §5 row 17 (P9 ★)

## 1. Spec

### Problem

The drafts of Chapter 6 (`drafts/06-experiments-and-results.md`) and Chapter 7 (`drafts/07-discussion.md`) are written, but `chapters/experiments-and-results.tex` and `chapters/discussion.tex` are empty stubs. The progress check on 2026-11-30 needs them in PDF.

### Scope

**In scope:**
- Both chapters in LaTeX, same content as the drafts, without the draft boxes and the author notes.
- Every result number as a macro of `\resultsdir/results-macros.tex`; never a typed number.
- The ten tables with `\input{\resultsdir/tables/<id>.tex}` inside a `table` float with caption and label.
- Three figures in pgfplots from the CSVs: E2 (`fig-e2-history.csv`, gain by history group), E3 (`fig-e3-density.csv`, gain by social density), E5 (`fig-e5-worlds.csv`, gain by world). Each shows `mean_diff` with its interval (`ci_low`, `ci_high`) and a line at 0.
- A `[MACRO?: …]` mark of the drafts (8 in Chapter 6, 2 in Chapter 7) becomes a visible red mark `\macromissing{…}`, never a typed number.
- Citations with `\refcite{key}` (macro from the Chapter 3 task); new references are listed for Opus to add to `references.tex`.

**Out of scope:** new macros (that is code in `eval/`), other chapters, `main.tex`, `references.tex`, changing what the drafts say.

### Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | `latexmk -pdf` of `main.tex` | builds with no error; no undefined reference from Chapters 6–7 except new reference keys listed in Result |
| DW2 | no typed result number in the two `.tex` files | every result value is a macro or `\macromissing` |
| DW3 | PDF | ten tables and three figures appear, each cited in the text |
| DW4 | page count | Chapter 6 about 13 pages, Chapter 7 about 7 (`drafts/Report Architecture.md`) |

## 2. Impact

P9, Chapters 6 and 7. No code, no frozen value, no reported number changes. The missing macros go to a later code task.

## Result

Closed 2026-11-20. Files: `chapters/experiments-and-results.tex`, `chapters/discussion.tex`; `chapters/references.tex` got two items (§10 #23 `anagnostopoulos2008` and #24 `chaney2018`, both "verified").

| # | Result |
|---|---|
| DW1 | ✅ builds; no error; the two new keys are now in `references.tex` |
| DW2 | ✅ 89 macros, each checked to exist in `results-macros.tex`; no typed result number |
| DW3 | ✅ ten result tables plus the 6.13 summary as a float (11), and Figures E2, E3, E5 in pgfplots, each cited in the text |
| DW4 | ⚠️ under budget: Chapter 6 is 10 pages (budget 13), Chapter 7 is 4 (budget 7). Nothing is missing from the drafts |

Only **2 `\macromissing`** are left, not 10: `results-macros.tex` grew after the drafts were written. They are in 6.7 (the number of users in bin 1–4 of E3, one per synthetic world) and in 6.10 (the largest NDCG@10 change in E6). Both need a macro from `npm run report` (a code task).

For the author:
- **The E1 table is too wide** (782 pt against 441 pt), so it is scaled to about 56% (about 6 pt font). The fix is in the report script (shorter headers, or two tables).
- In E3, bin 1–4 of the synthetic panel has n = 1, so it has no mark; the caption says so.
- The text still names the super-plan (6.1 "change log, version 0.25"; 7.5 "super-plan §8") and repo paths such as `.docs/results/manifest.json`. The thesis has no super-plan, so these need new words.
- Chapter 7 cites Chaney 2018 in 7.5; check that sentence against its abstract (draft note).
- Draft file pointers ("(`e1.tex`)") were left out; one sentence each in 6.6 and 6.9 now cites Figures E2 and E5.
