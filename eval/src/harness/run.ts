import { buildPool, rankPool, scorer, userFeaturesAsOf } from "@breadit/ranking";
import type { AsOf, Follow, Membership, Positive, Post, PostFeatures, PostId, UserFeatureData, UserFeatures, UserId } from "@breadit/ranking";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { loadDataset } from "../canonical/dataset.ts";
import { sha256Hex } from "../canonical/csv.ts";
import { bucketOf, cutTime } from "../checks/buckets.ts";
import { loadFrozen } from "../frozen.ts";
import { CoverageTracker, GROUPS, groupsOf, summarize } from "../metrics.ts";
import type { CoverageRow, RankRow, SummaryRow } from "../metrics.ts";
import { fixedVariants, validateConfig } from "./config.ts";
import type { ModeName, PoolName, RunConfig, Variant } from "./config.ts";
import { buildDataIndex, followeeEngagement, positiveEvents, uid, userEventCount, userFollows, userMemberships, windowCandidates } from "./index-data.ts";
import type { DataIndex } from "./index-data.ts";
import { fastPostFeatures, referencePositives, referencePostFeatures, userFeatureData } from "./post-features.ts";
import type { DatasetTables } from "./random-data.ts";
import { splitItems } from "./split.ts";
import type { Event, SplitName } from "./split.ts";

// The harness run (design "Approach", "One run"). For each user's item it builds the as-of user features and the pool with
// the functions of @breadit/ranking, ranks the pool with each method, and records where the item landed.

const DAY = 86400;
/** Canonical data has no blocked users (design "Failure modes"). */
const NO_BLOCKED: ReadonlySet<UserId> = new Set();

export interface PoolSetting {
  windowSec: number;
  maxPosts: number;
}

/** "normal" is W and N_max of super-plan section 7, "large" is W_L and N_L (E8). */
export function poolSetting(name: PoolName): PoolSetting {
  const f = loadFrozen();
  if (name === "normal") return { windowSec: f.windowDays * DAY, maxPosts: f.poolCap };
  return { windowSec: f.poolLarge.windowDays * DAY, maxPosts: f.poolLarge.poolCap };
}

export interface RunParams {
  split: SplitName;
  variants: Variant[];
  pool: PoolName;
  mode: ModeName;
}

export interface DatasetRunOptions {
  /** T must equal this value (cutTimes of frozen-v1.json), or the run stops. */
  expectedT?: number;
  /** Use this T and do not compute it (the leakage test holds T fixed). */
  holdT?: number;
  /** Rank only these users' items. */
  onlyUsers?: ReadonlySet<number>;
  /** Count items and left-out users, and rank nothing. */
  countOnly?: boolean;
}

export interface PerUserRow {
  dataset: string;
  split: string;
  method: string;
  userId: number;
  bucket: string;
  nHistory: number;
  nFollowees: number;
  testPostId: number;
  rank: number;
}

export interface LeftOutRow {
  dataset: string;
  split: string;
  bucket: string;
  nTestUsers: number;
  nLeftOut: number;
}

export interface DatasetRun {
  dataset: string;
  split: string;
  T: number;
  perUser: PerUserRow[];
  summary: SummaryRow[];
  coverage: CoverageRow[];
  leftOut: LeftOutRow[];
}

export interface RunResult {
  datasets: DatasetRun[];
  /** Dataset id to the SHA-256 of its manifest.json. */
  inputs: Record<string, string>;
}

interface RefData {
  data: UserFeatureData;
  positives: Positive[];
}

export interface Prepared {
  datasetId: string;
  idx: DataIndex;
  /** All positives sorted by (t, id). */
  events: Event[];
  mode: ModeName;
  /** Reference mode only: every follow, membership and positive of the dataset. */
  ref: RefData | null;
}

export function prepare(datasetId: string, data: DatasetTables, mode: ModeName): Prepared {
  const idx = buildDataIndex(datasetId, data);
  let ref: RefData | null = null;
  if (mode === "reference") {
    const follows: Follow[] = data.follows.map((f) => ({ followerId: uid(f.followerId), followeeId: uid(f.followeeId), t: f.createdAt }));
    const memberships: Membership[] = data.memberships.map((m) => ({ userId: uid(m.userId), communityId: m.communityId, t: m.joinedAt }));
    const positives = referencePositives(data);
    ref = { data: { follows, memberships, positives, postInfo: idx.postInfo }, positives };
  }
  return { datasetId, idx, events: positiveEvents(data), mode, ref };
}

/** T by the rule of blueprint section 3.1, with the q of super-plan section 7. */
export function computeCutTime(events: readonly Event[]): number {
  return cutTime(events, String(loadFrozen().cutQuantile));
}

