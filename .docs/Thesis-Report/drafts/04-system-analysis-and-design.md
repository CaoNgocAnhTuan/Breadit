# Chapter 4. System Analysis and Design

> **Outline, 2026-11-19.** Not written yet. Budget: about 14 pages (see `Report Architecture.md`). Every diagram must match the code and `apps/backend/prisma/schema.prisma` as they are now; a pre-thesis diagram (`docs/Pre-thesis/Latex/images/`, `docs/Pre-thesis/`) is reused only after that check. Remove this box before the final version.

This chapter designs the platform (contributions C1 and C3) and shows where the ranking of C2 plugs in. Chapter 3 gives the ranking method; Chapter 5 describes how the design is built.

## 4.1 Requirements (about 2 pages)

- Functional requirements by module (posts, interactions, follows, communities, messages, notifications, search, admin, feed), as one table.
- Non-functional requirements: security (auth, the S1 and S5 fixes), real-time push, reproducibility of the ranking (Class D), performance as measured in E7 only.
- Sources: pre-thesis `Non-Functional-Requirements.md` and Chapter 3 of the pre-thesis report; `.docs/Bugs Report.md` (system inventory).

## 4.2 Use cases (about 3 pages)

- One overview use case diagram with the actors Guest, User and Admin.
- Three or four use case specifications as tables (actor, precondition, main flow, alternative flows): read the "For You" feed (with the `algo` option), send a direct message, join a community and post in it, ban a user.

## 4.3 Activity diagrams (about 2 pages)

- Sign up with email verification.
- Publish a post (hashtags, mentions, notifications).
- Get one page of the ranked feed (mode choice, cache, ranking).

## 4.4 Sequence diagrams (about 3 pages)

- Log in and log out (cookie, blacklist).
- Like a post, with the notification saved and pushed.
- A direct message in real time (Guidance Manual 12 §3.3).
- "For You" with `algo=social` (Guidance Manual 08 §4).

## 4.5 Architecture and modules (about 1.5 pages)

- The component diagram: frontend, REST API, gateway, Postgres, Redis, uploads (Guidance Manual 12 §1, `docs/System_Architecture.md`).
- The backend modules and the ranking package boundary: plain arrays in, ordered post ids out (Guidance Manual 08 §3).

## 4.6 Database design (about 2.5 pages)

- One ERD on one page, made from the current `schema.prisma`.
- A short table of the main entities (User, Post, Like, Comment, Follow, Community, CommunityMember, Conversation, Message, Notification, Block) and the rules the design keeps: soft delete, approved community posts, membership for community posts.

---

## Notes for the author

1. Diagram tools (decided 2026-11-19): the author draws the diagrams by hand, in draw.io, and the sequence diagrams in the Mermaid web editor. They go in `images/` as PDF (or PNG at 300 dpi or more), each with its editable source next to it (see `Report Architecture.md`, "Diagrams").
2. Keep each diagram to the main flows. A diagram that does not support a sentence in the text is cut.
3. Facts checked against the code on 2026-11-19 (check again after `p9-bug-quick-wins`, which may change routes and guards):
   - Mermaid starting points for the sequence diagrams: Guidance Manual 08 §4 ("For You" with `algo=social`; the same as `docs/System_Architecture.md`) and Guidance Manual 12 §3.3 (direct message). The pre-thesis `docs/Pre-thesis/uc*_sequence.mmd` files are not checked against today's code.
   - Direct message route: `POST /api/conversations/:id/messages`. The guards are `JwtAuthGuard` and `BannedUserGuard` on the controller, then `EmailVerifiedGuard` on the route (`messages.controller.ts` lines 27–28 and 83–91). `MessagesService.sendMessage` pushes `newMessage` to the other member's username room (`messages.service.ts` lines 315–316).
   - ERD: the schema has 25 models and 32 relations with `@relation(fields: …)`. The pre-thesis ERD (`docs/Pre-thesis/output/ERD_Breadit.dbml`) has drifted: it has 23 tables, without `Account` and `Session`, and its `CommunityRule` has a `createdAt` the schema does not have and lacks `description`. `Account` and `Session` are unused (Bugs Report R4); leave them out and say so in the caption. Draw the ERD from `schema.prisma`, not from the pre-thesis files.
   - ERD labels: name each relation by its foreign key (`followerId`, `followingId`), not by the list names. In this schema `User.followers` means "the accounts this user follows" (CLAUDE.md).
   - The pre-thesis use case diagram (`docs/Pre-thesis/UseCaseDiagram1.png`) shows use cases that may not exist ("Config system", "Analytic and monitor system"). Check each use case against the routes before reusing it.
