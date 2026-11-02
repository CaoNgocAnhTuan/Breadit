# 05 · The evaluation protocol

[Guidance Manual](../Guidance-Manual.md) · English · [Tiếng Việt](../vi/05-evaluation-protocol.md)

**After reading this you can:** explain how one number in the results table is produced, from raw events to the H1 verdict; compute Recall and NDCG by hand; and explain why the protocol cannot see the future.

Sources: super-plan §5 (protocol) and §7 (frozen values); implementation-plan §3 (cut time T, Holm families, H1 reading). Code: `eval/src/harness/`, `eval/src/metrics.ts`, `eval/src/stats.ts`. Terms: [09 Glossary](09-glossary.md).

---

## 1. The question the protocol answers

"If, at the moment just before a user acted, we had shown them a feed ranked by method X, how high would the post they actually chose have been?"

We cannot ask real users (no pilot, super-plan §9). So we **replay the past**: we go back to the moment before each user's action, rebuild what the app knew then, rank, and see where the real choice lands. A method that puts real choices near the top is better.

## 2. The pipeline at a glance

```
events ─▶ cut time T ─▶ one held-out item per user ─▶ pool at t_u ─▶ rank with each method
       ─▶ rank r of the held-out post ─▶ Recall@K, NDCG@K ─▶ paired difference per user
       ─▶ bootstrap CI + randomization p ─▶ Holm ─▶ verdict
```

## 3. Step 1: the cut time T

All positives (likes, comments, reposts) of a dataset are sorted by time. T is the time of the event at position `ceil(q · n)`, with n the number of positives and q = 0.8 (frozen). So 80% of the activity is before or at T, and 20% is after.

- **Validation items** are at or before T. They are used for tuning.
- **Test items** are after T. They are used once, at the end.

**Example.** 10 events at times 1, 2, 3, 5, 8, 9, 12, 13, 15, 20. `ceil(0.8 · 10)` = 8, so T = 13 (the 8th time). An event at 13 is validation; at 15 or 20 it is test.

**Why one global T, not "each user's last item"?** A global cut means tuning never sees anything from the test period, for any user. With a per-user split, user A's test period could be user B's training period, and information would leak across users (Meng et al. 2020 compare these splits).

Frozen values of T: 21393508 for the S datasets and 21412417 for the M datasets (seconds from 2026-01-01), and 1246068297 for `digg2009` (Unix seconds, 2009-06-27 02:04:57 UTC).

## 4. Step 2: one held-out item per user

For each user, the **test item** is their last positive after T **on a post they had not touched before**. Re-liking an old post is not a new discovery, so it does not count. A user with no such positive after T has no test item and is not in the count.

Its time is `t_u`. From now on, everything about user u is computed **as of t_u**.

## 5. Step 3: the as-of rule (no peeking)

An event is visible at t_u if:
- its time is before t_u, or
- its time equals t_u and its event id is smaller than the test event's id.

Follows and memberships have no event id, so they count only if strictly before t_u.

This rule applies to **every** feature: like counts, comment counts, post age, who follows whom, community membership and trust. So a post's like count is the count at t_u, not the count today.

**Example.** u likes post 7 at t_u = 100. Post 7 had 5 likes before 100, and 20 more after. The ranking at t_u sees **5**. If it saw 25, post 7 would look more popular than it was, and the method would be rewarded for knowing the future. This is **leakage**, a known problem in recommender evaluation (Ji et al. 2023).

**How we know it works.** The leakage test changes or deletes every event after t_u, and u's results must not change by one byte. It passes (P5).

## 6. Step 4: the candidate pool

`buildPool` decides which posts can be ranked for u at t_u. A post is in the pool if it is:
- a root post (not a reply), approved, not deleted;
- created in the window `t_u − W ≤ created_at < t_u`, with W = 7 days;
- not by a user u blocked (synthetic and Digg data have no blocks);
- not u's own post, and not a post u already touched before t_u.

Then only the newest N_max = 2,000 are kept.

If the held-out post is **not** in the pool (too old, for example), the user is **left out**. Left-out users are counted per bucket in `leftout.csv`, so a reader can see who was dropped. E8 repeats the main comparison with a larger pool (14 days, 4,000 posts) to check that the pool size does not decide the result.

**Full ranking.** The method ranks the whole pool (hundreds of posts). Many papers rank the held-out item against only 100 random "negatives". That is faster, but it can change which method looks best (Krichene and Rendle 2020), so we do not do it.

