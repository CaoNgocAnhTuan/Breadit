# Thesis progress report

Cao Ngọc Anh Tuấn (ITCSIU21244) · 2026-10-22
Direction A: Social-Graph-Aware Hybrid "For You" feed · Deadline: 2026-11-20

---

## 1. Summary

I chose Direction A from the thesis orientation. So far I have frozen the pre-thesis system as the baseline, tested it fully, fixed the 14 problems that matter most, and written the research plan. The method, the datasets and the evaluation are designed but not built yet. Before I build them, I would like your answer on four questions (section 8).

---

## 2. What has been done

**The baseline is frozen.** The pre-thesis code is tagged `v1-prethesis` (commit `6f7b884`). Every thesis result is compared with this version.

**The pre-thesis system was checked from end to end.** I read the whole codebase and listed 26 suspected problems. Then I ran the full system (curl scripts, a Socket.IO script and Chrome) and tested each one: 25 were confirmed, 1 was half confirmed, and the run found 10 new ones. Six more small items came up during the fixes, so there are 42 findings in total.

**14 findings are fixed, each with a test.** I fixed the ones that are on the thesis path, crash pages, or leak data. Each fix started with a test that failed. The same curl script gave 42 passed and 53 failed before the fixes, and 95 passed and 0 failed after. 99 unit tests and 108 integration tests pass (source: `.docs/Bugs Report.md` §1). Fixes on the thesis path include:
- Repost and comment counts included deleted rows, and the Explore score reads those counts (T1, T2).
- The "popular users" list was sorted by the wrong number (T8).
- Posts waiting for approval in a community could be opened by anyone (T10).

The other 28 findings are listed by priority. Six of them touch the thesis. Five are fixed inside the phases in section 7. The sixth, duplicate likes and follows (T6), does not affect the results: generated data has no duplicates, and the social feed counts each followee once.

**Four problems in the pre-thesis report need correcting in the thesis text:**
- "Future Works" says the For You feed has an offline pipeline using "Matrix Factorization / LightFM" (`Latex/chapters/conclusion.tex`, line 88). No such pipeline exists.
- The abstract says the average response time is under 45 ms, the cache cuts database reads by 85%, and messages arrive within 12 ms. Chapter 5 reports 3.40 ms, a cache hit rate of 69.19% and 23.62 ms. The abstract's numbers appear nowhere else.
- The k6 results file has 588 of 828 requests failed (71%), but chapter 5 says the error rate is under 1%. The likely cause is the old rate limit of 120 requests per minute per route. The file stores no status codes, so this is likely, not proven.
- The non-functional requirements still state the old limit of 120 requests per minute. It is now 1,000.

**The research plan is written.** `.docs/super-plan.md` (version 0.4) fixes the questions, the method, the data, the evaluation and the phases. One rule runs through it: every number in the thesis comes from one command that gives the same result on every run (`npm run thesis:repro`). The thesis text uses these numbers through generated macros, so the abstract and the results cannot disagree again.

**How I work.** I build the thesis with an AI coding assistant (Claude Code). Every change goes through a written spec, a design and a plan, which I review and approve before any code is written. Automatic checks stop code that would make results change between runs, for example unseeded random numbers.

---

## 3. The problem

Today the For You feed shows the user's own posts and the posts of the accounts they follow, newest first. It has no ranking, it leaves out community posts, and it does not use who the user actually interacts with. A new user who follows nobody sees only their own posts.

The orientation says the feed is the same for everyone. More exactly, everyone gets the same newest-first rule, limited to the accounts they follow.

The schema already holds a social graph (`Follow` and `CommunityMember`), but no ranking uses it. The pre-thesis measured only system numbers (latency, cache hits), not the quality of what the feed shows.

---

## 4. Research questions and hypotheses

**RQ1.** Does adding social-graph signals (follow trust and community affinity) to the ranking improve the For You feed over the current heuristic, especially for users with little history?

**RQ2.** How does the level of social interaction between users change the ranking quality? What is the minimum level where the social signal starts to help?

- **H1 (RQ1).** For users with 0–4 earlier interactions, the hybrid has a higher NDCG@10 than the engagement heuristic (BL2). The test passes if the paired 95% confidence interval of the difference is above 0 after Holm correction.
- **H2 (RQ2).** The gain over BL2 grows with social density (number of followees, friend engagement). It is about zero for a user who follows nobody and has no community.
- **H0 (sanity check).** In a world with no social influence, the hybrid must not beat BL2. If it does, there is a bug or a leak in the evaluation.

If H1 or H2 fails, the thesis reports it as it is. A negative result with a clean method is still a valid result.

---

## 5. The proposed method

The hybrid score extends the existing engagement heuristic with the two social signals from the orientation:

```
H(p, u, t) = engagement(p, t) + α · social(p, u, t) + β · community(p, u, t)

engagement(p, t)   = likes + 2·comments + 3·reposts − 0.25·ageHours      (the current Explore score)
trust(u, f, t)     = (n_uf + m / |F_u|) / (N_u + m)
social(p, u, t)    = [u follows author(p)] · trust(u, author(p), t)
                   + Σ trust(u, f, t) over followees f who engaged with p before t
community(p, u, t) = (c_u,c(p) + m · [u is a member of c(p)] / |M_u|) / (N_u + m)
```

In words:
- **Follow trust** is the share of u's past interactions that went to f's posts. A post gets credit when its author is someone u trusts, and when people u trusts have engaged with it.
- **Community affinity** is the share of u's past interactions that happened in the post's community.
- **The prior `m`** spreads trust evenly over u's followees and communities when u has no history yet. That is what lets the method help cold-start users.
- Every count uses only events before time t, and α and β are tuned on held-out data, never on the test data.

