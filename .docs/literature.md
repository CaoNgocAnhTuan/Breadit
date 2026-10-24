# Literature notes (P1) · updated 2026-10-24 · task 2026-10-23-p1-literature

Working notes for P1. Not thesis text.

## 1. Status table

| Ref | Short name | Type | Verified | Read | Opened | Cited in |
|---|---|---|---|---|---|---|
| [1] | Social recommendation review (Tang 2013) | survey | verified | abstract only | 2026-10-24 | not cited |
| [2] | SoRec (Ma 2008) | paper | verified | abstract only | 2026-10-24 | not cited |
| [3] | DiffNet (Wu 2019) | paper | verified | full text | 2026-10-24 | Ch2 |
| [4] | GNN social recommender survey (Sharma 2024) | survey | verified | full text | 2026-10-24 | Ch2 |
| [5] | RealGraph (Kamath 2014) | paper | verified | full text | 2026-10-24 | Ch2, Ch3 |
| [6] | Twitter code (Twitter 2023) | code | verified | full text | 2026-10-24 | Ch2 |
| [7] | Twitter blog (2023) | blog | do not cite, use [6] | index record | 2026-10-24 | not cited |
| [8] | SocialMF (Jamali 2010) | paper | verified | index record | 2026-10-24 | not cited |
| [9] | Social CF for cold start (Sedhain 2014) | paper | verified | abstract only | 2026-10-24 | not cited |
| [10] | Orkut communities (Chen 2009) | paper | verified | full text | 2026-10-24 | Ch2 |
| [11] | Reddit hot sort (Reddit 2015) | code | verified | full text | 2026-10-24 | Ch3 |
| [12] | Hacker News ranking (Shirriff 2013) | blog | verified | full text | 2026-10-24 | Ch3 |
| [13] | Splitting strategies (Meng 2020) | paper | verified | full text | 2026-10-24 | Ch2, Ch3 |
| [14] | Data leakage (Ji 2023) | paper | verified | full text | 2026-10-24 | Ch2, Ch3 |
| [15] | Sampled metrics (Krichene 2020) | paper | verified | full text | 2026-10-24 | Ch2, Ch3 |
| [16] | Target item sampling (Cañamares 2020) | paper | verified | abstract only | 2026-10-24 | not cited |
| [17] | Coverage and serendipity (Ge 2010) | paper | verified | full text | 2026-10-24 | Ch3 |
| [18] | Tied scores (McSherry 2008) | paper | verified | full text | 2026-10-24 | Ch3 |
| [23] | Influence and correlation (Anagnostopoulos 2008) | paper | verified | index record | 2026-10-24 | not cited |
| [24] | Algorithmic confounding (Chaney 2018) | paper | verified | full text | 2026-10-24 | Ch2 |
| [25] | Are we making progress (Ferrari Dacrema 2019) | paper | verified | full text | 2026-10-24 | Ch2, Ch3 |
| [28] | m-estimate (Cestnik 1990) | paper | verified | index record | 2026-10-24 | Ch3 (name only) |
| [29] | m-estimate in naive Bayes (Castellano 2020) | paper | verified | full text | 2026-10-24 | Ch3 |
| [30] | X For You algorithm (xai-org 2026) | code | verified | full text | 2026-10-24 | not cited |
| [31] | SocRipple (Jaspal 2025) | paper | verified | abstract only | 2026-10-24 | not cited |
| [32] | Community by Design (Weyl 2025) | paper | verified | abstract only | 2026-10-24 | not cited |
| [33] | Interaction strength (Zhou 2024) | paper | verified | abstract only | 2026-10-24 | not cited |

## 2. Claims

| # | Claim | Status | Evidence |
|---|---|---|---|
| 2 | RealGraph gives directed edge weights between users, learned from past interaction data. The weight is the predicted probability of a future interaction, not a count of past interactions. Super-plan §6 line 294 says "past interaction", which is looser. | supported | [5]: §1 defines the weight as the probability of an interaction from the source to the destination user in the future; §2.2 trains a logistic regression with a binary label on edge and user features; §3.1 gives the AUC per feature group. D1 uses this; Step 24 changes the wording of super-plan §6 line 294 |
| 3 | In the 2023 release at commit `ef4c5eb65e6e04fac4f0e1fa8bbeff56b75c1f98`, home-mixer reads each viewer's RealGraph scores for followed users (top 1000 by score) and attaches the RealGraph edge features of the pair (viewer, author) to each tweet candidate. The files show these as inputs (features); they do not show how a ranker weights them. The newer release [30] has no RealGraph file and ranks with a transformer. | supported | [6]: `home-mixer/server/src/main/scala/com/twitter/home_mixer/functional_component/feature_hydrator/RealGraphInNetworkScoresQueryFeatureHydrator.scala`, lines 26-40; `home-mixer/server/src/main/scala/com/twitter/home_mixer/store/RealGraphInNetworkScoresStore.scala`, line 18; `home-mixer/server/src/main/scala/com/twitter/home_mixer/functional_component/feature_hydrator/RealGraphViewerAuthorFeatureHydrator.scala`, lines 27-31 and 63-93; [30]: README, Overview |
| 4 | The form of the smoothing, (count + m × prior) / (total + m), is the m-estimate of Cestnik (1990), a known technique from classification. Using it for trust and community, and the value of `m`, are our own design. Super-plan §6 line 293 says "not a cited method". | supported | [29]: §2.4, eq. 19, p.6 (a secondary source for [28]); [28]: index record only, the paper was not read |
| 5 | The notes decide each of the three §6 choices with evidence. Smoothing with `m` and one curve instead of three phases are decided in D2. The author term is decided in D1. | supported | D2: the form follows [29] eq. 19; the weight of the prior is `m / (N_u + m)` (algebra on eq. 19); replacing the three phases is our own design. D1: the author term is kept, by analogy with [6] lines 63-93 and [5] §1 |
| 6 | 1 hop is our choice. A hop is one edge of the follow graph. 1 hop is partly a scope choice, because graph neural networks are out of scope (super-plan §9). [3] and [4] speak of layers, not hops. | own design | D4: [3] §3.1, §3.3.1 and Table 4 (§4.4); [4] §5.1 and Table 5; [8] is an index record and is not used |
| 7 | BL0 to BL5 are cheap, well-known baselines, but they are not personalised (BL0 only puts followees first) and are not tuned, so [25] cuts against calling them strong. A small validation grid (PC4) and a count baseline BL6 (PC3) would make the test fairer. There is no learned baseline: the live app has no training data and there is little time, which is a limitation. | supported | [25]: §1 and §2.2; [11]: `r2/r2/lib/db/_sorts.pyx` line 59; [12]: the paragraph on the Arc code; [30]: `README.md`, Overview |
| 8 | The protocol (leave-last-out, full ranking, as-of features, ties) was checked against [13] to [18], item by item against the leakage cases of [14]: 4 cases are covered by the plan, 2 are not applicable and 1 is a gap (tuning on validation items). Full ranking agrees with [15]. The tie rule is fixed and tested (E6, [18]). | supported | D6 and its leakage table; [13] §5; [14] §2.2, §3.2, §4.1 and §5; [15] §4.2 and §8; [17] §2; [18] §1 and §2; [16] is abstract only |
| 9 | W0 is a sanity check: if the hybrid beats BL2 there, there is a bug or a leak (H0). A W1 win shows prediction, not influence, because W1 has no influence by construction. The timestamp shuffle checks the test, not the generator. A simulation shows what can happen under its assumptions, and our worlds model no feedback loop between a recommender and its data. [23] was not read, so its shuffle test is not described here. | own design | D7; [24] §1, §5.1, §5.2 and §5.3; [23] is an index record and is not used |

