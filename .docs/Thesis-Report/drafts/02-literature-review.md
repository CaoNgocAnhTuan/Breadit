# Chapter 2. Literature Review

> **Draft, 2026-11-22.** Budget: about 10 pages. This chapter has no result numbers of this thesis. The numbers it gives (sizes of data sets, percentages, counts) are facts of the cited papers, with the paper named. References in square brackets use the numbers of the super-plan §10 for now. Remove this box and the notes at the end before the final version.

This chapter reviews the work that the thesis builds on. The thesis ranks the posts of a social feed with signals from the social graph, and it tests the ranking offline. So the review has three main parts: social recommendation (Section 2.2), feed ranking in practice (Section 2.3) and offline evaluation of recommenders (Section 2.4). Section 2.5 is a short part on the architecture of real-time social platforms. Section 2.6 shows what the literature decided in the design of the thesis. Section 2.7 says what is missing in this work and what the thesis adds. Chapter 3 then defines the method.

Most sources were read in the part that matters. A few were read only as an abstract or as a catalogue record. For those, the text says "the abstract says" or gives the name and the topic of the work, and it takes no result from them.

## 2.1 What the review looks for

Three questions guide the review. First, how do recommenders use the social network of their users, and what do they do for a user with no history? Second, how do real platforms rank a feed, and do they use follows and communities? Third, how should such a ranking be tested offline, without real users, so that the result can be trusted?

## 2.2 Social recommendation

**What it is.** In social recommendation, the recommender uses the social network of its users next to their ratings or actions. The review of Tang, Hu and Liu (2013) gives formal definitions and sorts social recommender systems into memory-based and model-based ones [1]. Its abstract adds that it reports findings from positive and negative experiences and gives research directions [1]. We use it as a map of the field.

**Trust and matrix factorization.** Many social recommenders are built on matrix factorization. It learns a short vector of hidden factors for each user and each item from the ratings. SoRec (Ma, Yang, Lyu and King, CIKM 2008) is an early example. By its abstract, it is a factor analysis approach based on probabilistic matrix factorization that uses the social network of the users together with their rating records [2]. SocialMF (Jamali and Ester, RecSys 2010) is another; its title names trust propagation inside a matrix factorization [8]. Newer work keeps this line. Zhou, Li, Jiang and Zhang (2024) describe a matrix factorization model for rating prediction that defines an interaction strength between users and links it to social relations and to group-participation features [33]. Dadgar and Hamzeh (2022) study how social trust can help recommenders, and propose a similarity measure for social trust [35]. Stefanopoulos, Chatterjee and Zehmakan (2025) study recommenders that use item ratings, item similarity and a trust graph [37].

**Graph neural models, and the number of hops.** A newer line replaces the factor model with graph neural networks. DiffNet (Wu et al., SIGIR 2019), in the paper "A Neural Influence Diffusion Model for Social Recommendation", mixes the embedding of each user with the average embedding of the users it trusts, and repeats this for K steps [3]. K = 2 gives the best result, and K = 3 drops again [3]. On Yelp and Flickr, K = 1 is 2.50% and 2.96% below K = 2 on HR@10 [3]. The survey of Sharma et al. (ACM Computing Surveys, 2024) annotates 2,151 papers and finds 84 on social recommenders based on graph neural networks [4]. It lists oversmoothing as a known issue of the encoders based on graph convolution and graph attention [4].

The thesis uses 1 hop. In the follow graph, a hop is one edge. So only the accounts that the user follows count, and the accounts that those accounts follow do not. The trust is a plain count of earlier engagement, not an embedding. In DiffNet, 2 layers beat 1 by the margins above [3], so 1 hop may leave a gain unused in that setting. But DiffNet learns embeddings and our trust is a heuristic count, so the comparison holds by analogy only. Oversmoothing is a further reason for care with deep diffusion [4]. A learned diffusion is out of scope for this thesis, so 2 hops and learned diffusion are a limit of the study and future work.

