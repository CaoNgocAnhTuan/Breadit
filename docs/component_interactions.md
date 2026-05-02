# Component Interactions & Logic Flow

This document explains how the various directories and files in Breadit interact to provide a cohesive social media experience.

---

## 1. The Authentication & Security Lifecycle

### Files involved:
- **Backend:** `auth.service.ts`, `auth.controller.ts`, `jwt.guard.ts`, `verificationToken` (Prisma).
- **Frontend:** `lib/session.ts`, `providers/SessionProvider.tsx`, `middleware.ts`.

### Interaction Flow:
1.  **Registration:** `AuthController` calls `AuthService.register`. The service creates a `User` and a `VerificationToken` (6-digit OTP).
2.  **Verification:** User submits the code. `AuthService` checks the `VerificationToken` table, marks `emailVerified` on the `User`, and deletes the token.
3.  **Session Creation:** On login, `AuthService` generates a JWT. The `AuthController` uses `set-cookie` to store this JWT in an `httpOnly` cookie named `breadit_session`.
4.  **Guarding Routes:** When a user requests a protected route (e.g., `POST /posts`), the `JwtAuthGuard` intercepts the request, reads the cookie, validates the JWT via `jose`, and attaches the user payload to `req.user`.
5.  **Frontend Sync:** 
    - **Server-side:** `lib/session.ts` forwards the cookie during SSR so the backend knows who is visiting.
    - **Client-side:** `SessionProvider` stores the user object in React context for UI changes (e.g., showing the "Logout" button).

---

## 2. The Content & Social Lifecycle (Posts, Likes, Follows)

### Files involved:
- **Backend:** `posts.service.ts`, `interactions.service.ts`, `uploads.service.ts`, `notifications.service.ts`.
- **Shared:** `packages/shared/src/index.ts` (DTOs).

### Interaction Flow:
1.  **Post Creation:** 
    - Client sends a multipart form to `PostsController`.
    - `PostsService` uses `UploadsService` to process images (saving locally or to Cloudinary).
    - `PostsService` creates a `Post` record in Prisma, linking it to the `User` and any `PostMedia`.
2.  **Engagement:**
    - A different user "Likes" the post via `InteractionsController`.
    - `InteractionsService` creates a `Like` record.
    - **Cross-Module Interaction:** `InteractionsService` calls `NotificationsService` to alert the post author.
3.  **Feed Generation:**
    - `PostsService` queries the database using complex `include` statements to fetch the post, its media, like counts, and (crucially) whether the *current* requesting user has already liked it.

---

## 3. The Real-time Notification Lifecycle

### Files involved:
- **Backend:** `notifications.service.ts`, `notifications.gateway.ts` (Socket.io).
- **Frontend:** `socket.ts`, `components/Socket.tsx`.

### Interaction Flow:
1.  **Trigger:** An event occurs (Follow, Like, Reply).
2.  **Service Action:** `NotificationsService` saves a `Notification` record in PostgreSQL so it's persistent.
3.  **Gateway Emit:** The service calls `NotificationsGateway.emit`.
4.  **Socket Delivery:** The Gateway finds the active Socket connection for the `recipientId` and sends a `getNotification` event.
5.  **UI Update:** The Frontend `Socket.tsx` component listens for this event and triggers a toast notification or updates the unread badge count in the `LeftBar`.

---

## 4. Community & Moderation Lifecycle

### Files involved:
- **Backend:** `communities.service.ts`, `admin.service.ts`, `banned-user.guard.ts`.

### Interaction Flow:
1.  **Community Scoping:** Every post can optionally have a `communityId`. Feeds at `/c/[slug]` filter by this ID.
2.  **Membership:** `CommunitiesService` manages `CommunityMember` records, assigning roles (OWNER, MOD, MEMBER).
3.  **Moderation:** 
    - If a user is banned from a community, the `CommunityBannedUser` record prevents them from posting in that specific sub-group.
    - If a user is banned globally, the `BannedUserGuard` (global) blocks their JWT from accessing *any* write endpoints.

---

## 5. The Shared Bridge (`@breadit/shared`)

### Files involved:
- `packages/shared/src/index.ts`

### Interaction Flow:
1.  **Contract Definition:** All API response shapes and request bodies (DTOs) are defined here.
2.  **Backend Implementation:** NestJS controllers use these classes for `Body()` typing.
3.  **Frontend Usage:** When using `useQuery` or `fetch`, the frontend casts the JSON response to these shared interfaces, ensuring that if a field name changes in the backend, the frontend will fail to build until updated.
