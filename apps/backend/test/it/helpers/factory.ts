import { randomBytes, randomUUID } from 'crypto';
import { PrismaClient, type Role, type User } from '@prisma/client';
import { SignJWT } from 'jose';

let prismaSingleton: PrismaClient | undefined;

/** One Prisma client for test data setup and checks. Call `closePrisma()` in `afterAll`. */
export function prisma(): PrismaClient {
  prismaSingleton ??= new PrismaClient();
  return prismaSingleton;
}

export async function closePrisma() {
  await prismaSingleton?.$disconnect();
  prismaSingleton = undefined;
}

/** Unique, readable name such as `alice_a1b2c3`. Usernames only allow letters, digits and `_`. */
export function uniq(prefix: string): string {
  return `${prefix}_${randomBytes(3).toString('hex')}`;
}

export async function createUser(
  opts: { username?: string; verified?: boolean; role?: Role; banned?: boolean } = {},
): Promise<User> {
  const username = opts.username ?? uniq('user');
  return prisma().user.create({
    data: {
      id: `it_${username}`,
      username,
      email: `${username}@it.test`,
      displayName: username,
      emailVerified: opts.verified === false ? null : new Date(),
      role: opts.role ?? 'USER',
      banned: opts.banned ?? false,
    },
  });
}

/**
 * Cookie header value with a valid session token, signed like `auth.service.ts` does.
 * This skips the real login, which is limited to 10 per minute.
 */
export async function cookieFor(user: User): Promise<string> {
  const token = await new SignJWT({
    sub: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified?.toISOString() ?? null,
    role: user.role,
    banned: user.banned,
    jti: randomUUID(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  return `breadit_session=${token}`;
}

/** Convenience: a user plus their cookie. */
export async function createUserWithCookie(
  opts: Parameters<typeof createUser>[0] = {},
): Promise<{ user: User; cookie: string }> {
  const user = await createUser(opts);
  return { user, cookie: await cookieFor(user) };
}
