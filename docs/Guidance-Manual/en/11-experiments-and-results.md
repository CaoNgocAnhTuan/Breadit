# 11 · The experiments and what the results mean

[Guidance Manual](../Guidance-Manual.md) · English · [Tiếng Việt](../vi/11-experiments-and-results.md)

**After reading this you can:** say what question each experiment asks and which run answers it; read every column of a results file and of a report table; give the main numbers and say what they mean; follow one number from one user's ranking to the macro in the thesis; and say what the thesis can claim and what it cannot. This is the background of thesis Chapters 5 and 6.

Sources: super-plan P7 (the experiment table and the status), `.docs/results/p7-report/results.md` (all tables), the run folders in `.docs/results/`, implementation-plan §2.7 (the results files) and §3.3–§3.5 (Holm families, the reading of H1, the H0 gate), and the P7 note for the supervisor (`.docs/works/2026-11-11-p7-offline-experiments/results-note.md`). How a number is made: [05](05-evaluation-protocol.md). When a gain is real: [06](06-statistics.md). Terms: [09 Glossary](09-glossary.md).

**Status.** The numbers are copied from `results.md` on 2026-11-19, after task `p9-report-macros`. They are typed here so you can read them; the thesis never types them and uses the macros. If a run changes, `results.md` is right and this file is fixed.

---

## 1. The experiments at a glance

| ID | Question | Data | What is compared | Run folder |
|---|---|---|---|---|
| Tuning | Which α and β (and the one parameter of each tuned baseline) are best? | validation items only | grid points | `p7-tune-main`, `p7-tune-worlds` |
| H0 gate | Do the follow terms win where follows are random? | `syn-W0-M` | H-follow against BL2 | `p7-h0` |
| E1 | How do all methods compare? | `syn-W2M-M`, `digg2009` | the nine methods | `p7-main` |
| E2 | Does the hybrid help users with little history? (RQ1, H1) | the same two | H against BL2, by history group | `p7-main` |
| E3 | Does the gain grow with social density? (RQ2, H2) | the three W2 cells, `digg2009` | H against BL2, by number of followees | `p7-main`, `p7-e5-worlds` |
| E4 | Which term matters? | `syn-W2M-M`, `digg2009` | the ablations and the prior strength `m` | `p7-e4-terms`, `p7-e4-m0`, `p7-e4-m2`, `p7-e4-m10` |
| E5 | Is the result built into the data? | the five worlds and a shuffled copy | H against BL2 in each world | `p7-e5-worlds`, `p7-e5-shuffle`, `p7-h0` |
| E6 | Do ties change the result? | the two main datasets | the reversed tie-break | `p7-e6-ties` |
| E7 | What does the new feed cost? (Class R) | `syn-W2M-M` loaded into Postgres | `chrono`, `engagement`, `social` in the live app | `p7-e7` |
| E8 | Does the pool size change the result? | `syn-W2M-M` | H, BL2 and BL6 with the larger pool | `p7-e8-pool` |

The order was fixed in advance: tune on the validation items, freeze the choices into ten test configs, let the author approve them, then run the test split **once**. E7 ran afterwards on the live backend. `p7-report` turns all of these into macros and tables.

## 2. How to read a results file

Each run folder holds a `manifest.json` (config, Node version, SHA-256 of each file) and the CSV files of implementation-plan §2.7. The two you will read most:

**`summary.csv`**: one row per method, K and history group.

```
dataset,split,method,k,bucket,n_users,recall,ndcg
```
`n_users` is the number of test users in the group after the left-out users are removed. `recall` and `ndcg` are the means over those users.

**`compare.csv`**: one row per comparison. A real row of `p7-main`:

```
dataset,family,method,ref,k,bucket,n,mean_diff,ci_low,ci_high,p_raw,p_holm
syn-W2M-M,F1,H,BL2,10,0-4,174,0.023061,-0.002358,0.051290,0.097190,0.680332
```

| Cell | Meaning |
|---|---|
| `F1` | the confirmatory family (H − BL2 for each K and group); `F2` is H against the other baselines; `none` has no p-value |
| `H`, `BL2`, `10`, `0-4` | H against BL2, NDCG@10, users with 0–4 earlier interactions |
| `174` | users in the comparison |
| `0.023061` | the **gain**: the mean over users of (NDCG of H − NDCG of BL2) |
| `-0.002358`, `0.051290` | the 95% paired bootstrap interval of the gain |
| `0.097190` | the p-value of the paired randomization test, alone |
| `0.680332` | the same p after Holm correction inside the family |

