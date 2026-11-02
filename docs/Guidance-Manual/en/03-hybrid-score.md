# 03 · The hybrid score and the baselines

[Guidance Manual](../Guidance-Manual.md) · English · [Tiếng Việt](../vi/03-hybrid-score.md)

**After reading this you can:** write the formula from memory, explain each term in one sentence, compute H by hand for a new and an old user, and say why each baseline is there.

Sources: super-plan §5 (methods) and §6 (the score); code in `packages/ranking/src/scorers.ts`. Terms: [09 Glossary](09-glossary.md).

---

## 1. The idea in one paragraph

The current feed ranks by time or by popularity. Popularity is the same for everyone, so it is not personal. The hybrid keeps popularity as a base (**engagement**) and adds two personal bonuses: posts that **people you trust** wrote or engaged with (**social**), and posts in **communities you care about** (**community**). "Trust" is learned from your own past behavior. When you have no past behavior yet, trust is spread evenly over everyone you follow. That is the trick that lets a brand-new user get a personal feed on day one.

## 2. The formula

```
H(p, u, t) = engagement(p, t) + α · social(p, u, t) + β · community(p, u, t)

engagement(p, t)   = likes + 2·comments + 3·reposts − 0.25·ageHours
trust(u, f, t)     = (n_uf + m / |F_u|) / (N_u + m)
social(p, u, t)    = [u follows author(p)] · trust(u, author(p), t)
                   + Σ trust(u, f, t)  over followees f who engaged with p before t
community(p, u, t) = (c_u,c(p) + m · [u is a member of c(p)] / |M_u|) / (N_u + m)
```

| Symbol | Meaning |
|---|---|
| p, u, t | the post, the user, the time we rank for (asOf) |
| `n_uf` | u's earlier positives (likes, comments, reposts) on posts by f |
| `N_u` | u's total earlier positives |
| `F_u`, `|F_u|` | u's followees at t, and how many |
| `c_u,c` | u's earlier positives on posts in community c |
| `M_u`, `|M_u|` | u's communities at t, and how many |
| m | prior strength, frozen at 5 |
| α, β | weights, tuned on the grid 0, 1, 2, 4, 8, 16 |
| `[x]` | 1 if x is true, else 0 |

Everything is counted **as of t**: only events before t (file 05).

The final score is the integer `floor(H × 100)`, and equal scores are ordered by post id, larger first.

## 3. Each term

**Engagement.** The production Explore score, unchanged. A comment is worth 2 likes and a repost 3. Each hour of age costs 0.25 points, so after 4 hours a post has lost 1 like. This is also baseline BL2. Keeping it inside H means H can only add to the current score, never throw it away.

**Trust.** "What share of u's attention goes to f?" Without smoothing it would be `n_uf / N_u`. For a new user that is 0/0, undefined, and the follow signal could not help the very users RQ1 is about. The **m-estimate** fixes this: it acts as if u had already made m extra interactions, spread equally over their followees. Then:
- a new user (N_u = 0): trust = (m/|F_u|) / m = 1/|F_u|, equal for every followee;
- a heavy user (N_u large): trust ≈ n_uf / N_u, their real behavior.

The weight of the prior is `m / (N_u + m)`. It slides smoothly from 1 to 0 as history grows. This replaces the three cold-start "phases" of the Orientation with one curve.

**Social.** Two parts:
- **author term:** if u follows the author, add the author's trust. Without it, a fresh post by a friend that nobody has liked yet gets nothing.
- **engager term:** for every followee who already engaged with p before t, add their trust. This is "your friends liked this".

**Community.** The same smoothing, for communities. A new member gets an equal share of prior for each community they joined. A post outside any community gets 0.

## 4. Worked example (computed with the real code)

Setting: α = 8, β = 2, m = 5 (example values, not the tuned ones). Two users. Both follow A and B, and both are members of community C1.

- **New user:** no history, N_u = 0.
- **Old user:** N_u = 45 positives, 40 of them on A's posts, 5 of them in C1, 0 on B's posts.

Three posts in the pool:

| Post | Author | Community | Likes | Comments | Reposts | Age | Engaged by a followee |
|---|---|---|---|---|---|---|---|
| p1 | A | — | 3 | 1 | 0 | 10 h | B liked it |
| p2 | X (stranger) | C1 | 6 | 0 | 1 | 4 h | nobody |
| p3 | Y (stranger) | — | 10 | 2 | 0 | 20 h | nobody |

