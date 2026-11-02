# 04 · The data

[Guidance Manual](../Guidance-Manual.md) · English · [Tiếng Việt](../vi/04-data.md)

**After reading this you can:** explain why the thesis uses two data sources, how the synthetic generator makes data, why there is a null world, how Digg 2009 was chosen and converted, and what each source can and cannot test.

Sources: super-plan P3, P4, §7, §8; `.docs/datasets.md`; `eval/config/synthetic-v1.json`; `eval/src/generator/`, `eval/src/adapters/`. Terms: [09 Glossary](09-glossary.md).

---

## 1. Why two sources?

The live Breadit database cannot be used: it has no real users, unlikes and unfollows are hard deletes (history is lost), `seed.ts` is not deterministic, and the `humans_v1` demo data has 0 likes and 0 follows.

So the thesis uses two sources that are **co-primary** for RQ1:

| | Synthetic data | Digg 2009 |
|---|---|---|
| What it is | seeded generator, 5 worlds, 2 sizes | real votes and follows from a news site, June 2009 |
| Strength | we control the social effect: a null world and an influence sweep are possible; has communities | nobody set the social effect: outside evidence |
| Weakness | a reader may say "the result is built in" | small, old, no communities, only front-page stories |
| Used for | H0, H1 test 1, H2 sweep, the community term, ablations | H1 test 2, the follow and author terms, H2 as a relation |

Each source covers the other's weakness. The Orientation also allows simulated data when there are no real users.

## 2. The canonical format

Every source is converted to the same six CSV tables (implementation-plan §2.2), so the harness never knows where data came from:

| File | Columns |
|---|---|
| `users.csv` | `user_id, joined_at` |
| `follows.csv` | `follower_id, followee_id, created_at` |
| `communities.csv` | `community_id, created_at` |
| `memberships.csv` | `user_id, community_id, joined_at` |
| `posts.csv` | `post_id, author_id, community_id, created_at` |
| `interactions.csv` | `event_id, user_id, post_id, type, created_at` (`type` = like, comment, repost) |

Rules: UTF-8, LF line ends, sorted rows, integer ids, integer seconds, no duplicates, only additions (no unlike or unfollow). A `manifest.json` records the source, the seed, the Node version and the SHA-256 of every file. Data lives in `eval/data/<datasetId>/` (git-ignored, rebuilt by a command).

## 3. The synthetic generator

Five stages, each with its own random stream from the master seed 20261014 (file 07):

1. **Users.** Each user gets a hidden main topic (20 topics) and an activity level. Activity is very skewed, like real sites: the share of users with 1, 2–4, 5–19 and 20+ actions is copied from Digg (27.8%, 25.62%, 26.86%, 19.72%). 20% of users join late, inside the activity span: real new users.
2. **Follows.** 51.19% of users have a follow list, with a mean of about 19.4 followees. A followee is drawn with weight `popularity × (1 − h + h × similarity)`, where h is the **homophily** of the world. Half of the links are returned (two-way).
3. **Communities.** One community per topic. 30% of users join none; the others join 1 to 4. Memberships follow the same homophily rule as follows: random in W0, by interest in W1 and W2.
4. **Posts.** An author is drawn by posting weight; the post's topic is usually the author's main topic (70%), otherwise random. 30% of posts go to a community the author is a member of at that time, and then take that community's topic.
5. **Interactions.** Every action, in time order, picks one post from the last 7 days with weight:

```
weight(u, p, t) = interest(u, topic p) · fresh(p, t) · (1 + π·n_p) · (1 + g_s·S(u, p, t)) · (1 + g_c·[member])
fresh(p, t)     = 1 / (1 + ageHours / 24)
S(u, p, t)      = [u follows author(p)] + number of followees of u who acted on p before t
```

`interest` is how much the topic fits the user, `fresh` favors new posts, `(1 + π·n_p)` favors popular posts, `g_s` is the **social influence** and `g_c` the **community influence**. The type is a like (75%), comment (15%) or repost (10%).

**Important:** the generator never ranks a feed. Interactions never depend on any method being tested, so there is no feedback loop (a ranking that creates its own training data).

## 4. The five worlds

