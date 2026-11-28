# 00 · The core in one file

[Guidance Manual](../Guidance-Manual.md) · English · [Tiếng Việt](../vi/00-core-in-one-file.md)

**After reading this you can:** say what is in the data, what the five synthetic worlds are, how the nine methods rank, how one raw event becomes Recall@K and NDCG@K, how H is compared with BL2, and what H0, H1 and H2 really showed.

Read it from top to bottom: it follows **one thread**, from raw rows to the verdict. The other files go deeper, and each section links to them. Written 2026-11-28.

Where the numbers come from: result numbers are in `.docs/results/p7-report/results.md` and the run folders in `.docs/results/`. Data counts are in `eval/data/<datasetId>/manifest.json`. The scores of the examples in §4 and §6 were computed with the real code (`@breadit/ranking` and the harness).

---

## 0. The thesis in one picture

```
data (6 CSV tables)
  → one hidden item per user: the last new post they liked, commented or reposted after the cut time T
  → rebuild what the app knew just before that moment (as-of)
  → build the pool: the posts that could be shown
  → each method gives every post a score, then sorts
  → find the rank r of the hidden post
  → Recall@K, NDCG@K per user, Coverage@K per method
  → H minus BL2, user by user → gain → interval, p-value, Holm
  → verdict: H0 (can we trust it?), H1 (RQ1), H2 (RQ2)
```

## 1. Words you need first

All other terms are in [09 Glossary](09-glossary.md).

| Word | Meaning |
|---|---|
| **Positive** | A like, comment or repost. The only feedback used. There is no dislike |
| **Followee** | A user that I follow |
| **Test item** | The hidden post: the user's last positive after T, on a post they had not touched before |
| **t_u** | The time of user u's test item. Everything about u is computed just before it |
| **As-of** | Only events before t_u count. This blocks **leakage** (using the future) |
| **Pool** | The posts a method may rank for this user at this time |
| **Rank r** | The position of the test item in the ranked pool. 1 is the best |
| **History** | The number of positives of u before t_u |
| **Cold start** | Little history. In this thesis: the group 0–4 |
| **Baseline** | A method we compare against |
| **Ablation** | H with one part switched off, to see what that part adds |
| **Gain** | The mean over users of (score of H − score of BL2) |
| **Validation / test** | Parameters are chosen on validation items. The test items are run once, at the end |
| **Homophily** | Similar people connect. Their likes agree even with no influence |
| **Influence** | What my followee does makes me more likely to do it |

## 2. The data

### 2.1 Six tables

Every dataset, synthetic or real, has the same six CSV tables. Here are real rows of `syn-W2M-M`.

```
users.csv          user_id,joined_at                              1,9615103
follows.csv        follower_id,followee_id,created_at             2,74,12335926
communities.csv    community_id,created_at                        1,0
memberships.csv    user_id,community_id,joined_at                 1,3,13802787
posts.csv          post_id,author_id,community_id,created_at      1,919,,15552198
                                                                  2,209,17,15552245
interactions.csv   event_id,user_id,post_id,type,created_at       1,483,2,like,15552328
```

How to read them:
- `follows`: user 2 follows user 74, since time 12335926.
- `posts`: post 1 has no community (the empty field). Post 2 is in community 17.
- `interactions`: user 483 liked post 2. These rows are the positives.

Ids are integers. Times are whole seconds. In the synthetic data they count from 2026-01-01 00:00 UTC; in Digg they are Unix seconds. Events are only added: there is no unlike and no unfollow. There is **no post text**: the study never looks at content.

### 2.2 How much data

| | `syn-W0-M` | `syn-W1-M`, `syn-W2L-M`, `syn-W2M-M`, `syn-W2H-M` | `digg2009` |
|---|---:|---:|---:|
| Users | 1,000 | 1,000 | 336,047 |
| Posts | 20,000 | 20,000 | 3,553 |
| Follows | 12,085 | 12,126 | 1,729,983 |
| Interactions | 22,258 | 22,258 | 3,007,345 |
| Communities / memberships | 20 / 1,773 | 20 / 1,773 | 0 / 0 |
| Interaction types | like, comment, repost | like, comment, repost | like only |

### 2.3 Synthetic against Digg

