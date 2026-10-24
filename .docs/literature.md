# Literature notes (P1) · updated 2026-10-24 · task 2026-10-23-p1-literature

Working notes for P1. Not thesis text.

## 1. Status table

| Ref | Short name | Type | Verified | Read | Opened | Cited in |
|---|---|---|---|---|---|---|
| [1] | Social recommendation review (Tang 2013) | survey | verified | abstract only | 2026-10-24 | not cited |
| [2] | SoRec (Ma 2008) | paper | verified | abstract only | 2026-10-24 | not cited |
| [5] | RealGraph (Kamath 2014) | paper | verified | full text | 2026-10-24 | Ch2, Ch3 |
| [7] | Twitter blog (2023) | blog | do not cite, use [6] | index record | 2026-10-24 | not cited |
| [16] | Target item sampling (Cañamares 2020) | paper | verified | abstract only | 2026-10-24 | not cited |
| [23] | Influence and correlation (Anagnostopoulos 2008) | paper | verified | index record | 2026-10-24 | not cited |

## 2. Claims

| # | Claim | Status | Evidence |
|---|---|---|---|
| 2 | RealGraph gives directed edge weights between users, learned from past interaction data. The weight is the predicted probability of a future interaction, not a count of past interactions. Super-plan §6 line 294 says "past interaction", which is looser. | supported | [5]: §1 defines the weight as the probability of an interaction from the source to the destination user in the future; §2.2 trains a logistic regression with a binary label on edge and user features; §3.1 gives the AUC per feature group |

## 3. How this file was made

- PDF tool: PDFKit through the compiled `pdftxt` (Swift 5.9.2, source `.docs/works/2026-10-23-p1-literature/pdftxt.swift`, built with `swiftc -framework PDFKit`), tested on [5] (title, authors and the first sentence of the abstract read well) and on [25] (authors and abstract read well, a table and the text of page 3 come out in the right order; the title lost its spaces and PDFKit printed one "CoreGraphics PDF has logged an error" line), 2026-10-24, pass.
- Tools that failed:
  - `swift pdftxt.swift` (interpreted): fails with "Symbols not found: PDFDocument", so the tool is compiled.
- Needs full text (for the author): [1] Tang 2013 (Springer sells the PDF), [2] Ma 2008 (ACM 403, repository needs a login), [16] Cañamares 2020 (closed access), [23] Anagnostopoulos 2008 (no open copy found).

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

## 5. Design decisions

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

## 9. Proposed changes

| ID | Change | Where | Evidence | Goes to |
|---|---|---|---|---|
