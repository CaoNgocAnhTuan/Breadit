import { BadRequestException } from '@nestjs/common';
import { parseCursor } from './parse-cursor';

describe('parseCursor', () => {
  it.each(['abc', '0', '-1', '1.5', '1e3', '2abc', ' 3', 'NaN', '99999999999999999999'])(
    'T7: rejects "%s" with 400',
    (raw) => {
      expect(() => parseCursor(raw, 1)).toThrow(BadRequestException);
    },
  );

  it('rejects values that are not strings, such as an array from ?cursor=1&cursor=2', () => {
    expect(() => parseCursor(['1', '2'], 1)).toThrow(BadRequestException);
    expect(() => parseCursor(NaN, 1)).toThrow(BadRequestException);
  });

  it.each([
    ['1', 1],
    ['2', 2],
    ['40', 40],
  ])('accepts "%s"', (raw, expected) => {
    expect(parseCursor(raw, 1)).toBe(expected);
  });

  it('uses the fallback when the value is missing or empty', () => {
    expect(parseCursor(undefined, 1)).toBe(1);
    expect(parseCursor('', 1)).toBe(1);
    expect(parseCursor(null, 1)).toBe(1);
  });

  it('returns undefined for a missing value when there is no fallback', () => {
    expect(parseCursor(undefined)).toBeUndefined();
  });
});
