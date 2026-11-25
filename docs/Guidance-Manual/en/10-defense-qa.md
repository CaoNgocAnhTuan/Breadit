# 10 · Defense question bank

[Guidance Manual](../Guidance-Manual.md) · English · [Tiếng Việt](../vi/10-defense-qa.md)

Questions a committee or a reviewer is likely to ask, each with a short answer and where the evidence is. Learn the short answer first. Open the evidence when you need detail.

Answers marked **(after P7)** depended on results that did not exist yet. Since task 10 (2026-11-12), no answer has this mark. Status: 2026-11-18, after task 11.

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
*Evidence:* [03 §5](03-hybrid-score.md); E1 (`.docs/results/p7-main/summary.csv`): NDCG@10 on `syn-W2M-M` is 0.054 for H and 0.011 for BL6; on `digg2009` it is 0.024 for H and 0.025 for BL6.

**Q4. Why m-estimate smoothing? Why m = 5?**
Without smoothing, trust for a new user is 0/0. The m-estimate (Cestnik 1990) is a standard way to mix an observed rate with a prior. m = 5 means "the prior is worth five interactions": after 5 interactions the prior weighs one half. It was frozen before any test run, and E4 reports m = 0, 2, 5, 10 so the reader can see how sensitive the result is.
*Evidence:* super-plan §6, §7; E4 (`.docs/results/p7-e4-*/`): on `syn-W2M-M`, the gain of H over BL2 is +0.047, +0.051, +0.045 and +0.041 for m = 0, 2, 5 and 10. On `digg2009` it is 0.000 for every m.

**Q5. Why does the score need an author term?**
The Orientation formula only counts friends who engaged. A fresh post by a friend that nobody has liked yet would get zero. RealGraph at Twitter weights edges between users and is used to rank in-network tweets, which supports a direct author link. E4 (H-noauthor) measures what it adds.
*Evidence:* super-plan §6; references [5], [7].

## B. The data

**Q6. Isn't the result built into your synthetic data? You generated likes from follows.**
That is the main risk, and the design answers it four ways. (1) **W0**, a null world where follows carry no influence: H-follow must not beat BL2 there (the H0 gate). (2) **W1**, where similar people follow each other but still with no influence: this separates homophily from influence. (3) Three influence levels (W2L, W2M, W2H): the gain should grow with influence. (4) **Digg 2009**, real data where nobody set the influence. Synthetic results show that the mechanism works; Digg is outside evidence.
*Evidence:* super-plan §8; E5 (`.docs/results/p7-e5-worlds/`, `p7-h0/`, `p7-e5-shuffle/`): the gain of H over BL2 grows with influence: W0 +0.012, W1 +0.029, W2L +0.035, W2M +0.045, W2H +0.076. The H0 gate passed (H-follow − BL2 on W0 = 0.001, CI −0.004 to 0.006). The W0 and W1 gains come from the community term, which carries topic interest (super-plan 0.25). With the timestamps shuffled inside each post, the W2M gain stays at +0.042.

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
*Evidence:* implementation-plan §3.3; E1 (`.docs/results/p7-main/`): on `digg2009`, BL5 (0.199) and BL4 (0.197) are far above H (0.024); on `syn-W2M-M`, H (0.054) is far above every baseline.

**Q17. Are the baselines tuned as well as your method?**
Yes. BL2t, BL4, BL5 and BL6 each have a tuned parameter on a grid that includes the published value, with the same rule as H. This avoids the known problem of beating only weak baselines (Ferrari Dacrema et al. 2019).

**Q18. How do ties affect the result?**
Ties are broken by post id. E6 reruns everything with the reversed tie-break. If the conclusions change, ties matter and the thesis says so.
*Evidence:* E6 (`.docs/results/p7-e6-ties/`): the reversed tie-break changes NDCG@10 by at most 0.001, so the conclusions do not change.

## D. Statistics

**Q19. Why both a bootstrap and a randomization test?**
The bootstrap gives the size of the gain with a confidence interval. The randomization test gives a p-value without assuming a normal distribution. The H1 rule needs both: Holm-adjusted p < 0.05 and CI lower end > 0.

**Q20. Why Holm correction?**
There are 15 confirmatory comparisons per dataset (3 values of K × 5 user groups). Without correction, some would look significant by luck. Holm controls this and stays valid when tests overlap (group 0–4 contains groups 0 and 1–4).

**Q21. What if H1 fails?**
The thesis reports it. A negative result with a clean protocol is a valid result. The "For You" default then stays as it is, and Chapter 7 discusses why.
*Evidence:* super-plan §1, P7 "Default feed rule".

**Q22. Did H1 pass?**
No, on neither test. On `syn-W2M-M` (174 cold-start users), H − BL2 = +0.023 (CI −0.002 to 0.051, Holm p 0.680). On `digg2009` (20,644 users), H − BL2 = +0.0001 (CI 0.00002 to 0.0002, Holm p 0.335). The H0 gate passed. So the "For You" default stays as it is (Q21). On `syn-W2M-M`, the gain is large for users with 20 or more earlier interactions (+0.078, Holm p 0.002), not for new users.
*Evidence:* `.docs/results/p7-main/compare.csv` (family F1), `.docs/results/p7-h0/compare.csv`; tables e2 and e5 in `.docs/results/p7-report/results.md`.

## E. The system

