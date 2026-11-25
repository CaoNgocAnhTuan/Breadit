import * as bcrypt from 'bcryptjs';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { RedisService } from '../../src/redis/redis.service';
import { setMax } from '../../src/auth/session';
import { client, createTestApp } from './helpers/app';
import { closePrisma, createUser, createUserWithCookie, prisma, uniq } from './helpers/factory';
import { TINY_PNG } from './helpers/multipart';
import { connectSocket, listen, sleep, type TestSocket } from './helpers/socket';
import * as fs from 'fs';

type U = Awaited<ReturnType<typeof createUserWithCookie>>;

/** Task p10-security-fixes: one describe per fix group. The tests make their own users and rows. */
describe('p10 security fixes', () => {
  let app: NestFastifyApplication;
  let url: string;
  const open: TestSocket[] = [];
  const as = (u: U) => client(app, u.cookie);

  beforeAll(async () => {
    app = await createTestApp();
    url = await listen(app);
  });

  afterEach(async () => {
    while (open.length) open.pop()!.close();
    await sleep(50);
  });

  afterAll(async () => {
    await app.close();
    await closePrisma();
  });

  describe('B1: moderation and promote bodies are checked', () => {
    let owner: U;
    let mod: U;
    let member: U;
    let author: U;
    let communityId: number;

    beforeAll(async () => {
      [owner, mod, member, author] = await Promise.all([
        createUserWithCookie({ username: uniq('b1owner') }),
        createUserWithCookie({ username: uniq('b1mod') }),
        createUserWithCookie({ username: uniq('b1member') }),
        createUserWithCookie({ username: uniq('b1author') }),
      ]);
      const c = await as(owner).post('/api/communities', { name: 'B1 Club', slug: uniq('b1club') });
      expect(c.status).toBe(201);
      communityId = c.body.id;
      for (const u of [mod, member, author]) {
        expect((await as(u).post(`/api/communities/${communityId}/join`)).status).toBe(201);
      }
      expect(
        (await as(owner).post(`/api/communities/${communityId}/promote/${mod.user.id}`, { role: 'MOD' })).status,
      ).toBe(201);
    });

    async function pendingPost(desc: string): Promise<number> {
      const p = await as(author).form('POST', '/api/posts', { desc, communityId: String(communityId) });
      expect(p.status).toBe(201);
      expect(p.body.isApproved).toBe(false);
      return p.body.id;
    }

    it('TC1 (DW1): "APROVE" and {} give 400 and the post is kept; "APPROVE" still works', async () => {
      const postId = await pendingPost('pending for B1 TC1');
      const modUrl = `/api/communities/${communityId}/posts/${postId}/moderate`;

      expect((await as(mod).post(modUrl, { action: 'APROVE' })).status).toBe(400);
      expect((await as(mod).post(modUrl, {})).status).toBe(400);
      const kept = await prisma().post.findUniqueOrThrow({ where: { id: postId } });
      expect(kept.deletedAt).toBeNull();
      expect(kept.isApproved).toBe(false);

      expect((await as(mod).post(modUrl, { action: 'APPROVE' })).status).toBe(201);
      const approved = await prisma().post.findUniqueOrThrow({ where: { id: postId } });
      expect(approved.isApproved).toBe(true);
      expect(approved.deletedAt).toBeNull();
    });

    it('TC2 (DW2): promote with {"role":"ADMIN"} gives 400; MOD works; OWNER stays 403', async () => {
      const roleOf = async (u: U) =>
        (
          await prisma().communityMember.findUniqueOrThrow({
            where: { userId_communityId: { userId: u.user.id, communityId } },
          })
        ).role;
      const promote = (role: unknown) =>
        as(owner).post(`/api/communities/${communityId}/promote/${member.user.id}`, { role });

      expect((await promote('ADMIN')).status).toBe(400);
      expect((await promote(undefined)).status).toBe(400);
      expect(await roleOf(member)).toBe('MEMBER');

      expect((await promote('MOD')).status).toBe(201);
      expect(await roleOf(member)).toBe('MOD');

      expect((await promote('OWNER')).status).toBe(403);
      expect(await roleOf(member)).toBe('MOD');
    });
  });

  describe('R6: an admin cannot ban their own account or another admin', () => {
    it('TC3 (DW3, F15): both bans give 400, banned stays false, and no accountBanned is sent', async () => {
      const admin1 = await createUserWithCookie({ username: uniq('r6admin1'), role: 'ADMIN' });
      const admin2 = await createUserWithCookie({ username: uniq('r6admin2'), role: 'ADMIN' });
      const s1 = (await connectSocket(url, admin1.cookie)).socket;
      const s2 = (await connectSocket(url, admin2.cookie)).socket;
      open.push(s1, s2);
      s1.emit('newUser', admin1.user.username);
      s2.emit('newUser', admin2.user.username);
      await sleep(300);

      expect((await as(admin1).post(`/api/admin/users/${admin1.user.id}/ban`)).status).toBe(400);
      expect((await as(admin1).post(`/api/admin/users/${admin2.user.id}/ban`)).status).toBe(400);
      expect((await as(admin2).post(`/api/admin/users/${admin1.user.id}/ban`)).status).toBe(400);
      await sleep(400);

      for (const a of [admin1, admin2]) {
        const row = await prisma().user.findUniqueOrThrow({ where: { id: a.user.id } });
        expect(row.banned).toBe(false);
      }
      expect(s1.log.accountBanned).toHaveLength(0);
      expect(s2.log.accountBanned).toHaveLength(0);
    });

    it('TC4 (DW4): an admin still bans and unbans a normal user (regression)', async () => {
      const admin = await createUserWithCookie({ username: uniq('r6admin'), role: 'ADMIN' });
      const victim = await createUserWithCookie({ username: uniq('r6victim') });

      expect((await as(admin).post(`/api/admin/users/${victim.user.id}/ban`)).status).toBe(200);
      expect((await prisma().user.findUniqueOrThrow({ where: { id: victim.user.id } })).banned).toBe(true);

      expect((await as(admin).post(`/api/admin/users/${victim.user.id}/unban`)).status).toBe(200);
      expect((await prisma().user.findUniqueOrThrow({ where: { id: victim.user.id } })).banned).toBe(false);
    });
  });

  describe('S4: uploads keep only image and video types, with nosniff', () => {
    const uploadDir = () => process.env.UPLOAD_DIR as string;
    const filesOnDisk = () => fs.readdirSync(uploadDir()).sort();
    const upload = (u: U, filename: string, type: string, data: Buffer) =>
      as(u).form('POST', '/api/uploads', {}, [{ name: 'file', filename, type, data }]);

    it('TC7 (DW5, F8): evil.html typed video/mp4 is stored as .mp4; text/html and a fake image give 400 and write nothing', async () => {
      const bob = await createUserWithCookie({ username: uniq('s4user') });

      const video = await upload(bob, 'evil.html', 'video/mp4', Buffer.from('<script>alert(1)</script>'));
      expect(video.status).toBe(201);
      expect(video.body.filename).toMatch(/\.mp4$/);
      expect(video.body.filename).not.toMatch(/html/);
      fs.rmSync(`${uploadDir()}/${video.body.filename}`, { force: true });

      const before = filesOnDisk();
      const html = await upload(bob, 'evil.html', 'text/html', Buffer.from('<script>alert(1)</script>'));
      expect(html.status).toBe(400);
      const fake = await upload(bob, 'fake.png', 'image/png', Buffer.from('this is not a picture'));
      expect(fake.status).toBe(400);
      const blob = await upload(bob, 'blob.bin', 'application/octet-stream', Buffer.from('abc'));
      expect(blob.status).toBe(400);
      expect(filesOnDisk()).toEqual(before);
    });

    it('TC8 (DW6): GET /uploads/<file> answers with X-Content-Type-Options: nosniff', async () => {
      const bob = await createUserWithCookie({ username: uniq('s4nosniff') });
      const up = await upload(bob, 'pic.png', 'image/png', TINY_PNG);
      expect(up.status).toBe(201);
      const res = await client(app).get(`/uploads/${up.body.filename}`);
      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('S6: per-email code tries, and a reset ends older sessions', () => {
    const redis = () => app.get(RedisService);
    const triesKey = (email: string) => `auth:verify-tries:${email}`;
    let ipCounter = 0;
    /** A new remote address for each call: the 10 per minute IP limit of /verify must not be what answers. */
    const verify = (email: string, code: string) =>
      client(app, undefined, `10.20.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`).post('/api/auth/verify', {
        email,
        code,
      });
    const plantCode = (email: string, code: string) =>
      prisma().verificationToken.create({
        data: {
          identifier: `email-verify:${email}`,
          token: `email-verify:${email}:${code}`,
          expires: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
    const verifiedAt = async (id: string) =>
      (await prisma().user.findUniqueOrThrow({ where: { id } })).emailVerified;

    it('TC11 (DW9, F7): 5 wrong codes, then even the right code gives 429 until the tries key is gone', async () => {
      const user = await createUser({ username: uniq('s6tries'), verified: false });
      await plantCode(user.email, '123456');

      for (let i = 1; i <= 5; i++) {
        expect((await verify(user.email, `00000${i}`)).status).toBe(400);
      }

      const blocked = await verify(user.email, '123456');
      expect(blocked.status).toBe(429);
      expect(await verifiedAt(user.id)).toBeNull();
      const ttl = await redis().ttl(triesKey(user.email));
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(900);

      await redis().del(triesKey(user.email)); // as if 15 minutes passed
      expect((await verify(user.email, '123456')).status).toBe(200);
      expect(await verifiedAt(user.id)).not.toBeNull();
    });

    it('TC11: a right code on an early try deletes the tries key', async () => {
      const user = await createUser({ username: uniq('s6early'), verified: false });
      await plantCode(user.email, '654321');
      expect((await verify(user.email, '000000')).status).toBe(400);
      expect(await redis().exists(triesKey(user.email))).toBe(1);
      expect((await verify(user.email, '654321')).status).toBe(200);
      expect(await redis().exists(triesKey(user.email))).toBe(0);
    });

    it('TC13 (F2): setMax keeps the larger value and renews the life; on an empty key it writes the value', async () => {
      const key = `auth:pwv:${uniq('tc13')}`;
      await setMax(redis(), key, 2, 3600);
      expect(await redis().get(key)).toBe('2');
      await setMax(redis(), key, 1, 1800); // a slow read of an old value
      expect(await redis().get(key)).toBe('2');
      const ttl = await redis().ttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(1800); // renewed to the new life, not the first 3600

      const empty = `auth:pwv:${uniq('tc13b')}`;
      await setMax(redis(), empty, 1, 3600);
      expect(await redis().get(empty)).toBe('1');
      await redis().del(key, empty);
    });

    it('TC14 (DW10, F16): a password reset ends older sessions on HTTP and on sockets; a new sign-in works', async () => {
      const user = await createUser({ username: uniq('s6reset') });
      await prisma().user.update({ where: { id: user.id }, data: { password: await bcrypt.hash('old-pass-1', 4) } });
      const cookieOf = (res: { headers: Record<string, unknown> }) =>
        ([] as string[])
          .concat(res.headers['set-cookie'] as string | string[])
          .map((c) => c.split(';')[0])
          .find((c) => c.startsWith('breadit_session='))!;

      const loginA = await client(app).post('/api/auth/login', { email: user.email, password: 'old-pass-1' });
      expect(loginA.status).toBe(200);
      const cookieA = cookieOf(loginA);
      expect((await client(app, cookieA).get('/api/auth/me')).status).toBe(200);
      const before = await connectSocket(url, cookieA);
      open.push(before.socket);
      expect(before.connected).toBe(true);

      // The reset token is in the database: the mail cannot be sent in the tests.
      expect((await client(app).post('/api/auth/forgot-password', { email: user.email })).status).toBe(200);
      const row = await prisma().verificationToken.findFirstOrThrow({
        where: { identifier: `password-reset:${user.email}` },
      });
      const reset = await client(app).post('/api/auth/reset-password', { token: row.token, password: 'new-pass-2' });
      expect(reset.status).toBe(200);

      expect((await client(app, cookieA).get('/api/auth/me')).status).toBe(401);
      expect((await client(app, cookieA).form('POST', '/api/posts', { desc: 'old cookie post' })).status).toBe(401);
      const after = await connectSocket(url, cookieA);
      open.push(after.socket);
      expect(after.connected).toBe(false);

      const loginB = await client(app).post('/api/auth/login', { email: user.email, password: 'new-pass-2' });
      expect(loginB.status).toBe(200);
      const cookieB = cookieOf(loginB);
      expect((await client(app, cookieB).get('/api/auth/me')).status).toBe(200);
      const post = await client(app, cookieB).form('POST', '/api/posts', { desc: 'new cookie post' });
      expect(post.status).toBe(201);
    });
  });
});
