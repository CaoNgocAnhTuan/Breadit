# Overlap check: compare only the quotes of the extracts

Spec status: approved · 2026-11-23
Design status: approved · 2026-11-23
Type: feature · Folder: `.docs/works/2026-11-23-p10-overlap-quotes-only/`

## 1. Spec

### Problem

Check 4 of `npm run thesis:check` (task `p10-final-checks`, `scripts/thesis-check/lib.mjs` `checkOverlap`, `check.mjs` line 168) compares the thesis chapters with the **whole text** of the 22 files in `.docs/works/2026-10-23-p1-literature/extracts/`. Those files mix two kinds of text:
- **our own notes** (the "Says:" summary, "Bibliographic check:", "Not found:", the answers in our words), written in the P1 literature task;
- **words of the paper**, always inside straight double quotes `"…"` on one line (for example `02.md` line 9: `"this paper proposes a factor analysis approach based on probabilistic matrix factorization"`).

Only the second kind is someone else's text. But the check FAILs on both. The first run (`.docs/works/2026-11-23-p10-final-checks/triage.md`) found 8 runs of 8 or more words in Chapter 2. 7 of them repeat our own note lines, and only 1 (Chapter 2 line 26, words of the SoRec abstract written without quotation marks) repeats a paper. So the command exits 1 on 7 false alarms, now and on every later run.

Evidence on the quotes (checked on 2026-11-23): 136 lines of the 22 files hold a `"`; every one has an even number of `"` (each quote opens and closes on the same line); no file uses curly quotes or code fences.

The author decided on 2026-11-23: the check compares only the quoted parts of the extracts.

### Scope

**In scope:**
- Check 4 reads only the text inside `"…"` pairs of each extract line as its extract source. Each quote is its own piece: a run of 8 words must lie inside one quote, never across two quotes or across the note text between them. The line numbers in the output stay the real line numbers of the extract file.
- The pre-thesis part of check 4 does not change (whole text, WARN).
- The rule for a match inside a quotation in the thesis with a citation (INFO) does not change.
- Tests for the new rule.
- Run the command again and record the new output in this task folder.
- `CLAUDE.md` Commands: one phrase saying the extract check reads only the quotes. The triage of `p10-final-checks` is not edited (it is a record); this task's Result says what changed.

**Out of scope:**
- Any other check.
- The 8-word length.
- Changing the extracts (they are the record of the P1 task).
- Chapter 2 line 26, unless the author says yes to Open question 1.

### Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | Unit tests | A note line that shares 8 words with the thesis gives nothing; a quote that shares 8 words gives FAIL; a run that would need two quotes on the same line (or a quote and the note text next to it) gives nothing; the line number of a match is the extract's real line |
| DW2 | The existing tests of `scripts/thesis-check/` | still pass (the pre-thesis and INFO cases unchanged) |
| DW3 | `npm run thesis:check` on today's tree | check 4 shows 0 extract matches from note lines; the match of Chapter 2 line 26 (`extracts/02.md:9`) is still found (FAIL, or INFO if Open question 1 is done); pre-thesis still 0 |
| DW4 | Two runs | the same output, byte for byte |
| DW5 | `bash .claude/hooks/verify.sh` | all checks pass |

### Open questions

1. **Chapter 2 line 26.** It is the one real case: "it is a factor analysis approach based on probabilistic matrix factorization", words of the SoRec abstract, without quotation marks. I recommend fixing it in this task by putting those words in quotation marks (``…'') with the citation that is already there, and the same in `drafts/02-literature-review.md`. Then check 4 lists it as INFO and the command exits 0. The other option is to leave it for you to reword later; the command then keeps failing on it.

## 2. Impact

**Who it affects.** The author and the later runs of `thesis:check` (rows 30 and 31 of `.docs/implementation-plan.md` §5). Without the change, check 4 fails on every run because of our own notes, and a real copy would hide among the false alarms.

**Code areas.** `scripts/thesis-check/lib.mjs` (how extract text is turned into words) and `lib.test.mjs`; maybe `check.mjs` if the sources are prepared there. No other code. `docs/Pre-thesis/` and the extracts stay read only.

**Thesis link.** P10 quality check only. No result, macro or frozen value changes. With Open question 1, one sentence of Chapter 2 gets quotation marks (no change of meaning).

## 3. Design

### Approach

The author approved the Spec without changing Open question 1, so this task also puts the SoRec words of Chapter 2 line 26 in quotation marks (the recommendation).

**A new kind of source, `md-quotes`.** In `check.mjs` (line 168) the extract sources get `kind: 'md-quotes'` instead of `'md'`. Nothing else in `check.mjs` changes. The pre-thesis sources keep `'tex'` and `'md'`.

**Pieces.** A new pure function in `scripts/thesis-check/lib.mjs`:

```js
/** The text inside each pair of straight double quotes, one piece per quote, with its real line (1-based).
 *  A line with an odd number of '"' gives no piece for its last, unclosed quote. */
export function quotePieces(text) // → { line: number, text: string }[]
```

