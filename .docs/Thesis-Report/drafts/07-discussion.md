# Chapter 7. Discussion

> **Draft, 2026-11-19.** Numbers are macros from `.docs/results/p7-report/results-macros.tex`, as in Chapter 6. A mark `[MACRO?: …]` is a number that has no macro yet. References in square brackets use the numbers of the super-plan §10 for now; they become the thesis bibliography later. Remove this box and the notes at the end before the final version.

This chapter explains what the results of Chapter 6 mean. Section 7.1 answers RQ1 and Section 7.2 answers RQ2. Section 7.3 looks at what the hybrid score really uses, and Section 7.4 says what the results mean for Breadit. Section 7.5 lists the limits of the study.

The main finding is a negative one: on these data, the follow graph adds little to the ranking, and the hybrid does not help users with little history more than the current heuristic. This is still a valid result. The hypotheses, the tuning and the test configs were frozen before the test split was run, the H0 gate passed, and every offline number can be rebuilt byte for byte with one command. So the result is not an accident of the setup.

## 7.1 RQ1: does the social signal help users with little history?

**Answer: not on these data.** H1 fails on both co-primary tests (Section 6.6).

**Synthetic data.** On `syn-W2M-M`, the hybrid is better than BL2 over all users (\eOneWTwoMNdcgHTenAllValue against \eOneWTwoMNdcgBLTwoTenAllValue), and its gain is positive in every history group. But the gain is largest for users with a long history and smallest for new users, which is the opposite of what RQ1 hoped for. In group 0–4 the interval contains 0.

We see two reasons, and both may play a part:
- **Few users.** Group 0–4 holds only \eTwoWTwoMNdcgTenZeroFourN users, so the interval is wide (\eTwoWTwoMNdcgTenZeroFourCiLow to \eTwoWTwoMNdcgTenZeroFourCiHigh). A real but small gain for new users cannot be told apart from 0 with this many users.
- **The score has little to say about a new user.** For a user with no history, the smoothing (Chapter 3) gives every followee the same trust and every joined community the same weight. The score then only says "this post is by someone you follow" or "this post is in a community you joined". It cannot say which of them the user likes. As history grows, the counts replace the prior, and the score becomes personal. This fits the result that the gain grows with history (Section 6.6). The smoothing makes the score safe for new users, but it does not make it strong for them.

**Digg.** On `digg2009`, the social terms change almost nothing (Section 6.6 and E4 in Section 6.8). Our reading is a matter of scale. The engagement part of the score grows with the number of votes, and Digg stories have many votes, because every story in the data reached the front page (Chapter 3). The social part has a fixed upper bound: by the formula in Chapter 3, each sum of trust values is at most 1, so the social term is at most 2, and α times it is small next to hundreds of votes. The tuning chose the largest α in the grid, which also suggests that the grid did not reach the scale Digg needs. This reading was not tested.

**What does work on Digg is time.** BL5 divides the score by a power of the post's age. BL4 adds a time term to the logarithm of the likes, which works like an exponential decay of the likes. BL2 only subtracts a small linear age term. On Digg, BL2 is close to plain popularity (BL3, Table 6.3), and the "hot" formulas are far better than both (Section 6.5). Even BL2t, with the largest age weight of its grid, stays far below them [MACRO?: tuned age weight of BL2t on digg2009]. So on these data, how fast a post gets old matters much more than who the user follows.

## 7.2 RQ2: when does the social signal start to help?

**Answer: on these data, there is no level of follows where it starts to help.** H2 is not supported (Section 6.7). On the W2 cells, the gain is already there for users who follow nobody, and it does not rise with the number of followees. On Digg it is 0 in every bin.

The gain at 0 followees comes from the community term, which does not need any follows. So the question of RQ2, "how much social interaction is needed", gets a different answer than expected: the signal that helps is the user's own history inside communities, not the size of the follow graph.

E5 adds one more view (Section 6.9). The gain grows with the strength of influence that the generator puts into the data, from W0 through W1 to the three W2 cells. So when influence is in the data, the hybrid does pick it up. But W0 and W1 have no influence and still show a gain, and shuffling the engagement times inside each post keeps most of the gain. Both point the same way: most of the gain comes from correlation (users like the same topics as before), not from influence (users like what their followees liked first). Telling influence and correlation apart is a known hard problem [23]. Our tests do not settle it, but they show that the gain does not depend much on the order of engagements.

This study measures social density by the number of followees only. H2 also names the amount of friend engagement in the pool, which was not measured (Section 7.5).

## 7.3 What the hybrid score really uses

E4 shows that on `syn-W2M-M`, almost all of the gain comes from the community term (H-comm gains \eFourWTwoMNdcgHCommTenAllGain of the \eFourWTwoMNdcgHTenAllGain of the full score), while the follow terms alone add \eFourWTwoMNdcgHFollowTenAllGain (Section 6.8).

In the generator, a community is a topic. The community term counts the user's earlier likes in the post's community, so it counts the user's earlier likes on that topic. In practice, the hybrid works on synthetic data as a **topic-interest signal**: "you liked posts in this community before, so here is another one". This is real personalization, and it explains why the full hybrid beat BL2 even on W0 (Section 6.1). But it is not the social signal that RQ1 was about. On real data, a community is not always one topic, so this result may not carry over. Digg has no communities, and the Hive check failed (Section 7.5), so we could not test it on real data.

