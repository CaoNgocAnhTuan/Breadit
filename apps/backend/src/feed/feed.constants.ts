import type { MethodId, PoolParams } from '@breadit/ranking';
import type { FeedAlgo } from './feed.config';

// The feed module has no ranking logic: it picks a method of @breadit/ranking and its params.

/** Which method of the thesis each `algo` runs (design: Decisions taken from the Spec, 1). */
export const ALGO_METHOD: Record<FeedAlgo, MethodId> = {
  chrono: 'BL0',
  engagement: 'BL2',
  social: 'H',
};

/** Frozen values of super-plan section 7: W = 7 days, N_max = 2000. A test checks them against frozen-v1.json. */
export const POOL_PARAMS: PoolParams = { windowSec: 7 * 86400, maxPosts: 2000 };

/** Frozen value of super-plan section 7: the prior strength m. */
export const PRIOR_M = 5;

// alpha and beta: placeholder until P7; task 11 writes the tuned values.
export const SOCIAL_PARAMS = { alpha: 1, beta: 1 } as const;

/** The params the scorer of an `algo` needs (a missing one makes the scorer throw). */
export function methodParams(algo: FeedAlgo): Record<string, number> {
  if (algo === 'social') return { alpha: SOCIAL_PARAMS.alpha, beta: SOCIAL_PARAMS.beta, m: PRIOR_M };
  return {};
}
