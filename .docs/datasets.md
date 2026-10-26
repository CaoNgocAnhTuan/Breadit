# Datasets for P1 (task `p1-dataset-selection`)

Checked on 2026-10-26 and 2026-10-27 · Status: draft, waiting for the author's `/approve`

## 1. Decision

**Chosen: Flickr WWW 2009 (links, photos, favorite markings).** The IMC 2007 group files are an add-on that is not proven. The deciding criterion is 4 (practical), then 1 and 2.

- Digg 2009 is stronger on criteria 1 and 2 (pass and pass). The graph has a Unix date for each follow and the votes use the same clock. But its download links are dead (tested 2026-10-26). Under the plan (design F2) we take the next set.
- Flickr is "partial" on all four criteria. The follow dates are calendar days and the favorites have only an order. Time axes answer: no. So the graph is treated as fixed and a later follow can leak into the past.
- Epinions and Ciao are also partial on 1 and 2, but a product has no user author, no group exists, and the host was down. Weibo has no follower graph in the sets we opened.
- "No candidate passes criteria 1 and 2" does not apply, so P4 stays a stretch.

**One thing for the author.** The Internet Archive lists copies of both Digg zips (37.6 MB together). We did not open them. If they match the archived page, Digg would be the better fit for the follow term, because its follows are dated on the same clock as its votes. See proposal P-A in section 7. Also, the P4 text in the super-plan says the Digg graph "may have no timestamps (not confirmed)". The archived page shows that it has them (`friend_date`).

## 2. Rules (written before any candidate was judged)

These rules come from super-plan P1 Step 2. They were committed before the candidate table, so the decision cannot be bent toward a favorite (design F13).

| Criterion | Pass | Partial | Fail |
|---|---|---|---|
| 1 Social graph | Directed follows with dates, and the dates are on the same time axis as the interactions | Directed follows, but no dates, or dates that cannot be aligned with the interactions. The graph is treated as fixed, so future follows can leak into the past (super-plan P4 text). | Undirected, or no graph |
| 2 Interactions | Dated positive actions on items whose author is a user in the same graph | Positive actions, but the author is unknown or outside the graph, or the times are only an order | No positive actions |
| 3 Communities | Memberships for the same users (the ids join) | Memberships exist but the join is unproven, or they come from another crawl | None |
| 4 Practical | Download works, size fits a laptop slice, terms allow thesis use or are at least not forbidding | Works, but no license text (we record this and cite the paper) | Link dead, or terms forbid use |

**Decision rule.**
- Criteria 1 and 2 decide. A set with "fail" on either is out (super-plan P1 Step 2).
- Among the rest, pick the set with the most "pass" on criteria 1 and 2. Criteria 3 and 4 break ties.
- If no set has at least "partial" on both 1 and 2, write "no candidate passes criteria 1 and 2". Then P4 is dropped and the thesis uses synthetic data only (super-plan §8).
- A "partial" on criterion 1 is allowed, because the super-plan already accepts a fixed graph as a stated limitation.

**Three more rules (added on 2026-10-27, before any Digg file was opened).** The levels above are not exact on three points. The numbers below are our own choice, not from a source. They are written first, so the Digg numbers cannot bend them (design F13).
- **Criterion 1, spread of dates.** A follow date counts as "dated" only if it has a real spread: the most common UTC day holds at most 50% of the links. If more than 50% of the links share one day, the date is the crawl day, not the day of the follow, and criterion 1 is "partial".
- **Criterion 2, author known.** The author of a story is its first voter. Take the share of stories whose first voter is a user in the friend table. At least 80% is "pass". From 20% up to 80% is "partial". Below 20% is "fail".
- **Ties.** If two votes of one story have the same `vote_date`, the file order breaks the tie. We report the share of stories with a tie at the first vote. Above 10%, the author answer is "unclear" and criterion 2 is at most "partial".

