# 10 · Defense question bank

[Guidance Manual](../Guidance-Manual.md) · English · [Tiếng Việt](../vi/10-defense-qa.md)

Questions a committee or a reviewer is likely to ask, each with a short answer and where the evidence is. Learn the short answer first. Open the evidence when you need detail.

Answers marked **(after P7)** depend on results that do not exist yet. Their final text is written when the experiments are done. Status: 2026-11-02, after P5.

---

## A. The idea

**Q1. What is the contribution, in one sentence?**
A hybrid "For You" score that adds smoothed follow trust and community affinity to the production engagement score, built into a real app and measured with a leakage-free, reproducible offline protocol, mainly for users with little history.
*Evidence:* super-plan §1, §6; [03](03-hybrid-score.md).

**Q2. Why not a machine learning model (LightFM, matrix factorization, a graph neural network)?**
Three reasons. (1) The question is *which signal* helps; a hand-built score has terms we can switch off one by one (ablations), and a learned model would hide this. (2) Learned models need history, and the thesis targets users with almost none. (3) Time: the plan has four weeks. Learned social models (SoRec, SocialMF, DiffNet) are discussed as related work and future work.
*Evidence:* super-plan §9 (out of scope); `.docs/related-work.md`.

**Q3. Why is the hybrid "social-graph-aware" and not just "popularity plus friends"?**
Because trust is weighted by the user's own past behavior and smoothed. BL6 is exactly "popularity plus a count of friends", and it is a baseline. The difference between H and BL6 shows what trust weights add.
*Evidence:* [03 §5](03-hybrid-score.md); experiment E1 **(after P7)**.

**Q4. Why m-estimate smoothing? Why m = 5?**
Without smoothing, trust for a new user is 0/0. The m-estimate (Cestnik 1990) is a standard way to mix an observed rate with a prior. m = 5 means "the prior is worth five interactions": after 5 interactions the prior weighs one half. It was frozen before any test run, and E4 reports m = 0, 2, 5, 10 so the reader can see how sensitive the result is.
*Evidence:* super-plan §6, §7; E4 **(after P7)**.

**Q5. Why does the score need an author term?**
The Orientation formula only counts friends who engaged. A fresh post by a friend that nobody has liked yet would get zero. RealGraph at Twitter weights edges between users and is used to rank in-network tweets, which supports a direct author link. E4 (H-noauthor) measures what it adds.
*Evidence:* super-plan §6; references [5], [7].

## B. The data

**Q6. Isn't the result built into your synthetic data? You generated likes from follows.**
That is the main risk, and the design answers it four ways. (1) **W0**, a null world where follows carry no influence: H must not beat BL2 there (the H0 gate). (2) **W1**, where similar people follow each other but still with no influence: this separates homophily from influence. (3) Three influence levels (W2L, W2M, W2H): the gain should grow with influence. (4) **Digg 2009**, real data where nobody set the influence. Synthetic results show that the mechanism works; Digg is outside evidence.
*Evidence:* super-plan §8; E5 **(after P7)**.

**Q7. Why Digg 2009? It is old.**
It is one of very few public datasets with both dated votes and a dated follow graph on the same clock, which a feed needs. The selection used fixed criteria, written down before the choice. Age does not matter for the question: does a friend's action predict yours?
*Evidence:* `.docs/datasets.md`.

**Q8. What are Digg's limits?**
3,553 stories, one month, only front-page stories (so all are already popular, which favors popularity baselines), about 41% of voters missing from the friend table, a follow graph crawled once, and no communities. All are stated as limitations.
*Evidence:* super-plan §8, P4.

**Q9. Digg has no communities. How is β tested?**
On synthetic data only. This is a stated limitation: no public dataset found has follows, item interactions and community membership together.
*Evidence:* super-plan §8.

**Q10. Is the synthetic data realistic?**
Its parameters are calibrated to Digg numbers: activity skew (top 20% of users make about 84% of votes on Digg), followees and followers per user, votes per user. Every calibrated value is within its tolerance on `syn-W2M-M`.
*Evidence:* `eval/config/synthetic-v1.json`; the P3 task's `check_output.txt`.

## C. The protocol

**Q11. How do you prevent data leakage?**
Every feature is computed as of the test time: only events before it. A leakage test changes or deletes every later event and checks that the user's result does not change by one byte. It passes.
*Evidence:* [05 §5](05-evaluation-protocol.md); P5 status.

