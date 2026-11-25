# H1 failed: why, and a revised hybrid score (Hv2)

Vietnamese version: `h1-negative-result-and-hybrid-v2.vi.md` (the same structure, line for line). This English version is the reference.

Discussion note for the supervisor meeting of 2026-11-30 · written 2026-11-25 · task `.docs/works/2026-11-25-p9-negative-result-note/`

How to read the numbers. `M:` is a key of `.docs/results/p7-report/macros.csv`. `R:` is a table of `.docs/results/p7-report/results.md`. `S:` is `.docs/super-plan.md`. `[n]` is the reference number of `S:` section 10. Each number has its source the first time it appears. Words in `code font` are names from the repository.

## 1. Summary

We tested one question: does adding follow trust and community affinity to the Explore score help users with little history? The hypothesis was H1. It failed on both co-primary tests.

- On Digg 2009, H and BL2 have the same NDCG@10, 0.024 (M: `eOneDiggNdcgHTenAllValue`, `eOneDiggNdcgBLTwoTenAllValue`). The gain in group 0–4 is 0.000 (M: `eTwoDiggNdcgTenZeroFourGain`).
- On `syn-W2M-M`, H beats BL2 over all users, but not in group 0–4: the gain is 0.023 and the 95% interval is −0.002 to 0.051 (M: `eTwoWTwoMNdcgTenZeroFourGain`, `...CiLow`, `...CiHigh`).
- Almost all of the synthetic gain comes from the community term. In our generator, a community is a topic. So H works there as a topic signal, not as a follow-graph signal.

Section 5 gives four causes. Two are measured. Two are our reading and were not tested. Section 7 proposes a revised score, Hv2, to be run offline only, as a clearly marked round 2. Section 9 asks you to decide five things.

## 2. What was tested

**Research question 1** (`methodology.tex`, section 3.1): "does adding social-graph signals (follow trust and community affinity) to the ranking improve the 'For You' feed over the current heuristic, especially for users with little history?"

**H1:** "For users with 0–4 earlier interactions, the hybrid score H has a higher NDCG@10 than BL2, the score of the current Explore feed. H1 has two co-primary tests: one on synthetic data (the middle-influence world) and one on real data (Digg 2009). Each test is judged on its own."

**H2:** "The gain over BL2 grows with social density (number of followees, amount of friend engagement in the pool). It is about zero when the user follows nobody and has no community."

**H0 (a sanity gate):** "In the null world W0, where follows are random, the follow part of the hybrid must not beat BL2." A win there would mean a bug or a leak.

**The hybrid score.** These formulas are the same as in `methodology.tex`, section 3.2:

```
H(p,u,t)         = engagement(p,t) + α · social(p,u,t) + β · community(p,u,t)
engagement(p,t)  = likes + 2·comments + 3·reposts − 0.25·ageHours
social(p,u,t)    = 1[u follows author(p)] · trust(u, author(p), t)
                 + Σ trust(u,f,t)   over followees f of u who engaged with p before t
trust(u,f,t)     = (n_uf + m/|F_u|) / (N_u + m)
community(p,u,t) = (c_{u,c(p)} + m · 1[u is a member of c(p)] / |M_u|) / (N_u + m)
```

Here `n_uf` is the number of u's earlier positives (likes, comments, reposts) on posts by f. `N_u` is all of u's earlier positives. `F_u` is the set of u's followees at t. `c_{u,c}` is u's earlier positives in community c. `M_u` is u's communities at t. A post outside any community has `community = 0`. The prior strength is `m = 5` (S: section 7). Every score is stored as `floor(score × 100)`.

**BL2** is the production Explore score, `engagement(p,t)` alone. The other baselines are BL0 (production For You), BL1 (newest first), BL2t (BL2 with a tuned age weight), BL3 (likes), BL4 (Reddit "hot"), BL5 (Hacker News) and BL6 (H-follow with every trust weight 1). BL2t, BL4, BL5, BL6 and H are tuned on validation data.

**NDCG@10.** Each user has one test item: the last post they liked, commented on or reposted. NDCG@10 is `1/log2(rank + 1)` if that post is in the top 10 of the ranked pool, and 0 if not. The gain is the mean over users of the paired difference H − BL2.

**The two datasets.**
- `syn-W2M-M`: 1,000 users and 20,000 posts from a seeded generator. Middle influence: social 2, community 2, homophily 0.7 (the worlds table of `methodology.tex`, section 3.4).
- `digg2009`: 336,047 users, 3,553 stories, 3,007,345 likes and 1,729,983 dated follows (`methodology.tex`, section 3.4). It has no communities, so β has no effect there.

