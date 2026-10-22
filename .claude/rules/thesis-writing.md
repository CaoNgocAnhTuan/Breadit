---
paths:
  - ".docs/**"
---

# Writing thesis docs

- Follow "How to write" in CLAUDE.md: short, simple words, one idea per paragraph, exact names and numbers.
- Thesis docs go in `.docs/`. Never edit `docs/` or `Latex/`: they are frozen pre-thesis material, and a hook blocks it. Thesis LaTeX goes in `.docs/latex/` (copied from the template at P9). Existing docs are not rewritten unless the author asks.
- **Numbers.** In thesis text, every result number comes from a macro in `results-macros.tex`, made from a CSV by the report script. Never type a result number. In planning docs, give the source of each number (a command, a file or a commit).
- **Frozen values.** Link to super-plan §7. Do not restate them elsewhere. Only the author changes one, with /freeze.
- **References.** Cite only references marked "verified" in super-plan §10. Check a "search only" reference before you cite it.
- **Task files.** Each task is `.docs/works/<YYYY-MM-DD-slug>/` with `spec.md`, `design.md` and `plan.md`. The status line near the top is `Status: draft`, `approved` or `done`. Only the author approves, with /approve; a hook blocks Claude from writing "approved".
- **Pre-thesis mistakes to avoid:** numbers in the abstract that appear nowhere else, text about code that does not exist (the LightFM sentence), and results from a failed run (the k6 file with 71% failed requests).
