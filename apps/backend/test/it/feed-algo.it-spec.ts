import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Prisma } from '@prisma/client';
import { FeedService } from '../../src/feed/feed.service';
import { client, createTestApp } from './helpers/app';
import { closePrisma, createUser, createUserWithCookie, prisma, uniq } from './helpers/factory';

// TC7 (DW4, DW5, DW7, F15). The `algo` feeds rank the pool of every user's posts in the last 7 days, so a test that
// must know the pool puts its fixture in its own year and asks for that time with `asOf`. The tests that ask for no
// `asOf` compare with `FeedService.rank` at the time inside the cursor.

type U = Awaited<ReturnType<typeof createUserWithCookie>>;

const HOUR = 3600;
const DAY = 86400;
const ALGOS = ['chrono', 'engagement', 'social'] as const;
const sec = (s: number) => new Date(s * 1000);
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 1000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mkPost(userId: string, createdSec: number, extra: Partial<Prisma.PostUncheckedCreateInput> = {}) {
  return prisma().post.create({ data: { userId, desc: 'it post', createdAt: sec(createdSec), ...extra } });
}

describe('TC7: the algo feeds', () => {
  let app: NestFastifyApplication;
  let feed: FeedService;
  const as = (u: U) => client(app, u.cookie);

  beforeAll(async () => {
    app = await createTestApp();
    feed = app.get(FeedService, { strict: false });
  });

  afterAll(async () => {
    await app.close();
    await closePrisma();
  });

  /** Every page of `algo`, in order. Checks that the paging ends. */
  async function walk(u: U, algo: string, asOf?: number): Promise<{ ids: number[]; pages: number }> {
    const ids: number[] = [];
    let cursor = '1';
    for (let pages = 1; pages <= 50; pages++) {
      const q = `algo=${algo}&cursor=${encodeURIComponent(cursor)}${asOf === undefined ? '' : `&asOf=${asOf}`}`;
      const res = await as(u).get(`/api/posts?${q}`);
      expect(res.status).toBe(200);
      ids.push(...res.body.posts.map((p: { id: number }) => p.id));
      if (!res.body.hasMore) {
        expect(res.body.nextCursor).toBeNull();
        return { ids, pages };
      }
      expect(typeof res.body.nextCursor).toBe('string');
      cursor = res.body.nextCursor;
    }
    throw new Error('the paging did not end after 50 pages');
  }

  describe('DW4: For You without algo (the env variable is not set)', () => {
    it('shows own and followee posts, newest first, with no community posts', async () => {
      const me = await createUserWithCookie({ username: uniq('me') });
      const f = await createUser({ username: uniq('fol') });
      const stranger = await createUser({ username: uniq('str') });
      await prisma().follow.create({ data: { followerId: me.user.id, followingId: f.id } });
      const community = await prisma().community.create({ data: { name: uniq('club'), slug: uniq('club') } });

      const now = Math.floor(Date.now() / 1000);
      const fNew = await mkPost(f.id, now - 10 * 60);
      const mine = await mkPost(me.user.id, now - 20 * 60);
      const fOld = await mkPost(f.id, now - 30 * 60);
      await mkPost(f.id, now - 5 * 60, { communityId: community.id }); // community post
      await mkPost(f.id, now - 6 * 60, { deletedAt: sec(now) }); // deleted
      await mkPost(stranger.id, now - 7 * 60); // not followed

      const res = await as(me).get('/api/posts?cursor=1');
      expect(res.status).toBe(200);
      expect(res.body.posts.map((p: { id: number }) => p.id)).toEqual([fNew.id, mine.id, fOld.id]);
      expect(res.body.hasMore).toBe(false);
      expect(res.body.nextCursor).toBeNull();
    });
  });

  describe('DW5: the fixture rules', () => {
    const ASOF = utc(2020, 6, 1);
    let v: U;
    let v2: U; // the same as v, but the follow is stored once
    let pA: number;
    let pB: number;
    let pComm: number;
    let pV: number;
    let others: number[]; // posts that must not be in the feed

    beforeAll(async () => {
      v = await createUserWithCookie({ username: uniq('v') });
      v2 = await createUserWithCookie({ username: uniq('v2') });
      const [a, b, c, d] = await Promise.all(['a', 'b', 'c', 'd'].map((n) => createUser({ username: uniq(n) })));
      const k = await prisma().community.create({ data: { name: uniq('club'), slug: uniq('club') } });

      const A = await mkPost(a.id, ASOF - 2 * HOUR);
      const B = await mkPost(b.id, ASOF - 3 * HOUR);
      const C = await mkPost(c.id, ASOF - 4 * HOUR); // author blocked by v
      const V = await mkPost(v.user.id, ASOF - 5 * HOUR); // v's own post
      const del = await mkPost(b.id, ASOF - 6 * HOUR, { deletedAt: sec(ASOF - HOUR) });
      const pend = await mkPost(b.id, ASOF - 7 * HOUR, { communityId: k.id, isApproved: false });
      const comm = await mkPost(b.id, ASOF - 8 * HOUR, { communityId: k.id });
      const old = await mkPost(b.id, ASOF - 8 * DAY);
      const repost = await mkPost(b.id, ASOF - 1 * HOUR, { desc: null, rePostId: B.id });
      const reply = await mkPost(b.id, ASOF - 90 * 60, { parentPostId: B.id });
      const future = await mkPost(b.id, ASOF + HOUR);
      pA = A.id;
      pB = B.id;
      pComm = comm.id;
      pV = V.id;
      others = [C.id, del.id, pend.id, old.id, repost.id, reply.id, future.id];

      // Engagement: A and D like B's post, D likes the community post, A comments on it.
      await prisma().like.createMany({
        data: [
          { userId: a.id, postId: B.id, createdAt: sec(ASOF - 150 * 60) },
          { userId: d.id, postId: B.id, createdAt: sec(ASOF - 140 * 60) },
          { userId: d.id, postId: comm.id, createdAt: sec(ASOF - 130 * 60) },
        ],
      });
      await prisma().comment.create({
        data: { body: 'c', userId: a.id, postId: comm.id, createdAt: sec(ASOF - 120 * 60) },
      });
      // v follows a (twice, T6), v2 follows a once. Both block c.
      await prisma().follow.createMany({
        data: [
          { followerId: v.user.id, followingId: a.id, createdAt: sec(ASOF - 30 * DAY) },
          { followerId: v.user.id, followingId: a.id, createdAt: sec(ASOF - 29 * DAY) },
          { followerId: v2.user.id, followingId: a.id, createdAt: sec(ASOF - 30 * DAY) },
        ],
      });
      await prisma().block.createMany({
        data: [
          { blockerId: v.user.id, blockedId: c.id },
          { blockerId: v2.user.id, blockedId: c.id },
        ],
      });
    });

    it.each(ALGOS)('%s: leaves out blocked, own, deleted, pending, repost-row, reply, old and future posts', async (algo) => {
      const { ids } = await walk(v, algo, ASOF);
      expect([...ids].sort((x, y) => x - y)).toEqual([pA, pB, pComm].sort((x, y) => x - y));
      for (const id of [...others, pV]) expect(ids).not.toContain(id);
    });

    it.each(ALGOS)('%s: the HTTP order equals FeedService.rank', async (algo) => {
      const { ids } = await walk(v, algo, ASOF);
      const ranked = await feed.rank(v.user.id, algo, ASOF);
      expect(ids).toEqual(ranked.map((r) => r.id));
    });

    it('T6: a follow stored twice counts once (social)', async () => {
      const r1 = await feed.rank(v.user.id, 'social', ASOF);
      const r2 = (await feed.rank(v2.user.id, 'social', ASOF)).filter((r) => r.id !== pV); // v2 has no own post to hide
      expect(r1.length).toBe(3);
      expect(r2).toEqual(r1);
      // and over HTTP
      const viaHttp = (await walk(v2, 'social', ASOF)).ids.filter((id) => id !== pV);
      expect(viaHttp).toEqual(r1.map((r) => r.id));
    });
  });

  describe('DW7: paging', () => {
    it('at a fixed asOf, walking every page gives each pool post once, in the full ranked order', async () => {
      const ASOF = utc(2021, 3, 1);
      const viewer = await createUserWithCookie({ username: uniq('pager') });
      const authors = await Promise.all(Array.from({ length: 6 }, (_, i) => createUser({ username: uniq(`au${i}`) })));
      await prisma().follow.create({
        data: { followerId: viewer.user.id, followingId: authors[0].id, createdAt: sec(ASOF - 20 * DAY) },
      });
      const postIds: number[] = [];
      for (let i = 0; i < 27; i++) {
        // i = 3 and i = 4 share one second, so the tie break by id is exercised
        const t = ASOF - (i === 4 ? 3 : i + 1) * 40 * 60;
        postIds.push((await mkPost(authors[i % authors.length].id, t)).id);
      }
      const likers = await Promise.all(Array.from({ length: 4 }, (_, i) => createUser({ username: uniq(`lk${i}`) })));
      for (let i = 0; i < postIds.length; i++) {
        const n = i % 5;
        for (let j = 0; j < n; j++) {
          await prisma().like.create({ data: { userId: likers[j].id, postId: postIds[i], createdAt: sec(ASOF - 30 * 60) } });
        }
      }

      for (const algo of ALGOS) {
        const { ids, pages } = await walk(viewer, algo, ASOF);
        const ranked = await feed.rank(viewer.user.id, algo, ASOF);
        expect(ranked.length).toBe(27);
        expect(pages).toBe(3);
        expect(new Set(ids).size).toBe(ids.length); // no repeat
        expect(ids).toEqual(ranked.map((r) => r.id)); // no gap, same order
      }
    });

    it('without asOf, page 2 asked 2 s after page 1 has no repeat and no gap', async () => {
      const viewer = await createUserWithCookie({ username: uniq('live') });
      const authors = await Promise.all(Array.from({ length: 5 }, (_, i) => createUser({ username: uniq(`lv${i}`) })));
      const now = Math.floor(Date.now() / 1000);
      // dated in the last hours, so that all are in the window and none is in the second of the request
      for (let i = 0; i < 25; i++) await mkPost(authors[i % authors.length].id, now - (i + 2) * 10 * 60);

      const page1 = await as(viewer).get('/api/posts?algo=social&cursor=1');
      expect(page1.status).toBe(200);
      expect(page1.body.posts).toHaveLength(10);
      expect(page1.body.hasMore).toBe(true);
      const cursor: string = page1.body.nextCursor;
      expect(cursor).toMatch(/^\d+:-?\d+:\d+$/);
      const t = Number(cursor.split(':')[0]);

      await wait(2100);
      const page2 = await as(viewer).get(`/api/posts?algo=social&cursor=${encodeURIComponent(cursor)}`);
      expect(page2.status).toBe(200);
      expect(page2.body.posts).toHaveLength(10);

      const ids = [...page1.body.posts, ...page2.body.posts].map((p: { id: number }) => p.id);
      expect(new Set(ids).size).toBe(20);
      const ranked = await feed.rank(viewer.user.id, 'social', t);
      expect(ids).toEqual(ranked.slice(0, 20).map((r) => r.id));
    });
  });

  describe('F15: an empty pool', () => {
    it('gives no posts, hasMore false and no cursor', async () => {
      const u = await createUserWithCookie({ username: uniq('empty') });
      const res = await as(u).get(`/api/posts?algo=social&asOf=${utc(2001, 1, 1)}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ posts: [], hasMore: false, nextCursor: null });
    });
  });
});
