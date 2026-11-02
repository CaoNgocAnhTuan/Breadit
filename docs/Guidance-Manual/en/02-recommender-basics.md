# 02 · Recommender basics

[Guidance Manual](../Guidance-Manual.md) · English · [Tiếng Việt](../vi/02-recommender-basics.md)

**After reading this you can:** explain the ideas the thesis builds on, in plain words, before you meet them in the formulas: ranking, candidates, implicit feedback, cold start, the social signal, offline evaluation and leakage.

No prior knowledge of recommender systems is needed. Terms: [09 Glossary](09-glossary.md).

---

## 1. A feed is a ranking problem

At any moment there are many more posts than a user will read. A feed must **order** them so that the posts the user wants come first. So the question is never "is this post good?" but "is this post better **for this user, now** than the others?"

Most real systems split this in two steps:
1. **Candidate generation:** pick a manageable set (here: the posts of the last 7 days, at most 2,000). This is the **candidate pool**.
2. **Ranking:** give every candidate a score and sort.

The thesis changes step 2 (the score) and keeps step 1 simple and shared.

## 2. Kinds of ranking methods

| Kind | Idea | Example in the thesis |
|---|---|---|
| Chronological | newest first | BL0, BL1 |
| Popularity | most liked first, maybe with time decay | BL2 (Explore), BL3, BL4 (Reddit), BL5 (Hacker News) |
| Social | posts connected to people you know | the social and community terms of H |
| Hybrid | a mix of the above in one score | H, BL6 |
| Learned (not in the thesis) | a model learns from history: matrix factorization, LightFM, graph neural networks | related work and future work |

**Heuristic** means a hand-written rule instead of a learned model. A heuristic is transparent: you can see why a post ranks high and switch one part off to measure it.

## 3. Feedback: explicit and implicit

- **Explicit feedback:** the user rates something (5 stars, thumbs down).
- **Implicit feedback:** the user acts (likes, comments, reposts, clicks).

Breadit has only implicit, positive feedback. The thesis calls a like, comment or repost a **positive**. There is no "dislike", and not liking a post does not mean the user disliked it; maybe they never saw it.

## 4. The cold-start problem

A **cold-start user** has little or no history. Methods that learn from your history (collaborative filtering) have nothing to learn from. Popularity works but is the same for everyone.

What a new user usually *does* have on day one: a few follows and maybe a community. The thesis uses exactly that. The trick that makes it work is **smoothing** (file 03): with no history, trust is spread equally over the people you follow, and as history grows, it shifts to the people you really interact with.

## 5. Social signals: influence and homophily

Why would a friend's like predict yours? Two reasons, and they are hard to tell apart:
- **Influence:** you see your friend liked it, so you look at it too.
- **Homophily:** you and your friend have similar tastes, so you would like it anyway.

Both make "friends like the same posts". For prediction, both help. But a reader might say "your data was built so that friends agree". This is why the synthetic data has a world W0 with no social effect, a world W1 with only homophily, and three worlds with growing influence (file 04).

## 6. Offline evaluation

**Online evaluation** (A/B test) shows two feeds to real users and measures what they do. The thesis has no real users, so it uses **offline evaluation**: replay recorded history and check whether a method would have put the user's real next choice near the top.

The standard setup is **leave-one-out**: hide one real interaction per user (the "held-out item"), rank, and find the rank of the hidden item. The thesis hides the user's last interaction after a global cut time T (file 05).

## 7. Metrics on a ranked list

With one hidden item at rank r:
- **HitRate@K / Recall@K:** did it appear in the top K? (1 or 0)
- **NDCG@K:** like HitRate, but a higher position counts more: `1 / log2(r + 1)`. Rank 1 gives 1, rank 3 gives 0.5.
- **Coverage@K:** across all users, how many different posts appear in the top K lists? A method that shows everyone the same 10 posts has low coverage.

The table reports the mean over users. File 05 has worked examples.

## 8. Leakage

**Leakage** is when the evaluation lets a method use information from after the moment it is supposed to predict. Example: ranking a post by its like count *today*, when the user's choice happened last week. The method looks clever because it knows the future.

Leakage is a common, documented problem in recommender evaluation. The thesis blocks it with the **as-of rule**: every number is computed from events before the prediction time only. A test proves it: changing all later events must not change the result.

## 9. Baselines and fair comparison

A **baseline** is a method you compare against. A new method should beat **strong** baselines, not only weak ones; a known review found that many published methods did not beat well-tuned simple ones (Ferrari Dacrema et al. 2019). So the thesis tunes its baselines too (BL2t, BL4, BL5, BL6), on the same validation data and with the same rule as H.

## 10. Statistical significance in one paragraph

If H beats BL2 by 0.01 on 200 users, is that real or luck? Statistics answers this. The thesis compares the two methods **user by user** (paired), estimates a confidence interval for the mean difference (bootstrap), computes a p-value (randomization test), and corrects for running many tests (Holm). File 06 explains each step.

## 11. Check yourself

1. What is the difference between candidate generation and ranking?
2. Why does "the user did not like this post" not mean "the user disliked it"?
3. Give one example of influence and one of homophily.
4. Why can leakage make a weak method look strong?
5. Why should baselines be tuned too?
