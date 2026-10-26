# Plan: P1 Digg archive check and plan proposals

Status: approved · 2026-10-27
Design: [design.md](design.md) · Folder: `.docs/works/2026-10-27-p1-digg-archive-check/`

---

## How to read this plan

- This task has no app code. Docker, the backend and the database are not used. It needs the network, `curl`, `shasum`, `python3` and `git`. Run every command from the repo root.
- **Two runs.** Stage 1 (Steps 1 to 6) is one Sonnet run that ends at the STOP in Step 6. Stage 2 (Steps 7 to 11) is a second, short run that starts only after the author has decided. Stage 2 boxes stay open until then.
- **Rules from the design that apply to every step.**
  - The three new rules (date spread 50%, author known 80% and 20%, ties 10%) are committed in `.docs/datasets.md` §2 **before** any Digg file is opened (Design: Approach, step A, F13).
  - The Internet Archive may answer 429 or 403. One request at a time. Wait for `Retry-After`, or 60, 120, 300 seconds. After three tries stop and write "not opened". Do not look for another host or a mirror (F1).
  - The zips are untrusted data. Keep them in their own new, empty folder in the scratchpad. The script lives in the task folder. Read members as text through `zipfile`, extract nothing, run Python with `-I` (F5).
  - The scratchpad is `/private/tmp/claude-502/-Users-hung-Desktop-Breadit/dbae39ae-9426-486a-b125-37e0e1436fde/scratchpad/`.
  - No raw data and no zip goes into git (F17). UTC only for days (F11).
  - Stage 1 does not touch `.docs/super-plan.md` or `.docs/literature.md`. A frozen value (super-plan §7) is never changed, and a row marked "freeze at P3/P5" never gets a number (F15).
  - Papers are scanned for the idea only. Do not chase full texts.
- **Author's answers to the open questions (2026-10-27).** All proposals of the design are accepted:
  1. An Internet Archive copy is an accepted source. Record the archive URL, the capture time and the SHA-256, cite Hogg and Lerman (2012), and say the original host is gone.
  2. If Digg wins by the rule, choose Digg and write the pool limit (small, one month, only front-page stories). Flickr stays in the table.
  3. Download both whole zips (37.6 MB) into the scratchpad.
  4. Stage 2 edits the super-plan only after the checkpoint, only what the author chooses, with change-log line 0.9.
  5. The first run stops at Step 6.
  6. Stage 2 updates references [49] and [50] in super-plan §10.
  7. P-D is applied as naming the targets only. No number is copied.
  8. The thresholds stay: 50%, 80% and 20%, and 10% for ties.
- **Commits** go on `test-app` and are never pushed. A step's commit holds its own files and this `plan.md` (the ticks). The first commit also adds the task folder (`design.md`, `plan.md`). End every commit message with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Approving this plan approves the commits listed.
- Effort scale: XS under 30 minutes, S under 2 hours.

## Steps

### Stage 1: evidence and decision

#### Step 1: Rules first (effort XS)

- [x] Test first: run TC1 before the change. It fails because `.docs/datasets.md` §2 has no rule for date spread, author known or ties.
- [x] Change: add the three rules to `.docs/datasets.md` §2 (Design: Approach, step A). Say that the numbers are our own choice, not from a source, and that they were written before the Digg files were opened.
- [x] Verify: TC1 passes. `git diff` shows only §2 changed.
- [x] Commit: `docs: datasets.md rules for date spread, author known and ties` (also adds `design.md` and `plan.md`)

#### Step 2: Fetch and check the two zips (effort S)

- [x] Ask the Internet Archive index (CDX) for the capture time and byte length of `digg_votes.zip` and `digg_friends.zip` under `isi.edu/~lerman/downloads/`. Fetch each capture in the raw `id_` form, one request at a time (Design: Approach, step B).
- [x] Check each file: size against the index (F3), the first two bytes `PK` (F2), the zip test (F4), the member list with sizes (F5). Record the SHA-256 of each zip.
- [x] If a zip cannot be fetched or opened after the retries of the rules above, write "not opened: <reason>, <date>" and go to Step 5 with the decision unchanged. Skip Steps 3 and 4 for the missing zip. Do not look for another source.
- [x] Commit: none. The result goes into the commit of Step 5.

