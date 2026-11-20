# Chapter 4 System Analysis and Design: text and LaTeX

Type: writing (light path, no plan) · 2026-11-20 · Folder: `.docs/works/2026-11-20-p9-ch4-text/`
Row: `.docs/implementation-plan.md` §5 row 18 (P9)

## 1. Spec

### Problem

`drafts/04-system-analysis-and-design.md` is an outline with checked Mermaid scripts; the text is not written, and `chapters/system-analysis-and-design.tex` is an empty stub. The author draws the diagrams by hand, so no image exists yet.

### Scope

**In scope:**
- The text of Sections 4.1–4.6 in the draft, under each outline item; the Mermaid scripts and the author notes stay in the draft.
- The text checked against the code and `apps/backend/prisma/schema.prisma` as they are now; facts from `docs/System_Architecture.md`, the Guidance Manual (en) and `.docs/Bugs Report.md`.
- `chapters/system-analysis-and-design.tex`: the same text in LaTeX. Each figure is a `figure` float with caption and label and a framed placeholder that names the image file it waits for (`images/fig4-<n>-<name>.pdf`), so the author can drop the image in later.
- Tables (requirements, use case specifications) as LaTeX tables.

**Out of scope:** drawing the diagrams, Chapter 3 content (Chapter 4 points to Sections 3.2 and 3.5 for the score and the pool), Chapter 5 content (what was built), `main.tex`, `references.tex`, code.

### Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | `latexmk -pdf` of `main.tex` | builds with no error; no undefined reference from Chapter 4 except new reference keys listed in Result |
| DW2 | the draft | every outline item has text; every figure is used by a sentence |
| DW3 | page count of Chapter 4 | 12–16 pages with placeholders (budget 14) |
| DW4 | facts | every route, model and field named exists in the code today |

## 2. Impact

P9, Chapter 4. No code change. After `p9-bug-quick-wins`, Figures 4.3, 4.5, 4.6 and 4.7 may need a check (draft note 3).

## Result

Closed 2026-11-20. Files: `drafts/04-system-analysis-and-design.md` (prose under every outline item; Mermaid scripts unchanged; notes 5 and 6 added), `chapters/system-analysis-and-design.tex`.

| # | Result |
|---|---|
| DW1 | ✅ builds; no error, no warning and no undefined reference from Chapter 4; no new reference |
| DW2 | ✅ 23 functional and 7 non-functional requirements, four use case tables, 11 figure placeholders (`images/fig4-1-usecase` … `fig4-11-erd`), each used by a sentence |
| DW3 | ✅ 15 pages with placeholders (last page 60% full). With the real images, expect 17–18; cut candidates are in draft note 5 |
| DW4 | ✅ checked by the agent; spot-checked by Opus: 13 controllers, 25 models, `files: 10` in `app.setup.ts`, default throttle 1000 |

Differences between the outline and today's code (draft note 6; no Mermaid script changed): Figure 4.4 says "no blocked peers" for every mode, but the profile mode does not filter them; Figure 4.3 leaves out the 404 check on `rePostId`; joining a community needs no verified email (only posting does). The text states S5 (HTTP part), T6 and R6 as open: if `p9-bug-quick-wins` or `p10-security-fixes` fixes one, update NFR2, NFR7 and the ban use case (A5), and recheck Figures 4.3, 4.5, 4.6 and 4.7.
