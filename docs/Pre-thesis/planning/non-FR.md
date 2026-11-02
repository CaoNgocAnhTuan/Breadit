# Breadit — Non-Functional Requirements

> All NFRs listed here reflect constraints and qualities **currently implemented** in the codebase (as of May 2026).

---

## Category 1: Security

---

### NFR-SEC-01: Password Hashing

**Description:** User passwords are never stored in plain text.

**Implementation:**
- `bcrypt.hash(password, 10)` is called on every password before it is written to the database (`AuthService.register`, `AuthService.resetPassword`).
- Login uses `bcrypt.compare()` for one-way verification; the hash is never returned to the client.

---

### NFR-SEC-02: Session via HttpOnly JWT Cookie

**Description:** Session tokens must not be accessible from JavaScript; they must expire automatically.

**Implementation:**
- After a successful login, the backend calls `reply.setCookie('breadit_session', token, { httpOnly: true, sameSite: 'lax', secure: true (production), maxAge: 30 * 24 * 60 * 60 })`.
- The JWT is signed/verified with HS256 using `jose`; the `JWT_SECRET` environment variable must be at least 32 characters.
- The cookie has a 30-day `maxAge`; the JWT payload carries the same expiry via `setExpirationTime('30d')`.
- `secure: true` is set only when `NODE_ENV === 'production'`, so local development still works over HTTP.

---

### NFR-SEC-03: Email Verification Requirement

**Description:** Users must verify their email before creating content or sending messages.

**Implementation:**
- `EmailVerifiedGuard` checks `req.user.emailVerified` on every write endpoint (posts, replies, likes, follows, uploads, DMs). Unverified users receive HTTP 403.
- A non-intrusive banner is displayed on the frontend for unverified accounts, with a link to the verification page.

---

### NFR-SEC-04: Account Suspension Enforcement

**Description:** Banned users must be blocked from all write operations without being logged out.

**Implementation:**
- `BannedUserGuard` reads `req.user.banned` (embedded in the JWT at login time) and throws HTTP 403 if `true`.
- The guard is applied to all state-changing endpoints (posts, likes, reposts, follows, blocks, uploads).
- The frontend displays an "Account suspended" full-screen message to banned users.

---

### NFR-SEC-05: Role-Based Access Control

**Description:** Admin-only endpoints must be inaccessible to regular users.

**Implementation:**
- `RolesGuard` reads the `@Roles('ADMIN')` decorator on admin controllers/handlers via NestJS `Reflector`.
- All routes under `/api/admin/*` require `JwtAuthGuard` + `RolesGuard` + `@Roles(Role.ADMIN)`.
- Community moderation endpoints check `CommunityMember.role` (OWNER / MOD) inside the service layer.

---

### NFR-SEC-06: No Email Enumeration

**Description:** Responses to unauthenticated email-based requests must not reveal whether an account exists.

**Implementation:**
- `POST /api/auth/forgot-password` and `POST /api/auth/resend-verify` always return HTTP 200 OK regardless of whether the email exists in the database.
- Email sending errors are caught internally and logged; they do not alter the response.

---

### NFR-SEC-07: One-Time Expiring Tokens

**Description:** Verification codes and password reset tokens must expire and be invalidated after use.

**Implementation:**
- Email verification: 6-digit code valid for **15 minutes**; stored in `VerificationToken`; deleted immediately after successful use.
- Password reset: `crypto.randomUUID()` token valid for **1 hour**; stored in `VerificationToken`; deleted after successful password change.
- Generating a new code/token overwrites (`deleteMany` before `create`) any previously issued one for the same email.

---

### NFR-SEC-08: CORS Restricted to Frontend Origin

**Description:** The backend must reject cross-origin requests from any origin other than the configured frontend.

**Implementation:**
- `app.enableCors({ origin: process.env.FRONTEND_URL, credentials: true })` is called in `main.ts`.
- The default value is `http://localhost:3000`; production deployments must set `FRONTEND_URL` explicitly.
- Socket.IO gateway applies the same `cors.origin` restriction.

---

### NFR-SEC-09: Socket.IO Authentication

**Description:** Unauthenticated clients must not be able to connect to the real-time gateway.

**Implementation:**
- `NotificationsGateway.handleConnection()` extracts the `breadit_session` cookie from the socket handshake headers and calls `verifyJwt()`.
- If the cookie is absent or the JWT is invalid, `socket.disconnect()` is called immediately.