| | Synthetic | Digg 2009 |
|---|---|---|
| What it is | made by a seeded program | real votes and follows from the news site Digg, June 2009 |
| A post is | a generated post | a front-page story; its author is its first voter |
| Strength | we control the social effect; has communities | nobody set the social effect |
| Weakness | "the result is built in" | old, only popular stories, no communities, about 41% of voters are not in the friend table |
| Tests | H0, H1 (test 1), H2, the community term | H1 (test 2), the follow terms |

**A limit that is easy to miss: how many accounts a user follows.** We counted the rows of `follows.csv`.

| Over the whole file | `syn-W2M-M` | `digg2009` |
|---|---|---|
| Users with at least one followee | 496 of 1,000 | 71,269 |
| Shortest list / median list | 10 / 19 | 1 / 3 |
| Share of these users who follow 1–4 / 5–9 / 10 or more | 0% / 0% / 100% | 58.1% / 17.4% / 24.4% |

So in `syn-W2M-M` a user follows **nobody (504 users) or at least 10 accounts**. On Digg most lists are short.

- **Why:** each user with a list gets 1 follow plus a share of the rest, in proportion to a random weight that is never below 1 (`eval/src/generator/follows.ts`). With a mean of about 19.4, the shortest list is 10.
- **The calibration** matched the share of users with a list (51.19%) and the mean list length (24.26 on Digg, 24.45 here). It did not match the shape. `.docs/datasets.md` says the percentiles over users with a list were not computed.
- **What it means:** the synthetic data cannot test H2 at low follow counts. At test time one user is in the bin 1–4, because a follow counts only if it is older than t_u.
- Found on 2026-11-28. **The thesis does not say this yet.**

More: [04 Data](04-data.md).

## 3. The five synthetic worlds

### 3.1 How the data is made

The program runs five steps, all from the seed 20261014:
1. **Users:** each has a hidden main topic (20 topics) and an activity level. A few users are very active.
2. **Follows:** 51.19% of users get a follow list. **Homophily** `h` makes users prefer followees with a similar topic.
3. **Communities:** one community per topic, so **a community is a topic**. 30% of users join none; the others join 1 to 4.
4. **Posts:** each has an author and a topic. 30% go to a community.
5. **Interactions:** each action picks one post of the last 7 days at random, with this weight:

```
weight = interest in the topic × freshness × popularity × (1 + g_s · S) × (1 + g_c · member)
S = 1 if I follow the author, plus the number of my followees who already acted on the post
```

`g_s` is the strength of **social influence** and `g_c` of **community influence**. `member` is 1 if I am in the post's community, else 0. The program never uses any ranking method, so no method creates its own test data.

### 3.2 The worlds

"M" is the size: 1,000 users and 20,000 posts. The five worlds differ only in three numbers.

| World | h | g_s | g_c | What it is | Social lift | Gain of H over BL2, all users (95% interval) |
|---|---:|---:|---:|---|---:|---:|
| **W0** | 0 | 0 | 0 | null world: follows are random and have no effect | 1.09 | 0.012 (0.000 to 0.024) |
| **W1** | 0.7 | 0 | 0 | homophily only: similar users follow each other, no influence | 1.57 | 0.029 (0.017 to 0.041) |
| **W2L** | 0.7 | 0.5 | 0.5 | low influence | 2.24 | 0.035 (0.021 to 0.051) |
| **W2M** | 0.7 | 2 | 2 | middle influence: **the world of H1** | 3.78 | 0.045 (0.028 to 0.062) |
| **W2H** | 0.7 | 8 | 8 | high influence | 7.64 | 0.076 (0.057 to 0.095) |

**Social lift** measures how much more often users act on posts their followees "showed" them than by chance. 1 means no effect. The gains are NDCG@10, experiment E5, each world with its own tuned α and β. These are the 1,000-user worlds on their test items.

**Read the last column with care.** H also gains in W0 and W1, where there is no influence. This is **not a bug**. The community term counts the likes I gave before in a community. A community is a topic, so the term finds my topic interest. We call it the **topic signal**.

That is why the H0 gate uses **H-follow** (no community term) and not the full H. On W0, H-follow − BL2 is 0.001 (interval −0.004 to 0.006).

## 4. The nine ranking methods

### 4.1 Formulas

