# Chapter 1. Introduction

> **Draft, 2026-11-22.** Budget: about 5 pages. Numbers are macros from `.docs/results/p7-report/results-macros.tex`, as in Chapter 6; the `\e…` names below are those macros. References in square brackets use the numbers of the super-plan §10 for now. Remove this box and the notes at the end before the final version.

This chapter introduces the thesis. Section 1.1 gives the background and Section 1.2 the problem. Section 1.3 explains the words of the title. Section 1.4 states the research questions and the hypotheses, and Section 1.5 the contributions. Section 1.6 gives the scope, and Section 1.7 the outline of the other chapters.

## 1.1 Background

A social platform shows each user a feed of posts. The order of the feed matters, because a user reads the top of it and often stops there. So every large platform has a rule that decides which post comes first. The rules go from "newest first", through fixed formulas, to learned models. Two fixed formulas are well known: the "hot" sort of Reddit [11] and the ranking of Hacker News [12]. Both combine the votes of a post with its age. Twitter, now X, describes a For You timeline that mixes posts from accounts the user follows with posts from other accounts. Its engineering post says that Real Graph, a model that predicts the likelihood of engagement between two users, is the most important component in ranking the posts of followed accounts [7]. Chapter 2 reviews this work.

Breadit is the platform of this thesis. It was built as the pre-thesis project and it combines two kinds of social site. Like X, users follow other users and read a timeline of posts. Like Reddit, users join communities and post in them. Users can also write text and media posts, comment in threads, like and repost, send direct messages and get notifications in real time. It is a web application with a Next.js frontend, a NestJS backend, a PostgreSQL database, Redis and Socket.IO (Chapter 5).

Breadit has several feeds. Two of them matter here. The **For You** feed shows the posts of the user and of the accounts the user follows, newest first, and it holds no community posts. The **Explore** feed ranks the recent posts of all users with an engagement score, which grows with likes, comments and reposts and falls with the age of a post (Chapter 3), and it limits the number of posts per author on a page. The database stores who follows whom and who joined which community. But these facts only decide which posts a feed may show. They never change the order of the posts.

## 1.2 Problem statement

The For You feed of Breadit is not personal in its order. A post of a followed account that the user never likes or comments on is placed only by its time, and so is a post of a followed account that the user engages with every day. A user who follows nobody sees only their own posts, so the feed of a new user is nearly empty.

This is a missed chance. From the first day of an account, Breadit knows two kinds of social information: whom the user follows, and which communities the user joined. A new user has no likes yet, but may already have followed some accounts and joined some communities. If the ranking used this, a new user could get a better feed before the platform knows anything else about them. This is the cold-start problem: a user with little history cannot be served well by a method that only learns from history.

Two more problems make the question hard to answer. First, Breadit had no measure of feed quality. The pre-thesis report measured the speed of the system (latency and cache), and no number said whether a feed puts the right posts first. Second, Breadit has no real users yet, so there is no log of real behaviour to test on. Offline tests of recommenders have known traps: using data from the future [14], sampled metrics [15], weak baselines [25] and, with synthetic data, a result that the generator built into the data. A test that ignores these traps can give a result that is not true.

The problem of this thesis is therefore: **how can the For You feed of Breadit use the follow graph and the community memberships in its ranking, and how can we show, by a clean and repeatable measurement, whether this helps, most of all for users with little history?**

## 1.3 What the title means

The registered title is "Breadit: A real-time hybrid social networking platform with social-graph-aware personalized feed ranking". Its words have a precise meaning in this thesis.

**Real-time.** The server pushes events to the browser over a WebSocket connection (Socket.IO), without a page reload. Breadit pushes four kinds of event: new notifications, direct messages and their read state, typing signals in a conversation, and a forced logout when an admin bans the account. Chapter 4 designs this layer, Chapter 5 describes how it is built, and Chapter 8 tests it. "Real-time" here means push delivery. This thesis does not measure how long a delivery takes.

