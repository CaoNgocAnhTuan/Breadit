# Datasets for P1 (task `p1-dataset-selection`)

Checked on 2026-10-26 and 2026-10-27 · Status: draft, waiting for the author's `/approve`

## 1. Decision

**Chosen: Digg 2009 (votes and friend links), from the Internet Archive copy.** Flickr WWW 2009 stays in the table as a second real set. The deciding criteria are 1 and 2: Digg is "pass" on both, Flickr is "partial" on both. This is the rule of section 2, applied again on 2026-10-27 after we opened the Digg files.

- We fetched both Digg zips from the Internet Archive and read them in full (section 4). The counts match the page exactly: 3,018,197 votes, 3,553 stories, 139,409 voters, 1,731,658 links, 71,367 users.
- **Criterion 1: pass.** Every link has a Unix `friend_date`. Only 1,670 of 1,731,658 links (0.10%) have the value 0, which means "unknown". The links fall on 1,434 different UTC days, and the most common day holds 0.49%, so the dates are a real spread and not one crawl day. The dates are on the same clock as the vote dates. So the graph can be cut at any test time T, and the future-follow leak of Flickr goes away.
- **Criterion 2: pass.** Votes have Unix dates. The author of a story is its first voter. For 98.2% of the 3,553 stories the first voter is in the friend table (the rule needs 80%). No story has a tie at its first vote.
- **Limits we state.** The pool is small: 3,553 stories, 36 UTC days (2009-05-31 to 2009-07-05), and only stories that reached the front page, so every story is already popular. Digg has no groups, so the community term is tested on synthetic data only. The zips come from an Internet Archive copy of 2013-08-26, because the original host is dead (criterion 4 is "partial"). Only 59.4% of the voters appear in the friend table.
- **Flickr** is "partial" on all four criteria. Its follow dates are calendar days and its favorites have only an order, so the time axes do not match and a later follow can leak into the past.
- Epinions and Ciao are also partial on 1 and 2, but a product has no user author, no group exists, and the host was down. Weibo has no follower graph in the sets we opened.
- "No candidate passes criteria 1 and 2" does not apply. Whether the super-plan changes (P4 is a stretch phase today) is for the author to decide, see section 7.

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
| Digg 2009 (Lerman) | **Pass (files opened 2026-10-26 UTC).** `digg_friends`: directed (page: "user_id is watching the activities of (is a fan of) friend_id"; the file has no field that shows the direction, so this is read from the page). `friend_date` is a Unix time: 1,670 of 1,731,658 links have the value 0 (unknown), the rest run from 2005-08-06 to 2009-07-08 UTC, on 1,434 UTC days, and the most common day holds 0.49% of the links. Same clock as the votes (2009-05-31 to 2009-07-05 UTC). Details: section 4. isi.edu/~lerman/downloads/digg2009.html (Internet Archive snapshot 20221130205157) and the zip from the Internet Archive, page and zip opened. | **Pass (files opened 2026-10-26 UTC).** `digg_votes`: 3,018,197 votes on 3,553 stories by 139,409 voters, `vote_date` is a Unix time. The author of a story is its first voter (page: "The first vote is from the story's submitter"; read from the first vote, not from a field). For 98.2% of the stories the first voter is in the friend table, and no story has a tie at its first vote. Details: section 4. isi.edu/~lerman/downloads/digg2009.html and the zip, opened. | **Fail.** No group data in the two tables. isi.edu/~lerman/downloads/digg2009.html, 2026-10-26, page opened (archive copy). | **Partial.** The original links are dead (tested 2026-10-26): `www.isi.edu/~lerman/downloads/digg_votes.zip` and `digg_friends.zip` return an HTML page, not a zip, and the loader link on isi.edu/people-lerman/research/downloads/ goes to isi.edu/centers-ckg/. The Internet Archive copy of 2013-08-26 works: 22,547,243 and 15,007,610 bytes (37.6 MB), the zip test passes. Both zips are password protected, and the page gives the password. Terms (archive copy): "This data is made available to the community for research purposes only. If you use the data in a publication, please cite: Hogg, T. and Lerman, K. (2012) Social Dynamics of Digg. EPJ Data Science 1(5)." That is a use rule, not a license text. |
| Epinions and Ciao (Tang) | **Partial.** Epinions trust: README says "user 1 trusts user 2 at timestamp 3", so directed, but the time has only 11 values. Ciao has no trust times. cse.msu.edu/~tangjili/datasetcode/truststudy.htm and `README_trust_timestamp.txt`, Internet Archive snapshot 20260913164449, page 2026-10-26 and README 2026-10-27, page opened (archive copy). | **Partial.** Ratings: user, product, category, score, helpfulness, one of 11 time values. A product has no user author, so there is no author term, and a rating score is not only a positive action. cse.msu.edu/~tangjili/datasetcode/truststudy.htm, 2026-10-26 and 2026-10-27, page opened (archive copy). | **Fail.** The page lists no groups, only product categories. cse.msu.edu/~tangjili/datasetcode/truststudy.htm, 2026-10-26, page opened (archive copy). | **Not checked: host down.** The live MSU server refused the connection (ECONNREFUSED) on 2026-10-26, so no file link was tested (cse.msu.edu). The archived page has no license text; it asks to cite the eTrust and mTrust papers. Files are `.mat`, `.txt`, `.zip`, `.rar`. |
| Flickr WWW 2009 (Cha, Mislove, Gummadi): links and favorites | **Partial.** `flickr-growth`: "All links are directed", each line is user, user, date (`YYYY-MM-DD`, a day). Final size 33,140,018 links, 2,570,535 users (paper Table 1). The date is a calendar day but favorites have only a sequence number, so they do not share one axis (section 4). socialnetworks.mpi-sws.org/data-www2009.html, 2026-10-26, page opened. | **Partial.** Favorite markings: user, photo, time; the photo file gives the owner. The time is a sequence number, so only the order is known ("each timestamp is replaced with a sequence number"). 34,734,221 markings (paper Table 1). Photos: 11,267,320 on the page, 11,195,144 in the paper; the page says the paper is wrong. socialnetworks.mpi-sws.org/data-www2009.html, 2026-10-26, page opened. | **Partial.** No groups in these four files. Groups come from the IMC 2007 crawl (next row). socialnetworks.mpi-sws.org/data-www2009.html, 2026-10-26, page opened. | **Partial.** All four files answered HTTP 200 on 2026-10-26 (after two redirects). No license text. Exact words: "© Copyright by Max Planck Institute for Software Systems 2018. All rights reserved." The page asks to cite the WWW 2009 paper and says the anonymization is "best effort". socialnetworks.mpi-sws.org/data-www2009.html, 2026-10-26, page opened. |
| Flickr IMC 2007 (Mislove et al.): groups | **Partial.** `flickr-links`: two ids per line, "All links are treated as directed", no dates. socialnetworks.mpi-sws.org/data-imc2007.html, 2026-10-26, page opened. | **Fail.** The four Flickr files (users, links, groups, memberships) have no interactions. socialnetworks.mpi-sws.org/data-imc2007.html, 2026-10-26, page opened. | **Partial.** `flickr-groupmemberships`: user id and group id per line, 27,357,385 bytes. It is a different crawl from WWW 2009. The id join is "likely", not proven (section 4). socialnetworks.mpi-sws.org/data-imc2007.html, 2026-10-26, page opened. | **Partial.** All four files answered HTTP 200 on 2026-10-26. Same copyright line (2018), same "best effort" anonymization, asks to cite the IMC 2007 paper. socialnetworks.mpi-sws.org/data-imc2007.html, 2026-10-26, page opened. |
| Weibo sets (Weiboscope, rumor set, 2016 cascade set) | **Fail on the sets opened.** No follower graph is described: rumor set page (ieee-dataport.org/node/13574), cascade set page (openi.pcl.ac.cn/GuhuangAI/TransHawkes), Weiboscope post (lists.aoir.org, thread M5G6GPRDYFS6YLPTK4PJ45BIZB2YSJBV). All page opened 2026-10-26. Weiboscope fields on its HKU page: not checked (HTTP 403 and a bot check, datahub.hku.hk, 2026-10-26). | **Pass in the cascade set only.** Fields: message id, root user id, publish time (Unix), retweet count, retweets with user path and time; 119,313 messages from 2016-06-01, retweets of the first 24 hours. openi.pcl.ac.cn/GuhuangAI/TransHawkes, 2026-10-26, page opened. Rumor set: counts only (2,746,818 users, 4,664 source tweets, 3,805,656 posts), times not confirmed, ieee-dataport.org/node/13574, 2026-10-26, page opened. | **Fail.** No groups described on any page opened. openi.pcl.ac.cn and ieee-dataport.org pages, 2026-10-26, page opened. | **Not checked: downloads not tested.** Cascade set: Baidu Pan link with a password; "This dataset is limited to only use in research." (openi.pcl.ac.cn, 2026-10-26, page opened). Rumor set: "This dataset requires an IEEE DataPort Subscription to access." No license stated. Weiboscope: old host `weiboscope.jmsc.hku.hk` timed out (2026-10-26); HKU DataHub page blocked. |

