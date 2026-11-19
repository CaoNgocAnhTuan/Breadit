# Chapter 6. Experiments and Results

> **Draft, 2026-11-19.** Every result number is a macro from `.docs/results/p7-report/results-macros.tex`, which `npm run report -w @breadit/eval` writes from the result CSVs. A mark `[MACRO?: …]` is a number the text needs that has no macro yet; the list is in "Notes for the author" at the end. "Table 6.x" points to a file in `.docs/results/p7-report/tables/`. Remove this box and the notes before the final version.

This chapter gives the results of the offline experiments E1 to E6 and E8, and of the cost benchmark E7. Chapter 3 describes the data, the protocol, the methods and the statistics, so this chapter only reports what was measured. Chapter 7 discusses what the results mean.

All quality numbers use NDCG@10 unless a table says otherwise. "Gain" always means the paired difference H − BL2 per user, averaged over users. BL2 is the production Explore score, the reference of H1.

## 6.1 How the experiments were run

**Datasets.** Five synthetic worlds of size M (`syn-W0-M`, `syn-W1-M`, and the three W2 cells `syn-W2L-M`, `syn-W2M-M`, `syn-W2H-M`) and the real dataset Digg 2009 (`digg2009`). H1 has two co-primary tests: `syn-W2M-M` (the middle W2 cell) and `digg2009`.

**Order of work.** First, every tuned parameter was chosen on the validation items only, all before the cut time T. Second, the choices were frozen into the test configs, and the author approved them. Third, the test split was run once. No test result was seen before the tuning was frozen.

**Two changes before the test split.** Both were decided from validation results only, and both are recorded in the super-plan change log (version 0.25):
- **The H0 gate now tests H-follow, not the full H.** On W0, the full hybrid beat BL2 on validation, almost only through the community term. In the generator a community is a topic, so this term carries topic interest even when there is no social influence. H-follow (β = 0) has only the follow terms, and follows are random in W0, so it is the right null test.
- **The grids were widened.** The best α and β were at the top of the first grid. The α and β grid was extended, and the baseline grids were widened past their edges (Chapter 3 gives the final grids).

**Statistics.** For `syn-W2M-M` and `digg2009`, family F1 holds the H1 comparisons (H − BL2 for each K and history group) and family F2 holds H against every other baseline. Each family is corrected with Holm on its own. All other comparisons get a bootstrap confidence interval and no p-value. H1 passes on a dataset only if, for NDCG@10 in group 0–4, the Holm-adjusted p is below the Holm level **and** the lower end of the 95% confidence interval is above 0.

**Reproducibility.** Every offline run of this chapter (all but E7) was made a second time from empty folders, and every result file was byte-identical. The command `npm run thesis:repro` rebuilds all of them from the raw data and compares each file with the merged manifest `.docs/results/manifest.json`. It passed on the development machine and on a clean clone of the repository. The E7 timings are repeatable, not identical (Section 6.12).

## 6.2 Tuning results

Table 6.1 (`tuning.tex`) lists the value chosen for each tuned method on each dataset.

On `syn-W2M-M`, H chose α = β = [MACRO?: tuned α and β of H on syn-W2M-M]. This is the top of the widened grid, so the tuning still stopped at the edge. On `syn-W2M-M`, the validation gain from the second-highest grid value to the top one was small [MACRO?: validation gain from α = β = 512 to 1,024 on syn-W2M-M]. On `digg2009`, H chose the same α and β = 0. Digg has no communities, so β has no effect there, and the tie rule picks the smaller value.

The live `social` feed uses the `syn-W2M-M` values (Chapter 5). The parity test checks that the live feed order equals the harness order with these values.

## 6.3 Test users and left-out users

Table 6.2 (`leftout.tex`) gives the number of test users and of left-out users by history group. A user is left out when the test post is not in the user's candidate pool.

`syn-W2M-M` has \eOneWTwoMTestUsersAllN test users, and \eOneWTwoMLeftOutAllN of them are left out. `digg2009` has \eOneDiggTestUsersAllN test users, and \eOneDiggLeftOutAllN are left out. After this, the H1 group 0–4 holds \eTwoWTwoMNdcgTenZeroFourN users on `syn-W2M-M` and \eTwoDiggNdcgTenZeroFourN users on `digg2009`.

