---
paths:
  - "eval/**"
  - "packages/ranking/**"
---

# Evaluation protocol (super-plan §5)

The protocol is frozen with the config. Read super-plan §5 for the full text. These are the points code most often gets wrong.

- **Split.** As-of temporal leave-last-out with full ranking. A user's test item is their last positive (like, comment or repost) on a post they had not touched before, and it comes after the global cut time T. The validation item is their last such positive before T. No sampled negatives.
- **As-of.** Every feature for user u uses only events strictly before t_u, ties broken by event id.
- **Pool.** One shared `buildPool` for the live feed and the harness. A user whose test post is not in the pool is left out, and the count is reported in total and for each history bucket.
- **Buckets** (0, 1–4, 5–19, ≥20) are for reporting only.
- **Metrics.** Recall@K equals HitRate@K, and the thesis says so. NDCG@K and Coverage@K as in §5. K from §7.
- **Statistics.** Paired bootstrap and paired randomization test with seeded streams, Holm correction across method × K × bucket.
- **Tuning.** α and β (and the one parameter of BL2t, BL4, BL5 and the α of BL6) on the validation items only. Then freeze, then run the test item once. The Bash hook asks the author before any `--split test` run.
- **Sanity first.** In the null world W0 the hybrid must not beat BL2. If it does, stop: there is a bug or a leak.
- **Tests that must exist** (P5): golden (tiny dataset → committed CSV), leakage (change events after t_u → same ranking), double run (equal hashes).
