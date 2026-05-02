# GEMINI.md

This file provides context and guidelines for Gemini CLI interactions within the Breadit repository.

## Project Overview

Breadit is a full-stack X (Twitter) clone built with a modern TypeScript stack. It is organized as a monorepo using npm workspaces.

### Tech Stack
- **Frontend:** Next.js 15 (App Router), TanStack Query (v5), Socket.IO client, Tailwind CSS.
- **Backend:** NestJS + Fastify, Prisma ORM, JWT (httpOnly cookie), Socket.IO gateway.
- **Infrastructure:** PostgreSQL 16, Redis 7 (Cache/Pub-Sub), Cloudinary (Media CDN) with local `sharp` fallback.
- **Communication:** nodemailer SMTP for email verification and notifications.

### Architecture
- **Monorepo Structure:**
  - `apps/frontend`: Next.js application.
  - `apps/backend`: NestJS API service.
  - `packages/shared`: Shared TypeScript types and constants.
  - `docs/`: Extensive planning and implementation documentation.
- **Authentication:** Custom JWT-based session management using `breadit_session` httpOnly cookies. No NextAuth.
- **Messaging:** 1:1 Direct Messaging system via Socket.IO for real-time delivery and database persistence.
- **Real-time:** Socket.IO for live notifications and DMs.

## Key Commands

### Development
```bash
# Install dependencies
npm install

# Start Frontend (port 3000)
npm run dev

# Start Backend (port 4000)
npm run dev -w @breadit/backend

# Reset Database (Force reset + Seed)
npm run dev:reset
```

### Infrastructure (Docker/Makefile)
```bash
make up        # Start all services (db, redis, backend, app)
make down      # Stop all services
make logs      # Follow logs
make rebuild   # Full rebuild of all images
```

### Prisma
All Prisma commands must point to the backend schema:
```bash
npx prisma generate --schema=apps/backend/prisma/schema.prisma
npx prisma db push --schema=apps/backend/prisma/schema.prisma
npx prisma studio --schema=apps/backend/prisma/schema.prisma
npx prisma migrate dev --name <name> --schema=apps/backend/prisma/schema.prisma
```

## Development Conventions

### Backend (NestJS)
- **DTO Validation:** ALWAYS decorate every field in DTOs with `class-validator` decorators (e.g., `@IsOptional()`, `@IsString()`). Undecorated fields are silently stripped by the `ValidationPipe`.
- **Global Filters:** Uses `AllExceptionsFilter` for consistent error logging.
- **Guards:** Use `JwtAuthGuard` for protected routes and `EmailVerifiedGuard` for content-creation actions.
- **Multipart Uploads:** The `@fastify/multipart` limit is set to **10 files** per request. Ensure backend logic handles multiple parts when processing uploads.
- **Tokens:** Email verification relies on 6-digit codes, while password resets use UUID strings (via `crypto.randomUUID()`) to ensure secure link resolution.

### Frontend (Next.js)
- **Data Fetching:** 
  - Server components use `serverFetch(path, init?)` from `@/lib/session` to forward session cookies.
  - Client components use TanStack Query for infinite feeds and mutations.
- **Layouts & UI State:** Use Client Component wrappers (e.g., `BoardLayoutClient.tsx`) to manage interactive UI state (like hiding sidebars) within Server Component layouts, preserving SSR data fetching capabilities.
- **Media Rendering:** 
  - Use the `Image` and `Video` components from `@/components`.
  - Use the `path` prop for values from the DB (handles both bare UUID filenames and full Cloudinary URLs).
  - **Large View:** Use the `MediaViewer` component to provide a full-screen lightbox experience for images and videos.
- **API Helper:** The `api()` helper in `@/lib/api.ts` only sets `Content-Type: application/json` if a body is present. Do not manually add this header for bodyless POSTs.

### Database (Prisma)
- **Post Media:** Posts no longer have single `img` or `video` fields. They use a `media` relation (`PostMedia[]`) to support multiple attachments per post.
- **Relation Naming Gotcha:** 
  - `User.followers` = People this user IS following.
  - `User.followings` = People FOLLOWING this user.
  - *Note: This is backwards from typical intuition; adhere to this existing schema naming.*

## Documentation & Planning
- `docs/planning/implementation_plan.md`: The single source of truth for project status and future phases.
- `docs/planning/usecase.md`: Detailed functional requirements and UC IDs.
- `CLAUDE.md`: Contains specific technical notes and troubleshooting tips for AI assistants.
