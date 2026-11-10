import { userFeaturesAsOf } from "@breadit/ranking";
import { bucketOf } from "../checks/buckets.ts";
import { loadFrozen } from "../frozen.ts";
import { prepareAt, poolSetting } from "../harness/run.ts";
import type { Prepared } from "../harness/run.ts";
import type { DatasetTables } from "../harness/random-data.ts";
import { uid, userEventCount } from "../harness/index-data.ts";
import { userFeatureData } from "../harness/post-features.ts";
import { lastEventTime } from "../loader/time.ts";
import { rng } from "../rng.ts";

// The parity sample (design "Parity sample (eval)"): (user, asOf) pairs for the parity test of the live feed.
// The draw uses the "parity" stream of the master seed, and no clock. Two draws on the same data are equal.

export interface ParityPair {
  /** 1, 2, 3, ... in the order the pairs were accepted. */
  pair: number;
  /** Canonical user id (an integer). The app id is `u` plus the integer padded to 10 digits. */
  user: number;
  /** Seconds after the dataset epoch. */
  asOf: number;
  bucket: string;
  nHistory: number;
  nFollowees: number;
  nCommunities: number;
  poolSize: number;
}

export interface DrawOptions {
  /** Number of pairs. It must be `perBucket` times the number of history buckets. */
  n: number;
  /** Pairs for each history bucket of super-plan section 7. */
  perBucket: number;
  /** The draw stops with an error after this many draws. */
  maxDraws: number;
  /** Default: the master seed of frozen-v1.json. */
  seed?: number;
}

/**
 * Draws t uniformly in [first post time + W, last event time] and a user uniformly over all users. A pair is kept when
 * the user joined before t, has no pair yet, has a non-empty pool at t (normal pool), and their history bucket is not full.
 * Both numbers are drawn every time, so the stream does not depend on what was kept.
 */
export function drawParityPairs(prep: Prepared, data: DatasetTables, o: DrawOptions): ParityPair[] {
  const frozen = loadFrozen();
  const buckets = frozen.historyBuckets.map((b) => b.label);
  if (o.n !== o.perBucket * buckets.length) {
    throw new Error(`n (${o.n}) must be perBucket (${o.perBucket}) times the number of history buckets (${buckets.length})`);
  }
  if (data.posts.length === 0 || data.users.length === 0) throw new Error("the dataset has no posts or no users");
  const setting = poolSetting("normal");
  let firstPost = Number.POSITIVE_INFINITY;
  for (const p of data.posts) if (p.createdAt < firstPost) firstPost = p.createdAt;
  const tMin = firstPost + setting.windowSec;
  const tMax = lastEventTime(data);
  if (tMin > tMax) throw new Error(`the first post time plus W (${tMin}) is after the last event time (${tMax})`);

  const users = [...data.users].sort((a, b) => a.userId - b.userId);
  const g = rng(o.seed ?? frozen.masterSeed, "parity");
  const used = new Set<number>();
  const counts = new Map<string, number>(buckets.map((b) => [b, 0]));
  const pairs: ParityPair[] = [];

  for (let draw = 0; draw < o.maxDraws && pairs.length < o.n; draw++) {
    const t = tMin + g.int(tMax - tMin + 1);
    const user = users[g.int(users.length)] as (typeof users)[number];
    if (used.has(user.userId) || user.joinedAt >= t) continue;
    const asOf = { t };
    const bucket = bucketOf(userEventCount(prep.idx, user.userId, asOf));
    if ((counts.get(bucket) as number) >= o.perBucket) continue;
    const at = prepareAt(prep, user.userId, asOf, setting);
    if (at.pool.length === 0) continue;
    const uf = userFeaturesAsOf(uid(user.userId), asOf, userFeatureData(prep.idx, user.userId));
    used.add(user.userId);
    counts.set(bucket, (counts.get(bucket) as number) + 1);
    pairs.push({
      pair: pairs.length + 1,
      user: user.userId,
      asOf: t,
      bucket,
      nHistory: at.nHistory,
      nFollowees: uf.followees.length,
      nCommunities: uf.communities.length,
      poolSize: at.pool.length,
    });
  }

  if (pairs.length < o.n) {
    const short = buckets
      .filter((b) => (counts.get(b) as number) < o.perBucket)
      .map((b) => `"${b}" has ${counts.get(b)} of ${o.perBucket}`);
    throw new Error(`after ${o.maxDraws} draws only ${pairs.length} of ${o.n} pairs were found; bucket ${short.join(", ")}`);
  }
  return pairs;
}

/** The number of pairs in each history bucket, in the order of super-plan section 7. */
export function bucketCounts(pairs: readonly ParityPair[]): Array<{ bucket: string; n: number }> {
  return loadFrozen().historyBuckets.map((b) => ({ bucket: b.label, n: pairs.filter((p) => p.bucket === b.label).length }));
}
