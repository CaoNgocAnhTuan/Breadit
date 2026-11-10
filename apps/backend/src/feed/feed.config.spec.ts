import { FEED_ALGOS, readFeedConfig } from './feed.config';

describe('readFeedConfig (TC1)', () => {
  it('lists the three algos', () => {
    expect([...FEED_ALGOS]).toEqual(['chrono', 'engagement', 'social']);
  });

  it('gives no default algo and the flag off for an empty env', () => {
    expect(readFeedConfig({})).toEqual({ defaultAlgo: null, asOfEnabled: false });
  });

  it('treats an empty FEED_DEFAULT_ALGO as unset', () => {
    expect(readFeedConfig({ FEED_DEFAULT_ALGO: '' }).defaultAlgo).toBeNull();
  });

  it.each(['chrono', 'engagement', 'social'])('accepts FEED_DEFAULT_ALGO=%s', (algo) => {
    expect(readFeedConfig({ FEED_DEFAULT_ALGO: algo }).defaultAlgo).toBe(algo);
  });

  it('F13: a typo in FEED_DEFAULT_ALGO throws and names the allowed values', () => {
    expect(() => readFeedConfig({ FEED_DEFAULT_ALGO: 'sociall' })).toThrow(/chrono.*engagement.*social/);
    expect(() => readFeedConfig({ FEED_DEFAULT_ALGO: 'Social' })).toThrow();
  });

  it('FEED_ASOF_ENABLED is true only for "true"', () => {
    expect(readFeedConfig({ FEED_ASOF_ENABLED: 'true' }).asOfEnabled).toBe(true);
    expect(readFeedConfig({ FEED_ASOF_ENABLED: 'false' }).asOfEnabled).toBe(false);
    expect(readFeedConfig({ FEED_ASOF_ENABLED: '' }).asOfEnabled).toBe(false);
    expect(readFeedConfig({}).asOfEnabled).toBe(false);
  });

  it('F12: any other FEED_ASOF_ENABLED value throws', () => {
    for (const bad of ['1', 'yes', 'TRUE', 'True', 'on']) {
      expect(() => readFeedConfig({ FEED_ASOF_ENABLED: bad })).toThrow(/FEED_ASOF_ENABLED/);
    }
  });

  it('F12: the flag on with NODE_ENV=production throws', () => {
    expect(() => readFeedConfig({ FEED_ASOF_ENABLED: 'true', NODE_ENV: 'production' })).toThrow(/production/);
  });

  it('the flag off is fine in production, and the flag on is fine in other environments', () => {
    expect(readFeedConfig({ FEED_ASOF_ENABLED: 'false', NODE_ENV: 'production' }).asOfEnabled).toBe(false);
    expect(readFeedConfig({ NODE_ENV: 'production', FEED_DEFAULT_ALGO: 'social' })).toEqual({
      defaultAlgo: 'social',
      asOfEnabled: false,
    });
    expect(readFeedConfig({ FEED_ASOF_ENABLED: 'true', NODE_ENV: 'test' }).asOfEnabled).toBe(true);
    expect(readFeedConfig({ FEED_ASOF_ENABLED: 'true', NODE_ENV: 'development' }).asOfEnabled).toBe(true);
  });
});
