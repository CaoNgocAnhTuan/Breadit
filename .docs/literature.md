# Literature notes (P1) · updated 2026-10-24 · task 2026-10-23-p1-literature

Working notes for P1. Not thesis text.

## 1. Status table

| Ref | Short name | Type | Verified | Read | Opened | Cited in |
|---|---|---|---|---|---|---|
| [1] | Social recommendation review (Tang 2013) | survey | verified | abstract only | 2026-10-24 | not cited |
| [2] | SoRec (Ma 2008) | paper | verified | abstract only | 2026-10-24 | not cited |
| [5] | RealGraph (Kamath 2014) | paper | verified | full text | 2026-10-24 | Ch2, Ch3 |
| [7] | Twitter blog (2023) | blog | do not cite, use [6] | index record | 2026-10-24 | not cited |
| [9] | Social CF for cold start (Sedhain 2014) | paper | verified | abstract only | 2026-10-24 | not cited |
| [15] | Sampled metrics (Krichene 2020) | paper | verified | full text | 2026-10-24 | Ch2, Ch3 |
| [16] | Target item sampling (Cañamares 2020) | paper | verified | abstract only | 2026-10-24 | not cited |
| [23] | Influence and correlation (Anagnostopoulos 2008) | paper | verified | index record | 2026-10-24 | not cited |
| [28] | m-estimate (Cestnik 1990) | paper | verified | index record | 2026-10-24 | Ch3 (name only) |
| [29] | m-estimate in naive Bayes (Castellano 2020) | paper | verified | full text | 2026-10-24 | Ch3 |

## 2. Claims

| # | Claim | Status | Evidence |
|---|---|---|---|
| 2 | RealGraph gives directed edge weights between users, learned from past interaction data. The weight is the predicted probability of a future interaction, not a count of past interactions. Super-plan §6 line 294 says "past interaction", which is looser. | supported | [5]: §1 defines the weight as the probability of an interaction from the source to the destination user in the future; §2.2 trains a logistic regression with a binary label on edge and user features; §3.1 gives the AUC per feature group |
| 4 | The form of the smoothing, (count + m × prior) / (total + m), is the m-estimate of Cestnik (1990), a known technique from classification. Using it for trust and community, and the value of `m`, are our own design. Super-plan §6 line 293 says "not a cited method". | supported | [29]: §2.4, eq. 19, p.6 (a secondary source for [28]); [28]: index record only, the paper was not read |
| 5 | The notes decide each of the three §6 choices with evidence. The D2 half: smoothing with `m` and one curve instead of three phases are decided in D2. The author term waits for D1 (Step 10). | supported | D2: the form follows [29] eq. 19; the weight of the prior is `m / (N_u + m)` (algebra on eq. 19); replacing the three phases is our own design |

## 3. How this file was made

- PDF tool: PDFKit through the compiled `pdftxt` (Swift 5.9.2, source `.docs/works/2026-10-23-p1-literature/pdftxt.swift`, built with `swiftc -framework PDFKit`), tested on [5] (title, authors and the first sentence of the abstract read well) and on [25] (authors and abstract read well, a table and the text of page 3 come out in the right order; the title lost its spaces and PDFKit printed one "CoreGraphics PDF has logged an error" line), 2026-10-24, pass.
- Tools that failed:
  - `swift pdftxt.swift` (interpreted): fails with "Symbols not found: PDFDocument", so the tool is compiled.
- Needs full text (for the author): [1] Tang 2013 (Springer sells the PDF), [2] Ma 2008 (ACM 403, repository needs a login), [9] Sedhain 2014 (repository copy embargoed), [16] Cañamares 2020 (closed access), [28] Cestnik 1990 (closed access), [23] Anagnostopoulos 2008 (no open copy found).

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

## 6. Other references

### [7] Twitter recommendation blog (Twitter Engineering 2023)
- Opened: 2026-10-24, index record [Wayback availability API: snapshot 20240508043115, a record only]
- Says: the text of the post was not read. Direct fetches of the snapshot returned HTTP 429 five times on 2026-10-24, `blog.x.com` returned HTTP 403, and the availability API returned 429 on its last try. Nothing is claimed about what the post says.
- For us: super-plan §6 cites it together with [6] for the use of RealGraph in the ranking. Use [6] instead. Step 24 tries the snapshot again.
- Cited in: not cited

### [16] Target item sampling (Cañamares 2020)
- Opened: 2026-10-24, abstract only [Semantic Scholar record of DOI 10.1145/3383313.3412259; Crossref gives the same title, authors, year and pages 259-268]
- Says: the paper studies how the choice of target set in offline evaluation changes the result of comparing recommenders. The abstract says that reduced target sets often contradict the result with large targets, and that minimum sets distort pairwise comparisons while maximum sets may not be ideal either. Super-plan §10 gives the code repository as the link. The paper itself is DOI 10.1145/3383313.3412259 (RecSys 2020).
- For us: D6, sampled versus full ranking. Only the abstract was read, so it supports no decision. The ACM page and the UAM repository gave no full text (the repository answered 403).
- Cited in: not cited

### [23] Influence and correlation (Anagnostopoulos 2008)
- Opened: 2026-10-24, index record [Crossref and OpenAlex records of DOI 10.1145/1401890.1401897]
- Says: the records confirm the title, the three authors (Aris Anagnostopoulos, Ravi Kumar, Mohammad Mahdian), KDD 2008, pages 7-15. No full text or abstract was read, and no legal open copy was found (the Sapienza repository answered 403).
- For us: D7 and claim 9, what W0, W1 and the timestamp shuffle can and cannot show. Without the text it supports no decision.
- Cited in: not cited

## 7. Recent work (2022 or later)

## 8. Older neighbours and other added references

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
