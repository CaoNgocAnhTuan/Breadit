# Breadit — Current Architecture Overview

## What This Project Does

Breadit is a Twitter/X clone — a social media web app where users sign up, post short text/images/videos, follow others, like/repost/save/comment on posts, and receive real-time notifications. The home feed shows posts from accounts you follow plus your own.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, React 19) |
| Auth | **Clerk** (`@clerk/nextjs`, `@clerk/elements`) |
| Database ORM | Prisma 6 |
| Database | MySQL |
| Real-time | Socket.IO (custom Node server) |
| Media CDN | **ImageKit** (`imagekitio-next`, `imagekit`) |
| Data fetching | TanStack Query + `react-infinite-scroll-component` |
| Styling | Tailwind CSS |
| Validation | Zod |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (React 19)                          │
│ ┌────────────┐  ┌──────────┐  ┌────────────┐  ┌─────────────────┐   │
│ │ Sign-in /  │  │ Feed +   │  │ Post detail│  │ Socket.IO client │   │
│ │ Sign-up    │  │ Profile  │  │ + Comments │  │ (Notifications)  │   │
│ │ (Clerk     │  │          │  │            │  │                  │   │
│ │ Elements)  │  │          │  │            │  │                  │   │
│ └────────────┘  └──────────┘  └────────────┘  └─────────────────┘   │
└──────────┬──────────────────────────┬──────────────────┬─────────────┘
           │                          │                  │
           │ HTTPS                    │ HTTPS            │ WebSocket
           ▼                          ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Custom Node Server (server.js)                     │
│  ┌─────────────────────────────────┐  ┌──────────────────────────┐  │
│  │  Next.js handler                │  │  Socket.IO server         │  │
│  │  - App Router pages             │  │  - newUser                │  │
│  │  - Server Actions (action.ts)   │  │  - sendNotification       │  │
│  │  - clerkMiddleware              │  │  - getNotification        │  │
│  │  - API routes                   │  │  - in-memory user list    │  │
│  └─────────────────────────────────┘  └──────────────────────────┘  │
└─────────┬─────────────┬─────────────────────────┬───────────────────┘
          │             │                         │
          │             │                         │
          ▼             ▼                         ▼
   ┌──────────┐  ┌──────────────┐         ┌──────────────┐
   │  Clerk   │  │   ImageKit   │         │   MySQL DB   │
   │ (auth +  │  │  (img/video  │         │  (Prisma     │
   │ sign-in) │  │  upload+CDN) │         │   schema)    │
   └────┬─────┘  └──────────────┘         └──────────────┘
        │
        │ Webhook (user.created/deleted)
        ▼
   /api/webhooks/clerk → writes User row to MySQL
```

## Request Flow Examples

### 1. User signs up
1. User visits `/sign-up` → `@clerk/elements` form
2. Submits → Clerk handles credentials/CAPTCHA externally
3. Clerk fires `user.created` webhook → `src/app/api/webhooks/clerk/route.ts`
4. Webhook verified via Svix → `prisma.user.create({ id: clerkId, ... })`
5. **From here on, the Clerk `userId` is the primary key throughout the DB.**

### 2. Loading the home feed (`/`)
1. `src/middleware.ts` → `clerkMiddleware` protects `/`. No session → redirect to `/sign-in`.
2. `src/app/(board)/page.tsx` → renders `<Feed />`
3. `Feed.tsx` (server component) → `await auth()` to get `userId`
4. Prisma query: posts where `userId IN (followed users + self)`, `parentPostId: null`
5. Client receives first 3 posts → `<InfiniteFeed />` mounts
6. `InfiniteFeed` (TanStack Query) → calls `/api/posts?cursor=2` for next pages
7. Each `<Image>` resolves through ImageKit's CDN URL.

### 3. Liking a post
1. User clicks heart → form submits to `likeAction` in `PostInteractions.tsx`
2. Optimistic UI updates via `useOptimistic`
3. Socket.IO emits `sendNotification` → server relays to receiver's socket → receiver's `Notification.tsx` adds badge
4. Server Action `likePost(postId)` in `action.ts` → `auth()` → `prisma.like.create/delete`

### 4. Creating a post
1. `/compose/post` modal route renders form
2. Form submits → `addPost` Server Action
3. If file present → uploaded to ImageKit, returns CDN path
4. `prisma.post.create({ ... img, video, userId })`
5. `revalidatePath("/")` refreshes the feed

## Database Schema (Prisma → MySQL)

```
User (id: String PK = Clerk userId)
  └─ posts: Post[]
  └─ likes: Like[]
  └─ saves: SavedPosts[]
  └─ followers: Follow[]   (people who follow me)
  └─ followings: Follow[]  (people I follow)

