# Report architecture

Decided by the author on 2026-11-19. The thesis is written in `.docs/Thesis-Report/` (the school's LaTeX format). Page limit: at most 120 pages; target 80–100.

## Chapters and page budget

| # | Chapter | Pages | Main content | Draft | LaTeX |
|---|---|---|---|---|---|
| — | Front matter (title, approval, acknowledgements, contents, lists, abstract) | ~8 | | `00-abstract.md` | `main.tex`, `chapters/abstract.tex` |
| 1 | Introduction | 5 | Background, problem, RQ1 and RQ2, contributions C1–C3, what the title means | `01-introduction.md` | `chapters/introduction.tex` |
| 2 | Literature Review | 10 | Social recommendation, feed ranking heuristics, offline evaluation | `02-literature-review.md` | `chapters/literature-review.tex` |
| 3 | Methodology | 12 | The hybrid score, the baselines, the data, the protocol, the metrics, the statistics | `03-methodology.md` | `chapters/methodology.tex` |
| 4 | System Analysis and Design | 14 | Requirements, use cases, activity, sequence, architecture, database (ERD) | `04-system-analysis-and-design.md` | `chapters/system-analysis-and-design.tex` |
| 5 | Implementation | 10 | Tech stack, the built architecture, the real-time layer, `packages/ranking`, `eval/`, the repro command | `05-implementation.md` | `chapters/implementation.tex` |
| 6 | Experiments and Results | 13 | Tuning, H0 gate, E1–E8: tables and three figures (E2, E3, E5) | `06-experiments-and-results.md` | `chapters/experiments-and-results.tex` |
| 7 | Discussion | 7 | RQ1 and RQ2 answered, what the hybrid uses, what it means for Breadit, limits | `07-discussion.md` | `chapters/discussion.tex` |
| 8 | Test Cases and Demonstration | 9 | One summary table of the test levels; the demo (about 8 screenshots) | `08-test-cases-and-demonstration.md` | `chapters/test-cases-and-demonstration.tex` |
| 9 | Conclusion and Future Works | 3 | Answers, contributions, future work (super-plan §9) | `09-conclusion-and-future-works.md` | `chapters/conclusion.tex` |
| — | References | 4 | Only references marked "verified" in super-plan §10 | | `chapters/references.tex` |
| | **Total** | **~95** | | | |
| — | Appendix (after the limit is checked) | ≤ 10 | Full test list, full tables | `10-appendix.md` | `chapters/appendix.tex` |

Open: does the appendix count toward the 120 pages? Ask the school.

## Rules

- **Numbers:** macros only (`\resultsdir/results-macros.tex`), never typed. Tables: `\input{\resultsdir/tables/<id>.tex}`. Figures: pgfplots reading the CSVs of `\resultsdir`.
- **No repetition:** Chapter 3 defines; Chapter 6 cites. Chapter 4 designs; Chapter 5 describes what was built. Chapter 8 summarizes the tests; the full list goes in the appendix.
- **Diagrams:** only the main flows, one tool and one style, each one used by a sentence in the text.
- **Pre-thesis material** (`docs/Pre-thesis/`) is reused only after a check against the current code; the pre-thesis report was 172 pages, so it is cut hard.

## Workflow per chapter

1. Claude writes the Markdown draft in `drafts/`.
2. The author reviews the content.
3. Claude moves it to `chapters/*.tex` (macros, tables, figures, `\cite` or the numbered reference list).
4. `latexmk -pdf main.tex` in `.docs/Thesis-Report/`, then a page count against the budget.
