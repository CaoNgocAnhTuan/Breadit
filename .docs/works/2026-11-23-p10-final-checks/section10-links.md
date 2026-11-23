# The links of references.tex to section 10 of the super-plan

Each `\item` of `.docs/Thesis-Report/chapters/references.tex` now ends with `% §10 [n]` (a comment, so the PDF is the same). Each pair was matched by authors, year and title, then checked by a script: the first `\url` of the entry is in the §10 item and the year is the same (43 of 44 also by the first author's name; the 44th, `canamares2020`, differs only by the accent `ñ` written `{\~n}`).

There are 44 pairs, not 45 as the plan and the design say. A grep for `\item` gives 45 because it also matches the text `\item\label{ref:<key>}` in the comment on line 3 of the file; the file has 44 real items (lines 8 to 51). §10 items 19, 26 and 45 to 48 have no entry (they are not cited).

| Line | Key | §10 | Item | Status |
|---|---|---|---|---|
| 8 | `cestnik1990` | [28] | Cestnik (1990) | verified (record only; no full text f... |
| 9 | `castellano2020` | [29] | Castellano, Moral-García, Mantas, Abellán (2020) | verified |
| 10 | `kamath2014` | [5] | Kamath, Sharma, Wang, Yin (2014) | verified |
| 11 | `twitter2023` | [7] | Twitter Engineering (2023) | verified (read in full through an Int... |
| 12 | `reddit-hot` | [11] | Reddit (archived) | verified |
| 13 | `shirriff2013` | [12] | Shirriff (2013) | verified |
| 14 | `ferraridacrema2019` | [25] | Ferrari Dacrema, Cremonesi, Jannach (2019) | verified |
| 15 | `lerman-digg` | [20] | Lerman | verified |
| 16 | `lerman-digg-archive` | [49] | Lerman | verified (archive copy opened 2026-10... |
| 17 | `hogg2012` | [50] | Hogg, Lerman (2012) | verified (Crossref record read 2026-1... |
| 18 | `meng2020` | [13] | Meng, McCreadie, Macdonald, Ounis (2020) | verified |
| 19 | `ji2023` | [14] | Ji, Sun, Zhang, Li (2023) | verified |
| 20 | `krichene2020` | [15] | Krichene, Rendle (2020) | verified |
| 21 | `canamares2020` | [16] | Cañamares, Castells (2020) | verified (record and abstract; the co... |
| 22 | `ge2010` | [17] | Ge, Delgado-Battenfeld, Jannach (2010) | verified |
| 23 | `mcsherry2008` | [18] | McSherry, Najork (2008) | verified |
| 24 | `smucker2007` | [21] | Smucker, Allan, Carterette (2007) | verified |
| 25 | `holm1979` | [22] | Holm (1979) | verified |
| 26 | `sandve2013` | [27] | Sandve et al | verified |
| 27 | `anagnostopoulos2008` | [23] | Anagnostopoulos, Kumar, Mahdian (2008) | verified (Crossref record; no full te... |
| 28 | `chaney2018` | [24] | Chaney, Stewart, Engelhardt (2018) | verified |
| 29 | `tang2013` | [1] | Tang, Hu, Liu (2013) | verified |
| 30 | `ma2008` | [2] | Ma, Yang, Lyu, King (2008) | verified |
| 31 | `wu2019` | [3] | Wu et al | verified |
| 32 | `sharma2024` | [4] | Sharma et al | verified |
| 33 | `twitter-code2023` | [6] | Twitter (2023) | verified |
| 34 | `jamali2010` | [8] | Jamali, Ester (2010) | verified |
| 35 | `sedhain2014` | [9] | Sedhain, Sanner, Braziunas, Xie, Christensen (2014) | verified |
| 36 | `chen2009` | [10] | Chen et al | verified |
| 37 | `xai-x-algorithm` | [30] | xai-org (2026) | verified (README read, commit 6258a15... |
| 38 | `jaspal2025` | [31] | Jaspal, Dalwani, Ramineni (2025) | verified (abstract only; do not cite ... |
| 39 | `weyl2025` | [32] | Weyl et al | verified (abstract only; do not cite ... |
| 40 | `zhou2024` | [33] | Zhou, Li, Jiang, Zhang (2024) | verified (journal page, abstract only... |
| 41 | `jiang2025` | [34] | Jiang, Yang, Lin (2025) | verified (abstract only; do not cite ... |
| 42 | `dadgar2022` | [35] | Dadgar, Hamzeh (2022) | verified (abstract only; do not cite ... |
| 43 | `akpinar2025` | [36] | Akpinar, Fazelpour (2025) | verified (abstract only; do not cite ... |
| 44 | `stefanopoulos2025` | [37] | Stefanopoulos, Chatterjee, Zehmakan (2025) | verified (abstract only; do not cite ... |
| 45 | `lee2022` | [38] | Lee, Zhou, Yang, Du, Pan (2022) | verified (abstract only; do not cite ... |
| 46 | `cinus2023` | [39] | Cinus, Gionis, Bonchi (2023) | verified (abstract only; do not cite ... |
| 47 | `chen2026` | [40] | Chen et al | verified (abstract only; do not cite ... |
| 48 | `milli2025` | [41] | Milli, Carroll, Wang, Pandey, Zhao, Dragan (2025) | verified (abstract only; do not cite ... |
| 49 | `gauthier2026` | [42] | Gauthier, Hodler, Widmer, Zhuravskaya (2026) | verified (abstract only; do not cite ... |
| 50 | `satuluri2020` | [43] | Satuluri et al | verified (abstract only; do not cite ... |
| 51 | `elkishky2022` | [44] | El-Kishky et al | verified (abstract only; do not cite ... |
