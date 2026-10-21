# Breadit Thesis Super Plan

Version 0.1 · 2026-10-14 · Direction: Hướng A, Social-Graph-Aware Hybrid "For You" feed

This is the blueprint for the whole thesis phase: code, datasets, benchmarks, statistics and writing. The main rule is simple: **every number in the thesis must come from a command that gives the same result every time.**

Three decisions are already made:
- **Data:** a seeded synthetic generator plus one public dataset. No real-user pilot.
- **Method:** the heuristic hybrid score (Option A) plus ablations. No DiffNet, no learned baseline.
- **Determinism:** two classes. Quality results are byte-identical. Latency is repeatable, not identical (section 2).

---

## 1. Goal, questions and hypotheses

**Goal.** Make the "For You" feed personal by using the follow graph and community membership. Show by measurement that it helps, mostly for new users.

**RQ1.** Does adding social-graph signals (follow trust and community affinity) to the ranking improve the "For You" feed over the current heuristic, especially for users with little history?

**RQ2.** How does the level of social interaction between users change the ranking quality? What is the minimum level where the social signal starts to help?

Hypotheses are frozen before the first test-split run (section 7). If one changes later, add a dated line to the change log at the end.

- **H1 (RQ1).** For users with 0–4 earlier interactions, the hybrid has higher NDCG@10 than BL2. It passes if the paired 95% confidence interval of the difference is above 0 after Holm correction. Primary test: one pre-chosen cell of synthetic world W2 (the middle of the grid), size M. The other cells are reported as a sweep.
- **H2 (RQ2).** The gain over BL2 grows with social density (number of followees, amount of friend engagement in the pool). It is about zero when the user follows nobody and has no community.
- **H0 (sanity).** In the null world W0 (no social influence) the hybrid must not beat BL2. If it does, there is a bug or a leak. Stop and fix before any other result is used.

If H1 or H2 fails, the thesis reports it as it is. A negative result with a clean protocol is still a valid result.

---

## 2. Determinism contract

**Class D: byte-identical.** Datasets, features, rankings, metrics, statistics and the data behind every table and figure. Each output file has a SHA-256 hash in one `manifest.json`. A re-run must give the same hashes.

**Class R: repeatable.** Latency, throughput and similar timing numbers. They depend on the clock and the machine, so they cannot be identical. We fix the data, the load and the environment, run N times, and report the median with a 95% confidence interval. The thesis says "repeatable", never "identical", for these numbers.

Rules for Class D:
- **No wall clock.** Every scorer takes `asOf` as an argument. `Date.now()` and `Math.random()` are not allowed in `ranking/core/` or `eval/` (a grep test checks this).
- **One seeded PRNG.** `rng(masterSeed, stageName)` returns an sfc32 generator seeded from `sha256("<masterSeed>:<stageName>")`. Each stage has its own stream, so adding a stage never changes the others. We do not reuse `mulberry32` from `seed.ts`: it has only 32 bits of state, and its author recommends other generators [26].
- **Integer scores.** Scores are fixed-point integers, like the current `Math.floor(score * 100)` in `posts.service.ts:57`. Sums run in a fixed order (sorted by id).
- **Total tie-break.** Sort by `(scoreFixed desc, postId desc)`. No ranking depends on database row order.

More rules for Class D:
- **Explicit data.** Generated data has explicit IDs (including user IDs, not `cuid()`) and integer timestamps counted from a fixed base epoch.
- **Canonical files.** CSV, UTF-8, LF line endings, sorted rows, fixed column order, metrics printed with 6 decimals.
- **Pinned environment.** Docker images by digest, `npm ci`, `.nvmrc` and `engines`. The Node version goes into the manifest, because `Math.log2` and `Math.pow` can differ between engines.
- **No cache, no HTTP.** The evaluation reads data directly. It never goes through Redis, the throttler or the API.

These rules follow common advice for reproducible computing: record seeds and exact versions, and script every step [27].

