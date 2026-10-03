# CHAPTER 3: METHODOLOGY

## 3.1. Overview

This chapter describes the design methodology, architectural approach, and key technical decisions made during the development of the Breadit hybrid social networking platform. The methodology centers on a **systems engineering approach**: each architectural decision is evaluated against concrete alternatives based on the platform's defined requirements — real-time content delivery, hybrid feed ranking, threaded discussion management, and community moderation.

The implementation follows a **TypeScript-first monorepo strategy** using Turborepo, comprising two independently deployable applications: a NestJS/Fastify backend and a Next.js 15 frontend. All major technical choices — architecture pattern, pagination strategy, real-time protocol, and rendering model — are justified by explicit trade-off analysis documented in the sections below.

---

## 3.2. System Architecture

### 3.2.1. Modular Monolithic Architecture

The Breadit backend is structured as a **Modular Monolithic application** built on NestJS. The application is organized into 17 independent domain modules, each encapsulating its own controllers, services, and data access logic:

| Domain Module | Responsibility |
| :--- | :--- |
| `AuthModule` | JWT authentication, email verification, OTP flow |
| `PostsModule` | Post CRUD, feed queries, time-decay scoring, cursor pagination |
| `CommentsModule` | Nested reply tree, threaded discussion retrieval |
| `CommunitiesModule` | Community lifecycle, role hierarchy (OWNER → MOD → MEMBER), post moderation queue |
| `NotificationsModule` + `NotificationsGateway` | Real-time Socket.IO event delivery, notification persistence |
| `MessagesModule` | 1:1 conversation management, message persistence |
| `UsersModule` | Profile management, social graph (follow/block) |
| `InteractionsModule` | Like, repost, bookmark operations |
| `SearchModule` | Multi-type parallel full-text search |
| `HashtagsModule` | Hashtag indexing and hashtag feed retrieval |
| `AdminModule` | Site-wide user ban, content report management |
| `CacheModule` | Redis JSON cache with TTL and mutex stampede protection |
| `RedisModule` | Redis client provider, Socket.IO adapter configuration |
| `PrismaModule` | Global Prisma ORM client singleton |
| `BlockModule` | Block relationship enforcement |
| `UploadsModule` | Media upload to Cloudinary or local Sharp fallback |
| `HealthModule` | `/health` liveness endpoint |

#### Trade-off Analysis: Modular Monolith vs. Microservices

| Criterion | Modular Monolith (Chosen) | Microservices |
| :--- | :--- | :--- |
| **Deployment complexity** | Single deployable unit per application | Each service requires independent orchestration (Docker Compose, Kubernetes) |
| **Inter-module communication** | Direct in-process function calls via NestJS DI | Network calls (REST/gRPC), introducing latency and failure points |
| **Data access** | Single shared Prisma client with transactional integrity | Each service manages its own database, requiring distributed transaction patterns (SAGA) |
| **Development overhead** | Low — suitable for a single-developer pre-thesis project | High — requires service discovery, API gateways, and distributed logging |
| **Module boundary enforcement** | NestJS module encapsulation prevents cross-domain coupling | Enforced by network isolation |
| **Scalability** | Horizontal scaling via load balancer; Redis adapter enables stateless instances | Fine-grained per-service scaling |

**Justification:** For a pre-thesis project with a single developer and a defined feature scope, the Modular Monolithic pattern provides equivalent module isolation to Microservices while eliminating the operational overhead of distributed service orchestration. The NestJS module system enforces strict dependency injection boundaries, preventing domain coupling without requiring network-level separation. Horizontal scalability is still achievable via load-balanced deployments with the Redis-backed Socket.IO adapter, which maintains stateless WebSocket sessions.

---

## 3.3. Key Technical Design Decisions

### 3.3.1. Pagination Strategy: Cursor-Based vs. Offset-Based

