# Non-Functional Requirements - Breadit

Document này liệt kê tất cả các non-functional requirements đã được implement trong dự án.

---

## 1. Security (Bảo mật)

### 1.1 Authentication & Authorization

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| JWT Authentication (HS256) | ✅ | `apps/backend/src/auth/auth.service.ts` | Sign JWT với TTL 30 ngày, chứa `sub`, `username`, `emailVerified`, `role`, `banned` |
| httpOnly Session Cookie | ✅ | `apps/backend/src/auth/auth.service.ts` | Cookie `breadit_session` với `httpOnly`, `sameSite: 'lax'`, `secure` trong production |
| Password Hashing | ✅ | `apps/backend/src/auth/auth.service.ts` | bcryptjs với cost factor 10 |
| JWT HTTP Guard | ✅ | `apps/backend/src/auth/jwt.guard.ts` | Verify JWT từ cookie, attach `user` vào request |
| Optional JWT Guard | ✅ | `apps/backend/src/auth/optional-jwt.guard.ts` | Cho phép request không cần auth nhưng vẫn populate user nếu có |
| Banned User Guard | ✅ | `apps/backend/src/auth/banned-user.guard.ts` | Block user bị ban khỏi các API protected |
| Email Verified Guard | ✅ | `apps/backend/src/auth/email-verified.guard.ts` | Yêu cầu email đã verify trước khi thực hiện write operations |
| Role-based Access Control | ✅ | `apps/backend/src/auth/roles.guard.ts`, `roles.decorator.ts` | `@Roles('ADMIN')` decorator + `RolesGuard` cho admin routes |

### 1.2 Input Validation & Sanitization

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| Global Validation Pipe | ✅ | `apps/backend/src/main.ts` | `ValidationPipe({ whitelist: true, transform: true })` - strip extra fields, coerce types |
| DTO Validation | ✅ | `apps/backend/src/**/dto/*.ts` | class-validator decorators cho tất cả DTOs |
| Upload Size Limits | ✅ | `apps/backend/src/main.ts` | Fastify `bodyLimit` 500MB, multipart file size limits |

### 1.3 Network Security

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| CORS | ✅ | `apps/backend/src/main.ts` | `enableCors` với `origin` từ `FRONTEND_URL`, `credentials: true` |
| Rate Limiting (Global) | ✅ | `apps/backend/src/app.module.ts` | ThrottlerModule: 120 requests / 60 giây |
| Rate Limiting (Auth) | ✅ | `apps/backend/src/auth/auth.controller.ts` | Tighter limits: 10 hoặc 5 req / 60s cho auth endpoints |

### 1.4 Not Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| CSRF Protection | ❌ | Chỉ dựa vào sameSite cookie |
| Security Headers (Helmet) | ❌ | Không có trong main.ts |
| OAuth / Social Login | ❌ | Schema có `Account` model nhưng chưa implement |

---

## 2. Performance (Hiệu năng)

### 2.1 Pagination & Data Loading

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| Cursor-based Pagination | ✅ | Multiple services | `take`/`skip` pattern với `hasMore`/`nextCursor` |
| Search Result Caps | ✅ | `apps/backend/src/search/search.service.ts` | `RESULT_LIMIT = 5` per category |
| Infinite Scroll | ✅ | Frontend components | TanStack Query với `useInfiniteQuery` |

### 2.2 Image Optimization

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| Cloudinary Transformations | ✅ | `apps/backend/src/uploads/uploads.service.ts` | Auto quality, resize, JPG conversion |
| Local Sharp Processing | ✅ | `apps/backend/src/uploads/uploads.service.ts` | Sharp pipeline cho local storage |
| Next.js Image Optimization | ✅ | `apps/frontend/next.config.ts`, `components/Image.tsx` | Remote patterns cho Cloudinary + localhost |

### 2.3 Caching

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| Client-side Cache (TanStack Query) | ✅ | `apps/frontend/src/providers/QueryProvider.tsx` | Stable QueryClient |
| Redis (Infrastructure) | ✅ | `docker-compose.yml` | Redis container cho Socket.IO adapter |
| Server-side HTTP Cache | ❌ | N/A | RedisService registered nhưng chưa được sử dụng cho caching |

---

## 3. Reliability (Độ tin cậy)

### 3.1 Error Handling

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| Global Exception Filter | ✅ | `apps/backend/src/all-exceptions.filter.ts` | Map HTTP errors, log 5xx với stack trace |
| Route-level Error UI | ✅ | `apps/frontend/src/app/(board)/error.tsx` | "Something went wrong" + reset button |
| Domain Validation | ✅ | Multiple services | Check ownership, existence trước khi mutate |

### 3.2 Data Integrity

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| Soft Delete | ✅ | `prisma/schema.prisma` (`deletedAt`) | Posts, comments không bị xóa cứng |
| Database Transactions | ✅ | `communities.service.ts`, `messages.service.ts` | `prisma.$transaction` cho multi-step operations |
| Foreign Keys | ✅ | `prisma/schema.prisma` | FK constraints với `onDelete` cascade/restrict |