**The decision rule** (fixed before the test split). H1 passes on a dataset only if, for NDCG@10 and group 0–4, the Holm-adjusted p is below 0.05 (the Holm level, `S:` section 7) and the lower end of the 95% interval is above 0. The **default feed rule** was fixed with it: "For You" switches to the hybrid only if H1 passes on both tests and the H0 gate passes.

**Freeze.** The hypotheses, the grids and the tuned values were frozen. The author approved the ten test configs, and the test split ran once (`S:` section 4, P7 status). For example, `eval/config/runs/p7-main.json` has `"testApprovedBy": "author"`.

## 3. Where the hybrid score came from

**The form.** The supervisor suggested it. It is Option A ("Hướng A") of `.docs/Thesis_Orientation.md`:

```
social_score(post, user) = engagement_score(post)
                         + α × Σ trust(user, friend)        # friends who liked or reposted the post
                         + β × community_weight(post, user)
trust(user, friend) = (times the user interacted with the friend's posts) / (all interactions of the user)
```

For users with no history, the Orientation (step 4, "Xử lý Cold-Start theo 3 phase") used three phases: 0 interactions (community membership only), 5 or more (community and follow trust), 20 or more (the full score).

The sample abstract of the Orientation hoped for "the largest gains observed for cold-start users with fewer than five prior interactions". This was a hope before any data. On the synthetic data, round 1 found the opposite order (section 4).

**What P1 added.** P1 (the literature step) added three things to this form. They stand in `S:` section 6, and `.docs/literature.md` checks each one against the papers.
- **The prior `m`.** Without it, `trust = n_uf / N_u` is 0/0 for a user with no history. The smoothed form is the m-estimate of Cestnik [28][29]: `(count + m × prior) / (total + m)`. One curve replaces the three phases. The weight of the prior is `m / (N_u + m)`.
- **The author term.** The Orientation sums trust only over friends who engaged. A new post by a followee that nobody has engaged with would get nothing. We added the author term, by analogy with RealGraph [5] and the Twitter code [6][7] (claim 5 of `literature.md`).
- **One hop.** Only the accounts u follows count. Graph neural networks are out of scope (`S:` section 9).

**What the literature does not give us.** Three of our choices are our own design, and `literature.md` says so: using the m-estimate for trust and for community, and the value of `m` (claim 4); one hop (claim 6); the form of the community term (decision D3, strength "weak"). The author term follows RealGraph only "in the spirit of": RealGraph [5] learns a probability of a future interaction with a logistic regression, and our trust is a smoothed count. The same note says [29] gives no recommended value of `m`.

**The search.** The search of 2026-10-24 did not find a paper from 2022 or later that adds follow trust and community affinity to engagement in one feed score (claim 10). This says something about that search only, not that nobody has done it. The closest paper found is [33], a matrix factorization model for rating prediction, known from its abstract only.

**What this means.** The form had not been tested elsewhere before. So its scale (engagement has no upper bound; the other two terms do) and its prior (a flat `1/|F_u|`) were our own choices, with no published result to check them. Round 1 is the first test of this form. Its failure is information about those choices.

**A loose name.** The Orientation calls Option A "SoRec-style". SoRec [2] is a probabilistic matrix factorization model for rating prediction (from its abstract; the full text was not read). H is a fixed formula with no learned factors. The thesis does not call H "SoRec-style".

## 4. The results

All numbers are NDCG@10 at K = 10, from the single test run. Sources: `R:` tables, and `M:` keys for the main numbers.

**H1 on both datasets** (`R:` e2, family F1; `M:` keys of the form `eTwo...`).

| | `syn-W2M-M` | `digg2009` |
|---|---:|---:|
| Users in group 0–4 | 174 | 20,644 |
| BL2 | 0.012 | 0.029 |
| H | 0.035 | 0.029 |
| Gain | 0.023 | 0.000 |
| 95% interval | −0.002 to 0.051 | 0.000 to 0.000 |
| Holm p | 0.680 | 0.335 |
| H1 | fails | fails |

The user counts are `M: eTwoWTwoMNdcgTenZeroFourN` and `M: eTwoDiggNdcgTenZeroFourN`. The Holm p values are `M: eTwoWTwoMNdcgTenZeroFourPHolm` and `M: eTwoDiggNdcgTenZeroFourPHolm`. At six decimals, the Digg gain is 0.000117 and its interval is 0.000015 to 0.000225 (`M: eTwoDiggNdcgTenZeroFourGainFull`, `...CiLowFull`, `...CiHighFull`). The interval is above 0 by a tiny amount, but the Holm p is not below 0.05, so H1 fails. The test users that were left out (the test post was not in the pool): 49 of 590 on `syn-W2M-M` and 3,547 of 68,120 on Digg (`M: eOneWTwoMLeftOutAllN`, `eOneWTwoMTestUsersAllN`, `eOneDiggLeftOutAllN`, `eOneDiggTestUsersAllN`).

