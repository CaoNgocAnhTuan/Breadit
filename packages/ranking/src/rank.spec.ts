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

  it('with no third argument, ties go by post id desc (the production order)', () => {
    const pool = [post(1), post(2), post(3), post(4), post(5), post(6)];
    const score = new Map([
      [1, 10],
      [2, 30],
      [3, 20],
      [4, 30],
      [5, 10],
      [6, 20],
    ]);
    const s = (p: Post): number => score.get(p.id) as number;
    expect(rankPool(pool, s)).toEqual([4, 2, 6, 3, 5, 1]);
    expect(rankPool(pool, s, 'id-desc')).toEqual(rankPool(pool, s));
  });

  it('with "id-asc", only the tied posts change order (id asc); other posts keep their place', () => {
    const pool = [post(1), post(2), post(3), post(4), post(5), post(6)];
    const score = new Map([
      [1, 10],
      [2, 30],
      [3, 20],
      [4, 30],
      [5, 10],
      [6, 20],
    ]);
    const s = (p: Post): number => score.get(p.id) as number;
    // same score groups in the same order (30, 20, 10), ties by id ascending
    expect(rankPool(pool, s, 'id-asc')).toEqual([2, 4, 3, 6, 1, 5]);
    // a pool with no ties gives the same order for both tie-breaks
    const noTies = new Map([
      [1, 5],
      [2, 9],
      [3, 7],
    ]);
    const n = (p: Post): number => noTies.get(p.id) as number;
    const three = [post(1), post(2), post(3)];
    expect(rankPool(three, n, 'id-asc')).toEqual(rankPool(three, n, 'id-desc'));
  });

  it('gives the same id-asc order whatever the input order', () => {
    const ids = [7, 3, 9, 1, 12, 5, 8, 2];
    const pool = ids.map(post);
    const score = (p: Post): number => p.id % 3;
    const expected = rankPool(pool, score, 'id-asc');
    expect(expected).toEqual([2, 5, 8, 1, 7, 3, 9, 12]);
    expect(rankPool([...pool].reverse(), score, 'id-asc')).toEqual(expected);
  });
});
