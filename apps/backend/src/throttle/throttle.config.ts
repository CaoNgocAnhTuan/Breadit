// The global rate limit, read once from the environment when the app starts (task p7-cost-benchmark, bug N6).
// The limit counts per route per IP in a 60 s window. A wrong value throws, so the backend does not start
// with a silent fallback (the same rule as `readFeedConfig`).

export const THROTTLE_TTL_MS = 60000;
export const DEFAULT_THROTTLE_LIMIT = 1000;

/** `THROTTLE_LIMIT` as a positive whole number; 1000 when it is unset or empty. */
export function readThrottleLimit(env: NodeJS.ProcessEnv): number {
  const raw = env.THROTTLE_LIMIT;
  if (raw === undefined || raw === '') return DEFAULT_THROTTLE_LIMIT;
  const limit = /^[1-9][0-9]*$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(limit)) {
    throw new Error(`THROTTLE_LIMIT is "${raw}"; allowed: a positive whole number (or leave it unset for ${DEFAULT_THROTTLE_LIMIT})`);
  }
  return limit;
}
