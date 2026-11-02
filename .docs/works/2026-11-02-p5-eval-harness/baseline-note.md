# Baseline table (checkpoint P5) — Breadit thesis

2026-11-02 · Cao Ngọc Anh Tuấn · Direction A, Social-Graph-Aware Hybrid "For You" feed

This is the first result of the evaluation harness, sent before any tuning, as planned in the thesis plan. It shows that the protocol runs end to end and gives a first look at the baselines. It is **not** a result about the hybrid score, which is not in this table.

## What was run

- **Data:** three synthetic worlds at the small size (200 users, 4,000 posts each): W0 (no social influence), W1 (similar tastes, no influence) and W2 at the middle influence level.
- **Split:** the validation split only. Each user's item is their last like, comment or repost at or before the global cut time T (80% of all events). The test split has not been run, and it will run once, after tuning is frozen.
- **Users:** 180 per world; none was left out of the pool.
- **Methods:** six baselines with their production or published settings, no tuning:
  - BL0, the current "For You" (followed accounts first, newest first);
  - BL1, newest first;
  - BL2, the current Explore score;
  - BL3, global popularity (likes);
  - BL4, Reddit "hot";
  - BL5, Hacker News ranking.
- **Protocol:** full ranking of the user's candidate pool (posts of the last 7 days, at most 2,000), with no sampled negatives. Every feature uses only events before the item's time.
- **Reproducible:** two runs gave byte-identical files (`.docs/results/p5-baseline/`, manifest SHA-256 `f76463b2…fb61481`).

## Results at K = 10, all users (Recall@10 / NDCG@10)

Recall@K is the same as HitRate@K here, because each user has one item.

| Method | W0 | W1 | W2 (middle) |
|---|---|---|---|
| BL0 For You | 0.033 / 0.014 | 0.033 / 0.017 | 0.050 / 0.025 |
| BL1 Newest | 0.044 / 0.017 | 0.050 / 0.021 | 0.039 / 0.016 |
| BL2 Explore | 0.044 / 0.019 | 0.061 / 0.026 | 0.039 / 0.014 |
| BL3 Popularity | 0.044 / 0.022 | 0.039 / 0.016 | 0.067 / 0.026 |
| BL4 Reddit hot | 0.044 / 0.016 | 0.050 / 0.021 | 0.039 / 0.016 |
| BL5 Hacker News | 0.061 / 0.027 | 0.089 / 0.040 | 0.067 / 0.034 |

K = 5 and 20, each history group (0, 1–4, 5–19, 20+) and coverage are in `summary.csv` and `coverage.csv`.

## How to read it

- **The numbers are small, and the groups are small.** 180 users means one user is 0.0056 of Recall. So a gap of 0.02 is about 4 users. There are no confidence intervals in this table; the experiments will have them (paired bootstrap and randomization test, with Holm correction).
- **One expected pattern is visible.** BL0, which puts followed accounts first, does better in W2, where follows carry influence, than in W0, where they carry none (Recall 0.050 against 0.033).
- **BL5 is the strongest baseline here.** This supports keeping the tuned "hot" baselines (BL4, BL5) next to the production score, so the hybrid is compared with strong methods, not only weak ones.

## What comes next

1. Tune α, β and the baseline parameters on the validation split (medium size and Digg 2009), then freeze them.
2. Run the experiments E1–E8 once on the test split.
3. Report H1 on two co-primary tests (synthetic W2 middle, and Digg 2009), with the H0 check on W0 first.

The rule for H1 is now fixed: the hybrid passes on a dataset when, for NDCG@10 and users with 0–4 earlier interactions, the Holm-adjusted p-value is below 0.05 and the lower end of the 95% confidence interval of the difference with BL2 is above 0.

Questions for you: is this protocol and the choice of baselines acceptable? Is there a baseline you would like to add before tuning starts?
