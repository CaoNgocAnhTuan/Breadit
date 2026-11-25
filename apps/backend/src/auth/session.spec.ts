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

/** `mget` answers [blacklist value, pwv copy], or [pwv copy] for a token with no jti. */
function fakeRedis(mget: jest.Mock): RedisService {
  return { mget } as unknown as RedisService;
}

/** The stored password version is 0 and the token has no `pwv` claim: the S5 cases do not depend on S6. */
const noVersionRead = () => jest.fn();

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
    const get = jest.fn().mockResolvedValue([null, '0']);
    const user = await readSession(await token(), fakeRedis(get), noVersionRead());
    expect(user).toEqual({
      id: 'u1',
      username: 'alice',
      emailVerified: '2026-01-01T00:00:00.000Z',
      role: 'ADMIN',
      banned: false,
    });
    expect(get).toHaveBeenCalledWith(`${BLACKLIST_PREFIX}:jti-1`, 'auth:pwv:u1');
  });

  it('fills the defaults when the claims are missing (role USER, banned false, emailVerified null)', async () => {
    const t = await new SignJWT({ sub: 'u2', username: 'bob', jti: 'j2' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));
    const user = await readSession(t, fakeRedis(jest.fn().mockResolvedValue([null, '0'])), noVersionRead());
    expect(user).toEqual({ id: 'u2', username: 'bob', emailVerified: null, role: 'USER', banned: false });
  });

  it('a bad token gives null and does not read Redis', async () => {
    const get = jest.fn();
    expect(await readSession('not.a.jwt', fakeRedis(get), noVersionRead())).toBeNull();
    expect(
      await readSession(await token({ secret: 'another-secret-another-secret-0123' }), fakeRedis(get), noVersionRead()),
    ).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('an expired token gives null', async () => {
    const get = jest.fn();
    const expired = await token({ exp: Math.floor(Date.now() / 1000) - 60 });
    expect(await readSession(expired, fakeRedis(get), noVersionRead())).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('a blacklisted jti gives null', async () => {
    const get = jest.fn().mockResolvedValue(['1', '0']);
    expect(await readSession(await token({ jti: 'gone' }), fakeRedis(get), noVersionRead())).toBeNull();
    expect(get).toHaveBeenCalledWith(`${BLACKLIST_PREFIX}:gone`, 'auth:pwv:u1');
  });

  it('a token with no jti skips the blacklist key and still gives the user', async () => {
    const get = jest.fn().mockResolvedValue(['0']);
    const user = await readSession(await token({ jti: null }), fakeRedis(get), noVersionRead());
    expect(user?.id).toBe('u1');
    expect(get).toHaveBeenCalledWith('auth:pwv:u1');
  });

  it('a Redis error reaches the caller (the guard decides)', async () => {
    const get = jest.fn().mockRejectedValue(new Error('redis down'));
    await expect(readSession(await token(), fakeRedis(get), noVersionRead())).rejects.toThrow('redis down');
  });
});

// TC12 (S6.4, F3, F4, F5). `readSession(token, redis, versionOf)`: one MGET of the blacklist key and the pwv copy.
describe('readSession and the password version (S6, TC12)', () => {
  const oldSecret = process.env.JWT_SECRET;
  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });
  afterAll(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });

  async function pwvToken(pwv?: number, jti = 'jti-1') {
    const claims: Record<string, unknown> = { sub: 'u1', username: 'alice', jti };
    if (pwv !== undefined) claims.pwv = pwv;
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(new TextEncoder().encode(SECRET));
  }

  /** `mget` answers [blacklist value, pwv copy]. */
  function redisWith(mgetResult: (string | null)[]) {
    const mget = jest.fn().mockResolvedValue(mgetResult);
    const evalFn = jest.fn().mockResolvedValue(1);
    return { redis: { mget, eval: evalFn } as unknown as RedisService, mget, evalFn };
  }

  it('a token with no pwv and a stored version 0 gives the user, with one MGET and no database read', async () => {
    const { redis, mget } = redisWith([null, '0']);
    const versionOf = jest.fn();
    const user = await readSession(await pwvToken(undefined), redis, versionOf);
    expect(user?.id).toBe('u1');
    expect(mget).toHaveBeenCalledTimes(1);
    expect(mget).toHaveBeenCalledWith(`${BLACKLIST_PREFIX}:jti-1`, 'auth:pwv:u1');
    expect(versionOf).not.toHaveBeenCalled();
  });

  it('a token with pwv 0 and a stored version 1 gives null', async () => {
    const { redis } = redisWith([null, '1']);
    expect(await readSession(await pwvToken(0), redis, jest.fn())).toBeNull();
  });

  it('a token with the same pwv as the stored version gives the user', async () => {
    const { redis } = redisWith([null, '2']);
    expect((await readSession(await pwvToken(2), redis, jest.fn()))?.id).toBe('u1');
  });

  it('a missing copy: versionOf is called once and setMax writes that value', async () => {
    const { redis, evalFn } = redisWith([null, null]);
    const versionOf = jest.fn().mockResolvedValue(1);
    const user = await readSession(await pwvToken(1), redis, versionOf);
    expect(user?.id).toBe('u1');
    expect(versionOf).toHaveBeenCalledTimes(1);
    expect(versionOf).toHaveBeenCalledWith('u1');
    expect(evalFn).toHaveBeenCalledTimes(1);
    // eval(script, numberOfKeys, key, value, ttl): the script is the Lua of setMax
    const args = evalFn.mock.calls[0];
    expect(typeof args[0]).toBe('string');
    expect(args.slice(1).map(String)).toEqual(['1', 'auth:pwv:u1', '1', '3600']);
  });

  it('a missing copy and an old token: the database version decides (null)', async () => {
    const { redis } = redisWith([null, null]);
    expect(await readSession(await pwvToken(0), redis, jest.fn().mockResolvedValue(1))).toBeNull();
  });

  it('versionOf gives null (the user row is gone): null, and nothing is written', async () => {
    const { redis, evalFn } = redisWith([null, null]);
    expect(await readSession(await pwvToken(0), redis, jest.fn().mockResolvedValue(null))).toBeNull();
    expect(evalFn).not.toHaveBeenCalled();
  });

  it('versionOf throws: the error goes up', async () => {
    const { redis } = redisWith([null, null]);
    await expect(readSession(await pwvToken(0), redis, jest.fn().mockRejectedValue(new Error('db down')))).rejects.toThrow(
      'db down',
    );
  });

  it('a blacklisted jti gives null (S5 kept)', async () => {
    const { redis } = redisWith(['1', '0']);
    expect(await readSession(await pwvToken(0, 'gone'), redis, jest.fn())).toBeNull();
  });
});