## 6.4 H0 gate

The gate compares H-follow with BL2 on the null world W0, with the α chosen on `syn-W2M-M`. The gain is \hZeroWZeroNdcgHFollowTenAllGain, with a 95% confidence interval from \hZeroWZeroNdcgHFollowTenAllCiLow to \hZeroWZeroNdcgHFollowTenAllCiHigh. The interval contains 0, so H-follow does not beat BL2 when follows are random. **The gate passes**, and the other results can be used.

## 6.5 E1: all methods

Table 6.3 (`e1.tex`) compares all methods on the test split, over all users, at K = 10.

On `syn-W2M-M`, H has an NDCG@10 of \eOneWTwoMNdcgHTenAllValue, against \eOneWTwoMNdcgBLTwoTenAllValue for BL2. The best other baselines are BL2t and BL6 [MACRO?: NDCG@10 of BL2t and BL6 on syn-W2M-M, all users]. H also covers fewer distinct posts than BL2: Coverage@10 is \eOneWTwoMCovHTenAllValue for H and \eOneWTwoMCovBLTwoTenAllValue for BL2.

On `digg2009`, H and BL2 have the same NDCG@10 (\eOneDiggNdcgHTenAllValue and \eOneDiggNdcgBLTwoTenAllValue) and the same Coverage@10 (\eOneDiggCovHTenAllValue). The two "hot" baselines are far better than both: BL4 (Reddit) and BL5 (Hacker News) reach [MACRO?: NDCG@10 of BL4 and BL5 on digg2009, all users].

## 6.6 E2: users with little history (H1)

Table 6.4 (`e2.tex`) gives the gain of H over BL2 for each history group, with its 95% confidence interval and the Holm-adjusted p (family F1). This is the main test of the thesis.

**`syn-W2M-M`.** In group 0–4, the gain is \eTwoWTwoMNdcgTenZeroFourGain, with a confidence interval from \eTwoWTwoMNdcgTenZeroFourCiLow to \eTwoWTwoMNdcgTenZeroFourCiHigh and a Holm p of \eTwoWTwoMNdcgTenZeroFourPHolm. The interval contains 0 and the p is above the Holm level, so **H1 fails on `syn-W2M-M`**. The gain is positive in both parts of the group (\eTwoWTwoMNdcgTenZeroGain in group 0 and \eTwoWTwoMNdcgTenOneFourGain in group 1–4), but the intervals are wide.

**`digg2009`.** In group 0–4, the gain is \eTwoDiggNdcgTenZeroFourGain at three decimals [MACRO?: Digg gain in group 0–4 with more decimals]. The lower end of the interval is above 0, but only by a very small amount [MACRO?: Digg CI low and CI high in group 0–4 with more decimals]. The Holm p is \eTwoDiggNdcgTenZeroFourPHolm, above the Holm level. H1 needs both conditions, so **H1 fails on `digg2009`**.

**Other groups.** On `syn-W2M-M`, the gain grows with history. It is largest for users with 20 or more earlier interactions [MACRO?: syn-W2M-M gain, CI and Holm p in group 20+]. This is the only F1 row at K = 10 where both conditions hold. In group 5–19, the interval is above 0, but the Holm p is not below the level [MACRO?: syn-W2M-M Holm p in group 5–19]. On `digg2009`, the gain is near 0 in every group.

## 6.7 E3: social density (H2)

Table 6.5 (`e3.tex`) and Figure 6.1 (data: `fig-e3-density.csv`) give the gain by the number of followees the user has at the test time. [Figure 6.1 is not drawn yet.]

On the three W2 cells, the gain is already positive for users who follow nobody: \eThreeWTwoLNdcgTenZeroGain (low influence), \eThreeWTwoMNdcgTenZeroGain (middle) and \eThreeWTwoHNdcgTenZeroGain (high). For users with 20 or more followees, it is \eThreeWTwoLNdcgTenTwentyPlusGain, \eThreeWTwoMNdcgTenTwentyPlusGain and \eThreeWTwoHNdcgTenTwentyPlusGain. So the gain does not rise with the number of followees; on all three cells it is lower at 20 or more than at 0. The bin 1–4 holds only one user in each synthetic world, so it is not read.