---

## 3. Where we start

These facts were checked in the code on 2026-10-14. They shape the plan.

**Feed code**
- The "For You" feed (no `feed` param, logged in) shows posts from you and your followees, newest first, with no community posts (`posts.service.ts:203-213`). It is not the same for everyone, and a new user with no follows sees only their own posts. `Thesis_Orientation.md` describes it differently.
- Explore uses `Date.now()` (`posts.service.ts:263`, `:276`) and today's counts. The same query gives different results tomorrow, so it cannot be replayed at a past time.
- Community posts are excluded from both home and Explore (`communityId: null`). Community affinity cannot work until they enter the candidate pool.

**Data and tooling**
- `Like`, `Follow` and `SavedPosts` have no unique constraint, and there are almost no indexes (only unique ones and one on `CommentMedia`). Unlike, unfollow and leaving a community are hard deletes.
- `seed.ts` is not deterministic: the admin id is a `cuid()`, bcrypt salts are random, `createdAt` is the transaction time (so a whole batch shares one timestamp), there is no `orderBy` before the PRNG picks, and it is not idempotent. `humans_v1` has 0 follows and 0 likes.
- `docs/planning/k6_results.json` did not come from the current k6 script. Its 71% failed requests match the old limit of 120 requests per minute, which was raised to 1000 in commit `6f7b884` (`app.module.ts:28`). The file does not store status codes, so this is the likely cause, not a proven one. Pre-thesis chapter 5 reports under 1% errors, which contradicts that file.
- `User.followers` in the Prisma schema counts the accounts a user **follows**, not their followers. Always query the `Follow` table directly.

---

## 4. Phase plan

Week numbers count from 2026-10-14 (week 1). The plan is about 13 weeks. The defense date is not known yet (section 11).

| Phase | Weeks | Output | Done when |
|---|---|---|---|
| P0 Baseline freeze | 1 | Tag, branch, pinned environment, corrections note | Clean clone passes install, migrate, typecheck |
| P1 Literature and RQ lock | 1–3 | Survey (3–4 pages), one-page checklist answer | Supervisor confirms the RQs |
| P2 Schema fixes | 2 | One migration: unique keys and indexes | Applies on a clean DB and on a DB with duplicates |
| P3 Synthetic generator | 2–4 | `eval/` workspace, worlds W0–W2, loader | Two runs give the same hashes |
| P4 Public dataset adapter | 4–6 | Digg (and Epinions) in the canonical format | Adapter output hash is stable |
| P5 Evaluation harness | 4–7 | Protocol, metrics, statistics, baselines | Golden, leakage and double-run tests pass |
| P6 Hybrid scorer in the app | 6–9 | `ranking/core`, `algo` param, `reasons`, UI | Live order equals harness order |
| P7 Experiments | 8–10 | E1–E7 tables and figure data | Hash check against the manifest |
| P8 Repro package and freeze | 10–11 | `npm run thesis:repro`, tag | One command rebuilds everything |
| P9 Writing | 10–13 | Thesis chapters with generated tables | Every number comes from a CSV |

### P0: Baseline freeze (week 1)

**Do.** Tag `6f7b884` as `v1-prethesis`. Fast-forward `main` to it (`main` is at `5fac625`, 13 commits behind; no divergence). All work stays on the single branch `test-app` (no separate `thesis` branch). Commit `CLAUDE.md` and `.docs/` on that branch. Add `.nvmrc` (Node 20, the same as the Docker image), `engines`, and Docker image digests. Write the pre-thesis text corrections in `.docs/Bugs Report.md` (section 7, which replaces the planned `prethesis-corrections.md`) with four items: the LightFM sentence (`Latex/chapters/conclusion.tex:88`, `docs/chapter7_conclusion.md:64`), the abstract numbers that do not match chapter 5, the k6 failure explanation, and the NFR doc that still says 120/min.

