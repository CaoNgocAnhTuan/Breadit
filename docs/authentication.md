# Authentication and Authorization

This document outlines the authentication and authorization architecture of Breadit.

## 1. Authentication Overview

Breadit uses a **Custom JWT-based Authentication** system instead of traditional session-based libraries like NextAuth.js (Auth.js). 

### Core Components:
- **Cookie-based Sessions:** The backend issues a `breadit_session` httpOnly, secure cookie upon successful login or registration.
- **Stateless JWT:** The session is managed via a JSON Web Token (JWT) contained within the cookie, rather than a server-side session store.
- **Frontend Integration:** 
  - **Server Components:** Use `getSession()` (from `@/lib/session.ts`) to fetch user data by forwarding the session cookie to the internal backend URL.
  - **Client Components:** Access session data via the `SessionProvider` context.

### Auth Flow:
1. **Login/Register:** User submits credentials to `/api/auth/login` or `/api/auth/register`.
2. **Token Issuance:** The backend validates credentials, generates a JWT, and sets it in the `breadit_session` cookie via the `set-cookie` header.
3. **Persistence:** The browser automatically sends this cookie with every subsequent request to the backend.
4. **Validation:** The backend's `JwtAuthGuard` extracts the token from the cookie and validates the signature and expiration.

---

## 2. Authorization

Authorization is handled via NestJS Guards on the backend to ensure users have the correct permissions:

- **`JwtAuthGuard`:** The primary guard that ensures the user is authenticated.
- **`RolesGuard`:** Works with the `@Roles()` decorator to restrict access to specific user roles (e.g., `ADMIN`).
- **`BannedUserGuard`:** A global or route-specific check that prevents users with `banned: true` from accessing protected resources.
- **`OptionalJwtAuthGuard`:** Used for public-facing routes (like feeds). It allows access to both guests and logged-in users, but populates the user object if a valid session exists to enable personalized features (like "like" status).

---

## 3. Database Schema & The "Unused" Tables

The `schema.prisma` file includes three tables that are standard boilerplate for NextAuth.js adapters. These remain in the schema but are **not used** as originally intended because the project transitioned to a custom JWT implementation:

### `Account`
- **Status:** **Unused**.
- **Reason:** In NextAuth, this table stores OAuth provider data (e.g., Google or GitHub IDs). Since Breadit currently only supports local email/password authentication, this table remains empty and is never queried by the application logic.

### `Session`
- **Status:** **Unused**.
- **Reason:** This table is designed for database-backed session tracking. Because Breadit uses **stateless JWTs** stored in cookies, the server does not need to store or look up session IDs in the database for every request.

### `VerificationToken`
- **Status:** **Repurposed (Not used by NextAuth)**.
- **Reason:** Originally intended for NextAuth "Magic Links." 
- **Current Use:** While "unused" in the NextAuth sense, the project has **repurposed** this table to support its own 6-digit OTP (One-Time Password) system for email verification and UUID tokens for password resets. The backend manually manages these records using custom prefixes (e.g., `email-verify:<email>`).

---

## 4. Key Files
- **Backend Auth Service:** `apps/backend/src/auth/auth.service.ts` (Handles JWT generation and OTP logic)
- **Backend Guards:** `apps/backend/src/auth/*.guard.ts` (Handles route protection)
- **Frontend Session Helper:** `apps/frontend/src/lib/session.ts` (Handles cookie forwarding for SSR)
- **Schema Definition:** `apps/backend/prisma/schema.prisma`
