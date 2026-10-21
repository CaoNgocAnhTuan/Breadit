import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { client, createTestApp } from './helpers/app';
import { closePrisma, createUserWithCookie, uniq } from './helpers/factory';
import { TINY_PNG } from './helpers/multipart';

describe('T7, B3, N1: input checks and error codes', () => {
  let app: NestFastifyApplication;
  let alice: Awaited<ReturnType<typeof createUserWithCookie>>;
  let bob: Awaited<ReturnType<typeof createUserWithCookie>>;
  let admin: Awaited<ReturnType<typeof createUserWithCookie>>;
  let postId: number;

  const as = (u: { cookie: string }) => client(app, u.cookie);

  async function newPost(u: { cookie: string }, desc: string): Promise<number> {
    const res = await as(u).form('POST', '/api/posts', { desc });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    alice = await createUserWithCookie({ username: uniq('alice') });
    bob = await createUserWithCookie({ username: uniq('bob') });
    admin = await createUserWithCookie({ username: uniq('admin'), role: 'ADMIN' });
    postId = await newPost(alice, 'a normal post');
  });

  afterAll(async () => {
    await app.close();
    await closePrisma();
  });

  describe('T7: bad or missing ids', () => {
    it('GET /api/posts/abc gives 400', async () => {
      expect((await client(app).get('/api/posts/abc')).status).toBe(400);
    });

    it('GET a missing post gives 404', async () => {
      expect((await client(app).get('/api/posts/99999999')).status).toBe(404);
    });

    it.each(['like', 'save', 'repost'])('%s on a missing post gives 404', async (action) => {
      expect((await as(bob).post(`/api/posts/99999999/${action}`)).status).toBe(404);
    });

    it.each(['like', 'save', 'repost'])('%s on a deleted post gives 404', async (action) => {
      const id = await newPost(alice, 'doomed');
      expect((await as(alice).delete(`/api/posts/${id}`)).status).toBe(200);
      expect((await as(bob).post(`/api/posts/${id}/${action}`)).status).toBe(404);
    });

    it('a comment on a deleted post gives 404', async () => {
      const id = await newPost(alice, 'doomed too');
      await as(alice).delete(`/api/posts/${id}`);
      const res = await as(bob).form('POST', `/api/posts/${id}/comments`, { body: 'ghost' });
      expect(res.status).toBe(404);
    });

    it('a like on a deleted comment gives 404', async () => {
      const c = await as(bob).form('POST', `/api/posts/${postId}/comments`, { body: 'bye' });
      expect(c.status).toBe(201);
      await as(bob).delete(`/api/comments/${c.body.id}`);
      expect((await as(alice).post(`/api/comments/${c.body.id}/like`)).status).toBe(404);
    });

    it('a repost with a missing rePostId gives 404 (foreign key)', async () => {
      const res = await as(bob).form('POST', '/api/posts', { rePostId: '99999999' });
      expect(res.status).toBe(404);
    });

    it('a quote repost of a missing post gives 404', async () => {
      const res = await as(bob).post('/api/posts/99999999/repost', { desc: 'my take' });
      expect(res.status).toBe(404);
    });

    it('reporting a missing post gives 404', async () => {
      const res = await as(bob).post('/api/posts/99999999/report', { reason: 'spam' });
      expect(res.status).toBe(404);
    });

    it('reporting with no reason gives 400', async () => {
      expect((await as(bob).post(`/api/posts/${postId}/report`, {})).status).toBe(400);
      expect((await as(bob).post(`/api/posts/${postId}/report`, { reason: '' })).status).toBe(400);
    });

    it('a valid report still works (201)', async () => {
      expect((await as(bob).post(`/api/posts/${postId}/report`, { reason: 'spam' })).status).toBe(201);
    });
  });

  describe('T7: bad cursors give 400, not 500', () => {
    const cases: Array<[string, string, 'bob' | 'admin' | 'guest']> = [
      ['notifications', '/api/notifications?cursor=abc', 'bob'],
      ['admin users', '/api/admin/users?cursor=abc', 'admin'],
      ['admin reports', '/api/admin/reports?cursor=abc', 'admin'],
      ['profile posts', '/api/users/someone/posts?tab=posts&cursor=abc', 'guest'],
      ['followers', '/api/users/someone/followers?cursor=abc', 'guest'],
      ['following', '/api/users/someone/following?cursor=abc', 'guest'],
      ['saved posts', '/api/users/me/saved?cursor=abc', 'bob'],
      ['connect', '/api/users/connect?cursor=abc', 'bob'],
      ['hashtag posts', '/api/hashtags/x/posts?cursor=abc', 'guest'],
      ['conversations', '/api/conversations?cursor=abc', 'bob'],
      ['messages', '/api/conversations/1/messages?cursor=abc', 'bob'],
    ];
    it.each(cases)('%s with cursor=abc', async (_name, url, who) => {
      const c = who === 'guest' ? client(app) : as(who === 'admin' ? admin : bob);
      expect((await c.get(url)).status).toBe(400);
    });

    it('a negative or zero cursor also gives 400', async () => {
      expect((await as(bob).get('/api/notifications?cursor=0')).status).toBe(400);
      expect((await as(bob).get('/api/notifications?cursor=-2')).status).toBe(400);
    });

    // Regression: the global ValidationPipe turns a missing number-typed query into NaN,
    // so every converted route must still answer 200 when `cursor` is left out.
    const noCursor: Array<[string, string, 'bob' | 'admin' | 'guest']> = [
      ['notifications', '/api/notifications', 'bob'],
      ['admin users', '/api/admin/users', 'admin'],
      ['admin reports', '/api/admin/reports', 'admin'],
      ['profile posts', '/api/users/someone/posts?tab=posts', 'guest'],
      ['followers', '/api/users/someone/followers', 'guest'],
      ['following', '/api/users/someone/following', 'guest'],
      ['saved posts', '/api/users/me/saved', 'bob'],
      ['connect', '/api/users/connect', 'bob'],
      ['hashtag posts', '/api/hashtags/x/posts', 'guest'],
      ['conversations', '/api/conversations', 'bob'],
    ];
    it.each(noCursor)('%s works without a cursor', async (_name, url, who) => {
      const c = who === 'guest' ? client(app) : as(who === 'admin' ? admin : bob);
      expect((await c.get(url)).status).toBe(200);
    });

    it('a valid or missing cursor still works', async () => {
      expect((await as(bob).get('/api/notifications')).status).toBe(200);
      expect((await as(bob).get('/api/notifications?cursor=1')).status).toBe(200);
      expect((await as(admin).get('/api/admin/users?cursor=2')).status).toBe(200);
      expect((await client(app).get('/api/hashtags/x/posts?cursor=1')).status).toBe(200);
    });
  });

  describe('B3: text length limits give 400, not 500', () => {
    it('a 255-char post is accepted, a 256-char post is not', async () => {
      expect((await as(alice).form('POST', '/api/posts', { desc: 'x'.repeat(255) })).status).toBe(201);
      expect((await as(alice).form('POST', '/api/posts', { desc: 'x'.repeat(256) })).status).toBe(400);
    });

    it('a 300-char post gives 400', async () => {
      expect((await as(alice).form('POST', '/api/posts', { desc: 'x'.repeat(300) })).status).toBe(400);
    });

    it('255 emoji count as 255 characters, not 510', async () => {
      expect((await as(alice).form('POST', '/api/posts', { desc: '😀'.repeat(255) })).status).toBe(201);
    });

    it('editing a post to more than 255 chars gives 400', async () => {
      const res = await as(alice).form('PATCH', `/api/posts/${postId}`, { desc: 'y'.repeat(300) });
      expect(res.status).toBe(400);
    });

    it('a 1000-char comment is accepted, a 1001-char comment is not', async () => {
      const ok = await as(bob).form('POST', `/api/posts/${postId}/comments`, { body: 'c'.repeat(1000) });
      expect(ok.status).toBe(201);
      const bad = await as(bob).form('POST', `/api/posts/${postId}/comments`, { body: 'c'.repeat(1001) });
      expect(bad.status).toBe(400);
    });

    it('editing a comment to more than 1000 chars gives 400', async () => {
      const c = await as(bob).form('POST', `/api/posts/${postId}/comments`, { body: 'short' });
      const res = await as(bob).form('PATCH', `/api/comments/${c.body.id}`, { body: 'z'.repeat(1200) });
      expect(res.status).toBe(400);
    });

    it('a 400-char quote repost gives 400', async () => {
      const res = await as(bob).post(`/api/posts/${postId}/repost`, { desc: 'q'.repeat(400) });
      expect(res.status).toBe(400);
    });

    it('a short quote repost still works', async () => {
      const res = await as(bob).post(`/api/posts/${postId}/repost`, { desc: 'my take' });
      expect(res.status).toBe(200);
      expect(res.body.reposted).toBe(true);
    });
  });

  describe('N1: empty posts and comments', () => {
    it('a post with no text and no media gives 400', async () => {
      expect((await as(bob).form('POST', '/api/posts', { isSensitive: 'false' })).status).toBe(400);
    });

    it('a post with only whitespace gives 400', async () => {
      expect((await as(bob).form('POST', '/api/posts', { desc: '   ' })).status).toBe(400);
    });

    it('a post with only an image is accepted', async () => {
      const res = await as(bob).form('POST', '/api/posts', {}, [
        { name: 'file', filename: 'a.png', type: 'image/png', data: TINY_PNG },
      ]);
      expect(res.status).toBe(201);
    });

    it('a plain repost (rePostId, no text) is accepted', async () => {
      const res = await as(bob).form('POST', '/api/posts', { rePostId: String(postId) });
      expect(res.status).toBe(201);
    });

    it('a comment with an empty body gives 400', async () => {
      expect((await as(bob).form('POST', `/api/posts/${postId}/comments`, { body: '' })).status).toBe(400);
      expect((await as(bob).form('POST', `/api/posts/${postId}/comments`, { body: '  ' })).status).toBe(400);
    });

    it('a comment with only an image is accepted', async () => {
      const res = await as(bob).form('POST', `/api/posts/${postId}/comments`, { body: '' }, [
        { name: 'file', filename: 'a.png', type: 'image/png', data: TINY_PNG },
      ]);
      expect(res.status).toBe(201);
    });
  });

  describe('other unknown ids no longer give 500', () => {
    it('follow, block and DM with an unknown user give 404', async () => {
      expect((await as(bob).post('/api/users/no_such_user/follow', {})).status).toBe(404);
      expect((await as(bob).post('/api/users/no_such_user/block')).status).toBe(404);
      expect((await as(bob).post('/api/conversations', { targetUserId: 'no_such_user' })).status).toBe(404);
    });
  });
});
