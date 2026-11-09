import type { DatasetTables } from "../harness/random-data.ts";
import { PASSWORD_HASH, appUserId, canonicalUserId, repostOffset } from "./ids.ts";
import { fromDate, lastEventTime, toDate } from "./time.ts";

// The mapping between a canonical dataset and the rows of the app tables (design: Approach, Ids, Fields that are not in the CSV).
// Pure functions: no Prisma import here. The row types are plain objects shaped like the Prisma unchecked create inputs.

export interface AppUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  password: string;
  emailVerified: Date;
  createdAt: Date;
  updatedAt: Date;
}
export interface AppCommunity { id: number; name: string; slug: string; createdAt: Date; updatedAt: Date }
export interface AppMember { id: number; role: "MEMBER"; userId: string; communityId: number; createdAt: Date }
export interface AppFollow { id: number; notify: boolean; followerId: string; followingId: string; createdAt: Date }
/** A canonical post, or a repost row (`rePostId` set, `desc` and `communityId` null). */
export interface AppPost {
  id: number;
  userId: string;
  communityId: number | null;
  desc: string | null;
  rePostId: number | null;
  isApproved: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface AppLike { id: number; userId: string; postId: number; createdAt: Date }
export interface AppComment {
  id: number;
  body: string;
  userId: string;
  postId: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppRows {
  users: AppUser[];
  communities: AppCommunity[];
  members: AppMember[];
  follows: AppFollow[];
  /** Canonical posts only (`rePostId` null). */
  posts: AppPost[];
  /** Repost rows: a repost is a post row in the app. */
  reposts: AppPost[];
  likes: AppLike[];
  comments: AppComment[];
}

function byKeys<T>(rows: readonly T[], ...keys: Array<(r: T) => number>): T[] {
  return [...rows].sort((a, b) => {
    for (const k of keys) {
      const d = k(a) - k(b);
      if (d !== 0) return d;
    }
    return 0;
  });
}

/** Canonical dataset to app rows. Every time is epoch + CSV seconds + shift. Text comes from ids only. */
export function toAppRows(d: DatasetTables, epochSec: number, shift: number): AppRows {
  const at = (t: number): Date => toDate(epochSec, t, shift);
  for (const e of d.interactions) {
    if (!Number.isSafeInteger(e.eventId) || e.eventId < 1) throw new Error(`event id ${String(e.eventId)} must be an integer of at least 1`);
  }
  const R = repostOffset(d.posts);
  const events = byKeys(d.interactions, (e) => e.eventId);
  const users = byKeys(d.users, (u) => u.userId).map((u): AppUser => {
    const id = appUserId(u.userId);
    const created = at(u.joinedAt);
    return {
      id,
      email: `${id}@example.com`,
      username: id,
      displayName: `User ${u.userId}`,
      password: PASSWORD_HASH,
      emailVerified: created,
      createdAt: created,
      updatedAt: created,
    };
  });
  const communities = byKeys(d.communities, (c) => c.communityId).map((c): AppCommunity => ({
    id: c.communityId,
    name: `Community ${c.communityId}`,
    slug: `c${c.communityId}`,
    createdAt: at(c.createdAt),
    updatedAt: at(c.createdAt),
  }));
  const members = byKeys(d.memberships, (m) => m.userId, (m) => m.communityId).map((m, i): AppMember => ({
    id: i + 1,
    role: "MEMBER",
    userId: appUserId(m.userId),
    communityId: m.communityId,
    createdAt: at(m.joinedAt),
  }));
  const follows = byKeys(d.follows, (f) => f.followerId, (f) => f.followeeId).map((f, i): AppFollow => ({
    id: i + 1,
    notify: false,
    followerId: appUserId(f.followerId),
    followingId: appUserId(f.followeeId),
    createdAt: at(f.createdAt),
  }));
  const posts = byKeys(d.posts, (p) => p.postId).map((p): AppPost => ({
    id: p.postId,
    userId: appUserId(p.authorId),
    communityId: p.communityId,
    desc: `Post ${p.postId}`,
    rePostId: null,
    isApproved: true,
    deletedAt: null,
    createdAt: at(p.createdAt),
    updatedAt: at(p.createdAt),
  }));
  const reposts = events
    .filter((e) => e.type === "repost")
    .map((e): AppPost => ({
      id: R + e.eventId,
      userId: appUserId(e.userId),
      communityId: null,
      desc: null,
      rePostId: e.postId,
      isApproved: true,
      deletedAt: null,
      createdAt: at(e.createdAt),
      updatedAt: at(e.createdAt),
    }));
  const likes = events
    .filter((e) => e.type === "like")
    .map((e): AppLike => ({ id: e.eventId, userId: appUserId(e.userId), postId: e.postId, createdAt: at(e.createdAt) }));
  const comments = events
    .filter((e) => e.type === "comment")
    .map((e): AppComment => ({
      id: e.eventId,
      body: `Comment ${e.eventId}`,
      userId: appUserId(e.userId),
      postId: e.postId,
      deletedAt: null,
      createdAt: at(e.createdAt),
      updatedAt: at(e.createdAt),
    }));
  return { users, communities, members, follows, posts, reposts, likes, comments };
}

/** App rows back to a canonical dataset, with the same shift removed. Rows come out in the order of blueprint section 2.2. */
export function fromAppRows(r: AppRows, epochSec: number, shift: number): DatasetTables {
  const back = (x: Date): number => fromDate(x, epochSec, shift);
  const R = repostOffset(r.posts.map((p) => ({ postId: p.id })));
  const interactions: DatasetTables["interactions"] = [
    ...r.likes.map((l) => ({ eventId: l.id, userId: canonicalUserId(l.userId), postId: l.postId, type: "like" as const, createdAt: back(l.createdAt) })),
    ...r.comments.map((c) => ({ eventId: c.id, userId: canonicalUserId(c.userId), postId: c.postId, type: "comment" as const, createdAt: back(c.createdAt) })),
    ...r.reposts.map((p) => {
      if (p.rePostId === null) throw new Error(`post ${p.id} is in the reposts but has no rePostId`);
      return { eventId: p.id - R, userId: canonicalUserId(p.userId), postId: p.rePostId, type: "repost" as const, createdAt: back(p.createdAt) };
    }),
  ];
  return {
    users: byKeys(r.users, (u) => canonicalUserId(u.id)).map((u) => ({ userId: canonicalUserId(u.id), joinedAt: back(u.createdAt) })),
    follows: byKeys(r.follows, (f) => canonicalUserId(f.followerId), (f) => canonicalUserId(f.followingId)).map((f) => ({
      followerId: canonicalUserId(f.followerId),
      followeeId: canonicalUserId(f.followingId),
      createdAt: back(f.createdAt),
    })),
    communities: byKeys(r.communities, (c) => c.id).map((c) => ({ communityId: c.id, createdAt: back(c.createdAt) })),
    memberships: byKeys(r.members, (m) => canonicalUserId(m.userId), (m) => m.communityId).map((m) => ({
      userId: canonicalUserId(m.userId),
      communityId: m.communityId,
      joinedAt: back(m.createdAt),
    })),
    posts: byKeys(r.posts, (p) => p.id).map((p) => ({
      postId: p.id,
      authorId: canonicalUserId(p.userId),
      communityId: p.communityId,
      createdAt: back(p.createdAt),
    })),
    interactions: byKeys(interactions, (e) => e.createdAt, (e) => e.eventId),
  };
}

/** The shift of a loaded database: its latest time (seconds) minus the dataset's latest time (epoch + canonical). 0 for no rows. */
export function detectShift(r: AppRows, d: DatasetTables, epochSec: number): number {
  let latestMs = Number.NEGATIVE_INFINITY;
  const see = (x: Date): void => {
    const ms = x.getTime();
    if (!Number.isSafeInteger(ms) || ms % 1000 !== 0) throw new Error(`time ${String(ms)} ms is not a whole second`);
    if (ms > latestMs) latestMs = ms;
  };
  for (const u of r.users) see(u.createdAt);
  for (const c of r.communities) see(c.createdAt);
  for (const m of r.members) see(m.createdAt);
  for (const f of r.follows) see(f.createdAt);
  for (const p of r.posts) see(p.createdAt);
  for (const p of r.reposts) see(p.createdAt);
  for (const l of r.likes) see(l.createdAt);
  for (const c of r.comments) see(c.createdAt);
  if (latestMs === Number.NEGATIVE_INFINITY) return 0;
  return latestMs / 1000 - (epochSec + lastEventTime(d));
}