Post (id: Int PK)
  ├─ desc, img, imgHeight, video, isSensitive
  ├─ userId → User
  ├─ rePostId → Post (self-FK; nullable)        ← reposts
  └─ parentPostId → Post (self-FK; nullable)    ← comments

Like (userId, postId)
SavedPosts (userId, postId)
Follow (followerId, followingId)
```

**Key design choice:** comments and reposts are *also* `Post` rows, distinguished by `parentPostId` and `rePostId`. Top-level posts have both as `null`.

## Key Files & Their Role

| File | Role |
|---|---|
| `server.js` | Custom Next.js + Socket.IO server (NOT `next dev`) |
| `src/middleware.ts` | Clerk auth gate on `/` |
| `src/app/layout.tsx` | Wraps app in `<ClerkProvider>` and `<QueryProvider>` |
| `src/app/(board)/layout.tsx` | 3-column layout (LeftBar / feed / RightBar), parallel `@modal` slot |
| `src/action.ts` | Server Actions: follow, like, repost, save, addPost, addComment |
| `src/app/api/posts/route.ts` | Paginated feed/profile posts API |
| `src/app/api/webhooks/clerk/route.ts` | Syncs Clerk users → MySQL |
| `src/prisma.ts` | Prisma client singleton |
| `src/utils.ts` | ImageKit SDK instance (server-side uploads) |
| `src/socket.ts` | Socket.IO client singleton |
| `src/components/Image.tsx` | ImageKit-aware `<IKImage>` wrapper |

## External Dependencies (Friction Points)

These are the three external services the project currently can't run without:

| Service | Purpose | Env Vars | Cost / Friction |
|---|---|---|---|
| **Clerk** | Auth, user mgmt, sign-in UI | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `SIGNING_SECRET` | Free tier; needs dashboard config + ngrok for webhook in dev |
| **ImageKit** | Image/video upload + CDN + transformations | `NEXT_PUBLIC_PUBLIC_KEY`, `NEXT_PUBLIC_URL_ENDPOINT`, `PRIVATE_KEY` | Free tier; account required |
| **MySQL** | Persistent storage | `DATABASE_URL` | Free locally via Docker (already added) |

## Where Clerk Is Used (~14 files)

Clerk is woven deeply throughout the codebase:

- **Server side**: `auth()` is called in `action.ts`, `Feed.tsx`, `Recommendations.tsx`, `[username]/page.tsx`, `[postId]/page.tsx`, `api/posts/route.ts`. `currentUser()` in `LeftBar.tsx`. `clerkMiddleware` in `middleware.ts`.
- **Client side**: `useUser()` in `Comments.tsx`, `FollowButton.tsx`, `PostInteractions.tsx`, `Share.tsx`, `Socket.tsx`. `useClerk()` in `Logout.tsx`.
- **UI**: `<ClerkProvider>` in root layout. `@clerk/elements` in `sign-in` and `sign-up` pages.
- **Webhook**: `api/webhooks/clerk/route.ts` is the only path that creates `User` rows.

Removing Clerk requires touching all of these.

## How To Run (Current State)

```bash
docker compose up -d            # MySQL on :3306
npm install
# .env.local must have all 7 keys (3 Clerk + 3 ImageKit + 1 DB)
npx prisma generate
npx prisma db push
npx prisma db seed              # optional: 5 test users + posts
npm run dev                     # node server.js, port 3000
```

## Known Pain Points

1. **Clerk webhook needs a public URL** in dev (ngrok), otherwise new users never get a DB row → all queries fail for them.
2. **ImageKit is mandatory** even when not uploading anything: `Image.tsx` throws at module load if `NEXT_PUBLIC_URL_ENDPOINT` is missing.
3. **No tests exist** in the repo.
4. **`InfiniteFeed.tsx` hardcodes `http://localhost:3000`** for the API URL → breaks in production / different ports.
5. **In-memory online-users map** in `server.js` doesn't scale across multiple processes.
6. **No password-only auth path** — sign-up always requires email verification through Clerk.