**Done when.** A clean clone passes `npm ci`, `prisma migrate deploy`, the seed and `npm run typecheck`. Tagging, fast-forwarding and pushing need the author's approval first. Files in `Latex/` change only if the author asks.

### P1: Literature and RQ lock (weeks 1–3)

**Do.** Read in this order: Tang 2013 [1], SoRec [2], RealGraph [5], the Twitter ranking blog [7], SocialMF [8], Sedhain 2014 [9], Orkut communities [10]. Then the evaluation papers: Krichene and Rendle [15], Ji [14], Meng [13]. Use the Sharma survey [4] as a map for Chapter 2; it does not need to be read in full. Write the survey and the one-page checklist answer. Correct the DiffNet title: the paper is "A Neural Influence Diffusion Model for Social Recommendation" [3]; DiffNet is the model name. Start drafting Chapter 2 here, not at the end.

**Done when.** The supervisor confirms RQ1 and RQ2.

### P2: Schema fixes (week 2)

**Do.** One migration. First remove duplicate rows (keep the lowest `id` per pair). Then add unique keys on `Like(userId, postId)`, `SavedPosts(userId, postId)` and `Follow(followerId, followingId)`. Then add indexes on `Like(postId)`, `Like(userId, createdAt)`, `Follow(followerId)`, `Follow(followingId)`, `Post(createdAt, id)` and `Post(communityId, createdAt)`. Check that the toggle code in `interactions.service.ts` and `users.service.ts` still works with the unique keys.

**Done when.** The migration applies on a clean database and on a database that has duplicates.

### P3: Synthetic generator (weeks 2–4)

**Do.** Create the `eval/` workspace (`@breadit/eval`) with a versioned config `eval/config/synthetic-v1.json`. The generator has five stages, each with its own PRNG stream: users (with hidden interests and Pareto activity, about 20% of users make 80% of actions), follow graph, communities and memberships, posts, interactions. It writes canonical CSV and a `manifest.json`. The generator does not run the feed, so interactions never depend on a ranking and there is no feedback loop in the data [24].

Three worlds, so a reader can see the result is not built into the data:
- **W0, null.** Interactions depend on interests only. Follows and memberships carry no influence.
- **W1, latent homophily.** Follows and interactions both come from shared interests. Still no influence.
- **W2, influence sweep.** A grid over homophily strength and social influence strength.

A loader writes the same data into Postgres with explicit IDs, so the live app can run on it. The loader has a demo-only `--rebase-to` option that shifts timestamps to today. Experiments never use it.

**Done when.** Generating twice gives identical manifests. Loading twice gives identical canonical table hashes.

### P4: Public dataset adapter (weeks 4–6)

**Do.** Primary: Digg 2009 [20], which has timestamped votes and a directed follower graph, so it looks like a feed. Secondary: Epinions with timestamps [19]. Raw files are downloaded by hand, stay out of git, and are recorded with source URL and SHA-256. The adapter converts them to the same CSV format as P3. Neither dataset has community membership, so the community term is switched off there (or item categories are used as a stand-in and marked as a limitation). Check the terms of use before download; neither page states a license. The Digg follower graph may have no timestamps (I could not confirm). If so, it is treated as fixed over time, which can leak future follows into the past. Report this as a limitation.

**Done when.** The adapter output hash is stable and a table of users, items and edges is printed. If time is short, drop Epinions and keep Digg.

### P5: Evaluation harness (weeks 4–7)

**Do.** Build the protocol in section 5 in `eval/src/` (`harness`, `metrics`, `stats`, `report`). Baselines are pure functions that take the same pool. Statistics are written in TypeScript, then cross-checked once against scipy on a small fixture. The fixture result is committed.

**Done when.** Three tests pass. (1) Golden: a tiny committed dataset gives a committed CSV. (2) Leakage: change or delete every event after `t_u` for a user, and that user's ranking must not change. (3) Double run: two full runs give equal hashes.

### P6: Hybrid scorer in the app (weeks 6–9)

