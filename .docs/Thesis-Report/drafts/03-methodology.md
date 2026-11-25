# Chapter 3. Methodology

> **Draft, 2026-11-19.** Budget: about 12 pages. This chapter has no result numbers, so it has no macros. The values it gives are **frozen settings** from the super-plan §7 and the run configs (K, buckets, grids, seeds, T); they are typed here, and `p10-final-checks` decides whether they also become macros. References in square brackets use the numbers of the super-plan §10 for now. Remove this box and the notes at the end before the final version.

This chapter describes how the research questions are answered. Section 3.1 gives the research design. Sections 3.2 and 3.3 define the hybrid score and the methods it is compared with. Section 3.4 describes the two data sources, Section 3.5 the evaluation protocol, Section 3.6 the tuning, and Section 3.7 the statistics. Section 3.8 explains how the results are made reproducible, and Section 3.9 how the cost of the live feed is measured. Chapter 6 reports the results.

## 3.1 Research design

The thesis asks two questions. **RQ1:** does adding social-graph signals (follow trust and community affinity) to the ranking improve the "For You" feed over the current heuristic, especially for users with little history? **RQ2:** how does the level of social interaction between users change the ranking quality? What is the minimum level where the social signal starts to help?

Each question has a hypothesis that was written down and frozen before any test result existed:
- **H1 (RQ1).** For users with 0–4 earlier interactions, the hybrid score H has a higher NDCG@10 than BL2, the score of the current Explore feed. H1 has two co-primary tests: one on synthetic data (the middle-influence world, Section 3.4) and one on real data (Digg 2009). Each test is judged on its own.
- **H2 (RQ2).** The gain over BL2 grows with social density (number of followees, amount of friend engagement in the pool). It is about zero when the user follows nobody and has no community.
- **H0 (sanity).** In the null world W0, where follows are random, the follow part of the hybrid must not beat BL2. A win there would mean a bug or a leak, so H0 is checked first, as a gate.

The design is an **offline evaluation**: the methods rank posts for past moments, and we check whether each user's next real action is ranked high. It does not need real users, and every number can be rebuilt. Its limits are discussed in Chapter 7.

Three rules hold throughout. First, everything that could be tuned was tuned on validation data, frozen, and only then run once on the test data. Second, every feature is computed only from events before the ranking time. Third, the same ranking code runs in the evaluation and in the live app (Chapter 5), so the numbers describe the feed that users get.

## 3.2 The hybrid score

The hybrid score of post p for user u at time t is

```
H(p, u, t) = engagement(p, t) + α · social(p, u, t) + β · community(p, u, t)
```

**Engagement** is the score of the current Explore feed, computed as of t:

```
engagement(p, t) = likes + 2·comments + 3·reposts − 0.25·ageHours
```

**The social term** adds trust in the people u follows. It has two parts: the author, and the followees who engaged with the post before t.

```
social(p, u, t) = [u follows author(p)] · trust(u, author(p), t)
                + Σ trust(u, f, t)  over followees f who engaged with p before t
trust(u, f, t)  = (n_uf + m / |F_u|) / (N_u + m)
```

Here `n_uf` is the number of u's earlier positives on posts by f, `N_u` is u's total number of earlier positives, and `F_u` is the set of u's followees at t.

**The community term** adds u's affinity to the post's community:

```
community(p, u, t) = (c_u,c(p) + m · [u is a member of c(p)] / |M_u|) / (N_u + m)
```

Here `c_u,c` is the number of u's earlier positives in community c, and `M_u` is the set of u's communities at t. A post outside any community gets 0.

**Why the prior m.** Without it, trust would be `n_uf / N_u`, which is 0/0 for a user with no history, so the score could not help exactly the users RQ1 asks about. The m-estimate [28][29] mixes the user's own counts with a prior: at `N_u = 0`, every followee gets the same trust 1/|F_u| and every community the same weight 1/|M_u|. As history grows, the weight of the prior, `m / (N_u + m)`, falls smoothly. The three cold-start phases of the original proposal become this one curve; the history groups of Section 3.5 are used only to report results. The frozen value is m = 5.

**Why an author term.** A new post by a followee that nobody has engaged with yet would get nothing from the engager sum alone. Large platforms weight in-network posts by the strength of the tie to the author: Twitter's RealGraph predicts the chance of a future interaction for each pair of users [5] and is described as the most important part of ranking in-network posts [7]. The author term is our simple form of that idea. Section 3.3 tests whether each term matters.

**Integer scores and ties.** Every score is stored as the integer `floor(score × 100)`, sums run in a fixed order, and posts are sorted by `(score desc, post id desc)`. So two runs always give the same order, and no result depends on the order in which a database returns rows. Section 3.5 checks the effect of the tie-break.

## 3.3 Baselines and ablations

All methods rank the same candidate pool (Section 3.5).

