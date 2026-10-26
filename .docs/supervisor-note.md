# Thesis note for the supervisor: direction, data and design decisions

2026-10-27 · Direction A, Social-Graph-Aware Hybrid "For You" feed · Deadline 2026-11-20

This note answers the three questions of the week-0 checklist, and asks you to confirm the data choice, the design decisions and the scope cuts in one go. Details are in `.docs/super-plan.md` (plan), `.docs/literature.md` (papers and decisions) and `.docs/datasets.md` (data).

## 1. Direction A, and why

I chose Direction A. Breadit already has the follow graph and the communities, so it needs no new infrastructure. The "For You" feed today shows posts from the people you follow, newest first. It does not use how much you care about each person or each community. A new user who follows nobody sees only their own posts.

## 2. What is new (C2)

C2 is a hybrid score: the current engagement heuristic, plus a follow-trust term, plus a community-affinity term. The terms use only events before the time of the test. A prior of strength `m` replaces the three "phases" of the Orientation with one smooth curve, so a user with no history still gets a score from who they follow. In the pre-thesis platform, Explore ranks every user's feed with the same engagement heuristic. C2 adds personal signals to it and measures the gain. C1 and C3 stay as they were.

## 3. How "better" is measured

- **Metrics:** Recall@K (the same as HitRate@K), NDCG@K and Coverage@K, for K = 5, 10, 20, with full ranking and no sampled negatives.
- **Protocol:** temporal leave-last-out with one global cut time. Every feature uses only events before the test time.
- **Statistics:** paired bootstrap 95% confidence intervals and a randomization test, with Holm correction.
- **Questions:** RQ1: do social signals improve the feed, mostly for users with 0–4 earlier interactions (H1)? RQ2: how much social interaction is needed before the signal helps (H2)? Sanity check H0: in a world with no social influence, the hybrid must not win.
- **Baselines:** the current feed, newest first, the production engagement score, global popularity, Reddit "hot", Hacker News ranking, and a follow-count version of the hybrid. The tuned ones get a grid, so the hybrid is not the only tuned method.

## 4. Data (please confirm)

Breadit has no real users, only demo accounts, so the data comes from two sources, both main:
- **Real data: Digg 2009** (Lerman). 3,018,197 votes on 3,553 front-page stories by 139,409 voters, and 1,731,658 dated follow links. Follows and votes both have Unix dates. For 98.2% of the stories the author (the first voter) is in the graph. We checked this by reading both files in full.
- **Synthetic data**, made by a seeded generator. It is the only source for the null world (W0), the influence sweep and the community term.

Limits we state in the thesis: Digg is small (one month, only popular stories), only about 59% of the voters are in the friend table, and it has no communities. The community term is therefore tested on synthetic data only. Flickr WWW 2009 stays as a second real set. Its follow dates are calendar days but its favorites have only an order, so it is not the main one.

## 5. Design decisions (please confirm)

- **Trust:** one follow counts through a smoothed share of the user's past positives on that author, plus the same for friends who engaged. No time fade.
- **No history:** one smooth curve, not three phases.
- **Community:** a smoothed share of the user's past positives in the community.
- **Reach:** one hop (followees), not two. Two hops is out of scope.
- **Protocol:** as in section 3.
- **Not built into the data:** the null world W0, a world with shared interests but no influence (W1), three influence levels, and a timestamp shuffle.

## 6. Scope cuts

No graph neural network (DiffNet and similar), no learned social baseline (SoRec, SocialMF), no real-user pilot, no online A/B test. If time runs short, I drop in this order: timestamp shuffle, larger-pool run, finer ablations, latency to two feeds, the frontend toggle, and last the Digg adapter.

## 7. Questions for you

1. Do you confirm RQ1 and RQ2, and the data choice in section 4?
2. Digg's page says: "This data is made available to the community for research purposes only", and asks to cite Hogg and Lerman (2012). It has no license text. Is this enough for a thesis at our university?
3. What happens on 2026-11-20: the written thesis, the defense, or both? What format and length rules apply?
4. The pre-thesis report has a LightFM sentence that contradicts the chronological feed. I will correct it in the new text, and I will not edit the old report. Is that fine?