**Do.** Put pure code in `apps/backend/src/ranking/core/`: no Nest, Prisma or Redis imports. Move `computeExploreScoreFixed` (`posts.service.ts:54`) there, so BL2 in the evaluation is the production code. The author cap (`applyExploreDiversity`, `:60`) is a page-level filter and stays in Explore. Add a thin Nest service and module that load data (reusing `getFolloweesIds`, `getCommunityIds` and `BlockService.getAllBlockedPeerIds`) and call the pure code.

Add a feed option `algo` with values `chrono`, `engagement` and `social`. It goes through `posts.controller.ts` into `findAll` and into the cache key. The default behavior of "For You" stays unchanged until the experiments are done. The frontend changes are in `app/(board)/page.tsx` (whitelist), `Feed.tsx` and `InfiniteFeed.tsx` (query key). Each post in the `social` feed carries a `reasons` list (followed author, friends who engaged, community), computed from the same terms as the score. This supports the claim that the ranking is explainable. A test-only `asOf` query parameter is enabled by an env flag and never in production.

**Done when.** A parity test passes. For 100 sampled (user, `asOf`) pairs on the P3 dataset loaded into Postgres, the live endpoint returns the same order as the harness. The test runs with `REDIS_HTTP_CACHE_ENABLED=false`.

### P7: Experiments (weeks 8–10)

The experiments are in the table below. Run each once on the frozen config. Do not look at test results while tuning.

| ID | Question | Output |
|---|---|---|
| E1 | How do all methods compare? | Methods × datasets × K × metrics |
| E2 | Does the hybrid help cold-start users? (RQ1) | Results by history bucket |
| E3 | Where does the social signal start to help? (RQ2) | Gain against social density and against own history |
| E4 | Which term matters? | Ablations: follow-only, community-only, author term, engager term, `m` |
| E5 | Is the result built into the data? | W0 null world, timestamp shuffle, W2 sweep heatmap |
| E6 | Do ties change the result? | Rerun with reversed tie-break |
| E7 | What does the new feed cost? (Class R) | Latency and query count for `chrono`, `engagement`, `social` |

E7 uses k6 with a fixed seed and a fixed load profile. Run 10 times, drop the first run as warm-up, and report the median with a bootstrap confidence interval. The throttle limit in `app.module.ts:28` must become an env variable so the benchmark can raise it. A run counts only if `http_req_failed` is 0. This gate would have caught the 71% failures in the pre-thesis data. Also count the Prisma queries per request. That number is deterministic.

### P8: Repro package and freeze (weeks 10–11)

**Do.** Add `npm run thesis:repro`. It builds the environment, generates datasets, runs the adapters and all experiments, writes the tables, and compares every hash with `.docs/results/manifest.json`. It fails on any difference. Tag the result `v2-thesis-experiments`.

**Done when.** The command passes on a clean clone.

### P9: Writing (weeks 10–13)

**Do.** Follow the order in `Thesis_Orientation.md`: Chapter 2 (related work, started in P1) and Chapter 4 (results) first. Then method, implementation, evaluation, discussion and conclusion. A report script turns the CSVs into LaTeX tables and a `results-macros.tex` file with named numbers (for example `\recallGain`). The text uses the macros and never typed numbers. This removes the pre-thesis problem where the abstract and chapter 5 disagreed. When writing starts, copy the `Latex/` template into `.docs/latex/`. Do not edit `Latex/`.

**Done when.** Every number in the thesis comes from a CSV.

---

## 5. Evaluation protocol

This protocol is frozen with the config.

**Split.** As-of temporal leave-last-out with full ranking. There are no sampled negatives, because sampled metrics can change which method looks best [15][16]. A user's *test item* is their last positive interaction (like, comment or repost) on a post they had not touched before. The *validation item* is the one before it.

**As-of features.** Every feature for user `u` uses only events strictly before the test time `t_u` (ties broken by event id). This includes engagement counts, post age (`t_u` minus `createdAt`), follows, memberships and trust. Leakage from the future is a known problem in offline evaluation [14].

