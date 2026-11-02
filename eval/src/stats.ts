import { writeCsv } from "./results-csv.ts";
import type { FileEntry } from "./canonical/csv.ts";
import { loadFrozen } from "./frozen.ts";
import { GROUPS, f6, methodIndex } from "./metrics.ts";
import { rng } from "./rng.ts";

// Statistics of super-plan section 5 and blueprint section 3. The unit is the user: for a comparison, d_i is the NDCG@K of
// the method minus the NDCG@K of the reference for user i, in user_id order. Streams restart for every comparison, so a
// comparison's numbers do not depend on which others were computed before it.

export interface StatOpts {
  masterSeed: number;
  /** Bootstrap resamples B. */
  resamples: number;
  /** Sign-flip permutations P. */
  permutations: number;
  /** Confidence level of the bootstrap interval. */
  level: number;
  /** Holm level. */
  holmLevel: number;
}

/** The values of super-plan section 7. */
export function statOpts(): StatOpts {
  const f = loadFrozen();
  return {
    masterSeed: f.masterSeed,
    resamples: f.bootstrapResamples,
    permutations: f.permutations,
    level: f.confidenceLevel,
    holmLevel: f.holmLevel,
  };
}

function compareNumbers(a: number, b: number): number {
  return a - b;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sum(d: readonly number[]): number {
  let s = 0;
  for (const x of d) s += x;
  return s;
}

/** Differences method minus ref in user_id order. Both maps must hold the same users. */
export function pairedDifferences(method: ReadonlyMap<number, number>, ref: ReadonlyMap<number, number>): number[] {
  if (method.size !== ref.size) throw new Error(`the two methods have different users (${method.size} and ${ref.size})`);
  const out: number[] = [];
  for (const u of [...method.keys()].sort(compareNumbers)) {
    const r = ref.get(u);
    if (r === undefined) throw new Error(`user ${u} is in one method and not in the other (users differ)`);
    out.push((method.get(u) as number) - r);
  }
  return out;
}

/** numpy's default ("linear") percentile of a sorted array, q in [0, 1]. */
function quantileSorted(sorted: Float64Array, q: number): number {
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, sorted.length - 1);
  const frac = pos - lo;
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * frac;
}

export interface BootstrapResult {
  meanDiff: number;
  ciLow: number;
  ciHigh: number;
}

/**
 * Paired bootstrap: B resamples of n indices each, from the stream rng(masterSeed, "bootstrap"). The interval is the
 * (1 - level) / 2 and (1 + level) / 2 percentiles of the B resample means, with linear interpolation.
 */
export function pairedBootstrap(d: readonly number[], o: Pick<StatOpts, "masterSeed" | "resamples" | "level">): BootstrapResult {
  const n = d.length;
  if (n === 0) throw new Error("bootstrap needs at least one paired value");
  const gen = rng(o.masterSeed, "bootstrap");
  const means = new Float64Array(o.resamples);
  for (let b = 0; b < o.resamples; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += d[gen.int(n)] as number;
    means[b] = s / n;
  }
  means.sort((a, b) => a - b);
  return {
    meanDiff: sum(d) / n,
    ciLow: quantileSorted(means, (1 - o.level) / 2),
    ciHigh: quantileSorted(means, (1 + o.level) / 2),
  };
}

/**
 * Paired randomization test: P random sign flips of the differences, from the stream rng(masterSeed, "permutation").
 * Two-sided p = (1 + #{|mean*| >= |mean_obs|}) / (P + 1). It compares sums, which is the same as comparing means.
 */
export function randomizationTest(d: readonly number[], o: Pick<StatOpts, "masterSeed" | "permutations">): number {
  const n = d.length;
  if (n === 0) throw new Error("randomization test needs at least one paired value");
  const gen = rng(o.masterSeed, "permutation");
  const observed = Math.abs(sum(d));
  let count = 0;
  for (let p = 0; p < o.permutations; p++) {
    let s = 0;
    let word = 0;
    for (let i = 0; i < n; i++) {
      if (i % 32 === 0) word = gen.next();
      s += ((word >>> i % 32) & 1) === 1 ? -(d[i] as number) : (d[i] as number);
    }
    if (Math.abs(s) >= observed) count++;
  }
  return (1 + count) / (o.permutations + 1);
}

/** The largest n for the exact test: 2^24 sign patterns. */
const EXACT_MAX_N = 24;

/** Exact two-sided p over all 2^n sign patterns: #{|sum*| >= |sum_obs|} / 2^n. For small n and for the scipy check. */
export function exactRandomizationTest(d: readonly number[]): number {
  const n = d.length;
  if (n === 0) throw new Error("exact test needs at least one paired value");
  if (n > EXACT_MAX_N) throw new Error(`too many pairs for the exact test (${n} > ${EXACT_MAX_N})`);
  const observed = Math.abs(sum(d));
  const total = 2 ** n;
  let count = 0;
  for (let mask = 0; mask < total; mask++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += ((mask >>> i) & 1) === 1 ? -(d[i] as number) : (d[i] as number);
    if (Math.abs(s) >= observed) count++;
  }
  return count / total;
}

/**
 * Holm adjustment of one family (Holm 1979): sort by p (ties by key), then p_holm_i = max over j <= i of
 * min(1, (m - j + 1) p_j). The result is in the order of the input.
 */
