# Triage of the first run

The output is in `first-run.txt` (`npm run thesis:check`, with the build). Result: 6 PASS, 0 WARN, 1 FAIL. The one FAIL is check 4 (overlap with the paper extracts), listed below for the author. Nothing in the chapters or the drafts was changed to fix a finding. The only change to the thesis files is the `% §10 [n]` comment on each of the 44 `\item` lines of `references.tex` (the PDF text is the same, 97 pages).

## Check 1: numbers

127 candidates: 76 in the chapters and 51 in the slides.

- **A typed result that has a macro: 0.** Nothing was replaced, in the chapters or in the drafts.
- **A typed result with no macro: 0.** Nothing is left for the author.
- **Allowed with a reason: 127 candidates, 83 lines of `scripts/thesis-check/allow-numbers.tsv`.** One line covers every line of the file that has the same number and the same context words.

| Reason type | Lines |
|---|---|
| Layout: figure and column widths, legend places, tikz coordinates, table row spacing, float settings | 53 |
| A number quoted from a cited paper or source (Wu et al. 2019, Meng et al. 2020, Ji et al. 2023, the Hacker News formula) | 8 |
| The level of the confidence interval (95\%) | 7 |
| A weight of the BL2 formula (0.25) | 3 |
| A bound of a tuning grid | 3 |
| A parameter of a synthetic world (0.5, 0.7) | 3 |
| A version (the super-plan change log version 0.25, the pgfplots compat version 1.18) | 2 |
| The significance level 0.05 | 2 |
| The 80\% share of the temporal split | 2 |

The check does not look at integers (design: counts, years, K and settings are integers). A typed integer result is not found by it.

## Check 2: citations

44 keys used, 44 defined, 44 verified (the plan and the design say 45; see `section10-links.md`). The 26 INFO lines in `first-run.txt` are the sentences that cite an item whose §10 note says "do not cite a finding". They are for one reading by the author; none is a finding.

## Check 4: overlap

Against the 15 pre-thesis LaTeX files, the 29 pre-thesis Markdown files and the 22 extracts, runs of 8 words or more.

| Chapter | Pre-thesis (WARN) | Extracts (FAIL) | Extracts in a quotation with a citation (INFO) |
|---|---|---|---|
| abstract, acknowledgement, appendix, conclusion, discussion, experiments-and-results, implementation, introduction, methodology, system-analysis-and-design, test-cases-and-demonstration | 0 | 0 | 0 |
| literature-review | 0 | 8 matches, 77 words | 0 |

No chapter shares 8 words in a row with the pre-thesis text. (At 4 words in a row the same code finds 95 matches, so the code does work; the pre-thesis text was rewritten.)

The 8 FAILs, all in `chapters/literature-review.tex`. The extracts are the author's own notes from the p1 literature task: most lines are a summary of the paper (not a quote), so the matches are the author's words used twice, not text copied from a paper. Only the match at line 26 holds words of a paper (the extract quotes them).

| Line | Words | Source | First words | Reading |
|---|---|---|---|---|
| 24 | 8 | `extracts/01.md:9` | reports findings from positive and negative experiences and | The extract line is the author's summary of the abstract of Tang et al. The chapter says "Its abstract adds that it reports findings ..." |
| 26 | 9 | `extracts/02.md:9` | a factor analysis approach based on probabilistic matrix factorization | The extract puts these words in quotation marks: they are from the abstract of SoRec. The chapter writes them without quotation marks ("By its abstract, it is ..."). Needs the author: add quotation marks or reword. |
| 47 | 11 | `extracts/12.md:13` | score votes 1 0 8 age in hours 2 1 8 | The Hacker News formula in LaTeX. The extract writes the same formula in plain text. Both come from the cited source; no action. |
| 50 | 9 | `extracts/12.md:24` | penalty system is more complex than the published code | The extract line is the author's own reading ("The author's own reading ... says ..."). The chapter repeats it and cites Shirriff. |
| 54 | 8 | `extracts/05.md:8` | the destination user in the future it is | The extract line is the author's summary of RealGraph. The chapter repeats the definition of the weight. |
| 74 | 9 | `extracts/15.md:45` | can disagree with the exact metrics even on average | The extract line is the author's own words ("In words: ..."). The chapter repeats them for Krichene and Rendle. |
| 76 | 10 | `extracts/17.md:13` | the share of available items that the system ever recommends | The extract line is the author's summary; the quotation of the paper is on the same line, in other words. |
| 76 | 13 | `extracts/18.md:12` | when scores are tied the order of the tied results can change | The extract line is the author's summary of McSherry and Najork. |

The check cannot tell the author's own earlier note from a copy of a paper. Only the 02.md match is a quotation of a paper. For the others, the author decides whether the chapter sentence is close enough to the paper to need quotation marks or a rewrite.

No overlap text was changed in this task.
