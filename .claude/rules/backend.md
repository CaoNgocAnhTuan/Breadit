---
paths:
  - "apps/backend/**"
---

# Backend rules (NestJS on Fastify)

The full text is in CLAUDE.md "Architecture". These are the points a design or a change most often gets wrong.

- **Fastify, not Express.** Use Fastify request and reply types and plugins. All routes are under `/api/...`, written in each `@Controller('api/...')`. There is no global prefix.
- **Guards.** Compose per route with `@UseGuards(...)`. `JwtAuthGuard` or `OptionalJwtAuthGuard` first, because they fill `req.user`. Then `EmailVerifiedGuard` (write actions), `BannedUserGuard` (re-checks the DB), `RolesGuard` with `@Roles('ADMIN')`.
- **DTOs.** The global `ValidationPipe` uses `whitelist: true`. A DTO field with no `class-validator` decorator is stripped.
- **Cache.** Cached reads put `cache.getNumber('v:user', [userId])` (or the right version) in the key. Every write that changes the result calls `incrNumber` on that version. Do not delete keys. Use `getOrSetJson`.
- **Blocking.** Any new listing query (posts, users, search, notifications, messages) filters out blocked peers with `BlockService`.
- **Soft delete.** Posts use `deletedAt`. Filter it in every read. Community posts count only when `isApproved` is true.
- **Counts.** `User.followers` counts the accounts a user follows. Query the `Follow` table for followers.
- **Real time.** Push through `gateway.server.to(username).emit(...)`. `NotificationsService.emit()` saves a `Notification` and then pushes it.
- **Schema.** Docker deploys with `migrate deploy`, so a schema change needs a real migration. Never edit a committed migration. Never `db push`.
- **Tests.** Unit tests are `src/**/*.spec.ts`. Integration tests are `test/it/*.it-spec.ts` (real Postgres schema `it_test`, Redis database 1; they need `docker compose up db redis -d`). A new endpoint needs an IT test.
- **Dependencies.** Add with `npm install --legacy-peer-deps` (`@nestjs/core` is 10, `@nestjs/websockets` is 11).