---

## 4. Scalability (Khả năng mở rộng)

### 4.1 Database Design

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| PostgreSQL + Prisma | ✅ | `apps/backend/prisma/` | Normalized schema, migrations |
| Unique Constraints → Indexes | ✅ | `prisma/schema.prisma` | `@unique` / `@@unique` tạo indexes tự động |
| Composite Primary Keys | ✅ | `prisma/schema.prisma` | `@@id` cho join tables (PostTag, ConversationMember, etc.) |

### 4.2 Horizontal Scaling

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| Multi-instance Socket.IO | ✅ | `apps/backend/src/notifications/notifications.gateway.ts` | Redis adapter cho pub/sub across instances |
| Stateless JWT | ✅ | Auth system | Không cần server-side session storage |

### 4.3 Not Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Full-text Search (PostgreSQL FTS) | ❌ | Dùng `contains` + `mode: 'insensitive'` |
| Redis-backed Rate Limiter | ❌ | Dependency có nhưng chưa wire trong AppModule |

---

## 5. Real-time & Usability

### 5.1 WebSocket Features

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| Socket.IO Gateway | ✅ | `apps/backend/src/notifications/notifications.gateway.ts` | CORS aligned, JWT auth on connect |
| Room-based Messaging | ✅ | Same | Rooms by username và `conversation:{id}` |
| Real-time Notifications | ✅ | `apps/backend/src/notifications/notifications.service.ts` | Emit `getNotification` sau khi persist |
| Real-time DMs | ✅ | `apps/backend/src/messages/messages.service.ts` | `newMessage`, `messageRead` events |
| Typing Indicators | ✅ | Gateway | `typing` events cho DMs |

### 5.2 Frontend UX

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| Auth Middleware | ✅ | `apps/frontend/src/middleware.ts` | Redirect unauthenticated users |
| Session Context | ✅ | `apps/frontend/src/providers/SessionProvider.tsx` | Server-side session load, client `useSession()` |
| Optimistic Updates | ✅ | Multiple components | Like, repost, follow mutations |

---

## 6. DevOps & Infrastructure

### 6.1 Containerization

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| Docker Compose Stack | ✅ | `docker-compose.yml` | Postgres, Redis, backend, frontend |
| Multi-stage Dockerfile (Backend) | ✅ | `apps/backend/Dockerfile` | Build → Deploy stages |
| Multi-stage Dockerfile (Frontend) | ✅ | `apps/frontend/Dockerfile` | Next.js build → start |

### 6.2 Health & Monitoring

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| Health Endpoint | ✅ | `apps/backend/src/health/health.controller.ts` | `GET /api/health` → `{ status: 'ok' }` |
| Container Healthchecks | ✅ | `docker-compose.yml` | `pg_isready`, Redis `ping`, HTTP checks |
| Fastify Logging | ✅ | `apps/backend/src/main.ts` | `logger: true` on FastifyAdapter |

### 6.3 Configuration

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| Environment Config | ✅ | `apps/backend/src/app.module.ts` | `ConfigModule.forRoot({ isGlobal: true })` |
| Env Examples | ✅ | `.env.example`, `apps/*/env.example` | Document tất cả env vars |

---

## 7. Data Protection & Moderation

### 7.1 User Verification

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| Email Verification | ✅ | `apps/backend/src/auth/auth.service.ts` | 6-digit code, 15-minute TTL |
| Password Reset | ✅ | Same | Token-based reset flow |
| Resend Throttling | ✅ | Auth controller | Rate limit cho resend verification |

### 7.2 User Safety

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| Global Ban | ✅ | `User.banned`, `admin.service.ts` | Admins toggle ban status |
| User Blocking | ✅ | `users.service.ts` | Mutual block, filter khỏi feeds/search/notifications |
| Community Bans | ✅ | `communities.service.ts` | Per-community ban với `CommunityBannedUser` model |

### 7.3 Content Moderation

| Feature | Status | Location | Description |
|---------|--------|----------|-------------|
| Report System | ✅ | `posts.service.ts`, `admin.service.ts` | User report → Admin review → Dismiss/Delete |
| Sensitive Content Flag | ✅ | `Post.isSensitive` | Blur media cho sensitive posts |
| Community Post Approval | ✅ | `communities.service.ts` | Posts cần MOD/OWNER approve |

---

## Summary

| Category | Implemented | Not Implemented |
|----------|-------------|-----------------|
| Security | 12 | 3 (CSRF, Helmet, OAuth) |
| Performance | 6 | 1 (Server-side cache) |
| Reliability | 5 | 0 |
| Scalability | 5 | 2 (FTS, Redis throttler) |
| Real-time | 7 | 0 |
| DevOps | 8 | 0 |
| Data Protection | 8 | 0 |
| **Total** | **51** | **6** |

---

*Last updated: May 6, 2026*
