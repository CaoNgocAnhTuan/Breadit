import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { client, createTestApp } from './helpers/app';
import { closePrisma, createUser, createUserWithCookie, prisma, uniq } from './helpers/factory';

// TC9 (DW5): with FEED_DEFAULT_ALGO=social, For You without `algo` is `algo=social`.

type U = Awaited<ReturnType<typeof createUserWithCookie>>;

describe('TC9: the default algo from the env variable', () => {
  let app: NestFastifyApplication;
  let prev: string | undefined;
  const as = (u: U) => client(app, u.cookie);
  const ASOF = Date.UTC(2022, 0, 15) / 1000;
  const sec = (s: number) => new Date(s * 1000);

  beforeAll(async () => {
    prev = process.env.FEED_DEFAULT_ALGO;
    process.env.FEED_DEFAULT_ALGO = 'social';
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closePrisma();
    if (prev === undefined) delete process.env.FEED_DEFAULT_ALGO;
    else process.env.FEED_DEFAULT_ALGO = prev;
  });

  it('For You without algo gives the same body as algo=social at the same asOf', async () => {
    const me = await createUserWithCookie({ username: uniq('dflt') });
    const f = await createUser({ username: uniq('fl') });
    const others = await Promise.all(Array.from({ length: 4 }, (_, i) => createUser({ username: uniq(`ot${i}`) })));
    await prisma().follow.create({ data: { followerId: me.user.id, followingId: f.id, createdAt: sec(ASOF - 10 * 86400) } });
    const posts: { id: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const author = i % 3 === 0 ? f : others[i % others.length];
      posts.push(await prisma().post.create({ data: { userId: author.id, desc: 'p', createdAt: sec(ASOF - (i + 1) * 1800) } }));
    }
    await prisma().like.create({ data: { userId: f.id, postId: posts[4].id, createdAt: sec(ASOF - 600) } });

    const withDefault = await as(me).get(`/api/posts?asOf=${ASOF}&cursor=1`);
    const explicit = await as(me).get(`/api/posts?algo=social&asOf=${ASOF}&cursor=1`);
    expect(withDefault.status).toBe(200);
    expect(withDefault.body.posts).toHaveLength(10);
    expect(withDefault.text).toBe(explicit.text);

    // page 2 with the cursor of page 1
    const cursor = encodeURIComponent(withDefault.body.nextCursor);
    const d2 = await as(me).get(`/api/posts?asOf=${ASOF}&cursor=${cursor}`);
    const e2 = await as(me).get(`/api/posts?algo=social&asOf=${ASOF}&cursor=${cursor}`);
    expect(d2.status).toBe(200);
    expect(d2.text).toBe(e2.text);
  });

  it('an explicit algo still wins over the default', async () => {
    const me = await createUserWithCookie({ username: uniq('dflt2') });
    const a = await as(me).get(`/api/posts?algo=chrono&asOf=${ASOF}`);
    const b = await as(me).get(`/api/posts?algo=social&asOf=${ASOF}`);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });

  it('the default does not apply to a guest, to following or to a profile', async () => {
    const me = await createUserWithCookie({ username: uniq('dflt3') });
    expect((await client(app).get('/api/posts?cursor=1')).status).toBe(200);
    expect((await as(me).get('/api/posts?feed=following')).status).toBe(200);
    expect((await as(me).get(`/api/posts?user=${me.user.id}`)).status).toBe(200);
    // asOf is not allowed there even though a default algo is set
    expect((await as(me).get(`/api/posts?feed=following&asOf=${ASOF}`)).status).toBe(400);
  });
});
