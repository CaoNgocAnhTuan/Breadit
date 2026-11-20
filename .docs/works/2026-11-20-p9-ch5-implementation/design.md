# Chapter 5 Implementation: draft and LaTeX

Type: writing (light path, no plan) · 2026-11-20 · Folder: `.docs/works/2026-11-20-p9-ch5-implementation/`
Row: `.docs/implementation-plan.md` §5 row 19 (P9)

## 1. Spec

### Problem

Chapter 5 has no draft (`drafts/05-implementation.md` has a title only) and an empty `chapters/implementation.tex`.

### Scope

**In scope:**
- A Markdown draft of about 10 pages: the tech stack; the built architecture (monorepo, frontend, backend on Fastify, Postgres, Redis); the real-time layer (Socket.IO gateway, rooms, Redis adapter); the feed (`FeedService`, the `algo` option, cursor, cache); `packages/ranking`; `eval/` (generator, Digg adapter, harness, report); the repro command `npm run thesis:repro` and the parity test. Sources: CLAUDE.md, `docs/System_Architecture.md`, Guidance Manual 08 and 12 (en), the code.
- The same chapter in LaTeX in `chapters/implementation.tex`; short code listings only where they help (`lstlisting`).
- Every fact checked against the code as it is now.

**Out of scope:** design diagrams and requirements (Chapter 4), the method (Chapter 3), result numbers (Chapter 6; E7 numbers are cited from Chapter 6, not typed), `main.tex`, `references.tex`, code.

### Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | `latexmk -pdf` of `main.tex` | builds with no error; no undefined reference from Chapter 5 except new reference keys listed in Result |
| DW2 | no typed result number | none |
| DW3 | page count | 8–12 pages (budget 10) |
| DW4 | facts | every file, command, route and env variable named exists today |

## 2. Impact

P9, Chapter 5. No code change.

## Result

Closed 2026-11-20. Files: `drafts/05-implementation.md` (Sections 5.1–5.9 and 11 author notes), `chapters/implementation.tex` (5 tables, 4 listings); `docs/System_Architecture.md` (the tree said 19 migrations; there are 18 folders plus `migration_lock.toml`).

| # | Result |
|---|---|
| DW1 | ✅ the full build of `main.tex` (Opus, in place) has no error and no undefined reference |
| DW2 | ✅ no typed result number; the live α/β is `\tuneWTwoMHChosen`; E7 points to Chapter 6 |
| DW3 | ✅ 11 pages (24–34) |
| DW4 | ✅ counts checked against the repo: 18 modules, 13 controllers, 72 routes, 25 models, 18 migrations, 13 run configs, 26 `thesis:repro` steps; the 85 ranking tests were run and pass |

Not run by the agent: the integration tests, `test:parity`, `thesis:repro`, `eval` (no Docker; this shell had Node 22.14.0, not the pinned version). Three backend unit suites did not load because the `sharp` binary for `darwin-x64` is missing on this machine (not a code problem). For the author: `OptionalJwtAuthGuard` does not check the logout blacklist (this is Bugs Report S5, HTTP part, in `p9-bug-quick-wins`); `resend` is in `apps/backend/package.json` but no code imports it; Section 5.9 names `.claude/hooks/verify.sh` and the Husky hook (cut it if the thesis should not name your own tooling).
