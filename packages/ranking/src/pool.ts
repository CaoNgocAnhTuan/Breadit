import type { AsOf, PoolParams, Post, PostId, UserId } from './types';

/**
 * The candidate pool of super-plan section 5, shared by the live feed and the harness.
 * The caller passes only root posts (the `Post` contract has no parent field).
 *
 * A post is kept when all of these hold:
 *  - it is not deleted and is approved;
 *  - asOf.t - windowSec <= createdAt < asOf.t (a post has no event id, so t itself is out);
 *  - its author is not blocked and is not the user;
 *  - its id is not in `earlierPositives`.
 * The kept posts are sorted by (createdAt desc, id desc) and the first `maxPosts` are returned.
 */
export function buildPool(
  a: {
    user: UserId;
    asOf: AsOf;
    candidates: readonly Post[];
    blocked: ReadonlySet<UserId>;
    earlierPositives: ReadonlySet<PostId>;
  },
  p: PoolParams,
): Post[] {
  const from = a.asOf.t - p.windowSec;
  const kept = a.candidates.filter(
    (post) =>
      !post.deleted &&
      post.isApproved &&
      from <= post.createdAt &&
      post.createdAt < a.asOf.t &&
      post.authorId !== a.user &&
      !a.blocked.has(post.authorId) &&
      !a.earlierPositives.has(post.id),
  );
  kept.sort((x, y) => y.createdAt - x.createdAt || y.id - x.id);
  return kept.slice(0, Math.max(0, p.maxPosts));
}
