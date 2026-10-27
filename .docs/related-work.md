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

## 4. Offline evaluation of recommenders

## Citation table

## References