**Reading.** The two failures are of a different kind. On Digg, the result is a clear zero: the interval is tiny and sits at 0. On `syn-W2M-M`, the result is unclear: the interval contains 0 and is wide, so a gain from about 0 up to 0.051 is consistent with the data. The first is a problem of the score. The second is partly a problem of how many users we have.

**The gain by history on `syn-W2M-M`** (`R:` e2; `M: eTwoWTwoMNdcgTenZeroGain`, `...OneFourGain`, `...FiveNineteenGain`, `...TwentyPlusGain`):
- 0 earlier interactions: 0.027 (59 users, interval −0.029 to 0.090).
- 1–4: 0.021 (115 users).
- 5–19: 0.031 (177 users, Holm p 0.378).
- 20 or more: 0.078 (190 users, interval 0.048 to 0.112, Holm p 0.002). This is the only row of F1 at K = 10 where both conditions hold.

On Digg the gain is about 0 in every group (`R:` e2).

**The metrics you proposed in the Orientation** (step 5: Recall@K and NDCG@K at K = 5, 10 and 20, and Coverage). All of them are computed for every method and every history group (`.docs/results/p7-main/summary.csv` and `coverage.csv`). The thesis shows NDCG@K at the three values of K (Appendix B) and Recall@10 and Coverage@10 (E1).

**Your group comparison, with your bounds** (5 or fewer against more than 20 earlier interactions). This table is **exploratory**. It was computed on 2026-11-25, after the test run, from `eval/results/p7-main/per_user.csv` (its SHA-256 is in the run manifest), with a 95% paired bootstrap interval and no p-value or Holm correction. Source: `.docs/results/p9-orient-groups/groups.csv`, written by `npm run orient -w @breadit/eval` (the first version of this table came from a script in the task folder; its intervals were drawn with another random generator). Since 2026-11-25 the same table is in the thesis (Chapter 6, Table "E2 with the groups of the Orientation"). Group 0–4 is in `R:` e2.

| Group | Dataset | Users | Recall@10 H / BL2 | Recall@10 gain (interval) | NDCG@10 gain (interval) |
|---|---|---:|---:|---:|---:|
| ≤5 | `syn-W2M-M` | 194 | 0.0825 / 0.0206 | 0.0619 (0.0155 to 0.1082) | 0.0383 (0.0108 to 0.0684) |
| >20 | `syn-W2M-M` | 184 | 0.1467 / 0.0054 | 0.1413 (0.0924 to 0.1957) | 0.0810 (0.0491 to 0.1158) |
| ≤5 | `digg2009` | 23,161 | 0.0548 / 0.0546 | 0.0002 (−0.0000 to 0.0005) | 0.0001 (0.0000 to 0.0002) |
| >20 | `digg2009` | 22,393 | 0.0489 / 0.0489 | −0.0000 (−0.0002 to 0.0001) | −0.0000 (−0.0001 to 0.0001) |

**Reading.** With the bound "5 or fewer", the synthetic interval is above 0 for both metrics. This group adds the 20 users with exactly 5 interactions to the 174 users of group 0–4. So the synthetic result for new users depends on where the bound is drawn, which is cause 3 (a small group). It does not change H1: H1 was frozen with group 0–4, NDCG@10 and the Holm p (section 2), and this table has no p-value. The Orientation gives both bounds: its sample abstract says "fewer than five prior interactions" (0–4), and its step 5 says "≤5". Users with more than 20 interactions gain the most on synthetic data, the opposite of the hope "better at cold start, not worse for existing users". On Digg, H is about equal to BL2 with every bound.

**E1: all methods, all users** (`R:` e1; `M: eOne...`).

| Method | `syn-W2M-M` | `digg2009` |
|---|---:|---:|
| BL0 | 0.005 | 0.026 |
| BL1 | 0.003 | 0.025 |
| BL2 | 0.009 | 0.024 |
| BL2t | 0.011 | 0.027 |
| BL3 | 0.007 | 0.023 |
| BL4 | 0.009 | 0.197 |
| BL5 | 0.009 | 0.199 |
| BL6 | 0.011 | 0.025 |
| H | 0.054 | 0.024 |

On Digg, BL4 and BL5 are about 8 times BL2 (`S:` section 4, P7 status; 0.197 and 0.199 against 0.024). On `syn-W2M-M`, H is about 6 times BL2 (0.054 against 0.009).

