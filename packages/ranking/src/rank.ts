import type { Post, PostId } from './types';

/**
 * Ranks the pool by (scoreFixed desc, postId desc). The order does not depend on the input order.
 * `score` is called once per post, in input order. A NaN score throws: it has no place in a total order.
 */
export function rankPool(pool: readonly Post[], score: (p: Post) => number): PostId[] {
  const scored = pool.map((p) => {
    const s = score(p);
    if (Number.isNaN(s)) throw new Error(`score of post ${p.id} is NaN`);
    return { id: p.id, s };
  });
  scored.sort((a, b) => (a.s < b.s ? 1 : a.s > b.s ? -1 : b.id - a.id));
  return scored.map((x) => x.id);
}