The other files: `coverage.csv` (Coverage@K per method), `leftout.csv` (test users and left-out users per group), `density.csv` (the gain per followee bin, for E3) and `tuning.csv` (one row per grid point, `chosen` = 1 for the choice).

**Report tables and macros** show 3 decimals. A macro whose name ends in `Full` keeps all 6 (for example the Digg row below). A tuning value is printed as written (`1024/1024`).

## 3. Before the test split

**Tuning.** Each tuned method gets the grid value with the highest validation NDCG@10; a tie goes to the smaller value (super-plan §5). The choices:

| Dataset | H (α/β) | BL2t (age weight) | BL4 (divisor, s) | BL5 (gravity) | BL6 (α) |
|---|---|---|---|---|---|
| `syn-W2M-M` | 1024/1024 | 0.125 | 720000 | 0.6 | 16 |
| `digg2009` | 1024/0 | 4 | 45000 | 1.5 | 1024 |

What it means:
- **H chose the top of the grid** on `syn-W2M-M`. The best value could be larger. But the curve is flat there: the validation NDCG@10 is 0.048086 at 512/512 and 0.048342 at 1024/1024. This is a limitation to state, not an error.
- **On Digg, β = 0** only because Digg has no communities: every β gives the same score, and the tie goes to the smaller value.
- **BL2t on Digg chose the largest age weight (4).** The data ask for much stronger time decay than production uses (0.25 per hour). Keep this in mind for E1.

**Two changes, made from validation results only** (super-plan change log 0.25):
- **The H0 gate moved to H-follow.** On W0 the full H beat BL2 on validation, almost only through the community term. In the generator a community is a topic, so that term carries topic interest even with no influence. H-follow has only the follow terms, and follows are random in W0, so it is the clean null test.
- **The grids were widened**, because the choices sat at the edge: the α and β grid from a top of 16 to 1,024, and each baseline grid past its edges (super-plan §7).

## 4. The H0 gate

**Result:** on W0, H-follow − BL2 = 0.001, interval −0.004 to 0.006. **The gate passes.**

**What it means:** when follows are random, the follow terms give no gain. So the follow features do not leak the answer, and the other results can be used. (Leakage is also tested directly in P5: changing every event after a user's test time leaves the user's rows unchanged.)

## 5. E1: all methods

NDCG@10, all users (Table e1):

| Method | `syn-W2M-M` | `digg2009` |
|---|---|---|
| BL0 (production For You) | 0.005 | 0.026 |
| BL2 (production Explore) | 0.009 | 0.024 |
| BL2t (BL2, tuned age weight) | 0.011 | 0.027 |
| BL4 (Reddit hot) | 0.009 | **0.197** |
| BL5 (Hacker News) | 0.009 | **0.199** |
| BL6 (plain follow count) | 0.011 | 0.025 |
| H (hybrid) | **0.054** | 0.024 |

**What it means:**
- **Synthetic:** H is about six times BL2 and far above every baseline. The data have influence and topic communities, and H uses both.
- **Digg:** H equals BL2, and the two "hot" formulas are about eight times better. Digg stories are all front-page stories with many votes; what predicts the next vote is how fresh a story is. BL4 and BL5 divide by a power of age; BL2 only subtracts a small linear age term.
- **Coverage@10:** on `syn-W2M-M`, H covers fewer distinct posts than BL2 (0.210 against 0.250); on Digg both are 0.144. A personal score concentrates on what each user already likes.

**Why all values are small.** Each user has one test post, and the method ranks the whole pool (up to 2,000 posts). NDCG@10 is 0 unless that one post is in the top 10. Compare methods with each other, never with NDCG values from papers that sample 100 negatives (document 05).

## 6. E2: users with little history (H1)

H1 passes on a dataset only if, in the F1 row for NDCG@10 and group 0–4, **both** hold: the Holm p is below 0.05 **and** the interval's lower end is above 0 (implementation-plan §3.4).