Two smaller points from E4:
- **The author term.** Removing it does not lower the gain (\eFourWTwoMNdcgHNoauthorTenAllGain against \eFourWTwoMNdcgHTenAllGain). We added it so that a new post by a followee is not ignored (Chapter 3). On these data it is not needed, but it does no harm.
- **The prior strength `m`.** `m` = 2 gives a higher gain than the frozen `m` = 5 (\eFourWTwoMNdcgHMTwoTenAllGain against \eFourWTwoMNdcgHTenAllGain). The difference is small, it is on one dataset, and `m` was frozen before the test split, so we keep `m` = 5. Tuning `m` with α and β is future work.

## 7.4 What this means for Breadit

**The default feed stays as it is.** The default feed rule (Chapter 3) was set before the test split: "For You" switches to the `social` feed only if H1 passes on both co-primary tests and the H0 gate passes. H1 failed, so "For You" keeps its current order. The `social` feed stays in the app as an option (`algo=social`). Changing the default is one environment variable (`FEED_DEFAULT_ALGO`), so a later study can switch it without new code.

**Cost is not the reason.** E7 shows that the `social` feed takes the same time as the other two feeds on our setup (Section 6.12). The decision rests on the quality results only.

**The offline numbers describe the live feed.** The live feed and the evaluation call the same ranking package, and the parity test checks that the live order equals the harness order (Chapter 5). So the results of Chapter 6 are about the code that runs in the app, not about a separate model.

**A stronger time decay may help Explore, but only on some data.** On Digg, BL4 and BL5 are far better than the production Explore score (BL2). On `syn-W2M-M`, they are not better than BL2 (Table 6.3). So the gain depends on the data, and a change to Explore needs its own test on Breadit data. We list it as future work and do not change Explore.

## 7.5 Limits of the study

**Synthetic data.** We designed the generator, so the synthetic results show that the method works under our assumptions, not that it works for real users. The W0 null world, W1, the three W2 cells and the timestamp shuffle (E5) guard against a result that is built into the data. The fact that a community is a topic in the generator is the main assumption behind the community result.

**Digg.** The data is small and special (Chapter 3): one month of stories, only stories that reached the front page, so every story is already popular. Many voters are not in the friend table and have no follows. The follow graph is one crawl, so a follow that was removed before the crawl is missing. The files come from an Internet Archive copy, because the original host is gone. Digg also has no communities.

**No real data for the community term.** We found no public dataset with a follow graph, dated interactions and dated community membership together. Hive was the only candidate, and the check failed: the public copy of the data refused access, and the paid service keeps memberships without a join time (super-plan §8). So the community term, which carries most of the synthetic gain, has synthetic evidence only.

**Statistical power.** Group 0–4 of `syn-W2M-M` is small (Section 7.1), so a small gain for new users may exist and not be detected. A larger synthetic world would help, but size L was cut from the plan.

**Tuning at the edge of the grid.** The chosen α and β are the largest values of the widened grid (Section 6.2), so the best values may be larger. The live feed uses these edge values.

**Choices made after looking at validation results.** Two changes were made before the test split: the H0 gate moved to H-follow, and the grids were widened (Section 6.1). Both were decided from validation results only and recorded with their date, but they are still choices made by us after seeing data.

**What the offline test measures.** Each user has one test item: the last post they liked, commented on or reposted. The test asks whether a method ranks that post high. It does not measure whether users are happier with the feed. The logged likes also depend on what the users were shown at the time, for example the Digg front page. Recommendation systems trained or tested on such logs can be biased towards what was already shown [24].

**Social density.** E3 uses only the number of followees, not the amount of friend engagement in the pool, which H2 also names.

**One hop only.** Trust uses 1 hop: only the accounts that the user follows count, and the accounts that those accounts follow do not (Chapter 2). DiffNet, a learned model, gives its best result at 2 steps [3], so 1 hop may leave a gain unused. Our trust is a count, so this is only a hint. We did not test 2 hops.

**No fade of trust over time.** Trust is a smoothed count of earlier positives, so an old like counts as much as a new one. RealGraph decays old interactions [5]. We did not test whether a fade would help.

**No learned social baseline.** Every baseline is a fixed formula or a count, tuned like the hybrid. We did not compare with a learned social model such as SoRec [2] or DiffNet [3], and such a model may be stronger.

**Cost.** E7 ran on one machine with one virtual user and the page cache off, and the machine was not quiet at the start (its load is in the E7 manifest). It shows that the three feeds cost about the same for one user. It says nothing about many users at once.

## 7.6 Summary

The social-graph-aware hybrid did not help users with little history more than the current heuristic, on synthetic data or on Digg. On synthetic data it is better than BL2 over all users, but the gain comes from the user's history in communities, which acts as a topic signal, and it grows with history. On Digg, the follow signal is too small next to the vote counts, and a stronger time decay is what matters. The `social` feed costs the same as the other feeds, and its live order equals the evaluated order. So the app keeps its current "For You" and offers the `social` feed as an option. Chapter 9 lists the future work that follows from these limits.

---

## Notes for the author (remove before the final version)

**1. Missing macro.** The tuned age weight of BL2t on `digg2009` (Section 7.1). Add it with the Chapter 6 list in one task.

**2. Waiting for the supervisor.** Section 7.3 presents the community term as a topic-interest signal. This is question 2 of the P7 note. If the supervisor disagrees, 7.2 and 7.3 change.

**3. Citations.** [23] is verified from its Crossref record only (no full text), so it is cited for the question of influence and correlation, not for a finding. [24] is verified (arXiv); check that the sentence in 7.5 matches its abstract before the final version.

**4. Two claims that are our reading, not a test.** The scale reason for Digg (7.1) and "the score has little to say about a new user" (7.1) are explained from the formula, not measured. The text says so. A small extra run (for example H on Digg with a larger α) could test the first one, but it would be a new experiment after the test split, so it must be reported as exploratory.