and a helper `sourcePieces(source)` used by `checkOverlap`: for `kind: 'md-quotes'` it returns one words array per quote; for every other kind it returns one words array for the whole text, as today. For a quote, the words array is `words(lines, 'md')` of a text that has the quote on its real line (the quote text placed after `line − 1` empty lines), so `words` and `overlaps` give the real line numbers with no change to either function.

**`checkOverlap`.** Today it calls `overlaps(tw, s.w, n)` once per source. It now calls it once per piece of the source and keeps, for each thesis start offset, the longest match, as today. A run cannot cross two quotes, because each quote is its own words array (DW1). The count "n more files" counts other **files**, not other pieces of the same file: the best match per file is taken first, then the files are compared as today. The `inQuote` rule (INFO for a thesis quotation with a `\refcite`) and the WARN rule for the pre-thesis group do not change.

**Output.** The summary line of check 4 names the source groups as today; the extract part says `22 extract md (quotes only)` so a reader knows the rule.

**Chapter 2, line 26** (`chapters/literature-review.tex`): "By its abstract, it is a factor analysis approach based on probabilistic matrix factorization that uses …" becomes "By its abstract, it is ``a factor analysis approach based on probabilistic matrix factorization'' that uses …". The `\refcite{ma2008}` at the end of the sentence is about 95 characters after the closing quote, inside the 200 of `inQuote`, so check 4 lists the match as INFO. The same change in `drafts/02-literature-review.md` line 17, with `"…"`.

**Docs.** `CLAUDE.md` Commands, the `thesis:check` paragraph: check 4 compares with the quoted parts of the P1 extracts only.

**Rejected options:**

| Option | Why not |
|---|---|
| Blank the note text with spaces and keep one words array per file | `words` drops spaces, so the last words of one quote and the first of the next would join into one run, across the note text between them |
| One source object per quote | Each quote would count as a "file" in "n more files", and the per-file best match would be lost |
| Mark the note lines by their labels ("Says:", "Q1.", …) | The labels vary between files; the quotes are the only exact marker of someone else's text |
| An allow-list for the 7 false matches | It hides them one by one and needs a new entry for every new note line; the quotes rule removes the cause |

### Workflow and sequence diagrams

```mermaid
sequenceDiagram
    participant C as check.mjs
    participant L as lib.mjs
    C->>L: checkOverlap(thesis, sources[pre-thesis tex/md, extract md-quotes])
    loop each source
        L->>L: sourcePieces(source): one words array (tex, md) or one per quote (md-quotes)
    end
    loop each thesis file, each group, each source
        L->>L: overlaps(thesis words, piece words) for every piece
        L->>L: best match per start offset in this file
    end
    L->>L: best per start offset over the files; INFO if the thesis words are in a cited quotation
    L-->>C: findings and the table per chapter
```

### Failure modes

| # | What can go wrong | How we notice | How we resolve it |
|---|---|---|---|
| F1 | A quote is split by a line break, so it has no pair on its line | the words of that quote are not checked | Today every `"` is paired on its line (checked); `quotePieces` skips an unclosed quote, and a unit test covers it. A new extract with such a quote would be missed: written in `CLAUDE.md` |
| F2 | An inch mark or a quote inside a quote (`"a "b" c"`) pairs the wrong `"` | a piece holds note text | Not in today's extracts (all even counts); the pairs are taken left to right, so the worst case is a short wrong piece, which rarely holds 8 words |
| F3 | Line numbers shift for quote pieces | the output points to the wrong line | Each piece is placed on its real line before `words`; DW1 tests the line |
| F4 | The pre-thesis results change by accident | the pre-thesis count is no longer 0, or a test fails | The `tex` and `md` paths are unchanged; the existing tests stay (DW2) |
| F5 | The new quotation marks on line 26 change the PDF layout | page count or warnings change | Build and compare: same page count, no new warning |
| F6 | The run is slower (about 200 pieces instead of 22 files) | the command takes longer | Each piece is short; the shingle cache is per words array; not measured yet, expected under 1 s more |

### Code files

| File | New or changed | Purpose |
|---|---|---|
| `scripts/thesis-check/lib.mjs` | changed | `quotePieces`, `sourcePieces`; `checkOverlap` loops over pieces and counts files; the summary says "quotes only" for `md-quotes` |
| `scripts/thesis-check/lib.test.mjs` | changed | the DW1 cases; the existing cases stay |
| `scripts/thesis-check/check.mjs` | changed | the extract sources use `kind: 'md-quotes'` |
| `.docs/Thesis-Report/chapters/literature-review.tex` | changed | line 26: the SoRec words in ``…'' |
| `.docs/Thesis-Report/drafts/02-literature-review.md` | changed | the same, with `"…"` |
| `CLAUDE.md` | changed | one phrase in the `thesis:check` paragraph |
| `.docs/works/2026-11-23-p10-overlap-quotes-only/run.txt` | new | the output of the command after the change |

### Data, schema and cache changes

None.