**Candidate pool.** One shared function `buildPool` is used by both the live feed and the harness. The pool holds root posts that are not deleted, were created before `t_u`, are inside the window W, and are not blocked. It keeps the newest N_max posts. It removes the user's own posts and the user's earlier positives. If the test post is not in the pool, the user is left out, and the number of left-out users is reported. Public datasets can override W.

**History buckets.** History is the number of positive events before `t_u`. Buckets: 0, 1–4, 5–19, 20 or more. The Orientation doc uses "≤5 vs >20" and phases at 0/5/20. Those overlap at 5 and drop users with 6–20 events.

**Metrics.** With one test item at rank `r`: Recall@K equals HitRate@K, so write that in the thesis. NDCG@K is `1/log2(r+1)` if `r ≤ K`, else 0. Coverage@K is the number of distinct posts in any top-K list divided by the number of distinct posts in any pool [17]. K is 5, 10 and 20.

**Methods.** All methods rank the same pool. BL0 is the production "For You": followee posts first, newest first, then the rest newest first. BL1 is plain newest first. BL2 is the production Explore score, as of `t_u`. BL3 is global popularity (likes as of `t_u`).

BL4 and BL5 are two cheap, well-known "hot" formulas, added so the baselines are not weak [25]. BL4 is Reddit "hot" [11] with likes as upvotes and no downvotes. BL5 is Hacker News ranking [12], `(P-1)^0.8 / (T+2)^1.8`, with penalties ignored. H is the hybrid. H-follow (β = 0) and H-comm (α = 0) are ablations.

The author cap in production Explore is a page-level filter. It is not applied in the evaluation, for any method.

**Ties.** Ties are broken by `(scoreFixed desc, postId desc)`. E6 repeats the run with the reversed tie-break. Many ties (BL3 especially) can change metrics [18].

**Statistics.** For each user, take the paired difference against the reference method. Use a paired bootstrap 95% confidence interval (10,000 resamples) and a paired randomization test (10,000 permutations), both with seeded PRNG streams. Correct all p-values with Holm [22] across the family method × K × bucket. Smucker et al. found little practical difference between the randomization, bootstrap and t-tests [21].

**Tuning.** Tune α and β on the validation item only, using the grid in section 7. Choose by NDCG@10, and break ties by the smaller (α, β) pair. Freeze the choice. Then run the test item once.

---

## 6. The hybrid score

```
H(p, u, t) = engagement(p, t) + α · social(p, u, t) + β · community(p, u, t)

engagement(p, t) = likes + 2·comments + 3·reposts − 0.25·ageHours        (as of t; same code as BL2)

trust(u, f, t)   = (n_uf + m / |F_u|) / (N_u + m)
social(p, u, t)  = [u follows author(p)] · trust(u, author(p), t)
                 + Σ trust(u, f, t)  over followees f who engaged with p before t

community(p, u, t) = (c_u,c(p) + m · [u is member of c(p)] / |M_u|) / (N_u + m)
```

Symbols: `n_uf` is u's earlier positives on f's posts. `N_u` is u's total earlier positives. `F_u` is u's followees at time t. `c_u,c` is u's earlier positives in community c. `M_u` is u's communities at time t. `m` is the prior strength.

Three design choices to confirm at the start of P5:
- **Smoothing with `m`.** Without it, `trust = n_uf / N_u` is 0/0 for a user with no history, and the follow signal cannot help exactly the users RQ1 is about. The smoothing is my own suggestion, not a cited method. At `N_u = 0` the prior spreads trust equally over followees and communities.
- **Author term.** The Orientation formula sums trust over friends who engaged with the post. A post by a followee that nobody has engaged with yet would get nothing. The author term fixes this. RealGraph weights the edges between users by their past interaction [5], and Twitter's open-source ranking uses it for in-network tweets [6][7]. E4 shows what each term adds.
- **Phases become a curve.** With smoothing, the weight of the prior is `m / (N_u + m)`. It falls smoothly as history grows. The three cold-start phases in the Orientation doc become this one curve. Buckets are used only for reporting.