function resolveT(prep: Prepared, opts: DatasetRunOptions): number {
  if (opts.holdT !== undefined) return opts.holdT;
  if (opts.expectedT === undefined) {
    throw new Error(`no recorded T for dataset ${prep.datasetId}: pass expectedT (cutTimes of frozen-v1.json), or record it with --record-t first`);
  }
  const T = computeCutTime(prep.events);
  if (T !== opts.expectedT) {
    throw new Error(
      `T of dataset ${prep.datasetId} is ${T}, but cutTimes says ${opts.expectedT}: the dataset or the rule changed. Check the dataset, then super-plan section 7`,
    );
  }
  return T;
}

/** The state of one user at one asOf: history, bucket and the pool. No item is needed (the `rank` command uses this). */
export interface PreparedAt {
  user: number;
  userId: UserId;
  asOf: AsOf;
  nHistory: number;
  bucket: string;
  /** Posts of the user's positives before asOf. */
  earlier: Set<PostId>;
  pool: Post[];
}

export interface PreparedItem extends PreparedAt {
  ev: Event;
  inPool: boolean;
}

/** History, bucket and pool of a user at asOf (design "Approach": everything goes through the AsOf rule and buildPool). */
export function prepareAt(prep: Prepared, user: number, asOf: AsOf, setting: PoolSetting): PreparedAt {
  const idx = prep.idx;
  const userId = uid(user);
  const earlier = new Set<PostId>();
  const nHistory = userEventCount(idx, user, asOf);
  for (let i = 0; i < nHistory; i++) earlier.add(idx.uPost[(idx.uStart[user] as number) + i] as number);
  const candidates = prep.mode === "fast" ? windowCandidates(idx, asOf.t, setting.windowSec) : idx.posts;
  const pool = buildPool({ user: userId, asOf, candidates, blocked: NO_BLOCKED, earlierPositives: earlier }, setting);
  return { user, userId, asOf, nHistory, bucket: bucketOf(nHistory), earlier, pool };
}

/** `prepareAt` at the item's time, plus the checks on the item (design F8). */
export function prepareItem(prep: Prepared, ev: Event, setting: PoolSetting): PreparedItem {
  const at = prepareAt(prep, ev.user, { t: ev.t, beforeEventId: ev.id }, setting);
  const info = prep.idx.postInfo.get(ev.post);
  if (info === undefined) throw new Error(`item of user ${ev.user} is on post ${ev.post}, which is not in posts.csv`);
  if (info.authorId === at.userId) throw new Error(`item of user ${ev.user} is on their own post ${ev.post}`);
  if (at.earlier.has(ev.post)) throw new Error(`item of user ${ev.user} is on post ${ev.post}, which the user touched before`);
  return { ...at, ev, inPool: at.pool.some((p) => p.id === ev.post) };
}

export interface ScoredItem {
  nFollowees: number;
  /** Variant label to the whole ranked pool, best first. */
  ranked: Map<string, PostId[]>;
}

/** Scores the pool of one item with each variant and ranks it with `rankPool` of the package. */
export function scoreItem(prep: Prepared, pi: PreparedAt, variants: readonly Variant[]): ScoredItem {
  const idx = prep.idx;
  let uf: UserFeatures;
  const feats = new Map<PostId, PostFeatures>();
  if (prep.mode === "fast") {
    uf = userFeaturesAsOf(pi.userId, pi.asOf, userFeatureData(idx, pi.user));
    const engaged = followeeEngagement(idx, uf.followees, pi.asOf);
    for (const post of pi.pool) feats.set(post.id, fastPostFeatures(post, pi.asOf, engaged, idx));
  } else {
    const ref = prep.ref as RefData;
    uf = userFeaturesAsOf(pi.userId, pi.asOf, ref.data);
    for (const post of pi.pool) feats.set(post.id, referencePostFeatures(post, pi.asOf, ref.positives));
  }
  const ranked = new Map<string, PostId[]>();
  for (const v of variants) {
    const score = scorer(v.method);
    const ctx = { user: pi.userId, asOf: pi.asOf, uf, params: v.params };
    ranked.set(v.label, rankPool(pi.pool, (post) => score(ctx, post, feats.get(post.id) as PostFeatures)));
  }
  return { nFollowees: uf.followees.length, ranked };
}

