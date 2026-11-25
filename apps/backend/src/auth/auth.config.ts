// The JWT secret, read from the environment (task p10-security-fixes, S6.1). A bad setup throws, so the backend does
// not start with a weak secret in production (the same rule as `readFeedConfig`).

/** The shortest `JWT_SECRET` allowed when `NODE_ENV=production`. */
export const JWT_SECRET_MIN_LENGTH = 32;

const DEV_JWT_SECRET = 'dev-secret-change-in-prod';

/**
 * `JWT_SECRET` as a string.
 * With `NODE_ENV=production` it must be set and at least `JWT_SECRET_MIN_LENGTH` characters, or this throws.
 * Outside production an unset or empty value gives the dev value.
 */
export function readJwtSecret(env: NodeJS.ProcessEnv): string {
  const raw = env.JWT_SECRET;
  if (env.NODE_ENV === 'production') {
    if (raw === undefined || raw.length < JWT_SECRET_MIN_LENGTH) {
      throw new Error(`JWT_SECRET must be set (at least ${JWT_SECRET_MIN_LENGTH} characters) when NODE_ENV=production`);
    }
    return raw;
  }
  return raw === undefined || raw === '' ? DEV_JWT_SECRET : raw;
}
