# Literature notes (P1) · updated 2026-10-24 · task 2026-10-23-p1-literature

Working notes for P1. Not thesis text.

## 1. Status table

| Ref | Short name | Type | Verified | Read | Opened | Cited in |
|---|---|---|---|---|---|---|

## 2. Claims

| # | Claim | Status | Evidence |
|---|---|---|---|

## 3. How this file was made

- PDF tool: PDFKit through the compiled `pdftxt` (Swift 5.9.2, source `.docs/works/2026-10-23-p1-literature/pdftxt.swift`, built with `swiftc -framework PDFKit`), tested on [5] (title, authors and the first sentence of the abstract read well) and on [25] (authors and abstract read well, a table and the text of page 3 come out in the right order; the title lost its spaces and PDFKit printed one "CoreGraphics PDF has logged an error" line), 2026-10-24, pass.
- Tools that failed:
  - `swift pdftxt.swift` (interpreted): fails with "Symbols not found: PDFDocument", so the tool is compiled.
- Needs full text (for the author): none yet.

## 4. Core papers

## 5. Design decisions

## 6. Other references

## 7. Recent work (2022 or later)

## 8. Older neighbours and other added references

## 9. Proposed changes

| ID | Change | Where | Evidence | Goes to |
|---|---|---|---|---|