---

### NFR-SEC-10: Input Validation and Field Whitelisting

**Description:** All incoming request bodies must be validated; unknown fields must be silently stripped.

**Implementation:**
- The global `ValidationPipe` is configured with `{ whitelist: true, transform: true }` in `main.ts`.
- Every DTO uses `class-validator` decorators (`@IsString()`, `@IsEmail()`, `@IsOptional()`, etc.).
- `whitelist: true` silently removes any fields not decorated in the DTO, preventing mass-assignment vulnerabilities.

---

### NFR-SEC-11: Block Enforcement Across the Platform

**Description:** Blocked users must be excluded from all content surfaces, not just direct profile visits.

**Implementation:**
- Whenever a `userId` is present, all feed queries (`findAll`), search queries, and notification queries join the `Block` table and filter out posts and users where a blocking relationship exists in either direction.
- Following relationships are automatically deleted when a block is created.

---

### NFR-SEC-12: Ownership Verification Before Destructive Actions

**Description:** Users must only be allowed to delete or modify their own content.

**Implementation:**
- `DELETE /api/posts/:id` fetches the post and compares `post.userId` with the authenticated user's ID; mismatches return HTTP 403.
- Community ownership is verified by querying `CommunityMember.role = OWNER` before transfer, deletion, or promotion operations.

---

### NFR-SEC-13: File Size Limits

**Description:** The system must reject uploads that exceed defined size thresholds to prevent abuse.

**Implementation:**
- `@fastify/multipart` is registered with `{ limits: { fileSize: 500 MB, files: 10, fields: 10 } }`.
- Fastify throws `FST_REQ_FILE_TOO_LARGE` if the limit is exceeded; `AllExceptionsFilter` maps it to HTTP 413.

---

## Category 2: Performance

---

### NFR-PERF-01: Paginated Queries (No Full-Table Reads)

**Description:** Feed and list endpoints must never return unbounded result sets.

**Implementation:**
- All list queries use a `LIMIT` constant: posts feed `LIMIT = 3`, users/notifications/admin queries `LIMIT = 10–20`.
- Pagination is implemented via `skip: (cursor - 1) * LIMIT` + `take: LIMIT`, returning a `hasMore` boolean computed from `totalCount`.

---

### NFR-PERF-02: Client-Side Data Cache (TanStack Query)

**Description:** Repeated client-side requests for the same data must be served from cache without hitting the network.

**Implementation:**
- `QueryProvider` wraps the entire application with a `QueryClient` instance.
- Mutation callbacks call `queryClient.invalidateQueries(...)` on the relevant query keys to ensure cache stays fresh after writes.
- Infinite queries (`useInfiniteQuery`) accumulate pages on the client, enabling instant back-navigation without re-fetching.

---

### NFR-PERF-03: Optimistic UI Updates

**Description:** User interactions (like, repost, follow) must feel instantaneous with no perceived latency.

**Implementation:**
- Like, repost, and bookmark mutations call `queryClient.setQueryData()` to apply the predicted server response before the HTTP round-trip completes.
- On error, the cache is rolled back to the previous state.

---

### NFR-PERF-04: Server-Side Rendering for Initial Page Load

**Description:** Public pages must render with content visible before JavaScript executes.

**Implementation:**
- All primary layout and route pages (home feed, profile, community, post detail) are Next.js Server Components that call `serverFetch()` directly on the server before streaming HTML.
- The `getSession()` function in `lib/session.ts` uses `cache: 'no-store'` to ensure fresh auth state on every SSR render.

---

### NFR-PERF-05: Media Optimisation on Upload

**Description:** Stored images must be resized and compressed to reduce storage and delivery cost.

**Implementation:**
- **Cloudinary path:** images are uploaded with `quality: 'auto'` and crop transformations (600×600 square, 600×338 wide, 1200px max width).
- **Local path:** `sharp` re-encodes all images to JPEG at quality 80 and resizes to the requested dimensions before writing to disk.
- Videos are stored as-is (no server-side re-encoding).

---

### NFR-PERF-06: CDN for Media Delivery

**Description:** Media files must be served from a CDN where possible to reduce latency.

**Implementation:**
- When `CLOUDINARY_CLOUD_NAME` is configured, all images and videos are stored on Cloudinary and returned as `secure_url` (`https://res.cloudinary.com/...`).
- The frontend `Image` and `Video` components normalise the `path` prop: bare UUID filenames are prefixed with `/uploads/`; full HTTPS URLs are used directly.

