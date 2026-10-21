import { COMMENT_BODY_MAX, POST_DESC_MAX, codePointLength, isTooLong } from './limits';

describe('limits', () => {
  it('matches the database column sizes', () => {
    expect(POST_DESC_MAX).toBe(255);
    expect(COMMENT_BODY_MAX).toBe(1000);
  });

  it('counts an emoji as one character, like Postgres does', () => {
    expect(codePointLength('😀')).toBe(1);
    expect(codePointLength('abc')).toBe(3);
    expect(codePointLength('')).toBe(0);
  });

  it('B3: allows exactly the maximum and rejects one more', () => {
    expect(isTooLong('x'.repeat(255), POST_DESC_MAX)).toBe(false);
    expect(isTooLong('x'.repeat(256), POST_DESC_MAX)).toBe(true);
    expect(isTooLong('😀'.repeat(255), POST_DESC_MAX)).toBe(false);
  });

  it('treats undefined as not too long', () => {
    expect(isTooLong(undefined, POST_DESC_MAX)).toBe(false);
  });
});
