# Progress slides for the supervisor (2026-11-30)

Type: writing (light path, no plan) · 2026-11-22 · Folder: `.docs/works/2026-11-22-p10-progress-slides/`
Row: `.docs/implementation-plan.md` §5 row 26 (P10). Format chosen by the author on 2026-11-22: LaTeX Beamer.

## 1. Spec

### Problem

The supervisor checks progress on 2026-11-30 (Chapters 3 to 7 in PDF and the demo). There are no slides. The numbers on the slides must come from the same macros as the thesis, so they can never differ from it (the pre-thesis problem).

### Scope

**In scope:**
- A Beamer deck `.docs/Thesis-Report/slides/progress-2026-11-30.tex`, about 15–20 slides for a 15–20 minute talk, a plain readable theme (no logos of other organisations; the school logo `../images/IU.png` on the title slide is fine). It defines `\resultsdir` as `../../results/p7-report` and inputs `\resultsdir/results-macros.tex`, like `main.tex`. Every number is a macro; tables come from `\resultsdir/tables/` only if they fit a slide, else a smaller table built from macros; figures are pgfplots reading the CSVs of `\resultsdir` (the same data as Chapter 6's three figures: E2 by history group, E3 density, E5 worlds; reuse the pgfplots code of `chapters/experiments-and-results.tex`).
- Content: (1) title; (2) the problem and RQ1, RQ2, H1 (the super-plan words); (3) the system: architecture in one slide, real-time layer, the three `algo` feeds; (4) the hybrid score in one slide (the formula as in Chapter 3); (5) data and protocol (synthetic worlds, Digg 2009, temporal split, metrics, Holm); (6) results: the H0 gate, H1 on `syn-W2M-M` and `digg2009`, the three figures, E7 cost; (7) what it means (Chapter 7); (8) the demo plan (the checklist steps of `scripts/demo/CHECKLIST.md` in one slide, and two screenshots `../images/fig8-3-foryou-social.png` and `../images/fig8-5-direct-message.png` shown through a placeholder test like `\thesisdiagram` of `main.tex`, since they may not exist yet); (9) status: what is done (rows of `.docs/implementation-plan.md` §5), what is left, and questions for the supervisor (3 at most; take the open ones from `.docs/super-plan.md` "Open questions" and `drafts/Report Architecture.md`).
- A short speaker-notes file `slides/progress-2026-11-30-notes.md` (2–4 lines per slide, simple English).

**Out of scope:** the thesis chapters, `main.tex`, code, git commits, the defense slides (row 30).

### Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | `latexmk -pdf` of the deck, built into the scratch folder given in the prompt | builds with no error and no overfull box wider than 10 pt on any slide |
| DW2 | no typed result number | none; every result number is a macro (check by search) |
| DW3 | slide count | 15–20 frames |
| DW4 | missing screenshots | the deck still builds and shows a framed placeholder |

## 2. Impact

P10, the progress check on 2026-11-30. No code change. Row 30 (defense slides) may start from this deck.

## Result

Written by the Sonnet agent on 2026-11-22. Not committed (Opus checks and commits).

### Files made

- `.docs/Thesis-Report/slides/progress-2026-11-30.tex`: the Beamer deck (16:9, plain white theme, one dark blue, the school logo `../images/IU.png` on the title slide only). It defines `\resultsdir` as `../../results/p7-report` and inputs `results-macros.tex`.
- `.docs/Thesis-Report/slides/progress-2026-11-30-notes.md`: speaker notes, 2 to 3 lines per slide and a time plan.

Nothing else was changed. The build files are in the scratch folder only.

### Done when

| # | Result |
|---|---|
| DW1 | PASS. `latexmk -pdf` into the scratch folder: no error, no warning, and 0 overfull or underfull boxes in the log. I also looked at all 20 pages as images (Ghostscript, 110 dpi): no text runs out of a frame. |
| DW2 | PASS. The result numbers are all macros (67 uses of 59 different macros in the slides). A search for `[0-9]\.[0-9]{3}` in the body finds nothing. The only typed numbers are names and frozen settings of Chapter 3, as in Chapter 6: the product versions (Next.js 15, React 19, NestJS 10, PostgreSQL 16, Redis 7), the formula constants (2, 3, 0.25), `m = 5`, the 80% split, K = 5, 10, 20, 10,000 draws, the 95% interval, the Holm level 0.05, the history group 0--4, "20 or more", Redis database 3, "at most 120 pages". No `\macromissing` is used. |
| DW3 | PASS. 20 frames (`grep -c "begin{frame}"`), the upper end of 15 to 20. |
| DW4 | PASS. The macro `\slideshot` shows the PNG (or PDF) if it exists, else a framed box with the file name. I built a copy where `../images/` is not found: both boxes show, no error. With the real folder, both screenshots show (the other writer has saved `fig8-5-direct-message.png` since I started). |

### Slides

1. Title. 2. The problem, RQ1, RQ2 (super-plan words). 3. H1, H2, H0 (super-plan words for H1 and H2). 4. Architecture in one TikZ picture. 5. Real-time layer and the three `algo` feeds, parity test. 6. The hybrid score (formula as in Chapter 3). 7. Data (synthetic worlds, Digg 2009, test users). 8. Protocol and statistics (split, as-of, pool, metrics, baselines, Holm, H1 rule, default feed rule, repro). 9. H0 gate and E1 (a small table of the nine methods, built from macros). 10. H1 on `syn-W2M-M` and `digg2009` (table from macros). 11. Figure E2. 12. Figure E3 (H2). 13. Figure E5. 14. E7 cost (`tables/e7.tex`, scaled). 15. What it means (1): answers to RQ1 and RQ2, E4. 16. What it means (2): for Breadit, and the limits. 17. Demo plan (the seven steps of `scripts/demo/CHECKLIST.md`). 18. Two screenshots. 19. Status: done and left. 20. Three questions.

The three figures use the same pgfplots code and the same CSV files as Chapter 6 (only the size changed for a slide).

### Notes for the author

- **Questions (slide 20).** (1) Default feed rule (super-plan section 11, item 7): does the supervisor agree that "For You" stays as it is. (2) Thesis rules (section 11, item 2, and the open line in `Report Architecture.md`): 120 pages, does the appendix count, are the nine chapters the required ones. (3) Dates: I rewrote item 1 (it asks about 2026-11-20, which is past) as "when are the final submission and the defense". Change them if you want other questions.
- **Slide 19 (status) must be updated before 11-30.** It says Chapters 1, 2 and 8 are "in progress" and the Chapter 4 figures are still to draw. Change these lines when the rows close.
- **Slides 6 and 8 are dense.** If the talk runs long, drop the baselines line on slide 8 or the "Reproducible" line.
- **Parity test numbers are not on the slides.** The result (300 of 300) has no macro, so the slides only say that the test checks the live order against the harness order.
- **Tables.** E1 and E2 have too many columns for a slide, so slides 9 and 10 build smaller tables from macros. Slide 14 uses `tables/e7.tex` scaled to the slide width.
- **Screenshots (slide 18)** are small on a 16:9 slide (two side by side) and dark. They are a backup for the live demo.
- **Slide 5 and the notes** keep the claims to what Chapter 5 and `docs/System_Architecture.md` say. Slide 15 says the Digg reason (the social term is small next to the vote counts) is "our reading, not tested", as Chapter 7 does.
- **Time.** 20 slides, about 20 minutes. The notes file has a time plan (12 minutes of slides, 6 of demo).

**Checked by Opus (2026-11-22).** Own build into a separate folder: exit 0, no error, 0 overfull boxes. A search for typed decimals in the deck finds only TikZ coordinates and plot settings; the last bullet of slide 10 uses the `\eTwoWTwoMNdcgTenTwentyPlus…` macros. Slides 10 and 19 rendered and read. Slide 19 must be updated before 2026-11-30 (it says Chapters 1, 2 and 8 are in progress).
