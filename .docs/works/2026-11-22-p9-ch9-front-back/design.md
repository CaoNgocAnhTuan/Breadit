# Chapter 9, abstract, acknowledgements and Appendix B: first draft

Type: writing (light path, no plan) · 2026-11-22 · Folder: `.docs/works/2026-11-22-p9-ch9-front-back/`
Row: `.docs/implementation-plan.md` §5 row 27 (P9). The author decided on 2026-11-22 to draft it now and add the supervisor's feedback after the progress check on 2026-11-30.

## 1. Spec

### Problem

`chapters/conclusion.tex`, `abstract.tex`, `acknowledgement.tex` are empty, and the appendix has only Appendix A (full test list, row 23). Row 27 is planned after the progress check, but a first draft now leaves only the feedback for later.

### Scope

**In scope:**
- **Chapter 9 Conclusion and Future Works** (3 pages): `drafts/09-conclusion-and-future-works.md` and `chapters/conclusion.tex`. The answers to RQ1 and RQ2 (from Chapter 7, in fewer words, macros only), the contributions C1–C3 as delivered, the corrected LightFM sentence (Bugs Report §7; super-plan chapter map), limitations in one paragraph (pointer to Chapter 7), and future work from super-plan §9 and the implementation-plan note of what stays future work (the schema migration T6, N3, N10, R4; R5, N7, N9, B8; Hive).
- **Abstract** (one page, about 250–300 words): `drafts/00-abstract.md` and `chapters/abstract.tex`. Problem, method, data, the main result through macros (H1 on both datasets exactly as Chapter 6 states it), the system, and the conclusion. It must say the same as Chapter 6 (the pre-thesis abstract disagreed with its chapter 5; this must not happen again).
- **Acknowledgements**: `chapters/acknowledgement.tex`, a short neutral draft with `[Supervisor name]` and similar placeholders for the author to fill. Do not invent names.
- **Appendix B "Full result tables"**: in `drafts/10-appendix.md` and `chapters/appendix.tex`, after Appendix A (do not change Appendix A). The tables of `\resultsdir/tables/` that Chapter 6 does not show in full, each with `\input{\resultsdir/tables/<id>.tex}` and a one-line caption. Check the page limit: Appendix at most 10 pages.
- A box at the top of each draft: "First draft 2026-11-22, before the supervisor's feedback."

**Out of scope:** Chapters 1–8, `main.tex`, `references.tex` (list any needed reference in Result), code, git commits, the supervisor's feedback (after 2026-11-30).

### Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | `latexmk -pdf` of `main.tex`, built into the scratch folder given in the prompt | builds with no error; no undefined reference from these parts |
| DW2 | no typed result number | none; every number is a macro |
| DW3 | the abstract against Chapter 6 | every claim of the abstract matches a sentence or table of Chapter 6 (list the pairs in Result) |
| DW4 | page counts | Chapter 9: 2–4 pages; abstract: 1 page; Appendix A + B: at most 10 pages |

## 2. Impact

P9, the front matter, Chapter 9 and Appendix B. No code change. After 2026-11-30 a follow-up adds the supervisor's feedback.

## Result

First draft by a Sonnet agent, 2026-11-22. Opus checks and commits. Build: `latexmk -pdf -interaction=nonstopmode -outdir=<scratch>/build-ch9 main.tex` from `.docs/Thesis-Report/`, 96 pages in all (the build before this task had 89).

### Files changed

- `.docs/Thesis-Report/chapters/abstract.tex`, `conclusion.tex`, `acknowledgement.tex`, `appendix.tex` (Appendix B added after Appendix A; Appendix A is unchanged, only the first comment lines of the file name Appendix B).
- `.docs/Thesis-Report/drafts/00-abstract.md`, `09-conclusion-and-future-works.md`, `10-appendix.md` (Appendix B added after Appendix A; the box at the top and notes 1, 5 and 6 at the end say so).
- This file (Result section).

Nothing else was edited. No git command that writes was run. No new reference: Chapter 9 cites `ma2008` and `wu2019`, which are already in `references.tex`.

### Done when