---

### NFR-PERF-07: Debounced Search

**Description:** Live search must not trigger an API call for every keystroke.

**Implementation:**
- The Search component applies a 300 ms debounce before calling `GET /api/search?q=<term>`, reducing the number of network requests to one per typing pause.

---

## Category 3: Scalability

---

### NFR-SCALE-01: Stateless Authentication

**Description:** The backend must not require shared in-memory session state across instances.

**Implementation:**
- JWTs contain all required claims (userId, username, role, banned, emailVerified) and are self-contained.
- `JwtAuthGuard` verifies the token's HMAC signature with `jose`; no database or cache lookup is needed for each request.

---

### NFR-SCALE-02: Distributed Real-Time Messaging (Redis Adapter)

**Description:** Socket.IO events must be delivered correctly even when multiple backend instances are running.

**Implementation:**
- `NotificationsGateway.afterInit()` attaches the `@socket.io/redis-adapter` using two ioredis client instances (pub and sub).
- Redis pub/sub broadcasts events across all backend nodes, so a notification emitted from one instance reaches sockets connected to any other instance.

---

### NFR-SCALE-03: Redis-Backed Rate Limiting

**Description:** Rate limit counters must be shared across backend instances.

**Implementation:**
- `ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])` defines a global limit of 120 requests per 60 seconds.
- The throttler storage is backed by Redis via `nestjs-throttler-storage-redis`, ensuring counters are consistent across replicas.

---

### NFR-SCALE-04: Containerised Deployment

**Description:** The entire stack must be deployable as isolated containers with defined health checks.

**Implementation:**
- `docker-compose.yml` defines four services: `db` (PostgreSQL 16), `redis` (Redis 7), `backend` (NestJS), `app` (Next.js).
- Each service has a `healthcheck` (pg_isready, redis-cli ping, HTTP /api/health, HTTP /sign-in) and `depends_on: condition: service_healthy` ordering.
- `backend` listens on `0.0.0.0:4000`; the upload directory is a named Docker volume shared between `backend` and `app`.
- The `Makefile` provides `make rebuild`, `make frontend-rebuild`, `make backend-rebuild` for zero-downtime per-service image rebuilds.

---

## Category 4: Reliability & Data Integrity

---

### NFR-REL-01: Soft Deletes for Posts

**Description:** Deleted posts must be recoverable and must not cascade-break reply threads or reposts.

**Implementation:**
- `Post.deletedAt` is set to `now()` instead of issuing a `DELETE` SQL statement.
- All feed and detail queries filter `deletedAt: null`.
- Reply and repost records referencing a soft-deleted post remain in the database; their rendering is handled gracefully by the frontend.

---

### NFR-REL-02: Atomic Community Deletion

**Description:** Deleting a community must leave no orphaned rows across related tables.

**Implementation:**
- `CommunitiesService.deleteCommunity()` executes a `prisma.$transaction` that soft-deletes all community posts, then hard-deletes `CommunityBannedUser`, `CommunityRule`, `CommunityMember`, and `Community` records in one atomic operation.

---

### NFR-REL-03: Graceful Email Delivery Failures

**Description:** Email sending failures must not prevent successful account creation or password reset.

**Implementation:**
- In `AuthService.register()` and `AuthService.resendVerificationCode()`, the SMTP call is wrapped in a `try/catch`; errors are logged but not re-thrown.
- The user record is created first; if the email fails, the user can request a resend.

---

### NFR-REL-04: Prisma Connection Lifecycle Management

**Description:** Database connections must be opened and closed cleanly with the application lifecycle.

**Implementation:**
- `PrismaService` implements `OnModuleInit` (`$connect`) and `OnModuleDestroy` (`$disconnect`).
- `RedisService` implements `OnModuleDestroy` (`quit()`) to release the Redis connection pool on shutdown.

---

### NFR-REL-05: Consistent Error Response Format

**Description:** All errors from the backend must return a uniform JSON structure.

**Implementation:**
- `AllExceptionsFilter` is registered globally (`app.useGlobalFilters`).
- `HttpException`s are forwarded as-is; unhandled exceptions are mapped to HTTP 500 `{ statusCode: 500, message: "Internal server error" }`.
- Non-HTTP errors (status ≥ 500) are logged with method, URL, status code, error name, message, and full stack trace via NestJS `Logger`.