Breadit implements **two distinct cursor-based pagination strategies**, both verifiable in [`posts.service.ts`](file:///d:/Fork/Breadit/apps/backend/src/posts/posts.service.ts):

1. **Time-ordered cursor** (Home feed, Profile feed): Format `timestamp:id` (e.g., `1748476800000:42`). Queries posts where `createdAt < cursor.timestamp OR (createdAt = cursor.timestamp AND id < cursor.id)`, ensuring deterministic ordering even for posts created at identical timestamps.

2. **Score-based cursor** (Explore feed): Format `scoreFixed:id` (e.g., `450:12`). After the time-decay ranking is computed in Node.js memory, pagination is applied by filtering `scoreFixed < cursor.scoreFixed OR (scoreFixed = cursor.scoreFixed AND id < cursor.id)`. This ensures the sorted ranking remains stable across page loads.

#### Trade-off Analysis: Cursor-Based vs. Offset-Based Pagination

| Criterion | Cursor-Based (Chosen) | Offset-Based (`SKIP n TAKE k`) |
| :--- | :--- | :--- |
| **Consistency under real-time inserts** | ✅ Stable — new posts inserted during scroll do not shift existing items | ❌ Unstable — new posts push items forward, causing duplicates on the next page |
| **Database performance at scale** | ✅ `O(log n)` index seek — uses indexed `(createdAt, id)` composite key | ❌ `O(n)` full scan — `SKIP 1000` requires scanning 1000 rows before returning data |
| **Stateless server** | ✅ Client holds cursor state; no server-side session needed | ✅ Client holds page number |
| **Arbitrary page jumps** | ❌ Not supported — cursor is sequential | ✅ Supported (rarely needed in infinite-scroll feeds) |
| **Implementation complexity** | Higher — requires composite cursor serialization and deserialization | Lower — simple integer arithmetic |

**Justification:** Breadit's feeds are real-time environments where new posts are continuously inserted. Offset-based pagination would cause the same post to appear on consecutive pages as new content shifts the index. Cursor-based pagination guarantees that each scroll page is consistent and non-duplicating, which is critical for the explore feed where the ranked order is computed once per request and cached.

---

### 3.3.2. Real-Time Communication Protocol: WebSocket vs. Alternatives

Breadit uses **Socket.IO over WebSockets** for bidirectional real-time event delivery, implemented in [`notifications.gateway.ts`](file:///d:/Fork/Breadit/apps/backend/src/notifications/notifications.gateway.ts).

#### Trade-off Analysis

| Criterion | WebSocket / Socket.IO (Chosen) | AJAX Long Polling | Server-Sent Events (SSE) |
| :--- | :--- | :--- | :--- |
| **Communication direction** | Full-duplex (bidirectional) | Half-duplex (client-initiated) | Unidirectional (server → client only) |
| **Frame overhead** | 2–10 bytes per frame after handshake | Full HTTP headers per request (~800 bytes) | Persistent HTTP stream, low overhead |
| **Notification latency** | Sub-second, event-driven | Bounded by polling interval (1–5 seconds) | Sub-second |
| **Private messaging support** | ✅ Native — client emits `sendMessage` events | ❌ Requires separate write endpoint | ❌ Read-only push |
| **Horizontal scalability** | ✅ Via Redis pub/sub adapter | ✅ Stateless per request | ✅ Stateless |
| **Connection overhead** | Single persistent TCP connection | New TCP handshake per poll cycle | Single persistent HTTP connection |

**Justification:** Private messaging requires **bidirectional** communication — the client must both send and receive events over the same channel. SSE only supports server-to-client push, making it insufficient for the chat feature. Long polling introduces latency proportional to the polling interval. WebSocket with a Redis pub/sub adapter (via `@socket.io/redis-adapter`) enables full-duplex messaging while remaining horizontally scalable across multiple backend instances.

---

### 3.3.3. Database Strategy: Hybrid PostgreSQL + Redis

Breadit uses a **hybrid database architecture**:

- **PostgreSQL** (via Prisma ORM): Persistent relational storage for all domain entities (Users, Posts, Comments, Likes, Follows, Blocks, Communities, Messages, Notifications, Reports).
- **Redis** (via `ioredis`): In-memory store for (1) JSON response caching with TTL-based expiry and mutex-based stampede protection (`CacheService`), and (2) Socket.IO adapter pub/sub for broadcasting events across stateless backend instances.

#### Trade-off Analysis: Hybrid vs. Single Database

| Criterion | Hybrid PostgreSQL + Redis (Chosen) | PostgreSQL Only | NoSQL Only (e.g., MongoDB) |
| :--- | :--- | :--- | :--- |
| **Relational integrity** | ✅ PostgreSQL enforces FK constraints, cascading deletes | ✅ Full ACID compliance | ❌ No native JOIN — denormalization required |
| **Cache performance** | ✅ Redis: sub-millisecond read for cached feeds | ❌ Every request hits PostgreSQL | ✅ In-memory options available |
| **Real-time adapter** | ✅ Redis pub/sub used by Socket.IO adapter | ❌ Would require external pub/sub (e.g., Redis anyway) | Depends on implementation |
| **Schema evolution** | ✅ Prisma migrations manage schema changes safely | ✅ | ❌ Schema-less requires application-level enforcement |
| **Operational complexity** | Two managed services (Supabase + Upstash) | One service | One service |

**Justification:** Breadit's data model is inherently relational — Users follow Users, Posts belong to Communities, Comments reference parent Posts, Likes reference both Users and Posts. PostgreSQL's JOIN and FK constraints are essential for maintaining referential integrity across these relationships. Redis adds a caching layer that reduces repeated PostgreSQL queries for high-frequency read endpoints (e.g., trending explore feed), improving response consistency without requiring a full database redesign.

---

### 3.3.4. Frontend Rendering: Hybrid SSR + CSR via Next.js 15

The frontend uses **Next.js 15 with the App Router**, implementing a hybrid rendering model:

| Component Type | Rendering Strategy | Use Case |
| :--- | :--- | :--- |
| **Server Components** | SSR — rendered on the server, HTML pre-built | Initial feed pages, profile pages, community pages, SEO-critical routes |
| **Client Components** | CSR — hydrated in the browser | Upvote buttons, comment input, real-time notification panel, chat UI |

#### Trade-off Analysis: Hybrid SSR/CSR vs. Full CSR SPA

| Criterion | Hybrid SSR + CSR (Chosen) | Full CSR SPA (e.g., plain React) |
| :--- | :--- | :--- |
| **Initial page load** | Fast — server pre-renders HTML with content | Slow — browser must download and execute JS before rendering |
| **SEO** | ✅ Crawlers receive pre-rendered HTML | ❌ Crawlers may see empty `<div>` before JS execution |
| **Interactivity** | ✅ Client Components hydrated for dynamic actions | ✅ Full client-side interactivity |
| **Session handling for SSR** | Requires cookie forwarding from Next.js Server to NestJS | Not applicable |
| **Bundle size** | Server Components excluded from JS bundle | All components included in client bundle |

**Justification:** Social networking feeds require both fast initial load (for user retention) and highly interactive client-side actions (voting, commenting, messaging). A full CSR SPA would create a blank-page delay before the feed renders, which is unacceptable for content discovery. A full SSR approach (e.g., server-rendered on every interaction) would be unnecessarily costly. Next.js 15's hybrid model renders the static feed shell on the server while hydrating interactive UI elements as Client Components, balancing performance and interactivity.

---

## 3.4. Development Environment & Toolchain

| Tool | Purpose |
| :--- | :--- |
| **Turborepo** | Monorepo build orchestration; caches build outputs for incremental compilation |
| **TypeScript 5** | Strict type safety across frontend, backend, and shared types |
| **Prisma ORM** | Type-safe PostgreSQL access; schema-first migrations |
| **ESLint + Prettier** | Code style enforcement and auto-formatting |
| **Docker Compose** | Local containerized environment for backend, PostgreSQL, and Redis |

---

## 3.5. Problems with the Previous Chapter 3 & How They Were Addressed

The following issues were identified in the original Chapter 3 draft based on professor feedback:

| Problem | Original Text | Fix Applied |
| :--- | :--- | :--- |
| **Inaccurate scope claim** | "recommendations based on trending analysis through tracking... preferences" — implies ML recommendation | Removed. Replaced with accurate description: deterministic heuristic ranking, no ML |
| **Missing trade-off analysis** | "Creating a scalable Modular Monolithic architecture" — no comparison, no justification | Added full trade-off tables for all 4 key decisions |
| **No alternative comparison** | Cursor-based pagination mentioned with no explanation of why over offset-based | Added cursor vs offset table with justification grounded in real-time feed requirements |
| **Vague "future microservices"** | "future microservices, such as an AI-driven recommendation engine" — overclaims future direction | Kept as future work mention but separated from architecture justification |
