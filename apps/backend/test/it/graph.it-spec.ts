import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { client, createTestApp } from './helpers/app';
import { closePrisma, createUserWithCookie, prisma, uniq } from './helpers/factory';

type U = Awaited<ReturnType<typeof createUserWithCookie>>;

describe('T5, T8, T9: follow, block and suggestion rules', () => {
  let app: NestFastifyApplication;
  const as = (u: U) => client(app, u.cookie);

  const follow = (from: U, to: U) =>
    prisma().follow.create({ data: { followerId: from.user.id, followingId: to.user.id } });

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closePrisma();
  });

  describe('T5: follow and block rules', () => {
    it('following yourself gives 400 and makes no row', async () => {
      const a = await createUserWithCookie({ username: uniq('self') });
      expect((await as(a).post(`/api/users/${a.user.id}/follow`, {})).status).toBe(400);
      expect(await prisma().follow.count({ where: { followerId: a.user.id, followingId: a.user.id } })).toBe(0);
    });

    it('following an unknown user gives 404', async () => {
      const a = await createUserWithCookie({ username: uniq('lonely') });
      expect((await as(a).post('/api/users/no_such_user/follow', {})).status).toBe(404);
    });

    it('blocking yourself gives 400 and an unknown user gives 404', async () => {
      const a = await createUserWithCookie({ username: uniq('blocker') });
      expect((await as(a).post(`/api/users/${a.user.id}/block`)).status).toBe(400);
      expect((await as(a).post('/api/users/no_such_user/block')).status).toBe(404);
      expect(await prisma().block.count({ where: { blockerId: a.user.id } })).toBe(0);
    });

    it('normal follow, unfollow, block and unblock still work', async () => {
      const a = await createUserWithCookie({ username: uniq('ann') });
      const b = await createUserWithCookie({ username: uniq('ben') });
      expect((await as(a).post(`/api/users/${b.user.id}/follow`, {})).body).toEqual({ following: true });
      expect((await as(a).post(`/api/users/${b.user.id}/follow`, {})).body).toEqual({ following: false });
      expect((await as(a).post(`/api/users/${b.user.id}/block`)).body).toEqual({ blocked: true });
      expect((await as(a).post(`/api/users/${b.user.id}/block`)).body).toEqual({ blocked: false });
    });

    it('blocking removes follows in both directions (regression)', async () => {
      const a = await createUserWithCookie({ username: uniq('amy') });
      const b = await createUserWithCookie({ username: uniq('bea') });
      await follow(a, b);
      await follow(b, a);
      expect((await as(a).post(`/api/users/${b.user.id}/block`)).status).toBe(200);
      const rows = await prisma().follow.count({
        where: { OR: [{ followerId: a.user.id, followingId: b.user.id }, { followerId: b.user.id, followingId: a.user.id }] },
      });
      expect(rows).toBe(0);
      expect(await prisma().block.count({ where: { blockerId: a.user.id, blockedId: b.user.id } })).toBe(1);
    });
  });

  describe('T8, T9: recommendations and connect', () => {
    // Followers received: f3 = 7, f2 = 6, f1 = 5, fan1..fan4 = 1 each, everyone else 0.
    // `heavy` follows 7 accounts but has no followers. The old code ranked by "accounts followed",
    // so it put `heavy` first. The right order is f3, f2, f1.
    let f1: U;
    let f2: U;
    let f3: U;
    let heavy: U;

    const names = (body: Array<{ username: string }>) => body.map((u) => u.username);

    async function connectAll(viewer: U): Promise<Array<{ id: string; username: string; _count: { followers: number } }>> {
      const all: any[] = [];
      for (let page = 1; page <= 50; page++) {
        const res = await as(viewer).get(`/api/users/connect?cursor=${page}`);
        expect(res.status).toBe(200);
        all.push(...res.body.users);
        if (!res.body.hasMore) break;
      }
      return all;
    }

    beforeAll(async () => {
      [f1, f2, f3, heavy] = await Promise.all(
        ['pop1', 'pop2', 'pop3', 'heavy'].map((n) => createUserWithCookie({ username: uniq(n) })),
      );
      const fans = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => createUserWithCookie({ username: uniq(`fan${i}`) })));
      for (const fan of fans) await follow(fan, f3); // 6
      for (const fan of fans.slice(0, 5)) await follow(fan, f2); // 5
      for (const fan of fans.slice(0, 4)) await follow(fan, f1); // 4
      for (const target of [f1, f2, f3, ...fans.slice(0, 4)]) await follow(heavy, target); // heavy follows 7
    });

    it('T8: recommendations are ordered by followers received', async () => {
      const viewer = await createUserWithCookie({ username: uniq('viewer') });
      const res = await as(viewer).get('/api/users/recommendations');
      expect(res.status).toBe(200);
      expect(names(res.body)).toEqual([f3.user.username, f2.user.username, f1.user.username]);
    });

    it('T8: connect lists the most followed first, with the real follower count, and no duplicates', async () => {
      const viewer = await createUserWithCookie({ username: uniq('viewer') });
      const all = await connectAll(viewer);
      const idx = (u: U) => all.findIndex((x) => x.id === u.user.id);

      expect(idx(f3)).toBeGreaterThanOrEqual(0);
      expect(idx(f3)).toBeLessThan(idx(f2));
      expect(idx(f2)).toBeLessThan(idx(f1));
      expect(idx(f1)).toBeLessThan(idx(heavy));
      expect(all.find((x) => x.id === f3.user.id)!._count.followers).toBe(7);
      expect(all.find((x) => x.id === heavy.user.id)!._count.followers).toBe(0);
      expect(new Set(all.map((x) => x.id)).size).toBe(all.length);
      expect(all.some((x) => x.id === viewer.user.id)).toBe(false);
    });

    it('people you already follow are not suggested (regression)', async () => {
      const viewer = await createUserWithCookie({ username: uniq('viewer') });
      await follow(viewer, f3);
      const rec = await as(viewer).get('/api/users/recommendations');
      expect(names(rec.body)).not.toContain(f3.user.username);
      expect(names(rec.body).slice(0, 2)).toEqual([f2.user.username, f1.user.username]);
      expect((await connectAll(viewer)).some((x) => x.id === f3.user.id)).toBe(false);
    });

    it('T9: a blocked user is in neither recommendations nor connect', async () => {
      const viewer = await createUserWithCookie({ username: uniq('viewer') });
      expect((await as(viewer).post(`/api/users/${f3.user.id}/block`)).status).toBe(200);

      const rec = await as(viewer).get('/api/users/recommendations');
      expect(names(rec.body)).not.toContain(f3.user.username);
      expect(names(rec.body).slice(0, 2)).toEqual([f2.user.username, f1.user.username]);
      expect((await connectAll(viewer)).some((x) => x.id === f3.user.id)).toBe(false);
    });

    it('T9: someone who blocked you is also hidden', async () => {
      const viewer = await createUserWithCookie({ username: uniq('viewer') });
      expect((await as(f3).post(`/api/users/${viewer.user.id}/block`)).status).toBe(200);
      const rec = await as(viewer).get('/api/users/recommendations');
      expect(names(rec.body)).not.toContain(f3.user.username);
      expect((await connectAll(viewer)).some((x) => x.id === f3.user.id)).toBe(false);
      await as(f3).post(`/api/users/${viewer.user.id}/block`); // unblock, keep f3 clean for other tests
    });

    it('T9: a banned user is in neither recommendations nor connect', async () => {
      const viewer = await createUserWithCookie({ username: uniq('viewer') });
      await prisma().user.update({ where: { id: f2.user.id }, data: { banned: true } });
      try {
        const rec = await as(viewer).get('/api/users/recommendations');
        expect(names(rec.body)).not.toContain(f2.user.username);
        expect(names(rec.body).slice(0, 2)).toEqual([f3.user.username, f1.user.username]);
        expect((await connectAll(viewer)).some((x) => x.id === f2.user.id)).toBe(false);
      } finally {
        await prisma().user.update({ where: { id: f2.user.id }, data: { banned: false } });
      }
    });
  });
});
