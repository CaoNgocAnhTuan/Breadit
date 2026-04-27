# Restructure Plan — Local-First, No External Auth

## Goals

1. **Remove Clerk** — replace with a self-hosted, local-first auth solution.
2. **Remove ImageKit dependency for local dev** — store/serve uploads from the local filesystem (or MinIO if you want S3-compatible later).
3. **Make the project runnable with just `docker compose up + npm run dev`** — no external accounts, no webhooks, no ngrok.
4. **Preserve the existing Prisma schema and data shape** — so seed data and DB queries keep working.

---

## Recommended Approach: Auth.js (NextAuth v5) with Credentials Provider

[Auth.js](https://authjs.dev) is the de-facto open-source auth library for Next.js. It supports a **Credentials provider** (email + password against your own DB) and stores sessions in cookies — no third-party service needed.

### Why Auth.js over rolling our own?

| Criterion | Auth.js | DIY (jose + cookies) | Lucia |
|---|---|---|---|
| Setup time | Low | Medium | Medium |
| Maintained | Active | n/a | **Deprecated as of 2025** |
| Next.js App Router support | First-class | Manual | Adapter |
| Prisma adapter | Yes (`@auth/prisma-adapter`) | n/a | Yes |
| Future OAuth migration | Drop-in providers | Rewrite | Rewrite |

### What stays the same

- Prisma schema for `User`, `Post`, `Like`, `Follow`, `SavedPosts` — **no changes**.
- Server Actions, API routes, feed logic — unchanged.
- Socket.IO real-time notifications — unchanged.
- The contract that "the user's `id` is a `String` PK" — preserved (Auth.js generates `cuid`s, fits a `String` PK).

---

## Phase-by-Phase Plan

### Phase 1 — Replace Clerk with Auth.js  ✅ **DONE**

> **Status: Completed.** See `docs/phase1_auth_js_implementation.md` for the executed step-by-step plan. All Clerk imports were replaced with Auth.js, sign-in/sign-up rewritten as plain credential forms, the Clerk webhook deleted, and the app verified end-to-end inside Docker. Seed users sign in with `userN@example.com` / `password`.

**1.1 Install dependencies**
```bash
npm uninstall @clerk/nextjs @clerk/elements svix
npm install next-auth@beta @auth/prisma-adapter bcryptjs
npm install -D @types/bcryptjs
```

**1.2 Extend Prisma schema** — add `password` and Auth.js session tables:
```prisma
model User {
  // ... existing fields
  password      String?    // bcrypt hash for credentials login
  accounts      Account[]
  sessions      Session[]
}

model Account { ... }   // standard Auth.js model
model Session { ... }
model VerificationToken { ... }
```
Then `npx prisma db push`.

**1.3 Create `src/auth.ts`** — Auth.js config with Credentials provider:
- `authorize()` callback: find user by email, `bcrypt.compare()` password → return user object
- Prisma adapter for Account/Session persistence
- Session strategy: `"jwt"` (avoids extra DB hits per request)

**1.4 Replace each Clerk call site** (mechanical translation):

| Clerk | Auth.js |
|---|---|
| `import { auth } from "@clerk/nextjs/server"` | `import { auth } from "@/auth"` |
| `const { userId } = await auth()` | `const session = await auth(); const userId = session?.user?.id` |
| `currentUser()` | `auth()` then read `session.user` |
| `useUser()` | `useSession()` from `next-auth/react` |
| `useClerk().signOut()` | `signOut()` from `next-auth/react` |
| `<ClerkProvider>` | `<SessionProvider>` (only needed if you want client-side session reactivity) |
| `clerkMiddleware` | `auth` middleware export from `src/auth.ts` |
| `@clerk/elements` sign-in form | Plain HTML form → `signIn("credentials", { email, password })` |
| `/api/webhooks/clerk` | **Delete** — user creation now happens directly in our `/api/auth/register` route |

**1.5 Replace `sign-in` / `sign-up` pages** with plain forms:
- `sign-in/page.tsx` → email + password → calls `signIn("credentials", ...)`
- `sign-up/page.tsx` → username + email + password → POSTs to a new `/api/auth/register` route which: validates with Zod → `bcrypt.hash` → `prisma.user.create` → auto-signs in.

**1.6 Delete Clerk-specific files:**
- `src/app/api/webhooks/clerk/route.ts`

---

### Phase 2 — Replace ImageKit with Local File Storage  ✅ **DONE**

> **Status: Completed.** See `docs/phase2_local_uploads_implementation.md` for the full step-by-step plan. ImageKit packages removed, `sharp`-based `uploadFile()` helper written, `Image.tsx`/`Video.tsx` rewritten to use native Next.js `<Image>` and `<video>`, placeholder assets renamed, ImageKit env vars removed, and an `uploads_data` Docker volume added for persistence.

**2.1 Swap deps:** `npm uninstall imagekit imagekitio-next && npm install sharp`.

**2.2 Replace `src/utils.ts`** with a `uploadFile()` helper that uses `sharp` (square → 1:1, wide → 16:9, original → max-600px width) and writes to `public/uploads/<uuid>.jpg|<ext>`. Returns `{ filePath, height, fileType }` — same shape `action.ts` already consumes, so `addPost` only needs an import swap.

**2.3 Rewrite `src/components/Image.tsx`** to wrap Next.js's `<Image>`. Drop the module-load env-var throw. Path normalization: `icons/x.svg` → `/icons/x.svg`, paths already starting with `/` (uploads) pass through.

**2.4 Rewrite `src/components/Video.tsx`** as a plain `<video src controls>` (drop the watermark overlay).

**2.5 Fix missing placeholders** in `public/general/` — rename `avatar.png → noAvatar.png`, `cover.jpg → noCover.png`, `post.jpeg → event.png` to match the names already referenced in code.

**2.6 Drop ImageKit env vars** from `.env`, `.env.example`, `Dockerfile` build args, and `docker-compose.yml`. Add a `uploads_data` named volume mounted at `/app/public/uploads` so user uploads survive `docker compose up --build`.

**2.7 Remove dead `import { imagekit }`** in `src/components/Post.tsx` and the `remotePatterns: ik.imagekit.io` block in `next.config.ts`.

---

### Phase 3 — Quality-of-Life Cleanups  ✅ **DONE**

> **Status: Completed.** Hardcoded `http://localhost:3000` replaced with a relative URL in `InfiniteFeed.tsx`, debug `console.log` removed, and `dev:reset` npm script added. `Image.tsx` module-load throw was eliminated in Phase 2. `.env.example` already reflects the minimal 4-var setup.

**3.1 Fix hardcoded URL** in `src/components/InfiniteFeed.tsx:9`:
```ts
// Before:
const res = await fetch("http://localhost:3000/api/posts?...")
// After:
const res = await fetch(`/api/posts?cursor=${pageParam}&user=${userProfileId}`)
```

**3.2 Remove `Image.tsx` module-load throw** — done in Phase 2.

**3.3 `.env.example`** already has only the 4 required vars (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`).

**3.4 Add a `dev:reset` npm script** — `"dev:reset": "npx prisma db push --force-reset && npx prisma db seed"`.

---

## Final State — How To Run

```bash
docker compose up -d
npm install
cp .env.local.example .env.local   # only 3 vars now
npx prisma db push
npx prisma db seed                 # seeds users with default password "password"
npm run dev
```

That's it. No accounts, no dashboards, no webhooks, no ngrok.

---

## Effort Estimate

| Phase | Files touched | Effort |
|---|---|---|
| Phase 1 — Auth.js | ~14 files (every Clerk import) + 2 new pages | ~3–4 hours |
| Phase 2 — Local uploads | 4 files (`utils.ts`, `Image.tsx`, `action.ts`, schema seed) | ~1–2 hours |
| Phase 3 — Cleanups | 2–3 files | ~30 min |

**Total: ~half a day** for a clean, fully local-first setup.

---

## Migration Risk & Rollback

- **Risk**: Existing users in DB (from Clerk) won't have a `password` — they'd need a "set password" flow. **Mitigation**: since this is dev-only, just `npx prisma migrate reset` and re-seed.
- **Rollback**: keep the Clerk-using files on a `feat/clerk` branch; this work goes on `feat/local-auth`. If Auth.js doesn't fit, you can return to Clerk without losing the schema work.

---

## Alternative Considered: Skip Auth Entirely (Dev-Only)

If you only need this for local development demos, the **fastest** path is to skip auth entirely:

- Replace every `await auth()` with `return { userId: "user1" }` (the seed user)
- Delete sign-in/sign-up pages
- Pin the "current user" to a seeded test account

This is ~30 min of work but means you can never demo the app to a second user. **Recommended only for solo dev / screenshots.**

The Auth.js approach above is the right call if you ever want this app to be usable beyond your machine.
