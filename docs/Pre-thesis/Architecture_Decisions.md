# Architecture Decisions (ADR)

This document records the key architectural decisions made during the development of Breadit and the rationale behind each.

## 1. PostgreSQL over MongoDB
**Decision:** Use a relational database (PostgreSQL) instead of a NoSQL database (MongoDB).

**Rationale:**
- **Relational Integrity:** Social networks are inherently relational. Interactions like follows, blocks, community memberships, and nested comments rely heavily on joins and strict relationship constraints.
- **Complex Queries:** PostgreSQL handles complex aggregation (e.g., calculating feed scores, mutual follows) more efficiently and predictably than MongoDB.
- **Data Consistency:** Features like "Like" counts and "Follower" counts benefit from ACID compliance to ensure data remains consistent across the platform.

## 2. NestJS for the Backend
**Decision:** Use NestJS as the primary backend framework.

**Rationale:**
- **Modular Architecture:** NestJS enforces a clean separation of concerns through Modules, Controllers, and Services, preventing the "spaghetti code" common in large Express applications.
- **TypeScript First:** Deep integration with TypeScript provides excellent developer tooling and runtime safety.
- **Ecosystem:** Built-in support for WebSockets (via Gateways), validation (Class-validator), and dependency injection allows for rapid development without reinventing the wheel.

## 3. Monorepo Structure with Shared Packages
**Decision:** Organize the codebase into a monorepo containing `apps/backend`, `apps/frontend`, and `packages/shared`.

**Rationale:**
- **Type Sharing:** By defining DTOs and Interfaces in `packages/shared`, we ensure that the frontend and backend always agree on the data contract. This eliminates "undefined" errors caused by API mismatches.
- **Atomic Changes:** A single commit can update a database schema, the backend API, and the frontend UI, keeping the entire system in sync.

## 4. JWT Sessions via httpOnly Cookies
**Decision:** Use custom JWT management stored in `httpOnly` cookies rather than NextAuth or LocalStorage.

**Rationale:**
- **Security:** `httpOnly` cookies are inaccessible to client-side JavaScript, providing a strong defense against XSS (Cross-Site Scripting) attacks that could steal user tokens.
- **SSR Compatibility:** Since cookies are automatically sent with HTTP requests, Next.js Server Components can easily forward them to the backend, enabling seamless Server-Side Rendering (SSR) for authenticated users.
- **Statelessness:** JWTs allow the backend to remain stateless, making it easier to scale horizontally without needing a shared session store (like Redis) for basic authentication.

## 5. Prisma ORM
**Decision:** Use Prisma as the Object-Relational Mapper (ORM).

**Rationale:**
- **Type Safety:** Prisma generates a client based on the database schema, providing full autocompletion and compile-time checks for database queries.
- **Migrations:** Prisma Migrate provides a declarative way to handle database changes, making it easy to track schema evolution in version control.

## 6. Socket.io for Real-time Updates
**Decision:** Use Socket.io for notifications and private messaging.

**Rationale:**
- **Reliability:** Socket.io provides automatic reconnections and fallback mechanisms if WebSockets are not available.
- **Room Management:** The built-in "Rooms" feature makes it trivial to broadcast messages to specific users or community members without managing complex mapping logic manually.