**Source marks.** "page opened" means we opened the page and read it on that date. "search only" means we saw only a search snippet. "not checked" means we could not check it, and the reason is written. A search snippet is never used as a fact (super-plan §10 rule).

## 3. Candidate table

Levels follow section 2. "Page opened" means we read the page on that date. Short URLs omit `https://`. Sizes are bytes from the `Content-Length` header. Section 4 holds the file evidence and the full URL list is in section 8.

| Candidate | 1 Social graph | 2 Interactions | 3 Communities | 4 Practical |
|---|---|---|---|---|
| Digg 2009 (Lerman) | **Pass.** `digg_friends`: directed (user_id is a fan of friend_id: "user_id is watching the activities of (is a fan of) friend_id"), `friend_date` is a Unix time, 1,731,658 links of 71,367 users. Same clock as the votes. isi.edu/~lerman/downloads/digg2009.html, Internet Archive snapshot 20221130205157, 2026-10-26, page opened (archive copy). | **Pass.** `digg_votes`: 3,018,197 votes on 3,553 stories by 139,409 voters, `vote_date` is a Unix time. "The first vote is from the story's submitter", so the author is a user with an id in the graph (read from the first vote, not a field). isi.edu/~lerman/downloads/digg2009.html, 2026-10-26, page opened (archive copy). | **Fail.** No group data in the two tables. isi.edu/~lerman/downloads/digg2009.html, 2026-10-26, page opened (archive copy). | **Fail on the written rule (live link dead).** isi.edu/people-lerman/research/downloads/ still shows "Download Digg 2009 data set" (page opened 2026-10-26), but the loader link goes to isi.edu/centers-ckg/, and `www.isi.edu/~lerman/downloads/digg_votes.zip` and `digg_friends.zip` return an HTML page, not a zip (2026-10-26). The Internet Archive index lists both zips (2013-08-26, 22,554,684 and 15,012,753 bytes; web.archive.org CDX, 2026-10-26); not downloaded, not opened. Terms (archive copy): "This data is made available to the community for research purposes only. If you use the data in a publication, please cite: Hogg, T. and Lerman, K. (2012) Social Dynamics of Digg. EPJ Data Science 1(5)." |
| Epinions and Ciao (Tang) | **Partial.** Epinions trust: README says "user 1 trusts user 2 at timestamp 3", so directed, but the time has only 11 values. Ciao has no trust times. cse.msu.edu/~tangjili/datasetcode/truststudy.htm and `README_trust_timestamp.txt`, Internet Archive snapshot 20260913164449, page 2026-10-26 and README 2026-10-27, page opened (archive copy). | **Partial.** Ratings: user, product, category, score, helpfulness, one of 11 time values. A product has no user author, so there is no author term, and a rating score is not only a positive action. cse.msu.edu/~tangjili/datasetcode/truststudy.htm, 2026-10-26 and 2026-10-27, page opened (archive copy). | **Fail.** The page lists no groups, only product categories. cse.msu.edu/~tangjili/datasetcode/truststudy.htm, 2026-10-26, page opened (archive copy). | **Not checked: host down.** The live MSU server refused the connection (ECONNREFUSED) on 2026-10-26, so no file link was tested (cse.msu.edu). The archived page has no license text; it asks to cite the eTrust and mTrust papers. Files are `.mat`, `.txt`, `.zip`, `.rar`. |
| Flickr WWW 2009 (Cha, Mislove, Gummadi): links and favorites | **Partial.** `flickr-growth`: "All links are directed", each line is user, user, date (`YYYY-MM-DD`, a day). Final size 33,140,018 links, 2,570,535 users (paper Table 1). The date is a calendar day but favorites have only a sequence number, so they do not share one axis (section 4). socialnetworks.mpi-sws.org/data-www2009.html, 2026-10-26, page opened. | **Partial.** Favorite markings: user, photo, time; the photo file gives the owner. The time is a sequence number, so only the order is known ("each timestamp is replaced with a sequence number"). 34,734,221 markings (paper Table 1). Photos: 11,267,320 on the page, 11,195,144 in the paper; the page says the paper is wrong. socialnetworks.mpi-sws.org/data-www2009.html, 2026-10-26, page opened. | **Partial.** No groups in these four files. Groups come from the IMC 2007 crawl (next row). socialnetworks.mpi-sws.org/data-www2009.html, 2026-10-26, page opened. | **Partial.** All four files answered HTTP 200 on 2026-10-26 (after two redirects). No license text. Exact words: "© Copyright by Max Planck Institute for Software Systems 2018. All rights reserved." The page asks to cite the WWW 2009 paper and says the anonymization is "best effort". socialnetworks.mpi-sws.org/data-www2009.html, 2026-10-26, page opened. |
| Flickr IMC 2007 (Mislove et al.): groups | **Partial.** `flickr-links`: two ids per line, "All links are treated as directed", no dates. socialnetworks.mpi-sws.org/data-imc2007.html, 2026-10-26, page opened. | **Fail.** The four Flickr files (users, links, groups, memberships) have no interactions. socialnetworks.mpi-sws.org/data-imc2007.html, 2026-10-26, page opened. | **Partial.** `flickr-groupmemberships`: user id and group id per line, 27,357,385 bytes. It is a different crawl from WWW 2009. The id join is "likely", not proven (section 4). socialnetworks.mpi-sws.org/data-imc2007.html, 2026-10-26, page opened. | **Partial.** All four files answered HTTP 200 on 2026-10-26. Same copyright line (2018), same "best effort" anonymization, asks to cite the IMC 2007 paper. socialnetworks.mpi-sws.org/data-imc2007.html, 2026-10-26, page opened. |
| Weibo sets (Weiboscope, rumor set, 2016 cascade set) | **Fail on the sets opened.** No follower graph is described: rumor set page (ieee-dataport.org/node/13574), cascade set page (openi.pcl.ac.cn/GuhuangAI/TransHawkes), Weiboscope post (lists.aoir.org, thread M5G6GPRDYFS6YLPTK4PJ45BIZB2YSJBV). All page opened 2026-10-26. Weiboscope fields on its HKU page: not checked (HTTP 403 and a bot check, datahub.hku.hk, 2026-10-26). | **Pass in the cascade set only.** Fields: message id, root user id, publish time (Unix), retweet count, retweets with user path and time; 119,313 messages from 2016-06-01, retweets of the first 24 hours. openi.pcl.ac.cn/GuhuangAI/TransHawkes, 2026-10-26, page opened. Rumor set: counts only (2,746,818 users, 4,664 source tweets, 3,805,656 posts), times not confirmed, ieee-dataport.org/node/13574, 2026-10-26, page opened. | **Fail.** No groups described on any page opened. openi.pcl.ac.cn and ieee-dataport.org pages, 2026-10-26, page opened. | **Not checked: downloads not tested.** Cascade set: Baidu Pan link with a password; "This dataset is limited to only use in research." (openi.pcl.ac.cn, 2026-10-26, page opened). Rumor set: "This dataset requires an IEEE DataPort Subscription to access." No license stated. Weiboscope: old host `weiboscope.jmsc.hku.hk` timed out (2026-10-26); HKU DataHub page blocked. |