Notes on the table:
- The 2016 cascade set is also described in a search result for the CasCN and AutoCas papers: search only (2026-10-26). We did not find its original release page.
- The same Lerman downloads page lists a "Twitter 2010" set (tweeted URLs and followee links of tweeting users). Its files were not opened. It is not judged, because a candidate with a partial score on criteria 1 and 2 exists (extra candidates only when all four fail, design F12).

## 4. File evidence

**Which sets were opened.** First task (2026-10-26): Digg led on paper, but its live links were dead, so the plan said to take the next set, and Flickr was opened (samples below). Second task (`p1-digg-archive-check`): the two Digg zips were fetched from the Internet Archive and read in full. The Digg evidence is at the end of this section.

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

- Digg: `digg_votes.zip` and `digg_friends.zip` on `www.isi.edu` answer HTTP 200 with `text/html` (a redirect to the Lerman home page). The live links are dead. The Internet Archive copy works (end of this section).
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

**Digg: the two zips from the Internet Archive (task `p1-digg-archive-check`).** We asked the Internet Archive index (CDX) for each zip and fetched the raw capture (the `id_` form), one request at a time. The first requests answered HTTP 429 (too many requests); the files came after we waited 60 and 120 seconds. The fetch ran on 2026-10-26 from 18:33 to 18:39 UTC (the machine's local time is 7 hours ahead, so it was 2026-10-27 locally). The zips stay in the scratchpad, not in git. Nothing was extracted: `digg_stats.py` (task folder) reads the member as text through `zipfile` and writes no file.

| | `digg_votes.zip` | `digg_friends.zip` |
|---|---|---|
| Capture URL | `http://web.archive.org/web/20130826053517id_/http://www.isi.edu/~lerman/downloads/digg_votes.zip` | `http://web.archive.org/web/20130826053527id_/http://www.isi.edu/~lerman/downloads/digg_friends.zip` |
| Capture time | 2013-08-26 05:35:17 UTC | 2013-08-26 05:35:27 UTC |
| Bytes downloaded | 22,547,243 | 15,007,610 |
| Length in the index (CDX) | 22,554,684 | 15,012,753 |
| SHA-256 | `55bba035e08d31f14022aeef1f57b24322d2c0bea1fb241e3c99b0af59aafda1` | `4d5d3189c66d0606dc09aa919444cfc2377613a8011766af6f0ea9f3359c3bba` |
| Member (only one) | `digg_votes1.csv`, 85,563,349 bytes | `digg_friends.csv`, 61,202,706 bytes |
| Original `Last-Modified` | 2010-11-11 01:11:56 GMT | 2010-11-10 18:16:42 GMT |

- Both files start with `PK`, pass the zip test (all CRC checks ok), and hold one member with a safe name.
- The downloaded size is 7,441 and 5,143 bytes below the CDX length. It is equal to the original `Content-Length` that the Archive stores for the capture, and it fits the zip headers. The reason for the CDX difference: not checked. A second fetch for comparison answered HTTP 429 and was not repeated.
- Both members are password protected (traditional zip encryption). The Digg page says: "The data is in zipped csv files that are password protected. The password is digg2009_user." We used it. We re-read the page on 2026-10-26 at 18:39 UTC (Internet Archive snapshot 20221130205157, HTML SHA-256 `b3679114ccd85d9677d249ce2f943ae2267cbb88a1c52bd30e954a5a28544656`). Its columns and counts are the ones we checked.
- **Real columns.** Both files have no header row, and every value is in quotes. The votes file ends its rows with a bare CR, the friends file with CR LF. The first rows are in the page order:
  - votes (`vote_date, voter_id, story_id`): `"1246573330","318","1"`, `"1246603391","399","1"`, `"1246573479","1749","1"`
  - friends (`mutual, friend_date, user_id, friend_id`): `"1","1214799565","336224","266641"`, `"0","1230047012","336224","215086"`, `"1","1194104160","336224","151094"`
  - In the votes file the first rows are story 1 with voter ids in rising order, so the file is not in time order. The first vote of a story is found by its date.

**Counts, page against file.**

| Item | Page | Counted | Reason for a difference |
|---|---|---|---|
| Votes | 3,018,197 | 3,018,197 | none |
| Stories | 3,553 | 3,553 | none |
| Voters | 139,409 | 139,409 | none |
| Friend links | 1,731,658 | 1,731,658 | none. 0 duplicate pairs, 5 self-links, 886,335 rows with `mutual` = 1 (51.18%) |
| Users | 71,367 | 71,367 as `user_id` | The page counts the `user_id` side. The `friend_id` side has 258,218 distinct ids, and 279,631 ids appear on either side. |

Not on the page: 7,299 vote rows repeat a (voter, story) pair. The reason is not known. They are counted as votes in the numbers below.

**Criterion 1 for Digg: pass.**
- Direction: from the page (`user_id` is a fan of `friend_id`). Consistent with the file: 71,367 `user_id` values against 258,218 `friend_id` values, because only the voters' own lists were crawled.
- `friend_date`: min 0 (1,670 rows, 0.10%, unknown date), min other than 0 is 2005-08-06 13:22:50 UTC, max 2009-07-08 06:00:05 UTC.
- Spread: 1,434 distinct UTC days (the value 0 counts as one day, 1970-01-01). The most common day is 2009-06-18 with 8,438 links, 0.49%. The rule needs at most 50%, so the dates are a real spread.
- Against the vote window (2009-05-31 11:43:41 to 2009-07-05 11:29:52 UTC): 89.35% of the links are dated before the first vote, 10.04% inside the window, 0.61% after the last vote. Because the dates are real, the adapter can use only links with `friend_date` at or before T.

**Criterion 2 and the time axis for Digg: pass, same clock yes.**
- Vote dates: 2009-05-31 11:43:41 to 2009-07-05 11:29:52 UTC, 36 UTC days. The busy days (2009-06-02 to 2009-07-02) have 68,006 to 126,376 votes each; the first two days and the last three days are small tails (184 to 21,526 votes).
- First voter (the author) in the friend table: 98.20% of the 3,553 stories (96.48% as `user_id` only). Rule: at least 80% is pass. This is read from the first vote, not from a field. The page says the first vote is the submitter's; the data cannot confirm it.
- Ties at the first vote: 0 of 3,553 stories (0.00%). The rule allows up to 10%.
- Voters in the friend table: 59.40% (51.19% as `user_id`, 44.04% as `friend_id`). A voter who is not there "did not specify any friends" (page).
- Same clock: **yes.** Both dates are Unix times (seconds). `vote_date` runs 2009-05-31 to 2009-07-05 and `friend_date` ends on 2009-07-08, three days after the last vote, which fits a crawl right after the votes were collected. The files alone cannot prove that the two clocks are the same; this is our reading.

**Not checked (Digg).** Whether the first voter is the real submitter. Why 1,670 links have the date 0. Why 7,299 vote rows repeat. What the CDX length counts. License text beyond the page sentence.

## 5. What it can and cannot test

Words: testable, partly testable, not testable. First Digg 2009 (the chosen set, section 4), then Flickr WWW 2009.

**On Digg 2009**


- **Follow term: testable.** `friend_date` and `vote_date` are on one clock, so for a test at time T we use only links dated at or before T. Limits: the graph is one crawl from July 2009 (a follow that was removed before the crawl is missing), 1,670 links have no date (P4 decides: drop them or treat them as old), and 40.6% of the voters are not in the friend table at all, so they have no follows.
- **Author term: testable.** The author is the first voter, and 98.2% of the stories have a first voter in the friend table. The author is read from the first vote, not from a field (page text, not checked in the data).
- **Community term: not testable on real data.** Digg has no groups. The community term is tested on synthetic data only. The page says nothing about item categories either.
- **Cold-start buckets: testable, size to be cut by T.** A vote is a positive action. Counting all votes of a voter, 53.42% of the voters have 1 to 4 votes (27.80% have exactly 1), and 26.92% of all voters have 1 to 4 votes and are in the friend table. These shares are not yet cut by the test time T (P2 sets the rule), so the real bucket 0-4 will be larger than this and the number of test users will change.
- **H1: testable on the follow and author parts** (without the community term). The primary test stays on the synthetic world W2 (super-plan §1).
- **H2: testable as a relation.** Social density (followees) can be read from the graph and the gain can be tabulated by density. Nobody sets the influence level, so this shows a relation, not a cause.
- **H0 (null world) and influence: not testable.** Same reason as for Flickr below.
- **Pool limit.** Digg has 3,553 stories in 36 UTC days, and only stories that reached the front page. Every story is already popular (median 528 votes, mean 849), so a popularity baseline may look strong and the pool is not like a normal feed. We state this as a limit. The only positive action is a vote ("digg"). Some pairs of (voter, story) repeat (7,299 rows).

**On Flickr WWW 2009 (section 4)**

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

Digg numbers come first (the chosen set, section 6a). We computed them from the full files with `digg_stats.py`, so each row names its file. The Flickr numbers (section 6b) come from the dataset paper.

**6a. Digg 2009 (computed from the full files).** Files: `digg_votes1.csv` (3,018,197 rows) and `digg_friends.csv` (1,731,658 rows), both inside the zips of section 4. Percentiles use the nearest rank. Days are UTC. Rows are counted as they are (the 7,299 repeated vote rows are included).

| Target | Number | How computed | File |
|---|---|---|---|
| Votes per voter | mean 21.65; median 4; 90th percentile 45; 99th percentile 287; max 10,526 | Votes counted per `voter_id`, over the 139,409 voters (every voter has at least 1 vote) | `digg_votes1.csv` |
| Activity skew (share of votes by the top 20% of voters) | 83.64% | The 27,882 voters with the most votes (20% of 139,409, rounded up) against all votes | `digg_votes1.csv` |
| Share of voters by number of votes (all votes, **not cut by T**) | 1 vote: 27.80%; 2-4: 25.62%; 5-19: 26.86%; 20 or more: 19.72%. The "0-4" bucket (here 1-4, as every voter has at least 1 vote): 53.42% | Votes per voter over the whole file. Not yet cut by the test time T (P2 sets the rule). Voters with 1-4 votes who are also in the friend table: 26.92% of all voters | `digg_votes1.csv`, `digg_friends.csv` |
| Followees per user | Users with at least 1 followee in the table: 71,366, mean 24.26, max 995. Over all 279,631 users of the table (74.48% have none listed): mean 6.19, 90th percentile 5, 99th percentile 152 | Distinct `(user_id, friend_id)` pairs counted per `user_id`, self-links left out. With the reverse pair of every `mutual` = 1 row added: 167,722 users with at least 1 followee, mean 13.42, max 995 | `digg_friends.csv` |
| Followers per user | Users with at least 1 follower: 258,217, mean 6.71, max 12,038. Over all 279,631 users: mean 6.19, median 1, 90th percentile 7, 99th percentile 96; 55.21% have exactly 1 | The same pairs counted per `friend_id`. Only the 71,367 users with a list can be a follower here, so a follower count is a lower bound. With the `mutual` reverses added: mean 8.05 over all users, max 12,097 | `digg_friends.csv` |
| Share of two-way links | 51.18% of the rows have `mutual` = 1 | 886,335 / 1,731,658. Adding the `mutual` reverses raises the mean followees over all users from 6.19 to 8.05, so many `mutual` rows have no reverse row in the file | `digg_friends.csv` |
| Votes per story | mean 849.48; median 528; 90th percentile 1,787; 99th percentile 4,836; max 24,099 | Votes counted per `story_id`, over 3,553 stories | `digg_votes1.csv` |

The followee and follower percentiles over all 279,631 users are weak targets, because most of those users only appear as a `friend_id`. Percentiles over only the users with a list: not computed. Digg is a news site and the unit is a vote on a story. The generator should calibrate votes per user, the activity skew and the followees of users with a list, and say which other values are chosen.

**6b. Flickr WWW 2009 (printed in the paper).**

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

**Result of the Flickr checks (2026-10-26).** Q3 and Q6: the time axes answer is "no", so criterion 1 is "partial" and the graph is fixed. Q1: the condition is met only in a weak form. Ids look the same and favorites have owners, but a follow made after a favorite can leak into it.

**Decided by the author on 2026-10-27** (answers to the open questions of the task `p1-digg-archive-check`). An Internet Archive copy is an accepted source, if we record the archive URL, the capture time and the SHA-256, cite Hogg and Lerman (2012), and say that the original host is gone. If Digg wins by the rule, choose Digg and write the pool limit. The thresholds of section 2 (50%, 80%, 20%, 10%) stay. P-D means naming the targets only. The super-plan is edited only after the checkpoint, and only what the author chooses.

**Result of the Digg check (P-A).** The Digg zips match the page. Digg passes criteria 1 and 2 (section 1), so by the rule of section 2 Digg wins. The leak of Flickr is gone, because the follow dates are real and on the vote clock. Nothing in the super-plan has changed yet. The proposals below are written for Digg as the main real set. Most say what it would be if the author keeps Flickr.

| ID | Proposal (status) | Would change | Needs |
|---|---|---|---|
| P-A | **Done 2026-10-27.** The Digg zips were opened from the Internet Archive and read in full, and the decision rule was run again (sections 1 and 4). | Section 1 here (done) | Nothing more |
| P-B | **Not applied.** Make Digg the main real set and co-primary for RQ1 and the follow term (Q1 of 2026-10-26), because Digg passes criteria 1 and 2 and has no future-follow leak when the graph is cut at T. Keep Flickr as an optional second set. State the limits: small pool, one month, front-page stories only, the community term on synthetic data only, an archive copy. My advice: apply. If the author keeps Flickr: co-primary only if the future-follow leak is accepted. | §1 (the Data decision), P3, P4, §8 (the first risk and the cut order, where P4 is the first cut today) | Author |
| P-C | **Not applied.** On Digg, no change: `vote_date` is a Unix time, so the window W and the hour-based age term of BL2 keep their meaning. My advice: do not apply. P2 should check that the pool at time T is not too small for W and N_max (3,553 stories in 36 days). If the author keeps Flickr: replace W by the N_max newest photos in upload order, and define age as a rank on a grid of its own. | §5 pool, §5 BL2t, the notes of the unset §7 rows "Window W / pool cap N_max" and "Baseline grids" (no number set) | Author (`/freeze` for any number) |
| P-D | **Not applied.** In P3, name the targets to calibrate to, from section 6a: followees per user, followers per user, votes per user, activity skew, share of voters by number of votes. P3 already says "calibrate to the targets in `.docs/datasets.md`", so this only names them. Copy no number. My advice: apply. If the author keeps Flickr: section 6b, mean followees 12.89 and mean favorites per user 13.51. | P3 text only | Author |
| P4 sentence | **Not applied.** Replace the sentence in P4 "The Digg follower graph may have no timestamps (not confirmed). If so, it is treated as fixed over time, which can leak future follows into the past. Report this as a limitation." with the text below. | P4 text only | Author |

**Corrected P4 sentence (proposed).** "The Digg follower graph has dates (checked on the full file, `.docs/datasets.md` section 4). Each link has a Unix `friend_date` on the same clock as `vote_date`. Only 1,670 of 1,731,658 links (0.10%) have the value 0, which means unknown. The adapter uses only links dated at or before the test time T, so no later follow leaks into the past. Report these limits: the graph is one crawl from July 2009 (a follow removed before the crawl is missing), 40.6% of the voters are not in the friend table and have no follows, and the 1,670 undated links are dropped or treated as old (P4 decides)."

Two more facts for the P4 text (proposed, not applied): the same paragraph says "the page states no license". The page says "research purposes only" and asks to cite Hogg and Lerman (2012), which is a use rule and not a license text. And the files come from the Internet Archive copy of 2013-08-26 (the original host is dead), and the zips are password protected with a password that the page gives.

**License words, copied on 2026-10-26.** Flickr pages: "© Copyright by Max Planck Institute for Software Systems 2018. All rights reserved." Anonymization: 'For the data we make available, we use a "best effort" anonymization.' The pages ask to cite the paper. Digg (archive copy): "This data is made available to the community for research purposes only. If you use the data in a publication, please cite: Hogg, T. and Lerman, K. (2012) Social Dynamics of Digg. EPJ Data Science 1(5)." (text without the HTML tags; the page was read again on 2026-10-26 at 18:39 UTC and the words are the same). The supervisor must confirm what the missing license means for a thesis.

## 8. Sources

"Page opened" = read in full on that date. "Search only" = a search snippet. Dates are 2026-10-26 unless stated.

- Flickr WWW 2009 page: https://socialnetworks.mpi-sws.org/data-www2009.html (page opened; file URLs on it: `http://socialnetworks.mpi-sws.mpg.de/data/<file>.txt.gz`).
- Flickr IMC 2007 page: https://socialnetworks.mpi-sws.org/data-imc2007.html (page opened).
- Cha, Mislove, Gummadi (2009), WWW 2009: https://people.mpi-sws.org/~gummadi/papers/www09-cha.pdf (opened 2026-10-27, first 10 pages as text; DOI 10.1145/1526709.1526806 is from a search result, search only).
- Mislove, Marcon, Gummadi, Druschel, Bhattacharjee (2007), IMC 2007: citation read on the IMC page (the paper was not opened).
- Lerman downloads page: https://www.isi.edu/people-lerman/research/downloads/ (page opened). Digg page, Internet Archive snapshot: http://web.archive.org/web/20221130205157id_/https://www.isi.edu/~lerman/downloads/digg2009.html (page opened 2026-10-26, read again 2026-10-26 18:39 UTC). Digg zips, Internet Archive captures of 2013-08-26 (opened in full, 2026-10-26 18:33 to 18:39 UTC, details and SHA-256 in section 4): http://web.archive.org/web/20130826053517id_/http://www.isi.edu/~lerman/downloads/digg_votes.zip and http://web.archive.org/web/20130826053527id_/http://www.isi.edu/~lerman/downloads/digg_friends.zip. Zip index: Internet Archive CDX for `isi.edu/~lerman/downloads/digg_votes.zip` and `digg_friends.zip` (index read 2026-10-26).
- Hogg, Lerman (2012), Social Dynamics of Digg, EPJ Data Science 1(5): named on the Digg page (the paper was not opened).
- Tang, Epinions and Ciao: https://www.cse.msu.edu/~tangjili/datasetcode/truststudy.htm (live host refused the connection; Internet Archive snapshot 20260913164449 opened). Trust README in the same snapshot: `README_trust_timestamp.txt` (opened 2026-10-27).
- Weibo: https://ieee-dataport.org/node/13574 (page opened); https://openi.pcl.ac.cn/GuhuangAI/TransHawkes (page opened); https://lists.aoir.org/archives/list/air-l@lists.aoir.org/thread/M5G6GPRDYFS6YLPTK4PJ45BIZB2YSJBV/ (page opened). Not opened: https://datahub.hku.hk/articles/dataset/Weiboscope_Open_Data/16674565 (HTTP 403 and a bot check), https://service.tib.eu/ldmservice/dataset/weiboscope-dataset (bot check page). Web search results for Weibo sets: search only.