#### Step 3: The script, with a fixture check first (effort S)

- [x] Test first (TC2): write `check_digg_stats.py` in the task folder. It builds a tiny fixture of both zips with `zipfile` in a temporary folder (a few votes, a tie at a first vote, links on two days and on one day, a mutual link, a duplicate pair, a self-link, a voter not in the friend table). It holds the expected numbers written by hand. Run it before the script exists: it fails.
- [x] Change: write `digg_stats.py` in the task folder (Design: Code files). Standard library only, run with `-I`, two zip paths as arguments, reads members as text, extracts nothing, writes no file. It prints the five groups of Design: Approach, step D.
- [x] Verify: TC2 passes on the fixture. The script stops with a clear message on a member that is too large, a missing column, or a non-integer id (F5, F6).
- [x] Commit: `docs: digg_stats.py with a fixture check`

#### Step 4: Run on the real zips (effort XS)

- [x] Run `digg_stats.py` on the two zips. Keep the output text. Print the first rows of each member too, to show the real columns (F6).
- [x] Compare the counts with the page numbers: 3,018,197 votes, 3,553 stories, 139,409 voters, 1,731,658 links, 71,367 users. Every difference is listed with a reason or "not explained".
- [x] Commit: none. The result goes into the commit of Step 5.

#### Step 5: Update `datasets.md` (effort S)

- [x] In `.docs/datasets.md`: the Digg row in §3, the evidence in §4 (zip URLs with capture time, sizes, SHA-256, members, the count table, the criterion 1 and 2 answers with the numbers of the Spec DW3 to DW5), what Digg can and cannot test in §5, the new targets in §6 (the rows that were "not computed" for Flickr get Digg numbers, with the file name, and the share of voters with 0 to 4 votes is marked "all votes, not cut by T"), and the pool limit (small, one month, only front-page stories).
- [x] Apply the rules of §2 to Digg and Flickr and write the §1 Decision: the winner and the deciding criterion. If a zip was "not opened", §1 stays as it is.
- [x] In §7: write the corrected P4 sentence for Digg, update P-B, P-C and P-D to the new decision, each with the super-plan section it would change, and mark P-A done. Nothing in the super-plan changes (DW8, DW9).
- [x] Verify: TC3 to TC9 pass.
- [x] Commit: `docs: datasets.md Digg archive check, evidence, targets and decision`

#### Step 6: STOP (checkpoint)

- [x] The Sonnet run ends here. It reports to Claude: the commits, the Step 2 and Step 4 results, the SHA-256 of both zips, and whether `friend_date` is a real spread and the author is known. It does not start Stage 2 and does not touch the super-plan (F14).
- [x] Claude reads the report and `datasets.md`, runs the Stage 1 checks, and reports to the author. The author answers (DW10): Digg or Flickr as the main real set, and apply or do not apply for each of P-B, P-C, P-D and the P4 sentence.

### Stage 2: apply what the author chose (second run, after Step 6)

Do only the steps the author marked "apply". Skip the others and write "not applied" in `datasets.md` §7 (F16). Edit wording only, copy no number, set no value marked "freeze at P3/P5" (F15).

#### Step 7: P-B, real data co-primary (effort S)

- [x] Test first: TC10 lists the places that may change. Run it before: the diff of the super-plan is empty.
- [x] Change: the "Data" decision at the top of `.docs/super-plan.md`, the P3 and P4 text, and §8 (the first risk and the cut order, where P4 is the first cut today). Use the decision of Step 6.
- [x] Commit: `docs: super-plan, real data as co-primary (P-B)`

#### Step 8: P-C, window W and the age term on real data (effort XS)

- [ ] Change: §5 "Candidate pool" and the BL2t lines, and the notes of the unset §7 rows "Window W / pool cap N_max" and "Baseline grids". The default for a Digg win is "do not apply", because Digg has real Unix times.
- [ ] Commit: `docs: super-plan, window and age term on real data (P-C)`

#### Step 9: P-D, names of the generator targets (effort XS)

- [x] Change: in P3, name the targets (followees per user, followers per user, activity skew, votes per user). P3 already says "calibrate to `.docs/datasets.md`". Copy no number.
- [x] Commit: `docs: super-plan, name the generator targets (P-D)`

#### Step 10: The P4 sentence (effort XS)