Notes on the table:
- The 2016 cascade set is also described in a search result for the CasCN and AutoCas papers: search only (2026-10-26). We did not find its original release page.
- The same Lerman downloads page lists a "Twitter 2010" set (tweeted URLs and followee links of tweeting users). Its files were not opened. It is not judged, because a candidate with a partial score on criteria 1 and 2 exists (extra candidates only when all four fail, design F12).

## 4. File evidence

**Which set was opened.** After the web check (section 3), Digg leads on criteria 1 and 2 (pass, pass). We tested its links first (design F2). Both zips answer with an HTML page, so Digg fails the live-link test, and the next set, Flickr, was opened. The Digg files on the Internet Archive were not opened (the plan says to take the next candidate).

**Liveness (HEAD requests, 2026-10-26).** Flickr files: `http://` redirects twice to `https://socialnetworks.mpi-sws.org/data/<file>`, then HTTP 200, `application/x-gzip`.

| File | Bytes | Last-Modified | Size on the page |
|---|---|---|---|
| `flickr-growth.txt.gz` | 147,532,958 | 2008-05-01 | 147 MB |
| `flickr-all-photos.txt.gz` | 132,484,925 | 2012-01-02 17:32 GMT | 154 MB |
| `flickr-all-photo-favorite-markings.txt.gz` | 294,755,254 | 2012-01-02 17:23 GMT | 346 MB |
| `flickr-photo-favorite-markings.txt.gz` | 116,670,395 | 2012-01-02 17:44 GMT | 135 MB |
| `flickr-links.txt.gz` (IMC) | 76,313,030 | 2007-09-18 | 76 MB |
| `flickr-users.txt.gz` (IMC) | 3,934,676 | 2007-09-18 | 3.9 MB |
| `flickr-groups.txt.gz` (IMC) | 223,459 | 2007-09-18 | 223 KB |
| `flickr-groupmemberships.txt.gz` (IMC) | 27,357,385 | 2007-09-18 | 27.3 MB |

