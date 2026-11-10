import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { isFeedAlgo, type FeedAlgo, type FeedConfig } from './feed.config';

/** The raw query values of `GET /api/posts` that decide the mode. */
export interface RawFeedOptions {
  algo?: string;
  asOf?: string;
  feed?: string;
  user?: string;
  communityId?: number | string | null;
}

export interface FeedOptions {
  /** `null` for every mode that is not an `algo` feed. */
  algo: FeedAlgo | null;
  /** Unix seconds. `null` when the request has no `asOf`. */
  asOfSec: number | null;
}

/**
 * Checks `algo` and `asOf` (design F14) and applies the default `algo`. The checks run in this order:
 * 1. asOf with the flag off: 400. 2. asOf not a whole number of seconds: 400. 3. unknown algo: 400.
 * 4. algo with feed, user or communityId: 400. 5. algo from a guest: 401.
 * 6. The default algo applies to the logged-in For You only. 7. asOf with no algo and no Explore: 400.
 */
export function resolveFeedOptions(raw: RawFeedOptions, viewerId: string | undefined, cfg: FeedConfig): FeedOptions {
  let asOfSec: number | null = null;
  if (raw.asOf !== undefined) {
    if (!cfg.asOfEnabled) throw new BadRequestException('asOf is not enabled');
    if (!/^\d+$/.test(raw.asOf) || !Number.isSafeInteger(Number(raw.asOf))) {
      throw new BadRequestException('asOf must be a whole number of Unix seconds');
    }
    asOfSec = Number(raw.asOf);
  }

  let algo: FeedAlgo | null = null;
  if (raw.algo !== undefined) {
    if (!isFeedAlgo(raw.algo)) throw new BadRequestException('Unknown algo');
    algo = raw.algo;
  }

  // `findAll` treats an empty feed or user, and the string "undefined" for user, as not given.
  const hasFeed = !!raw.feed;
  const hasUser = !!raw.user && raw.user !== 'undefined';
  const hasCommunity = raw.communityId != null;
  const isForYou = !hasFeed && !hasUser && !hasCommunity;

  if (algo !== null) {
    if (!isForYou) throw new BadRequestException('algo works only on the For You feed');
    if (!viewerId) throw new UnauthorizedException();
  } else if (isForYou && viewerId) {
    algo = cfg.defaultAlgo;
  }

  if (asOfSec !== null && algo === null && raw.feed !== 'explore') {
    throw new BadRequestException('asOf works only with algo or feed=explore');
  }
  return { algo, asOfSec };
}
