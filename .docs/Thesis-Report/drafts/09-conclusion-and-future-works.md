# Chapter 9. Conclusion and Future Works

> **First draft 2026-11-22, before the supervisor's feedback.** Budget: 3 pages (2–4 allowed). Numbers are macros from `.docs/results/p7-report/results-macros.tex`, as in Chapter 6 (written here as `\name`). The bug IDs (T6, N3 and so on) are IDs of `.docs/Bugs Report.md`, as in Chapter 8. Remove this box and the notes at the end before the final version.

This chapter closes the thesis. Section 9.1 answers the two research questions, and Section 9.2 says what each contribution delivered. Section 9.3 gives the limits in short, and Section 9.4 lists the future work.

## 9.1 Answers to the research questions

**RQ1: not on these data.** Adding the follow graph and the community memberships to the ranking did not improve the For You feed for users with little history. For users with 0–4 earlier interactions, the gain in NDCG@10 over BL2 is \eTwoWTwoMNdcgTenZeroFourGain on `syn-W2M-M`, with a 95% interval from \eTwoWTwoMNdcgTenZeroFourCiLow to \eTwoWTwoMNdcgTenZeroFourCiHigh, and \eTwoDiggNdcgTenZeroFourGainFull on `digg2009`. The Holm-adjusted *p* is \eTwoWTwoMNdcgTenZeroFourPHolm and \eTwoDiggNdcgTenZeroFourPHolm. So H1 fails on both co-primary tests (Section 6.6).

**RQ2: there is no level where the social signal starts to help.** The gain is already there for users who follow nobody (\eThreeWTwoMNdcgTenZeroGain on the middle W2 world), and it does not rise with the number of followees. On Digg it stays at \eThreeDiggNdcgTenZeroGain in every bin of followees. So H2 is not supported (Section 6.7).

**What the hybrid score does use.** Over all users of `syn-W2M-M`, the hybrid reaches an NDCG@10 of \eOneWTwoMNdcgHTenAllValue, against \eOneWTwoMNdcgBLTwoTenAllValue for BL2. Almost all of this gain comes from the community term: H-comm alone gains \eFourWTwoMNdcgHCommTenAllGain and H-follow alone gains \eFourWTwoMNdcgHFollowTenAllGain (Section 6.8). In the generator a community is a topic, so the term works as a topic signal (Chapter 7). On Digg, the hybrid and BL2 give the same NDCG@10 (\eOneDiggNdcgHTenAllValue), and the two "hot" formulas BL4 and BL5 are far better (\eOneDiggNdcgBLFourTenAllValue and \eOneDiggNdcgBLFiveTenAllValue).

## 9.2 Contributions as delivered

**C1. A hybrid social networking architecture.** Breadit joins communities with threaded discussion, X-style following and a personal timeline in one platform. Chapter 4 designs it, Chapter 5 describes it, and all automatic tests of Chapter 8 pass.

**C2. Social-graph-aware hybrid ranking for the For You feed.** It was delivered as four things:
- the hybrid score: the Explore score plus a follow-trust term and a community-affinity term, with two weights tuned on validation data and a prior that gives every user a score;
- an offline evaluation with an as-of time rule, one global cut time, full ranking, tuned baselines, paired statistics with Holm correction, a null world and real data;
- one ranking package for the live feed and the evaluation, with a parity test that checks that the live order equals the order of the evaluation;
- one command that rebuilds every result and compares every output file with a recorded hash.

The result of C2 is negative (Section 9.1). The `social` feed is in the app as an option (`algo=social`). On our setup it costs the same time as the other two feeds (a median of \eSevenSocialMedian ms for page 1, against \eSevenChronoMedian ms for `chrono`, Section 6.12). The default For You feed keeps its order, because H1 failed, and one environment variable (`FEED_DEFAULT_ALGO`) can change it later.

**C3. A real-time interaction layer.** Breadit pushes notifications, direct messages, typing signals and the forced logout of a banned user over Socket.IO. Real socket clients test it (for example TC-11 and TC-12 in Chapter 8), and the demonstration shows it. It is tested for function and not for speed.

## 9.3 Limits in short

The answers hold under the limits of Section 7.5. The synthetic data come from our own generator. Digg is small and special (one month, only front-page stories) and has no communities, and no public data set had follows, dated actions and dated memberships together, so the community term has synthetic evidence only. Group 0–4 of `syn-W2M-M` has \eTwoWTwoMNdcgTenZeroFourN users, so a small gain could be missed. The chosen α and β are at the edge of the grid. And the test is offline: it does not tell whether users are happier.

## 9.4 Future work

