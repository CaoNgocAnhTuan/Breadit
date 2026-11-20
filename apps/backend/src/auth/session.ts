import { verifyJwt, BLACKLIST_PREFIX } from './auth.service';
import type { RedisService } from '../redis/redis.service';

/** What the guards put on `req.user`. */
export type SessionUser = {
  id: string;
  username: string;
  emailVerified: string | null;
  role: string;
  banned: boolean;
};

/**
 * The one session check of both guards (S5).
 * Returns the user of a good token, or `null` for a bad, expired or logged-out token.
 * A token with no `jti` skips the blacklist read. A Redis error is thrown to the caller:
 * `JwtAuthGuard` answers 401, `OptionalJwtAuthGuard` goes on as a guest.
 */
export async function readSession(token: string, redis: RedisService): Promise<SessionUser | null> {
  let payload: Awaited<ReturnType<typeof verifyJwt>>;
  try {
    payload = await verifyJwt(token);
  } catch {
    return null;
  }

  // The token may have been blacklisted (the user logged out).
  const jti = payload['jti'] as string | undefined;
  if (jti) {
    const blacklisted = await redis.get(`${BLACKLIST_PREFIX}:${jti}`);
    if (blacklisted) return null;
  }

  return {
    id: payload.sub as string,
    username: payload['username'] as string,
    emailVerified: (payload['emailVerified'] as string | null | undefined) ?? null,
    role: (payload['role'] as string | undefined) ?? 'USER',
    banned: (payload['banned'] as boolean | undefined) ?? false,
  };
}
