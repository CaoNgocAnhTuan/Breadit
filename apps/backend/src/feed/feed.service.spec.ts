import {
  buildPool,
  postFeaturesAsOf,
  rankPool,
  scorer,
  userFeaturesAsOf,
  type Positive,
  type Post,
  type PostFeatures,
} from '@breadit/ranking';
import { FEED_ALGOS } from './feed.config';
import { ALGO_METHOD, POOL_PARAMS, methodParams } from './feed.constants';
import { FeedService } from './feed.service';

// TC6. Prisma is replaced by a tiny in-memory fake that applies the `where` of each query (equality, null, in, lt, gte,
// not). So a deleted row in the fixture is kept out only if the query asks for it, as in SQL.

const T = 1_000_000; // asOf, Unix seconds
const W = POOL_PARAMS.windowSec;
const at = (sec: number, ms = 0) => new Date(sec * 1000 + ms);

type Row = Record<string, any>;

function matches(row: Row, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const v = row[key];
    if (cond === null) return v === null;
    if (cond instanceof Date || typeof cond !== 'object') return v === cond;
    return Object.entries(cond).every(([op, arg]: [string, any]) => {
      if (op === 'in') return (arg as unknown[]).includes(v);
      if (op === 'lt') return v < arg;
      if (op === 'gte') return v >= arg;
      if (op === 'not') return arg === null ? v !== null : v !== arg;
      throw new Error(`the fake does not know the operator ${op}`);
    });
  });
}

function table(rows: Row[]) {
  return {
    findMany: jest.fn(async (args: { where?: Record<string, any> } = {}) =>
      rows.filter((r) => matches(r, args.where ?? {})),
    ),
  };
}

const root = (id: number, userId: string, sec: number, extra: Row = {}): Row => ({
  id,
  userId,
  communityId: null,
  createdAt: at(sec),
  isApproved: true,
  deletedAt: null,
  parentPostId: null,
  rePostId: null,
  ...extra,
});

// The author and community of a touched post, which the Prisma queries join in.
const info = (userId: string, communityId: number | null = null) => ({ userId, communityId });

function fixture() {
  const posts: Row[] = [
    root(1, 'a', T - 100, { createdAt: at(T - 100, 500) }), // followee post (500 ms must round down)
    root(2, 'b', T - 200, { communityId: 5 }), // approved community post, the user is a member
    root(3, 'c', T - 300),
    root(4, 'blocked', T - 400),
    root(5, 'b', T - 500, { communityId: 5, isApproved: false }), // pending
    root(6, 'c', T - 600, { deletedAt: at(T - 10) }), // deleted
    root(7, 'me', T - 700), // own post
    root(8, 'a', T - 800), // the user liked it before
    root(9, 'b', T - W - 10), // before the window
    root(10, 'a', T), // at t: not visible
    root(11, 'c', T - 900, { communityId: 5 }),
    // repost rows: a row of Post with rePostId set. They are positives, never candidates.
    root(100, 'b', T - 250, { rePostId: 3 }),
    root(101, 'a', T - 240, { rePostId: 3, deletedAt: at(T - 5) }), // deleted repost
    root(102, 'me', T - 2000, { rePostId: 11, createdAt: at(T - 2000) }), // the user reposted 11 (their own repost row)
    // a reply is not a root post
    root(12, 'b', T - 50, { parentPostId: 1 }),
  ];
  // 102 is the user's repost of 11, so post 11 is in the user's history
  const likes: Row[] = [
    { id: 1, userId: 'me', postId: 8, createdAt: at(T - 1000), post: info('a') },
    { id: 2, userId: 'a', postId: 3, createdAt: at(T - 150) },
    { id: 3, userId: 'b', postId: 1, createdAt: at(T - 50, 999) },
    { id: 4, userId: 'a', postId: 11, createdAt: at(T - 20) },
    { id: 5, userId: 'c', postId: 1, createdAt: at(T) }, // at t: not visible
    { id: 6, userId: 'a', postId: 1, createdAt: at(T - 30) },
  ];
  const comments: Row[] = [
    { id: 1, userId: 'c', postId: 2, createdAt: at(T - 40), deletedAt: null },
    { id: 2, userId: 'a', postId: 3, createdAt: at(T - 35), deletedAt: at(T - 1) }, // deleted
    { id: 3, userId: 'b', postId: 3, createdAt: at(T - 36), deletedAt: null },
  ];
  const follows: Row[] = [
    { followerId: 'me', followingId: 'a', createdAt: at(T - 5000) },
    { followerId: 'me', followingId: 'a', createdAt: at(T - 4000) }, // the same follow twice (T6)
    { followerId: 'me', followingId: 'c', createdAt: at(T + 10) }, // after t
    { followerId: 'x', followingId: 'b', createdAt: at(T - 5000) }, // another user
  ];
  const members: Row[] = [
    { userId: 'me', communityId: 5, createdAt: at(T - 3000) },
    { userId: 'x', communityId: 6, createdAt: at(T - 3000) },
  ];

  // The joined author and community of the posts the user touched.
  for (const l of likes) l.post ??= info(posts.find((p) => p.id === l.postId)!.userId, posts.find((p) => p.id === l.postId)!.communityId);
  for (const c of comments) c.post ??= info(posts.find((p) => p.id === c.postId)!.userId, posts.find((p) => p.id === c.postId)!.communityId);
  for (const p of posts) {
    if (p.rePostId !== null) {
      const t = posts.find((x) => x.id === p.rePostId)!;
      p.rePost = info(t.userId, t.communityId);
    }
  }

  const prisma = {
    post: table(posts),
    like: table(likes),
    comment: table(comments),
    follow: table(follows),
    communityMember: table(members),
  };
  const block = { getAllBlockedPeerIds: jest.fn().mockResolvedValue(new Set(['blocked'])) };
  const service = new FeedService(prisma as any, block as any);
  return { service, prisma, block };
}