`age` is the age of the post in hours at time t. `likes`, `comments` and `reposts` are counted before t. All methods rank the same pool. Each score is stored as `floor(score × 100)`; equal scores are ordered by post id, larger first.

| Id | Score | Tuned value: `syn-W2M-M` / `digg2009` | Why it is there |
|---|---|---|---|
| **BL0** | posts of followees first, newest first; then the rest, newest first | none | today's "For You" |
| **BL1** | newest first | none | the simplest feed |
| **BL2** | `likes + 2·comments + 3·reposts − 0.25·age` | none | today's Explore score; **the reference of H1** |
| **BL2t** | BL2 with a tuned age weight in place of 0.25 | 0.125 / 4 | BL2 with the same tuning effort as H |
| **BL3** | `likes` | none | plain popularity |
| **BL4** | `log10(max(likes, 1)) + (createdAt − t) / divisor` (seconds) | divisor 720000 / 45000 | Reddit "hot", a strong known formula |
| **BL5** | `0.8·ln(likes) − gravity·ln(age + 2)`; a post with 0 likes is last | gravity 0.6 / 1.5 | Hacker News ranking, a second strong formula |
| **BL6** | BL2 + `α · count`, where count = (1 if I follow the author) + (followees who acted on the post) | α 16 / 1024 | the follow terms with every trust set to 1 |
| **H** | BL2 + `α·social + β·community` | α, β 1024, 1024 / 1024, 0 | **the method of the thesis** |

BL5 is Hacker News `(P − 1)^0.8 / (age + 2)^gravity` with `P − 1 = likes`, written with logarithms. The order is the same.

### 4.2 The two terms of H

```
trust(f)      = (n_f + m / |F|) / (N + m)
social(p)     = [I follow the author of p] · trust(author) + Σ trust(f) over my followees f who acted on p
community(p)  = (c + m · [I am a member of p's community] / |M|) / (N + m)       0 if p has no community
```

| Symbol | Meaning |
|---|---|
| `n_f` | my earlier positives on posts by followee f |
| `N` | all my earlier positives |
| `\|F\|`, `\|M\|` | how many accounts I follow, how many communities I joined |
| `c` | my earlier positives in the community of p |
| `m` | strength of the prior, frozen at 5 |

With no history (N = 0): `trust = 1/|F|` for every followee, and each joined community gets `1/|M|`. With a long history, my real behavior takes over.

### 4.3 The same three posts, ranked by every method

Two users follow A and B and are members of community C1. The **new** user has no history. The **old** user has 45 positives: 40 on posts by A, 5 in C1, none on B.

| Post | Author | Community | Likes | Comments | Reposts | Age | Acted on by a followee |
|---|---|---|---:|---:|---:|---:|---|
| p1 | A (followed) | none | 3 | 1 | 0 | 10 h | B |
| p2 | X | C1 | 6 | 0 | 1 | 4 h | none |
| p3 | Y | none | 10 | 2 | 0 | 20 h | none |

**Example parameters, not the tuned ones:** BL2t age weight 1; BL4 divisor 45000; BL5 gravity 1.8; BL6 α 8; H α 8, β 2, m 5.

| Method | p1 | p2 | p3 | Order | What decides |
|---|---:|---:|---:|---|---|
| BL0 | followee | | | p1, p2, p3 | follow, then time |
| BL1 | | | | p2, p1, p3 | time only |
| BL2 | 2.50 | 8.00 | 9.00 | p3, p2, p1 | popularity, small age penalty |
| BL2t | −5.00 | 5.00 | −6.00 | p2, p1, p3 | a stronger age penalty |
| BL3 | 3.00 | 6.00 | 10.00 | p3, p2, p1 | likes only |
| BL4 | −0.33 | 0.45 | −0.61 | p2, p1, p3 | likes on a log scale, and time |
| BL5 | −3.60 | −1.80 | −3.73 | p2, p1, p3 | likes against age |
| BL6 | 18.50 | 8.00 | 9.00 | p1, p3, p2 | popularity + a count of followees |
| H, new user | 10.50 | 10.00 | 9.00 | p1, p2, p3 | equal trust, community C1 |
| H, old user | 9.69 | 8.40 | 9.00 | p1, p3, p2 | trust in A is high, C1 is low |

