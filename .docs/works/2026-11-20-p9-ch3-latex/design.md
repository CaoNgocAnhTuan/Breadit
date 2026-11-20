# Chapter 3 Methodology in LaTeX

Type: writing (light path, no plan) · 2026-11-20 · Folder: `.docs/works/2026-11-20-p9-ch3-latex/`
Row: `.docs/implementation-plan.md` §5 row 15 (P9)

## 1. Spec

### Problem

The Chapter 3 draft is written (`.docs/Thesis-Report/drafts/03-methodology.md`, 145 lines), but `chapters/methodology.tex` is still an empty stub. The reference list `chapters/references.tex` is empty too, and the thesis has no way yet to cite a reference by name. The progress check on 2026-11-30 needs Chapters 3 to 7 in PDF.

### Scope

**In scope:**
- `chapters/methodology.tex`: the draft's Sections 3.1–3.9 in LaTeX. The content stays the same as the draft; only the form changes. The draft box at the top and the "Notes for the author" at the end are left out.
- Formulas as `equation`/`align` (amsmath), with variables in math (`n_{uf}`, `N_u`, `F_u`, `M_u`, `\alpha`, `\beta`). The indicator `[...]` becomes `\mathbb{1}[\,\cdot\,]`.
- The two tables (3.3 methods, 3.4 worlds) as `table` floats with booktabs, a caption and a label.
- Citations by key. A macro `\refcite{key}` in the "Thesis additions" block of `main.tex` prints `[n]`, where n is the item's number in the list. `references.tex` gets the numbered `enumerate` list of the school format with `\item\label{ref:<key>}` for each reference Chapter 3 cites, in order of first citation, using the entries of super-plan §10: 28, 29, 5, 7, 11, 12, 25, 20, 49, 13, 14, 15, 16, 17, 18, 21, 22, 27. All of them are marked "verified" there.
- A `\label` for the chapter's sections (`sec:method-...`), so later chapters can point to them.
- A build of the PDF and a page count of Chapter 3.

**Out of scope:**
- Changing what the draft says (the author reviews the content in the PDF). Fixing a LaTeX-only problem, such as a long line or a table that is too wide, is allowed.
- [50] Hogg and Lerman: "search only" in super-plan §10, so it is not cited.
- Macros for the frozen settings (m, grids, T, seed, world parameters, Digg sizes). They stay typed, as the draft says; `p10-final-checks` decides.
- Other chapters, `main.tex` outside the one macro, `docs/Pre-thesis/`.

### Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | `latexmk -pdf main.tex` in `.docs/Thesis-Report/` | builds; the log has no undefined reference or citation from Chapter 3, and no error |
| DW2 | Chapter 3 in the PDF | Sections 3.1–3.9, two tables, the formulas of 3.2, every `\refcite` shows a number |
| DW3 | page count of Chapter 3 | 10–14 pages (budget 12, `drafts/Report Architecture.md`) |
| DW4 | `references.tex` | the 18 items above, each one "verified" in super-plan §10, in the school's numbered style |
| DW5 | no result number typed | Chapter 3 has no result numbers (only frozen settings and dataset sizes, as in the draft) |

### Open questions

1. Order of the final reference list: here it is the order of first citation in Chapter 3. Chapters 1 and 2 come first in the PDF, so the numbers change when they cite; `\ref` renumbers by itself, but `p10-final-checks` should put the list in order of first appearance.

## 2. Impact

Thesis link: P9, Chapter 3. No code, no test, no frozen value, no reported number changes. The `\refcite` macro and the reference list are used by every later chapter. Docs to update when done: implementation-plan §5 row 15 (✅). No `docs/System_Architecture.md` or Guidance Manual change, because the architecture, feed, ranking, data and evaluation do not change.

## Result

Closed 2026-11-20. Files: `chapters/methodology.tex`, `chapters/references.tex` (18 items), `main.tex` (the `\refcite` macro only).

| # | Result |
|---|---|
| DW1 | ✅ builds; no error, no undefined reference or citation, no overfull hbox from Chapter 3 |
| DW2 | ✅ Sections 3.1–3.9 (`sec:method-design` … `sec:method-cost`), Tables 1 and 2, Equations 3.1–3.5, all 18 `\refcite` show a number |
| DW3 | ❌ **6 pages** (arabic pages 3–8), not 10–14. Nothing is missing from the draft: the budget of 12 was too high for this text. The author decides: keep 6, or add content |
| DW4 | ✅ the 18 items, all "verified" in super-plan §10, numbered list with `ref=\arabic*` so `\ref` prints `1`, not `1.` |
| DW5 | ✅ no result number; frozen settings and Digg sizes typed, as in the draft |

Changes from the draft (form only): the indicator is `\mathbf{1}[\cdot]` (`\mathbb{1}` prints a wrong glyph with amssymb); the engager sum's words became its subscript; two table captions and two sentences that point to the tables were added. For the author: the draft never says that the indicator is 1 when the condition holds and 0 otherwise; T is both the HN post age (BL5) and the cut time (3.5); "H" is both the hybrid score and the hypothesis prefix (H0–H2).
