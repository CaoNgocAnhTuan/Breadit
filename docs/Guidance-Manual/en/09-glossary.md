# 09 · Glossary

[Guidance Manual](../Guidance-Manual.md) · English · [Tiếng Việt](../vi/09-glossary.md)

Every term and symbol used in the thesis, in one place. Each entry is one or two sentences, then where to read more. Values marked "frozen" come from super-plan §7 and never change without a change-log line.

---

## A. The research

| Term | Meaning |
|---|---|
| **Direction A** | The thesis direction agreed with the supervisor: a Social-Graph-Aware Hybrid "For You" feed (`.docs/Thesis_Orientation.md`). |
| **Gap 1** | The pre-thesis "For You" feed is not personalized by anything except who you follow; it is newest first. The thesis starts here. |
| **RQ1** | Does adding social-graph signals (follow trust, community affinity) improve "For You" over the current heuristic, especially for users with little history? |
| **RQ2** | How does the amount of social interaction change ranking quality? From what level does the social signal start to help? |
| **H0** (sanity) | In the null world W0 the hybrid must **not** beat BL2. If it does, there is a bug or a leak. It is a gate: checked first. |
| **H1** | For users with 0–4 earlier interactions, H has a higher NDCG@10 than BL2. Tested twice: on `syn-W2M-M` and on `digg2009`. |
| **H2** | The gain of H over BL2 grows with social density and is about zero for a user with no followee and no community. |
| **Co-primary tests** | The two H1 tests (synthetic and Digg). Each has its own pass rule and is reported on its own. |
| **Cold-start user** | A user with little or no history. In this thesis: history bucket 0–4. |
| **Default feed rule** | After P7, "For You" switches to `social` only if H1 passes on both co-primary tests **and** H0 passes. Otherwise it stays as today. |

## B. Ranking

| Term | Meaning |
|---|---|
| **Candidate pool** | The set of posts a method may rank for one user at one time. Built by `buildPool`, the same function for the app and the evaluation. |
| **Window W** | A post enters the pool only if it was created within W before the time t. Frozen: 7 days. |
| **Pool cap N_max** | The pool keeps at most the newest N_max posts. Frozen: 2,000. |
| **Larger pool (W_L, N_L)** | 14 days and 4,000 posts. Used only by experiment E8. Frozen. |
| **Positive** | A like, comment or repost. The only kind of feedback used. Unlike and unfollow are not modelled. |
| **Implicit feedback** | Feedback the user gives by acting (liking), not by rating. Positives are implicit feedback. |
| **Engagement** | `likes + 2·comments + 3·reposts − 0.25·ageHours`, counted as of t. It is the production Explore score. |
| **Trust** | How much u's past behavior points to followee f: `(n_uf + m/|F_u|) / (N_u + m)`. See file 03. |
| **Community affinity** | The same idea for a community c: `(c_u,c + m·[member]/|M_u|) / (N_u + m)`. |
| **Social term** | Trust of the post's author (if u follows them) plus trust of every followee who engaged with the post before t. |
| **Author term / engager term** | The two parts of the social term. Ablations H-noauthor and H-noengager switch one off. |
| **α (alpha)** | Weight of the social term, in engagement points. Tuned on the grid 0, 1, 2, 4, 8, 16 (frozen grid). |
| **β (beta)** | Weight of the community term. Same grid. |
| **m** (prior strength) | How many "imaginary" interactions the prior is worth. Frozen at 5; E4 also tries 0, 2, 5, 10. |
| **m-estimate smoothing** | Mixing an observed rate with a prior: `(count + m·prior) / (total + m)`. It avoids 0/0 for a new user (Cestnik 1990). |
| **Prior** | What we assume before seeing any history: trust spread equally over followees and communities. |
| **scoreFixed** | The integer score `floor(score × 100)`. Every method returns one. |
| **Tie-break** | Equal scores are ordered by `postId` descending. So the order is total: it never depends on database row order. |
| **Ablation** | A version of H with one part switched off, to see what that part adds (H-follow, H-comm, H-noauthor, H-noengager). |

## C. Methods

| Id | Meaning |
|---|---|
| **BL0** | Production "For You": posts of followees first, newest first, then the rest. |
| **BL1** | Newest first. |
| **BL2** | Production Explore score (= engagement). **The reference method of H1.** |
| **BL2t** | BL2 with its age weight tuned (grid 0.0625 … 1, production 0.25). |
| **BL3** | Global popularity: most likes first. |
| **BL4** | Reddit "hot", likes as upvotes. Tuned time divisor (published 45,000 s). |
| **BL5** | Hacker News ranking. Tuned gravity (published 1.8). Strongest baseline in the P5 table. |
| **BL6** | Engagement + α × (number of followees involved). The hybrid without trust weights. |
| **H** | The hybrid: engagement + α·social + β·community. |
| **H-follow / H-comm** | H with only the social term / only the community term. |
| **H-noauthor / H-noengager** | H without the author part / without the engager part of the social term. |
| **`algo`** | The planned API option of the live feed: `chrono`, `engagement`, `social` (task 8). |

## D. Evaluation