**Step 1, engagement** (the same for both users):
- p1: 3 + 2·1 + 0 − 0.25·10 = **2.5**
- p2: 6 + 0 + 3·1 − 0.25·4 = **8**
- p3: 10 + 2·2 + 0 − 0.25·20 = **9**

So BL2 ranks **p3, p2, p1** for everyone.

**Step 2, the new user** (N_u = 0, |F_u| = 2, |M_u| = 1):
- trust(A) = (0 + 5/2) / (0 + 5) = **0.5**, trust(B) = **0.5**
- community(C1) = (0 + 5·1/1) / (0 + 5) = **1**
- p1: social = 0.5 (A is the author) + 0.5 (B engaged) = 1 → H = 2.5 + 8·1 = **10.5**
- p2: community = 1 → H = 8 + 2·1 = **10**
- p3: nothing personal → H = **9**

H ranks **p1, p2, p3**. The friend's post went from last to first, and the community post moved up, even though this user has never clicked anything.

**Step 3, the old user** (N_u = 45):
- trust(A) = (40 + 2.5) / 50 = **0.85**, trust(B) = (0 + 2.5) / 50 = **0.05**
- community(C1) = (5 + 5) / 50 = **0.2**
- p1: social = 0.85 + 0.05 = 0.9 → H = 2.5 + 8·0.9 = **9.7**
- p2: H = 8 + 2·0.2 = **8.4**
- p3: H = **9**

H ranks **p1, p3, p2**. Same follows and same community as the new user, but a different order, because the old user's real behavior now dominates. They care a lot about A, little about B, and only a bit about C1.

**The integer step.** The code gives scoreFixed 969 for the old user's p1, not 970. In floating point, 2.5 + 8·0.9 is 9.6999…, and `floor` cuts it. This is fine: the app and the evaluation run the same code, so they get the same 969. It shows why the score is fixed to integers and why the tie-break is total.

You can check every number: `scorer('H')` in `@breadit/ranking` gives 1050, 1000, 900 (new user) and 969, 840, 900 (old user).

## 5. The baselines and why each is there

| Id | Rule | Why it is in the study |
|---|---|---|
| BL0 | followees first, newest first | the current "For You" |
| BL1 | newest first | the simplest feed |
| BL2 | engagement | the current Explore; **the reference for H1**, because the question is "better than what the app does now" |
| BL2t | engagement with a tuned age weight | so that H is not the only tuned method |
| BL3 | most likes | a pure popularity floor |
| BL4 | Reddit "hot" (tuned) | a well-known strong heuristic |
| BL5 | Hacker News (tuned) | a well-known strong heuristic; the strongest one in the P5 table |
| BL6 | engagement + α × number of followees involved | H without trust weights: shows what trust adds over a plain count |

In the example, BL6 gives p1 = 2.5 + 8·2 = 18.5 for both users. It cannot tell the new user from the old one, because it ignores history. H can.

Strong tuned baselines (BL4, BL5) are there on purpose. A known problem in recommender research is new methods that only beat weak baselines (Ferrari Dacrema et al. 2019).

## 6. The ablations

Each ablation switches one part off and asks "how much did that part add?" (experiment E4).

| Ablation | What is off | Example, new user |
|---|---|---|
| H-follow | community term | p1 10.5, p3 9, p2 8 → p1, p3, p2 |
| H-comm | social term | p2 10, p3 9, p1 2.5 → p2, p3, p1 |
| H-noauthor | author part | p1 loses A's 0.5 |
| H-noengager | engager part | p1 loses B's 0.5 |
| H with m = 0, 2, 5, 10 | the prior strength | m = 0 removes the prior: a new user gets no social bonus at all |

## 7. Limits to know

- The weights 1, 2, 3 and 0.25 in engagement are the production values. They are not tuned (BL2t tunes only the age weight).
- On Digg there are no communities, so β has no effect there, and the community term is tested on synthetic data only.
- On Digg, 55% of kept cold-start users follow nobody. For them H equals BL2, so any gain must come from the other 45% (implementation-plan §3.7).
- Trust counts only positives. It cannot see dislikes, hides or time spent.

## 8. Check yourself

1. Why does a new user's trust not become 0/0?
2. What is the weight of the prior for a user with N_u = 15 and m = 5? *(5/20 = 0.25)*
3. Why does the author term exist?
4. In the example, why does the old user rank p3 above p2, but the new user ranks p2 above p3?
5. Why is BL2 the reference and not BL5, the strongest baseline?
