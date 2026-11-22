// Pure helpers of the demo script (task p10-demo-script, design "Code files", lib.mjs).
// No imports, no clock read, no I/O: the caller passes the Date and does the logins.
// Tests: node --test 'scripts/demo/*.test.mjs'

/**
 * The time for `--rebase-to`: UTC, whole seconds (cut down, never rounded up), `YYYY-MM-DDTHH:MM:SSZ`.
 * @param {Date} d
 * @returns {string}
 */
export function rebaseIso(d) {
  const ms = d.getTime();
  if (!Number.isFinite(ms)) throw new Error('rebaseIso needs a valid Date');
  return new Date(Math.floor(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');
}

/**
 * The post ids of one `GET /api/posts` page (`{ posts, hasMore, nextCursor }`), in order.
 * @param {{ posts?: Array<{ id: number }> } | null | undefined} body
 * @returns {number[]}
 */
export function feedIds(body) {
  if (body === null || typeof body !== 'object' || !Array.isArray(body.posts)) {
    throw new Error('feedIds: the body has no posts array');
  }
  return body.posts.map((p) => p.id);
}

/**
 * True when the lists are not all the same order. The same ids in another order count as different.
 * @param {number[][]} pages
 * @returns {boolean}
 */
export function pagesNotAllSame(pages) {
  if (pages.length < 2) return false;
  const [first, ...rest] = pages;
  return rest.some((p) => p.length !== first.length || p.some((id, i) => id !== first[i]));
}

/**
 * How many ids the two lists share (order does not matter).
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function overlap(a, b) {
  const set = new Set(b);
  return [...new Set(a)].filter((id) => set.has(id)).length;
}

/** The two demo groups: history is the positives (like, comment, repost) before the rebase time. */
const GROUPS = {
  little: (history) => history >= 1 && history <= 4,
  long: (history) => history >= 20,
};

/**
 * The candidates of one group, best first. A candidate is `{ id, history, follows, ... }`.
 * Both groups need at least one follow. Sort: follow count high first, then id low first, so one load gives one order.
 * @template {{ id: string, history: number, follows: number }} T
 * @param {T[]} rows
 * @param {'little' | 'long'} group
 * @returns {T[]}
 */
export function orderCandidates(rows, group) {
  const inGroup = GROUPS[group];
  if (!inGroup) throw new Error(`orderCandidates: unknown group "${group}" (use little or long)`);
  return rows
    .filter((r) => r.follows >= 1 && inGroup(r.history))
    .sort((a, b) => b.follows - a.follows || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The first candidate that passes `tryOne`, trying at most `max` candidates (so at most `max` logins).
 * `tryOne(candidate)` returns `{ ok: true, ... }` or `{ ok: false, reason }` and may be async.
 * Returns `{ chosen, result, skipped }`: `chosen` and `result` are null when none passes,
 * `skipped` lists the candidates that failed, each with its reason. An error of `tryOne` is not caught.
 * @template C
 * @param {C[]} candidates
 * @param {(c: C) => Promise<{ ok: boolean, reason?: string }> | { ok: boolean, reason?: string }} tryOne
 * @param {number} [max]
 * @returns {Promise<{ chosen: C | null, result: object | null, skipped: Array<{ candidate: C, reason: string }> }>}
 */
export async function pickUser(candidates, tryOne, max = 4) {
  const skipped = [];
  for (const candidate of candidates.slice(0, max)) {
    const result = await tryOne(candidate);
    if (result.ok) return { chosen: candidate, result, skipped };
    skipped.push({ candidate, reason: result.reason ?? 'no reason given' });
  }
  return { chosen: null, result: null, skipped };
}
