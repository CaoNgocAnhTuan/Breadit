import { ForbiddenException } from '@nestjs/common';
import { EmailVerifiedGuard } from './email-verified.guard';

// TC17 (B5). A token that says "verified" passes with no database read. A token that says "not verified" is checked
// against the database, because the user may have verified after the token was made.

function setup(dbEmailVerified?: Date | null) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(dbEmailVerified === undefined ? null : { emailVerified: dbEmailVerified }),
    },
  };
  const guard = new EmailVerifiedGuard(prisma as any);
  const run = (user: Record<string, unknown> | undefined) => {
    const req: Record<string, unknown> = { user };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) };
    return { req, result: guard.canActivate(ctx as any) };
  };
  return { prisma, run };
}

describe('EmailVerifiedGuard (B5, TC17)', () => {
  it('a token with emailVerified set passes with no Prisma call', async () => {
    const { prisma, run } = setup();
    const { result } = run({ id: 'u1', emailVerified: '2026-01-01T00:00:00.000Z' });
    await expect(Promise.resolve(result)).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('null in the token and set in the database passes, and req.user.emailVerified is filled', async () => {
    const when = new Date('2026-11-25T01:00:00.000Z');
    const { prisma, run } = setup(when);
    const { req, result } = run({ id: 'u1', emailVerified: null });
    await expect(Promise.resolve(result)).resolves.toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' } }));
    expect((req.user as { emailVerified: string }).emailVerified).toBe(when.toISOString());
  });

  it('null in the token and null in the database gives ForbiddenException', async () => {
    const { run } = setup(null);
    await expect(Promise.resolve(run({ id: 'u1', emailVerified: null }).result)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a token with no emailVerified field is treated as not verified', async () => {
    const { run } = setup(null);
    await expect(Promise.resolve(run({ id: 'u1' }).result)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a user row that is gone gives ForbiddenException', async () => {
    const { run } = setup(undefined);
    await expect(Promise.resolve(run({ id: 'u1', emailVerified: null }).result)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no user on the request gives ForbiddenException with no Prisma call', async () => {
    const { prisma, run } = setup(new Date());
    await expect(Promise.resolve(run(undefined).result)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