| Id | Method | Why it is here |
|---|---|---|
| BL0 | the production "For You": posts of followees first, newest first, then the rest newest first | the current feed |
| BL1 | newest first | the simplest feed |
| BL2 | the production Explore score (engagement above), as of t | the reference of H1: H is BL2 plus the social terms |
| BL2t | BL2 with its age weight tuned | the reference with the same tuning effort as H |
| BL3 | global popularity: likes as of t | a popularity baseline |
| BL4 | Reddit "hot" [11], likes as upvotes, with the time divisor tuned | a known strong time-decay formula |
| BL5 | Hacker News ranking [12], `(P − 1)^0.8 / (T + 2)^gravity`, with the gravity tuned | a second known time-decay formula |
| BL6 | engagement + α · (follows the author + number of followees who engaged), every trust weight 1 | shows what the trust weights add over a plain count |
| H | the hybrid score | the method of the thesis |

BL4 and BL5 were added so that the baselines are not weak [25], and BL2t, BL4, BL5 and BL6 are tuned like H, so the hybrid is not the only tuned method. The ablations of H are: **H-follow** (β = 0, follow terms only), **H-comm** (α = 0, community term only), **H-noauthor** and **H-noengager** (one follow part removed), and H with m = 0, 2 and 10.

## 3.4 Data

Two sources are used, because each one can test something the other cannot.

**Synthetic data.** A seeded generator (`eval/`, configuration `synthetic-v1.json`, frozen with its SHA-256) creates users, follows, communities, posts and interactions in five stages, each with its own random stream. Each user has a hidden main topic; there is one community per topic. An action picks a post from the last 7 days with a weight that combines the user's interest in the post's topic, the post's freshness and popularity, a **social influence** term (the author is a followee, or followees acted on the post before) and a **community influence** term. The generator never ranks a feed, so the data do not depend on any tested method.

The worlds differ in homophily h (similar users follow each other) and influence g:

| World | h | social g_s | community g_c | Role |
|---|---|---|---|---|
| W0 | 0 | 0 | 0 | null world: follows are random and have no effect (the H0 gate) |
| W1 | 0.7 | 0 | 0 | homophily only, no influence |
| W2L, W2M, W2H | 0.7 | 0.5, 2, 8 | 0.5, 2, 8 | low, middle and high influence; W2M is H1 test 1 |

Each world has size M: 1,000 users and 20,000 posts. Values that real data can set were calibrated to Digg 2009 (the activity shares per history group, the mean number of actions per user, the share of users with followees and their number); the rest are our own choices, each with its reason in the configuration file.

**Real data: Digg 2009** [20][49][50]. It was chosen against rules written before any candidate was judged (`.docs/datasets.md`): a directed follow graph with dates on the same clock as the actions, and dated positive actions on items whose author is in the same graph. Digg passed both. The two files come from the Internet Archive copy of the original page, because the original host is gone; their SHA-256 is recorded. The conversion keeps Digg's own ids, treats a vote as a like, takes the first voter of a story as its author, keeps the earliest of repeated votes, and drops links without a date and self-links. A follow counts for a test only if it is dated before that test's time. The result has 336,047 users, 3,553 stories, 3,007,345 likes and 1,729,983 dated follows.

**What each source can test.** Digg tests the follow terms on real behaviour, but it has no communities, so the community term is 0 there and β has no effect. The community term is tested on synthetic data only; Hive, the one real candidate with dated memberships, could not be accessed (Chapter 7). Digg is also small and special: one month, only stories that reached the front page.

## 3.5 Evaluation protocol

**Split.** All positives (likes, comments, reposts) of a dataset are sorted by time, and the cut time T is the time of the event at position ceil(0.8 · n). Events at or before T are used for tuning; events after T only for the final test. One global cut means that tuning never sees the test period of any user, which a split per user would allow [13]. The frozen values of T are 21,412,417 s for the M worlds (seconds from 2026-01-01) and 1,246,068,297 for Digg (Unix time).

**One test item per user.** A user's test item is the last positive after T on a post the user had not touched before; its time is t_u. A user with no such positive has no test item. The validation item is defined in the same way before T.

