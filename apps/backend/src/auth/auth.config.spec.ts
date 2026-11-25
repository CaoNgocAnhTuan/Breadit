import { JWT_SECRET_MIN_LENGTH, readJwtSecret } from './auth.config';

// TC9 (S6.1, DW7). The same rule as `readFeedConfig`: a bad setup stops the backend at start.

const DEV_SECRET = 'dev-secret-change-in-prod';
const env = (o: Record<string, string | undefined>) => o as NodeJS.ProcessEnv;

describe('readJwtSecret (S6.1, TC9)', () => {
  it('the minimum is 32 characters', () => {
    expect(JWT_SECRET_MIN_LENGTH).toBe(32);
  });

  it('production with the secret unset, empty or 31 characters throws a message that names JWT_SECRET', () => {
    for (const JWT_SECRET of [undefined, '', 'x'.repeat(31)]) {
      expect(() => readJwtSecret(env({ NODE_ENV: 'production', JWT_SECRET }))).toThrow(/JWT_SECRET/);
    }
  });

  it('production with 32 characters returns the secret', () => {
    const secret = 'y'.repeat(32);
    expect(readJwtSecret(env({ NODE_ENV: 'production', JWT_SECRET: secret }))).toBe(secret);
  });

  it('outside production, an unset or empty secret gives the dev value', () => {
    expect(readJwtSecret(env({}))).toBe(DEV_SECRET);
    expect(readJwtSecret(env({ JWT_SECRET: '' }))).toBe(DEV_SECRET);
    expect(readJwtSecret(env({ NODE_ENV: 'development', JWT_SECRET: '' }))).toBe(DEV_SECRET);
    expect(readJwtSecret(env({ NODE_ENV: 'test' }))).toBe(DEV_SECRET);
  });

  it('outside production, a set secret is used as it is, short or not', () => {
    expect(readJwtSecret(env({ JWT_SECRET: 'short' }))).toBe('short');
  });
});
