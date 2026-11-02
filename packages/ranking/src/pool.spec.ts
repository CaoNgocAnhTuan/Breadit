import { buildPool } from './pool';
import type { AsOf, PoolParams, Post } from './types';

const ME = 'u0000000001';
const A = 'u0000000002';
const B = 'u0000000003';
const BLOCKED = 'u0000000004';

const T = 1000;
const W = 100;
const asOf: AsOf = { t: T, beforeEventId: 7 };
const params: PoolParams = { windowSec: W, maxPosts: 10 };

function post(id: number, createdAt: number, o: Partial<Post> = {}): Post {
  return { id, authorId: A, communityId: null, createdAt, isApproved: true, deleted: false, ...o };
}

function ids(pool: Post[]): number[] {
  return pool.map((p) => p.id);
}

function run(candidates: Post[], o: { blocked?: string[]; earlier?: number[]; p?: PoolParams; asOf?: AsOf; user?: string } = {}): Post[] {
  return buildPool(
    {
      user: o.user ?? ME,
      asOf: o.asOf ?? asOf,
      candidates,
      blocked: new Set(o.blocked ?? []),
      earlierPositives: new Set(o.earlier ?? []),
    },
    o.p ?? params,
  );
}

describe('buildPool', () => {
  it('window edges: createdAt = t - W is in, one second earlier is out, createdAt = t is out', () => {
    const pool = run([post(1, T - W), post(2, T - W - 1), post(3, T), post(4, T - 1), post(5, T + 1)]);
    expect(ids(pool)).toEqual([4, 1]);
  });

  it('a post created at exactly asOf.t is out even when asOf has an event id (design F10)', () => {
    expect(ids(run([post(1, T)], { asOf: { t: T, beforeEventId: 1_000_000 } }))).toEqual([]);
  });

  it('own posts are out', () => {
    expect(ids(run([post(1, 950, { authorId: ME }), post(2, 951, { authorId: A })]))).toEqual([2]);
  });

  it('earlier positives are out', () => {
    expect(ids(run([post(1, 950), post(2, 951), post(3, 952)], { earlier: [2] }))).toEqual([3, 1]);
  });

  it('blocked authors are out', () => {
    const pool = run([post(1, 950, { authorId: BLOCKED }), post(2, 951, { authorId: B }), post(3, 952)], { blocked: [BLOCKED] });
    expect(ids(pool)).toEqual([3, 2]);
  });

  it('deleted posts and unapproved posts are out', () => {
    const pool = run([
      post(1, 950, { deleted: true }),
      post(2, 951, { isApproved: false }),
      post(3, 952, { deleted: true, isApproved: false }),
      post(4, 953),
    ]);
    expect(ids(pool)).toEqual([4]);
  });

  it('keeps only the newest maxPosts', () => {
    const cands = [post(1, 910), post(2, 920), post(3, 930), post(4, 940), post(5, 950)];
    expect(ids(run(cands, { p: { windowSec: W, maxPosts: 3 } }))).toEqual([5, 4, 3]);
    expect(ids(run(cands, { p: { windowSec: W, maxPosts: 1 } }))).toEqual([5]);
    expect(ids(run(cands, { p: { windowSec: W, maxPosts: 0 } }))).toEqual([]);
    expect(ids(run(cands, { p: { windowSec: W, maxPosts: 5 } }))).toEqual([5, 4, 3, 2, 1]);
  });

  it('excluded posts do not use up the cap', () => {
    const cands = [post(1, 910), post(2, 920), post(3, 930, { authorId: ME }), post(4, 940, { deleted: true })];
    expect(ids(run(cands, { p: { windowSec: W, maxPosts: 2 } }))).toEqual([2, 1]);
  });

  it('createdAt ties go to the larger id, in the cap and in the order', () => {
    const cands = [post(4, 940), post(9, 940), post(5, 940), post(2, 930)];
    expect(ids(run(cands, { p: { windowSec: W, maxPosts: 2 } }))).toEqual([9, 5]);
    expect(ids(run(cands))).toEqual([9, 5, 4, 2]);
  });

  it('orders by (createdAt desc, id desc), whatever the input order', () => {
    const cands = [post(3, 960), post(1, 910), post(8, 960), post(2, 990), post(7, 910), post(5, 950)];
    const expected = [2, 8, 3, 5, 7, 1];
    expect(ids(run(cands))).toEqual(expected);
    expect(ids(run([...cands].reverse()))).toEqual(expected);
    expect(ids(run([cands[3], cands[0], cands[5], cands[1], cands[4], cands[2]]))).toEqual(expected);
  });

  it('does not change its input', () => {
    const cands = [post(3, 960), post(1, 910), post(2, 990)];
    const copy = cands.map((p) => ({ ...p }));
    run(cands);
    expect(cands).toEqual(copy);
  });

  it('returns an empty pool for no candidates', () => {
    expect(run([])).toEqual([]);
  });

  it('returns the posts themselves, not copies with other fields', () => {
    const p1 = post(1, 950, { communityId: 12 });
    expect(run([p1])[0]).toBe(p1);
  });
});
