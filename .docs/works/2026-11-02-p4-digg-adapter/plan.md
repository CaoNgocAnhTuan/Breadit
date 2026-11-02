# Plan: Digg 2009 adapter to the canonical format

Status: approved · 2026-11-02
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-02-p4-digg-adapter/`

---

## How to read this plan

- **New code in `eval/` only**, plus one changed check (`eval/src/checks/run.ts`) and `eval/package.json`. Do not touch `apps/`, `packages/`, the Prisma schema, `docs/`, `Latex/`, `.env`, `.claude/` or anything under `datasets/` (read only).
- **Needs:** the pinned Node (`source ~/.nvm/nvm.sh`, then `nvm use` in the repo root; `node -v` must print the `.nvmrc` version), and the two zips in `datasets/raw/digg2009/` for Step 7 only. The system `zip` (`/usr/bin/zip`) for the test fixtures. No Docker and no network.
- **Who does what.** Sonnet does Steps 1 to 7. Claude does "Claude's part" and the Acceptance. Sonnet does not edit `.docs/super-plan.md`, `.docs/datasets.md`, `CLAUDE.md` or `design.md`.
- **Rules for every step.**
  - Tests first: write the test, run it, see it fail for the right reason, then write the code.
  - Follow `.claude/rules/determinism.md` (no clock, no `Math.random`, every `.sort` with a compare function). The eval grep test must stay green.
  - No new dependency. Use only `node:` modules (`zlib`, `crypto`, `fs`, `path`, `test`, `assert`).
  - Never extract a zip member to disk, in code or by hand. Test fixtures are tiny files made from text written by the test or committed beside it.
  - Never change a Digg choice to make DW4 or DW5 pass (design F6). If a number differs, find the rule that differs and report.
  - If a step cannot be done as written, stop and report what and why. Do not work around it.
- **Commits** go on `test-app` and are never pushed. One commit per step, holding its own files and this `plan.md` (the ticks). Stage files by path; never stage `docs/supervisor-note.md`, `refs-manual/`, `datasets/` or `eval/data/`. End every commit message with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Approving this plan approves the commits listed.
- Effort scale: XS under 30 minutes, S under 2 hours, M half a day.

## Steps

#### Step 1: Source config (effort XS)

- [x] Tests first (TC1): `loadDiggConfig()` returns both zips. A test reads the zip table of `.docs/datasets.md` §4 and checks that each zip's capture URL, SHA-256, member name and member size equal the config. It also checks that the password equals the one quoted in §4.
- [x] Write `eval/config/digg2009.json` and `loadDiggConfig()` in `eval/src/adapters/digg.ts` (design: Approach "One config file for the source", Code files). Choices: `dropZeroDateLinks: true`, `addMutualReverse: false`, `idSource: "digg"`, `joinedAt: "firstAppearance"` (Spec Open questions 1, 2, 4, 5).
- [x] Commit: `feat: eval digg2009 source config checked against datasets.md`

#### Step 2: Zip reader (effort S)

- [x] Make the fixture once: a short text file (a few lines, written by you and committed as `eval/src/adapters/fixtures/tiny.txt`) zipped with the system `zip -P <a test password>` into `eval/src/adapters/fixtures/tiny.zip`. Record the exact command in a comment at the top of `zip.test.ts`. The system `zip` sets flag bits 0 and 3 (flag 9) and method 8; the test also builds a copy of the fixture with bit 3 cleared and the CRC check byte, so both check-byte rules of design Approach step 3 are covered.
- [x] Tests first (TC2): the right password gives exactly `tiny.txt`; a wrong password stops with "wrong password"; a copy with one byte of the compressed data changed stops on the CRC-32 or size check; a zip with two members, method 0 or zip64 sizes stops as unsupported (build these small buffers in the test).
- [x] Write `eval/src/adapters/zip.ts` with `readEncryptedMember` (design: Approach "Read the zips in memory", F2, F3).
- [x] Commit: `feat: eval in-memory ZipCrypto zip reader`

#### Step 3: Strict parser (effort S)

- [x] Tests first (TC3): `parseVotes` and `parseFriends` on small buffers with CR, LF and CR LF line ends, one empty last line, and quoted values. Each bad case stops with the line number: a missing quote, an extra field, a missing field, a non-digit, a negative sign, an empty field.
- [x] Write `eval/src/adapters/digg-parse.ts` (design: Approach "Parse strictly", F4). Rows go into typed arrays.
- [x] Commit: `feat: eval strict Digg CSV parser`

#### Step 4: Transform (effort S)

- [x] Tests first (TC4), on hand-made rows:
  - **Votes:** a repeated pair keeps its earliest vote; author and `created_at` come from the first vote, with a time tie going to the smaller voter id; the author's vote is not an interaction; `event_id` is 1-based in `(t, voter_id, story_id)` order; every interaction is a `like`.
  - **Links:** date 0 and self-links are dropped; a repeated pair keeps its earliest date; a `mutual` = 1 row adds no reverse link.
  - **Users:** voters plus ids in kept links; `joined_at` is the earliest first appearance (a vote, or a kept link on either side).
  - **Communities:** header-only tables.
  - **Counts:** the counts table holds every rule's dropped rows.
- [x] Write `toCanonical` in `eval/src/adapters/digg.ts` (design: Approach, the five rules).
- [x] Commit: `feat: eval Digg to canonical transform (P2 choices)`

#### Step 5: Adapter and command (effort S)

- [x] Tests first (TC5): `adaptDigg` with a test config and two tiny fixture zips (made in the test folder with `zip -P` from text written by the test, or committed beside `tiny.zip`):
  - it writes the six files and a manifest with `datasetId` `digg2009`, `source.kind` `digg`, both zips (URL, capture time, SHA-256, member), the choices, the counts, and the Unix epoch;
  - two runs into two folders give byte-identical files;
  - a SHA-256 mismatch stops before any read, and leaves an existing output folder untouched (DW1);
  - a stale file in the output folder is gone after a run;
  - an out dir outside the given path is refused.
- [x] Write `adaptDigg` and `eval/src/cli/adapt-digg.ts` (calls `checkNode()` first; prints the counts and the manifest SHA-256). Add the `adapt:digg` script and `--max-old-space-size=4096` on `adapt:digg` and `check` in `eval/package.json` (design F5, Code files).
- [x] Commit: `feat: eval adapt:digg command`

#### Step 6: Bucket table for Digg in `check` (effort XS)

- [x] Tests first (TC6): in `run.test.ts`, a Digg-shaped fixture folder (`source.kind` `digg`, Unix epoch) gets the format check and a bucket table, and no calibration or lift. `syn-W2M-M` still gets its table.
- [x] Change `checkAll` in `eval/src/checks/run.ts` (design: Approach "`check`").
- [x] Commit: `feat: eval check runs the bucket table for digg2009`

#### Step 7: Run on the real zips (effort M)

- [x] Run `adapt:digg` on `datasets/raw/digg2009/`. Compare its counts with DW4. Note the run time and peak memory if easy (not Class D).
- [x] Run `check` on `eval/data`. Format must pass for all nine folders (DW3). Compare the `digg2009` bucket table with blueprint §3.7 at `q` = 0.8, row by row (DW5). If a number differs, follow design F6 and stop and report; do not commit a mismatch.
- [x] Run `adapt:digg` a second time into a folder outside the repo and compare every file (DW2).
- [x] DW1 on the real case: copy one zip outside the repo, change one byte, point the adapter at that copy, and check that it stops and writes nothing. Delete the copy.
- [x] List what the adapter wrote and check `git status` (DW7).
- [x] Save the `digg2009` part of the `check` output, the counts table, the manifest SHA-256, the double-run result and the DW1 message as `check_output.txt` in this task folder.
- [x] Commit: `chore: P4 digg2009 adapted and checked`

## Claude's part

- [ ] Read the commits and the diff against the design.
- [ ] `bash .claude/hooks/verify.sh` with db and redis up (DW8).
- [ ] Docs:
  - **`.docs/super-plan.md`:** the P4 sentence of Spec Open question 3 ("uses a link only when it is dated before the test time of the item (`AsOf`)"), a P4 status paragraph, the §4 status row (P4 ✅ if DW1–DW9 pass, with `p4-digg-adapter` ✅), and a change-log line.
  - **`.docs/datasets.md` §4:** one line saying the zips are now kept in `datasets/raw/digg2009/` (git-ignored).
  - **`CLAUDE.md`:** the eval line names `adapt:digg`.
  - Commit: `docs: close p4-digg-adapter`.
- [ ] Fill in the Result, then close the task.

## Tests

All tests are unit tests in `eval/src/**/*.test.ts` under `node --test` and the pinned Node. None needs the real zips, Docker or the network. The real-zip checks are Acceptance items.

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW6 | unit | Config equals `.docs/datasets.md` §4 (URLs, SHA-256, members, sizes, password) |
| TC2 | DW7, design F2, F3 | unit | Zip reader: right and wrong password, CRC check, unsupported shapes, against a `zip -P` fixture |
| TC3 | DW3, design F4 | unit | Strict parser: line ends, quotes, every bad-line case with its line number |
| TC4 | DW4, DW5 | unit | The P2 rules of the transform, users and `joined_at`, the counts |
| TC5 | DW1, DW2, DW6, DW7 | unit | `adaptDigg`: files and manifest, double run, SHA mismatch writes nothing, stale files, out-dir guard |
| TC6 | DW5 | unit | `check` runs the bucket table for a Digg-shaped folder, and no calibration |

## Acceptance

- [ ] A one-byte-changed copy of a zip → the adapter stops before reading, names both hashes, and writes nothing (DW1)
- [ ] Two `adapt:digg` runs into two empty folders → identical manifests and CSV files (DW2)
- [ ] `check` on `eval/data` → format passes for `digg2009` and the eight synthetic datasets (DW3)
- [ ] The counts table → 3,018,197 vote rows, 7,299 repeats dropped, 3,553 stories, 3,007,345 positives; 1,731,658 link rows, 1,670 date-0 and 5 self-links dropped, 1,729,983 follows (DW4)
- [ ] The `digg2009` bucket table at `q` = 0.8 → equals blueprint §3.7: T = 1246068297, 68,120 test users, every row (bucket 0–4: 22,028 / 20,644 / 1,384 / 9,400) (DW5)
- [ ] `eval/data/digg2009/manifest.json` → `datasetId`, both zips with URL and SHA-256, the choices, Unix epoch, the pinned `node` (DW6)
- [ ] Files written and `git status` → only `eval/data/digg2009/`; nothing extracted; `datasets/` unchanged (DW7)
- [ ] `bash .claude/hooks/verify.sh` with db and redis up → every check passes (DW8)
- [ ] `git diff --stat` of the task commits → only the files listed in DW9 (DW9)

## Result