On `digg2009`, the gain is 0 in every bin (for example \eThreeDiggNdcgTenZeroGain at 0 followees and \eThreeDiggNdcgTenTwentyPlusGain at 20 or more).

H2 says that the gain grows with social density and is about 0 for a user who follows nobody and has no community. Neither part holds on these data, so **H2 is not supported**. This experiment measures density by the number of followees only.

## 6.8 E4: which term matters

Table 6.6 (`e4.tex`) removes one term of H at a time and changes the prior strength `m`. Every row is the gain over BL2 on all users.

**Terms (`syn-W2M-M`).** The full H gains \eFourWTwoMNdcgHTenAllGain. H-comm (α = 0, community term only) gains \eFourWTwoMNdcgHCommTenAllGain, while H-follow (β = 0, follow terms only) gains \eFourWTwoMNdcgHFollowTenAllGain. So almost all of the gain comes from the community term. Removing the author term gives \eFourWTwoMNdcgHNoauthorTenAllGain, and removing the engager term gives \eFourWTwoMNdcgHNoengagerTenAllGain: each of the two follow parts changes the result very little.

**Prior strength `m` (`syn-W2M-M`).** With `m` = 0, 2, 5 (the frozen value) and 10, the gain is \eFourWTwoMNdcgHMZeroTenAllGain, \eFourWTwoMNdcgHMTwoTenAllGain, \eFourWTwoMNdcgHTenAllGain and \eFourWTwoMNdcgHMTenTenAllGain. `m` = 2 gives the highest gain. The frozen value was kept, because it was fixed before the test split.

**`digg2009`.** Every variant gains 0 over BL2 (for example \eFourDiggNdcgHTenAllGain for H and \eFourDiggNdcgHFollowTenAllGain for H-follow). There is no H-comm row, because Digg has no communities.

## 6.9 E5: is the result built into the data?

Table 6.7 (`e5.tex`) runs H against BL2 in every synthetic world, each with its own tuning, and adds two control runs.

**Worlds.** The gain grows with the strength of social influence in the generator: \eFiveWZeroNdcgTenAllGain in W0 (no influence, no homophily), \eFiveWOneNdcgTenAllGain in W1 (homophily only), and \eFiveWTwoLNdcgTenAllGain, \eFiveWTwoMNdcgTenAllGain and \eFiveWTwoHNdcgTenAllGain in the low, middle and high W2 cells. In W0 the interval starts at \eFiveWZeroNdcgTenAllCiLow. W0 and W1 have no influence, so their gain comes from the topic signal in the community term (Section 6.1), not from influence.

**H on W0 with the `syn-W2M-M` values.** The gain is [MACRO?: E5 row "H on W0, values of syn-W2M-M": gain and CI], and the interval contains 0.

**Shuffled timestamps.** In a copy of `syn-W2M-M` where the times of the engagements are shuffled inside each post, the gain is \eFiveWTwoMShuffledNdcgTenAllGain (interval from \eFiveWTwoMShuffledNdcgTenAllCiLow), against \eFiveWTwoMNdcgTenAllGain without shuffling. Most of the gain stays, so it does not depend much on who engaged first.

## 6.10 E6: ties

Table 6.8 (`e6.tex`) repeats E1 with the reversed tie-break. With it, H gives \eSixWTwoMNdcgHTenAllValue and BL2 gives \eSixWTwoMNdcgBLTwoTenAllValue on `syn-W2M-M`, and H and BL2 both give \eSixDiggNdcgHTenAllValue on `digg2009`: the same values as in E1. Over all methods and both datasets, NDCG@10 changes by at most [MACRO?: largest NDCG@10 change in E6]. Ties do not change any result of this chapter.

## 6.11 E8: a larger pool

Table 6.9 (`e8.tex`) runs the main comparison on `syn-W2M-M` again with the larger pool (W_L and N_L, Chapter 3). It includes BL6, the baseline with the highest validation NDCG@10 on this dataset.