---

## 7. Frozen values

One source of truth. A change needs a new config version and a line in the change log. Values marked "freeze at P3/P5" are set before the first test-split run.

| Item | Value | Freeze at |
|---|---|---|
| Master seed | 20261014 | now |
| Base epoch | 2026-01-01T00:00:00Z, timestamps in integer seconds | now |
| Score unit | integer, `floor(score × 100)` | now |
| K | 5, 10, 20 | now |
| History buckets | 0, 1–4, 5–19, ≥20 | now |
| Bootstrap resamples / permutations | 10,000 / 10,000 | now |
| Confidence level / Holm level | 95% / 0.05 | now |
| Prior strength `m` | 5 (E4 tests 0, 2, 5, 10) | P5 |
| α, β grid | 0, 1, 2, 4, 8, 16 (engagement points per unit) | P5 |
| Window W / pool cap N_max | 7 days / 2,000 | P5 |
| Dataset sizes | S 200 users, 4k posts · M 1,000 users, 20k posts · L 5,000 users, 100k posts (E7 only) | P3 |
| Synthetic world parameters | in `synthetic-v1.json` | P3 |
| Primary W2 cell for H1 | middle of the homophily × influence grid | P3 |
| k6 runs / load profile | 10 runs, first dropped / set in P7 | P7 |

---

## 8. Risks

- **The result is built into the data.** If interactions are made from follows, the social signal wins by construction. Defense: W0 null world, W1, the timestamp shuffle in E5 [23], a sweep instead of one setting, and a public dataset. Present synthetic results as a check that the mechanism works, and the public data as outside evidence.
- **Leakage.** Defense: as-of features and the mutation test in P5.
- **Weak community evidence.** No public dataset I found has a follow graph, item interactions and explicit community membership together. State it as a limitation.
- **Schedule.** Nine weeks of build work is tight. Cut in this order: Epinions, then the finer parts of E4, then the `reasons` field.

---

## 9. Out of scope

DiffNet or other graph neural networks, a learned social baseline (SoRec, SocialMF), a real-user pilot, impression logging, online A/B tests, and Python in the main pipeline (Python is used only for the one-time scipy cross-check). These can go into future work.

---

## 10. Appendix: references

"Verified" means I opened the source or a trusted index and the details match. "Search only" means only a search excerpt or secondary source was seen. Cite only verified items in the thesis, or check the others first.

