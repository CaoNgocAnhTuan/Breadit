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
});
