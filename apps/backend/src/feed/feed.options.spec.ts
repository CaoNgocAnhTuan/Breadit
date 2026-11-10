import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { FeedConfig } from './feed.config';
import { resolveFeedOptions } from './feed.options';

const OFF: FeedConfig = { defaultAlgo: null, asOfEnabled: false };
const ON: FeedConfig = { defaultAlgo: null, asOfEnabled: true };
const ON_SOCIAL: FeedConfig = { defaultAlgo: 'social', asOfEnabled: true };
const ME = 'user-1';

describe('resolveFeedOptions (TC5)', () => {
  it('gives no algo and no asOf for a plain For You', () => {
    expect(resolveFeedOptions({}, ME, OFF)).toEqual({ algo: null, asOfSec: null });
    expect(resolveFeedOptions({}, undefined, OFF)).toEqual({ algo: null, asOfSec: null });
  });

  it('accepts each algo for a logged-in For You', () => {
    for (const algo of ['chrono', 'engagement', 'social']) {
      expect(resolveFeedOptions({ algo }, ME, OFF)).toEqual({ algo, asOfSec: null });
    }
  });

  it('1. asOf with the flag off is 400, before anything else', () => {
    expect(() => resolveFeedOptions({ asOf: '100' }, ME, OFF)).toThrow(BadRequestException);
    // even when algo is unknown or the viewer is a guest: the flag check is first
    expect(() => resolveFeedOptions({ asOf: '100', algo: 'foo' }, undefined, OFF)).toThrow(/asOf/);
    expect(() => resolveFeedOptions({ asOf: '100', algo: 'social' }, undefined, OFF)).toThrow(BadRequestException);
  });

  it('2. asOf must be a whole number of seconds', () => {
    for (const bad of ['', 'abc', '1.5', '-1', '1e3', ' 5', '5 ', '99999999999999999999']) {
      expect(() => resolveFeedOptions({ asOf: bad, algo: 'social' }, ME, ON)).toThrow(BadRequestException);
    }
    expect(resolveFeedOptions({ asOf: '1700000000', algo: 'social' }, ME, ON)).toEqual({
      algo: 'social',
      asOfSec: 1_700_000_000,
    });
    expect(resolveFeedOptions({ asOf: '0', algo: 'chrono' }, ME, ON).asOfSec).toBe(0);
  });

  it('3. an unknown algo is 400', () => {
    for (const bad of ['foo', 'Social', '', 'social ']) {
      expect(() => resolveFeedOptions({ algo: bad }, ME, OFF)).toThrow(BadRequestException);
    }
  });

  it('4. algo with feed, user or communityId is 400', () => {
    expect(() => resolveFeedOptions({ algo: 'social', feed: 'explore' }, ME, OFF)).toThrow(BadRequestException);
    expect(() => resolveFeedOptions({ algo: 'social', feed: 'following' }, ME, OFF)).toThrow(BadRequestException);
    expect(() => resolveFeedOptions({ algo: 'social', user: 'someone' }, ME, OFF)).toThrow(BadRequestException);
    expect(() => resolveFeedOptions({ algo: 'social', communityId: 3 }, ME, OFF)).toThrow(BadRequestException);
  });

  it('4. the string "undefined" and the empty string for user count as absent', () => {
    expect(resolveFeedOptions({ algo: 'social', user: 'undefined' }, ME, OFF).algo).toBe('social');
    expect(resolveFeedOptions({ algo: 'social', user: '' }, ME, OFF).algo).toBe('social');
    expect(resolveFeedOptions({ user: 'undefined' }, ME, ON_SOCIAL).algo).toBe('social');
  });

  it('4 comes before 5: a guest with algo and feed gets 400', () => {
    expect(() => resolveFeedOptions({ algo: 'social', feed: 'explore' }, undefined, OFF)).toThrow(BadRequestException);
  });

  it('5. a guest with algo is 401', () => {
    expect(() => resolveFeedOptions({ algo: 'social' }, undefined, OFF)).toThrow(UnauthorizedException);
  });

  it('3 comes before 5: a guest with an unknown algo gets 400', () => {
    expect(() => resolveFeedOptions({ algo: 'foo' }, undefined, OFF)).toThrow(BadRequestException);
  });

  describe('6. the default algo', () => {
    it('applies to the logged-in For You', () => {
      expect(resolveFeedOptions({}, ME, ON_SOCIAL)).toEqual({ algo: 'social', asOfSec: null });
    });

    it('an explicit algo wins over the default', () => {
      expect(resolveFeedOptions({ algo: 'chrono' }, ME, ON_SOCIAL).algo).toBe('chrono');
    });

    it('does not apply to a guest', () => {
      expect(resolveFeedOptions({}, undefined, ON_SOCIAL).algo).toBeNull();
    });

    it('does not apply to feed, user or communityId', () => {
      expect(resolveFeedOptions({ feed: 'explore' }, ME, ON_SOCIAL).algo).toBeNull();
      expect(resolveFeedOptions({ feed: 'following' }, ME, ON_SOCIAL).algo).toBeNull();
      expect(resolveFeedOptions({ user: 'someone' }, ME, ON_SOCIAL).algo).toBeNull();
      expect(resolveFeedOptions({ communityId: 4 }, ME, ON_SOCIAL).algo).toBeNull();
    });
  });

  describe('7. asOf needs an algo or Explore', () => {
    it('asOf without algo on For You is 400', () => {
      expect(() => resolveFeedOptions({ asOf: '100' }, ME, ON)).toThrow(BadRequestException);
    });

    it('asOf on For You is fine when the default algo applies', () => {
      expect(resolveFeedOptions({ asOf: '100' }, ME, ON_SOCIAL)).toEqual({ algo: 'social', asOfSec: 100 });
    });

    it('asOf with feed=explore is allowed, for a user and for a guest', () => {
      expect(resolveFeedOptions({ asOf: '100', feed: 'explore' }, ME, ON)).toEqual({ algo: null, asOfSec: 100 });
      expect(resolveFeedOptions({ asOf: '100', feed: 'explore' }, undefined, ON)).toEqual({ algo: null, asOfSec: 100 });
    });

    it('asOf with feed=following, user, communityId or a guest For You is 400', () => {
      expect(() => resolveFeedOptions({ asOf: '100', feed: 'following' }, ME, ON)).toThrow(BadRequestException);
      expect(() => resolveFeedOptions({ asOf: '100', user: 'x' }, ME, ON)).toThrow(BadRequestException);
      expect(() => resolveFeedOptions({ asOf: '100', communityId: 2 }, ME, ON)).toThrow(BadRequestException);
      expect(() => resolveFeedOptions({ asOf: '100' }, undefined, ON_SOCIAL)).toThrow(BadRequestException);
    });
  });
});