BL0 to BL6 give the **same** result for the new and the old user, because they ignore history. Only H changes.

### 4.4 Ablations (H with one part off)

| Name | What is off |
|---|---|
| H-follow | the community term (β = 0) |
| H-comm | the social term (α = 0) |
| H-noauthor | the "I follow the author" part |
| H-noengager | the "my followees acted on it" part |
| H with m = 0, 2, 10 | another prior strength |

**BL6 is H-follow with every trust set to 1.** So the fair question "what do the trust weights add?" compares **H-follow with BL6**, not H with BL6. On `syn-W2M-M` (NDCG@10, all users) H-follow is 0.016 and BL6 is 0.011. No interval was computed for this pair, and each used its own tuned α (1024 for H-follow, taken from H, and 16 for BL6). H is at 0.054 mostly because of the community term: H-comm alone is 0.052.

More: [03 The hybrid score](03-hybrid-score.md).

## 5. From a ranking to a number

### 5.1 The steps

1. **Cut time T.** One time per dataset: 80% of all positives are at or before it. T is 21412417 for the size-M synthetic datasets and 1246068297 for Digg.
2. **Test item.** For each user, their last positive after T on a new post. One per user.
3. **Pool.** Root posts of the last 7 days before t_u, at most the 2,000 newest, without my own posts and posts I already touched.
4. **Left out.** If the test post is not in the pool, the user is not counted. `syn-W2M-M`: 49 of 590. `digg2009`: 3,547 of 68,120.
5. **Rank.** Each method ranks the whole pool. No random sample of "wrong" posts.
6. **Groups** by history: 0, 1–4, 5–19, 20 or more, and 0–4 (the group of H1).

| Kept test users | 0 | 1–4 | 0–4 | 5–19 | 20+ | all |
|---|---:|---:|---:|---:|---:|---:|
| `syn-W2M-M` | 59 | 115 | 174 | 177 | 190 | 541 |
| `digg2009` | 6,638 | 14,006 | 20,644 | 20,787 | 23,142 | 64,573 |

### 5.2 The three metrics

Each user has one test post at rank r.

| Metric | For one user | Over a group |
|---|---|---|
| **Recall@K** | 1 if r ≤ K, else 0 | the share of users whose test post is in the top K |
| **NDCG@K** | `1 / log2(r + 1)` if r ≤ K, else 0 | the mean |
| **Coverage@K** | (not per user) | different posts in any top K ÷ different posts in any pool |

- **Recall@K = HitRate@K** here, because there is only one correct post per user.
- **NDCG** also looks at the position. Rank 1 gives 1.000, rank 2 gives 0.631, rank 3 gives 0.500, rank 9 gives 0.301, rank 10 gives 0.289, rank 11 or worse gives 0 at K = 10.
- **Coverage** does not say whether the posts are right. It says whether a method shows many different posts or the same few. Read it next to NDCG.
- K is 5, 10 and 20. The main metric is **NDCG@10**.

**Example.** Five users with ranks 1, 3, 8, 14 and 40:
- Recall@10 = 3 of 5 = 0.600.
- NDCG@10 = (1.000 + 0.500 + 0.315 + 0 + 0) / 5 = 0.363.

**Coverage example.** Three users, K = 3, and the pools hold 10 different posts. If the three top-3 lists hold only 4 different posts, Coverage@3 = 0.4. If they hold 9, it is 0.9.

More: [05 The protocol](05-evaluation-protocol.md).

## 6. One real user, from raw rows to the metric

User **844** of `syn-W2M-M`, history group 1–4.

**What we know before the test moment** (t_u = 21447443):
- One earlier positive: the row `4938,844,3942,comment,17448185`. Post 3942 is by user 787 and has no community. So N = 1.
- 13 followees: 45, 46, 49, 170, 314, 339, 374, 390, 409, 604, 691, 695, 750. User 787 is **not** one of them.
- 4 communities: 1, 7, 12 and 16.

**The test event:** the row `17930,844,15863,like,21447443`. The test post is `15863,967,16,21431292`: author 967 (not followed), community 16 (844 is a member).

**What the ranking may see about post 15863:** 0 likes, 0 comments, 0 reposts, and an age of 4.49 hours. The like of user 844 itself is not visible: it is the thing to predict.

**The pool** holds 1,991 posts.

