import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { client, createTestApp } from './helpers/app';
import { closePrisma, createUserWithCookie, prisma, uniq } from './helpers/factory';

// TC13 (D1, F20): a community post needs membership.

type U = Awaited<ReturnType<typeof createUserWithCookie>>;

describe('TC13: D1, posting into a community', () => {
  let app: NestFastifyApplication;
  let owner: U;
  let member: U;
  let outsider: U;
  let banned: U;
  let communityId: number;
  const as = (u: U) => client(app, u.cookie);
  const post = (u: U, desc: string) =>
    as(u).form('POST', '/api/posts', { desc, communityId: String(communityId) });

  beforeAll(async () => {
    app = await createTestApp();
    [owner, member, outsider, banned] = await Promise.all([
      createUserWithCookie({ username: uniq('own') }),
      createUserWithCookie({ username: uniq('mem') }),
      createUserWithCookie({ username: uniq('out') }),
      createUserWithCookie({ username: uniq('ban') }),
    ]);
    const c = await as(owner).post('/api/communities', { name: 'D1 Club', slug: uniq('d1') });
    expect(c.status).toBe(201);
    communityId = c.body.id;
    expect((await as(member).post(`/api/communities/${communityId}/join`)).status).toBe(201);
    await prisma().communityBannedUser.create({ data: { userId: banned.user.id, communityId } });
  });

  afterAll(async () => {
    await app.close();
    await closePrisma();
  });

  it('a non-member gets 403 and no post is made', async () => {
    const desc = uniq('outsider-post');
    const res = await post(outsider, desc);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/join/i);
    expect(await prisma().post.count({ where: { desc } })).toBe(0);
  });

  it('a banned user gets the ban 403, not the join one (the ban check stays first)', async () => {
    const desc = uniq('banned-post');
    const res = await post(banned, desc);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/banned/i);
    expect(await prisma().post.count({ where: { desc } })).toBe(0);
  });

  it('a plain member gets 201 and the post waits for approval', async () => {
    const res = await post(member, uniq('member-post'));
    expect(res.status).toBe(201);
    expect(res.body.isApproved).toBe(false);
  });

  it('the owner gets 201 and the post is approved', async () => {
    const res = await post(owner, uniq('owner-post'));
    expect(res.status).toBe(201);
    expect(res.body.isApproved).toBe(true);
  });

  it('a post with no community is not affected', async () => {
    const res = await as(outsider).form('POST', '/api/posts', { desc: uniq('plain') });
    expect(res.status).toBe(201);
    expect(res.body.isApproved).toBe(true);
  });
});
