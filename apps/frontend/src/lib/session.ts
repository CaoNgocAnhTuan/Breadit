import { cookies } from 'next/headers';

export type SessionUser = {
  id: string;
  username: string;
  email: string;
  emailVerified: string | null;
  img?: string | null;
  displayName?: string | null;
  bio?: string | null;
  location?: string | null;
  job?: string | null;
  website?: string | null;
  cover?: string | null;
  role: 'USER' | 'ADMIN';
  banned: boolean;
};

const INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? 'http://backend:4000';

export async function getSession(): Promise<{ user: SessionUser } | null> {
  const cookieHeader = (await cookies()).toString();
  try {
    const res = await fetch(`${INTERNAL_URL}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const user = await res.json() as SessionUser;
    return { user };
  } catch {
    return null;
  }
}

export async function serverFetch(path: string, init?: RequestInit): Promise<Response> {
  const cookieHeader = (await cookies()).toString();
  return fetch(`${INTERNAL_URL}${path}`, {
    ...init,
    headers: { Cookie: cookieHeader, ...init?.headers },
    cache: 'no-store',
  });
}