**BL2 score:** `0 + 0 + 0 − 0.25 × 4.49 = −1.12`.

**H score**, with α = β = 1024 and m = 5:

```
social      = 0        (author not followed, no followee acted on the post)
community   = (c + m / |M|) / (N + m) = (0 + 5/4) / (1 + 5) = 0.2083
H           = −1.12 + 1024 × 0 + 1024 × 0.2083 = 212.21
```

**The top of the two rankings**

| | Post | Why it is high | Score |
|---|---|---|---:|
| BL2, 1st | 15880 | 2 comments, 3.6 hours old | 3.11 |
| H, 1st | 15617 | followed author (390) in a joined community: social 0.0641, community 0.2083 | 272.89 |
| H, 3rd | 15881 | a joined community | 213.45 |
| H, 9th | **15863 (the test post)** | a joined community | 212.21 |

For a followee with no history, trust = (0 + 5/13) / (1 + 5) = 0.0641.

**For the posts shown here,** the social term adds about 66 points and the community term about 213, while engagement is between about −21 and 3. So here engagement mostly orders posts that get the same social and community points.

**All methods on this user**

| Method | Rank of 15863 | Recall@10 | NDCG@10 |
|---|---:|---:|---:|
| BL0 | 84 | 0 | 0 |
| BL1 | 62 | 0 | 0 |
| BL2 | 67 | 0 | 0 |
| BL2t | 84 | 0 | 0 |
| BL3 | 713 | 0 | 0 |
| BL4 | 142 | 0 | 0 |
| BL5 | 713 | 0 | 0 |
| BL6 | 78 | 0 | 0 |
| **H** | **9** | **1** | **1 / log2(10) = 0.301** |
| H-follow (not a run of E1) | 98 | 0 | 0 |
| H-comm (not a run of E1) | 7 | 1 | 1 / log2(8) = 0.333 |

For this user the paired difference is `d = 0.301 − 0 = 0.301`.

What this one user shows:
- A new post with no likes cannot be found by popularity (BL3: rank 713).
- The gain comes from the **community** term (H-comm: 7). The follow terms alone give rank 98.
- It is **one example**, chosen because H helps here. It proves nothing. The result is the mean over all users (§7).

**Run it yourself** (the output is post ids in rank order; 15863 is line 9):

```bash
npm run rank -w @breadit/eval -- --dataset syn-W2M-M --method H --user 844 --asof 21447443 --before-event 17930 --param alpha=1024 --param beta=1024 --param m=5 --top 10
```

For BL2, use `--method BL2`, no `--param`, and `--top 70` (15863 is line 67). The ranks of the nine methods of E1 equal the rows of user 844 in `eval/results/p7-main/per_user.csv`.

## 7. H against BL2 over all users

**Why BL2 is the reference.** H is BL2 plus two terms. So H − BL2 measures what the two social signals add. "Today's For You" is BL0; it is also compared (E1 and family F2).

### 7.1 Four steps

1. **Pair by user:** `d = NDCG@10 of H − NDCG@10 of BL2`.
2. **Gain:** the mean of all d.
3. **95% interval (bootstrap):** draw the users again with replacement, 10,000 times, and take the mean each time. The middle 95% is the interval.
4. **p-value (randomization test):** if H and BL2 were equal, the sign of each d would be random. Flip the signs at random 10,000 times and count how often the result is at least as large as the real one.

**Made-up example, six users.** Ranks of H: 1, 2, 15, 4, 30, 3. Ranks of BL2: 3, 2, 12, 9, 30, 10.
- d = 0.500, 0, 0, 0.130, 0, 0.211.
- Gain 0.140, interval 0.022 to 0.307, p = 0.247.
- The interval is above 0 but p is large. Only 3 users differ. This is why the rule needs **both**.

### 7.2 Holm correction

The thesis runs many tests: with many tests, one can look good by luck. **Family F1** holds the 15 tests of H − BL2 on one dataset (3 values of K × 5 groups). Holm sorts the 15 p-values from small to large. It multiplies the smallest by 15, the next by 14, and so on. A result can never become smaller than the one before it, and it is at most 1.

