# Note for the supervisor: why H1 failed, and a revised hybrid score

Type: writing (light path, no plan) · 2026-11-25 · Folder: `.docs/works/2026-11-25-p9-negative-result-note/`
Row: none (a discussion note for the supervisor meeting of 2026-11-30; P9)

## 1. Spec

### Problem

H1 failed on both co-primary tests (`syn-W2M-M` and `digg2009`), so the main result of the thesis is negative. The author has not met the supervisor since the pre-thesis, and P1 ("the supervisor confirms the RQs, the data and the design decisions", super-plan §4) is still open. The author wants one document to take to the meeting of 2026-11-30. It must explain in detail why the result is negative and propose how to change the hybrid score `H`, or use another hybrid score, so that the supervisor can decide. No code and no thesis text change before that decision.

The facts are spread over `.docs/Thesis_Orientation.md` (where `H` came from: "Hướng A", Option A), `.docs/literature.md` (what P1 changed: the `m`-estimate prior, the author term, 1 hop, all "our own design"), `.docs/related-work.md`, `.docs/Thesis-Report/chapters/methodology.tex` (the formula, H0–H2, the decision rule), `chapters/experiments-and-results.tex` and `chapters/discussion.tex` (the results and their reading), `.docs/results/p7-report/` (`results.md`, `macros.csv`, the figure CSVs) and `.docs/super-plan.md` (§7 frozen values, the P7 status, the change log).

### Scope

**In scope:** one new file, `.docs/h1-negative-result-and-hybrid-v2.md`, in English, for the supervisor (and the author). Sections:

1. **Summary** (one short paragraph): what was tested, the result, what the note asks the supervisor to decide.
2. **What was tested.** RQ1, H1 (exact words of `methodology.tex`), H0, H2; the formula of `H` (engagement, social with `trust`, community, the prior `m`); BL2; NDCG@10 in one sentence; the two datasets; the decision rule; that the hypotheses and the test configs were frozen and approved before the one test run.
3. **Where the hybrid score came from.** The Orientation formula (Option A, "SoRec-style"), and what P1 added (prior `m`, author term, 1 hop) with its evidence in `literature.md`. Say plainly: the combination is our own design; the search found no paper that adds follow trust and community affinity to engagement in one feed score; "SoRec-style" is a loose name, because SoRec is a matrix factorization model.
4. **The results** (a few small tables): H1 on both datasets (gain, 95% interval, Holm `p`, users in group 0–4); E1 all methods (NDCG@10, both datasets); E4 ablations (H, H-follow, H-comm, `m` variants); E3 and E5 in a sentence each.
5. **Why it failed.** At least these four causes, each with its evidence from the results and with a label **tested** or **not tested (our reading)**:
   - scale: `engagement` has no upper bound, the social term is at most 2 and the community term at most 1; on Digg every `H` variant equals BL2 and `alpha` sits at the edge of its grid;
   - the BL2 base is weak in time: on Digg BL4 and BL5 are far better than BL2;
   - cold start: at `N_u = 0` the prior gives every followee `1/|F_u|`, so the social term is almost flat for exactly the users of H1; group 0–4 is small, so the interval is wide;
   - the gain on synthetic data comes from the community term (a topic signal) and from correlation, not influence (W0, W1 and the shuffle of E5).
6. **What can change and what cannot.** The design and the frozen values can change (P1 is open; a frozen value changes only when the author asks, with a super-plan change-log line). The test split has been seen: a new score run on the same test split is post-hoc and must be reported as such; round 1 (`H`) stays in the thesis.
7. **Proposals.** Three changes to `H`, each with its formula, the cause it fixes, the data it needs (already loaded by `FeedService` or not), the files it touches, a rough cost and the risk:
   - A. one scale for the parts (log or percentile of engagement in the pool, or a multiplicative boost `base × (1 + α·social + β·community)`);
   - B. a time-decayed base (BL4 or BL5 form), compared with that same base so that the social part is measured alone;
   - C. a prior from the behaviour of all users instead of the flat `1/|F_u|` (the simple form uses the positives on the pool posts, which `FeedService` already loads; the full form needs more data).
   Then other hybrid scores the literature supports, only from references "verified" in super-plan §10 and only with what §10 or `literature.md` says about them (for example a RealGraph-like edge weight, or a 2-hop idea from DiffNet), with why each is in or out of scope. End with one recommendation (A + B + simple C, offline only, a new method id, `H` unchanged).
8. **How Hv2 would be tested honestly.** Tune on the validation split only; a new synthetic seed for the confirmatory test; Digg reported as post-hoc; a new frozen line and a change-log line; the app keeps its feed until a result passes the default feed rule. Say what stays unchanged in the architecture: `@breadit/ranking` is pure and shared, so a new scorer touches `packages/ranking` and `eval/` only.
9. **Questions for the supervisor** (3–5), for example: accept the negative H1 as the main result; run Hv2 as round 2 or only write it as future work; which of A, B, C; is a post-hoc Digg result acceptable; the dates.

