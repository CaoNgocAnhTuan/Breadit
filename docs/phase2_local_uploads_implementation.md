# Phase 2 Implementation Plan — Replace ImageKit with Local File Storage

## Goal

Strip every ImageKit dependency and replace it with self-hosted file storage under `public/uploads/`. The user-facing behavior (uploading a post image/video, rendering avatars/covers/icons) stays identical. The Prisma schema is unchanged — `Post.img`, `Post.video`, `User.img`, `User.cover` keep the same `String?` shape, just storing local URLs (`/uploads/<uuid>.<ext>`) instead of ImageKit paths. Upload-time cropping moves from ImageKit transformations to `sharp`; runtime resizing moves to Next.js's built-in `<Image>` optimizer.

---

## Step 0 — Snapshot

```bash
git checkout -b feat/local-uploads      # if using git
docker compose down                      # so we can change build args cleanly
```

---

## Step 1 — Install / Remove Packages

```bash
npm uninstall imagekit imagekitio-next
npm install sharp
```

Verify `package.json` no longer contains any `imagekit*` entry.

---

## Step 2 — Fix Missing Placeholder Assets

Code already references `general/noAvatar.png`, `general/noCover.png`, `general/event.png`, but `public/general/` actually contains differently-named files. Rename them so the existing `path={user.img || "general/noAvatar.png"}` fallbacks resolve:

```bash
cd public/general
mv avatar.png  noAvatar.png
mv cover.jpg   noCover.png
mv post.jpeg   event.png
```

Create the uploads directory and a placeholder so it's preserved in git:

```bash
mkdir -p public/uploads
touch public/uploads/.gitkeep
```

Add to `.gitignore`:
```
/public/uploads/*
!/public/uploads/.gitkeep
```

---

## Step 3 — Replace `src/utils.ts`

Replace the entire file with a local upload helper:

```ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export type UploadResult = {
  filePath: string;        // public URL like "/uploads/abc.jpg"
  height: number;          // 0 for video
  fileType: "image" | "video";
};

export async function uploadFile(
  file: File,
  imgType: "original" | "square" | "wide"
): Promise<UploadResult> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  const isImage = file.type.startsWith("image/");

  if (isImage) {
    let pipeline = sharp(buffer).resize({ width: 600, withoutEnlargement: true });
    if (imgType === "square") {
      pipeline = sharp(buffer).resize(600, 600, { fit: "cover" });
    } else if (imgType === "wide") {
      pipeline = sharp(buffer).resize(600, 338, { fit: "cover" }); // 16:9
    }
    const out = await pipeline.jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
    const name = `${randomUUID()}.jpg`;
    await fs.writeFile(path.join(UPLOAD_DIR, name), out.data);
    return { filePath: `/uploads/${name}`, height: out.info.height, fileType: "image" };
  }

  // video — write as-is, no transformation
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  const name = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);
  return { filePath: `/uploads/${name}`, height: 0, fileType: "video" };
}
```

Key decisions:
- The return shape (`filePath`, `height`, `fileType`) **matches what `action.ts` already reads from ImageKit's `UploadResponse`**, so `addPost` needs only an import swap.
- Images normalize to `.jpg` (smaller, predictable). Videos keep their original extension.
- `withoutEnlargement: true` avoids upscaling small images.

---

## Step 4 — Update `src/action.ts`

```diff
- import { UploadResponse } from "imagekit/dist/libs/interfaces";
- import { imagekit } from "./utils";
+ import { uploadFile } from "./utils";
```

Delete the inner `uploadFile` helper inside `addPost` (the `imagekit.upload(...)` Promise wrapper) and replace its single call site:

```diff
  if (file.size) {
-   const result: UploadResponse = await uploadFile(file);
+   const result = await uploadFile(
+     file,
+     (imgType as "original" | "square" | "wide") ?? "original"
+   );

    if (result.fileType === "image") {
      img = result.filePath;
      imgHeight = result.height;
    } else {
      video = result.filePath;
    }
  }
```

The DB write (`prisma.post.create`) is untouched — it just stores the `/uploads/...` URL as `img`/`video`.

---

## Step 5 — Replace `src/components/Image.tsx`

```tsx
"use client";

import NextImage from "next/image";

type ImageType = {
  path?: string;
  src?: string;
  w?: number;
  h?: number;
  alt: string;
  className?: string;
  tr?: boolean; // kept for API compat — Next/Image always optimizes
};

const resolve = (path?: string, src?: string) => {
  if (src) return src;
  if (!path) return "";
  return path.startsWith("/") ? path : `/${path}`;
};

const Image = ({ path, src, w, h, alt, className, tr: _tr }: ImageType) => {
  const url = resolve(path, src);
  if (!url) return null;
  return (
    <NextImage
      src={url}
      width={w ?? 100}
      height={h ?? 100}
      alt={alt}
      className={className}
      unoptimized={url.startsWith("blob:") || url.startsWith("data:")}
    />
  );
};

export default Image;
```

- No more module-load throw on missing env (the build no longer needs `NEXT_PUBLIC_URL_ENDPOINT`).
- Path normalization: `icons/logo.svg` → `/icons/logo.svg`, `general/noAvatar.png` → `/general/noAvatar.png`, `/uploads/abc.jpg` passes through.
- The `tr` prop is kept (no-op) so existing call sites compile unchanged.

---

## Step 6 — Replace `src/components/Video.tsx`