**Hybrid social networking platform.** Breadit combines two kinds of social site. Like X (Twitter), users follow other users and read a timeline of posts. Like Reddit, users join topic communities, and a post can belong to a community that its author is a member of.

**Social-graph-aware personalized feed ranking.** The "For You" feed can be ranked by a hybrid score. It adds two social signals to the engagement score of the current Explore feed: trust in the users one follows, and affinity to the communities one joined (Chapter 3). The word "hybrid" therefore has a second meaning, the mix of engagement and social signals. The text always says "hybrid score" for this second meaning.

**The ranking runs on request.** The feed is ranked when the user opens or reloads it, and each page is cached for 10 seconds (Chapter 5). New posts are not pushed into a feed that is already open. The real-time layer and the feed ranking are separate parts of the system: the first delivers events, the second orders posts.

## 1.4 Research questions and hypotheses

The goal is to make the For You feed personal by using the follow graph and the community membership, and to find out by measurement whether this helps, mostly for new users. Two questions follow.

**RQ1.** Does adding social-graph signals (follow trust and community affinity) to the ranking improve the "For You" feed over the current heuristic, especially for users with little history?

**RQ2.** How does the level of social interaction between users change the ranking quality? What is the minimum level where the social signal starts to help?

Each question has a hypothesis. The hypotheses were written down and frozen before any test result existed (Chapter 3).

- **H1 (RQ1).** For users with 0–4 earlier interactions, the hybrid has higher NDCG@10 than BL2. It passes if the paired 95% confidence interval of the difference is above 0 after Holm correction. Two co-primary tests, each with this pass rule and each reported on its own. Test 1 is on synthetic data: the middle cell of world W2, size M. The other two W2 cells are reported as a sweep. Test 2 is on real data: Digg 2009, if its pool at the cut time T keeps enough users with 0–4 earlier interactions.
- **H2 (RQ2).** The gain over BL2 grows with social density (number of followees, amount of friend engagement in the pool). It is about zero when the user follows nobody and has no community.
- **H0 (sanity).** In the null world W0 (no social influence), H-follow (the hybrid with β = 0, at the α chosen on the middle W2 cell) must not beat BL2. Follows are random in W0, so a win means a bug or a leak. Stop and fix before any other result is used.

In these texts, the hybrid is the hybrid score of Chapter 3, and BL2 is the score of the current Explore feed. NDCG@10 is a ranking measure: for each user, it asks at which rank a method puts the next post that the user really engaged with. Holm correction controls the error when many comparisons are made [22]. Chapter 3 defines all of these, the worlds, Digg 2009 and the exact decision rule for H1. The condition on Digg was met: its group of users with 0–4 earlier interactions holds \eTwoDiggNdcgTenZeroFourN users (Chapter 6).

If H1 or H2 fails, the thesis reports it as it is. A negative result with a clean protocol is still a valid result.

**What was found.** Each hypothesis was tested once, on the frozen configuration. The sanity gate H0 passes. H1 fails on both co-primary tests. On the synthetic world, the gain in NDCG@10 for users with 0–4 earlier interactions is \eTwoWTwoMNdcgTenZeroFourGain (95% interval from \eTwoWTwoMNdcgTenZeroFourCiLow to \eTwoWTwoMNdcgTenZeroFourCiHigh, Holm-adjusted p \eTwoWTwoMNdcgTenZeroFourPHolm). On Digg 2009, the gain is \eTwoDiggNdcgTenZeroFourGainFull (Holm-adjusted p \eTwoDiggNdcgTenZeroFourPHolm). H2 is not supported. Chapter 6 gives all the results and Chapter 7 explains them: on these data, the gain of the hybrid comes mostly from the community term, which acts as a topic signal, and the follow graph adds little.

## 1.5 Contributions

The thesis has three contributions. C1 and C3 come from the pre-thesis and are kept. C2 is new.

