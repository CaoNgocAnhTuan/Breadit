import type { AsOf, Follow, Membership, Positive, Post, PostId, PostInfo, UserId } from "@breadit/ranking";
import type { Dataset } from "../canonical/dataset.ts";
import type { Event } from "../checks/buckets.ts";

// Indexes over one canonical dataset (design "One fast path"). They are flat typed arrays so that Digg (3 million positives,
// 1.7 million follows) fits in memory. Positives are kept sorted by (t, id), so the events visible at an asOf are a prefix.

export type IndexInput = Pick<Dataset, "follows" | "memberships" | "posts" | "interactions">;

const TYPES = ["like", "comment", "repost"] as const;
type Kind = (typeof TYPES)[number];

/** Blueprint section 2.5: `u` plus the integer padded to 10 digits. Plain string order equals integer order. */
export function uid(n: number): UserId {
  return `u${String(n).padStart(10, "0")}`;
}

export function userNum(id: UserId): number {
  if (!/^u\d{10}$/.test(id)) throw new Error(`"${id}" is not a user id (u plus 10 digits)`);
  return Number(id.slice(1));
}

export interface DataIndex {
  datasetId: string;
  maxUser: number;
  maxPost: number;
  // Positives of each user, in user-id slots, sorted by (t, id) inside a slot.
  uStart: Int32Array;
  uId: Int32Array;
  uT: Float64Array;
  uPost: Int32Array;
  uType: Uint8Array;
  // Positives of each post, sorted by (t, id), with running counts of likes and comments inside the post.
  pStart: Int32Array;
  pId: Int32Array;
  pT: Float64Array;
  pUser: Int32Array;
  pCumLike: Int32Array;
  pCumComment: Int32Array;
  // Follows by follower, memberships by user.
  fStart: Int32Array;
  fFollowee: Int32Array;
  fT: Float64Array;
  mStart: Int32Array;
  mCommunity: Int32Array;
  mT: Float64Array;
  /** Root posts sorted by (createdAt, id). Every post is approved and not deleted (blueprint section 2.2). */
  posts: Post[];
  postTimes: Float64Array;
  postInfo: Map<PostId, PostInfo>;
}

/** Counting sort by key: where each input entry goes, and the start of each key's range (size + 1 keys, plus the end). */
function bucketSlots(keys: ArrayLike<number>, size: number): { start: Int32Array; slot: Int32Array } {
  const start = new Int32Array(size + 2);
  for (let i = 0; i < keys.length; i++) start[(keys[i] as number) + 1]!++;
  for (let k = 1; k < start.length; k++) start[k]! += start[k - 1]!;
  const next = start.slice();
  const slot = new Int32Array(keys.length);
  for (let i = 0; i < keys.length; i++) slot[i] = next[keys[i] as number]!++;
  return { start, slot };
}

function sortedByTimeAndId(rows: readonly Dataset["interactions"][number][]): Dataset["interactions"][number][] {
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1] as Dataset["interactions"][number];
    const b = rows[i] as Dataset["interactions"][number];
    if (a.createdAt > b.createdAt || (a.createdAt === b.createdAt && a.eventId > b.eventId)) {
      return [...rows].sort((x, y) => x.createdAt - y.createdAt || x.eventId - y.eventId);
    }
  }
  return rows as Dataset["interactions"][number][];
}