**Out of scope:** any change to code, results, the thesis (`.docs/Thesis-Report/`), `docs/`, the super-plan or the frozen values; new experiments; new references; git commits (Opus commits).

### Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | the file exists with the nine sections above, in this order | yes |
| DW2 | every number in the note | equals its source: a value of `.docs/results/p7-report/macros.csv` or `results.md` (write the macro name or file next to it the first time), or a frozen value of super-plan §7, or a count read from a named file; list in Result any number that has no source |
| DW3 | the formulas of `H`, `engagement`, `trust`, `community` | the same as `chapters/methodology.tex` |
| DW4 | each cause of section 5 | has its evidence and the label tested or not tested |
| DW5 | each proposal of section 7 | has formula, cause fixed, data needed, files touched (real paths), cost and risk; literature only from §10 "verified" items, with their §10 number |
| DW6 | style | CLAUDE.md "How to write": short sentences, simple words; about 300–450 lines; no rewrite of other files |
| DW7 | `git status` | only the new note and this folder are new or changed |

## 2. Impact

A discussion note only. It changes no code, result, frozen value or thesis text. After the meeting, the supervisor's answer decides whether a code task (`Hv2`, through `/task`) or a writing change follows.

## Result

Written 2026-11-25 by the Sonnet writer; checked and committed by Opus. File: `.docs/h1-negative-result-and-hybrid-v2.md` (300 lines). The author's correction (the supervisor suggested the form of H) is in section 3.

| # | Check | Result |
|---|---|---|
| DW1 | nine sections, in order | Pass. |
| DW2 | numbers have a source | Pass. Opus checked by script: the 40 `M:` names are keys of `macros.csv` (3 matches were prefixes such as `eFourDigg...`), and 31 values were compared with `macros.csv` (all equal), plus the five tuned values. Counts checked by hand: 27,824 (`results.md` e3), 59% (super-plan §4 P4 and §8), "fewer than five" (Orientation line 134), §11 item 7 dated 2026-11-12. Numbers with no source: the cost estimates (marked "my estimates") and the arithmetic 42, 2,048, "about 8 times", "about 6 times", "about 3". |
| DW3 | formulas equal `methodology.tex` | Pass. |
| DW4 | each cause has evidence and a label | Pass. Causes 1 and 3: not tested; cause 2: tested on Digg; cause 4: tested on synthetic data. |
| DW5 | proposals complete; literature from §10 "verified" only | Pass. The file paths and names exist (`REQUIRED_PARAMS`, `METHOD_ORDER`, `fastPostFeatures`, `feed.constants.ts` maps `social` to `H`). References used: [2], [3], [5], [6], [7], [9], [23], [28], [29], [33], [35], [37], [46]. |
| DW6 | style and length | Pass, 300 lines. |
| DW7 | only the note and this folder | Pass. |

**Opus fix.** Section 9, question 5: the source of "the dates are not known" was "§11, items 1 and 2"; item 2 is the thesis rules. Now: "the opening paragraph, and section 11, item 1".

**Points the writer raised, kept in the note.** The `m` prior and the author term were already in super-plan v0.1 §6 and P1 confirmed them. Cause 1 has a weak point (α = 1,024 can give 2,048 points), so the note adds a second reading (many Digg test users follow nobody) and a cheap check that was not run. Cause 2 holds on Digg only. Proposal B uses the BL4 form (BL5 puts posts with 0 likes in the lowest band). The round-2 reference is the same base (BL4 tuned), not BL2; this is question 3 for the supervisor.

**Added 2026-11-25 (author's requests).**
- Vietnamese version `.docs/h1-negative-result-and-hybrid-v2.vi.md`, written by a Sonnet translator: the same structure line for line (318 lines each, 0 line-type mismatches, identical code blocks, the same numbers apart from the `(dịch: …)` repeats of English quotes). The English version is the reference and points to it.
- In both versions, section 4: where the Orientation metrics (Recall@K, NDCG@K at K = 5, 10, 20, Coverage) are reported, and an exploratory table with the supervisor's group bounds (≤5 against >20), with Recall@10 and NDCG@10 and 95% paired bootstrap intervals; cause 3 notes that the result depends on the bound. The table comes from `recall-by-group.py` (in this folder; it checks the SHA-256 of `eval/results/p7-main/per_user.csv` against the run manifest) and its output `recall-by-group.txt`. Its 0–4 row matches `results.md` e2 (0.0231, −0.0029 to 0.0511 against 0.023, −0.002 to 0.051; the bootstrap seed differs). Every table value was compared with the output file by script.