**Two changes to the orientation's formula, for your review:**
- **An author term.** In the orientation's formula, a new post by someone u follows gets nothing until a friend engages with it. The author term gives it credit at once. This follows the idea of Twitter's RealGraph, which weights the links between users by their past interactions.
- **One curve instead of three phases.** The orientation uses three cold-start phases (0, ≥5 and ≥20 interactions). With the prior, the weight of the social guess, `m / (N_u + m)`, falls smoothly as history grows, so one formula covers all users. The phases stay as reporting groups.

All three parts can be read and checked, so the ranking stays explainable, in line with Breadit's goal of transparent discovery.

**In the app**, the feed gets a new option `algo=social`, next to `chrono` and `engagement`. The app and the evaluation run the same scoring code, and a test checks that both give the same order.

---

## 6. Data and evaluation

**Synthetic data is the main source.** The live platform has no real users, and the seed data has no real history. The orientation suggests simulating interactions with a Pareto distribution in that case (20% of users make 80% of the actions), and a seeded generator does that. It builds three worlds:
- **W0:** interactions depend on interests only, and follows have no influence. This is the control: here the hybrid must not win.
- **W1:** follows and interactions both come from shared interests, still with no influence.
- **W2:** three levels of social influence: low, middle and high.

W0 and W1 show that a positive result is not built into the data. There are two sizes: S (200 users, 4,000 posts) and M (1,000 users, 20,000 posts).

**One public dataset, if one fits.** I will choose it in the next phase, against four criteria:
- a follow graph with timestamps;
- timestamped interactions on items written by users in the same graph;
- community membership;
- terms of use that allow thesis work, and a size that runs on a laptop.

The first candidate is Digg 2009. Others to check: Epinions and Ciao, the Flickr favorites data, and a Weibo retweet dataset. I have found no public dataset with all three of follows, interactions and communities, so the community term will probably be tested on synthetic data only.

**Protocol.** Each user's last positive interaction (like, comment or repost) is the test item, and the one before it is the validation item. Every feature uses only events before that time. Each method ranks the full candidate pool; there is no sampling of negative items, which can change which method looks best.

**Metrics.** Recall@K (equal to HitRate@K, since there is one test item per user), NDCG@K and Coverage@K, for K = 5, 10 and 20. Results are split by how many earlier interactions a user has: 0, 1–4, 5–19 and 20 or more. The orientation's groups (≤5 and >20) overlap at 5 and leave out users with 6–20 interactions, so these groups cover everyone.

**Baselines.**

| Orientation | This thesis |
|---|---|
| BL1 Chronological (current For You) | BL0 current For You (followees first, newest first) and BL1 plain newest first |
| BL2 Engagement heuristic | BL2 the production Explore score |
| BL3 Global popularity | BL3 like count |
| (new) | BL4 Reddit "hot" and BL5 Hacker News ranking, two cheap and well-known formulas, so the baselines are not weak |

The proposed method is H. Two ablations remove one signal each: H-follow (no community term) and H-comm (no follow term).

**Statistics.** For each user, the difference against the reference method. A paired bootstrap 95% confidence interval and a paired randomization test (10,000 each), with Holm correction for the many comparisons.

**Experiments.**
- **E1:** all methods compared.
- **E2:** cold-start users (RQ1).
- **E3:** where the social signal starts to help (RQ2).
- **E4:** which part of the score matters (ablations).
- **E5:** is the result built into the data (W0, the W2 levels, a timestamp shuffle).
- **E6:** do ties change the result.
- **E7:** the cost of the new feed: latency with k6 and database queries per request. A k6 run counts only if no request fails, so the pre-thesis 71% failure cannot repeat.

---

## 7. Plan to the deadline

| Phase | What it delivers |
|---|---|
| P0 Baseline freeze | Pinned Node and Docker versions, so results repeat on any machine |
| P1 Literature, RQ and data lock | Literature notes with design decisions, the dataset choice, a 3–4 page survey (core of chapter 2) |
| P2 Implementation blueprint | The module map, data formats, measurement plan and task list |
| P3 Synthetic generator | Worlds W0–W2 at sizes S and M |
| P4 Public dataset (if one fits) | The chosen dataset in the same format |
| P5 Ranking package and harness | Shared scoring code, metrics, baselines, statistics, a first baseline table for you |
| P6 Social feed in the app | `algo=social` in the live feed |
| P7 Experiments | E1–E7 tables and figures |
| P8 Reproduction package | One command rebuilds every number |
| P9 Writing | The thesis chapters |
| P10 Defense package | Slides, demo, final checks |

Because of the deadline, some parts are out of scope: graph neural networks (DiffNet), learned social baselines (SoRec, SocialMF), a pilot with real users, the Epinions dataset, a database clean-up migration, and showing users why a post was ranked. If time runs short, the public dataset goes first, then the finer experiments. The control world W0, the leakage tests and the reproduction command stay in any case.

---

## 8. Questions for you

1. Do you confirm RQ1, RQ2 and the hypotheses?
2. Is the data choice acceptable: synthetic worlds as the main source, plus one public dataset if one fits, or synthetic data only if none fits?
3. Do you agree with the two changes to the formula (the author term and the single cold-start curve), the history groups, and the scope cuts in section 7?
4. Is 20 November the written submission or the defense? Are there required chapters or a page limit?