export function buildDataIndex(datasetId: string, data: IndexInput): DataIndex {
  const inter = sortedByTimeAndId(data.interactions);
  let maxUser = 0;
  let maxPost = 0;
  for (const e of inter) {
    if (e.userId > maxUser) maxUser = e.userId;
    if (e.postId > maxPost) maxPost = e.postId;
  }
  for (const f of data.follows) maxUser = Math.max(maxUser, f.followerId, f.followeeId);
  for (const m of data.memberships) maxUser = Math.max(maxUser, m.userId);
  for (const p of data.posts) {
    maxPost = Math.max(maxPost, p.postId);
    maxUser = Math.max(maxUser, p.authorId);
  }

  const n = inter.length;
  const userKeys = new Int32Array(n);
  const postKeys = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    userKeys[i] = (inter[i] as { userId: number }).userId;
    postKeys[i] = (inter[i] as { postId: number }).postId;
  }
  const byUser = bucketSlots(userKeys, maxUser);
  const byPost = bucketSlots(postKeys, maxPost);
  const uId = new Int32Array(n);
  const uT = new Float64Array(n);
  const uPost = new Int32Array(n);
  const uType = new Uint8Array(n);
  const pId = new Int32Array(n);
  const pT = new Float64Array(n);
  const pUser = new Int32Array(n);
  const pCumLike = new Int32Array(n);
  const pCumComment = new Int32Array(n);
  const kindOf: Record<Kind, number> = { like: 0, comment: 1, repost: 2 };
  const pType = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const e = inter[i] as Dataset["interactions"][number];
    const code = kindOf[e.type];
    const us = byUser.slot[i] as number;
    uId[us] = e.eventId;
    uT[us] = e.createdAt;
    uPost[us] = e.postId;
    uType[us] = code;
    const ps = byPost.slot[i] as number;
    pId[ps] = e.eventId;
    pT[ps] = e.createdAt;
    pUser[ps] = e.userId;
    pType[ps] = code;
  }
  for (let p = 0; p <= maxPost; p++) {
    let likes = 0;
    let comments = 0;
    for (let i = byPost.start[p] as number; i < (byPost.start[p + 1] as number); i++) {
      if (pType[i] === 0) likes++;
      else if (pType[i] === 1) comments++;
      pCumLike[i] = likes;
      pCumComment[i] = comments;
    }
  }

  const fKeys = Int32Array.from(data.follows, (f) => f.followerId);
  const byFollower = bucketSlots(fKeys, maxUser);
  const fFollowee = new Int32Array(data.follows.length);
  const fT = new Float64Array(data.follows.length);
  data.follows.forEach((f, i) => {
    const s = byFollower.slot[i] as number;
    fFollowee[s] = f.followeeId;
    fT[s] = f.createdAt;
  });
  const mKeys = Int32Array.from(data.memberships, (m) => m.userId);
  const byMember = bucketSlots(mKeys, maxUser);
  const mCommunity = new Int32Array(data.memberships.length);
  const mT = new Float64Array(data.memberships.length);
  data.memberships.forEach((m, i) => {
    const s = byMember.slot[i] as number;
    mCommunity[s] = m.communityId;
    mT[s] = m.joinedAt;
  });

  const posts: Post[] = data.posts
    .map((p) => ({
      id: p.postId,
      authorId: uid(p.authorId),
      communityId: p.communityId,
      createdAt: p.createdAt,
      isApproved: true,
      deleted: false,
    }))
    .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
  const postInfo = new Map<PostId, PostInfo>();
  for (const p of posts) postInfo.set(p.id, { authorId: p.authorId, communityId: p.communityId });

  return {
    datasetId,
    maxUser,
    maxPost,
    uStart: byUser.start,
    uId,
    uT,
    uPost,
    uType,
    pStart: byPost.start,
    pId,
    pT,
    pUser,
    pCumLike,
    pCumComment,
    fStart: byFollower.start,
    fFollowee,
    fT,
    mStart: byMember.start,
    mCommunity,
    mT,
    posts,
    postTimes: Float64Array.from(posts, (p) => p.createdAt),
    postInfo,
  };
}

/** All positives as events sorted by (t, id): the input of cutTime and of the split. */
export function positiveEvents(data: Pick<Dataset, "interactions">): Event[] {
  return sortedByTimeAndId(data.interactions).map((e) => ({ id: e.eventId, t: e.createdAt, user: e.userId, post: e.postId }));
}

/** The AsOf rule of blueprint section 2.6, on plain numbers. `visibleAt` of the package gives the same answer. */
function visible(t: number, id: number, asOf: AsOf): boolean {
  return t < asOf.t || (t === asOf.t && asOf.beforeEventId !== undefined && id < asOf.beforeEventId);
}

