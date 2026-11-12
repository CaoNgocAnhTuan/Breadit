import { DEFAULT_THROTTLE_LIMIT, THROTTLE_TTL_MS, readThrottleLimit } from './throttle.config';

describe('readThrottleLimit (TC1)', () => {
  it('keeps today\'s values: 1000 requests per 60 s', () => {
    expect(DEFAULT_THROTTLE_LIMIT).toBe(1000);
    expect(THROTTLE_TTL_MS).toBe(60000);
  });

  it('gives 1000 when THROTTLE_LIMIT is unset', () => {
    expect(readThrottleLimit({})).toBe(1000);
  });

  it('gives 1000 when THROTTLE_LIMIT is empty', () => {
    expect(readThrottleLimit({ THROTTLE_LIMIT: '' })).toBe(1000);
  });

  it('reads a positive whole number', () => {
    expect(readThrottleLimit({ THROTTLE_LIMIT: '5000' })).toBe(5000);
    expect(readThrottleLimit({ THROTTLE_LIMIT: '1' })).toBe(1);
    expect(readThrottleLimit({ THROTTLE_LIMIT: '1000000' })).toBe(1000000);
  });

  it.each(['abc', '0', '-1', '1.5', ' 7', '7 ', '1e3', '0x10', '+5', '5000 requests'])(
    'throws for %j and names THROTTLE_LIMIT',
    (bad) => {
      expect(() => readThrottleLimit({ THROTTLE_LIMIT: bad })).toThrow(/THROTTLE_LIMIT/);
    },
  );
});