| Dataset | Group | Users | BL2 | H | Gain | 95% interval | p (Holm) |
|---|---|---|---|---|---|---|---|
| `syn-W2M-M` | 0–4 | 174 | 0.012 | 0.035 | 0.023 | −0.002 to 0.051 | 0.680 |
| `syn-W2M-M` | 5–19 | 177 | 0.013 | 0.043 | 0.031 | 0.003 to 0.059 | 0.378 |
| `syn-W2M-M` | 20+ | 190 | 0.003 | 0.082 | 0.078 | 0.048 to 0.112 | 0.002 |
| `digg2009` | 0–4 | 20,644 | 0.029 | 0.029 | 0.000117 | 0.000015 to 0.000225 | 0.335 |

**Synthetic:** the interval contains 0 and the p is high, so **H1 fails**. The gain is positive, but with 174 users it cannot be told apart from 0.

**Digg:** the interval is above 0, but the Holm p is 0.335, so **H1 fails** on the p condition. Two lessons:
- **Holm can turn a small p into a large one.** The raw p is 0.030. Holm sorts the 15 p-values of the family; this one is the 5th smallest, so it is multiplied by 15 − 5 + 1 = 11: 0.030497 × 11 = 0.335. On `syn-W2M-M` the raw p 0.097190 is the 9th smallest and is multiplied by 7: 0.680. (Document 06 explains Holm.)
- **Significance is not size.** Even if the Digg gain were "real", it is about 0.0001 NDCG: nothing a user would notice (document 06, effect size).

**The surprise:** on `syn-W2M-M` the gain **grows with history**: 0.023 for 0–4, 0.031 for 5–19, 0.078 for 20+. The 20+ row is the only F1 row at K = 10 where both conditions hold. With little history the smoothing gives every followee and community the same weight, so the score cannot be personal yet; with more history the counts take over (Chapter 6).

## 7. E3: social density (H2)

The gain of H over BL2 by the number of followees at test time (Table e3; figure data `fig-e3-density.csv`):

| Followees | W2 low | W2 middle | W2 high | Digg |
|---|---|---|---|---|
| 0 | 0.032 | 0.044 | 0.076 | 0.000 |
| 5–19 | 0.051 | 0.056 | 0.079 | 0.000 |
| 20+ | 0.020 | 0.030 | 0.071 | 0.000 |

(The bin 1–4 holds only one user in each synthetic world, so it is not read.)

**What it means:** H2 says the gain grows with density and is about 0 for a user who follows nobody. Neither holds: the gain is already there at 0 followees, because the community term needs no follows, and it does not rise with more followees. **H2 is not supported.** This experiment measures density by followees only; H2 also names friend engagement in the pool, which was not measured.

## 8. E4: which term matters

The gain over BL2, all users, `syn-W2M-M` (Table e4):

| Variant | Gain |
|---|---|
| H (all terms, `m` = 5) | 0.045 |
| H-comm (community term only, α = 0) | 0.043 |
| H-follow (follow terms only, β = 0) | 0.007 |
| H without the author term | 0.046 |
| H without the engager term | 0.042 |
| `m` = 0, 2, 10 | 0.047, 0.051, 0.041 |

On `digg2009` every variant gains 0.000 (no H-comm row: no communities).

**What it means:** almost all of the gain comes from the community term. The follow terms add little, and the author term is not needed on these data. `m` = 2 is a little better than the frozen 5, but `m` was fixed before the test split, so it stays (tuning `m` is future work).

## 9. E5: is the result built into the data?

| Run | Gain | 95% interval |
|---|---|---|
| W0 (no influence, no homophily), own tuning | 0.012 | 0.000 to 0.024 |
| W1 (homophily only) | 0.029 | 0.017 to 0.041 |
| W2 low / middle / high influence | 0.035 / 0.045 / 0.076 | all above 0 |
| H0 gate: H-follow on W0 | 0.001 | −0.004 to 0.006 |
| H on W0 with the `syn-W2M-M` values (topic signal) | 0.011 | −0.001 to 0.023 |
| `syn-W2M-M` with the engagement times shuffled inside each post | 0.042 | 0.026 to 0.059 |