**The as-of rule.** Every feature for user u is computed only from events before t_u (an event at exactly t_u counts only if its id is smaller than the test event's id): like counts, post age, follows, memberships and trust. Training on events after the test time is a known source of leakage [14]. A leakage test checks it: changing or deleting every event after t_u leaves u's results unchanged.

**The candidate pool.** One function, `buildPool`, used by both the evaluation and the live feed, builds u's pool at t_u: root posts that are not deleted and are approved, created in the 7 days before t_u, not by a blocked user, not u's own posts and not posts u touched before; the newest 2,000 are kept. A user whose test post is not in the pool is left out and counted. Each method ranks the whole pool, with no sampled negatives, because sampled metrics can change which method looks best [15][16]. A check with a larger pool (14 days, 4,000 posts) is part of the experiments.

**Metrics.** With one test item at rank r: Recall@K equals HitRate@K (1 if r ≤ K); NDCG@K is 1/log2(r + 1) if r ≤ K, else 0; Coverage@K is the number of distinct posts in any user's top K, divided by the number of distinct posts in any user's pool [17]. K is 5, 10 and 20; NDCG@10 is the main metric. The comparison is per user: the **gain** is the mean over users of the paired difference in NDCG@10. Chapter 6 shows Recall@10 and Coverage@10, and Appendix B gives Recall, NDCG and Coverage at all three values of K.

**History groups.** History is the number of u's positives before t_u. Results are reported for the groups 0, 1–4, 5–19 and 20 or more, and for 0–4, the group of H1. One more comparison was added after the test run, because the Orientation of the thesis asks for it: Recall@10 and NDCG@10 for users with 5 or fewer earlier interactions against users with more than 20. Its bounds are not these groups and it was not frozen, so Chapter 6 reports it as exploratory, with a bootstrap interval and no p-value (Section 6.6.1).

**Ties.** The experiments are repeated with the reversed tie-break, because many tied scores (popularity especially) can change metrics [18].

## 3.6 Tuning and freezing

α and β of H are tuned on the validation items only, on the grid 0, 1, 2, 4, …, 1,024 for each, by NDCG@10; a tie goes to the smaller pair. The same rule tunes the one parameter of BL2t (age weight 0.0625 to 4 per hour), BL4 (time divisor 11,250 to 720,000 s) and BL5 (gravity 0.6 to 2.4), and the α of BL6. Each grid contains the published or production value. Each dataset is tuned on its own.

After tuning, the choices are written into the test configurations, the author approves them, and the test split runs once. Two changes were made before the test split, both decided from validation results only and recorded with their date: the H0 gate tests H-follow instead of the full H, and the grids were widened because the first choices sat at their edge (Chapter 6).

## 3.7 Statistics

For each user, take the paired difference against the reference method. Two tools are used, each with 10,000 draws from a seeded random stream [21]:
- a **paired bootstrap 95% confidence interval** of the mean difference;
- a **paired randomization test**: flip the sign of each user's difference at random; the two-sided p-value is the share of flips whose mean is at least as far from 0 as the real one.

**Holm correction** [22] controls the error over many comparisons. On each of the two main datasets there are two families: F1, the confirmatory one (H − BL2 for each K and each history group, 15 comparisons), and F2 (H against each other baseline). Other comparisons get an interval and no p-value.

**The decision rule for H1** was fixed before the test split: H1 passes on a dataset only if, for NDCG@10 and group 0–4, the Holm-adjusted p is below 0.05 **and** the lower end of the interval is above 0. Holm adjusts p-values, not intervals, so this is the closest standard reading of "the interval is above 0 after Holm correction".

**The default feed rule** was fixed at the same time: "For You" switches to the hybrid only if H1 passes on both tests and the H0 gate passes.

## 3.8 Reproducibility

Every result of this thesis is one of two classes. **Class D** (data, rankings, metrics, statistics, tables) must be byte-identical on every run: no wall clock and no unseeded randomness in the ranking or evaluation code, one master seed (20261014) with a separate stream per stage, integer scores, a total tie-break, canonical CSV files, a pinned Node version and pinned Docker images. Each output file has a SHA-256 in a manifest, and one command, `npm run thesis:repro`, rebuilds every Class D file from the raw data and compares every hash [27]. **Class R** (time measurements) can only be repeatable, not identical; it is reported as a median with an interval.

## 3.9 Measuring the cost of the live feed

The cost experiment (E7) measures the live backend, not the evaluation code. With the synthetic world W2M loaded into the database, a load tool sends 100 requests per run (page 1 of the feed for 100 sampled user and time pairs) from one virtual user, with the page cache off, for each of the three feed rankings (newest first, engagement, social). Five runs are made and the first is dropped as warm-up; a run counts only if no request fails. The result is the median time with a bootstrap interval, and the number of database queries per request, which is exact.

---

## Notes for the author (remove before the final version)

1. **Typed frozen values.** Section 3 types the frozen settings of the super-plan §7 (m, the grids, W, N_max, K, T, the seed, the world parameters) and the Digg sizes from the adapter check. They are not results, but `p10-final-checks` should decide whether they become macros from the config files.
2. **Citations.** [20] and [49] are the Digg data pages (verified). The Digg terms ask to cite Hogg and Lerman (2012) [50]; its Crossref record was checked on 2026-11-23, so it is now cited as the data source (no finding from it). [23] (influence and correlation) is not used here; it belongs to Chapter 7.
3. **Overlap with Chapter 4.** The pool rule and the integer score are also part of the system design. Chapter 4 should refer to Sections 3.2 and 3.5, not repeat them.
4. **Page check.** About 12 pages once the formulas are typeset; the tables of Sections 3.3 and 3.4 can shrink if the chapter runs long.
