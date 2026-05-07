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
