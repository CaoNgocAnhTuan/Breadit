import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { client, createTestApp } from './helpers/app';
import { closePrisma, createUserWithCookie, uniq } from './helpers/factory';

// TC8 (DW6): the input rules of `algo` and `asOf`.

type U = Awaited<ReturnType<typeof createUserWithCookie>>;

describe('TC8: algo and asOf input rules', () => {
  let app: NestFastifyApplication;
  let u: U;
  const as = () => client(app, u.cookie);
  const ASOF = 1_600_000_000;
  const now = () => Math.floor(Date.now() / 1000);

  beforeAll(async () => {
    app = await createTestApp();
    u = await createUserWithCookie({ username: uniq('opt') });
  });

  afterAll(async () => {
    await app.close();
    await closePrisma();
  });

  it('an unknown algo is 400', async () => {
    expect((await as().get('/api/posts?algo=foo')).status).toBe(400);
    expect((await as().get('/api/posts?algo=')).status).toBe(400);
  });

  it('algo with feed, user or communityId is 400', async () => {
    expect((await as().get('/api/posts?algo=social&feed=explore')).status).toBe(400);
    expect((await as().get('/api/posts?algo=social&feed=following')).status).toBe(400);
    expect((await as().get(`/api/posts?algo=social&user=${u.user.id}`)).status).toBe(400);
    expect((await as().get('/api/posts?algo=social&communityId=1')).status).toBe(400);
  });

  it('a guest with algo is 401', async () => {
    expect((await client(app).get('/api/posts?algo=social')).status).toBe(401);
  });

  it('a bad asOf is 400', async () => {
    for (const bad of ['abc', '1.5', '-5', '', '1e9']) {
      expect((await as().get(`/api/posts?algo=social&asOf=${bad}`)).status).toBe(400);
    }
  });

  it('asOf on For You without algo is 400 (the default algo is not set)', async () => {
    expect((await as().get(`/api/posts?asOf=${ASOF}`)).status).toBe(400);
  });

  it('asOf with feed=explore is 200', async () => {
    expect((await as().get(`/api/posts?feed=explore&asOf=${ASOF}`)).status).toBe(200);
  });

  it('asOf with feed=following is 400', async () => {
    expect((await as().get(`/api/posts?feed=following&asOf=${ASOF}`)).status).toBe(400);
  });

  it('a good algo request is 200', async () => {
    for (const algo of ['chrono', 'engagement', 'social']) {
      const res = await as().get(`/api/posts?algo=${algo}&asOf=${ASOF}`);
      expect(res.status).toBe(200);
    }
  });

  describe('F10: the cursor', () => {
    it('without asOf, a cursor older than 24 h is 400', async () => {
      const old = now() - 86_400 - 60;
      expect((await as().get(`/api/posts?algo=social&cursor=${old}:5:1`)).status).toBe(400);
    });

    it('without asOf, a cursor in the future is 400', async () => {
      expect((await as().get(`/api/posts?algo=social&cursor=${now() + 600}:5:1`)).status).toBe(400);
    });

    it('a cursor of the last hour is accepted', async () => {
      expect((await as().get(`/api/posts?algo=social&cursor=${now() - 3600}:5:1`)).status).toBe(200);
    });

    it('a cursor whose t is not asOf is 400, and one whose t is asOf is 200', async () => {
      expect((await as().get(`/api/posts?algo=social&asOf=${ASOF}&cursor=${ASOF + 1}:5:1`)).status).toBe(400);
      expect((await as().get(`/api/posts?algo=social&asOf=${ASOF}&cursor=${ASOF}:5:1`)).status).toBe(200);
    });

    it('a malformed cursor is 400', async () => {
      for (const bad of ['2', 'abc', '1:2', '1:2:3:4']) {
        expect((await as().get(`/api/posts?algo=social&cursor=${bad}`)).status).toBe(400);
      }
    });
  });

  describe('the flag', () => {
    it('with the flag off, asOf is 400', async () => {
      const prev = process.env.FEED_ASOF_ENABLED;
      process.env.FEED_ASOF_ENABLED = 'false';
      let off: NestFastifyApplication | undefined;
      try {
        off = await createTestApp();
        expect((await client(off, u.cookie).get(`/api/posts?algo=social&asOf=${ASOF}`)).status).toBe(400);
        expect((await client(off, u.cookie).get(`/api/posts?feed=explore&asOf=${ASOF}`)).status).toBe(400);
        // and the plain feeds still work
        expect((await client(off, u.cookie).get('/api/posts?algo=social')).status).toBe(200);
      } finally {
        await off?.close();
        process.env.FEED_ASOF_ENABLED = prev;
      }
    });

    it('F12: the backend does not start with the flag on and NODE_ENV=production', async () => {
      const prevEnv = process.env.NODE_ENV;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      try {
        await expect(createTestApp()).rejects.toThrow(/FEED_ASOF_ENABLED/);
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
      }
    });

    it('F13: the backend does not start with a typo in FEED_DEFAULT_ALGO', async () => {
      const prev = process.env.FEED_DEFAULT_ALGO;
      process.env.FEED_DEFAULT_ALGO = 'sociall';
      try {
        await expect(createTestApp()).rejects.toThrow(/FEED_DEFAULT_ALGO/);
      } finally {
        if (prev === undefined) delete process.env.FEED_DEFAULT_ALGO;
        else process.env.FEED_DEFAULT_ALGO = prev;
      }
    });
  });
});