**Reading.** On `syn-W2M-M`, BL2 to BL6 all lie between 0.007 and 0.011, and only H is far above them. On Digg, H and the other non-time baselines lie between 0.023 and 0.027, and only the two time-decay baselines are far above them. So the data decide which part of the score matters.

**E4: which term matters, `syn-W2M-M`** (`R:` e4; the gain column is `M: eFourWTwoM...`).

| Variant | All users | Group 0–4 | Gain over BL2 |
|---|---:|---:|---:|
| BL2 | 0.009 | 0.012 | |
| H (m = 5) | 0.054 | 0.035 | 0.045 |
| H-follow (β = 0) | 0.016 | 0.019 | 0.007 |
| H-comm (α = 0) | 0.052 | 0.024 | 0.043 |
| H-noauthor | 0.055 | 0.031 | 0.046 |
| H-noengager | 0.051 | 0.026 | 0.042 |
| H (m = 0) | 0.056 | 0.027 | 0.047 |
| H (m = 2) | 0.060 | 0.043 | 0.051 |
| H (m = 10) | 0.050 | 0.034 | 0.041 |

On Digg, every variant of E4 has a gain of 0.000 (`M: eFourDiggNdcgHTenAllGain` and the other `eFourDigg...` keys).

**E3, social density** (`R:` e3). On `syn-W2M-M`, the gain is 0.044 for users with 0 followees and 0.030 for 20 or more (`M: eThreeWTwoMNdcgTenZeroGain`, `...TwentyPlusGain`). It does not rise with the number of followees. On Digg it is 0.000 in every bin. So H2 is not supported.

**E5, is the gain built into the data?** (`R:` e5). The gain over BL2 grows with the influence in the generator: 0.012 on W0, 0.029 on W1, 0.035, 0.045 and 0.076 on the low, middle and high W2 cells (`M: eFiveWZeroNdcgTenAllGain`, `eFiveWOneNdcgTenAllGain`, `eFiveWTwoLNdcgTenAllGain`, `eFiveWTwoMNdcgTenAllGain`, `eFiveWTwoHNdcgTenAllGain`). W0 and W1 have no influence, yet they show a gain. Other rows of E5:
- The H0 gate (H-follow on W0): gain 0.001, interval −0.004 to 0.006. The gate passes (`M: hZeroWZeroNdcgHFollowTenAllGain`, `...CiLow`, `...CiHigh`).
- H on W0 with the `syn-W2M-M` values (the "topic signal" row): 0.011, interval −0.001 to 0.023 (`M: eFiveWZeroTopicNdcgTenAllGain`, `...CiLow`, `...CiHigh`).
- `syn-W2M-M` with engagement times shuffled inside each post: 0.042, against 0.045 without the shuffle (`M: eFiveWTwoMShuffledNdcgTenAllGain`).

**Tuning** (`R:` tuning; `M: tuneWTwoMHChosen`, `tuneDiggHChosen`). The tuned α and β are at the top of the grid (1,024) on both datasets: 1024/1024 on `syn-W2M-M` and 1024/0 on Digg (β has no effect on Digg). The grid already had to be widened once, before the test split, for the same reason (`S:` change log 0.25).

## 5. Why it failed

Four causes. Each has its evidence and a label: **tested** (a measured result shows it) or **not tested (our reading)** (it fits the numbers, but no run isolated it).

### Cause 1. The scale of the three parts does not match

`engagement` has no upper bound. The social term is at most 2 (each sum of trust is at most 1, `discussion.tex`). The community term is at most 1. H adds them with weights α and β.

- Evidence: on Digg, all variants of H equal BL2 (gain 0.000), and the tuned α sits at the edge of its grid, 1,024. On `syn-W2M-M`, both weights sit at the edge. Validation NDCG@10 at α = β = 512 is 0.048086 and at 1,024 is 0.048342 (`M: tuneWTwoMHValNdcgTenFiveTwelveFull`, `tuneWTwoMHValNdcgTenTenTwentyFourFull`). The curve is nearly flat at the top. Our reading: the best score wants the social and community terms to dominate engagement, so the additive form is on the wrong scale. Digg stories have many likes (3,007,345 likes on 3,553 stories).
- A weak point of this reading: at α = 1,024 the social term can reach 2,048 points (1,024 × 2). That is not small next to hundreds of likes. So scale alone may not explain a gain of exactly 0. A second possible reason is that few pool stories get a non-zero social term on Digg: 27,824 of the 64,573 kept test users follow nobody (`R:` e3; 64,573 is 68,120 minus 3,547), and only about 59% of the voters are in the friend table (`S:` section 8).
- Label: **not tested (our reading)**. `discussion.tex` says the same ("This reading was not tested").
- A cheap check, not run: on the validation split, count how many pool posts get a non-zero social term, and how large the engagement gap is between rank 1 and rank 10.