**Q12. Why a global cut time and not leave-last-out per user?**
With a global T, tuning never sees anything from the test period, for any user. Per-user splits let one user's future leak into another user's past.
*Evidence:* [05 §3](05-evaluation-protocol.md); Meng et al. 2020.

**Q13. Why only one test item per user?**
It gives one clean, comparable number per user, and paired statistics need exactly one value per user and method. With one item, Recall@K equals HitRate@K, and the thesis says so.

**Q14. Why not sample 100 negatives like many papers?**
Sampled metrics can change which method looks best (Krichene and Rendle 2020). We rank the full pool.

**Q15. Why NDCG@10 on users with 0–4 interactions as the primary test?**
RQ1 is about users with little history, and 10 is about one screen of a feed. Fixing one primary metric and group before the test run avoids picking the best-looking number afterwards.

**Q16. Why is BL2 the reference and not BL5, the strongest baseline?**
H1 asks "is it better than what the app does now?" BL2 is the production score. H is also compared with every other baseline (family F2), so a reader sees how it does against BL5.
*Evidence:* implementation-plan §3.3; E1 **(after P7)**.

**Q17. Are the baselines tuned as well as your method?**
Yes. BL2t, BL4, BL5 and BL6 each have a tuned parameter on a grid that includes the published value, with the same rule as H. This avoids the known problem of beating only weak baselines (Ferrari Dacrema et al. 2019).

**Q18. How do ties affect the result?**
Ties are broken by post id. E6 reruns everything with the reversed tie-break. If the conclusions change, ties matter and the thesis says so.
*Evidence:* E6 **(after P7)**.

## D. Statistics

**Q19. Why both a bootstrap and a randomization test?**
The bootstrap gives the size of the gain with a confidence interval. The randomization test gives a p-value without assuming a normal distribution. The H1 rule needs both: Holm-adjusted p < 0.05 and CI lower end > 0.

**Q20. Why Holm correction?**
There are 15 confirmatory comparisons per dataset (3 values of K × 5 user groups). Without correction, some would look significant by luck. Holm controls this and stays valid when tests overlap (group 0–4 contains groups 0 and 1–4).

**Q21. What if H1 fails?**
The thesis reports it. A negative result with a clean protocol is a valid result. The "For You" default then stays as it is, and Chapter 6 discusses why.
*Evidence:* super-plan §1, P7 "Default feed rule".

**Q22. Did H1 pass?** **(after P7)**
Write here: the F1 row for `syn-W2M-M` and for `digg2009` (mean difference, CI, Holm p), and the H0 gate result.

## E. The system

**Q23. How do you know the live app ranks the same way as your evaluation?**
Both call the same package, `@breadit/ranking`, so only data loading differs. A parity test compares the live endpoint and the harness for 100 sampled (user, time) pairs and requires identical orders.
*Evidence:* `docs/System_Architecture.md` §6.4; task 8 **(after P6)**.

**Q24. Can someone reproduce your numbers?**
Yes. All randomness comes from one seed, scores are integers, ties are total, files are canonical, and each output has a SHA-256 in a manifest. A double-run test proves byte-identical output. `npm run thesis:repro` (task 11) rebuilds everything and compares every hash.
*Evidence:* super-plan §2.

**Q25. What does the new feed cost?**
E7 measures latency and query count for `chrono`, `engagement` and `social` with k6 on size M: 5 runs, the first dropped, median with a CI. A run counts only with zero failed requests.
*Evidence:* E7 **(after P7)**.

**Q26. Why is the score computed per request and not stored in a table?**
It is a cheap formula over counts the database already has. Computing it per request keeps the feed fresh and needs no batch job. E7 shows whether this is fast enough.

**Q27. Why put the ranking code in a separate package?**
So that the evaluation runs exactly the production code without starting the server, the database or the cache. The backend imports the package; nothing imports the evaluation.

## F. Limits and ethics

**Q28. What are the main limitations?**
No real-user test (offline only); Digg is small and old; community evidence is synthetic only; positives only (no dislikes or time spent); one held-out item per user.

**Q29. Can a social feed create filter bubbles?**
Yes, a feed that favors friends can narrow what people see. Coverage@K is reported to show whether H shows fewer distinct posts than the baselines. Diversity controls are future work.
*Evidence:* coverage in E1 **(after P7)**.

**Q30. What would you do with more time?**
Learned social models (SoRec, SocialMF, a graph neural network) as baselines, a real-user pilot or A/B test, negative feedback, and diversity-aware ranking.
*Evidence:* super-plan §9.