- Digg: `digg_votes.zip` and `digg_friends.zip` on `www.isi.edu` answer HTTP 200 with `text/html` (a redirect to the Lerman home page). Criterion 4 fails for the live links.
- The three files with a timestamp fix have `Last-Modified` on 2012-01-02, not before it. The page asks people who downloaded between 2010-05-17 and 2012-01-02 to download again. The header cannot show that a file is the fixed version, so the order check in the samples (below) is the only test we have.
- Three sizes on the page are larger than the header sizes (154, 346, 135 MB against 132.5, 294.8, 116.7 MB). The reason is not known. We use the header sizes.

**Samples.** N = 50,000 lines, the first lines of each file, taken on 2026-10-26 with `curl | gunzip | head -n 50000`. No full file was saved. Each sample is in its own folder in the scratchpad and is not in git. The head of a file is not random, so the samples give only formats and id rules (F3). No mean or skew comes from them.

| File | Lines read | SHA-256 of the sample | Columns (tab separated) |
|---|---|---|---|
| `flickr-growth` | 50,000 | `6b64a6fb27f1615c7764a4df7015c7a22bd850b1a5ac5fc11694ebcd72126b63` | user, user, date `YYYY-MM-DD` |
| `flickr-all-photos` | 50,000 | `b518d0dc552264ca41e0d1c938995d2a223307e7e0d32f535cc837090a82fb13` | photo, upload time, owner, views, comments, favorites |
| `flickr-all-photo-favorite-markings` | 50,000 | `3c1bb767463a8849b83e6ea749e3a680cf7f888d8bb6268a1d29a3c21d6d6047` | user, photo, time |
| `flickr-photo-favorite-markings` | 50,000 | `ac5d8beb966144eb7946de720a0aff180d944493fbdf5530f089ea21d05a7f4f` | user, photo, time |
| `flickr-links` (IMC) | 50,000 | `9e8f229dc70c731d167990ff0850450702aabbbbd92fb2745e4c89ae0e198c33` | user, user |
| `flickr-users` (IMC) | 50,000 | `0ba292f7e600d0dfe3f050098be212e7a3f46613747a0b33997b29e95482faae` | user |
| `flickr-groups` (IMC) | 50,000 | `44969d026ed4164dbe77d48d4d359e98ac4057008cafd61723be72bff83e5fd4` | group |
| `flickr-groupmemberships` (IMC) | 50,000 | `030ee049b9fefb074940cb3e64e2b94f8550354faa703ecaa0030aa79156aa4b` | user, group |

All 50,000 lines of every sample had the same number of columns, so no line was cut. A small script (kept outside the repo) printed the types and the min and max of each column.

