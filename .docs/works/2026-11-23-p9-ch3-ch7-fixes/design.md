# Chapters 3 and 7: fixes before the progress check

Type: writing (light path, no plan) · 2026-11-23 · Folder: `.docs/works/2026-11-23-p9-ch3-ch7-fixes/`
Row: none of its own. These are the writer notes of rows 23–27 (`.docs/implementation-plan.md` §5), fixed before the supervisor reads the PDF on 2026-11-30, so row 28 (`p10-final-checks`) does not find them.

## 1. Spec

### Problem

Four known faults in the thesis text, found by the writers of rows 24 and 27:

1. **BL4 is described wrongly in Chapter 7.** `chapters/discussion.tex` line 30 says "BL4 and BL5 divide the score by a power of the post's age". The code (`packages/ranking/src/scorers.ts`, `case 'BL4'`) computes `sign · log10(max(likes, 1)) + (createdAt − t) / divisor`: Reddit "hot" **adds a time term** to the log of the likes, which works like an exponential decay (likes × 10^(−age/divisor)). Only BL5 (`0.8 · ln(likes) − gravity · ln(ageHours + 2)`) divides by a power of the age. BL2 (`packages/ranking/src/explore.ts`) subtracts a linear age term (`ageHours · 0.25`); that part of the sentence is right. Check every other place that describes BL4 or BL5 (Chapter 3 Table of baselines lines 84–85, Chapter 6, Chapter 7 line 68, Chapter 9 line 56, the abstract) and fix only what is wrong.
2. **Chapter 7 "Limits of the study" (`discussion.tex` §`sec:disc-limits`, lines 71–92) misses three limits** that Chapter 2 (`literature-review.tex` line 168) and Chapter 9 (`conclusion.tex` line 57) already name: trust uses **1 hop** only (followees, not the accounts they follow; Chapter 2 line 30 and Table line 113), trust **does not fade with time**, and there is **no learned social baseline** (SoRec, DiffNet). Chapter 2 says "These are limits of the study", so Chapter 7 must list them.
3. **The Digg rows at K = 20 are not discussed.** In Appendix B (`appendix.tex`, Table `tab:app-f1-digg`), group 0–4 on `digg2009` at K = 20 has its 95% interval above 0 and Holm-adjusted p below 0.05 (`.docs/results/p7-main/compare.csv`, row `digg2009,F1,H,BL2,20,0-4`), so it passes the H1 rule; group 0 at K = 20 too. H1 is decided at K = 10 only (Chapter 3; super-plan §2 H1), where it fails. Appendix B line 412 says the other K "do not change that decision", but Chapter 6 and 7 never say that one K passes. One honest sentence is needed, in Chapter 6 §`sec:results-e2` or Chapter 7 §`sec:disc-rq1` (writer's choice, say which in Result), with a pointer to `tab:app-f1-digg`. The gains are tiny (well below the gains of BL4 and BL5); say so without a typed number.
4. **RQ2 and H2 in Chapter 3 use other words.** `methodology.tex` line 13: "how does the amount of social interaction change the ranking quality, and where does the social signal start to help?"; line 18 (H2) leaves out "(number of followees, amount of friend engagement in the pool)". Chapter 1 (`introduction.tex` lines 55 and 60) and the super-plan (`.docs/super-plan.md` lines 21 and 26) say: "How does the level of social interaction between users change the ranking quality? What is the minimum level where the social signal starts to help?" and H2 with the bracket. Chapter 3 must use the same words as Chapter 1 (RQ1 too, if it differs).

### Scope

**In scope:**
- `chapters/discussion.tex` (BL4 sentence, three new limits, maybe the K = 20 sentence) and `drafts/07-discussion.md` with the same changes.
- `chapters/methodology.tex` (RQ2, H2, and RQ1 if it differs from Chapter 1) and `drafts/03-methodology.md`.
- `chapters/experiments-and-results.tex` and `drafts/06-experiments-and-results.md` only if the K = 20 sentence goes there.
- Any other place found by the check in Problem 1 that describes BL4 wrongly (with its draft).

**Out of scope:** new macros or any code; Chapter 4 figures; the acknowledgements; the E3 wording "1, 1 and 1 users"; `references.tex` (no new reference: SoRec `ma2008` and DiffNet `wu2019` exist already); git commits (Opus commits); the supervisor's feedback.

### Rules for the writer

- CLAUDE.md "How to write": short sentences, simple words, one idea per paragraph. Keep the style of the chapter around the change. Change only what the four problems need.
- No typed result number. Every result number is a macro of `\resultsdir/results-macros.tex`. Settings and names (K = 20, group 0--4, 1 hop, 95\%) may be typed.
- Cite only with `\refcite{key}` of keys that exist in `chapters/references.tex`.
- Each `.tex` change has the same change in its Markdown draft.

### Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | `latexmk -pdf -interaction=nonstopmode -outdir=<scratch>/build-fixes main.tex` from `.docs/Thesis-Report/` | exit 0; no `!` error, no undefined reference or control sequence; no new overfull box (today: 1) |
| DW2 | every sentence that describes BL4 | says it adds a time term to the log of the likes (or "an exponential decay"), never "divides by a power of the age"; BL5 still divides by a power of the age |
| DW3 | Chapter 7 "Limits of the study" | has 1 hop, no fading of trust, and no learned social baseline (with `\refcite{ma2008}` and `\refcite{wu2019}`), each short |
| DW4 | the K = 20 sentence | exists once in Chapter 6 or 7; says that the Digg rows 0 and 0--4 at K = 20 pass the rule, that the gains are tiny, that H1 is decided at K = 10 only, and points to `tab:app-f1-digg`; no typed number |
| DW5 | RQ1, RQ2 and H2 in Chapter 3 | the same words as Chapter 1 |
| DW6 | the drafts | each `.tex` change is also in its draft |
| DW7 | page count | still 96 pages, or at most 1 more |

## 2. Impact

P9 text only. No code, no result and no macro changes. Without it, the supervisor reads a wrong formula (BL4), a limits section that is shorter than Chapter 2 promises, and a result in Appendix B that the chapters do not mention.

## Result

Written by the Sonnet writer, 2026-11-23. Not committed (Opus commits).

**Files changed** (all under `.docs/Thesis-Report/`):
- `chapters/discussion.tex` and `drafts/07-discussion.md` (Problems 1 and 2)
- `chapters/experiments-and-results.tex` and `drafts/06-experiments-and-results.md` (Problem 3)
- `chapters/methodology.tex` and `drafts/03-methodology.md` (Problem 4)

No code, result, macro or `references.tex` change.

### Problem 1: BL4 in Chapter 7

Old (`discussion.tex` line 30): "BL4 and BL5 divide the score by a power of the post's age, while BL2 only subtracts a small linear age term."

New: "BL5 divides the score by a power of the post's age. BL4 adds a time term to the logarithm of the likes, which works like an exponential decay of the likes. BL2 only subtracts a small linear age term."

Checked against the code: `scorers.ts` BL4 is `sign * log10(max(likes, 1)) + (createdAt - asOf.t) / divisor` (a time term added to the log of the likes, so the order equals likes * 10^(-age/divisor)); BL5 is `0.8 ln(likes) - gravity ln(ageHours + 2)` (likes^0.8 divided by a power of the age); BL2 subtracts `ageHours * 0.25`.

Other places checked, nothing else is wrong, so nothing else changed:
- Chapter 3 table (lines 84-85): BL4 "Reddit hot, likes as upvotes, with the time divisor tuned, a known strong time-decay formula"; BL5 `(P-1)^0.8 / (T+2)^gravity`. Both right.
- Chapter 2 (lines 40-45, equation `eq:lit-hot`): already says "adds a term for the time of the post". Right.
- Chapter 3 line 92 and 149, Chapter 6 lines 142, 345, 416, Chapter 7 line 68, Chapter 9 lines 20 and 56, the abstract, Chapter 1 line 15, Appendix A and B: they say "hot", "time decay" or name BL4 and BL5 without a formula. Right.

### Problem 2: three new limits in Chapter 7, "Limits of the study"

Placed after "Social density" and before "Cost", in the `.tex` and in the draft:
- "**One hop only.** Trust uses 1 hop: only the accounts that the user follows count, and the accounts that those accounts follow do not (Chapter 2). DiffNet, a learned model, gives its best result at 2 steps~\refcite{wu2019}, so 1 hop may leave a gain unused. Our trust is a count, so this is only a hint. We did not test 2 hops."
- "**No fade of trust over time.** Trust is a smoothed count of earlier positives, so an old like counts as much as a new one. RealGraph decays old interactions~\refcite{kamath2014}. We did not test whether a fade would help."
- "**No learned social baseline.** Every baseline is a fixed formula or a count, tuned like the hybrid. We did not compare with a learned social model such as SoRec~\refcite{ma2008} or DiffNet~\refcite{wu2019}, and such a model may be stronger."

All three keys exist in `references.tex`. In the draft, the same sentences use the draft numbers of Chapter 2 ([3] DiffNet, [5] RealGraph, [2] SoRec).

### Problem 3: Digg at K = 20

The sentence is in **Chapter 6, Section `sec:results-e2`**, as a new short paragraph after the `digg2009` paragraph and before "Other groups" (and in `drafts/06-...md`). It is there because it is a result of the F1 test, and Chapter 7 already says H1 fails and points to that section. It exists once.

New: "**`digg2009` at other values of $K$.** At $K = 20$, groups 0 and 0--4 pass both conditions of H1: the interval is above 0 and the Holm $p$ is below the Holm level (Table~\ref{tab:app-f1-digg} in Appendix~B). This does not change the result, because H1 is decided at $K = 10$ only, and there it fails. The gains at $K = 20$ are tiny, far below the gap between BL4 or BL5 and BL2 (Table~\ref{tab:results-e1}). So we do not read them as a pass of H1."

Checked in `compare.csv`: `digg2009,F1,H,BL2,20,0` has CI low 0.000138 and Holm p 0.005599; `...,20,0-4` has CI low 0.000123 and Holm p 0.001500; `...,20,1-4` has Holm p 0.050695 (not below 0.05), so it is not named. No number is typed.

### Problem 4: RQ2 and H2 in Chapter 3 (`methodology.tex` lines 13 and 18, and the draft)

- RQ1 already had the same words as Chapter 1: no change.
- RQ2, old: "how does the amount of social interaction change the ranking quality, and where does the social signal start to help?" New: "how does the level of social interaction between users change the ranking quality? What is the minimum level where the social signal starts to help?"
- H2, old: "The gain over BL2 grows with social density, and it is about zero for a user who follows nobody and has no community." New: "The gain over BL2 grows with social density (number of followees, amount of friend engagement in the pool). It is about zero when the user follows nobody and has no community."

### Done when

| # | Pass | Evidence |
|---|---|---|
| DW1 | Pass | `latexmk` exit 0; log has 0 lines starting with `!`, no LaTeX warning (no undefined reference, citation or control sequence). One Overfull box, the old one (a URL in `references.tex`, line 34-35, 77 pt); the first build had 1 too. Log: `<scratchpad>/build-fixes/main.log`. |
| DW2 | Pass | `grep "divide\|power of" chapters/*.tex` shows only BL5 (Ch 7 line 30) and the Hacker News sentence of Ch 2. BL4 is "adds a time term to the logarithm of the likes ... exponential decay" in Ch 7 and Ch 2; no other chapter has a wrong BL4 sentence. |
| DW3 | Pass | Three bold paragraphs in `sec:disc-limits`, with `\refcite{ma2008}`, `\refcite{wu2019}` and `\refcite{kamath2014}`; each 2-3 short sentences. |
| DW4 | Pass | One paragraph in Chapter 6 `sec:results-e2`: groups 0 and 0--4 at K = 20 pass, gains tiny, H1 decided at K = 10 only, points to `tab:app-f1-digg`, no typed number. |
| DW5 | Pass | RQ1, RQ2 and H2 in `methodology.tex` now use the words of `introduction.tex` lines 55 and 60 (RQ1 was equal already). |
| DW6 | Pass | `git diff --stat`: each of the three `.tex` files has its draft changed with the same text (3 pairs). |
| DW7 | Pass | 97 pages (was 96): one more, the limit allowed. |

### Unsure or to know

- **Page count is 97**, at the edge of the limit. The three limits and the K = 20 paragraph add about 13 lines of text, and the build shows one page more (the writer did not check which page moved). If the author wants 96, cut the "Our trust is a count, so this is only a hint." sentence and the RealGraph sentence.
- **"2 steps" in the new limit** is a setting of DiffNet (K = 2 in its paper, as Chapter 2 line 28 says), typed as a setting, not a result of this thesis.
- **Draft notes not edited.** `drafts/02-literature-review.md` notes 3 and 4 (the "limits that Chapter 7 does not list" and "Chapter 7 and BL4") and note 6 of `drafts/10-appendix.md` (Appendix B rows at K = 20) are now done. The writer did not edit them (out of the Spec); the author can remove them with the other notes before the final version.
- **Draft of Chapter 6** has older `[MACRO?]` marks that the `.tex` replaced with macros; the new paragraph is plain text, so it does not add one.
- **H1 in Chapter 3** (line 17) is a short form of the Chapter 1 H1 and does not carry the pass rule in the bullet; the rule is elsewhere in Chapter 3. Left as it is (Spec says RQ1, RQ2 and H2 only).

### Checked by Opus (2026-11-23)

Checked the diff against the Spec: DW1–DW7 hold. The BL4 sentence matches `scorers.ts`; the DiffNet "2 steps" and the RealGraph "decays old interactions" claims are already stated, with the same citations, in Chapter 2 (`literature-review.tex` lines 28 and 58). The K = 20 paragraph uses the same words as the K = 10 paragraph above it ("both conditions", "the Holm level"), and the two groups it names agree with `p7-main/compare.csv` (group 1–4 at K = 20 has Holm p above the level and is rightly not named). 97 pages. Left as they are: the old writer notes in `drafts/02-literature-review.md` (notes 3, 4) and `drafts/10-appendix.md` (note 6), which these fixes answer; row 28 can tidy them.
