# 06 · Statistics

[Guidance Manual](../Guidance-Manual.md) · English · [Tiếng Việt](../vi/06-statistics.md)

**After reading this you can:** explain why a gain needs statistics, compute a paired difference, explain the bootstrap interval, the randomization test and Holm correction in plain words, and apply the H1 and H0 rules.

Sources: super-plan §5 "Statistics", implementation-plan §3.3 to §3.5, `eval/src/stats.ts`. Terms: [09 Glossary](09-glossary.md). Read [05](05-evaluation-protocol.md) first.

---

## 1. Why statistics?

Suppose H has NDCG@10 = 0.120 and BL2 has 0.105 over 174 cold-start users. Is H better, or did it get lucky with these users? With another sample of users the order might flip. Statistics tells us how much the difference could move by chance, and whether it is still above zero.

## 2. Step 1: pair by user

For each user i, compute `d_i = NDCG@10(H) − NDCG@10(BL2)`.

Pairing matters. Some users are easy (their choice is popular, every method ranks it high) and some are hard. If we compared two separate averages, this user-to-user spread would hide the difference. The difference **per user** removes it.

**Running example** (8 users, computed with the real `eval/src/stats.ts`):

| User | H rank | BL2 rank | NDCG H | NDCG BL2 | d |
|---|---|---|---|---|---|
| 1 | 1 | 3 | 1 | 0.5 | 0.5 |
| 2 | 1 | 2 | 1 | 0.631 | 0.369 |
| 3 | 15 | 12 | 0 | 0 | 0 |
| 4 | 4 | 4 | 0.431 | 0.431 | 0 |
| 5 | 2 | 3 | 0.631 | 0.5 | 0.131 |
| 6 | 3 | 2 | 0.5 | 0.631 | −0.131 |
| 7 | 3 | 30 | 0.5 | 0 | 0.5 |
| 8 | 11 | 20 | 0 | 0 | 0 |

Mean d = **0.171**. H looks better. Is it?

## 3. Step 2: the bootstrap confidence interval

**Idea:** we only have one sample of users. Pretend it is the whole population, and draw many new samples from it **with replacement** (some users appear twice, some not at all). Compute the mean d of each. The spread of these means shows how much the mean could move with other users.

**Procedure** (10,000 resamples, stream `bootstrap`): take the middle 95% of the 10,000 means. That is the **95% confidence interval (CI)**.

**Example:** CI = [**0.016**, **0.342**]. The whole interval is above 0.

## 4. Step 3: the randomization test (p-value)

**Idea:** if H and BL2 were really equal, the label "H" or "BL2" on each user's two numbers would be arbitrary. So swap them at random: flip the sign of each d_i with probability ½, and compute the mean. Repeat many times. If the real mean is unusual among these shuffled means, the difference is probably real.

**p-value** = the share of shuffles with |mean| at least as large as the real |mean|. Two-sided: a big loss counts as unusual too. Our formula: `p = (1 + count) / (10,000 + 1)`, stream `permutation`.

**Example:** with only 8 users, there are 2^8 = 256 sign patterns, so we can count them all exactly: **p = 0.1875**. About 1 in 5 random labelings gives a difference as large. Not convincing.

## 5. The two tools can disagree

In the example, the CI says "above 0" but the p-value says "could be chance". With 8 users the bootstrap interval is too narrow (it cannot see variation that the 8 users do not show). This is one reason the H1 rule asks for **both** (section 7). With hundreds of users they usually agree, but the rule does not depend on luck.

## 6. Step 4: Holm correction

Each test has a 5% chance of a false "win". Run 15 tests, and the chance that at least one is a false win is much higher. **Holm** (1979) fixes this:

1. Sort the m p-values from smallest to largest.
2. Multiply the smallest by m, the next by m − 1, and so on.
3. Keep the result non-decreasing (each adjusted p is at least the one before), and cap at 1.

**Example** with m = 4: p = 0.01, 0.02, 0.03, 0.20.
- 0.01 × 4 = 0.04
- 0.02 × 3 = 0.06
- 0.03 × 2 = 0.06
- 0.20 × 1 = 0.20

At level 0.05, only the first passes. Without correction, three would pass.

Holm is valid even when tests overlap, which matters here: group 0–4 contains groups 0 and 1–4.

## 7. The families and the rules

| Family | Comparisons | Size per dataset | Role |
|---|---|---|---|
| F1, confirmatory | H − BL2 for K = 5, 10, 20 and groups 0, 1–4, 0–4, 5–19, 20+ | 15 | holds the H1 test |
| F2, secondary | H − each of BL0, BL1, BL2t, BL3, BL4, BL5, BL6, for each K and groups 0–4, 5–19, 20+, all | 84 | context: how H does against every baseline |

Only `syn-W2M-M` and `digg2009` get F1 and F2. Everything else (W0, W1, W2L, W2H, ablations, E6, E8, density bins) gets bootstrap CIs and no p-value.

**H1 passes on a dataset** when the F1 row "NDCG@10, group 0–4" has Holm-adjusted p < 0.05 **and** CI lower end > 0.

**H0 gate:** on `syn-W0-M`, the CI of H − BL2 (NDCG@10, all users) must **not** lie above 0. It is a gate, not a family member.

## 8. Common random numbers

Every comparison restarts its random stream from the seed. So H − BL2 and H − BL5 use exactly the same resamples and the same sign flips. Two benefits: a comparison's numbers do not depend on which others were computed before it, and a re-run gives the same numbers byte for byte.

## 9. Cross-check with scipy

The TypeScript statistics were checked once against Python's scipy 1.16.3 on a small committed fixture: the exact permutation p was equal (0.014404296875), and the bootstrap CI was within tolerance. Python is used only for this one check.

## 10. Effect size versus significance

A tiny gain can be significant with many users (Digg has 20,644 kept cold-start users). So always report the **mean difference and its CI**, not only "p < 0.05". The thesis tables show both.

## 11. Check yourself

1. Why is a paired difference better than comparing two averages?
2. In plain words, what does a bootstrap resample do?
3. What does p = 0.19 mean in the example?
4. Holm with p = 0.004, 0.03, 0.04 (m = 3): which pass at 0.05? *(0.012 passes; 0.06 and 0.06 do not.)*
5. Why does W0 get a CI but no p-value in a family?
