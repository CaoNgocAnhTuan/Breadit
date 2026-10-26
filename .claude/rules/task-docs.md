---
paths:
  - ".docs/works/**"
---

# Writing design.md and plan.md

Follow "How to write" in CLAUDE.md: short sentences, simple words, exact names and numbers. Limits: `design.md` 800 lines, `plan.md` 600 lines (the post-edit hook checks).

## design.md

- **Scope.** Design what the Spec asks and nothing more. A problem in the Spec goes under Open questions. Do not change the approved Spec text.
- **Reuse.** Name the real files and functions you reuse (for example `getFolloweesIds`, `BlockService.getAllBlockedPeerIds`, `engagementSelect`, `CacheService.getOrSetJson`). Do not design a second copy of something that exists.
- **Signatures, not code.** TypeScript types and function signatures, Prisma model changes, migration SQL when it matters, cache keys. Short snippets only.
- **Diagrams.** One Mermaid `sequenceDiagram` per main flow. A `classDiagram` when there are three or more classes.
- **Failure modes.** Each one has what goes wrong, how we notice, and how the code resolves it. Think about:
  - two fast requests (`Like`, `Follow` and `SavedPosts` have no unique key yet, Bugs Report T6);
  - the 10 s feed cache and the `v:user` version (T3);
  - blocked users, soft-deleted rows (`deletedAt`), pending community posts (`isApproved`), banned users;
  - empty and very large input;
  - time and `asOf` (no wall clock in ranking and eval code);
  - a database that already has bad rows.
- **Code files.** Every file that is created or changed, and what it is for.
- **Rejected options.** At least one, with the reason.
- **Unknowns.** If you are not sure how a library behaves, read its docs or its code in `node_modules`. Write "not verified" for what you could not check.

## plan.md

- Steps in the order they must be done. Each step points to the design (section and file). No exact commands.
- Tests come first. Every DW of the Spec is covered by a test or an acceptance item. Say the level: unit (`apps/backend/src/**/*.spec.ts`) or IT (`apps/backend/test/it/`, real Postgres schema `it_test`, needs db and redis).
- Schema changes go through a real migration (`prisma migrate dev`), never `db push`.
- The last step updates the docs the task changes (the Bugs Report row, the super-plan change log, CLAUDE.md if commands change).
- A frozen value (super-plan §7) is never changed by a plan. Only the author changes one.
