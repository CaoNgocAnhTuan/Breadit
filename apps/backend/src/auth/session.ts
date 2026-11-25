import { verifyJwt, BLACKLIST_PREFIX, PWV_PREFIX, PWV_TTL_SECONDS } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';

/** What the guards put on `req.user`. */
export type SessionUser = {
  id: string;
  username: string;
  emailVerified: string | null;
  role: string;
  banned: boolean;
};

/** The current `User.passwordVersion` of a user, or `null` when the user row does not exist. */
export type PasswordVersionOf = (userId: string) => Promise<number | null>;

/** The database read of `readSession`, used when the Redis copy of the version is missing. */
export function passwordVersionOf(prisma: PrismaService): PasswordVersionOf {
  return async (userId) => {
    const row = await prisma.user.findUnique({ where: { id: userId }, select: { passwordVersion: true } });
    return row ? row.passwordVersion : null;
  };
}

// Writes `ARGV[1]` only when it is larger than the stored number (or nothing is stored), and always renews the life
// to `ARGV[2]` seconds. Versions only grow, so a slow read of an old value can never overwrite a newer one (F2).
const SET_MAX_LUA = `
local cur = redis.call('GET', KEYS[1])
if (not cur) or tonumber(ARGV[1]) > tonumber(cur) then
  redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
else
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return 1
`;

/** Writes `value` to `key` only if it is larger than the stored one, and renews the life to `ttlSeconds`. */
export async function setMax(redis: RedisService, key: string, value: number, ttlSeconds: number): Promise<void> {
  await redis.eval(SET_MAX_LUA, 1, key, String(value), String(ttlSeconds));
}

/**
 * The one session check of both guards and of the socket handshake (S5, S6).
 * Returns the user of a good token, or `null` for a bad, expired or logged-out token, for a token made before
 * the user's last password reset (its `pwv` claim, missing = 0, is not the user's `passwordVersion`), or for a
 * user who does not exist.
 * One MGET reads the blacklist key of the `jti` (a token with no `jti` skips it) and the Redis copy of the version.
 * When the copy is missing, `versionOf` reads the column once and `setMax` writes the copy.
 * A Redis or database error is thrown to the caller: `JwtAuthGuard` answers 401, `OptionalJwtAuthGuard` goes on as a guest.
 */
export async function readSession(
  token: string,
  redis: RedisService,
  versionOf: PasswordVersionOf,
): Promise<SessionUser | null> {
  let payload: Awaited<ReturnType<typeof verifyJwt>>;
  try {
    payload = await verifyJwt(token);
  } catch {
    return null;
  }
  const userId = payload.sub;
  if (typeof userId !== 'string' || !userId) return null;

  const jti = payload['jti'] as string | undefined;
  const pwvKey = `${PWV_PREFIX}:${userId}`;
  const keys = jti ? [`${BLACKLIST_PREFIX}:${jti}`, pwvKey] : [pwvKey];
  const values = await redis.mget(...keys);
  // The token may have been blacklisted (the user logged out).
  if (jti && values[0]) return null;

  const copy = values[values.length - 1];
  let current: number;
  if (copy !== null && copy !== undefined) {
    current = Number(copy);
  } else {
    const fromDb = await versionOf(userId);
    if (fromDb === null) return null;
    current = fromDb;
    await setMax(redis, pwvKey, current, PWV_TTL_SECONDS);
  }
  const claim = typeof payload['pwv'] === 'number' ? payload['pwv'] : 0;
  if (claim !== current) return null;

  return {
    id: userId,
    username: payload['username'] as string,
    emailVerified: (payload['emailVerified'] as string | null | undefined) ?? null,
    role: (payload['role'] as string | undefined) ?? 'USER',
    banned: (payload['banned'] as boolean | undefined) ?? false,
  };
}
