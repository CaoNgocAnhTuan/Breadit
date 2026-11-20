import { SignJWT } from 'jose';
import { BLACKLIST_PREFIX } from './auth.service';
import { readSession } from './session';
import type { RedisService } from '../redis/redis.service';

const SECRET = 'session-spec-secret-0123456789-abcdef';

/** A token like `auth.service.ts` signs it; `jti` and `exp` can be changed per test. */
async function token(opts: { jti?: string | null; exp?: number | string; secret?: string } = {}) {
  const claims: Record<string, unknown> = {
    sub: 'u1',
    username: 'alice',
    emailVerified: '2026-01-01T00:00:00.000Z',
    role: 'ADMIN',
    banned: false,
  };
  if (opts.jti !== null) claims.jti = opts.jti ?? 'jti-1';
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '30d')
    .sign(new TextEncoder().encode(opts.secret ?? SECRET));
}

function fakeRedis(get: jest.Mock): RedisService {
  return { get } as unknown as RedisService;
}

describe('readSession (S5)', () => {
  const oldSecret = process.env.JWT_SECRET;
  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });
  afterAll(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });

  it('a good token gives the user, and reads the blacklist key of its jti', async () => {
    const get = jest.fn().mockResolvedValue(null);
    const user = await readSession(await token(), fakeRedis(get));
    expect(user).toEqual({
      id: 'u1',
      username: 'alice',
      emailVerified: '2026-01-01T00:00:00.000Z',
      role: 'ADMIN',
      banned: false,
    });
    expect(get).toHaveBeenCalledWith(`${BLACKLIST_PREFIX}:jti-1`);
  });

  it('fills the defaults when the claims are missing (role USER, banned false, emailVerified null)', async () => {
    const t = await new SignJWT({ sub: 'u2', username: 'bob', jti: 'j2' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));
    const user = await readSession(t, fakeRedis(jest.fn().mockResolvedValue(null)));
    expect(user).toEqual({ id: 'u2', username: 'bob', emailVerified: null, role: 'USER', banned: false });
  });

  it('a bad token gives null and does not read Redis', async () => {
    const get = jest.fn();
    expect(await readSession('not.a.jwt', fakeRedis(get))).toBeNull();
    expect(await readSession(await token({ secret: 'another-secret-another-secret-0123' }), fakeRedis(get))).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('an expired token gives null', async () => {
    const get = jest.fn();
    const expired = await token({ exp: Math.floor(Date.now() / 1000) - 60 });
    expect(await readSession(expired, fakeRedis(get))).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('a blacklisted jti gives null', async () => {
    const get = jest.fn().mockResolvedValue('1');
    expect(await readSession(await token({ jti: 'gone' }), fakeRedis(get))).toBeNull();
    expect(get).toHaveBeenCalledWith(`${BLACKLIST_PREFIX}:gone`);
  });

  it('a token with no jti skips the Redis read and still gives the user', async () => {
    const get = jest.fn();
    const user = await readSession(await token({ jti: null }), fakeRedis(get));
    expect(user?.id).toBe('u1');
    expect(get).not.toHaveBeenCalled();
  });

  it('a Redis error reaches the caller (the guard decides)', async () => {
    const get = jest.fn().mockRejectedValue(new Error('redis down'));
    await expect(readSession(await token(), fakeRedis(get))).rejects.toThrow('redis down');
  });
});
