import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { client, createTestApp } from './helpers/app';
import { closePrisma, createUser, createUserWithCookie, prisma, uniq } from './helpers/factory';

// TC10 (DW8, T4): Explore reads the time once per request, or takes it from `asOf`.

type U = Awaited<ReturnType<typeof createUserWithCookie>>;

const DAY = 86400;
const sec = (s: number) => new Date(s * 1000);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('TC10: Explore with asOf (T4)', () => {
  let app: NestFastifyApplication;
  let viewer: U;
  // Ten days ago: far from the clock, so a request that still reads the clock gets another window.
  const ASOF = Math.floor(Date.now() / 1000) - 10 * DAY;
  let inWindow: number;
  let tooOld: number;

  beforeAll(async () => {
    app = await createTestApp();
    viewer = await createUserWithCookie({ username: uniq('expl') });
    const [a, b] = await Promise.all([createUser({ username: uniq('ea') }), createUser({ username: uniq('eb') })]);
    inWindow = (await prisma().post.create({ data: { userId: a.id, desc: 'in', createdAt: sec(ASOF - 1 * DAY) } })).id;
    tooOld = (await prisma().post.create({ data: { userId: b.id, desc: 'old', createdAt: sec(ASOF - 8 * DAY) } })).id;
    // a few posts around asOf, so that there are several pages
    const others = await Promise.all(Array.from({ length: 6 }, (_, i) => createUser({ username: uniq(`eo${i}`) })));
    for (let i = 0; i < others.length; i++) {
      for (let j = 0; j < 3; j++) {
        await prisma().post.create({ data: { userId: others[i].id, desc: 'o', createdAt: sec(ASOF - (i * 3 + j + 2) * 3600) } });
      }
    }
  });

  afterAll(async () => {
    await app.close();
    await closePrisma();
  });

  async function pages(c: ReturnType<typeof client>, asOf: number): Promise<{ texts: string[]; ids: number[] }> {
    const texts: string[] = [];
    const ids: number[] = [];
    let cursor = '1';
    for (let n = 0; n < 60; n++) {
      const res = await c.get(`/api/posts?feed=explore&asOf=${asOf}&cursor=${encodeURIComponent(cursor)}`);
      expect(res.status).toBe(200);
      texts.push(res.text);
      ids.push(...res.body.posts.map((p: { id: number }) => p.id));
      if (!res.body.hasMore) return { texts, ids };
      cursor = res.body.nextCursor;
    }
    throw new Error('Explore did not end after 60 pages');
  }

  it('two calls with the same asOf give byte-identical pages and cursors', async () => {
    const c = client(app, viewer.cookie);
    const first = await pages(c, ASOF);
    await wait(1100);
    const second = await pages(c, ASOF);
    expect(second.texts).toEqual(first.texts);
    expect(first.texts.length).toBeGreaterThan(1);
  });

  it('a guest gets the same pages as a user with no blocks, byte for byte', async () => {
    const viewerPages = await pages(client(app, viewer.cookie), ASOF);
    const guestPages = await pages(client(app), ASOF);
    // the user fields (liked, reposted, saved) differ for a user, so compare the ids and their order
    expect(guestPages.ids).toEqual(viewerPages.ids);
  });

  it('a post created 8 days before asOf is not in Explore, one created 1 day before is', async () => {
    const { ids } = await pages(client(app, viewer.cookie), ASOF);
    expect(ids).toContain(inWindow);
    expect(ids).not.toContain(tooOld);
  });
});