```tsx
"use client";

type VideoTypes = { path: string; className?: string };

const Video = ({ path, className }: VideoTypes) => {
  const url = path.startsWith("/") ? path : `/${path}`;
  return <video src={url} controls className={className} />;
};

export default Video;
```

The watermark overlay (`l-text,i-LamaDev,...`) is dropped — not worth re-implementing locally. If you ever want one, do it client-side with CSS.

---

## Step 7 — Clean Up `src/components/Post.tsx`

Remove the unused first line:
```diff
- import { imagekit } from "@/utils";
```
The symbol isn't referenced anywhere in the file (verified by grep).

---

## Step 8 — Update `next.config.ts`

Drop the now-useless ImageKit `remotePatterns` entry:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
```

`public/` is served by Next.js automatically — no `remotePatterns` needed for same-origin assets.

---

## Step 9 — Environment Variables

**`.env`** — remove these three lines:
```
NEXT_PUBLIC_PUBLIC_KEY=...
NEXT_PUBLIC_URL_ENDPOINT=...
PRIVATE_KEY=...
```

**`.env.example`** — same removal. Final shape:
```
DATABASE_URL=mysql://breadit:breaditpassword@localhost:3306/breadit
AUTH_SECRET=
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
```

---

## Step 10 — Update `Dockerfile`

Drop the `ARG`/`ENV` propagation for ImageKit vars in the builder stage. Final builder stage:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build
```

> **If the build fails with a `sharp` native error on Alpine** (known libc issue with prebuilt binaries), swap the runner stage to `node:20-bookworm-slim`:
> ```dockerfile
> FROM node:20-bookworm-slim AS runner
> RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
> ```

---

## Step 11 — Update `docker-compose.yml`

- Remove `NEXT_PUBLIC_PUBLIC_KEY`, `NEXT_PUBLIC_URL_ENDPOINT`, `PRIVATE_KEY` from both `build.args` and `environment`.
- Add a named volume so uploads persist across `docker compose up --build`:

```yaml
  app:
    # ... existing config
    volumes:
      - uploads_data:/app/public/uploads

volumes:
  mysql_data:
  uploads_data:
```

---

## Step 12 — Verification Checklist

1. `grep -rn "imagekit\|IKImage\|IKVideo\|NEXT_PUBLIC_PUBLIC_KEY\|NEXT_PUBLIC_URL_ENDPOINT" src/` → empty.
2. `grep -E "PUBLIC_KEY|URL_ENDPOINT|PRIVATE_KEY" .env .env.example` → empty.
3. `docker compose down -v && docker compose up -d --build` → both services healthy.
4. `curl -sf http://localhost:3000/sign-in` → 200.
5. Sign in as `user1@example.com` / `password`.
6. Home feed renders. Avatar fallback (`/general/noAvatar.png`) loads (no broken-image icon).
7. Open `/compose/post`, attach an image (try square + wide settings), submit → post appears in the feed with the cropped image.
8. `docker compose exec app ls /app/public/uploads/` shows the new `<uuid>.jpg`.
9. `docker compose restart app` → uploaded image still visible (volume persisted).
10. Repeat with a video → `<video>` element plays.
11. `docker compose down && docker compose up -d` (without `-v`) → uploads still present.

---

## Files Touched (Summary)

**Modified (9):**
- `src/utils.ts`
- `src/action.ts`
- `src/components/Image.tsx`
- `src/components/Video.tsx`
- `src/components/Post.tsx`
- `next.config.ts`
- `.env`, `.env.example`
- `Dockerfile`
- `docker-compose.yml`
- `package.json`, `package-lock.json`
- `.gitignore`

**Created (1):**
- `public/uploads/.gitkeep`

**Renamed (3):**
- `public/general/avatar.png` → `noAvatar.png`
- `public/general/cover.jpg` → `noCover.png`
- `public/general/post.jpeg` → `event.png`

---

## Estimated Effort

| Block | Time |
|---|---|
| Steps 1–2 (deps + assets) | 10 min |
| Steps 3–4 (upload helper + action) | 30 min |
| Steps 5–7 (Image/Video/Post cleanup) | 20 min |
| Steps 8–11 (env + Docker) | 15 min |
| Step 12 (verify) | 30 min |
| **Total** | **~1.5 hours** |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `sharp` prebuilt fails on `node:20-alpine` | Switch the runner image to `node:20-bookworm-slim` (Step 10 note). |
| Existing DB rows have ImageKit-style `img` paths (e.g. `/posts/abc`) | Dev-only — `docker compose down -v && docker compose up -d --build` wipes and reseeds. |
| Uploaded files lost on `docker compose down -v` | Expected; document in README that `-v` wipes volumes. Daily restarts (`down` without `-v`) preserve them. |
| `next/image` rejects relative paths during SSR | Step 5's `resolve()` always produces leading-slash URLs which Next.js treats as same-origin. |
| Body size limit on Server Actions for large videos | Already raised to 50 MB in `next.config.ts`. |
| Anonymous-access to `/uploads/*` | Files in `public/` are world-readable. Acceptable for a Twitter clone (posts are public anyway). For private uploads, move to `app/api/files/[...]/route.ts` with auth. |

---

## Out of Scope (Phase 3)

- Fixing the hardcoded `http://localhost:3000` in `src/components/InfiniteFeed.tsx:9`.
- Adding `dev:reset` npm script.
- Replacing the dev-mode `AUTH_SECRET` default.
- Migrating uploads to S3-compatible storage (MinIO) for multi-instance deployments.