**Users with no history.** A new user has no history, and this is the cold-start problem. Sedhain, Sanner, Braziunas, Xie and Christensen (RecSys 2014) study recommendation for users who have bought nothing yet but share side information, such as Facebook friends and page likes [9]. By the abstract, they write neighbourhood-based methods in a matrix algebra framework that needs no purchase data for the target user [9]. Lee, Zhou, Yang, Du and Pan (2022, arXiv preprint) assume that social relations and past behaviour relate to the same factors. Their algorithm uses both with mutual constraints, and they test it on all users, active users, inactive users and cold-start users as separate groups [38]. Jaspal, Dalwani and Ramineni (2025, arXiv preprint) describe a two-stage framework for cold-start items on platforms with a social graph. The first stage shows a new item to the connections of its creator, and the second uses early engagement and learned user embeddings [31]. The thesis follows [38] in one point: it reports results for groups of users by the length of their history.

A count that rests on few events is unreliable. The m-estimate mixes the count with a prior, so that few events give a value close to the prior [28][29]. It is a method of classification, not of ranking. Chapter 3 uses its form for trust and for community affinity, and this use is our own design.

## 2.3 Feed ranking in practice

**Formulas with time.** Some platforms rank with a fixed formula that combines votes with age. The "hot" sort of Reddit, in its archived code, scores a post from its net votes s, the up votes minus the down votes, and adds a term for the time of the post [11]:

hot = sign(s) · log10 max(|s|, 1) + (t_post − 1134028003) / 45000,

where t_post is the time of the post in seconds. The vote part grows with the logarithm of the size of the net votes, so the hundredth vote counts less than the tenth. The Hacker News score divides the votes of a story, raised to a power below 1, by a power of the age of the story plus a constant [12]:

score = (votes − 1)^0.8 / (age in hours + 2)^1.8 × penalty factors.

The author of the blog post that describes it writes that the real penalty system is more complex than the published code [12]. These formulas are cheap, easy to read and the same for every reader. The Explore score of Breadit is of this kind: it adds engagement counts and subtracts a term for age. The thesis uses the two formulas above as baselines (Chapter 3).

**Twitter and X.** In 2023, Twitter published an account of its For You timeline [7]. The post says that candidates come from the people the user follows (in-network) and from other accounts (out-of-network), about half and half on average [7]. The in-network source ranks the tweets of followed users with a logistic regression model. The post says that the most important component in this ranking is Real Graph, a model that predicts the likelihood of engagement between two users [7]. It gives no formula. The final ranking of all candidates uses a neural network of about 48 million parameters that predicts the probability of ten engagement labels [7].

RealGraph was described by Kamath, Sharma, Wang and Yin at the UEO '14 workshop [5]. It gives each one-way tie between two users a weight. The weight is defined as the probability of an interaction from the source user to the destination user in the future [5]. It is learned with a logistic regression on features of the edge and of both users, with a binary label from past interaction data [5]. The authors check the weights with AUC per feature group and with a small survey of the top 20 followings, which they call a preliminary result [5]. Twitter uses the weights for user recommendation and for a "Circle of Trust" [5].

The source code released in 2023 shows the idea in use [6]. In the home-mixer, one component reads the RealGraph scores of the accounts that a viewer follows and keeps the top 1000 by score. Another attaches the RealGraph features of the pair (viewer, author) to each tweet candidate [6]. The files show these scores as inputs; they do not show how a ranker weights them [6]. A newer release of 2026 has no RealGraph file in its tree. By its README, it ranks in-network and out-of-network posts together with one transformer model [30]. So we cannot say that production still uses RealGraph as in 2023.

The trust term of this thesis is in the spirit of RealGraph: it weights a followed account by the past engagement of the user with that account. The two are very different. RealGraph is learned, predicts a future interaction and decays old interactions [5]. Our trust is a smoothed count of earlier positives. It has no learned model and no fade over time. We do not test whether a fade would help, and this is a limit.

**Communities as a signal.** Community membership is the second social signal of the thesis. These works use communities. Chen, Chu, Luan, Bai, Wang and Chang (WWW 2009) compare association rule mining (ARM) and latent Dirichlet allocation (LDA) for recommending Orkut communities to a user from the communities that the user joined [10]. Their data has 492,104 users and 118,002 communities [10]. For each user, the test set is one withheld community plus 1000 random communities that the user has not joined [10]. By the abstract, LDA is better for lists of 4 or more communities, and ARM is a bit better for lists of up to 3 [10]. Membership is the only input, as 1 or 0, and the paper uses no friend data and no posts [10]. It leaves counts of other activity to future work [10]. Jiang, Yang and Lin (CIKM 2025) also recommend communities and not posts, with a model named CASO [34].

