// Feed settings read once from the environment when the app starts (design: Approach, "Options and config").
// A wrong value throws, so the backend does not start with a silent fallback (F12, F13).

export const FEED_ALGOS = ['chrono', 'engagement', 'social'] as const;
export type FeedAlgo = (typeof FEED_ALGOS)[number];

export function isFeedAlgo(v: unknown): v is FeedAlgo {
  return typeof v === 'string' && (FEED_ALGOS as readonly string[]).includes(v);
}

export interface FeedConfig {
  /** The algo of the logged-in For You when the request has none. `null` is today's For You. */
  defaultAlgo: FeedAlgo | null;
  /** Test only: the `asOf` query parameter is accepted. Never on in production. */
  asOfEnabled: boolean;
}

/** Nest injection token of the `FeedConfig` provider. */
export const FEED_CONFIG = 'FEED_CONFIG';

export function readFeedConfig(env: NodeJS.ProcessEnv): FeedConfig {
  const rawAlgo = env.FEED_DEFAULT_ALGO;
  let defaultAlgo: FeedAlgo | null = null;
  if (rawAlgo !== undefined && rawAlgo !== '') {
    if (!isFeedAlgo(rawAlgo)) {
      throw new Error(`FEED_DEFAULT_ALGO is "${rawAlgo}"; allowed: ${FEED_ALGOS.join(', ')} (or leave it unset)`);
    }
    defaultAlgo = rawAlgo;
  }

  const rawFlag = env.FEED_ASOF_ENABLED;
  let asOfEnabled = false;
  if (rawFlag !== undefined && rawFlag !== '' && rawFlag !== 'false') {
    if (rawFlag !== 'true') {
      throw new Error(`FEED_ASOF_ENABLED is "${rawFlag}"; allowed: true, false (or leave it unset)`);
    }
    asOfEnabled = true;
  }
  if (asOfEnabled && env.NODE_ENV === 'production') {
    throw new Error('FEED_ASOF_ENABLED=true is for tests only and must not be set when NODE_ENV=production');
  }
  return { defaultAlgo, asOfEnabled };
}