### Cause 2. The BL2 base is weak in time

BL2 subtracts 0.25 points per hour of age (`methodology.tex`, section 3.2). The window is 7 days, 168 hours (`S:` section 7), so the age term is at most 42 points (0.25 × 168). On Digg, that is small next to the likes.

- Evidence: on Digg, BL4 and BL5 reach 0.197 and 0.199 and BL2 has 0.024 (`M: eOneDiggNdcgBLFourTenAllValue`, `eOneDiggNdcgBLFiveTenAllValue`, `eOneDiggNdcgBLTwoTenAllValue`). BL3 (likes only) has 0.023 (`M: eOneDiggNdcgBLThreeTenAllValue`), so BL2 is close to plain popularity. BL2t with its age weight at the top of its grid (4) reaches only 0.027 (`M: tuneDiggBLTwoTChosen`, `eOneDiggNdcgBLTwoTTenAllValue`). How fast a post gets old matters much more than who the user follows.
- On `syn-W2M-M` the base is not weak in time: BL4 and BL5 have 0.009, the same as BL2, and their tuned values sit at the weak-decay edge of their grids (divisor 720,000, gravity 0.6; `M: tuneWTwoMBLFourChosen`, `tuneWTwoMBLFiveChosen`). So this cause applies to Digg only.
- Label: **tested** (a direct comparison, E1 and E6). **Not tested (our reading):** that H on a better base would show a social gain.

### Cause 3. Cold start: the prior is flat, and group 0–4 is small

At `N_u = 0`, `trust(u,f,t) = (0 + m/|F_u|) / (0 + m) = 1/|F_u|` for every followee. Every joined community gets `1/|M_u|`. The social term can say "this post is by someone you follow", but not which followee the user likes. This happens exactly for the users of H1.

- Evidence: the gain on `syn-W2M-M` rises with history: 0.027 in group 0 and 0.078 in group 20 or more (section 4). Group 0–4 has only 174 users, so the interval is wide (−0.002 to 0.051). A real but small gain cannot be told from 0 with this many users. The prior strength changes group 0–4 in no clear line: 0.027 at m = 0, 0.043 at m = 2, 0.035 at m = 5 and 0.034 at m = 10, against 0.012 for BL2 (`R:` e4; one dataset, no interval).
- Label: **not tested (our reading)**. The trend with history fits it. No run replaced the flat prior with another prior.
- The wide interval is a separate problem, of power. Round 2 should not repeat it (section 8).
- The result is also sensitive to the bound of the group: with "5 or fewer" instead of 0–4 (20 more users), the synthetic interval is above 0 (section 4, the exploratory table).

### Cause 4. The gain is a topic signal, not the follow graph

- Evidence: H-comm gains 0.043 and H-follow gains 0.007, out of 0.045 for the full H (section 4). Removing the author term or the engager term changes the gain very little (0.046 and 0.042). W0 and W1 have no influence, yet they show a gain (0.012 and 0.029). The shuffle of engagement times keeps most of the gain (0.042). The gain at 0 followees (0.044) is larger than at 20 or more (0.030). In the generator, "one community per topic", so the community term counts the user's earlier likes on that topic.
- Our reading of E5: the gain comes from correlation (users like the topics they liked before), not influence (users like what their followees liked first). Telling these two apart is a known hard problem [23], and our tests do not settle it (`discussion.tex`).
- Two hints from the literature, both from abstracts only, so they are hints and not findings: [37] says item ratings are more influential than the trust graph in collaborative filtering, and [9] reports up to a 3-fold gain of Facebook page likes over three baselines, one of them based on Facebook friends, with no number for that baseline alone (`literature.md`, D2).
- Label: **tested** for "the gain comes from the community term, not the follow part" (E4, E5, E3). **Not tested** on real data: Digg has no communities, and the Hive check failed (`S:` section 4, P7 status). Whether a community is a topic on a real platform is open.

### What the four causes say together

Causes 1 to 3 are about the score. We can change a score, so they lead to Hv2. Cause 4 is about what the data reward. On synthetic data, the data reward the user's earlier topics. A better scale or base does not change that. So Hv2 cannot turn the synthetic result into a follow-graph result. It can only show, with a fair scale and the same base, whether the follow part adds anything.

## 6. What can change and what cannot

