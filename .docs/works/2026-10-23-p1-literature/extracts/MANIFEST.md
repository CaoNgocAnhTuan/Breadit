# Extracts of 2026-10-24

These are inputs for the entries in `.docs/literature.md`. They are not thesis text and not decisions. A Haiku subagent read each source and wrote its extract; Claude checked each quote with `checkquotes.py` against the extracted text (kept in the scratchpad, not in the repo) and checked each file with `file` and `shasum`. Read the plan's rule "Haiku extracts" before you use one.

"Quotes" means: found / checked. For [5] and [14] the checker also printed lines that were text between two quotes, not quotes; every real quote was found.

| Ref | Depth | What was opened | sha256 (12) | Quotes | Note |
|---|---|---|---|---|---|
| [1] Tang | abstract only | Springer landing page (paywalled: 'Buy article PDF'; checked in the browser) | none | 1/1 | Second author is Xia Hu |
| [2] Ma (SoRec) | abstract only | Semantic Scholar abstract (ACM 403, repository needs a login) | none | 5/5 | |
| [3] Wu (DiffNet) | full text | arXiv v1 | 8ff64645267c | 14/14 | Authors: Wu, Sun, Fu, Hong, Wang, Wang. No formal "hop" |
| [4] Sharma | full text (§1, §4.1.2–4.1.3, §5.1–5.1.3, §5.4, §6.3, §7, §8) | arXiv 2212.04481v3 | ed3630bc5228 | 5/5 | Preprint, not the ACM copy. The word "hop" never appears |
| [5] Kamath (RealGraph) | full text | UEO workshop PDF | 1ecfd151c66e | all real quotes found | Weight is the probability of a future interaction. The paper never says "KDD" |
| [6] Twitter code | full text (6 files) | GitHub, commit c54bec0d4e029fe34926ef3258a86ccacc0d0182 (HEAD, 2025-09-03) | none | 6/6 | The RealGraph files also exist at 90d7ea370e4db804fb8f57fcb133a84af767dbfb (2023-04-28); not read there |
| [7] Twitter blog | index record only | Wayback timestamp 20240508043115 (HTTP 429) | none | 0 | Retry later |
| [8] Jamali (SocialMF) | none | no legal copy found | none | 0 | |
| [9] Sedhain | abstract only | ANU portal abstract (repository copy embargoed) | none | 7/7 | |
| [10] Chen (Orkut) | full text | WWW 2009 archive, Southampton | 988e0831f21d | 9/9 | Membership only, no friend data. Copyright: classroom and personal use |
| [11] Reddit code | full text | GitHub, commit 753b17407e9a9dca09558526805922de24133d53 | a2447de79fd7 (the file) | 6/6 | |
| [12] Shirriff | full text | righto.com page | 3a7ce7dac0c1 (page.html) | 5/5 | The formula is an image; read from its alt text |
| [13] Meng | full text | arXiv v1 | f07580de388a | 7/7 | Table 3 not readable in the text |
| [14] Ji | full text | arXiv 2010.11060v4 | e10a1ebfbccc | all real quotes found | Preprint, not the TOIS copy. No feature-leakage case |
| [15] Krichene | full text (all 10 pages) | ACM open-access PDF saved by the author in refs-manual/15.pdf (KDD '20 version) | 5212f092b6ae | 6/6 | Replaces the abstract-only extract of the first pass. Tables 2 and 3 are garbled in the text |
| [16] Cañamares | abstract only | Semantic Scholar abstract (UAM repository 403) | none | 3/3 | |
| [17] Ge | full text | Jannach's university page | 92cfd8b1f440 | 9/9 | No experiments in the paper |
| [18] McSherry | full text | Microsoft Research PDF | 1c72e054f2c3 | 13/13 | |
| [23] Anagnostopoulos | index record | Crossref, OpenAlex | none | 0 | No legal copy found |
| [24] Chaney | full text | arXiv v2 | 3965bdb1e39d | 5/5 | |
| [25] Ferrari Dacrema | full text | arXiv v3 | 772fd88ba7ae | 8/8 | |

Not yet read: [19] to [22], [26], [27] (skim in Step 22), and the recent-work search.
Needs full text from the author (save in `refs-manual/`): [1], [2], [8], [9], [16], [23]. [15] arrived on 2026-10-24.