## 3. How this file was made

- PDF tool: PDFKit through the compiled `pdftxt` (Swift 5.9.2, source `.docs/works/2026-10-23-p1-literature/pdftxt.swift`, built with `swiftc -framework PDFKit`), tested on [5] (title, authors and the first sentence of the abstract read well) and on [25] (authors and abstract read well, a table and the text of page 3 come out in the right order; the title lost its spaces and PDFKit printed one "CoreGraphics PDF has logged an error" line), 2026-10-24, pass.
- Tools that failed:
  - `swift pdftxt.swift` (interpreted): fails with "Symbols not found: PDFDocument", so the tool is compiled.
- Needs full text (for the author): [1] Tang 2013 (Springer sells the PDF), [8] Jamali 2010 (no legal copy found), [2] Ma 2008 (ACM 403, repository needs a login), [9] Sedhain 2014 (repository copy embargoed), [16] Cañamares 2020 (closed access), [28] Cestnik 1990 (closed access), [23] Anagnostopoulos 2008 (no open copy found).

## 4. Core papers

### [1] Social recommendation review (Tang 2013)
#### Reading guide
Could not be opened on 2026-10-24. This guide is from the abstract only.
1. How does the review define social recommendation, and which kinds of social information does it name (trust, friends, follows)?
2. How does it split memory-based and model-based social recommenders, and where does it put trust and its propagation?
3. Which positive and negative experiences does it report for social recommendation, and does it cover users with no history?

- Opened: 2026-10-24, abstract only [Springer landing page of DOI 10.1007/s13278-013-0141-9; the PDF is sold ("Buy article PDF"), so no full text was read]
- Says: a review of social recommender systems by Jiliang Tang, Xia Hu and Huan Liu (Social Network Analysis and Mining 3(4), pp. 1113-1133). The abstract says it gives formal definitions, sorts systems into memory-based and model-based ones, and reports findings from positive and negative experiences and research directions.
- For us: Chapter 2 background on social recommendation and D2 (users with no history). The abstract names no trust formula, hop count or cold-start result, so it supports no decision.
- Cited in: not cited

### [2] SoRec (Ma 2008)
#### Reading guide
Could not be opened on 2026-10-24. This guide is from the abstract only.
1. How does SoRec use the social network together with the rating records, and which factors do the two sources share?
2. How is the strength of a social link between two users defined or normalised?
3. How well does it do for users with few or no ratings, compared with the methods it is tested against?

- Opened: 2026-10-24, abstract only [Semantic Scholar record of DOI 10.1145/1458082.1458205; the ACM page answered 403 and the University of Galway repository copy needs a login, so no full text was read]
- Says: SoRec is a rating-prediction method by Hao Ma, Haixuan Yang, Michael R. Lyu and Irwin King (CIKM 2008). The abstract says it is a factor analysis approach based on probabilistic matrix factorization that uses both the users' social network and their rating records, that it scales linearly with the number of observations, and that it helps most when users have made few or no ratings.
- For us: D1 (trust) and D2 (users with no history). The abstract gives no link formula, no data set and no numbers, so it supports no decision.
- Cited in: not cited

### [5] RealGraph (Kamath 2014)
#### Reading guide
- Read: the abstract, §1, §2.1 to §2.3, §3.1 and §3.2. Skip: §4 (related work).
1. How does the paper define the weight of an edge between two users: a count of past interactions, or something else? (answer in §1)
2. What data and what model produce the weight, and what is the training label? (answer in §2.2)
3. How do the authors check that the weights are good, and how strong is that check? (answer in §3)