**Q23. How do you know the live app ranks the same way as your evaluation?**
Both call the same package, `@breadit/ranking`, so only data loading differs. A parity test compares the live endpoint and the harness for 100 sampled (user, time) pairs and requires identical orders. On `syn-W2M-M` it passes for all three `algo` values: 300 of 300 full orders at the feed module and 300 of 300 first two pages over HTTP.
*Evidence:* `docs/System_Architecture.md` §6.4; task 8 (`.docs/results/p6-parity/`, `npm run test:parity -w @breadit/backend`).

**Q24. Can someone reproduce your numbers?**
Yes. All randomness comes from one seed, scores are integers, ties are total, files are canonical, and each output has a SHA-256 in a manifest. A double-run test proves byte-identical output. `npm run thesis:repro` deletes and rebuilds every Class D result, in about 3 hours, and compares every hash with `.docs/results/manifest.json`. Latency is Class R, so it is repeatable but not byte-equal, and it is not compared.
*Evidence:* super-plan §2.

**Q25. What does the new feed cost?**
About the same for all three feeds. E7 ran k6 on `syn-W2M-M` with the page cache off on one machine: 5 runs, the first dropped, median with a CI, and a run counts only with zero failed requests. Page 1 takes a median of 35.8 ms for `social`, 35.9 ms for `chrono` and 35.9 ms for `engagement` (run with the tuned α and β), and a request sends about 19.6 to 19.7 Prisma queries for all three. The intervals overlap, so the formula adds little. The numbers compare the feeds on one machine; they are not absolute speed.
*Evidence:* E7 (task 10): `.docs/results/p7-e7/`, table e7 in `.docs/results/p7-report/`, `docs/System_Architecture.md` §6.5.

**Q26. Why is the score computed per request and not stored in a table?**
It is a cheap formula over counts the database already has. Computing it per request keeps the feed fresh and needs no batch job. E7 shows the cost: a median of 35.8 ms for page 1 with `social`, against 35.9 ms with `chrono`.

**Q27. Why put the ranking code in a separate package?**
So that the evaluation runs exactly the production code without starting the server, the database or the cache. The backend imports the package; nothing imports the evaluation.

## F. Limits and ethics

**Q28. What are the main limitations?**
No real-user test (offline only); Digg is small and old; community evidence is synthetic only; positives only (no dislikes or time spent); one held-out item per user. The tuned α and β often sit at the top of the grid (1,024). On Digg, the social terms are too small next to the vote counts to change the order.

**Q29. Can a social feed create filter bubbles?**
Yes, a feed that favors friends can narrow what people see. Coverage@K is reported to show whether H shows fewer distinct posts than the baselines. Diversity controls are future work.
*Evidence:* E1 (`.docs/results/p7-main/coverage.csv`): Coverage@10 on `syn-W2M-M` is 0.210 for H and 0.250 for BL2; on `digg2009` it is 0.144 for both. BL0 and BL1 (newest first) cover the most posts.

**Q30. What would you do with more time?**
Learned social models (SoRec, SocialMF, a graph neural network) as baselines, a real-user pilot or A/B test, negative feedback, and diversity-aware ranking.
*Evidence:* super-plan §9.

## G. The results and the platform (added 2026-11-19)

**Q31. Your title says "real-time". Is the feed real-time?**
No. "Real-time" means push: the server sends notifications, direct messages, read receipts, typing signals and a forced logout over a WebSocket, and the page updates without a reload. The feed is ranked when the user opens or reloads it, and new posts are not pushed into an open feed. The thesis shows that the events arrive; it does not measure how fast.
*Evidence:* `apps/backend/src/notifications/notifications.gateway.ts`, the socket IT tests (`apps/backend/test/it/socket.it-spec.ts`); document 12 §3.

**Q32. How do you stop one user from reading another user's messages over the socket?**
The server, not the client, decides who a socket is. Before the connection exists, it checks the login cookie, the logout blacklist and the password version (a password reset ends every older session), then puts the socket in the room of that user's username. A socket joins a conversation room only if the database says it is a member, and typing events carry the username from the login. This fixed finding S1, where a client could pick any room.
*Evidence:* the gateway's `authenticate` and `handleJoinConversation`; `socket.it-spec.ts` ("alice claims to be bob … does NOT get bob's DM"); Bugs Report S1.

**Q33. On Digg the confidence interval of the gain is above zero. Why do you say H1 failed?**
The rule, fixed before the test split, needs both a Holm p below 0.05 and an interval above 0. The interval is 0.000015 to 0.000225, but the Holm p is 0.335: the raw p (0.030) is the 5th smallest of the 15 in the family, so Holm multiplies it by 11. And the gain is about 0.0001 NDCG, far too small to matter.
*Evidence:* `.docs/results/p7-main/compare.csv`, row `digg2009,F1,H,BL2,10,0-4`; implementation-plan §3.4; document 11 §6.

**Q34. Why does the hybrid help users with a long history more than new users?**
For a user with no history, the smoothing gives every followee the same trust and every joined community the same weight, so the score only says "by someone you follow" or "in a community you joined". As history grows, the user's own counts replace the prior and the score becomes personal. On `syn-W2M-M` the gain is 0.023 for 0–4 interactions and 0.078 for 20 or more.
*Evidence:* table e2; the formula in document 03; Chapter 7.

**Q35. If H1 failed, what does the thesis contribute?**
Three things. A hybrid score that the app runs and that was measured with a leak-free, reproducible protocol against tuned baselines. A clear negative answer: on these data the follow graph adds little for new users, and the gain comes from community history acting as a topic signal. And an app where offline numbers describe the live feed (the parity test) and one command rebuilds every number.
*Evidence:* super-plan §1 ("a negative result with a clean protocol is still a valid result"); documents 07 and 11.
