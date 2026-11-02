import type { Dataset, Interaction, Post } from "../canonical/dataset.ts";

// Social lift (DW7): how much more likely a user acts on a post when a followee has shown it to them.
// A post is exposed to user u at time t when u follows its author (follow dated before t), or a followee
// of u (follow dated before t) acted on it earlier. Lift = share of actions on exposed posts divided by
// the mean share of exposed posts among the candidates at that moment. The candidates are the posts in
// the window [t - W, t), without u's own posts and posts u acted on before.

export interface LiftResult {
  actions: number;
  exposedActions: number;
  /** Sum over actions of (exposed candidates / candidates). */
  expectedExposed: number;
  lift: number | null;
  note: string;
}

interface Acted {
  post: number;
  t: number;
}

function lowerBound(arr: readonly number[], x: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((arr[mid] as number) < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function computeLift(data: Dataset, windowSec: number): LiftResult {
  const postById = new Map<number, Post>();
  for (const p of data.posts) postById.set(p.postId, p);

  // all posts sorted by (createdAt, postId): parallel arrays for the window count
  const sortedPosts = [...data.posts].sort((a, b) => a.createdAt - b.createdAt || a.postId - b.postId);
  const allTimes = sortedPosts.map((p) => p.createdAt);
  // posts per author, sorted the same way
  const byAuthor = new Map<number, Post[]>();
  for (const p of sortedPosts) {
    const l = byAuthor.get(p.authorId);
    if (l) l.push(p);
    else byAuthor.set(p.authorId, [p]);
  }
  const authorTimes = new Map<number, number[]>();
  for (const [a, l] of byAuthor) authorTimes.set(a, l.map((p) => p.createdAt));

  // follows: follower to (followee to date)
  const followsOf = new Map<number, Map<number, number>>();
  for (const f of data.follows) {
    let m = followsOf.get(f.followerId);
    if (!m) {
      m = new Map();
      followsOf.set(f.followerId, m);
    }
    m.set(f.followeeId, f.createdAt);
  }

  const events: Interaction[] = [...data.interactions].sort((a, b) => a.createdAt - b.createdAt || a.eventId - b.eventId);
  const actedBy = new Map<number, Acted[]>(); // user to actions so far, in event order
  const actorsOf = new Map<number, number[]>(); // post to users who acted so far

  let actions = 0;
  let exposedActions = 0;
  let expected = 0;
  let anyFollow = false;

  for (const ev of events) {
    const t = ev.createdAt;
    const lo = t - windowSec;
    const follows = followsOf.get(ev.userId);
    const mine = actedBy.get(ev.userId) ?? [];

    // candidates C: posts in the window, not own, not touched before
    const first = lowerBound(allTimes, lo);
    const last = lowerBound(allTimes, t);
    let candidates = last - first;
    const own = byAuthor.get(ev.userId);
    if (own) {
      const times = authorTimes.get(ev.userId) as number[];
      candidates -= lowerBound(times, t) - lowerBound(times, lo);
    }
    const touched = new Set<number>();
    for (let i = mine.length - 1; i >= 0; i--) {
      const a = mine[i] as Acted;
      if (a.t < lo) break;
      const p = postById.get(a.post);
      if (p && p.createdAt >= lo && p.createdAt < t && p.authorId !== ev.userId) touched.add(a.post);
    }
    candidates -= touched.size;

    // exposed candidates E
    const exposed = new Set<number>();
    if (follows) {
      for (const [followee, date] of follows) {
        if (date >= t) continue;
        anyFollow = true;
        const posts = byAuthor.get(followee);
        if (posts) {
          const times = authorTimes.get(followee) as number[];
          for (let i = lowerBound(times, lo); i < posts.length && (posts[i] as Post).createdAt < t; i++) {
            exposed.add((posts[i] as Post).postId);
          }
        }
        const theirs = actedBy.get(followee);
        if (theirs) {
          for (let i = theirs.length - 1; i >= 0; i--) {
            const a = theirs[i] as Acted;
            if (a.t < lo) break;
            const p = postById.get(a.post);
            if (p && p.createdAt >= lo && p.createdAt < t) exposed.add(a.post);
          }
        }
      }
    }
    for (const id of [...exposed]) {
      const p = postById.get(id) as Post;
      if (p.authorId === ev.userId || touched.has(id)) exposed.delete(id);
    }

    // is the chosen post exposed?
    const chosen = postById.get(ev.postId);
    let hit = false;
    if (chosen && follows) {
      const authorDate = follows.get(chosen.authorId);
      if (authorDate !== undefined && authorDate < t) hit = true;
      else {
        for (const u of actorsOf.get(ev.postId) ?? []) {
          const d = follows.get(u);
          if (d !== undefined && d < t) {
            hit = true;
            break;
          }
        }
      }
    }

    actions++;
    if (hit) exposedActions++;
    if (candidates > 0) expected += exposed.size / candidates;

    // record this action for later events
    const list = actedBy.get(ev.userId);
    if (list) list.push({ post: ev.postId, t });
    else actedBy.set(ev.userId, [{ post: ev.postId, t }]);
    const au = actorsOf.get(ev.postId);
    if (au) au.push(ev.userId);
    else actorsOf.set(ev.postId, [ev.userId]);
  }

  if (data.follows.length === 0) {
    return { actions, exposedActions, expectedExposed: expected, lift: null, note: "lift not computed: no follows" };
  }
  if (!anyFollow || expected === 0) {
    return { actions, exposedActions, expectedExposed: expected, lift: null, note: "lift not computed: no follow was active at any action" };
  }
  return { actions, exposedActions, expectedExposed: expected, lift: exposedActions / expected, note: "" };
}
