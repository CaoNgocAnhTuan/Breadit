import type { Dataset } from "../canonical/dataset.ts";
import { loadFrozen } from "../frozen.ts";

// Bucket table (DW6). It follows blueprint sections 3.1 and 3.2 word for word, and ports the logic of
// check_cut_time.py (P2) to canonical data: cut_time, test_items, history_count, bucket, in_pool.
// It is used only for this check. The P5 harness will have its own buildPool and must print the same table.

/** At least this many kept test users in bucket 0-4 (blueprint section 3.2). */
export const KEPT_THRESHOLD = 100;

export interface Event {
  id: number;
  t: number;
  user: number;
  post: number;
}

const frozen = loadFrozen();
export const BUCKET_LABELS: readonly string[] = frozen.historyBuckets.map((b) => b.label);
/** The buckets that make up "0-4": every bucket whose upper edge is at most 4. */
export const BUCKETS_0_4: readonly string[] = frozen.historyBuckets
  .filter((b) => b.max !== null && b.max <= 4)
  .map((b) => b.label);

export function bucketOf(n: number): string {
  for (const b of frozen.historyBuckets) {
    if (n >= b.min && (b.max === null || n <= b.max)) return b.label;
  }
  throw new Error(`no bucket for history ${n}`);
}

function parseQ(q: string): { num: number; den: number } {
  const m = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(q);
  if (!m) throw new Error(`q must be a decimal number in (0, 1], got "${q}"`);
  const frac = m[2] ?? "";
  const den = 10 ** frac.length;
  const num = Number(`${m[1] as string}${frac}`);
  if (num <= 0 || num > den) throw new Error(`q must be in (0, 1], got "${q}"`);
  return { num, den };
}

/** T = time of the event at rank ceil(q n). `pos` is sorted by (t, id). Exact integer math. */
export function cutTime(pos: readonly Event[], q: string): number {
  const n = pos.length;
  if (n === 0) throw new Error("no positive events");
  const { num, den } = parseQ(q);
  const rank = Math.floor((num * n + den - 1) / den);
  return (pos[rank - 1] as Event).t;
}

/** The user's last event (by (t, id)) with t > T. An event at exactly T is validation. */
export function testItems(pos: readonly Event[], cut: number): Map<number, Event> {
  const best = new Map<number, Event>();
  for (const ev of pos) {
    if (ev.t > cut) {
      const cur = best.get(ev.user);
      if (!cur || ev.t > cur.t || (ev.t === cur.t && ev.id > cur.id)) best.set(ev.user, ev);
    }
  }
  return best;
}

function before(e: Event, test: Event): boolean {
  return e.t < test.t || (e.t === test.t && e.id < test.id);
}

export function earlierEvents(events: readonly Event[], test: Event): Event[] {
  return events.filter((e) => before(e, test));
}

export function historyCount(events: readonly Event[], test: Event): number {
  return earlierEvents(events, test).length;
}

// Posts sorted by (created_at, post_id), for binary search.
export interface PostIndex {
  created: Map<number, number>;
  times: number[];
  ids: number[];
}

export function buildIndex(created: Record<number, number> | Map<number, number>): PostIndex {
  const entries: Array<[number, number]> =
    created instanceof Map ? [...created.entries()] : Object.entries(created).map(([k, v]) => [Number(k), v]);
  entries.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return {
    created: new Map(entries),
    times: entries.map((e) => e[1]),
    ids: entries.map((e) => e[0]),
  };
}