**Question 1: columns and types.** All ids are plain integers. The link date in `flickr-growth` is a real date with day precision. The photo upload time and the favorite time are plain integers (sequence numbers). In the sample, all links have the date 2006-11-02; the file is sorted by the first user, so the head says nothing about the spread of dates (full range: not computed, P4). The page says a link "was observed" on the date. Our reading: an old link gets the first crawl day as its date, so the date is not the day the follow was made. `flickr-all-photo-favorite-markings` is sorted by time (14,417 to 128,418 in the sample). `flickr-photo-favorite-markings` is sorted by photo id (times 20,386,495 to 28,954,131).

**Question 2: time axes (F4).** Time axes answer: **no** for follows against favorites. The link date is a calendar day. The favorite time is a sequence number with no calendar anchor in the files or on the page. We found no rule that maps one to the other, so we cannot tell if a follow came before a favorite. Criterion 1 stays "partial", the graph is treated as fixed, and a future follow can leak into the past.
Photo upload time and favorite time look like one sequence. In the samples, the favorite time is later than the upload time of the same photo in 984 of 999 rows (all-favorites) and in 49,967 of 50,000 rows (subset). The other 15 and 33 rows are earlier, never equal. This is about 1.5% and 0.07%. The reason is not known (the 2012 timestamp fix may not be perfect, or the sample is biased).

**Question 3: id rules and join (F5).** Id join answer: **likely**, not proven.
- Photo owners: 14,345 distinct owners in the photo sample, ids 2 to 2,145,902. This is below the 2,570,535 users of the final graph (paper Table 1). Of these owners, 6,858 also occur among the 29,207 ids of the `flickr-growth` sample. So the owner looks like an id of the same space as the links. The growth sample is small and biased, so this is not a proof.
- Favoriting users: in `flickr-photo-favorite-markings`, 4,524 of 26,645 users occur among the ids of the `flickr-growth` sample (user ids in that file: 1 to 2,238,976).
- IMC against WWW 2009: both crawls number users from 1. For the 150 source users that are complete in both link samples, the out-lists overlap strongly (Jaccard median 0.963, lowest 0.579). User 1 starts with 2, 3, 4, 5, 6, 7, 8, 9 in both files. Of the 397 users in the group-membership sample, all 397 are in the IMC users sample and 374 are in the IMC links sample. It is likely that the two crawls use one id space, because the same small ids have nearly the same friends. The two files are from different crawls (2006-2007 against 2007), so the lists are not equal. P4 must prove it on the full files.

**Not checked.** The full date range of links; the share of users with favorites; the number of users in the group file (the groups sample has 50,000 groups, the file was not read to its end); license text beyond the copyright line.

## 5. What it can and cannot test

On Flickr WWW 2009 (section 4). Words: testable, partly testable, not testable.

- **Follow term: partly testable.** The graph is one final snapshot, because follows and favorites are not on one axis. A follow made after a favorite can help to predict it. The result is an upper bound for the follow signal.
- **Author term: partly testable.** The photo owner is `author(p)` and the owner ids look like link ids (id join "likely", section 4). The term uses the same fixed graph, so it has the same leak.
- **Community term: not testable on real data.** The groups come from another crawl and the id join is not proven. Decided 2026-10-26: the community term is tested on synthetic data only.
- **Cold-start buckets: partly testable.** A favorite is a positive action. The size of the buckets 0, 1-4, 5-19, 20 or more is not computed, so we do not know how many test users the bucket 0-4 keeps. P4 counts them.
- **H1: partly testable.** It can test the follow and author parts for users with 0-4 earlier favorites, without the community term. The primary test stays on the synthetic world W2 (super-plan §1).
- **H2: partly testable.** Social density (number of followees) can be read from the graph and the gain can be tabulated by density. Nobody sets the influence level, so this shows a relation, not a cause.
- **H0 (null world): not testable.** It needs a world with no social influence, which only we can build.
- **Influence: not testable.** Observational data cannot separate influence from similar taste (`.docs/literature.md` D6). A win means better prediction.

