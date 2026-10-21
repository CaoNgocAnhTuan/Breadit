import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { client, createTestApp } from './helpers/app';
import { closePrisma, createUserWithCookie, prisma, uniq } from './helpers/factory';
import { TINY_PNG } from './helpers/multipart';

type U = Awaited<ReturnType<typeof createUserWithCookie>>;

describe('N4: avatar and cover URLs', () => {
  let app: NestFastifyApplication;
  let bob: U;
  const as = (u: U) => client(app, u.cookie);

  beforeAll(async () => {
    app = await createTestApp();
    bob = await createUserWithCookie({ username: uniq('bob') });
  });

  afterAll(async () => {
    await app.close();
    await closePrisma();
  });

  const stored = async () =>
    prisma().user.findUniqueOrThrow({ where: { id: bob.user.id }, select: { img: true, cover: true } });

  it('an avatar on an unknown host gives 400 and is not stored', async () => {
    expect((await as(bob).patch('/api/users/me', { img: 'https://evil.example/x.png' })).status).toBe(400);
    expect((await stored()).img).toBeNull();
  });

  it('a cover with a javascript: URL gives 400', async () => {
    expect((await as(bob).patch('/api/users/me', { cover: 'javascript:alert(1)' })).status).toBe(400);
    expect((await stored()).cover).toBeNull();
  });

  it('an http URL on an allowed host gives 400 (https only)', async () => {
    expect((await as(bob).patch('/api/users/me', { img: 'http://res.cloudinary.com/x.jpg' })).status).toBe(400);
  });

  it('an uploaded file name is accepted', async () => {
    const res = await as(bob).patch('/api/users/me', { img: 'abc123.jpg' });
    expect(res.status).toBe(200);
    expect(res.body.img).toBe('abc123.jpg');
  });

  it('an https URL on an allowed host is accepted', async () => {
    const res = await as(bob).patch('/api/users/me', { cover: 'https://picsum.photos/seed/a/600/200' });
    expect(res.status).toBe(200);
  });

  it('the real flow works: upload a file, then save the returned file name as avatar', async () => {
    const up = await as(bob).form('POST', '/api/uploads', { imgType: 'square' }, [
      { name: 'file', filename: 'me.png', type: 'image/png', data: TINY_PNG },
    ]);
    expect(up.status).toBe(201);
    const res = await as(bob).patch('/api/users/me', { img: up.body.filename, bio: 'new bio' });
    expect(res.status).toBe(200);
    expect(res.body.img).toBe(up.body.filename);
    expect(res.body.bio).toBe('new bio');
  });

  it('other profile fields still save without any image (regression)', async () => {
    const res = await as(bob).patch('/api/users/me', { displayName: 'Bob B', location: 'Hanoi' });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Bob B');
  });

  it('community images follow the same rule', async () => {
    const owner = await createUserWithCookie({ username: uniq('owner') });
    const c = await as(owner).post('/api/communities', { name: 'Img Club', slug: uniq('img') });
    expect(c.status).toBe(201);
    const url = `/api/communities/${c.body.id}`;
    expect((await as(owner).patch(url, { img: 'https://evil.example/x.png' })).status).toBe(400);
    expect((await as(owner).patch(url, { cover: '../../etc/passwd' })).status).toBe(400);
    expect((await as(owner).patch(url, { img: 'logo.png', description: 'ok' })).status).toBe(200);
  });
});
