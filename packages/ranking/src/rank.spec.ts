import { rankPool } from './rank';
import type { Post } from './types';

function post(id: number): Post {
  return { id, authorId: 'u0000000001', communityId: null, createdAt: 100, isApproved: true, deleted: false };
}

describe('rankPool', () => {
  it('sorts by (score desc, postId desc)', () => {
    const pool = [post(1), post(2), post(3), post(4), post(5)];
    const score = new Map([
      [1, 10],
      [2, 30],
      [3, 20],
      [4, 30],
      [5, 10],
    ]);
    expect(rankPool(pool, (p) => score.get(p.id) as number)).toEqual([4, 2, 3, 5, 1]);
  });

  it('gives the same order whatever the input order', () => {
    const ids = [7, 3, 9, 1, 12, 5, 8, 2];
    const pool = ids.map(post);
    // many ties on purpose
    const score = (p: Post): number => p.id % 3;
    const expected = rankPool(pool, score);
    expect(expected).toEqual([8, 5, 2, 7, 1, 12, 9, 3]);
    // a few fixed permutations
    const perms = [[...pool].reverse(), [pool[3], pool[1], pool[7], pool[0], pool[2], pool[6], pool[4], pool[5]], [...pool].sort((a, b) => a.id - b.id)];
    for (const perm of perms) expect(rankPool(perm, score)).toEqual(expected);
  });

  it('orders negative scores, zero and the very low band', () => {
    const pool = [post(1), post(2), post(3), post(4)];
    const score = new Map([
      [1, -50],
      [2, 0],
      [3, -(2 ** 31)],
      [4, 4295312896],
    ]);
    expect(rankPool(pool, (p) => score.get(p.id) as number)).toEqual([4, 2, 1, 3]);
  });

  it('returns post ids and does not change the pool', () => {
    const pool = [post(2), post(1)];
    const copy = [...pool];
    expect(rankPool(pool, () => 0)).toEqual([2, 1]);
    expect(pool).toEqual(copy);
    expect(rankPool([], () => 0)).toEqual([]);
  });

  it('calls the score function once per post', () => {
    const calls: number[] = [];
    rankPool([post(1), post(2), post(3)], (p) => {
      calls.push(p.id);
      return p.id;
    });
    expect(calls).toEqual([1, 2, 3]);
  });

  it('throws on a NaN score instead of ordering by chance', () => {
    expect(() => rankPool([post(1), post(2)], (p) => (p.id === 1 ? Number.NaN : 1))).toThrow(/NaN/);
  });
});