### 9.4.1 The ranking study

- **Real data for the community term.** Find a data set with follows, dated actions and dated community memberships. Hive was the one candidate, and it could not be accessed (Chapter 7). The community term carries the synthetic gain and has no real-data test.
- **More users and a better measure of density.** Build the synthetic size L, which was cut from the plan, so that group 0–4 is larger. Measure social density also by the friend engagement in the pool, which H2 names and E3 did not use.
- **Digg and the prior.** Run a larger α grid on Digg to test the reading about scale (Chapter 7); it would be exploratory, because the test split was used. Tune *m* with α and β.
- **A stronger time decay for Explore.** BL4 and BL5 beat BL2 on Digg, but not on the synthetic data. Test them on Breadit data first.
- **A richer social signal.** Use 2 hops of the follow graph, let trust fade with time, and add learned social baselines such as SoRec [22] or DiffNet [23].
- **Real users.** A pilot with an impression log, then an online A/B test. If H1 then passes, `FEED_DEFAULT_ALGO` changes the default.

### 9.4.2 The platform

Chapter 8 (Section 8.3) lists 8 open items that are future work: the four items of one schema migration (T6, N3, N10 and the schema part of R4) and four small items (R5, N7, N9 and B8).
- **The schema migration.** T6: likes, saves and follows have no unique key, so two fast requests make a duplicate row; the migration removes the duplicates and adds the keys. With it come N3 (one conversation for a pair of users), N10 (one report for a user and a post) and the schema part of R4 (unused models and columns).
- **R5.** The list of users to connect with is built in memory; page it in the database.
- **N7.** Small API mistakes: an unknown profile gives 200 and not 404, `%` in a search works as a wildcard, and an empty search returns a different response shape.
- **N9.** Follow, unfollow and follow again sends the notification again.
- **B8.** The notification of a comment like says "liked your post".

The packages that need a major version (NestJS 12 and Fastify 5, the rest of R3) are also left for later. Two kinds of test are also missing: the delay of a socket message, and an automatic test of the frontend.

### 9.4.3 Learned models

The pre-thesis report said that the For You feed had an offline pipeline with matrix factorization (LightFM). This was wrong. Breadit has no learned model. Before this thesis the For You feed was ordered by time only, and now it has three rule-based options (`chrono`, `engagement` and `social`); the default is still newest first. A learned recommender is a good next step: for example matrix factorization trained on likes, comments and reposts, with richer signals such as view time, which Breadit does not record today. It can be compared with the hybrid under the same protocol.

## 9.5 Closing remark

The thesis set out to make the For You feed personal with the follow graph and the communities. On these data this does not help new users more than the current heuristic, and the hypotheses, the tuning and the test configs were frozen before the test split, so the negative answer is not an accident of the setup. Breadit now has a feed that can be ranked three ways, a test that tells which way is better, and a method that anyone can rebuild.

---

## Notes for the author (remove before the final version)

1. **Sources of the future work.** The ranking items come from Chapters 1, 2, 3 and 7 (the size L, friend engagement, the scale reading of Digg, *m*, the Explore time decay, 2 hops, fading trust, learned social baselines, a pilot and A/B test) and from the super-plan §9 (what was cut). The 8 platform items are the open items of Bugs Report §6 "Future work", the same list as Chapter 8 Section 8.3. The six "before sharing" items (B1, S4, S6, B5, R3, R6) are named in Chapter 8 too. Hive is from Chapter 7 and `.docs/implementation-plan.md` §5.
2. **The LightFM sentence** (super-plan chapter map, Bugs Report §7 item 1; question 4 of the supervisor note). It says what the pre-thesis report said, that it was wrong, and what is true. The old report is not edited. If the supervisor prefers not to name the old report, cut the first sentence and the word "This".
3. **"Real socket clients test it (for example TC-11 and TC-12)".** TC-11 and TC-12 are the two socket cases of Table 8.2; the full socket suite is in Appendix A.
4. **No result number is typed.** The numbers that appear are macros. The typed items are names and settings (0–4, the history group of H1; 95%, the interval level of Chapter 3; "2 hops"; the counts of list items such as "8 open items" and "six more items").
5. **Citations.** SoRec and DiffNet use the keys `ma2008` and `wu2019` of `references.tex`; no new key is needed.
6. **Length.** Three pages in the PDF (pages 70 to 72, the build of 2026-11-22). The last page has about three free lines, so the supervisor's feedback may push the chapter to four pages, which the budget allows.
7. **Chapter 9 has the label `ch:concl`** (Chapters 1 to 8 name it in plain words, "Chapter 9").