| Term | Meaning |
|---|---|
| **Offline evaluation** | Measuring ranking quality on recorded data, by replaying the past, without real users. |
| **asOf** | The time a ranking is computed for. Every feature uses only events before it. |
| **As-of rule** | An event is visible at asOf if `t < asOf.t`, or `t = asOf.t` with a smaller event id. Follows and memberships need `t < asOf.t`. |
| **Leakage** | Using information from after the test time. It makes results look better than they are. Prevented by the as-of rule and tested by the leakage test. |
| **Cut time T** | One global time per dataset. Validation items are at or before T, test items after T. T is the time of the event at rank `ceil(q·n)` of all n positives, with q = 0.8 (frozen). |
| **Test item** | A user's last positive after T, on a post they had not touched before. One per user. |
| **Validation item** | The same, but the last one at or before T. Used for tuning only. |
| **t_u** | The time of user u's held-out item. All of u's features are computed as of t_u. |
| **History** | The number of u's positives before t_u. |
| **History bucket** | 0, 1–4, 5–19, 20+ (frozen). "0–4" is the union of 0 and 1–4. |
| **Kept / left out** | A user is kept if their held-out post is in their pool. Otherwise left out, and counted in `leftout.csv`. |
| **Full ranking** | The method ranks the whole pool. No sampled negatives (sampled metrics can change which method wins). |
| **Rank r** | Position of the held-out post in the ranked pool, starting at 1. |
| **K** | List length for metrics: 5, 10, 20 (frozen). |
| **Recall@K = HitRate@K** | 1 if r ≤ K, else 0. Equal, because each user has one item. |
| **NDCG@K** | `1 / log2(r + 1)` if r ≤ K, else 0. Rewards a high position more. Main metric: NDCG@10. |
| **Coverage@K** | Distinct posts in any top-K list ÷ distinct posts in any pool. Shows whether a method shows many posts or the same few. |
| **Tuning** | Choosing a parameter (α, β, a baseline's parameter) on validation items only, by NDCG@10, smaller value on ties. Then frozen. |
| **Golden test** | A tiny hand-checked dataset must give a committed CSV exactly. |
| **Leakage test** | Change or delete every event after t_u: u's rows must not change. |
| **Double-run test** | Two full runs must give byte-identical files. |
| **Parity test** | The live endpoint and the harness must give the same order for 100 sampled (user, asOf) pairs (task 8). |

## E. Statistics

| Term | Meaning |
|---|---|
| **Paired difference** | For each user: NDCG of H minus NDCG of the reference. Pairing removes the user-to-user variation. |
| **Paired bootstrap** | Resample users with replacement 10,000 times and take the mean difference each time. The middle 95% is the confidence interval (CI). |
| **Randomization test** | For each user, randomly swap the two methods' scores (flip the sign of the difference), 10,000 times. Two-sided p = (1 + number of shuffles with \|mean\| ≥ \|real mean\|) / 10,001. |
| **p-value** | How surprising the observed difference would be if the two methods were really equal. |
| **Multiple comparisons** | Running many tests makes some look significant by chance. |
| **Holm correction** | A step-by-step way to adjust p-values for many tests, valid even when tests overlap (Holm 1979). Level 0.05. |
| **Family F1** | Confirmatory: H − BL2, for each K and groups 0, 1–4, 0–4, 5–19, 20+. 15 tests per dataset. |
| **Family F2** | Secondary: H − each other baseline, for each K and groups 0–4, 5–19, 20+, all. 84 tests per dataset. |
| **H1 verdict** | On the F1 row NDCG@10, group 0–4: Holm-adjusted p < 0.05 **and** CI lower end > 0. |
| **H0 gate** | On `syn-W0-M`, the CI of H − BL2 (NDCG@10, all users) must not lie above 0. |
| **Common random numbers** | Every comparison restarts its random stream, so all comparisons use the same resamples. |

## F. Data

| Term | Meaning |
|---|---|
| **Synthetic generator** | Seeded code that builds fake but realistic social data in 5 stages: users, follows, communities, posts, interactions. |
| **World W0** | Null world: interactions depend on interests only; follows carry no influence. |
| **World W1** | Latent homophily: people with similar tastes follow each other, but still no influence. |
| **World W2 (L, M, H)** | Influence sweep: low, middle, high social influence. W2M (middle) is the main H1 cell. |
| **Homophily** | "Birds of a feather": similar people connect. It makes follows and likes correlate even without influence. |
| **Influence** | A followee's action makes you more likely to act. This is what the social term tries to use. |
| **Size S / M** | S: 200 users, 4,000 posts. M: 1,000 users, 20,000 posts (frozen). |
| **Dataset id** | `syn-<world>-<size>` (e.g. `syn-W2M-M`) or `digg2009`. |
| **Digg 2009** | Real data from the news site Digg, June 2009: 3,553 front-page stories, 3,007,345 votes, 1,729,983 dated follow links. Votes are used as likes. No communities. |
| **Calibration** | Setting generator parameters so the synthetic data matches Digg numbers (activity skew, followees per user, votes per user). |
| **Canonical dataset** | The one CSV format every source is converted to: 6 tables, sorted, integer ids and seconds, with a manifest. |
| **Manifest** | `manifest.json`: the source, seed, Node version and SHA-256 of every file. |

## G. Reproducibility

| Term | Meaning |
|---|---|
| **Determinism** | Same input, same output, every time, on every run. |
| **Class D** | Results that must be byte-identical: data, rankings, metrics, statistics. |
| **Class R** | Results that are only repeatable: latency and throughput. Reported as a median with a CI. |
| **Master seed** | 20261014 (frozen). All randomness comes from it. |
| **Stage stream** | `rng(masterSeed, stage)`: a separate random stream per stage (`users`, `bootstrap`, …), so adding one stage never changes another. |
| **sfc32** | The small, fast random generator used. Seeded from SHA-256. |
| **SHA-256** | A fingerprint of a file. If one byte changes, the hash changes. |
| **Frozen value** | A value fixed before the test split runs (super-plan §7). Changing it needs a new config version and a change-log line. |
| **`thesis:repro`** | Planned command (task 11) that rebuilds every dataset and result and compares all hashes. |