---

### NFR-REL-06: Upload Directory Fallback

**Description:** The backend must start and serve uploads even if the preferred upload directory is not writable.

**Implementation:**
- `resolveUploadDir()` in `main.ts` attempts `fs.mkdirSync(UPLOAD_DIR)`. If it fails, it falls back to `./uploads` relative to the working directory and updates `process.env.UPLOAD_DIR` so `UploadsService` picks up the correct path.

---

## Category 5: Maintainability

---

### NFR-MAINT-01: Strict TypeScript Throughout

**Description:** The codebase must be type-checked with TypeScript in both apps.

**Implementation:**
- Both `apps/frontend` and `apps/backend` have a `tsconfig.json`; the backend's `tsconfig.build.json` targets `dist/` for production builds.
- `npm run typecheck` (alias for `tsc --noEmit`) is enforced by the Husky pre-commit hook.
- `@breadit/shared` provides shared types consumed by both apps via npm workspaces.

---

### NFR-MAINT-02: Automated Linting on Commit

**Description:** Code style errors must be caught before reaching the repository.

**Implementation:**
- `.husky/pre-commit` runs `npx lint-staged` (ESLint `--fix` on staged `*.ts`/`*.tsx` files) and `npm run typecheck`.
- `eslint.config.mjs` extends `next/core-web-vitals` and `next/typescript`; `@typescript-eslint/no-unused-vars` is configured with `warn`.

---

### NFR-MAINT-03: Modular Backend Architecture

**Description:** Backend features must be independently encapsulatable and testable.

**Implementation:**
- Each domain has its own NestJS module (`AuthModule`, `PostsModule`, `UsersModule`, `NotificationsModule`, etc.) registered in `AppModule`.
- `PrismaModule` and `RedisModule` are shared global modules.
- DTOs are co-located with their module and validated by `class-validator` decorators.

---

### NFR-MAINT-04: Monorepo with Shared Packages

**Description:** Types and constants shared between frontend and backend must not be duplicated.

**Implementation:**
- npm workspaces (`"workspaces": ["apps/*", "packages/*"]`) link `@breadit/shared` into both apps.
- Root `package.json` scripts delegate to workspaces with `-w @breadit/frontend` and `-w @breadit/backend`.

---

## Category 6: Usability

---

### NFR-USE-01: Infinite Scroll Feeds

**Description:** Users must not be forced to navigate between pages to view more content.

**Implementation:**
- All feed and list components (`InfiniteFeed`, `ProfileTabFeed`, `ConversationList`, `NotificationsFeed`) use `react-infinite-scroll-component` + TanStack `useInfiniteQuery`.
- The `hasMore` boolean returned by every paginated endpoint drives the scroll threshold.

---

### NFR-USE-02: Relative Timestamps

**Description:** Post and notification timestamps must be human-readable without requiring the user to parse absolute datetimes.

**Implementation:**
- `timeago.js` renders all `createdAt` timestamps as relative strings (e.g., "2 hours ago", "3 days ago") throughout the feed and notification list.

---

### NFR-USE-03: Real-Time Typing Indicator in DMs

**Description:** A user composing a message must see a live indicator when the other party is typing.

**Implementation:**
- `useTypingIndicator` hook emits `startTyping` after the first keystroke and `stopTyping` after 3 seconds of silence (debounced timer).
- The receiving side displays a `TypingDots` component; it auto-hides after 4 seconds if no `stopTyping` event arrives (guards against page-close scenarios).
- Typing signals are fire-and-forget via Socket.IO; no database writes occur.

---

### NFR-USE-04: Non-Intrusive Email Verification Banner

**Description:** Unverified users must be able to browse the platform but must be clearly prompted to verify before posting.

**Implementation:**
- `BoardLayout` checks `!session.user.emailVerified` and renders a slim top banner with a "Check your inbox" link.
- The banner does not block navigation; `EmailVerifiedGuard` on the backend enforces the actual restriction.

---

### NFR-USE-05: Full-Screen Media Viewer

**Description:** Images and videos in posts must be viewable at full resolution without leaving the page.

**Implementation:**
- The `MediaViewer` component renders a full-screen lightbox overlay for images and videos.
- Clicking any media grid item opens the viewer; clicking the backdrop or pressing Escape closes it.

---