**C1. A hybrid social networking architecture** (kept from the pre-thesis). Breadit joins Reddit-style communities, with threaded discussions, and X-style following and a personal timeline in one platform. Chapter 4 designs it and Chapter 5 describes it. This thesis checked the parts that it needs against the current code.

**C2. Social-graph-aware hybrid ranking for the For You feed** (new). The hybrid score adds a follow-trust term and a community-affinity term to the engagement score of Explore, with two weights tuned on validation data. A smoothing with a prior gives every user a score, also a user with no history. All three parts can be read and checked, and there is no hidden model. C2 comes with four things:
- an offline evaluation: an as-of temporal split with one global cut time, full ranking of each user's pool, tuned baselines, paired statistics with Holm correction, a null world to check that the result is not built into the data, and real data from Digg 2009;
- one ranking package, used by the live feed and by the evaluation, and a test that the live order equals the order of the evaluation, so the offline numbers describe the feed that users get;
- one command that rebuilds every result of the thesis and compares every output file with a recorded hash;
- the result itself: on these data, H1 is not supported (Section 1.4).

The `social` feed is built, tested and available in the app as an option (`algo=social`). It did not become the default, because H1 failed. The For You feed keeps its current order, and a later study can change the default with one environment variable (Chapter 7).

**C3. A real-time interaction layer** (kept from the pre-thesis). Breadit pushes notifications, direct messages, typing signals and the forced logout of a banned user over Socket.IO, with a Redis adapter so that more than one backend process can deliver events (Chapter 5).

## 1.6 Scope

The thesis tests the ranking offline. It has no real-user pilot, no impression log and no online A/B test, because Breadit has no real users. It does not use graph neural networks and it has no learned social baseline. The follow signal uses one hop of the follow graph. The real-time layer is tested for function and not for speed. Chapter 7 lists the limits of the study, and Chapter 9 lists the future work.

## 1.7 Outline of the thesis

- **Chapter 2, Literature Review,** reviews social recommendation, feed ranking in practice and offline evaluation, and states the gap that the thesis fills.
- **Chapter 3, Methodology,** defines the hybrid score, the baselines, the data, the evaluation protocol, the tuning, the statistics and the way results are rebuilt.
- **Chapter 4, System Analysis and Design,** gives the requirements, use cases, activity and sequence diagrams, the architecture and the database of the platform.
- **Chapter 5, Implementation,** describes the technology, the backend, the real-time layer, the feed in the app, the ranking package, the evaluation code and the repro command.
- **Chapter 6, Experiments and Results,** reports the tuning, the sanity gate and the experiments E1 to E8.
- **Chapter 7, Discussion,** answers RQ1 and RQ2, says what the hybrid score really uses and what the results mean for Breadit, and lists the limits.
- **Chapter 8, Test Cases and Demonstration,** summarizes the tests of the system and shows the demonstration.
- **Chapter 9, Conclusion and Future Works,** gives the answers again, the contributions and the future work.

---

## Notes for the author (remove before the final version)

1. **Notes of 2026-11-19, applied.** Note 1: the cache time is now written as 10 seconds in Section 1.3, because Chapter 5 gives the same value. Note 2: Section 1.5 says that the `social` feed is built and available as an option, and that the default did not change.
2. **Exact words.** RQ1, RQ2, H1, H2 and H0 are copied from the super-plan §1. Only the cross-references of the super-plan were taken out of H1: "(section 7)", "(P4)" and "(P2 checks this)". Chapter 3 states RQ2 in other words ("the amount of social interaction … where the social signal starts to help"). If you want one wording everywhere, change Chapter 3 to the words above.
3. **Results in this chapter.** Section 1.4 gives the H1 numbers through macros only. If the report script changes a macro, this text follows it.
4. **Sources not used.** The pre-thesis introduction cites papers on information overload and on flat replies. They are not in the verified list of the super-plan §10, so this chapter does not cite them.
5. **Page check.** About 5 pages once typeset.