Twitter uses communities too. Its post says that SimClusters, a source of out-of-network candidates, discovers communities [7]. The abstract of SimClusters (Satuluri et al., KDD 2020) says that it is a representation layer based on overlapping communities, where users and content become sparse vectors for many recommendation tasks at Twitter [43]. The abstract of TwHIN (El-Kishky et al., KDD 2022) says that it treats Twitter as a heterogeneous information network and learns knowledge-graph embeddings of its users and content [44]. Weyl et al. (2025, arXiv preprint) argue that platforms use the social fabric as an input and may erode it, and they propose a platform model in which the social fabric is also an explicit output [32].

**Other recent work on feeds.** Cinus, Gionis and Bonchi (CIKM 2023) propose to nudge social feeds to balance relevance and diversity and so reduce polarization. Their approach re-weights the importance of the accounts that a user follows [39]. Chen et al. (2026, arXiv preprint) describe an Instagram feed ranker that scores candidates with a value model, a weighted sum of engagement predictions. They add debiasing terms for the viewer, the item and the request [40]. Other studies look at what feed algorithms do, not at how to build them. Milli et al. (PNAS Nexus, 2025) audit the engagement-based ranking of Twitter [41]. Gauthier, Hodler, Widmer and Zhuravskaya (Nature, 2026) report a field experiment on the feed of X [42]. Akpinar and Fazelpour (Synthese, 2025) use a simulation to study visibility under a recommendation algorithm [36]. An offline test like ours cannot show effects of this kind, and the thesis claims none.

## 2.4 Offline evaluation of recommenders

An online experiment measures what a feed does to real users. The field experiment on the feed of X is an example [42]. It needs many real users, and Breadit has none. So the thesis tests offline. An offline test replays the past. The ranker orders the posts that existed at a past time, and the test checks whether the next real action of the user ranks high. This is cheap and can be repeated, but it has known traps. This section reviews what the literature says about them. Chapter 3 gives the rules that the thesis chose.

**Splits and leakage.** The way the data is split changes the result. Meng, McCreadie, Macdonald and Ounis (RecSys 2020) compare split strategies on two grocery data sets with seven recommenders. The ranking of the models changes with the split, and Kendall's tau between pairs of strategies is only moderate, from 0.5284 to 0.7630 [13]. They advise the global temporal split as the default, and they note that leaving out each user's last item can leak future evidence into training [13]. Ji, Sun, Zhang and Li (ACM TOIS, 2023) show the danger with a number. By their preprint, training on data from the future changes the reported accuracy by as much as 89.5%, with no particular pattern, and it changes the order of the models [14]. The thesis uses one global cut time and builds every feature as of the test time of the user. The as-of rule for features is our own design, because [14] has no case about features built from future data.

**Sampled metrics.** Krichene and Rendle (KDD 2020) show that metrics computed on a small random sample of items can disagree with the exact metrics, even on average, and that only AUC stays consistent [15]. They advise to avoid sampling as much as possible [15]. Cañamares and Castells (RecSys 2020) study how the choice of target set changes the comparison of recommenders. Their abstract says that reduced target sets often contradict the result with large target sets [16]. The Orkut study above ranks the withheld community among 1000 sampled ones [10], the kind of test that Krichene and Rendle warn about. So the thesis ranks the whole pool of each user and uses no sampled negatives.

**Other measures, and ties.** Accuracy is not the only measure. Ge, Delgado-Battenfeld and Jannach (RecSys 2010) argue that recommenders should not be judged on accuracy alone, and they define catalogue coverage as the share of available items that the system ever recommends [17]. When scores are tied, the order of the tied results can change the value of a ranking measure. McSherry and Najork (ECIR 2008) show this and give tie-aware versions of six measures [18]. The thesis uses a fixed tie rule and repeats the test with the reverse rule.

**Baselines.** A new method means little if its baselines are weak. Ferrari Dacrema, Cremonesi and Jannach (RecSys 2019) tried to reproduce 18 recent neural methods for top-n recommendation and could do so for 7. In 6 of the 7, the neural method did not consistently beat simple baselines that were well tuned [25]. So the thesis adds simple baselines and tunes them like the hybrid. It uses no learned baseline, and this is a limit.

**Statistical tests.** Results per user need a significance test. Smucker, Allan and Carterette (CIKM 2007) compare statistical significance tests for information retrieval evaluation [21]. When many comparisons are made, the chance of a false positive grows, and the procedure of Holm (1979) controls it [22]. The thesis uses paired tests and the Holm correction.

