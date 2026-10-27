# Related work

Draft survey for Chapter 2 of the thesis. Date: 2026-10-27. Status: draft. It rests on `.docs/literature.md` and on the references of super-plan section 10, numbered as there. A paper that was read at abstract level only is described by its aim and method, with no result. C2 is a hybrid ranking score: engagement, plus follow trust, plus community affinity, tested offline.

## 1. Social recommendation

For C2, social recommendation means that a recommender uses the social network of its users next to their ratings or actions. The abstract of the review by Tang, Hu and Liu (2013) says that it gives formal definitions and sorts social recommender systems into memory-based and model-based ones [1]. The abstract adds that the review reports findings from positive and negative experiences and gives research directions [1]. The abstract names no trust formula, no hop count and no cold-start result, so [1] is background for C2 and nothing more.

The abstract of SoRec (Ma, Yang, Lyu and King, CIKM 2008) says that it is a factor analysis approach based on probabilistic matrix factorization [2]. The abstract adds that the method uses the social network of the users together with their rating records [2]. The abstract gives no formula for the strength of a social link [2]. SocialMF [8] is listed here by name only.

The abstract of Sedhain and co-authors (RecSys 2014) says that the paper studies recommendation for users who have bought nothing yet but share side information, such as Facebook friends and page likes [9]. The abstract adds that the neighbourhood-based methods are written in a matrix algebra framework that needs no purchase data for the target user [9]. C2 cites this paper for the no-history case, and the abstract gives no weighting or smoothing formula [9].

Graph models, as in [3] and [4], learn the social effect with embeddings. Wu and co-authors (SIGIR 2019) present the model DiffNet in the paper "A Neural Influence Diffusion Model for Social Recommendation" [3]. In DiffNet, the embedding of each user is mixed with the average embedding of the users it trusts, and this is repeated for K steps [3]. K = 2 gives the best result, and K = 3 drops again [3]. On Yelp and Flickr, K = 1 is 2.50% and 2.96% below K = 2 on HR@10 [3]. The survey of Sharma and co-authors (2024) annotates 2,151 papers and finds 84 on social recommenders based on graph neural networks [4]. Its table lists oversmoothing as a known issue of GCN and graph attention encoders [4].

C2 uses 1 hop. In our design, a hop is one edge of the follow graph, so only the accounts that a user follows count, and the trust is a plain count with no embeddings. In DiffNet, 2 layers beat 1 by the margins above [3], so 1 hop may leave a gain unused in that setting. But DiffNet [3] learns embeddings and our trust is a heuristic count, so the comparison is by analogy only. Oversmoothing is a further reason for caution with deep diffusion [4]. A learned diffusion is out of scope in our design, so C2 names 2 hops and learned diffusion as a limitation and as future work.

## 2. Feed ranking and communities in industry

RealGraph is a framework at Twitter that gives each one-way tie between two users a weight [5]. Kamath and co-authors (2014) define the weight as the probability of an interaction from the source user to the destination user in the future [5]. The weight is learned with a logistic regression on edge features and on the features of both users, with a binary label from past interaction data [5]. The authors check the weights with AUC per feature group and with a small survey of top-20 followings, which they call a preliminary result [5]. Twitter uses the weights for user recommendation and for a Circle of Trust [5].

In the Twitter release of 2023, home-mixer reads the RealGraph scores of the accounts that a viewer follows, keeps the top 1000 by score [6]. It also attaches the RealGraph edge features of the pair (viewer, author) to each tweet candidate [6]. The files show these scores as inputs and do not show how a ranker weights them [6]. The Twitter blog says that the most important component in ranking In-Network tweets is Real Graph, a model that predicts the likelihood of engagement between two users [7]. The blog gives no formula, while C2 is an explicit score with a community term and is tested offline [7]. The newer release of 2026 has no RealGraph file in its tree and ranks all posts with a transformer model [30].

Two hand-made scores are baselines of C2 in our design. The hot sort of Reddit combines the net votes of a post with its time [11]. The Hacker News score divides votes by a power of the age of a post [12]. Our design leaves the detail to the platform chapter of the thesis.

Chen and co-authors (WWW 2009) compare association rule mining and latent Dirichlet allocation for recommending Orkut communities to a user from the communities that the user has joined [10]. Their data has 492,104 users and 118,002 communities [10]. For each user, the test set is one withheld community plus 1000 random communities that the user has not joined [10]. The abstract says that LDA is better for lists of 4 or more communities, and ARM is a bit better for lists of up to 3 [10]. Membership is the only input, as 1 or 0, and the paper uses no friend data and no posts [10]. The abstract of SimClusters (Satuluri and co-authors, KDD 2020) says that it is a representation layer based on overlapping communities, where users and content become sparse vectors for many recommendation tasks at Twitter [43]. The abstract of TwHIN (El-Kishky and co-authors, KDD 2022) says that it treats Twitter as a heterogeneous information network and learns knowledge-graph embeddings of its users and content [44].

