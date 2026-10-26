# Plan: P1 dataset selection

Status: approved · 2026-10-26
Design: [design.md](design.md) · Folder: `.docs/works/2026-10-26-p1-dataset-selection/`

---

## How to read this plan

- This task has no app code. Docker, the backend and the database are not used. It needs the network, the WebFetch and WebSearch tools (load them with ToolSearch), `curl`, `gunzip`, `shasum` and `git`. Run every command from the repo root.
- **Rules from the design that apply to every step.**
  - Pass levels and the decision rule are written into `.docs/datasets.md` and committed **before** any candidate is judged (Design: F13).
  - Every cell has a source and a date. A fact that was not found is "not checked", never blank. A search snippet is marked "search only" (F11, F12).
  - No downloaded file goes into git. Each sample goes into its own new, empty folder in the scratchpad. The script that reads it lives in another folder. Run Python with `-I`. Read files as text only (F8).
  - The sample is the first N lines of a file. Use it for formats, value types and id ranges only. No skew or mean comes from it (F3). Write N in the evidence. Drop an incomplete last line (F7).
  - A frozen value (super-plan §7) is never changed. Proposals go into `datasets.md`, not into the super-plan (Design: Open question 7).
  - Papers are scanned for the idea only. Do not chase full texts.
- **Answers of the author to the open questions of the design (2026-10-26).** Write them into `datasets.md` as decided, with this date.
  - **Q1.** Real data becomes co-primary for RQ1 and the follow term, but only if Step 4 shows the follow graph and the favorites can be used together. Synthetic keeps W0, the influence sweep and the community term. If Step 4 fails, the proposal does not apply and the plan stays as it is. This is written as a proposal to change super-plan §1, P3, P4 and §8, not applied here.
  - **Q2.** The community term is tested on synthetic data only. `datasets.md` says this plainly as a limit (design F14). Even if the id join is "likely", it is not used before P4 proves it.
  - **Q3 and Q6.** The order of events is the time axis. If the link dates and the favorite order cannot be aligned, criterion 1 is "partial", the follow graph is treated as fixed, and the leak is stated as a limitation. On real data, the window W is replaced by "the N_max newest posts in order", and the age term of BL2 needs another definition, proposed in `datasets.md`. No frozen value is changed here. The author changes them.
  - **Q4.** A favorite is a like and the only positive on real data. The total comment count in the photo file is not used, because it contains events after the test time (leakage).
  - **Q5.** Use the data, cite the paper, keep raw files out of git. `datasets.md` copies the exact words of the pages and does not say "allowed". The question about the missing license goes into the note for the supervisor (`p1-supervisor-note`).
  - **Q7.** This task edits only super-plan §10 and adds change-log line 0.8. All other changes are proposals in `datasets.md`, applied only when the author says so, in a separate step with its own change-log line.
- **Commits** go on `test-app` and are never pushed. A step's commit holds its own files and this `plan.md` (the ticks). Approving this plan approves the five commits listed.
- Effort scale: XS under 30 minutes, S under 2 hours.

## Steps

### Step 1: Skeleton with the rules first (effort XS)

- [x] Test first: run TC1 to TC4 before `.docs/datasets.md` exists. They fail because the file is missing.
- [x] Change: create `.docs/datasets.md` (Design: Code files). Sections in this order: Decision (empty for now, marked "pending"), Rules (the pass/partial/fail table and the decision rule, copied from Design: Approach, Step A), Candidate table (header only), File evidence, What it can and cannot test, Calibration targets, Proposed changes to the plan, Sources.
- [x] Verify: TC1 to TC4 still fail for the right reason (the sections are empty), and the Rules section is complete.
- [x] Commit: `docs: datasets.md skeleton with pass levels and decision rule`

### Step 2: Web check of the four candidates (effort S)

- [x] Fill one row per candidate: Digg 2009, Epinions and Ciao, Flickr (WWW 2009 links and favorites, IMC 2007 groups), Weibo sets. Start from the table in the Spec, and fill every gap in it (Design: Approach, Step B).
- [x] Open the Digg download link and say if it works. For Epinions and Ciao, retry the MSU page, and use the Internet Archive copy if the host is still down (F1). For Weibo, open each set found (Weiboscope, the IEEE DataPort rumor set, the cascade sets) and record only what its own page says.
- [x] Each cell gets the page URL, the date opened, and one of "page opened" or "search only". Copy the exact words of the license or terms line (F9). If two sources give different numbers, write both (F10).
- [x] Add at most two extra candidates, only if all four listed ones fail criterion 1 or 2 after this step, and at most three searches each (F12).
- [x] Verify: TC1 passes. No cell is blank.
- [x] Commit: `docs: datasets.md candidate table with sources`

### Step 3: Liveness of the leading candidate's files (effort XS)

- [ ] For each file of the leading candidate (expected: the four Flickr WWW 2009 and IMC 2007 files), send a HEAD request. Record status, size and `Last-Modified` in the File evidence section (Design: Approach, Step C.4).
- [ ] A status other than 200, or an HTML page instead of gzip, makes criterion 4 "fail" for that file (F2). A `Last-Modified` before 2012-01-02 on a favorites or photos file means that file is not used (F6).
- [ ] If the leading candidate fails here, go back to the decision rule and take the next candidate. Repeat this step for it.
- [ ] Commit: none. The result goes into the commit of Step 4.

### Step 4: Small sample of the leading candidate (effort S)