**What can change.** The design. P1 is still open: its "Done when" is that the supervisor confirms the research questions, the data and the design decisions (`S:` section 4). The formula of H, the baselines and the plan for round 2 are all open for you to decide. A frozen value (`S:` section 7: the grids, `m`, the master seed 20261014, the cut times) changes only when the author asks, with a dated line in the super-plan change log. A hypothesis changes the same way (`S:` section 1).

**What cannot change.** The test split has been seen. We saw H on it, and we saw BL4 and BL5 beat BL2 on Digg. A new score on the same test split is **post-hoc**. It must be reported as post-hoc, with no claim of a confirmatory test. Every cause in section 5 was found after the test result, so they are readings, not predictions.

**Round 1 stays in the thesis.** H1 failed on both co-primary tests. The default feed rule then fixed the app: "For You" stays as it is (`FEED_DEFAULT_ALGO` is empty). Hv2 would be a second round, in its own section, with its own label. It does not replace round 1 and it does not turn the failure into a pass. In the thesis, this means:
- round 1 and round 2 have separate tables and separate macros;
- every Digg number of round 2 carries the word "post-hoc";
- the wording of H1 and the answer to RQ1 for round 1 do not change.

The default feed rule was asked to you on 2026-11-12 (`S:` section 11, item 7), and P1 is still waiting for your answer.

## 7. Proposals

All proposals change the score only. They do not change the data, the protocol or the metrics. All use one new method id in `@breadit/ranking`. `H`, the live `social` feed and the app stay as they are. The rough costs are my estimates, not measured.

Each part of Hv2 answers one cause of section 5:

| Cause | Label | Part of Hv2 |
|---|---|---|
| 1. Scale | not tested (our reading) | A, and B (a log base) |
| 2. Weak base | tested (on Digg) | B |
| 3. Cold start | not tested (our reading) | C, simple form |
| 4. Topic signal | tested (on synthetic data) | none; Hv2 measures the follow part against the same base |

Files that every proposal touches (offline only):
- `packages/ranking/src/types.ts`: the new id in `MethodId`.
- `packages/ranking/src/scorers.ts`: a new case in `scorer()`.
- `packages/ranking/src/scorers.spec.ts`: unit tests.
- `eval/src/harness/config.ts` (`REQUIRED_PARAMS` is `Record<MethodId, ...>`, so the compiler asks for the new id), `eval/src/metrics.ts` (`METHOD_ORDER`), `eval/src/harness/freeze.ts` (tuning), `eval/src/report/tables.ts` and `eval/src/report/macros.ts` (rows and macro names).
- A new run config in `eval/config/runs/`. The α and β grid is in `eval/config/frozen-v1.json`; a new grid is a new frozen value.

### A. One scale for the three parts

- **Formula.** Put engagement on a log scale, so it is close to the size of the other terms. Form A1: `Hv2_A = ln(1 + eng0) + α·social + β·community`, with `eng0 = likes + 2·comments + 3·reposts` (engagement without the age term). Form A2 is a multiplicative boost: `(1 + eng0) · (1 + α·social + β·community)`. In logs, A2 is `ln(1 + eng0) + ln(1 + α·social + β·community)`, so A1 and A2 differ only in whether the boost is also compressed.
- **Fixes.** Cause 1.
- **Data.** Nothing new: the counts of the pool posts are already in `PostFeatures`.
- **Files.** The common files above only.
- **Cost.** About half a day (tests, the new grid, a validation run).
- **Risk.** The new α, β grid may again put the best value at its edge. The rule must be set before the run: how far to widen, and when to stop. Form A2 gives no lift to a post with `eng0 = 0`, so it weakens the author term, whose job is to lift new posts of a followee. A1 does not have this problem. Without B, A has no time term, so on Digg it cannot be expected to reach BL4 (not tested).

### B. A time-decayed base, compared with the same base

- **Formula.** Use the form of BL4 as the base: `base(p,t) = log10(max(likes, 1)) + (createdAt − t) / divisor`. Then `Hv2_B = base(p,t) + α·social + β·community`. One unit of base is a factor of 10 in likes, or `divisor` seconds of age. With `α = β = 0`, Hv2 is exactly BL4, so the social part can be measured alone against the same, tuned base.
- **Fixes.** Cause 2, and cause 1 at the same time: the BL4 form is already a log, so the social term (at most 2) and the community term (at most 1) are on the same scale as `log10(likes)` (about 3 for 1,000 likes). So in this form B also gives the one-scale idea of A.
- **Data.** Nothing new: likes and `createdAt`.
- **Files.** The common files above only. The BL4 form is already in `scorers.ts` (`case 'BL4'`), so the code is small.
- **Cost.** About half a day, with A.
- **Risk.** Two. First, on Digg a time-decayed base (BL4 or BL5) beats BL2 alone (0.197 and 0.199 against 0.024), so "Hv2 beats BL2 on Digg" would prove nothing about the social part. The reference must be the same base (BL4 tuned). Second, on `syn-W2M-M` the tuned BL4 and BL5 equal BL2 (0.009), so B will not change the synthetic result. The BL4 form is also the most sensitive to ties: its NDCG@10 on `syn-W2M-M` goes from 0.009075 to 0.007869 with the reversed tie-break (`M: eOneWTwoMNdcgBLFourTenAllValueFull`, `eSixWTwoMNdcgBLFourTenAllValueFull`). I use the BL4 form, not the BL5 form. The BL5 scorer gives a post with 0 likes the lowest band, so the author term could not lift it.