The app uses the **same** `buildPool`. This matters: if the evaluation pool were different from the live pool, the numbers would describe a different system.

## 7. Step 5: rank and find r

Every method scores every post in the pool and sorts by `(scoreFixed desc, postId desc)`. r is the position of the held-out post, starting at 1.

## 8. Step 6: the metrics

With one held-out item at rank r:

| Metric | Formula | r = 1 | r = 3 | r = 7 | r = 15 |
|---|---|---|---|---|---|
| Recall@10 (= HitRate@10) | 1 if r ≤ 10 | 1 | 1 | 1 | 0 |
| NDCG@10 | 1 / log2(r + 1) if r ≤ 10 | 1 | 0.5 | 0.333 | 0 |

So NDCG gives full credit for the top spot, half credit for third place, and nothing past K. The table reports the **mean over users**.

**Example.** Four users with ranks 1, 3, 7, 15 → Recall@10 = 3/4 = 0.75, NDCG@10 = (1 + 0.5 + 0.333 + 0) / 4 = 0.458.

Recall@K equals HitRate@K here because there is exactly one relevant item per user. The thesis says this once.

**Coverage@K** = distinct posts that appear in any user's top K ÷ distinct posts in any pool. A popularity method shows the same few posts to everyone and gets a low coverage. A personal method should spread more.

K is 5, 10 and 20. The headline metric is **NDCG@10**.

## 9. Step 7: history buckets

Users are grouped by history (positives before t_u): **0**, **1–4**, **5–19**, **20+**. The cold-start group of H1 is **0–4**, the union of the first two. Buckets are only for reporting; the score itself has no phases (file 03).

Bucket sizes at q = 0.8 (kept test users): `syn-W2M-M` has 174 in 0–4 (59 in 0); `digg2009` has 20,644 in 0–4. The rule required at least 100, fixed before Digg was counted.

## 10. Step 8: tuning, then one test run

1. On validation items only, try every α, β in {0, 1, 2, 4, 8, 16} for H, and each baseline's grid.
2. Pick the value with the best NDCG@10. On a tie, pick the smaller value.
3. Freeze the choices.
4. Run the test items **once**. The test split runs only when the run config says `"testApprovedBy": "author"`.

Tuning on the test split would be like studying with the exam answers.

## 11. Step 9: statistics and the verdict

For every user i: `d_i = NDCG@10(H) − NDCG@10(BL2)`. Pairing by user removes the big differences between users.

- **Paired bootstrap** (10,000 resamples of users): gives a 95% confidence interval of the mean d.
- **Randomization test** (10,000 sign flips): gives a two-sided p-value. If H and BL2 were the same, flipping the sign of each d_i would not matter.
- **Holm correction** over family F1 (H − BL2 for 3 values of K × 5 groups = 15 tests per dataset), because many tests make lucky wins more likely.

**H1 passes on a dataset** when, for NDCG@10 and group 0–4, the Holm-adjusted p < 0.05 **and** the lower end of the CI > 0. It is tested on `syn-W2M-M` and on `digg2009`, each on its own.

**H0 gate first.** On the null world `syn-W0-M`, the CI of H − BL2 (NDCG@10, all users) must **not** lie above 0. In W0 follows carry no influence, so if H "wins" there, something is wrong (a bug or a leak). Then we stop and fix before trusting any other result.

The details of the statistics will be in file 06.

## 12. Why you can trust the numbers

| Risk | Defense |
|---|---|
| seeing the future | as-of rule + leakage test |
| a different pool from the app | the same `buildPool` + the parity test (task 8) |
| sampled negatives | full ranking |
| weak baselines | tuned BL2t, BL4, BL5, BL6 |
| tuning on the test | global T, test split run once with the author's approval |
| lucky wins | paired tests + Holm |
| "the result is built into the data" | W0, W1, three W2 cells, timestamp shuffle (E5), and real Digg data |
| results that drift | Class D: byte-identical files and SHA-256 manifests, double-run test |

## 13. Check yourself

1. A user's last positive after T is a comment on a post they had liked before T. Is it the test item? *(No: it must be a post they had not touched before. The test item is their last positive after T on a new post.)*
2. Ranks 2, 2, 11 at K = 10: what are Recall and NDCG? *(Recall 2/3 = 0.667; NDCG (0.631 + 0.631 + 0) / 3 = 0.421.)*
3. Why does the pool drop posts the user already touched?
4. What does it mean if H beats BL2 in W0?
5. Why is the test split run only once?
