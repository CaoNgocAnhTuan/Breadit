import type { Post, PostId, TieBreak } from './types';

/**
 * Ranks the pool by (scoreFixed desc, postId desc). The order does not depend on the input order.
 * `tieBreak` "id-asc" puts posts with equal scores in postId asc order instead (E6 of the thesis). The default is the production order.
 * `score` is called once per post, in input order. A NaN score throws: it has no place in a total order.
 */
export function rankPool(pool: readonly Post[], score: (p: Post) => number, tieBreak: TieBreak = 'id-desc'): PostId[] {
  const scored = pool.map((p) => {
    const s = score(p);
    if (Number.isNaN(s)) throw new Error(`score of post ${p.id} is NaN`);
    return { id: p.id, s };
  });
  const idOrder = tieBreak === 'id-asc' ? 1 : -1;
  scored.sort((a, b) => (a.s < b.s ? 1 : a.s > b.s ? -1 : idOrder * (a.id - b.id)));
  return scored.map((x) => x.id);
}