| # | Result | Evidence |
|---|---|---|
| DW1 | Pass. The build exits with 0, the log has no `!` error, no undefined reference or citation, no `multiply defined`. The only warnings are old ones: one overfull box inside `references.tex` and one hyperref bookmark warning at the start of the appendix. | `build-ch9/main.log` |
| DW2 | Pass. Every result number is a macro of `results-macros.tex`. The only typed numbers are names and settings: the history group 0--4, the K values 5, 10, 20, the interval level 95%, the comparisons of family F1 (15, from Chapter 3), "2 hops", the bug IDs and the counts of list items ("8 open items", "six more items"), and the HTTP codes 200 and 404 in item N7. I replaced one typed "0" (Digg gain by followees) by a macro. | grep of the four `.tex` files |
| DW3 | Pass. The pairs are in the next table. | below |
| DW4 | Pass. Chapter 9: 3 pages (pages 70 to 72; the last page has about 3 free lines). Abstract: 1 page (page xi), about 300 words with each number counted as one word. Appendix A + B: 9 pages (pages 77 to 85: A is 5 pages, B is 4). Acknowledgements: 1 page (iii). | `main.toc`, page images |

### DW3: the abstract against Chapter 6 (and 1, 3, 5, 7 for the parts Chapter 6 does not state)

| Abstract claim | Supported by |
|---|---|
| H1 failed on both data sets | 6.6 (E2) "H1 fails on `syn-W2M-M`" and "H1 fails on `digg2009`"; the summary table of 6.13, row H1 |
| For users with 0--4 earlier interactions, gain in NDCG@10 over BL2 is `\eTwoWTwoMNdcgTenZeroFourGain` on the synthetic data, 95% interval `...CiLow` to `...CiHigh`, Holm-adjusted p `...PHolm` | 6.6, paragraph "`syn-W2M-M`": the same five macros |
| ... and `\eTwoDiggNdcgTenZeroFourGainFull` on Digg 2009, Holm-adjusted p `\eTwoDiggNdcgTenZeroFourPHolm` | 6.6, paragraph "`digg2009`": the same two macros |
| The gain does not grow with the number of followees, so RQ2 finds no threshold | 6.7 (E3) "the gain does not rise with the number of followees ... H2 is not supported"; the summary table of 6.13, row H2 |
| Over all synthetic users the hybrid is better (NDCG@10 `\eOneWTwoMNdcgHTenAllValue` against `\eOneWTwoMNdcgBLTwoTenAllValue`) | 6.5 (E1), first paragraph: the same two macros; Table 6.3 |
| Almost all of this gain comes from the community term | 6.8 (E4), "almost all of the gain comes from the community term" (H-comm and H-follow rows of Table 6.6) |
| ... which acts as a topic signal | 6.1 ("in the generator a community is a topic, so this term carries topic interest"); 7.3 |
| On Digg the social terms change almost nothing | 6.5 (E1): H and BL2 have the same NDCG@10 on Digg; 6.8: every variant gains `\eFourDiggNdcgHTenAllGain` |
| The "hot" formulas of Reddit and Hacker News are far better (`\eOneDiggNdcgBLFourTenAllValue` and `\eOneDiggNdcgBLFiveTenAllValue`) | 6.5 (E1), second paragraph: the same two macros |
| The sanity check on a null world passed | 6.4 (H0 gate) "The gate passes"; the summary table of 6.13, row H0 |
| Hypotheses and settings were frozen before the test split | 6.1 "Order of work" (choices frozen, then the test split run once); Chapter 1, Section 1.4 and Chapter 3, Section 3.1 for the hypotheses |
| Tested offline with an as-of time rule, tuned baselines, Holm-corrected paired statistics, on a seeded synthetic generator and the real Digg 2009 data | 6.1 "Datasets" and "Statistics"; Chapter 3, Sections 3.4 to 3.7 |
| One ranking package serves the live feed and the evaluation; one command rebuilds every result and compares file hashes | 6.2, last paragraph (parity test); 6.1 "Reproducibility" (`npm run thesis:repro`, merged manifest); Chapter 5 |
| The hybrid feed stays in the app as an option, and the default For You feed keeps its order | 6.13, last paragraph ("H1 failed, so For You stays as it is today"); Chapter 7, Section 7.4 |
| Breadit joins following with communities; For You is newest first; RQ1 and RQ2; notifications and messages over Socket.IO | Chapter 1, Sections 1.1 to 1.4 and 1.3 (Chapter 6 does not state these) |
| A prior gives every user a score; engagement score of Explore plus follow-trust plus community-affinity | Chapter 3, Section 3.2 (Chapter 6 does not state it) |