Limits that follow from Q3, Q4 and Q6 (section 7): the only positive action is a favorite; the comment count in the photo file is not used; the age term of BL2 needs a new definition; the window W is replaced by the N_max newest photos. A deleted favorite or a private photo is not in the data (paper §2.4).

## 6. Calibration targets for the generator (P3)

All numbers are printed in the dataset paper, or are computed by us from two printed totals. None comes from the samples. "Final graph" means the last snapshot (2,570,535 users, 33,140,018 links).

| Target | Number | How computed | Source |
|---|---|---|---|
| Mean followees per user | 12.89 | 33,140,018 links / 2,570,535 users. Mean over all users of the final graph, not over active users. The paper prints "average outdegree was 14" and the gap is not explained. | Paper Table 1 and §3.1 (opened 2026-10-27) |
| Shape of followees per user | 55% of users have 1 outgoing link; 90% have fewer than 10; the maximum is 26,342 | Printed in the paper | Paper §3.1 |
| Mean followers per user | 12.89 | Same links / same users, so equal to the mean followees. Shape is "similar", with a smaller maximum. 68% of links are two-way; in-degree and out-degree correlate at 0.76 (printed). | Paper Table 1 and §3.1 |
| Mean interactions (favorites) per user | 13.51 | 34,734,221 favorites / 2,570,535 users. Mean over all users of the final graph. Users with no favorite are in the count and their number is not known. | Paper Table 1 |
| Mean favorites per photo | 3.10 | 34,734,221 / 11,195,144 photos (the page gives 11,267,320 photos: 3.08). The photos are those favorited by at least one user. | Paper Table 1, dataset page |
| Photo popularity skew | 88% of 3,055,361 photos have at most 5 favorites; 3,685 photos have more than 100 | Printed. Photos uploaded in the 104 days of the crawl only. | Paper §6.1 and §6.3 |
| Activity skew (share of favorites by the top 20% of users) | not computed | Needs the full `flickr-all-photo-favorite-markings` file (294,755,254 bytes). P4 computes it. | File on the dataset page |
| Followee and follower distributions | not computed | Needs the full `flickr-growth` file. P4 computes them. | File on the dataset page |
| Share of users with 0-4 earlier positives | not computed | Needs the full favorites file and the cut-time rule (P2). P4 computes it. | File on the dataset page |

Flickr is a photo site and the unit is a favorite, not a post. The generator should calibrate the mean followees and the mean interactions per user, and say which other values are chosen.

## 7. Proposed changes to the plan

**Decided by the author on 2026-10-26** (answers to the open questions of the design). Nothing here changes a frozen value (super-plan §7).
- **Q1.** Real data becomes co-primary for RQ1 and the follow term, but only if the graph and the favorites can be used together. Synthetic keeps W0, the influence sweep and the community term.
- **Q2.** The community term is tested on synthetic data only. This is a stated limit. Even if the id join is "likely", it is not used before P4 proves it.
- **Q3 and Q6.** The order of events is the time axis. If the link dates and the favorite order cannot be aligned, criterion 1 is "partial", the follow graph is treated as fixed, and the leak is a stated limit. On real data the window W becomes "the N_max newest posts in order", and the age term of BL2 needs another definition.
- **Q4.** A favorite is a like and the only positive on real data. The comment count in the photo file is not used, because it counts events after the test time (leakage).
- **Q5.** Use the data, cite the paper, keep raw files out of git. The question about the missing license goes into the supervisor note (`p1-supervisor-note`). We write no sentence that says the data is "allowed".
- **Q7.** This task edits only super-plan §10 and adds change-log line 0.8. All other changes below are proposals.

**Result of the checks.** Q3 and Q6: the time axes answer is "no", so criterion 1 is "partial" and the graph is fixed. Q1: the condition is met only in a weak form. Ids look the same and favorites have owners, but a follow made after a favorite can leak into it.