### C. A prior from the behaviour of all users

- **Formula (simple form).** Replace the flat `1/|F_u|` by the share of the crowd's positives. Let `P_f` be the number of positives (all users, before t) on the pool posts by f. Then `w_f = P_f / Σ_{g in F_u} P_g`, and `trust_C(u,f,t) = (n_uf + m · w_f) / (N_u + m)`. If the sum is 0, use `1/|F_u|`. The same for the community term: `w_c = P_c / Σ_{c' in M_u} P_c'` replaces `1/|M_u|`. The weights still sum to 1, so the bound "trust at most 1" stays. This is closer to the m-estimate of [29], whose prior is estimated from data, while ours is an even split that is not estimated (`literature.md`, D2, the mapping table).
- **Fixes.** Cause 3, for users with `N_u` near 0.
- **Data.** The simple form needs the positives on the pool posts, the authors and the communities of the pool posts. `FeedService` already loads them (step 5 of `rank()` in `apps/backend/src/feed/feed.service.ts`), and the harness builds them per pool post (`fastPostFeatures`). The full form needs more: the positives on posts older than the pool window, or the positives of users similar to u. That means new queries and more rows per request, which also changes the cost measured in E7. I do not propose the full form for round 2.
- **Files.** The common files above, plus `packages/ranking/src/features.ts` (a pure builder of `w_f` and `w_c` from the pool posts and their features), `packages/ranking/src/types.ts` (an optional field in `ScoreContext`, because a scorer sees one post at a time) and `eval/src/harness/run.ts` (the place that builds the context, line `const ctx = ...`). `features.spec.ts` gets the tests.
- **Cost.** About one day.
- **Risk.** `P_f` is also a popularity signal, and the base already counts popularity. C may count it twice. So C needs its own ablation: Hv2 with the flat prior against Hv2 with C.

### Other hybrid scores from the literature

Only references marked "verified" in `S:` section 10 are used. I say only what `S:` section 10 and `literature.md` say about them.
- **A fade of old interactions (RealGraph [5], full text).** RealGraph decays old interactions (section 2.1) and has one feature that is a daily exponentially decayed count (section 2.1.1). The author chose "no fade" on 2026-10-24 (PC2), to avoid a new parameter. **Out of round 2:** a fade changes how history counts, and the users of H1 have almost none. It can be an extra ablation later.
- **Two hops (DiffNet [3], full text).** In [3], two layers beat one by 2.50% (Yelp) and 2.96% (Flickr) on HR@10. That is a learned embedding model, so it is only a hint for a count. No source gives a rule for the trust of a friend of a friend (`literature.md`, D4). Digg's graph is incomplete: about 59% of the voters are in the friend table (`S:` section 8). **Out of round 2:** it is not tied to a cause in section 5, and it needs the follows of followees.
- **Interaction strength and trust measures ([33] and [35], abstract only).** [33] defines an interaction strength between users and links it to group participation, in a matrix factorization model for rating prediction. [35] proposes an asymmetric similarity measure for social trust, also inside a matrix factorization model. Both are learned models and the finding of an abstract may not be cited (`S:` section 10). **Out:** ideas only. Learned models are out of scope (`S:` section 9).

### Recommendation

**A + B + the simple form of C, offline only.** One new method id (a name such as `Hv2`), `H` unchanged, about 2 days of code and runs, plus the thesis text and the docs (the rule of `CLAUDE.md` asks for `docs/System_Architecture.md` and the Guidance Manual, both languages).

```
base(p,t)          = log10(max(likes, 1)) + (createdAt − t) / divisor
Hv2(p,u,t)         = base(p,t) + α · social_C(p,u,t) + β · community_C(p,u,t)
social_C, community_C: the terms of H with the prior of C instead of 1/|F_u| and 1/|M_u|
```

Hv2 with `α = β = 0` is BL4. With a very large `divisor`, the time term is almost 0: a log base with no time. With the flat prior, C is off. So every part has a switch for the ablations of section 8.

