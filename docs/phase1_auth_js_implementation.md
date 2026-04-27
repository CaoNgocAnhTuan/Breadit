# Phase 1 Implementation Plan — Replace Clerk with Auth.js (NextAuth v5)

## Goal

Strip every Clerk dependency and replace it with self-hosted credentials auth (email + password) using Auth.js v5. The user-facing behavior (sign in, sign up, protected routes, current-user awareness) stays identical. The schema additions are minimal and the Clerk `userId` PK convention is preserved.

---

## Step 0 — Branch & Snapshot

```bash
git checkout -b feat/local-auth
git add -A && git commit -m "snapshot before auth.js migration"
```

This way any step can be rolled back.

---

## Step 1 — Install / Remove Packages

```bash
npm uninstall @clerk/nextjs @clerk/elements svix
npm install next-auth@beta @auth/prisma-adapter bcryptjs
npm install -D @types/bcryptjs
```

Verify `package.json` no longer contains any `@clerk/*` or `svix` entry.

---

## Step 2 — Extend Prisma Schema

**File:** `prisma/schema.prisma`

Add `password` to `User` and the three Auth.js tables. `User.id` stays a `String` (currently filled by Clerk → now filled by `cuid()`).

```prisma
model User {
  id            String    @id @default(cuid())     // ← change: default cuid()
  email         String    @unique
  username      String    @unique
  password      String?                             // ← new: bcrypt hash
  emailVerified DateTime?                           // ← new: required by Auth.js
  displayName   String?
  bio           String?
  location      String?
  job           String?
  website       String?
  img           String?
  cover         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  posts        Post[]
  likes        Like[]
  saves        SavedPosts[]
  followers    Follow[]    @relation("UserFollowers")
  followings   Follow[]    @relation("UserFollowings")
  accounts     Account[]                             // ← new
  sessions     Session[]                             // ← new
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

Apply:

```bash
npx prisma db push
npx prisma generate
```

Update `prisma/seed.ts`: hash a default password and inline it on seeded users.
```ts
import bcrypt from "bcryptjs";
const passwordHash = await bcrypt.hash("password", 10);
// in user.create: password: passwordHash, emailVerified: new Date()
```

---

## Step 3 — Create the Auth.js Config

**New file:** `src/auth.ts`

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (raw) => {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(1) })
          .safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.password) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.password);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          image: user.img ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.username) session.user.username = token.username as string;
      return session;
    },
  },
});
```

**New file:** `src/types/next-auth.d.ts` — augment session typing:
```ts
import "next-auth";
declare module "next-auth" {
  interface Session {
    user: { id: string; username: string; email?: string | null; image?: string | null };
  }
}
```

---

## Step 4 — Replace the Middleware

**File:** `src/middleware.ts` — replace entirely:

```ts
export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    "/((?!_next|sign-in|sign-up|api/auth|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)",
  ],
};
```

Then add a redirect rule in `src/auth.ts` callbacks:
```ts
authorized({ auth, request: { nextUrl } }) {
  const isLoggedIn = !!auth?.user;
  const isAuthPage = nextUrl.pathname.startsWith("/sign-in")
                   || nextUrl.pathname.startsWith("/sign-up");
  if (isAuthPage) return true;
  return isLoggedIn;
},
```

---

## Step 5 — Add the Auth API Routes

**New file:** `src/app/api/auth/[...nextauth]/route.ts`
```ts
export { GET, POST } from "@/auth";
```
(Re-exports the handlers Auth.js needs.)

**New file:** `src/app/api/auth/register/route.ts` — handles sign-up:
```ts
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/prisma";

const Body = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { username, email, password } = parsed.data;

  const dup = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (dup) {
    return Response.json({ error: "Email or username already taken" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, username, password: hashed, displayName: username, emailVerified: new Date() },
    select: { id: true },
  });
  return Response.json({ ok: true, userId: user.id });
}
```

**Delete:** `src/app/api/webhooks/clerk/route.ts` (no longer needed — registration now creates the User directly).

---

## Step 6 — Rewrite Sign-In / Sign-Up Pages

**File:** `src/app/sign-in/[[...sign-in]]/page.tsx` — replace whole `<SignIn.Root>` block with a plain form:
```tsx
"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null); setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: fd.get("email"),
      password: fd.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) setError("Invalid email or password");
    else router.push("/");
  };

  return (
    /* keep existing layout/styling — only swap the form body */
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input name="email" type="email" required className="..." placeholder="Email" />
      <input name="password" type="password" required className="..." placeholder="Password" />
      {error && <p className="text-red-300 text-sm">{error}</p>}
      <button disabled={loading} className="...">Sign in</button>
      <Link href="/sign-up">Create account</Link>
    </form>
  );
}
```

**File:** `src/app/sign-up/[[...sign-up]]/page.tsx` — same pattern: form posts to `/api/auth/register`, on 200 calls `signIn("credentials", ...)` to auto-login.

Keep the existing visual layout (logo, gradients, copy) — only the form body changes. Delete every `Clerk.Connection` (Google/Apple) block.

---

## Step 7 — Replace Provider in Root Layout

**File:** `src/app/layout.tsx`
```tsx
import { SessionProvider } from "next-auth/react";
// remove: import { ClerkProvider } from "@clerk/nextjs";

export default function AppLayout({ children }) {
  return (
    <SessionProvider>
      <QueryProvider>
        <html lang="en">
          <body>{children}</body>
        </html>
      </QueryProvider>
    </SessionProvider>
  );
}
```

---

## Step 8 — Mechanical Server-Side Replacements

