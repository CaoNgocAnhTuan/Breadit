import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { client, createTestApp } from './helpers/app';
import { closePrisma, createUserWithCookie, prisma, uniq } from './helpers/factory';
import { TINY_PNG } from './helpers/multipart';

type U = Awaited<ReturnType<typeof createUserWithCookie>>;

describe('T10, S2, S3: visibility, privacy, banned users', () => {
  let app: NestFastifyApplication;
  const as = (u: U) => client(app, u.cookie);
  const guest = () => client(app);

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closePrisma();
  });

  describe('T10: posts waiting for approval', () => {
    let owner: U;
    let author: U; // plain member, posts into the community: pending
    let member: U; // another plain member
    let outsider: U;
    let mod: U;
    let admin: U; // site admin, but no community role
    let communityId: number;
    let pendingId: number;

    beforeAll(async () => {
      [owner, author, member, outsider, mod, admin] = await Promise.all([
        createUserWithCookie({ username: uniq('owner') }),
        createUserWithCookie({ username: uniq('author') }),
        createUserWithCookie({ username: uniq('member') }),
        createUserWithCookie({ username: uniq('outsider') }),
        createUserWithCookie({ username: uniq('mod') }),
        createUserWithCookie({ username: uniq('admin'), role: 'ADMIN' }),
      ]);
      const c = await as(owner).post('/api/communities', { name: 'Pending Club', slug: uniq('pending') });
      expect(c.status).toBe(201);
      communityId = c.body.id;
      for (const u of [author, member, mod]) {
        expect((await as(u).post(`/api/communities/${communityId}/join`)).status).toBe(201);
      }
      expect(
        (await as(owner).post(`/api/communities/${communityId}/promote/${mod.user.id}`, { role: 'MOD' })).status,
      ).toBe(201);
      const p = await as(author).form('POST', '/api/posts', { desc: 'waiting for approval', communityId: String(communityId) });
      expect(p.status).toBe(201);
      pendingId = p.body.id;
      expect(p.body.isApproved).toBe(false);
    });

    it('a guest, an outsider, a plain member and a site admin get 404', async () => {
      expect((await guest().get(`/api/posts/${pendingId}`)).status).toBe(404);
      expect((await as(outsider).get(`/api/posts/${pendingId}`)).status).toBe(404);
      expect((await as(member).get(`/api/posts/${pendingId}`)).status).toBe(404);
      expect((await as(admin).get(`/api/posts/${pendingId}`)).status).toBe(404);
    });

    it('the author, the community owner and a mod get 200', async () => {
      expect((await as(author).get(`/api/posts/${pendingId}`)).status).toBe(200);
      expect((await as(owner).get(`/api/posts/${pendingId}`)).status).toBe(200);
      expect((await as(mod).get(`/api/posts/${pendingId}`)).status).toBe(200);
    });

    it('the author can still edit their pending post', async () => {
      const res = await as(author).form('PATCH', `/api/posts/${pendingId}`, { desc: 'edited while pending' });
      expect(res.status).toBe(200);
      expect(res.body.desc).toBe('edited while pending');
    });

    it('the Likes tab of a user who liked it does not list it', async () => {
      await prisma().like.create({ data: { userId: outsider.user.id, postId: pendingId } });
      const tab = await guest().get(`/api/users/${outsider.user.username}/posts?tab=likes`);
      expect(tab.status).toBe(200);
      expect(tab.body.posts.map((p: { id: number }) => p.id)).not.toContain(pendingId);
    });

    it('the Likes tab still lists approved posts (regression)', async () => {
      const ok = await as(owner).form('POST', '/api/posts', { desc: 'approved by default', communityId: String(communityId) });
      expect(ok.body.isApproved).toBe(true);
      await prisma().like.create({ data: { userId: outsider.user.id, postId: ok.body.id } });
      const tab = await guest().get(`/api/users/${outsider.user.username}/posts?tab=likes`);
      expect(tab.body.posts.map((p: { id: number }) => p.id)).toContain(ok.body.id);
    });

    it('after approval everyone gets 200', async () => {
      const res = await as(owner).post(`/api/communities/${communityId}/posts/${pendingId}/moderate`, { action: 'APPROVE' });
      expect(res.status).toBe(201);
      expect((await guest().get(`/api/posts/${pendingId}`)).status).toBe(200);
      expect((await as(outsider).get(`/api/posts/${pendingId}`)).status).toBe(200);
    });

    it('a normal post is still public (regression)', async () => {
      const p = await as(outsider).form('POST', '/api/posts', { desc: 'plain public post' });
      expect((await guest().get(`/api/posts/${p.body.id}`)).status).toBe(200);
    });
  });

  describe('S2: private profile fields', () => {
    it('a guest and another user do not get email, emailVerified or banned; the owner does', async () => {
      const bob = await createUserWithCookie({ username: uniq('bob') });
      const other = await createUserWithCookie({ username: uniq('other') });
      const url = `/api/users/${bob.user.username}`;

      for (const res of [await guest().get(url), await as(other).get(url)]) {
        expect(res.status).toBe(200);
        expect(res.body.username).toBe(bob.user.username);
        expect(res.body).not.toHaveProperty('email');
        expect(res.body).not.toHaveProperty('emailVerified');
        expect(res.body).not.toHaveProperty('banned');
        expect(res.body).not.toHaveProperty('password');
        expect(res.text).not.toContain('@it.test');
      }

      const mine = await as(bob).get(url);
      expect(mine.body.email).toBe(bob.user.email);
      expect(mine.body.emailVerified).toBeTruthy();
      expect(mine.body).toHaveProperty('banned');
      expect(mine.body).not.toHaveProperty('password');
    });

    it('the blocked-profile view leaks nothing either', async () => {
      const bob = await createUserWithCookie({ username: uniq('bob') });
      const viewer = await createUserWithCookie({ username: uniq('viewer') });
      await as(viewer).post(`/api/users/${bob.user.id}/block`);
      const res = await as(viewer).get(`/api/users/${bob.user.username}`);
      expect(res.body.profileRestricted).toBe(true);
      expect(res.body.email ?? null).toBeNull();
      expect(res.body).not.toHaveProperty('banned');
      expect(res.text).not.toContain('@it.test');
    });

    it('/api/auth/me still returns the full own profile', async () => {
      const bob = await createUserWithCookie({ username: uniq('bob') });
      const me = await as(bob).get('/api/auth/me');
      expect(me.body.email).toBe(bob.user.email);
    });
  });

  describe('S3: banned users cannot write', () => {
    let banned: U;
    let normal: U;
    let target: U;
    let conversationId: number;
    let postId: number;

    beforeAll(async () => {
      banned = await createUserWithCookie({ username: uniq('banned'), banned: true });
      normal = await createUserWithCookie({ username: uniq('normal') });
      target = await createUserWithCookie({ username: uniq('target') });
      const post = await as(target).form('POST', '/api/posts', { desc: 'a post to comment on' });
      postId = post.body.id;
      const conv = await as(target).post('/api/conversations', { targetUserId: banned.user.id });
      expect(conv.status).toBe(201);
      conversationId = conv.body.id;
    });

    it('create post: 403 for banned, 201 for a normal user', async () => {
      expect((await as(banned).form('POST', '/api/posts', { desc: 'posted while banned' })).status).toBe(403);
      expect((await as(normal).form('POST', '/api/posts', { desc: 'posted normally' })).status).toBe(201);
    });

    it('create comment: 403 for banned, 201 for a normal user', async () => {
      expect((await as(banned).form('POST', `/api/posts/${postId}/comments`, { body: 'hi' })).status).toBe(403);
      expect((await as(normal).form('POST', `/api/posts/${postId}/comments`, { body: 'hi' })).status).toBe(201);
    });

    it('upload: 403 for banned, 201 for a normal user', async () => {
      const file = [{ name: 'file', filename: 'a.png', type: 'image/png', data: TINY_PNG }];
      expect((await as(banned).form('POST', '/api/uploads', {}, file)).status).toBe(403);
      expect((await as(normal).form('POST', '/api/uploads', {}, file)).status).toBe(201);
    });

    it('create community: 403 for banned, 201 for a normal user', async () => {
      expect((await as(banned).post('/api/communities', { name: 'Banned Club', slug: uniq('bc') })).status).toBe(403);
      expect((await as(normal).post('/api/communities', { name: 'Normal Club', slug: uniq('nc') })).status).toBe(201);
    });

    it('create conversation and send message: 403 for banned', async () => {
      expect((await as(banned).post('/api/conversations', { targetUserId: target.user.id })).status).toBe(403);
      expect((await as(banned).post(`/api/conversations/${conversationId}/messages`, { body: 'dm' })).status).toBe(403);
    });

    it('create conversation and send message: a normal user still can', async () => {
      const conv = await as(normal).post('/api/conversations', { targetUserId: target.user.id });
      expect(conv.status).toBe(201);
      expect((await as(normal).post(`/api/conversations/${conv.body.id}/messages`, { body: 'dm' })).status).toBe(201);
    });

    it('the guard reads the database, so a ban takes effect at once for a valid cookie', async () => {
      const soon = await createUserWithCookie({ username: uniq('soon') });
      expect((await as(soon).form('POST', '/api/posts', { desc: 'before the ban' })).status).toBe(201);
      await prisma().user.update({ where: { id: soon.user.id }, data: { banned: true } });
      expect((await as(soon).form('POST', '/api/posts', { desc: 'after the ban' })).status).toBe(403);
    });
  });
});