With the larger pool, H drops from \eOneWTwoMNdcgHTenAllValue to \eEightWTwoMNdcgHTenAllValue, and BL2 from \eOneWTwoMNdcgBLTwoTenAllValue to \eEightWTwoMNdcgBLTwoTenAllValue. The order of the methods does not change, and H stays far above BL2.

## 6.12 E7: the cost of the three feeds

E7 measures the live backend, not the harness, so it is a Class R result: repeatable, not identical. The setup is frozen (Chapter 3): one machine, the page cache off, one virtual user, page 1 of one `algo` for each pair of the parity sample, five rounds with the first one dropped as warm-up. A run counts only if no request fails, and no request failed. The `social` feed runs with the tuned α and β of Section 6.2. The machine and its load are recorded in `.docs/results/p7-e7/manifest.json`.

Table 6.10 (`e7.tex`) gives the results. The median time for page 1 is \eSevenChronoMedian ms for `chrono` (95% interval \eSevenChronoCiLow to \eSevenChronoCiHigh), \eSevenEngagementMedian ms for `engagement` (\eSevenEngagementCiLow to \eSevenEngagementCiHigh) and \eSevenSocialMedian ms for `social` (\eSevenSocialCiLow to \eSevenSocialCiHigh). The intervals overlap, so this setup shows no difference in time between the three feeds. The p95 times are \eSevenChronoPNinetyFive, \eSevenEngagementPNinetyFive and \eSevenSocialPNinetyFive ms.

The number of Prisma queries per request is deterministic for a given request. On average it is \eSevenChronoQueriesMean (`chrono`), \eSevenEngagementQueriesMean (`engagement`) and \eSevenSocialQueriesMean (`social`).

## 6.13 Summary

| Hypothesis | Result |
|---|---|
| H0 (sanity) | Passes: H-follow does not beat BL2 on W0. |
| H1 (RQ1) | Fails on both co-primary tests, `syn-W2M-M` and `digg2009`. |
| H2 (RQ2) | Not supported: the gain is already there at 0 followees and does not rise with them. |

The other results, in short:
- On `syn-W2M-M`, H is far above BL2 over all users. The gain comes mostly from the community term and mostly from users with a long history.
- On `digg2009`, the social terms change almost nothing, and the "hot" baselines BL4 and BL5 are far better than BL2 and H.
- Ties and a larger pool do not change these results.
- The `social` feed costs the same time as the other two feeds on this setup.

By the default feed rule (Chapter 3), "For You" switches to the `social` feed only if H1 passes on both co-primary tests and the H0 gate passes. H1 failed, so "For You" stays as it is today. Chapter 7 discusses why.

---

## Notes for the author (remove before the final version)

**1. Missing macros.** The report script (`eval/`) does not yet write these. Adding them changes code, so it needs a small task. Until then, the numbers are in the tables of `results.md`.
- Tuning (6.2): the α and β of H on `syn-W2M-M`; the validation gain from 512 to 1,024 (this one comes from the tuning runs, not the report).
- E1 (6.5): NDCG@10 of BL2t and BL6 on `syn-W2M-M`; of BL4 and BL5 on `digg2009`.
- E2 (6.6): the Digg gain and interval in group 0–4 with more decimals (at three decimals they print as 0.000, which hides that the interval is above 0); the `syn-W2M-M` gain, interval and Holm p in group 20+; the Holm p in group 5–19.
- E5 (6.9): the row "H on W0, values of syn-W2M-M".
- E6 (6.10): the largest change of NDCG@10.

**2. H2 measures only followees.** H2 (super-plan §1) names two density measures: the number of followees and the amount of friend engagement in the pool. E3 reports only the first. The text says so in 6.7. Chapter 7 should list it as a limit, or the H2 text in Chapters 1 and 3 should match what was measured.

**3. Waiting for the supervisor.** The P7 note asks whether the community term may be presented as a topic signal (6.1 and 6.9 do this). If the supervisor disagrees, those two places change.

**4. Typed numbers that are not results.** "NDCG@10", "K = 10", "group 0–4" and "20 or more" are names or frozen settings from Chapter 3, not results, so they have no macro.