/** Number of events in [start, end) that are visible at asOf. They are sorted by (t, id), so they are a prefix. */
function visiblePrefix(ids: Int32Array, times: Float64Array, start: number, end: number, asOf: AsOf): number {
  let lo = 0;
  let hi = end - start;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (visible(times[start + mid] as number, ids[start + mid] as number, asOf)) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The user's positives visible at asOf (the history of the bucket rule). */
export function userEventCount(idx: DataIndex, user: number, asOf: AsOf): number {
  if (user > idx.maxUser) return 0;
  return visiblePrefix(idx.uId, idx.uT, idx.uStart[user] as number, idx.uStart[user + 1] as number, asOf);
}

/** The visible positives of a post: likes, comments and reposts. */
export function postCounts(idx: DataIndex, post: PostId, asOf: AsOf): { likes: number; comments: number; reposts: number } {
  if (post > idx.maxPost) return { likes: 0, comments: 0, reposts: 0 };
  const s = idx.pStart[post] as number;
  const c = visiblePrefix(idx.pId, idx.pT, s, idx.pStart[post + 1] as number, asOf);
  if (c === 0) return { likes: 0, comments: 0, reposts: 0 };
  const likes = idx.pCumLike[s + c - 1] as number;
  const comments = idx.pCumComment[s + c - 1] as number;
  return { likes, comments, reposts: c - likes - comments };
}

/** The user's positives, all of them (the package keeps the visible ones). */
export function userPositives(idx: DataIndex, user: number): Positive[] {
  if (user > idx.maxUser) return [];
  const id = uid(user);
  const out: Positive[] = [];
  for (let i = idx.uStart[user] as number; i < (idx.uStart[user + 1] as number); i++) {
    out.push({ id: idx.uId[i] as number, userId: id, postId: idx.uPost[i] as number, type: TYPES[idx.uType[i] as number] as Kind, t: idx.uT[i] as number });
  }
  return out;
}

export function userFollows(idx: DataIndex, user: number): Follow[] {
  if (user > idx.maxUser) return [];
  const id = uid(user);
  const out: Follow[] = [];
  for (let i = idx.fStart[user] as number; i < (idx.fStart[user + 1] as number); i++) {
    out.push({ followerId: id, followeeId: uid(idx.fFollowee[i] as number), t: idx.fT[i] as number });
  }
  return out;
}

export function userMemberships(idx: DataIndex, user: number): Membership[] {
  if (user > idx.maxUser) return [];
  const id = uid(user);
  const out: Membership[] = [];
  for (let i = idx.mStart[user] as number; i < (idx.mStart[user + 1] as number); i++) {
    out.push({ userId: id, communityId: idx.mCommunity[i] as number, t: idx.mT[i] as number });
  }
  return out;
}

/**
 * For each post, the followees with a visible positive on it: distinct and sorted. `followees` must be sorted
 * (UserFeatures.followees is). Each followee's own positives are walked once, so the cost is the followees' history,
 * not the pool size times the number of followees.
 */
export function followeeEngagement(idx: DataIndex, followees: readonly UserId[], asOf: AsOf): Map<PostId, UserId[]> {
  const out = new Map<PostId, UserId[]>();
  for (const f of followees) {
    const u = userNum(f);
    if (u > idx.maxUser) continue;
    const s = idx.uStart[u] as number;
    const e = idx.uStart[u + 1] as number;
    for (let i = s; i < e; i++) {
      if (!visible(idx.uT[i] as number, idx.uId[i] as number, asOf)) break;
      const post = idx.uPost[i] as number;
      const list = out.get(post);
      if (list === undefined) out.set(post, [f]);
      else if (list[list.length - 1] !== f) list.push(f);
    }
  }
  return out;
}

function lowerBound(times: Float64Array, c: number): number {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((times[mid] as number) < c) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The posts with t - windowSec <= createdAt < t, sorted by (createdAt, id): the only posts buildPool can keep. */
export function windowCandidates(idx: DataIndex, t: number, windowSec: number): Post[] {
  return idx.posts.slice(lowerBound(idx.postTimes, t - windowSec), lowerBound(idx.postTimes, t));
}