| H1 row (NDCG@10, group 0–4) | `syn-W2M-M` | `digg2009` |
|---|---|---|
| p before correction | 0.097 | 0.030 |
| Position among the 15 | 9th smallest | 5th smallest |
| Multiplier | 15 − 9 + 1 = 7 | 15 − 5 + 1 = 11 |
| Holm p | 0.680 | 0.335 |

### 7.3 The result

**H1 passes on a dataset only if both hold:** Holm p below 0.05 **and** the lower end of the interval above 0.

| Group 0–4, NDCG@10 | `syn-W2M-M` | `digg2009` |
|---|---|---|
| Users | 174 | 20,644 |
| BL2 → H | 0.012 → 0.035 | 0.029 → 0.029 |
| Gain | 0.023 | 0.000117 |
| 95% interval | −0.002 to 0.051 | 0.000015 to 0.000225 |
| Holm p | 0.680 | 0.335 |
| Verdict | **fail** | **fail** |

**The same results in counts of users** (Recall@10 × number of users, `syn-W2M-M`):

| Group | H has the test post in the top 10 | BL2 has it in the top 10 |
|---|---:|---:|
| All 541 users | 51 | 9 |
| The 174 users of group 0–4 | 11 | 4 |

### 7.4 All methods on the test split (all users, K = 10)

| Method | `syn-W2M-M` NDCG | Recall | Coverage | `digg2009` NDCG | Recall | Coverage |
|---|---:|---:|---:|---:|---:|---:|
| BL0 | 0.005 | 0.009 | 0.447 | 0.026 | 0.050 | 0.835 |
| BL1 | 0.003 | 0.007 | 0.423 | 0.025 | 0.050 | 0.433 |
| BL2 | 0.009 | 0.017 | 0.250 | 0.024 | 0.050 | 0.144 |
| BL2t | 0.011 | 0.024 | 0.042 | 0.027 | 0.059 | 0.137 |
| BL3 | 0.007 | 0.013 | 0.013 | 0.023 | 0.050 | 0.145 |
| BL4 | 0.009 | 0.022 | 0.021 | 0.197 | 0.333 | 0.218 |
| BL5 | 0.009 | 0.020 | 0.052 | 0.199 | 0.337 | 0.192 |
| BL6 | 0.011 | 0.022 | 0.357 | 0.025 | 0.053 | 0.526 |
| H | 0.054 | 0.094 | 0.210 | 0.024 | 0.050 | 0.144 |

**Reading:**
- On the synthetic data, H is far above every baseline.
- On Digg, H equals BL2 at three decimals, and BL4 and BL5 are about 8 times higher. There, how fresh a story is matters most.
- The values are small because each user has one correct post among up to 2,000. Compare methods with each other, not with papers that rank against 100 random posts.

More: [06 Statistics](06-statistics.md), [11 Experiments](11-experiments-and-results.md).

## 8. H0, H1, H2

| | Question it answers | RQ |
|---|---|---|
| **H0** | Can we trust the measurement? | none |
| **H1** | Does the hybrid help users with little history? | RQ1 |
| **H2** | Does it help more when the user has more social links? | RQ2 |

H0 here is **not** the "null hypothesis" of statistics. The null hypothesis of the H1 test is "H and BL2 are equal".

**RQ1.** Does adding social-graph signals (follow trust and community affinity) to the ranking improve the "For You" feed over the current heuristic, especially for users with little history?

**RQ2.** How does the level of social interaction between users change the ranking quality? What is the minimum level where the social signal starts to help?

### 8.1 H0, the sanity gate

- **Text:** in the null world W0, where follows are random, the follow part of the hybrid must not beat BL2.
- **Test:** H-follow against BL2 on `syn-W0-M`, with the α chosen on `syn-W2M-M`. It fails if the whole interval is above 0.
- **Result:** 0.001, interval −0.004 to 0.006. **It passes.**
- **Say:** "we see no sign of a bug or a leak". Do not say "this proves there is no bug". A separate leakage test also checks the code.
- **Hard question: "Did you change the gate after it failed?"** Answer honestly: yes. At first the gate used the full H. On the **validation** items the full H beat BL2 on W0, mostly through the community term, which carries topic interest. We changed it on 2026-11-11, **before any test run**, and recorded it. The thesis still reports H on W0 with the W2M values: 0.011 (−0.001 to 0.023).

### 8.2 H1 (RQ1)