/** The same ranking, by calling the package by hand on hand-written arrays (follow once, deleted rows left out). */
function byHand(algo: (typeof FEED_ALGOS)[number]) {
  const asOf = { t: T };
  const candidates: Post[] = [
    { id: 1, authorId: 'a', communityId: null, createdAt: T - 100, isApproved: true, deleted: false },
    { id: 2, authorId: 'b', communityId: 5, createdAt: T - 200, isApproved: true, deleted: false },
    { id: 3, authorId: 'c', communityId: null, createdAt: T - 300, isApproved: true, deleted: false },
    { id: 4, authorId: 'blocked', communityId: null, createdAt: T - 400, isApproved: true, deleted: false },
    { id: 5, authorId: 'b', communityId: 5, createdAt: T - 500, isApproved: false, deleted: false },
    { id: 6, authorId: 'c', communityId: null, createdAt: T - 600, isApproved: true, deleted: true },
    { id: 7, authorId: 'me', communityId: null, createdAt: T - 700, isApproved: true, deleted: false },
    { id: 8, authorId: 'a', communityId: null, createdAt: T - 800, isApproved: true, deleted: false },
    { id: 11, authorId: 'c', communityId: 5, createdAt: T - 900, isApproved: true, deleted: false },
  ];
  const mine: Positive[] = [
    { id: 1, userId: 'me', postId: 8, type: 'like', t: T - 1000 },
    { id: 102, userId: 'me', postId: 11, type: 'repost', t: T - 2000 },
  ];
  const uf = userFeaturesAsOf('me', asOf, {
    follows: [{ followerId: 'me', followeeId: 'a', t: T - 5000 }],
    memberships: [{ userId: 'me', communityId: 5, t: T - 3000 }],
    positives: mine,
    postInfo: new Map([
      [8, { authorId: 'a', communityId: null }],
      [11, { authorId: 'c', communityId: 5 }],
    ]),
  });
  const pool = buildPool(
    { user: 'me', asOf, candidates, blocked: new Set(['blocked']), earlierPositives: new Set([8, 11]) },
    POOL_PARAMS,
  );
  const all: Positive[] = [
    { id: 2, userId: 'a', postId: 3, type: 'like', t: T - 150 },
    { id: 3, userId: 'b', postId: 1, type: 'like', t: T - 50 },
    { id: 4, userId: 'a', postId: 11, type: 'like', t: T - 20 },
    { id: 6, userId: 'a', postId: 1, type: 'like', t: T - 30 },
    { id: 1, userId: 'c', postId: 2, type: 'comment', t: T - 40 },
    { id: 3, userId: 'b', postId: 3, type: 'comment', t: T - 36 },
    { id: 100, userId: 'b', postId: 3, type: 'repost', t: T - 250 },
  ];
  const feats = new Map<number, PostFeatures>();
  for (const p of pool) feats.set(p.id, postFeaturesAsOf(p, asOf, all));
  const score = scorer(ALGO_METHOD[algo]);
  const ctx = { user: 'me', asOf, uf, params: methodParams(algo) };
  const scores = new Map<number, number>();
  const order = rankPool(pool, (p) => {
    const s = score(ctx, p, feats.get(p.id) as PostFeatures);
    scores.set(p.id, s);
    return s;
  });
  return order.map((id) => ({ id, score: scores.get(id) as number }));
}