export function holm(items: readonly { key: string; p: number }[]): number[] {
  const m = items.length;
  const order = items.map((_, i) => i).sort((a, b) => {
    const x = items[a] as { key: string; p: number };
    const y = items[b] as { key: string; p: number };
    return x.p - y.p || compareStrings(x.key, y.key);
  });
  const out = new Array<number>(m).fill(0);
  let running = 0;
  order.forEach((idx, j) => {
    const adj = Math.min(1, (m - j) * (items[idx] as { p: number }).p);
    running = Math.max(running, adj);
    out[idx] = running;
  });
  return out;
}

/** What a comparison is about. `family` is "F1", "F2" or "none" (blueprint section 3.3). */
export interface CompareSpec {
  dataset: string;
  family: string;
  method: string;
  ref: string;
  k: number;
  bucket: string;
}

export interface CompareRow extends CompareSpec {
  n: number;
  meanDiff: number;
  ciLow: number;
  ciHigh: number;
  /** Null for a comparison with no family: bootstrap interval only. */
  pRaw: number | null;
  pHolm: number | null;
}

/** One comparison row. Both streams restart here. A family "none" gets no p-value. */
export function compareRow(spec: CompareSpec, d: readonly number[], o: StatOpts): CompareRow {
  const b = pairedBootstrap(d, o);
  return {
    ...spec,
    n: d.length,
    meanDiff: b.meanDiff,
    ciLow: b.ciLow,
    ciHigh: b.ciHigh,
    pRaw: spec.family === "none" ? null : randomizationTest(d, o),
    pHolm: null,
  };
}

function holmKey(r: CompareRow): string {
  return [r.method, r.ref, String(r.k).padStart(4, "0"), String(GROUPS.indexOf(r.bucket)).padStart(2, "0")].join("|");
}

/** Sets p_holm on every row that has a p_raw, within its (dataset, family). Returns new rows in the same order. */
export function applyHolm(rows: readonly CompareRow[]): CompareRow[] {
  const groups = new Map<string, number[]>();
  rows.forEach((r, i) => {
    if (r.pRaw === null) return;
    const key = `${r.dataset}\u0000${r.family}`;
    const l = groups.get(key);
    if (l) l.push(i);
    else groups.set(key, [i]);
  });
  const out = rows.map((r) => ({ ...r }));
  for (const idxs of groups.values()) {
    const adj = holm(idxs.map((i) => ({ key: holmKey(rows[i] as CompareRow), p: (rows[i] as CompareRow).pRaw as number })));
    idxs.forEach((i, j) => {
      (out[i] as CompareRow).pHolm = adj[j] as number;
    });
  }
  return out;
}

function findOne(rows: readonly CompareRow[], what: string, pred: (r: CompareRow) => boolean): CompareRow {
  const hits = rows.filter(pred);
  if (hits.length === 0) throw new Error(`no row for ${what}`);
  if (hits.length > 1) throw new Error(`more than one row for ${what}`);
  return hits[0] as CompareRow;
}

/**
 * H1 (blueprint section 3.4): on the F1 row H - BL2, NDCG@10, group 0-4, the Holm-adjusted p is below the Holm level
 * and the lower end of the bootstrap interval is above 0. `rows` are the rows of one dataset.
 */
export function h1Verdict(rows: readonly CompareRow[]): { pass: boolean; row: CompareRow } {
  const row = findOne(rows, "H1 (F1, H - BL2, K 10, group 0-4)", (r) => r.family === "F1" && r.method === "H" && r.ref === "BL2" && r.k === 10 && r.bucket === "0-4");
  if (row.pHolm === null) throw new Error("the H1 row has no p_holm: run applyHolm first");
  return { pass: row.pHolm < statOpts().holmLevel && row.ciLow > 0, row };
}

/** H0 gate (blueprint section 3.5): on syn-W0-M the interval of H - BL2 (NDCG@10, all users) must not lie above 0. */
export function h0Gate(rows: readonly CompareRow[]): { pass: boolean; row: CompareRow } {
  const row = findOne(rows, "the H0 gate (syn-W0-M, H - BL2, K 10, all)", (r) => r.dataset === "syn-W0-M" && r.method === "H" && r.ref === "BL2" && r.k === 10 && r.bucket === "all");
  return { pass: row.ciLow <= 0, row };
}

export const COMPARE_HEADER = ["dataset", "family", "method", "ref", "k", "bucket", "n", "mean_diff", "ci_low", "ci_high", "p_raw", "p_holm"] as const;

function bucketIndex(bucket: string): number {
  const i = GROUPS.indexOf(bucket);
  if (i < 0) throw new Error(`unknown group "${bucket}"`);
  return i;
}

/** Writes <dir>/compare.csv (blueprint section 2.7). Rows are sorted by dataset, family, method, ref, K and group. */
export function writeCompare(dir: string, rows: readonly CompareRow[]): FileEntry {
  const sorted = [...rows].sort(
    (a, b) =>
      compareStrings(a.dataset, b.dataset) ||
      compareStrings(a.family, b.family) ||
      methodIndex(a.method) - methodIndex(b.method) ||
      methodIndex(a.ref) - methodIndex(b.ref) ||
      a.k - b.k ||
      bucketIndex(a.bucket) - bucketIndex(b.bucket),
  );
  const cells = sorted.map((r) => [
    r.dataset,
    r.family,
    r.method,
    r.ref,
    String(r.k),
    r.bucket,
    String(r.n),
    f6(r.meanDiff),
    f6(r.ciLow),
    f6(r.ciHigh),
    r.pRaw === null ? "" : f6(r.pRaw),
    r.pHolm === null ? "" : f6(r.pHolm),
  ]);
  return writeCsv(dir, "compare.csv", COMPARE_HEADER, cells);
}