- [ ] Change: replace "may have no timestamps (not confirmed)" in P4 with the checked fact from Step 5.
- [ ] Commit: `docs: super-plan, correct the P4 sentence about Digg timestamps`

#### Step 11: References, version and change log (effort XS)

- [ ] Change in `.docs/super-plan.md`: references [49] and [50] in §10 say what was opened (Digg zips opened, SHA-256, archive URL), with "verified" only for what was opened. Header version 0.9. Change-log line 0.9: every applied proposal, the places it changed, and the proposals not applied. Update the P1 status paragraph for Step 2.
- [ ] In `.docs/datasets.md` §7: mark each proposal "applied" or "not applied", with the date.
- [ ] Verify: TC10 and TC11 pass.
- [ ] Commit: `docs: super-plan 0.9, references and change log for the Digg check`

## Tests

All checks are on documents or on the script, so they are read, grep or script checks. Write each before the text it tests.

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW7 (rules) | grep | `datasets.md` §2 has the date-spread rule (50%), the author rule (80% and 20%) and the tie rule (10%), and says they are our own choice. They are in a commit before any Digg evidence (`git log` order). |
| TC2 | DW2 to DW6 (script) | script | `check_digg_stats.py` builds a fixture and compares every number the script prints with the hand-written expected values, including the tie, the crawl-day case, the mutual link, the duplicate and the self-link. |
| TC3 | DW1 | doc check | The Digg part of §4 has, for both zips: archive URL, capture time, byte size, SHA-256 and member names, or "not opened" with the reason. |
| TC4 | DW2 | doc check | The count table has the page number, the counted number and the reason for each difference, for votes, stories, voters, links and users. |
| TC5 | DW3 | doc check | Criterion 1 for Digg has one of pass, partial, fail, with: direction, min and max `friend_date`, number of distinct UTC days, share on the most common day, and the shares before, inside and after the vote window. |
| TC6 | DW4, DW5 | doc check | Criterion 2 and the time axis have the numbers of the Spec: vote date range, share of stories whose first voter is in the friend table, share of voters in it, tie share, and "same clock" yes or no with both ranges. |
| TC7 | DW6 | doc check | §6 has the new Digg targets (followees, followers, votes per voter, share of votes by the top 20%, shares by number of votes), each with a number, the way it was computed and the file. |
| TC8 | DW7, DW8 | doc check | §1 names the winner and the deciding criterion by the rules of §2. §7 has the corrected P4 sentence and the updated P-B, P-C, P-D, and marks P-A done. |
| TC9 | DW9 | git | After Step 5: `git diff --stat` from the commit before Step 1 shows only `.docs/datasets.md` and this task folder. Nothing in `apps/`, `packages/`, `docs/`, `Latex/`, `.docs/super-plan.md` or `.docs/literature.md`. No zip or data file is tracked. |
| TC10 | DW11 | git | After Stage 2: the diff of `.docs/super-plan.md` touches only the sections of the proposals marked "apply" (plus §10 [49] and [50], the header version and the change log). No already-set row of §7 changed. No row marked "freeze at P3/P5" has a number. |
| TC11 | DW12 | doc check | The P4 sentence is corrected, and §1 or P4 say what the author decided. `datasets.md` §7 marks each proposal applied or not applied, with the date. Change-log line 0.9 names every applied proposal and place. |

## Acceptance

- [ ] Read `.docs/datasets.md` §1 → the winner and the deciding criterion come first, in a few lines, in simple English (DW7).
- [ ] `git log` → the commit with the three rules comes before every commit with Digg evidence (F13).
- [ ] The count table and the criterion 1 and 2 answers show real numbers from the files, not the page numbers copied (DW2 to DW5).
- [ ] The checkpoint report names the zips' SHA-256 and the winner, and lists P-B, P-C, P-D and the P4 sentence for the author (DW10).
- [ ] After Stage 2, the super-plan diff matches the list the author chose, with one commit per proposal (DW11, F14).
- [ ] `git status` is clean except for `refs-manual/` → no zip, no raw data, no scratchpad file in the repo (F17).
- [ ] The corrected P4 sentence and the change-log line 0.9 are in simple English (DW12).

## Result

<!-- Claude fills this in at the end: what was done, test counts, commits, and anything that differed from the plan (and why). -->