- [ ] Stream the first N lines (N fixed once, the same for every file) of each file into its own scratchpad folder. Do not save the full file. Write the script that prints the columns, the value types and the min and max of each id column in a different folder.
- [ ] Answer the three questions of Design: Approach, Step C and write each answer, with the sample line count and the SHA-256 of the sample file, in File evidence:
  1. Columns and separators, and whether a "date" is a real date or an integer.
  2. **Time axes (F4).** Can the link dates and the favorite times be put on one axis? Check the type of the photo upload time too. The answer is yes, no or unknown, with the reason.
  3. **Id rules and join (F5).** Is the photo owner an id from the links file (range check)? Compare the Flickr groups ids with the WWW 2009 ids. The answer is "no", "likely" or "unknown", never "joins".
- [ ] If a gzip stream breaks twice, write "not opened" for that file (F7).
- [ ] Commit: `docs: datasets.md file evidence from small samples`

### Step 5: Decision, tests, targets, proposals (effort S)

- [ ] Fill the Decision section by applying the rules of Step 1 to the evidence of Steps 2 to 4. Name the criterion that decided it. If no candidate has at least "partial" on criteria 1 and 2, write exactly "no candidate passes criteria 1 and 2" (DW2).
- [ ] Fill "What it can and cannot test": H1, H2, follow term, author term, community term, cold-start buckets. Each is testable, partly testable or not testable, with the reason. Say that influence cannot be tested on observational data, as in D6 of `.docs/literature.md` (DW3, F14).
- [ ] Fill the Calibration targets (Design: Approach, Step D): numbers printed on the dataset page or in the dataset paper, each with its source. A mean from two printed totals says "mean over all users". Skew, follower and followee distributions and the share of users with 0 to 4 earlier positives say "not computed, P4 computes them" (DW4).
- [ ] Fill "Proposed changes to the plan": the conditional co-primary proposal (Q1), the time-axis rule (Q3 and Q6), the community term on real data (Q2), favorite = like (Q4), the license words and who must confirm (Q5). Each proposal says which super-plan section it would change. Nothing is changed in the super-plan here.
- [ ] Commit: `docs: datasets.md decision, targets and proposed changes`

### Step 6: Super-plan references and literature notes (effort XS)

- [ ] In `.docs/super-plan.md` §10, add the datasets we used as references 45 and up (the dataset page, and the paper for each). "Verified" only for pages we opened. Add the change-log line 0.8. Do not change phase text, §1, §5 or §7 (Design: Code files, Open question 7).
- [ ] In `.docs/literature.md`, replace "does not exist yet" in the entries [19] and [20] and in D6 with a pointer to `datasets.md`. Add an entry only for a dataset paper that we cite.
- [ ] Verify: TC5 to TC7 pass.
- [ ] Commit: `docs: add datasets to super-plan references, update literature notes`

## Tests

All checks are on documents, so they are read or grep checks. Write each as a short check before the text it tests.

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW1 | doc check | The candidate table has a row for Digg, Epinions/Ciao, Flickr and Weibo. In each row, the four criteria have a value, a URL and a date. The text "not checked" is present where a fact is missing. No empty cell. |
| TC2 | DW2 | doc check | The Decision section names one dataset, or has the exact sentence "no candidate passes criteria 1 and 2". It names the deciding criterion. |
| TC3 | DW3 | doc check | H1, H2, follow term, author term and community term each have one of the three words (testable, partly testable, not testable) and a reason. |
| TC4 | DW4 | doc check | Each calibration target has a number or "not computed", the way it was computed, and the file or page it came from. |
| TC5 | DW5 | grep | `grep -n "datasets.md"` in `.docs/literature.md`: [19], [20] and D6 no longer say the file "does not exist yet", or they are listed as a follow-up for the author in `datasets.md`. |
| TC6 | DW6 | doc check | Super-plan §10 lists each dataset we used. A "verified" mark exists only where a source was opened (check with the "page opened" column of the table). |
| TC7 | DW7 | git | `git status` and `git diff --stat` after the last commit: only `.docs/datasets.md`, `.docs/super-plan.md` (§10 and change log), `.docs/literature.md` and this task folder changed. Nothing in `apps/`, `packages/`, `docs/`, `Latex/`. No raw data file is tracked. |
| TC8 | DW8 | doc check | The Result below lists the files opened, the number of lines read from each, and the SHA-256 of each sample. |

## Acceptance

- [ ] Read `.docs/datasets.md` from the top → the decision comes first, in a few lines, and is easy to understand in simple English (DW2).
- [ ] The Rules section has an earlier commit than the candidate table → `git log` shows the skeleton commit first (F13).
- [ ] Each of the author's answers to questions 1 to 7 (top of this plan) appears in `datasets.md` as decided, with its date → none is silently dropped, and none is turned into a change of the super-plan.
- [ ] The time-axis answer (F4) and the id-join answer (F5) are written with the evidence and the sample size → they are "yes / no / unknown" and "no / likely / unknown", not "ok" or "joins".
- [ ] The license words are copied exactly, with the date → no sentence says the data is "allowed".
- [ ] `git status` is clean except for `refs-manual/` → no scratchpad file, no raw data in the repo.
- [ ] `datasets.md` is about 200 lines and has no word a reader at upper-intermediate level would not know without a one-sentence explanation.

## Result

<!-- Claude fills this in at the end: what was done, test counts, commits, and anything that differed from the plan (and why). -->
