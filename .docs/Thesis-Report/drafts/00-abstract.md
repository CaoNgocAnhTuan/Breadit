# Abstract

> **First draft 2026-11-22, before the supervisor's feedback.** Budget: one page, about 250–300 words. Numbers are macros from `.docs/results/p7-report/results-macros.tex`, as in Chapter 6 (written here as `\name`). Every result sentence is the same as a sentence or table of Chapter 6; the pairs are in the Result section of `.docs/works/2026-11-22-p9-ch9-front-back/design.md`. Remove this box and the notes at the end before the final version.

Breadit is a social platform that joins X-style following with Reddit-style communities. Its For You feed shows the posts of followed accounts newest first, so its order is not personal. This thesis asks whether adding the follow graph and the community memberships to the ranking improves the feed, most of all for users with little history (RQ1), and how much social interaction is needed before it helps (RQ2).

We built a hybrid score: the engagement score of the Explore feed plus a follow-trust term and a community-affinity term, with a prior that gives every user a score. We tested it offline with an as-of time rule, tuned baselines and Holm-corrected paired statistics, on a seeded synthetic generator and on the real Digg 2009 data. The hypotheses and settings were frozen before the test split, and the sanity check on a null world passed.

The main hypothesis (H1) failed on both data sets. For users with 0–4 earlier interactions, the gain in NDCG@10 over BL2 (the current Explore score) is \eTwoWTwoMNdcgTenZeroFourGain on the synthetic data (95% interval \eTwoWTwoMNdcgTenZeroFourCiLow to \eTwoWTwoMNdcgTenZeroFourCiHigh, Holm-adjusted *p* \eTwoWTwoMNdcgTenZeroFourPHolm) and \eTwoDiggNdcgTenZeroFourGainFull on Digg 2009 (Holm-adjusted *p* \eTwoDiggNdcgTenZeroFourPHolm). The gain does not grow with the number of followees, so RQ2 finds no threshold. Over all synthetic users the hybrid is better (NDCG@10 \eOneWTwoMNdcgHTenAllValue against \eOneWTwoMNdcgBLTwoTenAllValue), but almost all of this gain comes from the community term, which acts as a topic signal. On Digg the social terms change almost nothing, and the "hot" formulas of Reddit and Hacker News are far better (\eOneDiggNdcgBLFourTenAllValue and \eOneDiggNdcgBLFiveTenAllValue).

The platform pushes notifications and messages in real time over Socket.IO. One ranking package serves the live feed and the evaluation, and one command rebuilds every result and compares file hashes. The hybrid feed stays in the app as an option, and the default For You feed keeps its order.

**Keywords:** social recommendation, feed ranking, cold start, offline evaluation, reproducibility.

---

## Notes for the author (remove before the final version)

1. **The abstract and Chapter 6 say the same.** Each result claim is paired with the sentence or table of Chapter 6 that supports it (list in the Result section of the task). The H1 sentence follows Chapter 6.6: H1 fails on both tests. On the synthetic data the interval contains 0 and the Holm *p* is above the level; on Digg the lower end of the interval is above 0 by a very small amount, but the Holm *p* is above the level, and H1 needs both.
2. **Digg gain.** It is written with six decimals (`\eTwoDiggNdcgTenZeroFourGainFull`), as in Chapter 6. At three decimals it would print 0.000 and look like "no result".
3. **"Almost all of this gain comes from the community term, which acts as a topic signal."** The first half is E4 (Section 6.8). The second half is our reading of the generator, in Chapters 6 and 7 (a community is a topic in the generator). The abstract keeps it short and does not say "on real data".
4. **Length.** About 300 words, counting each number as one word. One page in the PDF (the build of 2026-11-22).
5. **No reference** is cited in the abstract.