C2 is in the spirit of RealGraph [5]. C2 weights a followed account by a simple smoothed count of the past engagement of the user with that account, and it has no learned model. RealGraph decays old interactions [5], and our design keeps no fade. C2 adds a community term, as the Orkut work [10] uses joined communities, but C2 uses it to rank posts and not to recommend communities. This is our design.

## 3. Recent work and what C2 adds

For C2, the search ran on 2026-10-24 with six fixed queries on WebSearch and OpenAlex and with four group searches. It also used the lists of papers that cite [2], [5] and [9], and the abstracts of the papers found were read. The search found twelve recent papers from 2022 or later, and our design is to state only what each abstract says.

The abstract of Zhou, Li, Jiang and Zhang (2024) describes a matrix factorization model for rating prediction, which defines an interaction strength between users and links it to social relations and to group-participation features [33]. By its abstract, [33] learns latent features to predict ratings, while C2 ranks posts with a fixed score that adds follow trust and community affinity to engagement.

The abstract of Jaspal, Dalwani and Ramineni (arXiv preprint, 2025) describes a two-stage retrieval framework for cold-start items on platforms with a social graph [31]. According to the abstract, stage one shows a new item to the connections of its creator, and stage two uses early engagement and learned user embeddings [31]. By the abstract, [31] works on new items in two retrieval stages, while C2 puts follow and community signals into one score.

The abstract of Weyl and co-authors (arXiv preprint, 2025) says that platforms use the social fabric as an input and may erode it [32]. The abstract adds that the authors propose a platform model where the social fabric is also an explicit output [32]. C2 is a concrete scoring rule that is tested offline, while the abstract of [32] names a platform model, no ranking rule and no test.

The abstract of Cinus, Gionis and Bonchi (CIKM 2023) says that the approach re-weights the importance of the accounts that a user follows, to balance relevance and diversity and so reduce polarization [39]. C2 also weights followed accounts, but by the past engagement of the user, and the abstract of [39] does not say that its weights use past engagement.

The abstract of Chen and co-authors (arXiv preprint, 2026) describes a feed ranker that scores candidates with a value model, a weighted sum of engagement predictions [40]. The abstract adds debiasing terms for the viewer, the item and the request [40]. By the abstract, [40] adds debiasing terms to a value model of engagement predictions, while C2 adds terms for follow trust and community to engagement.

In our design, other recent papers are named here only by what their abstracts say they study. The abstract of [34] is about recommending communities and not posts [34]. The abstracts of [35] and [37] study trust in recommendation, with a similarity measure for social trust in [35] and a trust graph next to item ratings in [37]. The abstract of [38] tests an algorithm on cold-start users as a separate group [38]. The abstracts of [36], [41] and [42] study effects of ranking algorithms. The abstracts name a simulation of visibility in [36], an audit of the engagement-based ranking of Twitter in [41], and a field experiment on the feed of X in [42].

For C2, the search of 2026-10-24 found, by the abstracts, no paper from 2022 or later that adds follow trust and community affinity to engagement in one feed ranking, but this is not proof. C2 therefore claims no more than this: the search can miss papers, because every entry rests on an abstract and four pages did not open.

## 4. Offline evaluation of recommenders

Meng and co-authors (RecSys 2020) compare split strategies on two grocery data sets with seven recommenders [13]. The ranking of the models changes with the split, and Kendall's tau between pairs of strategies is only moderate, 0.5284 to 0.7630 [13]. They advise the global temporal split as the default [13]. According to the preprint of Ji and co-authors (2023), training on data from the future changes the reported accuracy by as much as 89.5% [14]. There is no particular pattern, and the order of the models changes [14].

Krichene and Rendle (KDD 2020) show that metrics computed on a small random sample of items can disagree with the exact metrics, even on average [15]. Only AUC stays consistent [15]. So C2 ranks the full pool of each user and reports no sampled metric, which is our design.

Ferrari Dacrema, Cremonesi and Jannach (RecSys 2019) tried to reproduce 18 recent neural methods and could do so for 7 [25]. In 6 of the 7, the neural method did not consistently beat simple baselines that were well tuned [25]. This is a warning for C2, because BL0 to BL5 are not tuned and not personalised. Our design tunes BL2, BL4 and BL5 on a small validation grid and adds BL6, a count baseline with every trust weight set to 1. There is no learned baseline in our design, and this is a named limitation.

Chaney, Stewart and Engelhardt (RecSys 2018) simulate 100 users over 1,000 time intervals with six recommendation methods [24]. They show that repeated training on data that a recommender helped create makes users more alike, without a gain in utility [24]. A simulation shows what can happen under stated assumptions, and our design reads a synthetic win in that way. Our design makes worlds from interests, follows and memberships, and it has no feedback loop.

Our design follows these papers on one point: for each user, nothing after the test time is used. In our design, the test item is the last positive of the user, with one global cut time T for all users. Features are taken as of the test time, which is our own rule, and [14] has no case about features built from future data.

## Citation table

## References
