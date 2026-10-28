# Implementation blueprint

Version 1.0 · 2026-10-28 · Status: draft for the author's approval
Super-plan: [super-plan.md](super-plan.md) · Task: `.docs/works/2026-10-28-p2-implementation-blueprint/`

How the pieces of P3 to P10 fit together in the code. A thing is here only if two or more tasks share it. Detail that one task owns stays in that task's `design.md`. Frozen values live in super-plan §7. This file points to them as "§7, <row name>" and does not copy them.

## 1. Module map

To be written (Step 5 of the P2 plan).

## 2. Data contracts

To be written (Step 5 of the P2 plan).

## 3. Cut time T and Holm family

This part is written and committed before the script reads the real Digg files. So the Digg counts cannot bend the rule.

### 3.1 The rule for T

For each dataset, sort all positive events by `(t, event_id)`. A positive is a like, a comment or a repost. Let `n` be the number of positives. T is the time of the event at rank `ceil(q · n)`.

- A test item must have `t > T`. A validation item has `t ≤ T`. An event at exactly T is validation, not test.
- `q` is 0.8.
- If the Digg check keeps fewer than 100 test users in bucket 0–4 at `q` = 0.8, then `q` becomes 0.7.
- If that also gives fewer than 100, `q` stays 0.8 and H1 test 2 is reported as underpowered. It is not dropped.
- One `q` for every dataset.
- The value of T is computed by the harness and frozen in P5 (§7, row "Cut time T"). This part sets only the rule.

This is the global temporal split of [13], with the split point set by a share of events, not by a calendar date. A share works the same on synthetic data and on Digg, and it is easier to state than a date.

### 3.2 Words used by the rule

- **Test item.** The user's last positive with `t > T`, on a post the user had not touched before. A user with no positive after T has no test item and is left out of the count.
- **History.** The number of the user's positives before the test time `t_u`. An event with `t = t_u` counts only if its event id is smaller than the test event's id.
- **Bucket.** History 0, 1–4, 5–19 or 20 and more (§7, row "History buckets"). Bucket 0–4 is the union of 0 and 1–4.
- **Window rule.** A story is in the window when `t_u − W ≤ created_at < t_u`. `W` and the pool cap `N_max` are in §7, row "Window W / pool cap N_max".
- **Kept.** A test user is kept when the test post is in the user's pool. The pool holds the stories in the window, without the user's own stories and the stories the user touched before, and it keeps the newest `N_max`. A test user whose post is not in the pool is "left out".
- **Threshold.** At least 100 kept test users in bucket 0–4. The number was fixed before the Digg count (design Open question 6).

### 3.3 Holm families

Two families per dataset, each corrected with Holm on its own. The two co-primary tests of H1 are on different datasets (`syn-W2M-M` and `digg2009`), so they are different families and each is reported on its own.

| Family | Comparisons | Size per dataset |
|---|---|---|
| F1, confirmatory | H − BL2, for each K (§7, row "K") and each group 0, 1–4, 0–4, 5–19, ≥20 | 15 |
| F2, secondary | H − each of BL0, BL1, BL2t, BL3, BL4, BL5, BL6, for each K and each group 0–4, 5–19, ≥20, all | 84 |

- Only `syn-W2M-M` and `digg2009` get F1 and F2.
- Everything else gets bootstrap confidence intervals and no p-value. That covers W0, W1, W2L, W2H, the ablations, E6, E8 and the density bins.
- Holm stays valid when tests overlap, and bucket 0–4 contains 0 and 1–4. So the overlap does not break it.
- Holm level and confidence level: §7, row "Confidence level / Holm level".

### 3.4 Reading of H1 (for the author to confirm)

H1 passes on a dataset when, for the F1 row (NDCG@10, group 0–4), both hold:
- the Holm-adjusted p of the randomization test is below the Holm level (§7, row "Confidence level / Holm level"), and
- the lower end of the bootstrap confidence interval (same row) is above 0.

The super-plan says "the paired 95% confidence interval of the difference is above 0 after Holm correction". Holm adjusts p-values, not intervals. So this is the closest standard reading.

### 3.5 H0 gate

In `syn-W0-M`, the bootstrap confidence interval of H − BL2 (NDCG@10, all users) must not lie above 0. It is a gate and not a member of a family. If it fails, stop (super-plan §1).

### 3.6 Synthetic data

The same rule. P3 must print the same bucket table for `syn-W2M-M`. Proposal for the P3 spec, not a frozen value: at least 100 kept test users in bucket 0–4 at size M. Below that, P3 changes a parameter that is "chosen" (not calibrated) before any ranking run.

### 3.7 Digg numbers

Digg numbers: added in Step 4 of the P2 plan, after this rule was committed.

## 4. Measurement plan

To be written (Step 6 of the P2 plan).

## 5. Task list

To be written (Step 6 of the P2 plan).

## 6. Assumptions and open points

To be written (Step 6 of the P2 plan).
