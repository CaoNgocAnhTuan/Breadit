import * as fs from 'fs';
import * as path from 'path';
import { AuthService, generate6DigitCode } from './auth.service';
import { setMax } from './session';

// The password-version copy is written through `setMax` (session.ts). The test replaces it, so it can throw (TC15).
jest.mock('./session', () => ({ ...jest.requireActual('./session'), setMax: jest.fn() }));

describe('generate6DigitCode (S6.2, TC10)', () => {
  it('1,000 calls give a string of 6 digits from 100000 to 999999', () => {
    for (let i = 0; i < 1000; i++) {
      const code = generate6DigitCode();
      expect(code).toMatch(/^[0-9]{6}$/);
      expect(Number(code)).toBeGreaterThanOrEqual(100000);
      expect(Number(code)).toBeLessThanOrEqual(999999);
    }
  });

  it('auth.service.ts does not use the weak random source', () => {
    const source = fs.readFileSync(path.join(__dirname, 'auth.service.ts'), 'utf8');
    expect(source).not.toContain('Math.random');
  });
});

describe('AuthService.resetPassword (S6.4, TC15)', () => {
  it('when the Redis write fails, the pwv key is deleted and the reset still gives { ok: true }', async () => {
    const prisma = {
      verificationToken: {
        findFirst: jest.fn().mockResolvedValue({
          identifier: 'password-reset:a@it.test',
          token: 'reset-token',
          expires: new Date(Date.now() + 60_000),
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
      user: { update: jest.fn().mockResolvedValue({ id: 'u1', passwordVersion: 3 }) },
    };
    const redis = { del: jest.fn().mockResolvedValue(1) };
    (setMax as jest.Mock).mockRejectedValue(new Error('redis down'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const service = new AuthService(prisma as any, redis as any);
    await expect(service.resetPassword('reset-token', 'new-pass-2')).resolves.toEqual({ ok: true });

    // the hash and the counter are written in one update
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.passwordVersion).toEqual({ increment: 1 });
    expect(typeof data.password).toBe('string');
    expect(setMax).toHaveBeenCalledWith(redis, 'auth:pwv:u1', 3, 3600);
    expect(redis.del).toHaveBeenCalledWith('auth:pwv:u1');
    log.mockRestore();
  });
});
