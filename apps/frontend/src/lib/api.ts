const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

export function api(path: string, init?: RequestInit) {
  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
}

/**
 * Reads a JSON answer, but throws when the HTTP status is an error. Without this, a 429 or 500
 * body like {"statusCode":429,...} was used as if it were a page of posts and crashed the feed.
 * React Query turns the throw into its `error` state.
 */
export async function jsonOrThrow<T = unknown>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// For multipart/form-data — do NOT set Content-Type so the browser adds the boundary
export async function apiMultipart(path: string, body: FormData, timeoutMs = 60_000) {
  return apiMultipartWithMethod(path, 'POST', body, timeoutMs);
}

export async function apiMultipartWithMethod(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body: FormData,
  timeoutMs = 60_000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${BACKEND_URL}${path}`, {
      method,
      credentials: 'include',
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