/** First index whose created_at is at least `c`. */
function lowerBound(ix: PostIndex, c: number): number {
  let lo = 0;
  let hi = ix.times.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((ix.times[mid] as number) < c) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index whose (created_at, post_id) is larger than (c, id). */
function upperBound(ix: PostIndex, c: number, id: number): number {
  let lo = 0;
  let hi = ix.times.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const t = ix.times[mid] as number;
    if (t < c || (t === c && (ix.ids[mid] as number) <= id)) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function inWindow(ix: PostIndex, post: number, tu: number, window: number): boolean {
  const c = ix.created.get(post);
  return c !== undefined && tu - window <= c && c < tu;
}

/** Posts in the pool at t_u: in the window, not own, not touched before, newest `maxPosts`. */
export function poolSize(
  tu: number,
  ix: PostIndex,
  own: ReadonlySet<number>,
  earlier: ReadonlySet<number>,
  window: number,
  maxPosts: number,
): number {
  const lo = lowerBound(ix, tu - window);
  const hi = lowerBound(ix, tu);
  let excluded = 0;
  for (const s of own) if (inWindow(ix, s, tu, window)) excluded++;
  for (const s of earlier) if (!own.has(s) && inWindow(ix, s, tu, window)) excluded++;
  return Math.min(maxPosts, hi - lo - excluded);
}

export function inPool(
  tu: number,
  testPost: number,
  ix: PostIndex,
  own: ReadonlySet<number>,
  earlier: ReadonlySet<number>,
  window: number,
  maxPosts: number,
): boolean {
  if (!inWindow(ix, testPost, tu, window)) return false;
  if (own.has(testPost) || earlier.has(testPost)) return false;
  const c = ix.created.get(testPost) as number;
  const hi = lowerBound(ix, tu);
  let newer = hi - upperBound(ix, c, testPost);
  const newerThanTest = (s: number): boolean => {
    const cs = ix.created.get(s) as number;
    return inWindow(ix, s, tu, window) && (cs > c || (cs === c && s > testPost));
  };
  for (const s of own) if (newerThanTest(s)) newer--;
  for (const s of earlier) if (!own.has(s) && newerThanTest(s)) newer--;
  return newer < maxPosts;
}

export interface BucketRow {
  bucket: string;
  testUsers: number;
  kept: number;
  leftOut: number;
  keptWithFollowee: number;
}

export interface BucketReport {
  q: string;
  /** Number of positive events. */
  n: number;
  cutTime: number;
  testUsers: number;
  poolAtT: number;
  poolAtTWindow: number;
  poolMedian: number | null;
  rows: BucketRow[];
  kept04: number;
  meetsThreshold: boolean;
}

function median(sorted: readonly number[]): number | null {
  const n = sorted.length;
  if (n === 0) return null;
  const mid = n >> 1;
  return n % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function countBefore(sortedDates: readonly number[], t: number): number {
  let lo = 0;
  let hi = sortedDates.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sortedDates[mid] as number) < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function bucketReport(data: Dataset, q: string, windowSec: number, maxPosts: number): BucketReport {
  const pos: Event[] = data.interactions
    .map((e) => ({ id: e.eventId, t: e.createdAt, user: e.userId, post: e.postId }))
    .sort((a, b) => a.t - b.t || a.id - b.id);
  const byUser = new Map<number, Event[]>();
  for (const ev of pos) {
    const l = byUser.get(ev.user);
    if (l) l.push(ev);
    else byUser.set(ev.user, [ev]);
  }
  const authored = new Map<number, Set<number>>();
  const created = new Map<number, number>();
  for (const p of data.posts) {
    created.set(p.postId, p.createdAt);
    const s = authored.get(p.authorId);
    if (s) s.add(p.postId);
    else authored.set(p.authorId, new Set([p.postId]));
  }
  const ix = buildIndex(created);
  const followDates = new Map<number, number[]>();
  for (const f of data.follows) {
    const l = followDates.get(f.followerId);
    if (l) l.push(f.createdAt);
    else followDates.set(f.followerId, [f.createdAt]);
  }
  for (const l of followDates.values()) l.sort((a, b) => a - b);

  const cut = cutTime(pos, q);
  const tests = testItems(pos, cut);
  const none: ReadonlySet<number> = new Set();

  const stats = new Map<string, { test: number; kept: number; keptF: number }>();
  const labels = [...BUCKET_LABELS.slice(0, BUCKETS_0_4.length), "0-4", ...BUCKET_LABELS.slice(BUCKETS_0_4.length)];
  for (const l of labels) stats.set(l, { test: 0, kept: 0, keptF: 0 });
  const poolSizes: number[] = [];

  for (const [user, testEv] of tests) {
    const earlierEv = earlierEvents(byUser.get(user) as Event[], testEv);
    const label = bucketOf(earlierEv.length);
    const earlier = new Set(earlierEv.map((e) => e.post));
    const own = authored.get(user) ?? none;
    const kept = inPool(testEv.t, testEv.post, ix, own, earlier, windowSec, maxPosts);
    const hasFollowee = countBefore(followDates.get(user) ?? [], testEv.t) >= 1;
    if (kept) poolSizes.push(poolSize(testEv.t, ix, own, earlier, windowSec, maxPosts));
    const groups = BUCKETS_0_4.includes(label) ? [label, "0-4"] : [label];
    for (const g of groups) {
      const s = stats.get(g) as { test: number; kept: number; keptF: number };
      s.test++;
      if (kept) {
        s.kept++;
        if (hasFollowee) s.keptF++;
      }
    }
  }

  poolSizes.sort((a, b) => a - b);
  const rows: BucketRow[] = labels.map((l) => {
    const s = stats.get(l) as { test: number; kept: number; keptF: number };
    return { bucket: l, testUsers: s.test, kept: s.kept, leftOut: s.test - s.kept, keptWithFollowee: s.keptF };
  });
  const kept04 = (stats.get("0-4") as { kept: number }).kept;
  return {
    q,
    n: pos.length,
    cutTime: cut,
    testUsers: tests.size,
    poolAtT: poolSize(cut, ix, none, none, windowSec, maxPosts),
    poolAtTWindow: poolSize(cut, ix, none, none, windowSec, ix.times.length),
    poolMedian: median(poolSizes),
    rows,
    kept04,
    meetsThreshold: kept04 >= KEPT_THRESHOLD,
  };
}
