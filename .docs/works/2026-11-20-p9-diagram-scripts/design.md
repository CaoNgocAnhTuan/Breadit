# Diagram scripts list and automatic figures

Type: writing (light path, no plan) · 2026-11-20 · Folder: `.docs/works/2026-11-20-p9-diagram-scripts/`
Row: `.docs/implementation-plan.md` §5 row 18 (Chapter 4 figures), decided by the author on 2026-11-19 ("diagrams by hand") and 2026-11-20.

## 1. Spec

### Problem

The author draws every thesis diagram by hand: the Mermaid web editor (mermaid.live) or draw.io, then saves the image in the image folder of `.docs/Thesis-Report/`. Today the 11 Mermaid scripts sit inside `drafts/04-system-analysis-and-design.md`, between the prose, and `chapters/system-analysis-and-design.tex` shows a framed placeholder for each figure. To put an image in, the author must edit the `.tex` by hand (swap the `\fbox` line for the commented `\includegraphics` line). The scripts were checked against the code on 2026-11-19, before tasks `p9-bug-quick-wins` and `p10-demo-fixes` changed some flows; draft note 3 asks to check Figures 4.3, 4.5, 4.6 and 4.7 again.

### Scope

**In scope:**
- A new file `.docs/Thesis-Report/diagrams.md`: every diagram of the thesis in one list. For each one: the figure number and title, the chapter, section and LaTeX label where it is used, the file name to save (`images/fig4-<n>-<name>.pdf`, or `.png` at 300 dpi or more), the suggested tool, size hints (for example a landscape page for the ERD), and the Mermaid script in a ```` ```mermaid ```` block that pastes into mermaid.live as it is. Short instructions at the top (how to export, where to save, that LaTeX picks the file up by itself, that the `.mmd` source stays next to the image).
- One `.mmd` file per diagram in `images/` with the same name as the image (`images/fig4-1-usecase.mmd`, …), holding the same script (Report Architecture: "keep its editable source next to it").
- A LaTeX macro in the "Thesis additions" block of `main.tex`, for example `\thesisdiagram{<name>}{<width>}`: if `images/<name>.pdf` exists it is included, else if `images/<name>.png` exists it is included, else the same framed placeholder as today ("Figure to be drawn: images/<name>.pdf"). The 11 placeholders of `chapters/system-analysis-and-design.tex` use it, with the same names, captions and labels.
- Check Figures 4.3, 4.5, 4.6 and 4.7 (and any other figure whose flow the two tasks touched) against the code as it is now. Known changes: `OptionalJwtAuthGuard` now checks the logout blacklist through `readSession` (`auth/session.ts`); likes, saves, reposts and comments on a pending post answer 404 (`canSeePost`, `posts/visibility.ts`); approving a post keeps `updatedAt` and bumps `v:user` of the approver and the author. Update a script (in the draft, in `diagrams.md` and in its `.mmd`) only where the code differs, and update the draft note 3.

**Out of scope:** drawing or exporting images; changing what Chapter 4 says beyond a figure that is now wrong; other chapters; code.

### Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | `diagrams.md` | 11 entries, each with number, title, label, file name, tool and a Mermaid block equal to its `.mmd` file and to the draft |
| DW2 | each Mermaid block | renders in Mermaid (parse check with the Mermaid CLI if available, else checked by reading; say which) |
| DW3 | `latexmk -pdf` of `main.tex` with no images | builds with no error; the 11 placeholders show as before |
| DW4 | with a test PNG named like one figure put in `images/` for the check, then removed | the PDF shows the image in that figure; after removing it, the placeholder is back |
| DW5 | Figures 4.3, 4.5, 4.6, 4.7 | match the code today; each change is listed in Result |

## 2. Impact

P9, Chapter 4. No code change. The author only drops image files into `images/` from now on.

## Result

Closed 2026-11-20. Files: `diagrams.md` (new, 11 entries), `images/fig4-<n>-<name>.mmd` (11 new), `main.tex` (macro `\thesisdiagram{name}{width}`: `images/<name>.pdf`, else `.png`, else the placeholder; height capped at `0.8\textheight`), `chapters/system-analysis-and-design.tex` (the 11 placeholders use the macro), `drafts/04-system-analysis-and-design.md` (scripts of 4.5 and 4.6, "Checked against" lines of 4.3–4.8, notes 3, 5, 6).

| # | Result |
|---|---|
| DW1 | ✅ 11 entries; each Mermaid block is byte-identical to its `.mmd` file and to the draft (checked by script) |
| DW2 | ✅ all 11 pass `mermaid.parse` and `mermaid.render` (Mermaid 11.16.0 from the local npx cache, run in headless Chrome; nothing installed) |
| DW3 | ✅ builds with no error or warning; 11 placeholders shown |
| DW4 | ✅ a test `images/fig4-2-signup.png` and a tall test `fig4-9-components.pdf` were included, then deleted; placeholders back (61 pages). A new image needs `latexmk -g -pdf main.tex` once (plain `latexmk` says "up-to-date"); `diagrams.md` says so |
| DW5 | ✅ 4.5: both guards call `readSession` (`auth/session.ts`); 4.6: `assertPostLive` calls `canSeePost` (`posts/visibility.ts`), 404 for a post the viewer may not see. 4.3, 4.4, 4.7, 4.8 unchanged (line numbers refreshed). The paragraph before Figure 4.6 now also says the viewer must be allowed to see the post (Opus) |

For the author: the ERD (4.11) may need a landscape page (`pdflscape` is not set up); Figure 4.4 still says "no blocked peers" for every mode though the profile feed does not filter them, and Figure 4.3 leaves out the `rePostId` 404 (draft note 6).
