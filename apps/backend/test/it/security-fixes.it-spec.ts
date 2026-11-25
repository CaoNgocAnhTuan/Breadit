import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { client, createTestApp } from './helpers/app';
import { closePrisma, createUserWithCookie, prisma, uniq } from './helpers/factory';
import { connectSocket, listen, sleep, type TestSocket } from './helpers/socket';

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
});
