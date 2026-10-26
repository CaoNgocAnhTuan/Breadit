# Datasets for P1 (task `p1-dataset-selection`)

Date: 2026-10-26 · Status: draft, waiting for the author's `/approve`

## 1. Decision

Pending. It is filled in Step 5, after the evidence is collected.

## 2. Rules (written before any candidate was judged)

These rules come from super-plan P1 Step 2. They were committed before the candidate table, so the decision cannot be bent toward a favorite (design F13).

| Criterion | Pass | Partial | Fail |
|---|---|---|---|
| 1 Social graph | Directed follows with dates, and the dates are on the same time axis as the interactions | Directed follows, but no dates, or dates that cannot be aligned with the interactions. The graph is treated as fixed, so future follows can leak into the past (super-plan P4 text). | Undirected, or no graph |
| 2 Interactions | Dated positive actions on items whose author is a user in the same graph | Positive actions, but the author is unknown or outside the graph, or the times are only an order | No positive actions |
| 3 Communities | Memberships for the same users (the ids join) | Memberships exist but the join is unproven, or they come from another crawl | None |
| 4 Practical | Download works, size fits a laptop slice, terms allow thesis use or are at least not forbidding | Works, but no license text (we record this and cite the paper) | Link dead, or terms forbid use |

**Decision rule.**
- Criteria 1 and 2 decide. A set with "fail" on either is out (super-plan P1 Step 2).
- Among the rest, pick the set with the most "pass" on criteria 1 and 2. Criteria 3 and 4 break ties.
- If no set has at least "partial" on both 1 and 2, write "no candidate passes criteria 1 and 2". Then P4 is dropped and the thesis uses synthetic data only (super-plan §8).
- A "partial" on criterion 1 is allowed, because the super-plan already accepts a fixed graph as a stated limitation.

**Source marks.** "page opened" means we opened the page and read it on that date. "search only" means we saw only a search snippet. "not checked" means we could not check it, and the reason is written. A search snippet is never used as a fact (super-plan §10 rule).

## 3. Candidate table

(Filled in Step 2.)

## 4. File evidence

(Filled in Steps 3 and 4.)

## 5. What it can and cannot test

(Filled in Step 5.)

## 6. Calibration targets for the generator (P3)

(Filled in Step 5.)

## 7. Proposed changes to the plan

(Filled in Step 5. Nothing here is applied to the super-plan. The author decides.)

## 8. Sources

(Filled in Steps 2 to 5.)