I expect the following, and I may be wrong.
- On `syn-W2M-M`, the gain will stay mostly the community term. None of A, B or C changes cause 4.
- In group 0–4 of `syn-W2M-M`, the interval may still contain 0, because the number of users stays low.
- On Digg, the base will be about 8 times BL2. The open question is whether the follow terms add anything on top of it.

If the follow terms add nothing on Digg at a fair scale, that is a stronger negative result than round 1. It is worth reporting.

## 8. How Hv2 would be tested honestly

1. **Write down first.** Before any run: the formula, the grids, the decision rule, the reference and the list of ablations, in a dated line of the super-plan change log. The author freezes and approves the test configs, as in round 1 (`"testApprovedBy": "author"`).
2. **Tune on validation only.** α, β and `divisor` are chosen on the validation split of each dataset, with a new grid in powers of 2 that is wide enough that the best value is not at its edge. The widening limit is fixed in step 1.
3. **A new synthetic seed for the confirmatory test.** Generate `syn-W2M-M` again with the same parameters and a new master seed. The master seed 20261014 is a frozen value (`S:` section 7), so the new seed is added next to it and does not replace it. The files of round 1 stay byte-identical, and `npm run thesis:repro` still passes. Tune on the validation split of the new seed. Test once on its test split. Each new seed gives another group 0–4 of about the size of round 1 (174 users), so the power stays low. Two seeds, or the size L that was cut (`S:` section 9), would help. This is a question for you.
4. **The ablations** (each is a setting of Hv2, so no extra code): the base alone (`α = β = 0`, the same as BL4); follow only (`β = 0`); community only (`α = 0`); no time (a very large `divisor`); the flat prior against C. Each comes with an interval and no p-value, as in E4.
5. **The decision rule.** The same form as H1: NDCG@10, group 0–4, Holm p below 0.05 and a lower interval end above 0. The primary reference is the same base (BL4 tuned). The comparison with BL2 and with H is reported next to it. The H0 gate runs again: Hv2 with β = 0 must not beat its base on W0 of the new seed.
6. **Digg is post-hoc.** Its test split has been seen. Tune on its validation split, run the test split, and report the result as **post-hoc**, next to round 1, with intervals and no confirmatory claim. A fresh real dataset would make the real test confirmatory. Flickr WWW 2009 [46] was kept as the second real set, but its favorites have only an order, not a time, so it needs a new adapter and a new as-of rule (`.docs/supervisor-note.md`, section 4). I do not propose it for round 2.
7. **The app.** The app keeps its feed. The default feed rule is the only way to change it, and it needs H1 to pass on both co-primary tests. With a post-hoc Digg test, even a pass could not meet the rule as it is written. So either the app stays whatever Hv2 shows, or you change the rule before the run, with a change-log line.

**How to read the outcomes of round 2.**
- Hv2 passes on the new synthetic seed, and on Digg it adds to its base: the scale and the base were part of the problem.
- Hv2 passes on the new synthetic seed only: the gain is again a topic signal from the community term, and the follow graph adds nothing on real data.
- Hv2 fails on both: the answer to RQ1 is "no" twice, and the second time with a fair scale and a fair base. That is a stronger negative result.

**What stays unchanged in the architecture.** `@breadit/ranking` is pure and shared. A new scorer touches `packages/ranking` and `eval/` only. `apps/backend/src/feed/feed.constants.ts` still maps `social` to `H`, so the parity test (live order equals harness order) is not affected. If Hv2 ever went live, A and B need no new data, C needs the pool-level builder in `FeedService.rank`, and the parity test and E7 must be repeated.

## 9. Questions for the supervisor

1. **The main result.** Do you accept that H1 failed on both co-primary tests, and that the thesis reports it as it is (round 1 unchanged), with the finding that the gain on synthetic data is a topic signal from the community term?
2. **Round 2 or future work.** Should Hv2 run as a marked second round (about 2 days of code and runs, plus the text of Chapters 3, 6, 7 and 9), or only be written as future work in Chapter 9?
3. **Which change.** If round 2: A + B + the simple form of C, as I recommend? And is a gain that comes from the community term (a topic signal) an acceptable answer to RQ1, or must the follow part add something over the same base?
4. **Post-hoc Digg and the app.** Is a post-hoc Digg result acceptable, next to a confirmatory result on a new synthetic seed? Should the default feed rule stay as written (the app then stays as it is), or be changed before the run? And do you want more power: a second seed or the size L?
5. **Dates.** What are the date of the full-draft check, the submission and the defense? They are not known to us (`S:` the opening paragraph, and section 11, item 1), and they decide whether round 2 fits.
