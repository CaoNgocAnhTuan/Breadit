import * as bcrypt from 'bcryptjs';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { client, createTestApp } from './helpers/app';
import { closePrisma, createUser, createUserWithCookie, prisma, uniq } from './helpers/factory';

type U = Awaited<ReturnType<typeof createUserWithCookie>>;

/** Task p9-bug-quick-wins: one describe per bug. The tests make their own users and posts. */
describe('p9 quick wins', () => {
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

  describe('S5: the optional guard checks the logout blacklist (TC2)', () => {
    it('after logout, the old cookie is a guest on a public route and still 401 on a protected one', async () => {
      const username = uniq('s5user');
      const alice = await createUser({ username });
      await prisma().user.update({ where: { id: alice.id }, data: { password: await bcrypt.hash('secret-pass-1', 4) } });
      const bob = await createUserWithCookie({ username: uniq('s5author') });
      const post = await as(bob).form('POST', '/api/posts', { desc: 'a public post for the S5 check' });
      expect(post.status).toBe(201);
      const postId = post.body.id;

      // Real login, so the cookie is the one the server signs.
      const login = await guest().post('/api/auth/login', { email: alice.email, password: 'secret-pass-1' });
      expect(login.status).toBe(200);
      const setCookie = ([] as string[]).concat(login.headers['set-cookie'] as string | string[]);
      const cookie = setCookie.map((c) => c.split(';')[0]).find((c) => c.startsWith('breadit_session='))!;
      expect(cookie).toBeDefined();
      const old = client(app, cookie);

      expect((await old.post(`/api/posts/${postId}/like`)).status).toBe(200);
      const before = await old.get(`/api/posts/${postId}`);
      expect(before.status).toBe(200);
      expect(before.body.likes).toHaveLength(1);

      expect((await old.post('/api/auth/logout')).status).toBe(200);

      const after = await old.get(`/api/posts/${postId}`);
      expect(after.status).toBe(200);
      expect(after.body.likes).toBeUndefined();
      expect(after.body.saves).toBeUndefined();
      expect(after.body.rePosts).toBeUndefined();
      expect((await old.get('/api/auth/me')).status).toBe(401);
    });

    it('a valid cookie is still a logged-in user on a public route (regression)', async () => {
      const bob = await createUserWithCookie({ username: uniq('s5author') });
      const carol = await createUserWithCookie({ username: uniq('s5reader') });
      const post = await as(bob).form('POST', '/api/posts', { desc: 'another public post' });
      expect((await as(carol).post(`/api/posts/${post.body.id}/like`)).status).toBe(200);
      const res = await as(carol).get(`/api/posts/${post.body.id}`);
      expect(res.body.likes).toHaveLength(1);
    });
  });

  describe('R2: no actions on a post that waits for approval (TC3)', () => {
    let owner: U;
    let author: U; // plain member: the post is pending
    let member: U; // another plain member
    let mod: U;
    let outsider: U;
    let communityId: number;
    let pendingId: number;
    let commentId: number; // the author's comment on the pending post

    beforeAll(async () => {
      [owner, author, member, mod, outsider] = await Promise.all([
        createUserWithCookie({ username: uniq('r2owner') }),
        createUserWithCookie({ username: uniq('r2author') }),
        createUserWithCookie({ username: uniq('r2member') }),
        createUserWithCookie({ username: uniq('r2mod') }),
        createUserWithCookie({ username: uniq('r2out') }),
      ]);
      const c = await as(owner).post('/api/communities', { name: 'R2 Club', slug: uniq('r2club') });
      expect(c.status).toBe(201);
      communityId = c.body.id;
      for (const u of [author, member, mod]) {
        expect((await as(u).post(`/api/communities/${communityId}/join`)).status).toBe(201);
      }
      expect(
        (await as(owner).post(`/api/communities/${communityId}/promote/${mod.user.id}`, { role: 'MOD' })).status,
      ).toBe(201);
      const p = await as(author).form('POST', '/api/posts', { desc: 'pending for R2', communityId: String(communityId) });
      expect(p.status).toBe(201);
      expect(p.body.isApproved).toBe(false);
      pendingId = p.body.id;
      // The author may comment on their own pending post; this gives a comment id to like.
      const cm = await as(author).form('POST', `/api/posts/${pendingId}/comments`, { body: 'author comment' });
      expect(cm.status).toBe(201);
      commentId = cm.body.id;
    });

    it('a plain member, an outsider and a guest get 404 on every action and on the comment list', async () => {
      for (const u of [member, outsider]) {
        expect((await as(u).post(`/api/posts/${pendingId}/like`)).status).toBe(404);
        expect((await as(u).post(`/api/posts/${pendingId}/save`)).status).toBe(404);
        expect((await as(u).post(`/api/posts/${pendingId}/repost`, {})).status).toBe(404);
        expect((await as(u).post(`/api/posts/${pendingId}/repost`, { desc: 'quote' })).status).toBe(404);
        expect((await as(u).form('POST', `/api/posts/${pendingId}/comments`, { body: 'hello' })).status).toBe(404);
        expect((await as(u).get(`/api/posts/${pendingId}/comments`)).status).toBe(404);
        expect((await as(u).post(`/api/comments/${commentId}/like`)).status).toBe(404);
      }
      expect((await guest().get(`/api/posts/${pendingId}/comments`)).status).toBe(404);
    });

    it('the refused actions leave no row behind', async () => {
      const p = prisma();
      expect(await p.like.count({ where: { postId: pendingId } })).toBe(0);
      expect(await p.savedPosts.count({ where: { postId: pendingId } })).toBe(0);
      expect(await p.post.count({ where: { rePostId: pendingId } })).toBe(0);
      expect(await p.comment.count({ where: { postId: pendingId } })).toBe(1);
      expect(await p.commentLike.count({ where: { commentId } })).toBe(0);
    });

    it('the author, the community owner and a mod still can', async () => {
      for (const u of [author, owner, mod]) {
        expect((await as(u).post(`/api/posts/${pendingId}/like`)).status).toBe(200);
        expect((await as(u).get(`/api/posts/${pendingId}/comments`)).status).toBe(200);
        expect((await as(u).post(`/api/comments/${commentId}/like`)).status).toBe(200);
        expect((await as(u).form('POST', `/api/posts/${pendingId}/comments`, { body: 'ok from ' + u.user.username })).status).toBe(201);
      }
      expect((await as(author).post(`/api/posts/${pendingId}/save`)).status).toBe(200);
    });

    it('after approval a plain member can act (the check reads isApproved each time)', async () => {
      expect(
        (await as(owner).post(`/api/communities/${communityId}/posts/${pendingId}/moderate`, { action: 'APPROVE' })).status,
      ).toBe(201);
      expect((await as(member).post(`/api/posts/${pendingId}/like`)).status).toBe(200);
      expect((await as(member).get(`/api/posts/${pendingId}/comments`)).status).toBe(200);
      expect((await as(member).form('POST', `/api/posts/${pendingId}/comments`, { body: 'now fine' })).status).toBe(201);
    });

    it('an approved post and a normal post stay open to everyone (regression)', async () => {
      const plain = await as(outsider).form('POST', '/api/posts', { desc: 'a normal post' });
      expect((await as(member).post(`/api/posts/${plain.body.id}/like`)).status).toBe(200);
      expect((await as(member).form('POST', `/api/posts/${plain.body.id}/comments`, { body: 'hi' })).status).toBe(201);
      expect((await guest().get(`/api/posts/${plain.body.id}/comments`)).status).toBe(200);
    });
  });

  describe('N2, R1: comments (TC4, TC5)', () => {
    type C = { id: number; user: { username: string }; _count: { replies: number }; replies?: C[] };
    const flat = (list: C[]): C[] => list.flatMap((c) => [c, ...flat(c.replies ?? [])]);
    const names = (list: C[]) => flat(list).map((c) => c.user.username);
    const comment = async (u: U, postId: number, text: string, parentId?: number) => {
      const res = await as(u).form('POST', `/api/posts/${postId}/comments`, {
        body: text,
        ...(parentId ? { parentCommentId: String(parentId) } : {}),
      });
      expect(res.status).toBe(201);
      return res.body.id as number;
    };

    it('N2: carol blocks dave; dave\'s comments and replies are gone for carol, and for bob they stay', async () => {
      const [bob, carol, dave, erin] = await Promise.all([
        createUserWithCookie({ username: uniq('n2bob') }),
        createUserWithCookie({ username: uniq('n2carol') }),
        createUserWithCookie({ username: uniq('n2dave') }),
        createUserWithCookie({ username: uniq('n2erin') }),
      ]);
      const post = await as(bob).form('POST', '/api/posts', { desc: 'a post for the N2 check' });
      const postId = post.body.id;
      const bobTop = await comment(bob, postId, 'bob top');
      const daveReply = await comment(dave, postId, 'dave reply to bob', bobTop);
      const daveTop = await comment(dave, postId, 'dave top');
      await comment(erin, postId, 'erin reply under dave', daveTop); // hidden with its parent
      await comment(erin, postId, 'erin reply under dave reply', daveReply); // hidden with its parent
      await comment(erin, postId, 'erin top');

      expect((await as(carol).post(`/api/users/${dave.user.id}/block`)).body).toEqual({ blocked: true });

      const forCarol = (await as(carol).get(`/api/posts/${postId}/comments`)).body as C[];
      expect(names(forCarol)).not.toContain(dave.user.username);
      expect(names(forCarol).sort()).toEqual([bob.user.username, erin.user.username].sort());
      // The thread under a blocked comment goes away with it (design, rejected option).
      expect(flat(forCarol).map((c) => c.id)).not.toContain(daveTop);

      const forBob = (await as(bob).get(`/api/posts/${postId}/comments`)).body as C[];
      expect(names(forBob).filter((n) => n === dave.user.username)).toHaveLength(2);
      expect(flat(forBob)).toHaveLength(6);
      // A guest has no block list: nothing is hidden.
      expect(flat((await guest().get(`/api/posts/${postId}/comments`)).body as C[])).toHaveLength(6);
    });

    it('N2: the block hides in both directions (dave blocked by carol also does not see carol)', async () => {
      const [bob, carol, dave] = await Promise.all([
        createUserWithCookie({ username: uniq('n2bob') }),
        createUserWithCookie({ username: uniq('n2carol') }),
        createUserWithCookie({ username: uniq('n2dave') }),
      ]);
      const postId = (await as(bob).form('POST', '/api/posts', { desc: 'both ways' })).body.id;
      await comment(carol, postId, 'carol top');
      await comment(dave, postId, 'dave top');
      await as(carol).post(`/api/users/${dave.user.id}/block`);
      const forDave = (await as(dave).get(`/api/posts/${postId}/comments`)).body as C[];
      expect(names(forDave)).toEqual([dave.user.username]);
    });

    it('R1: _count.replies counts only live replies', async () => {
      const [bob, carol] = await Promise.all([
        createUserWithCookie({ username: uniq('r1bob') }),
        createUserWithCookie({ username: uniq('r1carol') }),
      ]);
      const postId = (await as(bob).form('POST', '/api/posts', { desc: 'a post for the R1 check' })).body.id;
      const top = await comment(bob, postId, 'top');
      const keep = await comment(carol, postId, 'reply to keep', top);
      const gone = await comment(carol, postId, 'reply to delete', top);
      await comment(bob, postId, 'nested reply', keep);
      expect((await as(carol).delete(`/api/comments/${gone}`)).status).toBe(200);

      const list = (await as(bob).get(`/api/posts/${postId}/comments`)).body as C[];
      expect(list).toHaveLength(1);
      expect(list[0]._count.replies).toBe(1);
      expect(list[0].replies).toHaveLength(1);
      expect(list[0].replies![0]._count.replies).toBe(1);
    });
  });
});
