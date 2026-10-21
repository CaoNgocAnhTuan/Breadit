import { BadRequestException } from '@nestjs/common';

/**
 * Parses a page cursor: a whole number of 1 or more.
 * A missing or empty value gives `fallback` (`undefined` if none). Anything else, like
 * `abc`, `0`, `-1` or `1.5`, throws 400 instead of becoming a database error (finding T7).
 */
export function parseCursor(raw: unknown, fallback?: number): number | undefined {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = typeof raw === 'string' && /^[0-9]+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(n) || n < 1) {
    throw new BadRequestException('Validation failed (cursor must be a whole number of 1 or more)');
  }
  return n;
}
