# Phase 9 — v1 Hardening

## What Was Implemented

Phase 9 hardens the application for a production-ready first release across four areas:

1. **Cloudinary CDN** — media files are now uploaded to Cloudinary instead of local disk. `sharp` is retained as a local fallback when Cloudinary credentials are absent. The backend returns a full `https://res.cloudinary.com/…` URL from `POST /api/uploads`, which is stored directly in the database. Old records with bare filenames continue to resolve correctly via the existing local path logic.

2. **Rate limiting** — `@nestjs/throttler` is applied globally (120 req/min default). Auth mutation endpoints are tightened individually: register/login/verify at 10 req/min; forgot-password, reset-password, and verify/resend at 5 req/min. Read-only endpoints skip the throttle entirely.

3. **OpenGraph / SEO meta** — `generateMetadata()` is exported from the profile page and post permalink page. Both pages now emit `og:title`, `og:description`, `og:image`, and Twitter card tags, enabling link previews in messaging apps and social media.

4. **Frontend error boundaries** — Next.js App Router `error.tsx` files are placed at three levels: board layout, profile page, and post permalink page. Each renders a user-facing "Could not load…" message with a retry button instead of a blank crash.

---

## Prerequisites Applied

No database migration required. Cloudinary credentials are passed via three environment variables:

```
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>
```

When these are absent the service falls back to local disk (Phase 3 behaviour unchanged).

---

## Backend

### Updated: `UploadsService`

**File:** `apps/backend/src/uploads/uploads.service.ts`

`saveFile(file, imgType)` now branches on `CLOUDINARY_CLOUD_NAME`:

| Path | Behaviour |
|------|-----------|
| Cloudinary (env set) | Streams the buffer to `cloudinary.uploader.upload_stream`; applies transformation from `imgType`; returns `secure_url`. |
| Local disk (env absent) | Same `sharp` + `fs.writeFile` behaviour as Phase 3; returns bare filename. |

`imgType` → Cloudinary transformation mapping:

| `imgType` | Transformation |
|-----------|----------------|
| `square` | `w_600,h_600,c_fill` |
| `wide` | `w_600,h_338,c_fill` |
| `original` / absent | `w_1200,c_limit` |

Videos are uploaded with `resource_type: 'video'` and no transformation.

The `OnModuleInit` hook (mkdir) is skipped when Cloudinary is active. `fastifyStatic` is retained in `main.ts` to continue serving any files written to local disk in prior phases.

**Return value change:** when Cloudinary is active, `POST /api/uploads` returns `{ "filename": "https://res.cloudinary.com/…" }` — a full URL. Callers (`EditProfileModal.tsx`, `Share.tsx`) pass this value straight to the DB; no other changes needed on the caller side.

---

### Updated: `AppModule`

**File:** `apps/backend/src/app.module.ts`

`ThrottlerModule.forRoot` registered with a single throttler: **ttl 60 000 ms, limit 120**. A global `APP_GUARD` provider wraps `ThrottlerGuard` so every route is covered without per-controller decoration.

```ts
ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])
providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
```

---

### Updated: `AuthController`

**File:** `apps/backend/src/auth/auth.controller.ts`

| Route | Throttle |
|-------|---------|
| `POST /api/auth/register` | 10 req / 60 s |
| `POST /api/auth/login` | 10 req / 60 s |
| `POST /api/auth/verify` | 10 req / 60 s |
| `POST /api/auth/verify/resend` | 5 req / 60 s |
| `POST /api/auth/forgot-password` | 5 req / 60 s |
| `POST /api/auth/reset-password` | 5 req / 60 s |
| `GET /api/auth/me` | `@SkipThrottle()` |
| `POST /api/auth/logout` | global default (120 / 60 s) |

Throttle limits are expressed via `@Throttle({ default: { ttl, limit } })` per route. `@SkipThrottle()` on `GET /api/auth/me` prevents the session check from counting against any limit.

When a client exceeds a limit the backend returns **HTTP 429 Too Many Requests**.

---

## Frontend

### Updated: `Image.tsx`

**File:** `apps/frontend/src/components/Image.tsx`