For each of these files, replace Clerk imports + calls with the new `auth()`:

| File | Change |
|---|---|
| `src/action.ts` | `import { auth } from "@clerk/nextjs/server"` → `from "@/auth"`. Every `const { userId } = await auth()` → `const session = await auth(); const userId = session?.user?.id;` |
| `src/components/Feed.tsx` | Same import swap + `userId` extraction |
| `src/components/Recommendations.tsx` | Same |
| `src/app/(board)/[username]/page.tsx` | Same |
| `src/app/(board)/[username]/status/[postId]/page.tsx` | Same |
| `src/app/api/posts/route.ts` | Same |
| `src/components/LeftBar.tsx` | `currentUser()` → `auth()`, then read `session?.user`. Replace `user?.imageUrl` with `user?.image`, `user?.username` stays |

**Snippet for the typical replacement:**
```ts
// before
import { auth } from "@clerk/nextjs/server";
const { userId } = await auth();

// after
import { auth } from "@/auth";
const session = await auth();
const userId = session?.user?.id;
```

---

## Step 9 — Mechanical Client-Side Replacements

| File | Change |
|---|---|
| `src/components/Comments.tsx` | `useUser()` → `useSession()`. `user.username` → `session?.user?.username`. `user?.imageUrl` → `session?.user?.image` |
| `src/components/FollowButton.tsx` | Same |
| `src/components/PostInteractions.tsx` | Same |
| `src/components/Share.tsx` | Same |
| `src/components/Socket.tsx` | `useUser()` → `useSession()`. `user.username` lookup unchanged |
| `src/components/Logout.tsx` | `useClerk().signOut()` → `import { signOut } from "next-auth/react"; signOut()` |

**Snippet for the typical client replacement:**
```ts
// before
import { useUser } from "@clerk/nextjs";
const { user } = useUser();

// after
import { useSession } from "next-auth/react";
const { data: session } = useSession();
const user = session?.user;       // user.id, user.username, user.image
```

---

## Step 10 — Environment Variables

**File:** `.env.local`

Remove:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
SIGNING_SECRET=
```

Add:
```
AUTH_SECRET=<run: openssl rand -base64 32>
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
```

Update `.env.example` to match.

---

## Step 11 — Verification Checklist

Run through these end-to-end:

1. `docker compose up -d`
2. `npx prisma migrate reset` → confirm wipe → reseed (seeded users now have password `"password"`)
3. `npm run dev`
4. Visit `/` → redirected to `/sign-in` ✓
5. Sign in as `user1@example.com` / `password` → redirected to `/` ✓
6. Feed loads with posts from followed users ✓
7. Click a post → comments load ✓
8. Like a post → counter increments, no console errors ✓
9. Open `/user2` → follow → second tab logged in as `user2` sees notification badge ✓
10. Logout button → returns to `/sign-in` ✓
11. `/sign-up` → register a new user → auto-login → can post ✓
12. **`grep -r "@clerk\|svix" src/` returns nothing** ✓

---

## Files Touched (Summary)

**Modified (15):**
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/middleware.ts`
- `src/app/layout.tsx`
- `src/app/sign-in/[[...sign-in]]/page.tsx`
- `src/app/sign-up/[[...sign-up]]/page.tsx`
- `src/action.ts`
- `src/components/Feed.tsx`
- `src/components/Recommendations.tsx`
- `src/components/LeftBar.tsx`
- `src/components/Comments.tsx`
- `src/components/FollowButton.tsx`
- `src/components/PostInteractions.tsx`
- `src/components/Share.tsx`
- `src/components/Socket.tsx`
- `src/components/Logout.tsx`
- `src/app/(board)/[username]/page.tsx`
- `src/app/(board)/[username]/status/[postId]/page.tsx`
- `src/app/api/posts/route.ts`
- `.env.local` / `.env.example`
- `package.json` / `package-lock.json`

**Created (4):**
- `src/auth.ts`
- `src/types/next-auth.d.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/auth/register/route.ts`

**Deleted (1):**
- `src/app/api/webhooks/clerk/route.ts`

---

## Estimated Effort

| Step | Time |
|---|---|
| 1–2 (deps + schema) | 20 min |
| 3–5 (auth.ts + routes) | 45 min |
| 6 (sign-in / sign-up UI) | 45 min |
| 7–9 (mechanical swaps) | 60 min |
| 10–11 (env + verify) | 30 min |
| **Total** | **~3.5 hours** |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Existing DB has Clerk-style user IDs (e.g. `user_2x...`) without passwords | Run `prisma migrate reset` — dev data only. Re-seed gives clean state. |
| Auth.js session typing not picking up `username` | Ensure `src/types/next-auth.d.ts` is included in `tsconfig.json` (it is via `"include": ["**/*.ts"]`) |
| Middleware redirect loop on `/sign-in` | The `matcher` config in Step 4 explicitly excludes `/sign-in`, `/sign-up`, `/api/auth` |
| Client `useSession()` returns null on first render | Already handled — every call site already gates UI on `if (!user) return` |
| `imageUrl` (Clerk) vs `image` (Auth.js) differing field name | Search-and-replace; the `User.img` DB column is the source of truth via `session.user.image` |

---

## Out of Scope (handled in later phases)

- Removing ImageKit (Phase 2 of `restructure_plan.md`)
- Fixing the hardcoded `http://localhost:3000` in `InfiniteFeed.tsx` (Phase 3)
- Adding email verification / password reset flows
- Adding OAuth providers (Google etc.) — trivially added later via Auth.js providers
