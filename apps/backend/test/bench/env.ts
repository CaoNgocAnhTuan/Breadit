/**
 * Environment of the E7 prepare step (task p7-cost-benchmark). Loaded after `test/parity/env.ts` (jest `setupFiles`),
 * which sets the schema `eval_load`, Redis database 2, the cache off and `asOf` on.
 */
import * as path from 'path';

// The 601 or more inject calls of the prepare step come from one IP and must not get 429.
process.env.THROTTLE_LIMIT = '1000000';

// The runner passes one secret to this step and to the backend it starts (design: F6).
if (process.env.E7_JWT_SECRET) process.env.JWT_SECRET = process.env.E7_JWT_SECRET;

/** Where the raw files go (git-ignored). */
export const E7_OUT = path.resolve(process.env.E7_OUT ?? path.resolve(__dirname, '../../../../eval/results/p7-e7'));