### Deviation from the Spec: Appendix B

The Spec says Appendix B holds "the tables of `\resultsdir/tables/` that Chapter 6 does not show in full". Chapter 6 already `\input`s all ten (`tuning`, `leftout`, `e1` to `e8`), each in full, so no table was left. Repeating them would break the "no repetition" rule, so I did this instead:

- Appendix B shows what Chapter 6 describes but never tables: **family F1 at all three K** (Chapter 6 shows K = 10 only) and **family F2** (H against the seven other baselines; Chapter 6 names F2 and gives no result). Four tables: F1 and F2 for each dataset, 15 + 15 + 84 + 84 rows, with the gain, the 95% interval, the raw and the Holm p.
- The rows are read at build time from `.docs/results/p7-main/compare.csv` (a Class D file, with its SHA-256 in the manifest of `p7-main`). A small loop in `appendix.tex` does it with the table reader of pgfplots. I could not use `\usepackage{pgfplotstable}` (preamble only, and `main.tex` is not mine to edit). So the tables do not come from `\resultsdir/tables/` and no number is a macro, but no number is typed either. Chapter 6 already reads `\resultsdir/fig-*.csv` in the same way.
- Better later: add these four tables to the report script, so that they are in `\resultsdir/tables/` with a hash in `.docs/results/p7-report/manifest.json`. Then `appendix.tex` only needs four `\input` lines. This is a code change, so it is not part of this task.

### Notes for the author

1. **Two rows of Appendix B that a reader may ask about.** On `digg2009`, family F1 at K = 20 has two rows where both H1 conditions hold (group 0 and group 0--4, gains of a few ten-thousandths of NDCG, Holm p below 0.05). H1 is decided at K = 10 and group 0--4 only (Chapter 3), and the text of Appendix B says so. Chapter 6 does not mention them. Consider one sentence in Chapter 6 or 7.
2. **Acknowledgements.** All names are red placeholders in square brackets (`\placeholder{...}`). Remove the colour and fill them before the final version. `main.tex` names the supervisor on the approval page. The school may ask for a statement about the use of writing tools; I did not add one.
3. **The LightFM sentence** says plainly that the pre-thesis report was wrong and that Breadit has no learned model (question 4 of the supervisor note). If the supervisor prefers not to name the old report, cut the first sentence of Section 9.4.3.
4. **Chapter 9 is a draft for the supervisor.** The future work follows the Spec: the 8 items of Chapter 8, Section 8.3 (T6, N3, N10, R4 schema part; R5, N7, N9, B8), the six "before a shared server" items, Hive, and the ranking items that Chapters 1, 2, 3 and 7 promise (size L, friend engagement, the scale reading of Digg, *m*, the Explore time decay, 2 hops, fading trust, learned social baselines, a pilot and an A/B test). Chapter 9 has the label `ch:concl`.
5. **Table of contents.** It is one page longer (Chapter 9 now has sections and three subsections). Front matter is 11 pages (was 10).
6. **Chapter 6 still shows red `[MACRO?]` marks** (the number of users in the E3 bin 1--4, and the largest E6 change). They are not from this task and I did not touch them. Chapter 9 uses neither number.
7. **After 2026-11-30.** Chapter 9 has about 3 free lines on its last page, so added feedback may make it 4 pages, which the budget allows. Appendix A + B has 1 page of room.

**Checked by Opus (2026-11-22).** Own full build: exit 0, no error, no undefined reference, 96 PDF pages (front matter to p. xi, Chapters 1–9 pp. 1–72, References p. 73, Appendix pp. 77–85). The abstract was read: every result is a macro of Section 6.6 or of Table E1. Appendix B reads `.docs/results/p7-main/compare.csv` at build time (the numbers come from a CSV with a manifest hash, not from `results-macros.tex`); moving these four tables into the report script is left for `p10-final-checks` or a later task. The Digg rows at K = 20 noted by the writer are for the author.