/** One dataset, one split: items, pools, ranks, and the per-user, summary, coverage and left-out rows. */
export function runDataset(datasetId: string, data: DatasetTables, rp: RunParams, opts: DatasetRunOptions = {}): DatasetRun {
  const frozen = loadFrozen();
  const prep = prepare(datasetId, data, rp.mode);
  const T = resolveT(prep, opts);
  const items = splitItems(prep.events, T, rp.split);
  const users = [...items.keys()].filter((u) => opts.onlyUsers === undefined || opts.onlyUsers.has(u)).sort((a, b) => a - b);
  const setting = poolSetting(rp.pool);
  const ks = frozen.k;
  const maxK = Math.max(...ks);
  const cov = new CoverageTracker(ks);
  const counts = new Map<string, { n: number; left: number }>(GROUPS.map((g) => [g, { n: 0, left: 0 }]));
  const perUser: PerUserRow[] = [];
  const rankRows = new Map<string, RankRow[]>(rp.variants.map((v) => [v.label, []]));

  for (const user of users) {
    const ev = items.get(user) as Event;
    const pi = prepareItem(prep, ev, setting);
    for (const g of groupsOf(pi.bucket)) (counts.get(g) as { n: number }).n++;
    if (!pi.inPool) {
      for (const g of groupsOf(pi.bucket)) (counts.get(g) as { left: number }).left++;
      continue;
    }
    if (opts.countOnly) continue;
    const scored = scoreItem(prep, pi, rp.variants);
    cov.addPool(pi.pool.map((p) => p.id));
    for (const v of rp.variants) {
      const order = scored.ranked.get(v.label) as PostId[];
      const rank = order.indexOf(ev.post) + 1;
      perUser.push({
        dataset: datasetId,
        split: rp.split,
        method: v.label,
        userId: user,
        bucket: pi.bucket,
        nHistory: pi.nHistory,
        nFollowees: scored.nFollowees,
        testPostId: ev.post,
        rank,
      });
      (rankRows.get(v.label) as RankRow[]).push({ userId: user, bucket: pi.bucket, rank });
      cov.addTop(v.label, order.slice(0, maxK));
    }
  }

  const labels = rp.variants.map((v) => v.label);
  const summary = labels.flatMap((l) => summarize(datasetId, rp.split, l, rankRows.get(l) as RankRow[], ks));
  const leftOut: LeftOutRow[] = GROUPS.map((g) => {
    const c = counts.get(g) as { n: number; left: number };
    return { dataset: datasetId, split: rp.split, bucket: g, nTestUsers: c.n, nLeftOut: c.left };
  });
  return { dataset: datasetId, split: rp.split, T, perUser, summary, coverage: cov.rows(datasetId, rp.split, labels), leftOut };
}

/** Items and left-out users per bucket, with no ranking (DW6). */
export function countItems(datasetId: string, data: DatasetTables, split: SplitName, pool: PoolName, opts: DatasetRunOptions = {}): { T: number; leftOut: LeftOutRow[] } {
  const run = runDataset(datasetId, data, { split, variants: [], pool, mode: "fast" }, { ...opts, countOnly: true });
  return { T: run.T, leftOut: run.leftOut };
}

export interface RunConfigOptions {
  /** The folder with one subfolder per dataset id (default: eval/data). */
  dataDir?: string;
  /** Dataset id to its recorded T (default: cutTimes of frozen-v1.json). */
  cutTimes?: Record<string, number>;
  /** The variants to run for each dataset, from the tuning. A config with a "grid" param needs them. */
  variants?: Record<string, Variant[]>;
}

export function defaultDataDir(): string {
  return new URL("../../data", import.meta.url).pathname;
}

/**
 * Runs a config: the guards first (split, methods, params, a recorded T for every dataset), then each dataset in turn.
 * A config with a "grid" param needs `o.variants`, the variants chosen by the tuning (`tuneConfig`).
 */
export function runConfig(cfg: RunConfig, o: RunConfigOptions = {}): RunResult {
  validateConfig(cfg);
  const common = o.variants === undefined ? fixedVariants(cfg) : undefined;
  const cutTimes = o.cutTimes ?? loadFrozen().cutTimes;
  for (const id of cfg.datasets) {
    if (cutTimes[id] === undefined) {
      throw new Error(`dataset ${id} has no T in cutTimes: record it with --record-t, write it in super-plan section 7 and frozen-v1.json, then run`);
    }
  }
  const dataDir = o.dataDir ?? defaultDataDir();
  const datasets: DatasetRun[] = [];
  const inputs: Record<string, string> = {};
  for (const id of cfg.datasets) {
    const dir = join(dataDir, id);
    inputs[id] = sha256Hex(readFileSync(join(dir, "manifest.json")));
    const data = loadDataset(dir);
    const variants = o.variants === undefined ? (common as Variant[]) : o.variants[id];
    if (variants === undefined) throw new Error(`no variants were given for dataset ${id}`);
    datasets.push(runDataset(id, data, { split: cfg.split, variants, pool: cfg.pool, mode: cfg.mode }, { expectedT: cutTimes[id] as number }));
  }
  return { datasets, inputs };
}

/** The whole pool of a user at asOf in rank order, for one variant. Same code path as the harness (the `rank` command). */
export function rankAt(prep: Prepared, user: number, asOf: AsOf, variant: Variant, pool: PoolName): PostId[] {
  const at = prepareAt(prep, user, asOf, poolSetting(pool));
  return scoreItem(prep, at, [variant]).ranked.get(variant.label) as PostId[];
}