`resolve()` now handles full HTTPS URLs passed via the `path` prop (Cloudinary URLs start with `https://`). Without this fix they were mangled to `/https://…`:

```ts
if (p.startsWith("http://") || p.startsWith("https://")) return p;
```

This line is inserted before the existing bare-filename check, so the resolution order is:

1. `src` prop → return as-is
2. `path` starts with `http(s)://` → return as-is *(new)*
3. `path` has no `/` → prepend `BACKEND_URL/uploads/` (bare filename, old records)
4. `path` starts with `/` → return as-is
5. Otherwise → prepend `/`

---

### Updated: `next.config.ts`

**File:** `apps/frontend/next.config.ts`

`res.cloudinary.com` added to `remotePatterns` so Next.js `<Image>` accepts Cloudinary URLs:

```ts
{ protocol: "https", hostname: "res.cloudinary.com" }
```

The existing `localhost:4000` pattern is retained for local-disk fallback and development.

---

### Updated: `[username]/page.tsx`

**File:** `apps/frontend/src/app/(board)/[username]/page.tsx`

`generateMetadata()` added. Fetches the user via `serverFetch` (reuses the session-aware helper already present in the file) and builds:

| Tag | Value |
|-----|-------|
| `<title>` | `{displayName} (@{username})` |
| `og:title` | same |
| `og:description` | `bio` (omitted if empty) |
| `og:image` | resolved avatar URL (omitted if none) |
| `twitter:card` | `summary` |

A `resolveImg(path)` helper mirrors `Image.tsx` resolution but server-side, using `BACKEND_INTERNAL_URL` so it works inside the Docker network.

---

### Updated: `[username]/status/[postId]/page.tsx`

**File:** `apps/frontend/src/app/(board)/[username]/status/[postId]/page.tsx`

`generateMetadata()` added. Fetches the post via `serverFetch` and builds:

| Tag | Value |
|-----|-------|
| `<title>` | `{author}: "{post text truncated to 80 chars}"` |
| `og:title` | same |
| `og:description` | full `post.desc` (omitted if empty) |
| `og:image` | post image if present, else author avatar |
| `twitter:card` | `summary_large_image` if image present, else `summary` |

---

### New: Error boundaries

Three `error.tsx` files following the Next.js App Router convention (must be `"use client"`):

| File | Scope |
|------|-------|
| `apps/frontend/src/app/(board)/error.tsx` | Board layout — catches errors in the shared layout or any unhandled child page |
| `apps/frontend/src/app/(board)/[username]/error.tsx` | Profile page — shown when the user profile RSC throws |
| `apps/frontend/src/app/(board)/[username]/status/[postId]/error.tsx` | Post permalink — shown when a deleted or missing post causes a render error |

Each renders a plain message (e.g. "Could not load this profile.") and a **Try again** button that calls the `reset()` prop provided by Next.js to retry the failed render.

---

## Use Cases Delivered

| Area | Description | Status |
|------|-------------|--------|
| Storage | Media uploaded to Cloudinary CDN; URL stored in DB | ✅ |
| Security | Auth endpoints rate-limited; global 120 req/min guard | ✅ |
| SEO | OG + Twitter card meta on profile and post permalink pages | ✅ |
| Resilience | Error boundaries on board, profile, and post routes | ✅ |

---

## Phase 9 Exit Checklist

- [x] Upload avatar → `POST /api/uploads` returns a `res.cloudinary.com` URL; image displays in Share box and LeftBar.
- [x] Upload a post image → displays in feed via Cloudinary URL.
- [x] Old posts with bare filenames still display (local resolution unchanged).
- [x] `POST /api/auth/login` 11× within 60 s → 11th request returns **429**.
- [x] Profile `<head>` contains `og:title` with display name.
- [x] Post permalink `<head>` contains `og:title` with author and text.
- [x] Navigate to a broken route → error boundary renders with retry button.
- [x] `npm run build -w @breadit/backend` — clean.
- [x] `npm run typecheck` — clean.
- [x] `npm run lint -w @breadit/frontend` — warnings only (all pre-existing).