**Synthetic data, and influence against correlation.** A simulation shows what can happen under stated assumptions. Chaney, Stewart and Engelhardt (RecSys 2018) simulate 100 users over 1,000 time intervals with six recommendation methods. They show that repeated training on data that a recommender helped create makes users more alike, without a gain in utility [24]. Our synthetic worlds model no feedback loop between a recommender and its data. A second problem belongs to social signals. A user may act like their friends because friends influence each other, or because friends are alike. Anagnostopoulos, Kumar and Mahdian (KDD 2008) study the question of influence and correlation in social networks [23]. A fair test therefore needs worlds where the data holds no influence, and Chapter 3 builds them.

**Reproducibility.** Sandve et al. give ten simple rules for reproducible computational research [27]. In the same spirit, every result of this thesis can be rebuilt from the raw data with one command (Chapters 3 and 5).

## 2.5 Real-time social platform architecture

A social platform must tell users about new events, such as a like, a reply or a message, soon after they happen. There are three common ways. With polling, the client asks the server again and again at fixed intervals, and each ask costs a request, even when nothing is new. With server-sent events, the server keeps one HTTP connection open and pushes updates in one direction. A WebSocket is a two-way connection that stays open, so the server can push events and the client can send events on the same channel. Direct messages and typing signals need this second direction. Breadit uses Socket.IO, a library for event messaging over WebSocket. When the backend runs as more than one process, an event for a user must reach the process that holds the connection of that user. Breadit uses a Redis adapter for this (Chapter 5).

Real-time delivery and feed ranking are separate parts. Delivery is driven by events, and ranking runs when the user opens or reloads the feed. The Twitter post describes two steps: sources of candidate posts, then a ranking model [7]. Breadit does the same in a small form. It builds a pool of candidate posts and ranks the pool with one scoring function (Chapter 4). This thesis does not measure the delivery time of events.

## 2.6 What the literature means for the design

The thesis made its main design choices from the work above. Table 2.1 lists each design question, the sources that bear on it and what the thesis took. Chapter 3 gives the details. Three of the answers are limits: the thesis has no fade of trust over time, it uses only 1 hop, and it has no learned baseline.

| Design question | Sources | What the thesis took |
|---|---|---|
| How much should a follow count, and should it fade? | RealGraph [5], Twitter code and blog [6][7], SoRec [2] | Weigh a followed account by the past engagement of the user with it, as RealGraph weighs a pair of users. No fade over time. |
| How do we help users with no history? | Sedhain et al. [9], Lee et al. [38], the m-estimate [28][29] | Mix the counts of the user with a prior, so that a user with no history still gets a score. |
| Is community membership a useful signal, and in what form? | Orkut communities [10] | A community term from the user's earlier positives in the post's community, with a membership prior. The support is weak: [10] recommends communities, not posts. |
| Should influence reach friends of friends? | DiffNet [3], the survey [4] | 1 hop. Two hops and learned diffusion are out of scope. |
| Are the baselines strong enough? | Ferrari Dacrema et al. [25], Reddit [11], Hacker News [12] | The two time-decay formulas and a count baseline, all tuned like the hybrid. No learned baseline. |
| How do we split and measure without bias? | [13][14][15][16][17][18] | One global cut time; features as of the test time; the full pool ranked; coverage as an extra measure; a fixed tie rule, tested with its reverse. |
| How do we test a difference? | [21][22] | Paired tests per user, with the Holm correction. |
| How do we show that the result is not built into the data? | [24][23] | A null world and a world with homophily only, next to three worlds with influence, and a test that shuffles the times of engagements. |
| How do we make the numbers repeatable? | [27] | One seed, no wall clock, a recorded hash for each result file, and one command that rebuilds them. |

## 2.7 The gap, and what the thesis adds

The review shows four things.
- Social recommenders from research mostly learn their parameters from past ratings or actions [2][3][33][37]. They need training data, and a new user has none.
- Production systems weight the tie between two users (RealGraph [5][7]). The weights are learned [5], and the released files do not show how a ranker uses them [6].
- Work on communities mostly recommends communities, not posts [10][34].
- The traps of offline tests are well known [13]–[18][25], but they must be answered one by one in each study.

Table 2.2 sets the closest works against the thesis. It names one difference for each.