1. Tang, Hu, Liu (2013). Social recommendation: a review. *Social Network Analysis and Mining* 3(4). https://doi.org/10.1007/s13278-013-0141-9 · verified
2. Ma, Yang, Lyu, King (2008). SoRec: Social recommendation using probabilistic matrix factorization. *CIKM*. https://doi.org/10.1145/1458082.1458205 · verified
3. Wu et al. (2019). A neural influence diffusion model for social recommendation (DiffNet). *SIGIR*. https://arxiv.org/abs/1904.10322 · verified
4. Sharma et al. (2024). A survey of graph neural networks for social recommender systems. *ACM Computing Surveys* 56(10). https://doi.org/10.1145/3661821 · verified
5. Kamath, Sharma, Wang, Yin (2014). RealGraph: User interaction prediction at Twitter. *UEO Workshop at KDD*. https://www.ueo-workshop.com/wp-content/uploads/2014/04/sig-alternate.pdf · search only (title and authors)
6. Twitter (2023). the-algorithm (source code). https://github.com/twitter/the-algorithm · verified
7. Twitter Engineering (2023). Twitter's recommendation algorithm (blog). https://blog.twitter.com/engineering/en_us/topics/open-source/2023/twitter-recommendation-algorithm · search only (page returned 403)
8. Jamali, Ester (2010). A matrix factorization technique with trust propagation (SocialMF). *RecSys*. https://doi.org/10.1145/1864708.1864736 · verified
9. Sedhain, Sanner, Braziunas, Xie, Christensen (2014). Social collaborative filtering for cold-start recommendations. *RecSys*. https://researchportalplus.anu.edu.au/en/publications/social-collaborative-filtering-for-cold-start-recommendations/ · verified
10. Chen et al. (2009). Collaborative filtering for Orkut communities. *WWW*. https://doi.org/10.1145/1526709.1526801 · verified
11. Reddit (archived). `_sorts.pyx`, the "hot" function. https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/db/_sorts.pyx · verified
12. Shirriff (2013). How Hacker News ranking really works. https://www.righto.com/2013/11/how-hacker-news-ranking-really-works.html · verified
13. Meng, McCreadie, Macdonald, Ounis (2020). Exploring data splitting strategies for the evaluation of recommendation models. *RecSys*. https://arxiv.org/abs/2007.13237 · verified
14. Ji, Sun, Zhang, Li (2023). A critical study on data leakage in recommender system offline evaluation. *ACM TOIS* 41(3). https://doi.org/10.1145/3569930 · verified
15. Krichene, Rendle (2020). On sampled metrics for item recommendation. *KDD*. https://doi.org/10.1145/3394486.3403226 · verified
16. Cañamares, Castells (2020). On target item sampling in offline recommender system evaluation. *RecSys*. https://github.com/ir-uam/RecSys2020 · search only (code repository)
17. Ge, Delgado-Battenfeld, Jannach (2010). Beyond accuracy: evaluating recommender systems by coverage and serendipity. *RecSys*. https://doi.org/10.1145/1864708.1864761 · verified
18. McSherry, Najork (2008). Computing information retrieval performance measures efficiently in the presence of tied scores. *ECIR*. https://doi.org/10.1007/978-3-540-78646-7_38 · verified
19. Tang. Epinions and Ciao datasets. https://www.cse.msu.edu/~tangjili/datasetcode/truststudy.htm · verified
20. Lerman. Digg 2009 data. https://www.isi.edu/people-lerman/research/downloads/ · verified
21. Smucker, Allan, Carterette (2007). A comparison of statistical significance tests for information retrieval evaluation. *CIKM*. https://doi.org/10.1145/1321440.1321528 · verified
22. Holm (1979). A simple sequentially rejective multiple test procedure. *Scandinavian Journal of Statistics* 6(2). https://www.jstor.org/stable/4615733 · verified
23. Anagnostopoulos, Kumar, Mahdian (2008). Influence and correlation in social networks. *KDD*. https://iris.uniroma1.it/handle/11573/332226 · verified (repository record)
24. Chaney, Stewart, Engelhardt (2018). How algorithmic confounding in recommendation systems increases homogeneity and decreases utility. *RecSys*. https://arxiv.org/abs/1710.11214 · verified
25. Ferrari Dacrema, Cremonesi, Jannach (2019). Are we really making much progress? *RecSys*. https://arxiv.org/abs/1907.06902 · verified
26. bryc. PRNGs (notes on mulberry32, sfc32). https://github.com/bryc/code/blob/master/jshash/PRNGs.md · verified
27. Sandve et al. (2013). Ten simple rules for reproducible computational research. *PLoS Computational Biology*. https://doi.org/10.1371/journal.pcbi.1003285 · verified

---

## 11. Open items

1. **Defense date.** Needed to turn weeks into dates and to decide what to cut.
2. **Where the thesis LaTeX lives.** Proposal: copy the template to `.docs/latex/` at P9.
3. **Permission for git actions.** Tag, fast-forward `main`, create `thesis`, and push (P0, P8).
4. **Pre-thesis corrections.** Whether to edit `Latex/` and `docs/` (LightFM sentence, abstract numbers) or only fix them in the new thesis text.

---

## Change log

- 0.1 · 2026-10-14 · First version.