| ID | Proposal (not applied) | Would change | Needs |
|---|---|---|---|
| P-A | Open the Digg zips from the Internet Archive with the same small sample (N = 50,000). If they match the archived page, rerun the decision. Digg would pass 1 and 2. Fix the P4 sentence "may have no timestamps". | Section 1 here, P4 text | Author's OK to use an archive copy |
| P-B | Make Flickr co-primary for RQ1 and the follow term (Q1). My advice: only if the author accepts the future-follow leak, or if Digg (P-A) fails. Otherwise keep real data as outside evidence. | §1, P3, P4, §8 | Author |
| P-C | On real data, replace W by the N_max newest photos in upload order. Define age as the number of pool photos uploaded after the photo (a rank), and let BL2t tune its weight on a grid of its own, because "0.25 per hour" has no hours here. | §5 pool, §5 BL2t, §7 grids | Author (`/freeze`) |
| P-D | Use section 6 as the targets for `synthetic-v1.json`: mean followees 12.89 and mean favorites per user 13.51; mark the rest as chosen. | P3 | Author |

**License words, copied on 2026-10-26.** Flickr pages: "© Copyright by Max Planck Institute for Software Systems 2018. All rights reserved." Anonymization: 'For the data we make available, we use a "best effort" anonymization.' The pages ask to cite the paper. Digg (archive copy): "This data is made available to the community for research purposes only. If you use the data in a publication, please cite: Hogg, T. and Lerman, K. (2012) Social Dynamics of Digg. EPJ Data Science 1(5)." (text without the HTML tags). The supervisor must confirm what the missing license means for a thesis.

## 8. Sources

"Page opened" = read in full on that date. "Search only" = a search snippet. Dates are 2026-10-26 unless stated.

- Flickr WWW 2009 page: https://socialnetworks.mpi-sws.org/data-www2009.html (page opened; file URLs on it: `http://socialnetworks.mpi-sws.mpg.de/data/<file>.txt.gz`).
- Flickr IMC 2007 page: https://socialnetworks.mpi-sws.org/data-imc2007.html (page opened).
- Cha, Mislove, Gummadi (2009), WWW 2009: https://people.mpi-sws.org/~gummadi/papers/www09-cha.pdf (opened 2026-10-27, first 10 pages as text; DOI 10.1145/1526709.1526806 is from a search result, search only).
- Mislove, Marcon, Gummadi, Druschel, Bhattacharjee (2007), IMC 2007: citation read on the IMC page (the paper was not opened).
- Lerman downloads page: https://www.isi.edu/people-lerman/research/downloads/ (page opened). Digg page, Internet Archive snapshot: http://web.archive.org/web/20221130205157id_/https://www.isi.edu/~lerman/downloads/digg2009.html (page opened). Zip index: Internet Archive CDX for `isi.edu/~lerman/downloads/digg_votes.zip` and `digg_friends.zip` (index read; the files were not opened).
- Hogg, Lerman (2012), Social Dynamics of Digg, EPJ Data Science 1(5): named on the Digg page (the paper was not opened).
- Tang, Epinions and Ciao: https://www.cse.msu.edu/~tangjili/datasetcode/truststudy.htm (live host refused the connection; Internet Archive snapshot 20260913164449 opened). Trust README in the same snapshot: `README_trust_timestamp.txt` (opened 2026-10-27).
- Weibo: https://ieee-dataport.org/node/13574 (page opened); https://openi.pcl.ac.cn/GuhuangAI/TransHawkes (page opened); https://lists.aoir.org/archives/list/air-l@lists.aoir.org/thread/M5G6GPRDYFS6YLPTK4PJ45BIZB2YSJBV/ (page opened). Not opened: https://datahub.hku.hk/articles/dataset/Weiboscope_Open_Data/16674565 (HTTP 403 and a bot check), https://service.tib.eu/ldmservice/dataset/weiboscope-dataset (bot check page). Web search results for Weibo sets: search only.