| World | Homophily h | Social influence g_s | Community influence g_c | Meaning |
|---|---|---|---|---|
| W0 | 0 | 0 | 0 | **null world**: follows are random with respect to taste and carry no effect |
| W1 | 0.7 | 0 | 0 | similar people follow each other, but no influence |
| W2L | 0.7 | 0.5 | 0.5 | low influence |
| W2M | 0.7 | 2 | 2 | middle influence: **the H1 test 1 world** |
| W2H | 0.7 | 8 | 8 | high influence |

**Did it work?** The P3 check measures the **social lift**: how much more likely a user acts on a post a followee "showed" them, compared with chance. On size M: W0 1.09, W1 1.57, W2L 2.24, W2M 3.78, W2H 7.64. W0 is near 1 (no effect), W1 is higher (homophily alone makes friends agree), and the W2 cells grow with influence. That is exactly the design.

**Why W0 matters most.** If H beats BL2 in W0, it is not using a real social effect, because there is none. It must be a bug or a leak (the H0 gate).

## 5. Sizes and dataset ids

S: 200 users, 4,000 posts. M: 1,000 users, 20,000 posts. Eight synthetic datasets: all five worlds at M, and W0, W1, W2M at S (the S ones were for the first baseline table). Ids: `syn-<world>-<size>`, e.g. `syn-W2M-M`.

## 6. Calibration: chosen versus calibrated

Each generator parameter in `synthetic-v1.json` is marked:
- **calibrated:** set to match a Digg number (activity shares, mean actions per user 21.65, followees, list share);
- **chosen:** our own choice, with a reason written next to it (topics, homophily, influence levels, window).

On `syn-W2M-M`, every calibrated value is within its tolerance of the Digg target. The config file is frozen with its SHA-256 (super-plan §7).

## 7. Digg 2009: how it was chosen

Rules were written **before** looking at candidates (`.docs/datasets.md` §2), so the choice could not be bent toward a favorite. The two deciding rules:
1. a **directed follow graph with dates** on the same clock as the interactions;
2. **dated positive actions** on items whose author is a user in the same graph.

Digg passed both; Flickr, Epinions/Ciao and Weibo sets were "partial" or "fail". The original host is dead, so the two zips come from the Internet Archive copy of 2013-08-26. They are password protected (the dataset page gives the password), and the terms say "research purposes only" and ask to cite Hogg and Lerman (2012). The zips are not in git; their SHA-256 is.

## 8. Digg 2009: how it was converted

`npm run adapt:digg` reads the zips in memory (its own ZipCrypto reader, nothing is extracted) and writes the canonical files. Choices:
- a vote is a **like**;
- a story's **author is its first voter** (the dataset page says the first vote is the submitter's);
- a repeated (voter, story) vote keeps the earliest (7,299 rows dropped);
- links with date 0 (unknown, 1,670) and self-links (5) are dropped;
- Digg's own ids are kept.

Result: 336,047 users, 3,553 stories, 3,007,345 likes, 1,729,983 dated follows. Two runs give the same files.

A follow counts for a test only if it is dated before that test's time, so no later follow leaks into the past.

## 9. What each source can test

| | Synthetic | Digg |
|---|---|---|
| Follow term | yes | yes |
| Author term | yes | yes |
| Community term | yes | **no** (no communities) |
| H0 (null world) | yes (W0) | no (nobody can switch the effect off) |
| H1 | yes (test 1) | yes (test 2) |
| H2 | yes, as cause (influence is set) | yes, as relation only |

## 10. Limits to state in the thesis

- Synthetic results show that the **mechanism** works when the effect exists; they are not proof about real users.
- Digg: 3,553 stories over 36 days, only front-page stories (all already popular, which helps popularity baselines); about 41% of voters are not in the friend table; the graph is one crawl from July 2009.
- On Digg, 55% of kept cold-start test users follow nobody at their test time; for them H equals BL2.
- No dataset found has follows, interactions and communities together, so community evidence is synthetic only.

## 11. Check yourself

1. Why can the live Breadit database not be used for evaluation?
2. What is the difference between W1 and W2M, and why do we need both?
3. Why does the generator never rank a feed?
4. Why were the selection rules written before looking at the datasets?
5. Why must a Digg follow be dated before the test time to count?