**What it means:**
- **The gain grows with influence**, so when influence is in the data, H picks it up.
- **W0 and W1 still show a gain** without any influence. It comes from the topic signal of the community term: users keep liking the topics they liked before. That is prediction, not influence.
- **Shuffling the engagement times keeps most of the gain** (0.042 of 0.045). So the gain does not depend on who engaged first. This points to correlation (same tastes) more than influence (copying followees). Telling the two apart is a known hard problem (reference [23] of super-plan §10).

## 10. E6 and E8: robustness

- **E6, ties.** With the reversed tie-break, NDCG@10 changes by at most 0.001 (BL4: 0.009 → 0.008 on `syn-W2M-M` and 0.197 → 0.196 on `digg2009`; BL5 on `syn-W2M-M`: 0.009 → 0.010; all others equal at 3 decimals). Ties do not change any conclusion.
- **E8, a larger pool** (14 days, 4,000 posts instead of 7 days, 2,000). On `syn-W2M-M`: H 0.054 → 0.048, BL2 0.009 → 0.008, BL6 0.011 → 0.010. Every method drops a little (more posts compete), and the order stays the same.

## 11. E7: the cost of the three feeds

E7 measures the live backend, so it is **Class R**: repeatable, not identical (document 07). The setup is frozen (super-plan §7): one machine, one virtual user, 100 requests per run (page 1 for each of the 100 parity pairs), five rounds with the first dropped, page cache off. A run counts only if no request fails, and none failed.

| `algo` | Median page 1 (ms) | 95% interval | p95 (ms) | Prisma queries per request |
|---|---|---|---|---|
| `chrono` | 35.851 | 35.615 to 36.005 | 40.011 | 19.65 (17 to 21) |
| `engagement` | 35.879 | 34.634 to 36.289 | 40.447 | 19.63 (17 to 21) |
| `social` | 35.836 | 34.906 to 36.102 | 39.766 | 19.70 (17 to 21) |

**What it means:** the intervals overlap, so on this setup the three feeds cost the same. The social score adds little next to loading the pool. These numbers compare the feeds on one machine for one user; they are not the speed of the app under load.

## 12. One number from start to end

🔜 Written when the full `thesis:repro` run of 2026-11-19 has rebuilt `p7-main` (it needs the git-ignored `eval/results/p7-main/per_user.csv`). It will follow one real user of `syn-W2M-M` from the test post, through its rank under BL2 and H and the two NDCG values, to the mean over 174 users, the interval, the p-value, Holm, and the macro `\eTwoWTwoMNdcgTenZeroFourGain`.

## 13. What the thesis can claim, and what it cannot

**It can claim:**
- On synthetic data with influence, the hybrid ranks far better than the production Explore score over all users, mostly through the user's history in communities, and the gain grows with the strength of influence.
- The protocol does not leak (H0 gate, leakage test), and every offline number is rebuilt byte for byte by one command (document 07).
- The `social` feed in the app runs the evaluated code (the parity test) and costs the same as the other feeds.

**It cannot claim:**
- That the hybrid helps users with little history (H1 failed on both datasets).
- That the follow graph helps on real data (Digg: about 0), or that the community term works on real data (no real data had dated memberships).
- That a better NDCG means happier users: the evaluation is offline, one test post per user.

**So the default feed stays as it is.** The rule was set before the test split: "For You" switches to `social` only if H1 passes on both tests and the H0 gate passes (super-plan P7). H1 failed, so `FEED_DEFAULT_ALGO` stays empty, and `social` is an option.

## 14. Check yourself

1. Which run folder and file hold the H1 numbers, and which row?
2. Read the row `syn-W2M-M,F1,H,BL2,10,0-4,174,0.023061,-0.002358,0.051290,0.097190,0.680332`: what is each cell?
3. On Digg the interval of the H1 gain is above 0. Why does H1 still fail?
4. Why can a raw p of 0.030 become 0.335 after Holm?
5. On `syn-W2M-M`, which users gain most from H, and why is that the opposite of what RQ1 hoped?
6. Why does a gain on W0 not mean a bug, while a gain of H-follow on W0 would?
7. What does the timestamp shuffle in E5 tell you?
8. Why are the Digg "hot" baselines so strong, and what does BL2t's tuned age weight tell you?
9. Can E7 say how fast Breadit is for 1,000 users at once? Why not?
