# Datasets for P1 (task `p1-dataset-selection`)

Date: 2026-10-26 · Status: draft, waiting for the author's `/approve`

## 1. Decision

Pending. It is filled in Step 5, after the evidence is collected.

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

(Filled in Step 5.)

## 6. Calibration targets for the generator (P3)

(Filled in Step 5.)

## 7. Proposed changes to the plan

(Filled in Step 5. Nothing here is applied to the super-plan. The author decides.)

## 8. Sources

(Filled in Steps 2 to 5.)