describe('FeedService.rank (TC6)', () => {
  it.each([...FEED_ALGOS])('%s: equals the package called by hand', async (algo) => {
    const { service } = fixture();
    const got = await service.rank('me', algo, T);
    expect(got).toEqual(byHand(algo));
  });

  it('the fixture pool is what we expect: 1, 2, 3 (blocked, pending, deleted, own, touched, old and future posts are out)', async () => {
    const { service } = fixture();
    const got = await service.rank('me', 'chrono', T);
    expect(got.map((x) => x.id).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it('F3, F4: the candidate query is root posts only, in the window, with no take and no deletedAt or isApproved filter', async () => {
    const { service, prisma } = fixture();
    await service.rank('me', 'social', T);
    const calls = prisma.post.findMany.mock.calls.map((c) => c[0] as any);
    const candidateCall = calls.find((a) => a.where.parentPostId === null);
    expect(candidateCall).toBeDefined();
    expect(candidateCall.where.rePostId).toBeNull();
    expect(candidateCall.where.createdAt.gte).toEqual(new Date((T - W) * 1000));
    expect(candidateCall.where.createdAt.lt).toEqual(new Date(T * 1000));
    expect(candidateCall).not.toHaveProperty('take');
    expect(candidateCall.where).not.toHaveProperty('deletedAt');
    expect(candidateCall.where).not.toHaveProperty('isApproved');
  });

  it('F5: the comment and repost queries ask for deletedAt: null', async () => {
    const { service, prisma } = fixture();
    await service.rank('me', 'social', T);
    const commentCalls = prisma.comment.findMany.mock.calls.map((c) => c[0] as any);
    expect(commentCalls.length).toBeGreaterThan(0);
    for (const a of commentCalls) expect(a.where.deletedAt).toBeNull();
    const repostCalls = prisma.post.findMany.mock.calls.map((c) => c[0] as any).filter((a) => a.where.rePostId !== null);
    expect(repostCalls.length).toBeGreaterThan(0);
    for (const a of repostCalls) expect(a.where.deletedAt).toBeNull();
  });

  it('loads the positives of the pool posts only, before t', async () => {
    const { service, prisma } = fixture();
    await service.rank('me', 'social', T);
    // The last like query is the one on the pool posts: it has `postId: { in: [...] }`.
    const poolLike = prisma.like.findMany.mock.calls.map((c) => c[0] as any).find((a) => a.where.postId?.in);
    expect(poolLike).toBeDefined();
    expect([...poolLike.where.postId.in].sort((a: number, b: number) => a - b)).toEqual([1, 2, 3]);
    expect(poolLike.where.createdAt.lt).toEqual(new Date(T * 1000));
  });

  it('asks BlockService for the blocked peers of the user', async () => {
    const { service, block } = fixture();
    await service.rank('me', 'engagement', T);
    expect(block.getAllBlockedPeerIds).toHaveBeenCalledWith('me');
  });

  it('F15: an empty pool gives an empty list and loads no positives of pool posts', async () => {
    const { service, prisma } = fixture();
    const got = await service.rank('me', 'social', 5); // no post before second 5
    expect(got).toEqual([]);
    expect(prisma.like.findMany.mock.calls.map((c) => c[0] as any).some((a) => a.where.postId?.in)).toBe(false);
  });

  it('does not read the clock: the same inputs give the same result at a later wall time', async () => {
    const { service } = fixture();
    const first = await service.rank('me', 'social', T);
    const spy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 86_400_000);
    try {
      expect(await service.rank('me', 'social', T)).toEqual(first);
    } finally {
      spy.mockRestore();
    }
  });
});