### NFR-USE-06: SSR-Preserved Layout with Client Interactivity

**Description:** Interactive UI state (e.g., sidebar visibility on the messages page) must not require the layout to be a Client Component.

**Implementation:**
- `BoardLayoutClient.tsx` is a thin Client Component wrapper that receives SSR-fetched `leftBar` and `rightBar` as props from the Server Component `BoardLayout`.
- This preserves the SSR data fetch while allowing `useState`-driven sidebar toggling on the messages route.

---

## Summary Table

| ID | Name | Category |
|---|---|---|
| NFR-SEC-01 | Password Hashing (bcrypt, 10 rounds) | Security |
| NFR-SEC-02 | Session via HttpOnly JWT Cookie (30-day, SameSite=lax) | Security |
| NFR-SEC-03 | Email Verification Requirement (EmailVerifiedGuard) | Security |
| NFR-SEC-04 | Account Suspension Enforcement (BannedUserGuard) | Security |
| NFR-SEC-05 | Role-Based Access Control (RolesGuard + ADMIN/MOD/OWNER) | Security |
| NFR-SEC-06 | No Email Enumeration on Forgot/Resend | Security |
| NFR-SEC-07 | One-Time Expiring Tokens (15 min verify, 1 hr reset) | Security |
| NFR-SEC-08 | CORS Restricted to Configured Frontend Origin | Security |
| NFR-SEC-09 | Socket.IO JWT Authentication on Connect | Security |
| NFR-SEC-10 | Input Validation + Field Whitelisting (ValidationPipe) | Security |
| NFR-SEC-11 | Block Enforcement Across All Content Surfaces | Security |
| NFR-SEC-12 | Ownership Verification Before Destructive Actions | Security |
| NFR-SEC-13 | File Size Limits (500 MB / file, 10 files max) | Security |
| NFR-PERF-01 | Paginated Queries with LIMIT (no full-table reads) | Performance |
| NFR-PERF-02 | Client-Side Cache via TanStack Query | Performance |
| NFR-PERF-03 | Optimistic UI Updates for Interactions | Performance |
| NFR-PERF-04 | Server-Side Rendering for Initial Page Load | Performance |
| NFR-PERF-05 | Image Compression and Resizing on Upload (sharp / Cloudinary) | Performance |
| NFR-PERF-06 | CDN Delivery via Cloudinary (with local fallback) | Performance |
| NFR-PERF-07 | Debounced Live Search (300 ms) | Performance |
| NFR-SCALE-01 | Stateless Authentication (self-contained JWT) | Scalability |
| NFR-SCALE-02 | Distributed Real-Time via Socket.IO Redis Adapter | Scalability |
| NFR-SCALE-03 | Redis-Backed Rate Limiting (120 req / 60 s global) | Scalability |
| NFR-SCALE-04 | Containerised Deployment with Health Checks (Docker Compose) | Scalability |
| NFR-REL-01 | Soft Deletes for Posts (deletedAt timestamp) | Reliability |
| NFR-REL-02 | Atomic Community Deletion (Prisma transaction) | Reliability |
| NFR-REL-03 | Graceful Email Delivery Failures (logged, non-blocking) | Reliability |
| NFR-REL-04 | Prisma and Redis Connection Lifecycle Management | Reliability |
| NFR-REL-05 | Consistent Error Response Format (AllExceptionsFilter) | Reliability |
| NFR-REL-06 | Upload Directory Fallback | Reliability |
| NFR-MAINT-01 | Strict TypeScript in Both Apps (tsc --noEmit) | Maintainability |
| NFR-MAINT-02 | Automated Linting and Type-Check on Commit (Husky) | Maintainability |
| NFR-MAINT-03 | Modular NestJS Architecture (one module per domain) | Maintainability |
| NFR-MAINT-04 | Monorepo with Shared Packages (@breadit/shared) | Maintainability |
| NFR-USE-01 | Infinite Scroll Feeds (react-infinite-scroll-component) | Usability |
| NFR-USE-02 | Relative Timestamps (timeago.js) | Usability |
| NFR-USE-03 | Real-Time Typing Indicator in DMs (debounced, auto-hide) | Usability |
| NFR-USE-04 | Non-Intrusive Email Verification Banner | Usability |
| NFR-USE-05 | Full-Screen Media Viewer (lightbox) | Usability |
| NFR-USE-06 | SSR-Preserved Layout with Client Interactivity | Usability |
