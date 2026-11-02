import { BUCKETS_0_4, BUCKET_LABELS } from "./checks/buckets.ts";

// Metrics of super-plan section 5 with one test item per user, at 1-based rank r in the full pool.
// Recall@K equals HitRate@K. NDCG@K is 1 / log2(r + 1) for r <= K, else 0. Coverage@K counts distinct posts.

/** Metrics print with 6 decimals (super-plan section 2). A negative zero prints as 0.000000. */
export function f6(x: number): string {
  const s = x.toFixed(6);
  return s === "-0.000000" ? "0.000000" : s;
}

function checkRank(r: number): void {
  if (!Number.isInteger(r) || r < 1) throw new Error(`rank must be an integer >= 1, got ${r}`);
}

/** Recall@K = HitRate@K = [r <= K]. */
export function recallAt(rank: number, k: number): number {
  checkRank(rank);
  return rank <= k ? 1 : 0;
}

/** NDCG@K with one relevant item: 1 / log2(r + 1) for r <= K, else 0. */
export function ndcgAt(rank: number, k: number): number {
  checkRank(rank);
  return rank <= k ? 1 / Math.log2(rank + 1) : 0;
}

/** The 13 method ids in the order of `MethodId` in @breadit/ranking. Rows of every results file sort by this order. */
export const METHOD_ORDER: readonly string[] = [
  "BL0",
  "BL1",
  "BL2",
  "BL2t",
  "BL3",
  "BL4",
  "BL5",
  "BL6",
  "H",
  "H-follow",
  "H-comm",
  "H-noauthor",
  "H-noengager",
];

export function methodIndex(method: string): number {
  const i = METHOD_ORDER.indexOf(method);
  if (i < 0) throw new Error(`unknown method "${method}"`);
  return i;
}

/** The summary groups: each bucket, "0-4" right after the buckets it holds, and "all" last. */
export const GROUPS: readonly string[] = [
  ...BUCKET_LABELS.slice(0, BUCKETS_0_4.length),
  "0-4",
  ...BUCKET_LABELS.slice(BUCKETS_0_4.length),
  "all",
];

export interface RankRow {
  userId: number;
  bucket: string;
  /** 1-based rank of the user's item in the full pool. */
  rank: number;
}

export interface SummaryRow {
  dataset: string;
  split: string;
  method: string;
  k: number;
  bucket: string;
  nUsers: number;
  /** Empty when the group has no users. */
  recall: string;
  ndcg: string;
}

function membersOf(group: string, bucket: string): boolean {
  if (group === "all") return true;
  if (group === "0-4") return BUCKETS_0_4.includes(bucket);
  return group === bucket;
}

/** The summary groups a history bucket belongs to: itself, "0-4" when it is one of the two lowest, and "all". */
export function groupsOf(bucket: string): string[] {
  return GROUPS.filter((g) => membersOf(g, bucket));
}

/**
 * Summary rows of one method: for each K and group, the number of users and the mean Recall@K and NDCG@K.
 * Means sum in user_id order, whatever the input order (super-plan section 2).
 */
export function summarize(
  dataset: string,
  split: string,
  method: string,
  rows: readonly RankRow[],
  ks: readonly number[],
): SummaryRow[] {
  for (const r of rows) {
    if (!BUCKET_LABELS.includes(r.bucket)) throw new Error(`unknown bucket "${r.bucket}" for user ${r.userId}`);
  }
  const sorted = [...rows].sort((a, b) => a.userId - b.userId);
  const out: SummaryRow[] = [];
  for (const k of ks) {
    for (const group of GROUPS) {
      let n = 0;
      let recall = 0;
      let ndcg = 0;
      for (const r of sorted) {
        if (!membersOf(group, r.bucket)) continue;
        n++;
        recall += recallAt(r.rank, k);
        ndcg += ndcgAt(r.rank, k);
      }
      out.push({
        dataset,
        split,
        method,
        k,
        bucket: group,
        nUsers: n,
        recall: n === 0 ? "" : f6(recall / n),
        ndcg: n === 0 ? "" : f6(ndcg / n),
      });
    }
  }
  return out;
}

export interface CoverageRow {
  dataset: string;
  split: string;
  method: string;
  k: number;
  /** Empty when no pool was added. */
  coverage: string;
}

/**
 * Coverage@K of super-plan section 5: the number of distinct posts in any top-K list of the run, divided by
 * the number of distinct posts in any pool of the run, for each method and K. Only kept users add to it.
 */
export class CoverageTracker {
  private readonly pool = new Set<number>();
  private readonly top = new Map<string, Map<number, Set<number>>>();
  private readonly ks: readonly number[];

  // No constructor parameter property: Node strips types only, it does not compile them.
  constructor(ks: readonly number[]) {
    this.ks = ks;
  }

  addPool(postIds: readonly number[]): void {
    for (const id of postIds) this.pool.add(id);
  }

  /** `ranked` is the user's ranked list, best first. It must hold at least min(K, pool size) posts for each K. */
  addTop(method: string, ranked: readonly number[]): void {
    let byK = this.top.get(method);
    if (byK === undefined) {
      byK = new Map(this.ks.map((k) => [k, new Set<number>()]));
      this.top.set(method, byK);
    }
    for (const k of this.ks) {
      const set = byK.get(k) as Set<number>;
      const end = Math.min(k, ranked.length);
      for (let i = 0; i < end; i++) set.add(ranked[i] as number);
    }
  }

  /** Rows in the order of `methods`, then of the Ks given to the constructor. */
  rows(dataset: string, split: string, methods: readonly string[]): CoverageRow[] {
    const out: CoverageRow[] = [];
    for (const method of methods) {
      for (const k of this.ks) {
        const seen = this.top.get(method)?.get(k)?.size ?? 0;
        out.push({ dataset, split, method, k, coverage: this.pool.size === 0 ? "" : f6(seen / this.pool.size) });
      }
    }
    return out;
  }
}
