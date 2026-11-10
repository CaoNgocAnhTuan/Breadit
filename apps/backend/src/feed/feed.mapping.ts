import type { Follow, Membership, Positive, Post, PostId, Sec } from '@breadit/ranking';

// Rows from Prisma to the plain types of @breadit/ranking. Every time is whole Unix seconds, rounded down (F2).
// A positive keeps the id of its own row. The ids of the three tables can be equal, but the feed passes no event id
// in AsOf, so only the time decides what is visible.

/** Whole Unix seconds, rounded down. */
export function toSec(d: Date): Sec {
  return Math.floor(d.getTime() / 1000);
}

/**
 * The SQL bounds of the window: createdAt in [t - W, t). For a whole second n, `floor(x / 1000) >= n` is the same as
 * `x >= n * 1000`, and `floor(x / 1000) < n` is the same as `x < n * 1000`, so the bounds agree with `buildPool` (F2).
 */
export function windowBounds(t: Sec, windowSec: number): { gte: Date; lt: Date } {
  return { gte: new Date((t - windowSec) * 1000), lt: new Date(t * 1000) };
}

export function postToCandidate(row: {
  id: number;
  userId: string;
  communityId: number | null;
  createdAt: Date;
  isApproved: boolean;
  deletedAt: Date | null;
}): Post {
  return {
    id: row.id,
    authorId: row.userId,
    communityId: row.communityId,
    createdAt: toSec(row.createdAt),
    isApproved: row.isApproved,
    deleted: row.deletedAt !== null,
  };
}

export function followToFeature(row: { followerId: string; followingId: string; createdAt: Date }): Follow {
  return { followerId: row.followerId, followeeId: row.followingId, t: toSec(row.createdAt) };
}

export function membershipToFeature(row: { userId: string; communityId: number; createdAt: Date }): Membership {
  return { userId: row.userId, communityId: row.communityId, t: toSec(row.createdAt) };
}

export function likeToPositive(row: { id: number; userId: string; postId: number; createdAt: Date }): Positive {
  return { id: row.id, userId: row.userId, postId: row.postId, type: 'like', t: toSec(row.createdAt) };
}

export function commentToPositive(row: { id: number; userId: string; postId: number; createdAt: Date }): Positive {
  return { id: row.id, userId: row.userId, postId: row.postId, type: 'comment', t: toSec(row.createdAt) };
}

/** A repost is a `Post` row. The touched post is its `rePostId`. */
export function repostToPositive(row: {
  id: number;
  userId: string;
  rePostId: number | null;
  createdAt: Date;
}): Positive {
  if (row.rePostId === null) throw new Error(`post ${row.id} is not a repost: it has no rePostId`);
  return { id: row.id, userId: row.userId, postId: row.rePostId, type: 'repost', t: toSec(row.createdAt) };
}

/** Positives grouped by the post they touch. The input order is kept inside each group. */
export function groupByPost(positives: readonly Positive[]): Map<PostId, Positive[]> {
  const out = new Map<PostId, Positive[]>();
  for (const p of positives) {
    const list = out.get(p.postId);
    if (list === undefined) out.set(p.postId, [p]);
    else list.push(p);
  }
  return out;
}
