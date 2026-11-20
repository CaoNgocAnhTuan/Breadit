import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { client, createTestApp } from './helpers/app';
import { closePrisma, createUserWithCookie, prisma, uniq } from './helpers/factory';

type U = Awaited<ReturnType<typeof createUserWithCookie>>;

/** Task p10-demo-fixes: the backend half of V3 and V4 (approve a pending community post). */
describe('p10 demo fixes: approve a pending community post', () => {
  // The IT app runs with REDIS_HTTP_CACHE_ENABLED=false, where the feed is never cached and V4 cannot show.
  // `app` has the cache off (TC1); `cached` is a second app with the cache on (TC2, TC3). CacheService reads
  // the flag once, when it is built, so the flag is set for one createTestApp call and then put back.
  let app: NestFastifyApplication;
  let cached: NestFastifyApplication;
  const as = (u: U) => client(app, u.cookie);
  const asC = (u: U) => client(cached, u.cookie);

  beforeAll(async () => {
    app = await createTestApp();
    const old = process.env.REDIS_HTTP_CACHE_ENABLED;
    process.env.REDIS_HTTP_CACHE_ENABLED = 'true';
    try {
      cached = await createTestApp();
    } finally {
      if (old === undefined) delete process.env.REDIS_HTTP_CACHE_ENABLED;
      else process.env.REDIS_HTTP_CACHE_ENABLED = old;
    }
  });

  afterAll(async () => {
    await cached.close();
    await app.close();
    await closePrisma();
  });

  /** An owner, a plain member (the author) and a mod in a new community. */
  async function setup(tag: string) {
    const [owner, author, mod] = await Promise.all([
      createUserWithCookie({ username: uniq(`${tag}own`) }),
      createUserWithCookie({ username: uniq(`${tag}aut`) }),
      createUserWithCookie({ username: uniq(`${tag}mod`) }),
    ]);
    const c = await as(owner).post('/api/communities', { name: `${tag} Club`, slug: uniq(`${tag}club`) });
    expect(c.status).toBe(201);
    const communityId = c.body.id as number;
    for (const u of [author, mod]) {
      expect((await as(u).post(`/api/communities/${communityId}/join`)).status).toBe(201);
    }
    expect(
      (await as(owner).post(`/api/communities/${communityId}/promote/${mod.user.id}`, { role: 'MOD' })).status,
    ).toBe(201);
    return { owner, author, mod, communityId };
  }

  const pendingPost = async (author: U, communityId: number, desc: string) => {
    const p = await as(author).form('POST', '/api/posts', { desc, communityId: String(communityId) });
    expect(p.status).toBe(201);
    expect(p.body.isApproved).toBe(false);
    return p.body.id as number;
  };

  const approve = (by: U, communityId: number, postId: number, via = as) =>
    via(by).post(`/api/communities/${communityId}/posts/${postId}/moderate`, { action: 'APPROVE' });

  const feedIds = async (via: typeof asC, u: U, communityId: number) => {
    const res = await via(u).get(`/api/posts?communityId=${communityId}`);
    expect(res.status).toBe(200);
    return (res.body.posts as { id: number }[]).map((p) => p.id);
  };

  it('TC1 (V3): approve keeps updatedAt, so the post does not look edited', async () => {
    const { owner, author, communityId } = await setup('tc1');
    const postId = await pendingPost(author, communityId, 'pending for TC1');
    const before = await prisma().post.findUniqueOrThrow({ where: { id: postId } });
    // Wait a little, so a rewritten updatedAt would differ from createdAt. Post.tsx marks "(edited)" at more than 1 s.
    await new Promise((r) => setTimeout(r, 50));

    expect((await approve(owner, communityId, postId)).status).toBe(201);

    const after = await prisma().post.findUniqueOrThrow({ where: { id: postId } });
    expect(after.isApproved).toBe(true);
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    expect(after.updatedAt.getTime()).toBe(after.createdAt.getTime());
  });

  it('TC2 (V4): after the owner approves, the owner reads the post at once (cache on)', async () => {
    const { owner, author, communityId } = await setup('tc2');
    expect(await feedIds(asC, owner, communityId)).toEqual([]); // this read puts the empty page in the cache
    const postId = await pendingPost(author, communityId, 'pending for TC2');
    expect(await feedIds(asC, owner, communityId)).toEqual([]); // still pending: not in the feed

    expect((await approve(owner, communityId, postId, asC)).status).toBe(201);

    expect(await feedIds(asC, owner, communityId)).toEqual([postId]);
  });

  it('TC3 (V4, F3): a mod approves; the mod and the author read the post at once (cache on)', async () => {
    const { author, mod, communityId } = await setup('tc3');
    const postId = await pendingPost(author, communityId, 'pending for TC3');
    // Both read before the approve, so each has a cached page.
    expect(await feedIds(asC, mod, communityId)).toEqual([]);
    expect(await feedIds(asC, author, communityId)).toEqual([]);

    expect((await approve(mod, communityId, postId, asC)).status).toBe(201);

    expect(await feedIds(asC, mod, communityId)).toEqual([postId]);
    expect(await feedIds(asC, author, communityId)).toEqual([postId]);
  });
});
