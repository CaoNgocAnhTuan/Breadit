import { visibleAt } from './asof';
import type { AsOf, Positive, Post, PostFeatures, PostId, Sec, UserFeatures, UserId } from './types';

// As-of feature builders (module map of blueprint 1). They are pure: they take plain arrays, so the harness
// (from CSV) and the feed module (from Prisma) only differ in how they load the arrays.

export interface Follow {
  followerId: UserId;
  followeeId: UserId;
  t: Sec;
}

export interface Membership {
  userId: UserId;
  communityId: number;
  t: Sec;
}

export interface PostInfo {
  authorId: UserId;
  communityId: number | null;
}

export interface UserFeatureData {
  follows: readonly Follow[];
  memberships: readonly Membership[];
  /** Any users' positives are fine: only the ones of `user` are used. */
  positives: readonly Positive[];
  postInfo: ReadonlyMap<PostId, PostInfo>;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareNumbers(a: number, b: number): number {
  return a - b;
}

function bump<K>(m: Map<K, number>, key: K): void {
  m.set(key, (m.get(key) ?? 0) + 1);
}

/**
 * UserFeatures of `user` at `asOf`. Follows and memberships have no event id, so they count only when
 * their date is strictly before asOf.t (design F10). Positives follow the AsOf rule (with the event id).
 * A positive on a post that is not in `postInfo` counts in `nTotal` only.
 */
export function userFeaturesAsOf(user: UserId, asOf: AsOf, data: UserFeatureData): UserFeatures {
  const followees = new Set<UserId>();
  for (const f of data.follows) {
    if (f.followerId === user && f.t < asOf.t) followees.add(f.followeeId);
  }
  const communities = new Set<number>();
  for (const m of data.memberships) {
    if (m.userId === user && m.t < asOf.t) communities.add(m.communityId);
  }
  const nByAuthor = new Map<UserId, number>();
  const nByCommunity = new Map<number, number>();
  let nTotal = 0;
  for (const p of data.positives) {
    if (p.userId !== user || !visibleAt(p, asOf)) continue;
    nTotal++;
    const info = data.postInfo.get(p.postId);
    if (info === undefined) continue;
    bump(nByAuthor, info.authorId);
    if (info.communityId !== null) bump(nByCommunity, info.communityId);
  }
  return {
    followees: [...followees].sort(compareStrings),
    communities: [...communities].sort(compareNumbers),
    nByAuthor,
    nByCommunity,
    nTotal,
  };
}

/**
 * PostFeatures of `post` at `asOf`: visible likes, comments and reposts, and the users with a visible
 * positive on the post (distinct, sorted). Any positives are fine: only the ones on this post are used.
 */
export function postFeaturesAsOf(
  post: Pick<Post, 'id' | 'createdAt'>,
  asOf: AsOf,
  positives: readonly Positive[],
): PostFeatures {
  let likes = 0;
  let comments = 0;
  let reposts = 0;
  const engaged = new Set<UserId>();
  for (const p of positives) {
    if (p.postId !== post.id || !visibleAt(p, asOf)) continue;
    if (p.type === 'like') likes++;
    else if (p.type === 'comment') comments++;
    else reposts++;
    engaged.add(p.userId);
  }
  return { likes, comments, reposts, createdAt: post.createdAt, engagedBy: [...engaged].sort(compareStrings) };
}