- Opened: 2026-10-24, full text [ueo-workshop.com PDF, UEO '14 workshop paper with no version number, sha256 1ecfd151c66e]
- Says: a framework at Twitter that gives each one-way tie between two users a weight. The weight is defined as the probability of an interaction from the source user to the destination user in the future (§1). It is learned with a logistic regression on edge features and on the features of both users, from past interaction data, with a binary label (§2.2). The weights are checked with AUC per feature group (Table 1, §3.1) and with a small survey of top-20 followings, which the authors call a preliminary result (§3.2). Twitter uses them for user recommendation and a "Circle of Trust" (§2.3).
- For us: D1 (trust) and the author term, and claim 2. Our trust is a plain smoothed frequency of past positives (super-plan §6), a simpler idea in the same spirit: RealGraph predicts a future interaction with a learned model. The paper has no smoothing or prior for users with few interactions (the only regularisation is the global L2 term of the model, §3.1). The paper does not say "at KDD"; it names "UEO '14 New York" on page 1.
- Cited in: Ch2, Ch3 (trust term)
- Anchor: §1, the weight is "defined as the probability of any inter- action going from the edge source to the edge destination in the future" (line break of the PDF kept in the quote).
- Against us: the weight is learned from many features and trained to predict a future interaction. We must say "in the spirit of RealGraph", not "the same as RealGraph".

### [9] Social CF for cold start (Sedhain 2014)
#### Reading guide
Could not be opened on 2026-10-24. This guide is from the abstract only.
1. How do the neighbourhood-based methods use side information (demographics, Facebook friends, page likes) for a user with no purchases?
2. How are friends weighted or combined, and is there any smoothing for users with few friends?
3. By how much does the best method beat the most-popular, demographic and friends baselines, and on which metrics?

- Opened: 2026-10-24, abstract only [ANU research portal record of DOI 10.1145/2645710.2645772; the repository PDF is embargoed until 2037-12-31 and the ACM page answered 403, so no full text was read]
- Says: Suvash Sedhain, Scott Sanner, Darius Braziunas, Lexing Xie and Jordan Christensen (RecSys 2014) study recommendation for users who have bought nothing yet but share side information such as demographics or social network data (Facebook friends, page likes). They write neighbourhood-based methods in a matrix algebra framework that needs no purchase data for the target user. On 30,000 users and 80,000+ books, the abstract reports that Facebook page likes give up to a 3-fold gain in mean average precision and up to 6-fold gains in Precision@k and Recall@k over the most-popular-item, demographic and Facebook-friend recommenders.
- For us: D2 (users with no history), the closest cold-start paper. The abstract gives no weighting formula and no smoothing, and the large gain it reports is for page likes over a friend-based recommender, so it supports no decision.
- Cited in: not cited

### [15] Sampled metrics (Krichene 2020)
#### Reading guide
- Read: §1, §3, §4.1, §4.2, §6.2, §7 and §8. Skip: §5 (the correction formulas) and §9.
1. What does it mean that a sampled metric is inconsistent with the exact metric? (answer in §4.1)
2. Which metric stays consistent under sampling, and what happens to the others? (answer in §4.2)
3. Does the paper advise to avoid sampling or to correct it, and what does the correction cost? (answer in §7)

- Opened: 2026-10-24, full text [ACM open-access PDF saved by the author, KDD '20 version, sha256 5212f092b6ae]
- Says: metrics computed on a small random sample of items can disagree with the exact metrics, even on average (§1, §4.1). Only AUC stays consistent; for the other metrics a sampled score can rank two models in the opposite order (§4.2). In a MovieLens 1M experiment with 100 sampled items, the sampled metrics rank the models differently from the exact metrics (Table 3, §6.2). Corrected estimators lower the bias but add variance (§5.3). Advice: avoid sampling as much as possible (§8); if it is needed, use a correction and several seeds (§7).
- For us: D6, the protocol. It supports ranking the full pool for each user and reporting no sampled metrics. The paper gives no cost numbers for full ranking on a large catalogue (§4), so the cost for our pool is our own check.
- Cited in: Ch2, Ch3 (full ranking)
- Anchor: §8, "sampling should be avoided as much as possible during evaluation."

## 5. Design decisions

### D1. Trust
- Question: How much should a follow count (trust), and should it fade over time?
- Decides: The trust formula (§6)
- Options: (a) trust is the share of u's earlier positives that went to f's posts, smoothed with `m` (super-plan §6, D2); (b) a learned weight, as RealGraph does: a logistic regression on many edge and user features ([5] §2.2); (c) a plain follow: every followee counts the same.
- Evidence:
  - [5] §1: the weight of a directed pair is "defined as the probability of any inter- action going from the edge source to the edge destination in the future". §2.2: it is learned with a logistic regression and a binary label. §2.1: "we decay historical interaction values" and an edge is removed when its latest interaction is too old. §2.1.1: one feature is a daily exponentially decayed count.
  - [6] `home-mixer/server/src/main/scala/com/twitter/home_mixer/functional_component/feature_hydrator/RealGraphViewerAuthorFeatureHydrator.scala`, lines 27-31 and 63-93 at commit `ef4c5eb65e6e04fac4f0e1fa8bbeff56b75c1f98`: the RealGraph features of the pair (viewer, author) are attached to each tweet candidate. They are inputs; the code does not show their weights.
  - [7] index record: not read, so not used.
  - [2] abstract only: uses the social network and the ratings together in a matrix factorization; the abstract has no link formula.
  - [8] index record: only the title was seen, which names trust propagation in a matrix factorization.
- Domain gap:
  - [5] task: ranking users to follow and similar uses (§2.3). Data: Twitter interaction logs. Graph: directed and weighted. Learned (§2.2). Ours is a heuristic count for ranking posts.
  - [6] task: ranking tweets for a timeline. Data: Twitter production data. Graph: the pair (viewer, author) as a per-candidate input. The ranker that uses it is not in the files, so learned or heuristic is unknown.
  - [2] task: predicting ratings. Data: ratings with a social network (abstract only). Graph: not stated. Learned (a probabilistic matrix factorization).
  - [8] from the title only: a matrix factorization with trust propagation, so learned. Task, data and graph were not read.
- Fade over time: options are none, a half-life or a window. The §6 formula has none. [5] decays old interactions (§2.1) and drops old edges, so [5] cuts against "none". The core formula keeps no fade, to avoid a new parameter that super-plan §7 does not hold. PC2 puts the question to the author.
- Author term (DW5): a post by a followee that nobody has engaged with yet gets no score from the friends' sum, so the term `[u follows author(p)] · trust(u, author(p), t)` is kept. [6] also feeds the viewer-author pair to its ranker for every candidate (lines 63-93). E4 shows what the term adds.
- Claims 2 and 3: [5] says "probability of a future interaction", not "past interaction", so the super-plan wording is looser (claim 2; Step 24 changes line 294). The code of [6] shows features, not weights (claim 3, §2).
- Against: [5] decays old interactions and learns its weight; ours does not decay and is a plain smoothed count, so we may say "in the spirit of RealGraph", not "like RealGraph". [30] ranks with a transformer and has no RealGraph file, so production may have moved to a learned model.
- Label: by analogy (abstract only)
- Choice: option (a), with the author term. By analogy with [5] for weighting a directed user pair by past interaction, and with [6] for using the (viewer, author) pair as an input for every candidate. No fade in the core formula.
- Status: proposed change (PC2)
- Result: `trust(u, f, t)` and the author term as in super-plan §6, with every event strictly before t. The fade question goes to the author (PC2).
- Feeds: super-plan §6 (`trust` and the author term)
- Author's note:

### D2. No history
- Question: How do we help users with no history yet?
- Decides: The prior `m` and its form (§6)
- Options: (a) smoothing with `m`, one smooth curve: trust = (n_uf + m / |F_u|) / (N_u + m), as in super-plan §6; (b) no smoothing: trust = n_uf / N_u, which is 0/0 when N_u = 0, so users with no history need a separate rule; (c) the three cold-start phases of the Orientation, with a fixed rule per phase.
- Evidence:
  - [29] §2.4, eq. 19, p.6: the m-estimate of a probability is (count + m × prior) / (total + m). The prior is the class prior, estimated with Laplace's law of succession (p.7). The weight of the prior is m / (total + m), which is algebra on eq. 19. [29] p.7: a higher level of noise needs a higher m.
  - [28] index record: [29] says that Cestnik 1990 introduced this estimate. The paper itself was not read. The name "m-estimate" came later, from Cestnik and Bratko 1991 ([29], footnote on p.2).
  - [9] abstract only: cold-start users who share side information; Facebook page likes gave up to a 3-fold gain in mean average precision over a recommender that uses Facebook friends. The abstract has no weighting or smoothing formula.
  - [1] abstract only: nothing on users with no history.
- Mapping: our trust has the same shape as, but differs in some parts from, the m-estimate of [29] eq. 19:

| Part | m-estimate | Our trust (super-plan §6) |
|---|---|---|
| count | n_c: events with outcome c | n_uf: u's earlier positives on f's posts |
| total | n: all events | N_u: all of u's earlier positives |
| prior | p: the prior probability of c ([29] estimates it with Laplace's law) | one over the number of followees: an even split, not estimated |
| support | the outcomes cover all n events, so the estimates sum to 1 | the prior covers followees only, but N_u also counts positives on other posts, so trust summed over followees is at most 1 |

  The same holds for `community`, whose prior covers only u's communities. [29] is a classification paper, so the comparison is by analogy.
- Against: [29] p.9: Cestnik gave no recommended value of m, so `m` has no value from theory and must be swept (E4). [29] p.2: the original experiments were very small (four data sets, no added noise). [29] is about class probabilities in a classifier, not about ranking posts. [9] (abstract only): page likes beat a friend-based recommender for users with no history, so friend-based trust may help less than hoped.
- Label: by analogy (abstract only)
- Choice: option (a), one curve and no phases. By analogy with [29] for the form. The value of `m` is not cited, and replacing the three phases by one curve is our own design.
- Status: proposed change (PC1)
- Result: `trust(u, f, t) = (n_uf + m / |F_u|) / (N_u + m)` and the same form for `community`, as in super-plan §6. The weight of the prior is `m / (N_u + m)`. P5 implements these, and E4 sweeps `m` (super-plan §7).
- Feeds: super-plan §6 (smoothing), super-plan §7 (`m`)
- Author's note: Zhai and Lafferty 2001 (a lead from memory) was checked as a record only (SIGIR 2001, DOI 10.1145/383952.384019). No legal full text was found, so it is not used.

### D3. Community
- Question: Is community membership a useful signal, and in what form?
- Decides: The community term (§6)
- Options: (a) membership as a signal for posts, with the form of super-plan §6: u's earlier positives in the post's community, plus a membership prior; (b) membership only, as a 1 or 0, as [10] uses it; (c) no community term.
- Evidence:
  - [10] §3.1: communities are recommended "based on his joined communities", so membership is the only input. §3.2: it enters as 1 (join) or 0 (not join). §6: counts of other activity are left as future work.
  - [10] §5.1.1: the data has 492,104 users and 118,002 communities. The abstract: LDA is better for lists of 4 or more communities, and ARM is a bit better for up to 3.
  - [10] has no friend data and no posts.
- Against: [10] recommends communities, not posts, so it says nothing about a post ranking. Its evaluation ranks the withheld community among 1000 sampled ones (§5.1.2); [15] §4.2 says that sampled metrics can be inconsistent with the exact ones. [10] is Orkut data of one period and one language (§5.1.1).
- Pool effect: today community posts are excluded from home and Explore (super-plan §3). The shared pool lets approved community posts in (super-plan §5), so two effects mix: the pool itself changes, and the community term acts on it. This affects every comparison of numbers across pool definitions, for example production BL2 against the BL2 of the evaluation. It does not affect comparisons inside one pool (H against BL2, H against H-follow), which all rank the same pool.
- Strength: weak
- Label: by analogy
- Choice: keep the `community` term of super-plan §6. By analogy with [10], which shows that membership helps to recommend communities. The form with u's earlier positives in the community, and its use for posts, are our own design.
- Status: decided
- Result: `community(p, u, t)` as in super-plan §6, with every event strictly before t. E4 and the H-follow and H-comm ablations show what it adds. The support is weak: [10] is about communities and not posts, and the evidence here is synthetic.
- Feeds: super-plan §6 (`community`) and §5 (the pool)
- Author's note:

### D4. Hops
- Question: Should influence reach friends of friends (2 hops)?
- Decides: 1 hop or 2, and the Chapter 2 argument for the choice
- Options: (a) 1 hop: only the accounts u follows count (super-plan §6); (b) 2 hops: also the accounts that those accounts follow, with trust multiplied along the path; (c) a learned diffusion over K layers, as in [3] (out of scope, super-plan §9).
- Definition: a hop is one edge of the follow graph. 1 hop reaches the accounts u follows. 2 hops also reach the accounts that those accounts follow. The sum over followees who engaged and the author term of super-plan §6 use 1 hop. [3] and [4] speak of layers, not hops: [4] never uses the word, and [3] only hypothesises a link to k-hop neighbours (§4.4). A layer is therefore not the same as a hop here.
- Evidence:
  - [3] §3.1: each user embedding is mixed with the embeddings of the users it trusts, for K steps (layers). §3.3.1 and Table 4 (§4.4): K = 2 is best on Yelp and Flickr. On HR@10, K = 1 is 2.50% (Yelp) and 2.96% (Flickr) below K = 2, and K = 3 drops again. The paper sets K = 2 (§4.1). The NDCG value printed for Yelp with K = 1 looks like a typo, so only HR@10 is used.
  - [4] §5.1 and Table 5: oversmoothing is listed as a known issue of GCN and graph attention encoders. §5.4 only defines K as the number of layers. The survey gives no best number of layers.
  - [8] index record: only the title was seen (trust propagation), so it is not used.
- Against: in [3], 2 layers beat 1 by about 3% on HR@10 on two data sets, so 1 hop leaves a gain unused in that setting. The comparison is by analogy, because [3] learns embeddings and our trust is a heuristic count.
- Scope: 1 hop is partly a scope choice. Graph neural networks such as [3] are out of scope (super-plan §9). A 2-hop heuristic needs a rule for the trust of a friend of a friend, and no source in this file gives one.
- Chapter 2 argument: we use 1 hop. In [3], 2 diffusion layers beat 1 by about 3% on HR@10, but that model learns embeddings, and [4] names oversmoothing as a known issue of deeper encoders. Our trust is a heuristic count. A learned diffusion is out of scope, so 2 hops are named as a limitation and as future work.
- Label: against (abstract only)
- Choice: option (a), 1 hop. Own design. [3] cuts against it for a learned model; the choice rests on scope (super-plan §9) and on the heuristic form of our trust.
- Status: decided
- Result: 1 hop in the `social` term and in the author term (super-plan §6). 2 hops is a limitation named in Chapter 2.
- Feeds: super-plan §6 (`social`); the Chapter 2 argument (super-plan §9)
- Author's note:

### D5. Baselines
- Question: Are the baselines strong enough?
- Decides: BL4 and BL5 (§5)
- Options: (a) BL0 to BL5 as in super-plan §5, run as they are; (b) the same baselines, with BL2, BL4 and BL5 tuned on the validation split with a small grid, plus a plain count baseline BL6; (c) add a learned baseline.
- Evidence:
  - [25] §1: of 18 neural methods it could reproduce 7, and in 6 of the 7 the neural method did not consistently beat simple, well-tuned baselines; in one case a most-popular recommender was best on some accuracy measures. §2.2: the baselines were tuned with a Bayesian search of 35 cases each.
  - [11] `r2/r2/lib/db/_sorts.pyx` line 59 at commit `753b17407e9a9dca09558526805922de24133d53`: the hot score is the sign of the net votes times log10 of the larger of |net votes| and 1, plus the post time minus 1134028003 seconds, divided by 45000. This is the form of BL4.
  - [12] the paragraph that starts "In case you don't read Arc code": the score is (votes - 1)^0.8 / (age in hours + 2)^1.8 times penalty factors, with gravity 1.8. This is the form of BL5. The penalties are ignored there (super-plan §5).
  - [30] `README.md`, Overview: the newer release ranks all posts with a transformer.
- Against: [25] cuts against the plan. It shows that well-tuned, simple, personalised baselines often beat new methods. BL0 to BL5 are not personalised (BL0 only puts followees first) and are not tuned, so they may be weak. [30] says the newer production ranking is a learned model, so beating hand-made scores like [11] and [12] does not show a gain over production.
- Why no learned baseline: the live app has no training data, and there is little time. A learned social baseline (SoRec, SocialMF) is out of scope (super-plan §9). This is a limitation. "Interpretability" is a design preference, not a tested claim.
- Tuned and not tuned: the hybrid H is tuned on the validation split (`m`, α and β in E4). BL0, BL1 and BL3 have nothing to tune. BL2, BL4 and BL5 are fixed formulas today. The proposal is a small validation grid for their time or age parameters, so that H is not the only tuned method (PC4). The grid sizes would be frozen values (super-plan §7).
- BL6: "the number of followees who engaged, with no trust weights" is proposed as a baseline, to show what the trust weights add over a plain count (PC3).
- Label: consistent only
- Choice: keep BL0 to BL5, and ask for the grid (PC4) and BL6 (PC3). Consistent with [25]: tuned and simple baselines are the fair test.
- Status: proposed change (PC3)
- Result: BL0 to BL5 as in super-plan §5 on the same pool. If PC3 and PC4 are accepted: BL6, and a small validation grid for BL2, BL4 and BL5. No learned baseline; the limitation is named in Chapter 3.
- Feeds: super-plan §5 (methods), super-plan §7 (grid sizes)
- Author's note:

### D6. Protocol
- Question: How do we split and measure without bias?
- Decides: The protocol (§5)
- Options: (a) the protocol of super-plan §5: as-of temporal leave-last-out per user, full ranking, no sampled negatives; (b) a global temporal split, with one time point for all users ([13] §5, [14] §5); (c) a random split.
- Evidence:
  - [13] §2: leaving out each user's last item can leak future evidence into training. §4: the ranking of the models changes with the split. §5: the global temporal split should be the default.
  - [14] §1 and §2.2: training interactions that happen after the test instances are a source of leakage, for leave-last-out and for random splits. §4.1: models then recommend items that did not exist yet. §4.2: the effect is as large as 89.5% in accuracy, with no clear pattern in the model ranking. §5: a timeline scheme is proposed. The preprint says this; the journal copy was not read.
  - [15] §1 and §4.2: sampled metrics can be inconsistent with the exact ones, even on average; only AUC is consistent. §8: sampling should be avoided as much as possible.
  - [16] abstract only: results with reduced target sets often contradict the results with large ones, and minimum sets distort pairwise comparisons.
  - [17] §2: catalogue coverage is the share of available items that the system ever recommends, measured over recommendation sessions. The paper has no experiments.
  - [18] §1 and §2: with tied scores, the order of the tied results can change a ranking measure. The authors give tie-aware versions of six measures that average over all tie orders, in closed form and deterministically (§2), at about the cost of the usual measures (§4).
- Against: [13] §5 recommends the global temporal split as the default, and [14] §5 prefers its timeline scheme to leave-last-out alone. Our test time `t_u` differs per user. The as-of features of super-plan §5 apply the same principle (nothing after `t_u` is used for u), but the tuning of `m`, α and β is a gap (see the table).
- Leakage table: each case of [14] against the protocol of super-plan §5.

| Leakage case ([14] section) | Our protocol (super-plan §5) | Status |
|---|---|---|
| Training interactions that happen after the test instances (§1) | every feature for u uses only events strictly before `t_u`, and nothing is trained on later events | covered by the plan, to be tested by the P5 leakage test |
| Leave-last-out with a collaborative model: similar users' later items are future for u's test point (§2.2) | as-of features use other users' events only before `t_u`, and the scores are heuristics with no collaborative model | covered by the plan, to be tested by the P5 leakage test |
| Random split by ratio or by user (§2.2) | not used: the split is a per-user temporal leave-last-out | not applicable |
| Recommending items that do not exist yet at the test time (§4.1) | the pool holds posts created before `t_u` | covered by the plan, to be tested by the P5 leakage test |
| Duplicated interactions (§3.1; [14] removes them in preprocessing and does not call them leakage) | the test item is a post the user had not touched before, and the pool drops the user's earlier positives | not applicable |
| Tuning on the validation items of the test users (§3.2; [14] does not call it leakage) | the validation item is the one before the test item of each user, so tuned values (`m`, α, β) can use events later than another user's test time | gap |
| Features built from future data (not a case in [14]; the whole text was searched) | as-of features are our own rule (super-plan §5) | covered by the plan, to be tested by the P5 leakage test |

- Pool and sampling: the pool is a rule-based filter, not a random sample: posts that are not deleted, are approved, were created before `t_u`, are inside the window W, are not blocked, newest N_max first (super-plan §5). So the inconsistency of [15] for random negatives does not apply directly. But the pool is a reduced candidate set, and [16] (abstract only) says that reduced target sets can contradict the result with large ones, so W and N_max may matter. PC6 asks for a second run with a larger pool.
- Left-out users: super-plan §5 reports the number of users whose test post is not in the pool, in total. H1 is about users with 0 to 4 earlier interactions (super-plan §1), so a total hides a bias in that bucket. PC7 asks for the number per history bucket.
- Ties: [18] shows that tied scores make a metric depend on an arbitrary order. The fixed rule `(scoreFixed desc, postId desc)` is deterministic, and E6 repeats the run with the reversed rule (super-plan §5). If E6 changes the ranking of the methods, the results are reported with the tie-aware measures of [18].
- Coverage: Coverage@K of super-plan §5 follows the idea of catalogue coverage in [17] §2. [17] gives only the definition, no experiment.
- Label: consistent only (abstract only)
- Choice: option (a), the protocol of super-plan §5, and PC5 to close the tuning gap. Consistent with [14] and [13] on the principle that nothing after the test time is used for a user, with [15] on full ranking with no sampled negatives, and with [18] on a fixed tie rule that is tested (E6).
- Status: proposed change (PC5)
- Result: the protocol of super-plan §5 as written. The table above has 4 cases covered by the plan, 2 not applicable and 1 gap. The gap, the pool run and the left-out users are proposed changes (PC5, PC6, PC7). The wording of super-plan §5 on as-of features is PC8.
- Feeds: super-plan §5 (split, pool, ties, metrics)
- Author's note:

### D7. Built into the data
- Question: How do we show the result is not built into the data?
- Decides: Worlds W0 and W1, the shuffle test (P3, E5)
- Options: (a) the null world W0, the latent-homophily world W1 and the timestamp shuffle in E5, as in super-plan §7; (b) W0 only; (c) public data only (P4).
- Evidence:
  - [24] §5.1: a simulation of 100 users over 1,000 time intervals with six methods (popularity, content filtering, matrix factorization, social filtering, random and ideal). §5.2: repeated training on data that the recommender helped create makes users more alike, without a gain in utility. §1, Figure 1 caption: "Confounding occurs when a platform attempts to model user behavior without accounting for recommendations." §5.3: it assumes a fixed utility for each user and item. All data are simulated.
  - [23] index record: the title names influence and correlation in social networks. The text was not read, so the details of its shuffle test are not used here.
- What a W1 win means: in W1, follows and interactions both come from shared interests, and there is no influence (super-plan §7). If the hybrid beats BL2 in W1, the social term predicts better. That is prediction, not influence. Whether follows influence what users do cannot be read from W1.
- The shuffle test checks the test, not the generator: a pass or a fail of the timestamp shuffle (E5) says whether the evaluation reacts to time order. It does not say whether the generator built the social signal into the data. This is our reading; [23] was not read.
- RQ2 thresholds: they are "in generator units" until they are calibrated to real data (task `p1-dataset-selection`, `.docs/datasets.md`, which does not exist yet).
- Against: [24] says what can happen under stated assumptions, and it models a feedback loop between a recommender and its logged data. Our worlds make interactions from interests, follows and memberships, not from a ranking algorithm, so a feedback loop is not modelled. Real data may differ.
- Label: by analogy (abstract only)
- Choice: option (a), with W0, W1 and the shuffle in E5. By analogy with [24]: a simulation shows what can happen under its assumptions, not what happens in a real system.
- Status: decided
- Result: W0 must not favour the hybrid (H0). A W1 win is reported as prediction, not influence. The shuffle is reported as a check of the test. RQ2 thresholds are written "in generator units" until calibrated.
- Feeds: P3 worlds and E5 (super-plan §7)
- Author's note:

## 6. Other references

### [3] DiffNet (Wu 2019)
- Opened: 2026-10-24, full text [arXiv 1904.10322v1, sha256 8ff64645267c]
- Says: Le Wu, Peijie Sun, Yanjie Fu, Richang Hong, Xiting Wang and Meng Wang, "A Neural Influence Diffusion Model for Social Recommendation" (SIGIR 2019; the model is called DiffNet). Each user embedding is mixed with the average embedding of the users it trusts, repeated for K steps (§3.1). K = 2 is best (§3.3.1). On Yelp and Flickr, K = 1 is 2.50% and 2.96% below K = 2 on HR@10, and K = 3 drops again (Table 4, §4.4). The paper has no formal definition of a hop; §4.4 only hypothesises a link to k-hop neighbours.
- For us: D4. It is a neural embedding model, not a count, so its depth result is by analogy only.
- Cited in: Ch2
- Anchor: §4.4, Table 4: HR@10 for K = 0 to 3, with K = 2 best on both data sets.

### [4] GNN social recommender survey (Sharma 2024)
- Opened: 2026-10-24, full text (§1, §4.1.2–4.1.3, §5.1–5.1.3, §5.4, §6.3, §7, §8) [arXiv 2212.04481v3, the preprint (volume and issue are not shown, so it may differ from the ACM copy), sha256 ed3630bc5228]
- Says: Kartik Sharma and six co-authors review GNN-based social recommender systems. They annotate 2,151 papers with the PRISMA framework and identify 84 on GNN-based social recommenders (abstract). Table 5 (§5.1) compares encoders: GCN and graph attention encoders list oversmoothing as a known issue. The word "hop" never appears in the text, and no best number of layers is given.
- For us: D4. Only the parts named in Opened were read, so it can support a statement only about those sections.
- Cited in: Ch2
- Anchor: §5.1, Table 5: the Known Issues column lists oversmoothing for the GCN and GANN rows.

### [6] Twitter code (Twitter 2023)
- Opened: 2026-10-24, full text [github.com/twitter/the-algorithm, commit ef4c5eb65e6e04fac4f0e1fa8bbeff56b75c1f98 (2023-03-31, "Twitter Recommendation Algorithm"); the three files named below were read in full]
- Says: in `home-mixer`, `RealGraphInNetworkScoresQueryFeatureHydrator` reads the viewer's RealGraph scores for followed users from the dataset `real_graph_scores_in` (`RealGraphInNetworkScoresStore`), keeps the top 1000 by score and stores them as the query feature `RealGraphInNetworkScoresFeature`. `RealGraphViewerAuthorFeatureHydrator` attaches the RealGraph edge features of the pair (viewer, author) to each tweet candidate as a `DataRecord` feature. The files show these scores as inputs. They do not show how a ranker weights them.
- For us: D1 (trust and the author term) and claim 3. Super-plan §6 says the open-source ranking "uses it for in-network tweets"; the code shows only that the scores are features. The same three files differ at the later HEAD `c54bec0d4e029fe34926ef3258a86ccacc0d0182` (2025-09-03; 52, 14 and 2 changed lines), so claims name the 2023 commit. A Haiku agent read the HEAD versions of these and three more files (`extracts/06.md`).
- Cited in: Ch2
- Anchor: `home-mixer/server/src/main/scala/com/twitter/home_mixer/functional_component/feature_hydrator/RealGraphViewerAuthorFeatureHydrator.scala`, lines 27-31 and 63-93 at the commit above.
- Against us: the newer release [30] ranks posts with a transformer and has no RealGraph file in its tree, so production may have moved to a learned model.

### [7] Twitter recommendation blog (Twitter Engineering 2023)
- Opened: 2026-10-24, index record [Wayback availability API: snapshot 20240508043115, a record only]
- Says: the text of the post was not read. Direct fetches of the snapshot returned HTTP 429 five times on 2026-10-24, `blog.x.com` returned HTTP 403, and the availability API returned 429 on its last try. Nothing is claimed about what the post says.
- For us: super-plan §6 cites it together with [6] for the use of RealGraph in the ranking. Use [6] instead. Step 24 tries the snapshot again.
- Cited in: not cited

### [8] SocialMF (Jamali 2010)
- Opened: 2026-10-24, index record [Crossref record of DOI 10.1145/1864708.1864736; the ACM page is paywalled and no legal full text was found]
- Says: Mohsen Jamali and Martin Ester, "A matrix factorization technique with trust propagation for recommendation in social networks", RecSys 2010, pp. 135-142 (Crossref). No abstract or text was read, so nothing is claimed about the method.
- For us: D1 and D4 (trust and hops). The title names trust propagation, but a title supports no decision.
- Cited in: not cited

### [10] Orkut communities (Chen 2009)
- Opened: 2026-10-24, full text [web-archive.southampton.ac.uk/www2009.eprints.org, the WWW 2009 conference archive PDF (proceedings version; its copyright line allows classroom and personal use), sha256 988e0831f21d]
- Says: Wen-Yen Chen, Jon-Chyuan Chu, Junyi Luan, Hongjie Bai, Yi Wang and Edward Y. Chang (WWW 2009, pp. 681-690) compare association rule mining (ARM) and latent Dirichlet allocation (LDA) for recommending Orkut communities to a user from the communities the user has joined (§3.1, §3.2). The data has 492,104 users and 118,002 communities (§5.1.1). Each user's evaluation set is one withheld community plus 1000 random communities the user has not joined (§5.1.2). The abstract says LDA is better for lists of 4 or more communities and ARM is a bit better for lists of up to 3.
- For us: D3 (community). The method uses membership only, as 1 or 0 (§3.2, §6). It uses no friend data and no posts.
- Cited in: Ch2
- Anchor: §3.1: "we can recommend communities to a user based on his joined communities".
- Against us: it recommends communities, not posts. Its evaluation ranks the withheld community among 1000 sampled ones, and [15] says sampled metrics can be inconsistent with the exact ones.

### [11] Reddit hot sort (Reddit 2015)
- Opened: 2026-10-24, full text [github.com/reddit-archive/reddit, file `r2/r2/lib/db/_sorts.pyx` read in full, commit 753b17407e9a9dca09558526805922de24133d53 (2017-10-14, "Update README for archival"); the file was last changed on 2015-08-17 (commit d990533d0b57); sha256 of the file text a2447de79fd7]
- Says: the function `hot` (it calls `_hot`) scores a post from its net votes s = ups - downs. The vote part is the sign of s times log10 of the larger of |s| and 1. A time term is added: the post time in seconds minus 1134028003, divided by 45000. The return line is `round(sign * order + seconds / 45000, 7)` (line 59).
- For us: D5, the formula of BL4 (likes as upvotes, no downvotes, super-plan §5). The file does not explain the offset 1134028003.
- Cited in: Ch3
- Anchor: `r2/r2/lib/db/_sorts.pyx`, line 59: `return round(sign * order + seconds / 45000, 7)`.

### [12] Hacker News ranking (Shirriff 2013)
- Opened: 2026-10-24, full text [righto.com page (Ken Shirriff's blog), read in full, no dated byline: the URL and the comments show November 2013, sha256 of the page 3a7ce7dac0c1]
- Says: Hacker News scores a story as (votes - 1)^0.8 / (age in hours + 2)^1.8, times penalty factors. The formula is an image; its text is in the alt attribute of the page. The post shows Arc code with the constants gravity 1.8 and timebase 120 minutes. It describes penalties for some titles and domains, for controversy (more comments than upvotes and at least 40 comments) and for flags. The author says the real penalty system is more complex than the published code.
- For us: D5, the formula of BL5, with penalties ignored (super-plan §5).
- Cited in: Ch3
- Anchor: the paragraph that starts "In case you don't read Arc code": gravity 1.8 and timebase 120.

### [13] Splitting strategies (Meng 2020)
- Opened: 2026-10-24, full text [arXiv 2007.13237v1, sha256 f07580de388a]
- Says: Zaiqiao Meng, Richard McCreadie, Craig Macdonald and Iadh Ounis (RecSys 2020) compare split strategies on two grocery data sets (Tafeng and Dunnhumby) with seven recommenders (§3). The ranking of the models changes with the split, and Kendall's tau between pairs of strategies is only moderate, 0.5284 to 0.7630 (§4). Leaving out each user's last item can leak future evidence into training (§2). The paper recommends the global temporal split as the default (§5).
- For us: D6. It cuts against a per-user leave-last-out for trained models. The paper says nothing about sampled versus full ranking, and nothing about ties.
- Cited in: Ch2, Ch3
- Anchor: §5, best practice 2: "This is generally seen as the most realistic setting, and so should be the default splitting strategy used."

### [14] Data leakage (Ji 2023)
- Opened: 2026-10-24, full text [arXiv 2010.11060v4, 30 Oct 2022, marked "Accepted by TOIS"; this is the preprint, not the typeset journal copy, sha256 e10a1ebfbccc]
- Says: Yitong Ji, Aixin Sun, Jie Zhang and Chenliang Li (ACM TOIS 41(3), 2023). The preprint says that, with four models (BPR, NeuMF, SASRec, LightGCN) on four data sets (MovieLens-25M, Yelp, Amazon-music, Amazon-electronic), training on data from the future changes the reported accuracy by as much as 89.5% and changes the ranking of the models with no clear pattern (§4.2). The cause is a split that does not follow the global timeline (§2.2). The authors propose a timeline scheme (§5).
- For us: D6 and the leakage table. The paper has no case about features built from future data, so the as-of rule of super-plan §5 is our own design.
- Cited in: Ch2, Ch3
- Anchor: §4.2: "the magnitudes in Table 5 can be as high as 89.5%, and there is no particular pattern."

### [16] Target item sampling (Cañamares 2020)
- Opened: 2026-10-24, abstract only [Semantic Scholar record of DOI 10.1145/3383313.3412259; Crossref gives the same title, authors, year and pages 259-268]
- Says: the paper studies how the choice of target set in offline evaluation changes the result of comparing recommenders. The abstract says that reduced target sets often contradict the result with large targets, and that minimum sets distort pairwise comparisons while maximum sets may not be ideal either. Super-plan §10 gives the code repository as the link. The paper itself is DOI 10.1145/3383313.3412259 (RecSys 2020).
- For us: D6, sampled versus full ranking. Only the abstract was read, so it supports no decision. The ACM page and the UAM repository gave no full text (the repository answered 403).
- Cited in: not cited

### [17] Coverage and serendipity (Ge 2010)
- Opened: 2026-10-24, full text [Dietmar Jannach's university page (web-ainf.aau.at), the RecSys 2010 paper as printed (4 pages), sha256 92cfd8b1f440]
- Says: Mouzhi Ge, Carla Delgado-Battenfeld and Dietmar Jannach (RecSys 2010) argue that recommender systems should not be judged on accuracy alone. They define catalogue coverage as the share of available items that the system ever recommends, measured over recommendation sessions (§2), and propose a measure of serendipity (§3). The paper has no data set, no algorithm and no results; it describes a planned user study.
- For us: D6, the Coverage@K metric of super-plan §5. It supports the definition only. The formulas are garbled in the text, so this entry rests on the words around them.
- Cited in: Ch3
- Anchor: §2, the paragraph on catalogue coverage: the share of available items that the system ever recommends.

### [18] Tied scores (McSherry 2008)
- Opened: 2026-10-24, full text [Microsoft Research PDF (microsoft.com/en-us/research), ECIR 2008, LNCS 4956, pp. 414-421, sha256 1c72e054f2c3]
- Says: Frank McSherry and Marc Najork (ECIR 2008) show that when scores are tied, different orders of the tied results can give appreciably different values of a ranking measure (§1). They adapt six measures (precision, recall, F1, average precision, reciprocal rank and NDCG) so that they give the average over all tie orders, in closed form and deterministically (§2). The cost is about that of the usual measures (§4).
- For us: D6, ties. The fixed tie rule and the reversed run of E6 (super-plan §5) test the same risk. The paper gives no numeric example and does not discuss breaking ties by item id.
- Cited in: Ch3
- Anchor: §2: "rather than explicitly producing these orderings we analytically derive their average".

### [23] Influence and correlation (Anagnostopoulos 2008)
- Opened: 2026-10-24, index record [Crossref and OpenAlex records of DOI 10.1145/1401890.1401897]
- Says: the records confirm the title, the three authors (Aris Anagnostopoulos, Ravi Kumar, Mohammad Mahdian), KDD 2008, pages 7-15. No full text or abstract was read, and no legal open copy was found (the Sapienza repository answered 403).
- For us: D7 and claim 9, what W0, W1 and the timestamp shuffle can and cannot show. Without the text it supports no decision.
- Cited in: not cited

### [24] Algorithmic confounding (Chaney 2018)
- Opened: 2026-10-24, full text [arXiv 1710.11214v2, 27 Nov 2018, sha256 3965bdb1e39d]
- Says: Allison J. B. Chaney, Brandon M. Stewart and Barbara E. Engelhardt (RecSys 2018) simulate 100 users over 1,000 time intervals with six recommendation methods: popularity, content filtering, matrix factorization, social filtering, random and ideal (§5.1). Repeated training on data that the recommender helped create makes users more alike without a gain in utility (§5.2). The paper has no standalone definition of "algorithmic confounding", only the caption of Figure 1, and no statement of the limits of simulation. All data are simulated.
- For us: D7 and claim 9. It supports the point that a simulation shows what can happen under stated assumptions, and that logged data made by a recommender carry a feedback loop that our worlds do not model.
- Cited in: Ch2
- Anchor: §1, the caption of Figure 1: "Confounding occurs when a platform attempts to model user behavior without accounting for recommendations."

### [25] Are we making progress (Ferrari Dacrema 2019)
- Opened: 2026-10-24, full text [arXiv 1907.06902v3, 16 Aug 2019, sha256 772fd88ba7ae]
- Says: Maurizio Ferrari Dacrema, Paolo Cremonesi and Dietmar Jannach (RecSys 2019) tried to reproduce 18 recent neural methods for top-n recommendation and could do so for 7 (§1). In 6 of the 7 the neural method did not consistently beat simple, well-tuned baselines, and in one case even a most-popular recommender was best on some accuracy measures (§1). The baselines were TopPopular, UserKNN, ItemKNN, ItemKNN-CBF, ItemKNN-CFCBF, P3alpha and RP3beta. Each was tuned with a Bayesian search of 35 cases (§2.2).
- For us: D5. It cuts against the plan: BL0 to BL5 are not personalised (BL0 only puts followees first) and are not tuned, so they may be weak baselines.
- Cited in: Ch2, Ch3
- Anchor: §1, "in the large majority of the investigated cases (6 out of 7)"; §2.2, 35 cases per algorithm.

## 7. Recent work (2022 or later)

### Search log

| Date | Source | Query | Looked at | Picked |
|---|---|---|---|---|
| 2026-10-24 | WebSearch | Q1: follow trust community affinity engagement feed ranking | 9 | none |
| 2026-10-24 | OpenAlex | Q1: follow trust community affinity engagement feed ranking | 25 | none |
| 2026-10-24 | WebSearch | Q2: social trust and community membership in news feed ranking | 9 | [32] |
| 2026-10-24 | OpenAlex | Q2: social trust and community membership in news feed ranking | 25 | none |
| 2026-10-24 | WebSearch | Q3: hybrid feed ranking engagement score follow graph community signal | 9 | none |
| 2026-10-24 | OpenAlex | Q3: hybrid feed ranking engagement score follow graph community signal | 25 | none |
| 2026-10-24 | WebSearch | Q4: interaction strength between users and group membership for post recommendation | 9 | none |
| 2026-10-24 | OpenAlex | Q4: interaction strength between users and group membership for post recommendation | 25 | none |
| 2026-10-24 | WebSearch | Q5: tie strength and community affinity in personalized social feed | 9 | none |
| 2026-10-24 | OpenAlex | Q5: tie strength and community affinity in personalized social feed | 25 | none |
| 2026-10-24 | WebSearch | Q6: cold-start social recommendation followee engagement community heuristic | 9 | [31] |
| 2026-10-24 | OpenAlex | Q6: cold-start social recommendation followee engagement community heuristic | 6 | none |
| 2026-10-24 | journal page | follow-up check of a lead from the Q4 and Q5 runs (Zhou et al. 2024, interaction strength and group participation) | 1 | [33] |

### [31] SocRipple (Jaspal 2025)
- Link: https://arxiv.org/abs/2508.07241
- Opened: 2026-10-24, abstract only [arXiv abstract page 2508.07241; this is a preprint]
- Says: Amit Jaspal, Kapil Dalwani and Ajantha Ramineni (arXiv preprint, 2025) propose a two-stage retrieval framework for cold-start items on platforms with a social graph. Stage 1 shows a new item to the creator's social connections. Stage 2 uses early engagement and learned user embeddings to spread the item with nearest-neighbour search. On a large video platform it raised cold-start item distribution by 36% while keeping the engagement rate on those items (abstract).
- For us: Group 2 (social cold start). It uses a signal from the social graph and early engagement, in two retrieval stages. It has no community signal and no single combined score.
- Cited in: not cited

### [32] Community by Design (Weyl 2025)
- Link: https://arxiv.org/abs/2502.10834
- Opened: 2026-10-24, abstract only [arXiv abstract page 2502.10834; this is a preprint]
- Says: E. Glen Weyl and five co-authors (arXiv preprint, 2025) argue that platforms use the social fabric as an input and may erode it by maximizing engagement. They propose a platform model in which the social fabric, with communities defined by affiliation or by shared attitudes, is also an explicit output, to support social cohesion (abstract).
- For us: Group 3 (follow-graph feed ranking). A design proposal with a community signal. It has no follow-based trust and no engagement score in one ranking.
- Cited in: not cited

### [33] Interaction strength (Zhou 2024)
- Link: https://doi.org/10.19734/j.issn.1001-3695.2023.05.0280
- Opened: 2026-10-24, abstract only [the journal page of Application Research of Computers, in Chinese; the DOI is not in Crossref and resolves through chndoi.org; no full text was read]
- Says: Luxin Zhou, Man Li, Mingyang Jiang and Lei Zhang (Chongqing Jiaotong University), Application Research of Computers 41(1), pp. 65-71, 2024. The page gives the English title "Improving social recommendation algorithm via incorporating interaction strength". The Chinese abstract describes a matrix factorization model for rating prediction. It enriches the social matrix with two similarities, defines an interaction strength between users, and links it to the social relations and to the users' group-participation features. On three real data sets it improves the accuracy of rating prediction (abstract).
- For us: Group 1 (social recommendation). It is the closest idea to C2 that the search found (interaction strength plus group participation). It predicts ratings with a learned model. It does not rank posts and has no engagement score.
- Cited in: not cited


## 8. Older neighbours and other added references

### [30] X For You algorithm (xai-org 2026)
- Opened: 2026-10-24, full text (§Overview, §Scoring and Ranking) [github.com/xai-org/x-algorithm, commit 6258a1549ef808be88fba83d3b2d58364b587ee0 (HEAD); the repository was created on 2026-01-19; the README sections named were read; the tree of 2886 paths has no path with real_graph or interaction_graph]
- Says: the README says that the For You feed joins in-network posts (from followed accounts) with out-of-network posts (retrieval models and a popular-posts list), and that both are ranked together by the same transformer model (Phoenix). Phoenix reads the viewer's recent engagement history and predicts the chance of each action on each post. The predictions are combined into one score with weights held in the code.
- For us: claim 3 and D5 (Against): the open-source ranking of 2023 [6] may no longer be the production ranking. This is code with no DOI, so it is not a recent reference of §7.
- Cited in: not cited
- Anchor: `README.md`, Overview, the paragraph after the two lists: "Both are ranked together by the same model."

### [28] m-estimate (Cestnik 1990)
- Opened: 2026-10-24, index record [OpenAlex record W203696055; closed access, no full text found]
- Says: Bojan Cestnik, "Estimating probabilities: a crucial task in machine learning", ECAI 1990, pp. 147-149 (the record matches the lead from the super-plan work). The paper was not read. [29] says it introduced the estimate (count + m × prior) / (total + m) for a conditional probability (§2.4), and that the name "m-estimate" came later, from Cestnik and Bratko (1991, LNCS 482, pp. 138-150).
- For us: D2, the source of the form of the smoothing, through [29] only. The paper supports the name only, no detail.
- Cited in: Ch3 (name only)

### [29] m-estimate in naive Bayes (Castellano 2020)
- Opened: 2026-10-24, full text [digibug.ugr.es PDF, University of Granada repository, open copy of DOI 10.1142/S0218488520500282 (manuscript or published version not stated), sha256 f9af44ebb514]
- Says: Javier G. Castellano, Serafín Moral-García, Carlos J. Mantas and Joaquín Abellán (International Journal of Uncertainty, Fuzziness and Knowledge-Based Systems 28(4), pp. 661-682, 2020; Crossref matches) study the m-estimate and imprecise probabilities in the naive Bayes classifier. §2.4 gives the m-estimate of a conditional probability as the count of the class value with the attribute value plus m times the class prior, over the count of the attribute value plus m (eq. 19). The prior is estimated with Laplace's law of succession (p.7), and a higher level of noise needs a higher m (p.7). The authors say the original experiments were very small (p.2) and that Cestnik gave no recommended value of m (p.9).
- For us: D2 and claim 4, the source for the form of our smoothing, and a secondary source for [28]. It is about classification, not about ranking posts.
- Cited in: Ch3
- Anchor: §2.4, eq. 19 (p.6): (N_ti,cj + m · P(C = cj)) / (N_ti + m).

## 9. Proposed changes

| ID | Change | Where | Evidence | Goes to |
|---|---|---|---|---|
| PC1 | Say that the form of the smoothing is the m-estimate, not "my own suggestion, not a cited method". Using it for trust, and the value of `m`, stay our own. Add [28] and [29] to §10 with their marks. | super-plan §6 line 293, §10 | D2; [29] §2.4 eq. 19 | the author (super-plan edit) |
| PC2 | Decide whether trust fades with time: none, a half-life or a window. [5] decays old interactions and drops old edges; the §6 formula has none. A fade adds a parameter to super-plan §7 and a cell to E4. | super-plan §6, §7 | D1; [5] §2.1 and §2.1.1 | the author (decides; /freeze for a new value) |
| PC3 | Add a baseline BL6: the number of followees who engaged, with no trust weights. It shows what the trust weights add over a plain count, and [25] argues for strong simple baselines. | super-plan §5 (methods) | D5; [25] §1 and §2.2 | the author (P5 task) |
| PC4 | Give BL2, BL4 and BL5 a small validation grid for their time or age parameters, as H is tuned in E4. The grid sizes would be frozen values. | super-plan §5, §7 | D5; [25] §2.2 | the author (/freeze for new values) |
| PC5 | Close the tuning gap of the leakage table: tune `m`, α and β only on validation items that are all earlier than the test items of the users in the test split (one global cut time), as in the global temporal split of [13] and the timeline scheme of [14]. | super-plan §5 (split) | D6; [13] §5; [14] §3.2 and §5 | the author (the protocol is frozen; /freeze) |
| PC6 | Run the main comparison also with a larger pool (a second window W or N_max), to show that the pool does not act like a small sample. | super-plan §5 (pool), §7 | D6; [16] abstract only; [15] §4.2 | the author (P5 task; /freeze for new values) |
| PC7 | Report the number of left-out users per history bucket, not only in total. | super-plan §5 (pool) | D6; super-plan §1 (H1 is about users with 0 to 4 earlier interactions) | the author (P5 task) |
| PC8 | Say that [14] shows the harm of training on future interactions, and that the as-of rule for features is our own design. Super-plan §5 now cites [14] for the as-of features. | super-plan §5 (as-of features) | D6; [14], the whole text has no feature case | the author |
