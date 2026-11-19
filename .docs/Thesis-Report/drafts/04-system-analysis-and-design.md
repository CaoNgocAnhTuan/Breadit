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

1. Diagram tools: Mermaid diagrams (already in `docs/System_Architecture.md` and the Guidance Manual) can be exported to PDF with mermaid-cli (not installed yet); the ERD can come from the schema. Decide one tool and one style for all diagrams.
2. Keep each diagram to the main flows. A diagram that does not support a sentence in the text is cut.
