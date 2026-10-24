# Literature notes (P1) · updated 2026-10-24 · task 2026-10-23-p1-literature

Working notes for P1. Not thesis text.

## 1. Status table

| Ref | Short name | Type | Verified | Read | Opened | Cited in |
|---|---|---|---|---|---|---|
| [7] | Twitter blog (2023) | blog | do not cite, use [6] | index record | 2026-10-24 | not cited |
| [16] | Target item sampling (Cañamares 2020) | paper | verified | abstract only | 2026-10-24 | not cited |
| [23] | Influence and correlation (Anagnostopoulos 2008) | paper | verified | index record | 2026-10-24 | not cited |

## 2. Claims

| # | Claim | Status | Evidence |
|---|---|---|---|

## 3. How this file was made

- PDF tool: PDFKit through the compiled `pdftxt` (Swift 5.9.2, source `.docs/works/2026-10-23-p1-literature/pdftxt.swift`, built with `swiftc -framework PDFKit`), tested on [5] (title, authors and the first sentence of the abstract read well) and on [25] (authors and abstract read well, a table and the text of page 3 come out in the right order; the title lost its spaces and PDFKit printed one "CoreGraphics PDF has logged an error" line), 2026-10-24, pass.
- Tools that failed:
  - `swift pdftxt.swift` (interpreted): fails with "Symbols not found: PDFDocument", so the tool is compiled.
- Needs full text (for the author): [16] Cañamares 2020 (closed access), [23] Anagnostopoulos 2008 (no open copy found).

## 4. Core papers

## 5. Design decisions

## 6. Other references

### [7] Twitter recommendation blog (Twitter Engineering 2023)
- Opened: 2026-10-24, index record [Wayback availability API: snapshot 20240508043115, a record only]
- Says: the text of the post was not read. Direct fetches of the snapshot returned HTTP 429 five times on 2026-10-24, `blog.x.com` returned HTTP 403, and the availability API returned 429 on its last try. Nothing is claimed about what the post says.
- For us: super-plan §6 cites it together with [6] for the use of RealGraph in the ranking. Use [6] instead. Step 24 tries the snapshot again.
- Cited in: not cited

### [16] Target item sampling (Cañamares 2020)
- Opened: 2026-10-24, abstract only [Semantic Scholar record of DOI 10.1145/3383313.3412259; Crossref gives the same title, authors, year and pages 259-268]
- Says: the paper studies how the choice of target set in offline evaluation changes the result of comparing recommenders. The abstract says that reduced target sets often contradict the result with large targets, and that minimum sets distort pairwise comparisons while maximum sets may not be ideal either. Super-plan §10 gives the code repository as the link. The paper itself is DOI 10.1145/3383313.3412259 (RecSys 2020).
- For us: D6, sampled versus full ranking. Only the abstract was read, so it supports no decision. The ACM page and the UAM repository gave no full text (the repository answered 403).
- Cited in: not cited

### [23] Influence and correlation (Anagnostopoulos 2008)
- Opened: 2026-10-24, index record [Crossref and OpenAlex records of DOI 10.1145/1401890.1401897]
- Says: the records confirm the title, the three authors (Aris Anagnostopoulos, Ravi Kumar, Mohammad Mahdian), KDD 2008, pages 7-15. No full text or abstract was read, and no legal open copy was found (the Sapienza repository answered 403).
- For us: D7 and claim 9, what W0, W1 and the timestamp shuffle can and cannot show. Without the text it supports no decision.
- Cited in: not cited

## 7. Recent work (2022 or later)

## 8. Older neighbours and other added references

## 9. Proposed changes

| ID | Change | Where | Evidence | Goes to |
|---|---|---|---|---|