| Work | What it does (by its paper or abstract) | The difference in this thesis |
|---|---|---|
| RealGraph, Twitter code and blog [5][6][7] | a learned weight for a pair of users, used as input of a ranker that the released files do not show | a fixed, explicit score; trust is a smoothed count of past engagement; a community term; tested offline |
| Orkut communities [10] | membership as 1 or 0, to recommend communities | membership and the user's earlier positives in a community, to rank posts |
| Interaction strength [33] | rating prediction by matrix factorization with an interaction strength and group participation | a fixed score for ranking posts, tested with a ranking protocol |
| SocRipple [31] | two stages for cold-start items: the connections of the creator, then early engagement and learned embeddings | follow and community signals in one score |
| Rebalancing the feed [39] | re-weights the followed accounts to reduce polarization | weights from the past engagement of the user, to rank more relevant posts |
| Instagram debiasing [40] | debiasing terms added to a learned value model of engagement predictions | terms for follow trust and for community added to an engagement score |
| Community by design [32] | a platform model where the social fabric is an output; no ranking rule and no test in the abstract | a concrete scoring rule, tested offline |

To look for recent work, we ran a search on 2026-10-24: six fixed queries on WebSearch and OpenAlex, four searches by topic, and the lists of papers that cite [2], [5] and [9]. The abstracts of the papers found were read; twelve papers from 2022 or later were kept ([31] to [42]), and this chapter cites all of them. The abstracts of the papers found do not say that any of them adds follow trust and community affinity to engagement in one feed ranking. This is not a proof. Every entry rests on an abstract, and four papers were dropped because no abstract or page could be opened. So the search can miss papers.

The thesis fills this gap in four ways.
1. **One explicit score.** The hybrid score adds follow trust and community affinity to the engagement score of Explore. Its parts can be read and checked. A prior gives users with no history a score.
2. **A careful offline test.** It has an as-of rule, one global cut time, full ranking, baselines that are tuned like the hybrid, paired statistics with Holm correction, a null world, and real data from Digg 2009.
3. **One code for live and offline.** The ranking package is used by the live feed and by the evaluation, so the offline numbers describe the feed of the app.
4. **A rebuild by one command.** Every result can be rebuilt and compared with a recorded hash.

The thesis does not use learned social models, 2 hops, a fade of trust over time or online experiments. These are limits of the study, and they are future work (Chapter 9). Chapter 3 now defines the method.

---

## Notes for the author (remove before the final version)

1. **Reading depth.** [1], [2], [9] and [16] were read as abstracts, and [3], [4], [5], [6], [7], [10], [11], [12], [13], [14], [15], [17], [18], [24], [25], [29] and [30] as full text or in the parts named in the literature notes (§1). [31] to [44] are abstracts, and this chapter takes no result from them (super-plan §10). [8], [21], [22], [23], [27] and [28] are named for their topic only, as the super-plan §4 says for [21] and [23].
2. **Section 2.5 has no citations.** No source of the verified list covers polling, server-sent events or WebSocket. The pre-thesis cites Kwak, Pimentel and RFC 6455 for this; they are not in the super-plan §10, so they are not used. The section states common practice and the design of Breadit only. Add a verified source if you want one.
3. **Limits that Chapter 7 does not list.** Sections 2.2, 2.3 and 2.4 name three limits: 1 hop (no learned diffusion), no fade of trust over time, and no learned baseline. Chapter 3 and Chapter 7 do not name them yet, but the literature notes (D1, D4, D5) say they should be named. Chapter 7, Section "Limits of the study", is the place.
4. **Chapter 7 and BL4.** Chapter 7 says that BL4 and BL5 "divide the score by a power of the post's age". This is true for BL5. The Reddit "hot" function adds a time term (the post time divided by 45,000 seconds) to a logarithm of the votes [11], so it does not divide by a power of the age. Check that sentence.
5. **Overlap with Chapter 3.** This chapter gives the sources and the ideas. It does not give the hybrid score, the protocol, the tuning values or the statistics. Section 2.3 gives the published formulas of Reddit "hot" and Hacker News, because Chapter 3 does not give the Reddit one; the Hacker News formula also appears in the table of Chapter 3, with the gravity as a parameter.
6. **Search of 2026-10-24.** Section 2.7 states it as in `.docs/related-work.md` §3: by the abstracts, no paper found adds follow trust and community affinity to engagement, and this is not a proof.
7. **Page check.** About 9 pages once typeset, with two tables.
