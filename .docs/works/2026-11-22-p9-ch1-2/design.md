# Chapters 1 and 2: draft and LaTeX

Type: writing (light path, no plan) · 2026-11-22 · Folder: `.docs/works/2026-11-22-p9-ch1-2/`
Row: `.docs/implementation-plan.md` §5 row 24 (P9)

## 1. Spec

### Problem

Chapter 1 has only the section "What the title means" (`drafts/01-introduction.md`, written 2026-11-19, with two author notes). Chapter 2 has a title only (`drafts/02-literature-review.md`). Both `.tex` files are empty. `drafts/Report Architecture.md` gives Chapter 1 five pages (background, problem, RQ1 and RQ2, contributions C1–C3, what the title means) and Chapter 2 ten pages (social recommendation, feed ranking heuristics, offline evaluation; the platform architecture shorter). The super-plan chapter map (§4 P9) says what is reused from the pre-thesis and what is new.

### Scope

**In scope:**
- `drafts/01-introduction.md` completed: background, problem statement, RQ1 and RQ2 and the hypotheses as stated in `.docs/super-plan.md` (exact text of the RQs and of H1), contributions C1–C3 (`.docs/Thesis_Orientation.md` and the super-plan), the existing section "What the title means" kept as it is (apply its two author notes), and an outline of Chapters 2–9. Say plainly that H1 was tested and what Chapter 6 found, only through macros or a pointer to Chapter 6/7. The `social` feed is built and available as an option; the default stays as it is (author note 2).
- `drafts/02-literature-review.md` written: (a) social recommendation (trust and social matrix factorization, graph neural models, cold start); (b) feed ranking in practice (Reddit hot, Hacker News, Twitter/X RealGraph and the open-sourced algorithm, community signals); (c) offline evaluation of recommenders (temporal splits, leakage, sampled metrics, ties, significance tests, Holm, reproducibility); (d) a short part on real-time social platform architecture; (e) the gap this thesis fills, in one section that leads to Chapter 3. Sources: `.docs/related-work.md`, `.docs/literature.md`, the super-plan §10, and the pre-thesis report `docs/Pre-thesis/Latex/` (read only; reuse only after a check against the current code; cut hard).
- The two chapters in LaTeX in `chapters/introduction.tex` and `chapters/literature-review.tex`.
- References: cite **only** items marked "verified" in super-plan §10, with only the facts written there. Items marked "abstract only; do not cite a finding" may be cited for their topic, not for a result. Add new items to `chapters/references.tex` in the format of that file (`\item\label{ref:<key>}`, cite with `\refcite{<key>}`); do not reorder the existing items.

**Out of scope:** Chapters 3–9, the abstract, `main.tex`, code, git commits. No claim about a paper that §10 or `.docs/related-work.md` does not support. No PDF chasing (the author decided: the abstract is enough).

### Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | `latexmk -pdf` of `main.tex`, built into the scratch folder given in the prompt | builds with no error; no undefined reference from Chapters 1–2 |
| DW2 | no typed result number | none; a result is a macro of `\resultsdir/results-macros.tex` or a pointer to Chapter 6 |
| DW3 | page counts | Chapter 1: 4–6 pages; Chapter 2: 8–12 pages |
| DW4 | references | every `\refcite` key is an item of `references.tex`, and every new item is "verified" in super-plan §10 (list the new keys with their §10 number in Result) |
| DW5 | RQs and H1 | the same words as the super-plan |

## 2. Impact

P9, Chapters 1–2 and the reference list. No code change.

## Result

Written 2026-11-22 by the Sonnet writer. Not committed (Opus checks and commits).

**Files changed**
- `.docs/Thesis-Report/drafts/01-introduction.md` and `chapters/introduction.tex`
- `.docs/Thesis-Report/drafts/02-literature-review.md` and `chapters/literature-review.tex`
- `.docs/Thesis-Report/chapters/references.tex` (23 items added at the end; no existing item touched)
- this Result section

**Build.** `latexmk -pdf -interaction=nonstopmode -outdir=<scratchpad>/build-ch12 main.tex` from `.docs/Thesis-Report/`: exit 0, 0 undefined references or citations, no LaTeX error, no overfull box in Chapters 1–2. Page numbers are from `main.toc` of that build.

| # | Check | Result |
|---|---|---|
| DW1 | build, no undefined reference | Pass. Exit 0; `main.log` has no "undefined", no "multiply defined" and no error. |
| DW2 | no typed result number | Pass. The only results in Chapter 1 are seven macros in Section 1.4 (`\eTwoWTwoMNdcgTenZeroFour{Gain,CiLow,CiHigh,PHolm}`, `\eTwoDiggNdcgTenZeroFour{GainFull,PHolm,N}`); all exist in `results-macros.tex`. The other numbers in Chapters 1–2 are chapter numbers, dates, the 10 s page cache (Chapter 5 gives it too) and facts of cited papers (each with its citation). A script listed every digit string of both files to check this. |
| DW3 | page counts | Pass. Chapter 1: pages 1–5 (5 pages; budget 5). Chapter 2: pages 6–14 (9 pages; budget 10). Two tables of Chapter 2 sit on their own float pages (pp. 12–13) with white space, so the text itself is about 8 pages. |
| DW4 | references | Pass. 41 distinct keys are cited in Chapters 1–2, and every one is an item of `references.tex` (18 existing, 23 new; no duplicate label). All 23 new items are "verified" in §10 (list below). |
| DW5 | RQs and H1 | Pass. Checked by a script against `super-plan.md` §1: RQ1, RQ2, H2, H0 and the closing sentences are character for character the same. H1 is the same except that the three plan cross-references "(section 7)", "(P4)" and "(P2 checks this)" are left out. |

