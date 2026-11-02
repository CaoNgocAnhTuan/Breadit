# 01 · The problem and the research questions

[Guidance Manual](../Guidance-Manual.md) · English · [Tiếng Việt](../vi/01-problem-and-questions.md)

**After reading this you can:** say in two minutes what the thesis is about, why it matters, what it asks, what it claims and how a claim is judged.

Sources: `.docs/Thesis_Orientation.md` (direction A), super-plan §1, `.docs/supervisor-note.md`. Terms: [09 Glossary](09-glossary.md).

---

## 1. Where the thesis starts

**Breadit** is an X/Twitter-like social network built in the pre-thesis: posts, likes, comments, reposts, follows, communities, direct messages and real-time notifications (Next.js frontend, NestJS backend, Postgres, Redis).

The pre-thesis review (`Thesis_Orientation.md`) found four gaps. The thesis works on them:

| Gap | What is wrong | What the thesis does |
|---|---|---|
| 1 | "For You" is not personalized: it is newest first among the people you follow | a personal ranking, the hybrid score H |
| 2 | the pre-thesis report mentions a LightFM pipeline that does not exist | the thesis text corrects it; the architecture no longer includes it |
| 3 | `Follow` and `CommunityMember` exist in the database but no ranking uses them | the score uses both (trust and community affinity) |
| 4 | only system metrics (latency, cache hits), no quality metric | Recall@K, NDCG@K, coverage, with a statistical protocol |

## 2. Why the social graph?

A feed must choose a few posts out of many. Two kinds of signal are cheap and already in the database:
- **popularity** (likes, comments, reposts): good on average, the same for everyone;
- **the social graph** (who you follow, which communities you joined): personal, and available even for a new user who has not liked anything yet.

Large platforms use the social graph for exactly this. Twitter's RealGraph weights each pair of users by the predicted chance of a future interaction and calls it the most important component for ranking in-network tweets (references [5], [7] in super-plan §10).

The hard case is the **cold-start user**: someone with little or no history. Popularity cannot personalize for them, and a model that learns from history has nothing to learn from. But they usually follow a few people and join a community when they sign up. That is the signal the thesis uses.

## 3. The contributions

| | Contribution | Status |
|---|---|---|
| **C1** | The Breadit platform architecture (from the pre-thesis) | kept |
| **C2** | **Social-graph-aware hybrid ranking**: engagement + α·follow trust + β·community affinity, smoothed with a prior of strength m so a new user still gets a personal score; computed only from events before the ranking time; measured offline against tuned baselines | **new** |
| **C3** | The real-time WebSocket layer (from the pre-thesis) | kept |

C2 includes the evaluation itself: two data sources, a leakage-free protocol and a reproducible pipeline.

## 4. The research questions

**RQ1.** Does adding social-graph signals (follow trust and community affinity) to the ranking improve the "For You" feed over the current heuristic, especially for users with little history?

**RQ2.** How does the level of social interaction between users change the ranking quality? What is the minimum level where the social signal starts to help?

## 5. The hypotheses and how each is judged

Hypotheses were frozen before the first test-split run. Each has a rule written in advance, so the result cannot be read in a convenient way afterwards.

| | Claim | How it is judged |
|---|---|---|
| **H0** (sanity, checked first) | In the null world W0, where follows carry no influence, H does **not** beat BL2 | On `syn-W0-M`, the 95% CI of H − BL2 (NDCG@10, all users) must not lie above 0. If it does: a bug or a leak. Stop and fix |
| **H1** (RQ1) | For users with 0–4 earlier interactions, H has a higher NDCG@10 than BL2 | Holm-adjusted p < 0.05 **and** CI lower end > 0. Tested twice, each on its own: `syn-W2M-M` and `digg2009` |
| **H2** (RQ2) | The gain over BL2 grows with social density and is about zero for a user with no followee and no community | the gain is tabulated by density bin (experiment E3); shown with confidence intervals, no single p-value |

**Why BL2 is the reference.** BL2 is the Explore score the app uses today. The question is "better than what we have now", not "better than the weakest method".

**If a hypothesis fails,** the thesis reports it as it is. A negative result with a clean protocol is a valid result. The default feed then stays as it is.

## 6. What the thesis does not do

No graph neural network or other learned social model, no real-user pilot or A/B test, no impression logs, no Python in the main pipeline (super-plan §9). The time is four weeks (deadline 2026-11-20), and the question is about which signal helps, which a transparent score answers best. See [10 Defense Q&A](10-defense-qa.md), Q2.

## 7. The thesis in one picture

```
problem:  "For You" is not personal; new users get nothing personal
idea:     add follow trust + community affinity to the popularity score,
          smoothed so a new user still gets a personal signal
build:    one ranking package used by the app and by the evaluation
measure:  replay the past (no leakage), compare with tuned baselines,
          synthetic worlds (with a null world) + real Digg data
judge:    H0 gate first, then H1 on two datasets with a pre-written rule
deliver:  the default feed changes only if H1 and H0 pass
```

## 8. Check yourself

1. Which of the four gaps does the hybrid score close, and which does the evaluation close?
2. Why is a cold-start user hard for popularity and for learned models, but not for the social graph?
3. What would it mean if H beat BL2 in W0?
4. Why are there two H1 tests, and why is each judged on its own?