- **Text:** for users with 0–4 earlier interactions, H has a higher NDCG@10 than BL2. Two co-primary tests, `syn-W2M-M` and `digg2009`, each judged alone.
- **Result:** fails on both (§7.3).
- **The two failures differ.** Synthetic: the interval is wide and holds 0, so the data cannot decide; the p is above 0.05 even without Holm. Digg: the gain is almost zero. Without Holm the Digg row would pass, but the rule was fixed before the test, and 0.000117 is far too small to matter.
- **Say:** "we could not show that H helps new users". Do not say "we showed that it has no effect".
- **Also true:** on `syn-W2M-M`, users with 20 or more earlier interactions gain 0.078 (Holm p 0.002). This is not H1.

### 8.3 H2 (RQ2)

- **Text, two parts:** (a) the gain over BL2 grows with social density (number of followees, amount of friend engagement in the pool); (b) it is about zero when the user follows nobody and has no community.
- **Result by number of followees at test time (`syn-W2M-M`):** 0: 0.044 (280 users); 1–4: 1 user, not read; 5–19: 0.056 (159); 20 or more: 0.030 (101). On Digg every bin is 0.000.
- **Part (a) is not supported:** the gain does not rise.
- **Part (b) holds by construction:** with no followee and no community signal both terms are 0, so H = BL2. The bin "0 followees" also holds users with a community. A check on 2026-11-28 of the saved ranks split the 280: 261 with a community signal (gain 0.047) and 19 without (gain 0.000, same rank). These two numbers are not thesis numbers.
- **The thesis text says "neither part holds". That is wrong for (b), and it is not fixed yet.**
- **Limits:** H2 has no numeric pass rule and no p-value; friend engagement in the pool was not measured; the synthetic data has almost no users with 1–9 followees (§2.3). So the "minimum level" of RQ2 is not answered.

### 8.4 What follows from H0, H1 and H2

The rule was fixed before the test: "For You" switches to the hybrid only if **H1 passes on both datasets and H0 passes**. H1 failed, so "For You" stays as it is. H2 is not part of this rule.

## 9. Main numbers to remember

| Fact | Numbers |
|---|---|
| H0 gate | H-follow − BL2 on W0: 0.001 |
| H1 | synthetic 0.023 (Holm p 0.680); Digg 0.000117 (Holm p 0.335) |
| All users, `syn-W2M-M` | H 0.054, BL2 0.009 |
| All users, Digg | H 0.024, BL2 0.024, BL4 0.197, BL5 0.199 |
| Which term gives the gain (E4) | H − BL2 0.045; H-comm − BL2 0.043; H-follow − BL2 0.007 |
| Prior strength (E4) | gain with m = 0, 2, 5, 10: 0.047, 0.051, 0.045, 0.041 |
| Gain by world (E5) | W0 0.012, W1 0.029, W2L 0.035, W2M 0.045, W2H 0.076 |
| Times shuffled (E5) | 0.042 |
| Larger pool (E8) | NDCG@10 of H goes from 0.054 to 0.048; of BL2 from 0.009 to 0.008 |
| Cost of page 1 (E7, one machine) | median about 36 ms for `chrono`, `engagement` and `social` |
| Tuned α, β | at the top of the grid (1,024) |

**The main finding in one sentence:** on these data the follow graph adds little, and most of the synthetic gain comes from the community term, which works as a topic signal.

## 10. Check yourself

1. Why is a like count of today not allowed in the ranking at t_u?
2. A test post is at rank 4. What are Recall@5, NDCG@5 and NDCG@3?
3. Why does H gain in W0, and why is that not a failed H0?
4. What is the difference between BL6 and H-follow?
5. Holm: a p-value is the 3rd smallest of 15. By what is it multiplied?
6. Why can the synthetic data not say how the gain changes between 0 and 10 followees?

**Answers.** 1: it would use the future (leakage). 2: Recall@5 = 1, NDCG@5 = 1/log2(5) = 0.431, NDCG@3 = 0. 3: the community term finds topic interest; the gate tests H-follow, which has no community term. 4: BL6 sets every trust to 1; both have no community term. 5: by 13 (then it must not be smaller than the adjusted value before it). 6: no user has a follow list of 1–9 accounts in the whole file; at test time very few users have a short list.