**New reference keys (key = §10 number)**
tang2013 = 1, ma2008 = 2, wu2019 = 3, sharma2024 = 4, twitter-code2023 = 6, jamali2010 = 8, sedhain2014 = 9, chen2009 = 10, xai-x-algorithm = 30, jaspal2025 = 31, weyl2025 = 32, zhou2024 = 33, jiang2025 = 34, dadgar2022 = 35, akpinar2025 = 36, stefanopoulos2025 = 37, lee2022 = 38, cinus2023 = 39, chen2026 = 40, milli2025 = 41, gauthier2026 = 42, satuluri2020 = 43, elkishky2022 = 44. The text of each item is the §10 text. Not used: [19], [20] and [45] to [50] (dataset notes; [47] and [50] are "search only"), [26].

**What the chapters contain**
- Chapter 1 (7 sections): background, problem statement, "What the title means" (the 2026-11-19 text; only the cache time changed, see note 1), RQs and hypotheses with a short "What was found", contributions C1–C3, scope, outline of Chapters 2–9.
- Chapter 2 (7 sections): what the review looks for; social recommendation (trust and matrix factorization, graph neural models and the 1-hop argument of D4, cold start); feed ranking in practice (Reddit hot and Hacker News with their formulas, Twitter blog, RealGraph, the 2023 code, the 2026 code, communities, other recent work); offline evaluation (splits, leakage, sampled metrics, coverage, ties, baselines, tests, Holm, synthetic data, reproducibility); real-time architecture (no citations, see note 4); a table from design question to source to choice; the gap with a table of the closest works. All 12 recent papers [31]–[42] are cited, by what their abstracts say, never for a result.

**Notes for the author**
1. **Title section.** Kept as written. Author note 1 is applied: "a few seconds" is now "10 seconds (Chapter 5)", because Chapter 5 gives that value. Author note 2 is applied in Section 1.5 (the `social` feed is built and an option; the default did not change). The draft box and the old notes block of `01-introduction.md` were replaced by new ones; remove them before the final version. The section sits after the problem statement, as the draft box asked.
2. **RQ2 wording.** Chapter 1 uses the exact words of the super-plan. Chapter 3 (Section "Research design") states RQ2 in other words ("the amount of social interaction … where the social signal starts to help"). Say if Chapter 3 should use the plan's words.
3. **Limits not yet in Chapters 3 and 7.** Chapter 2 names three limits: 1 hop (no learned diffusion), no fade of trust over time, no learned baseline. The literature notes (D1, D4, D5) say Chapter 3 should name them, but Chapters 3 and 7 do not. Chapter 7, "Limits of the study", is the place.
4. **Section 2.5 has no citation.** The verified list has no source on polling, server-sent events or WebSocket. The pre-thesis cites Kwak, Pimentel, RFC 6455, Gupta and Stamenković, Guess and others; none is in §10, so none was reused (also in Chapter 1). The section states common practice and Breadit's design only.
5. **Chapter 7, BL4.** Chapter 7 says BL4 and BL5 "divide the score by a power of the post's age". That is true for BL5. Reddit "hot" adds a time term (post time over 45,000 s) to a logarithm of the votes [11]. Check that sentence (not my file, so not changed).
6. **Overlap with Chapter 3.** Section 2.3 prints the published formulas of Reddit "hot" and Hacker News. The Hacker News formula also appears in the table of methods of Chapter 3, with the gravity as a parameter. The hybrid score, protocol, tuning values and statistics are not repeated.
7. **Reading depth.** [1], [2], [9], [16] and [31]–[44] are described by their abstracts; [8], [21], [22], [23], [27], [28] by title and topic only (as the super-plan §4 says for [21] and [23]). The search of 2026-10-24 is told as in `.docs/related-work.md` §3, with its "not a proof".
8. **Reference order.** The 23 items are at the end, in the order of the §10 list. The numbers `[n]` follow the position in `references.tex`; `p10-final-checks` will put the list in order of first appearance.
9. **Tables.** Chapter 2 has two tables (design choices, closest works). Each takes a float page. If the chapter must be shorter, the first table (design choices) can go.

**Checked by Opus (2026-11-22).** Own full build of `main.tex` in a separate folder: exit 0, no error, no undefined reference; Chapter 1 pp. 1–5, Chapter 2 pp. 6–14. The sentences that cite the "abstract only" items (`weyl2025`, `jiang2025`, `gauthier2026`, `milli2025`, `chen2026`, `akpinar2025`, `jaspal2025`, `cinus2023`) were read: each cites the topic or the method, not a finding. Notes 1, 2 and 4 of the writer touch Chapters 3 and 7 and are left for the author.
