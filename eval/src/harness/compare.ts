import type { FileEntry } from "../canonical/csv.ts";
import { BUCKETS_0_4, BUCKET_LABELS, bucketOf } from "../checks/buckets.ts";
import { loadFrozen } from "../frozen.ts";
import { GROUPS, f6, groupsOf, methodIndex, ndcgAt } from "../metrics.ts";
import { writeCsv } from "../results-csv.ts";
import { COMPARE_HEADER, applyHolm, compareRow, h0Gate, h1Verdict, pairedBootstrap, pairedDifferences, writeCompare } from "../stats.ts";
import type { CompareRow, CompareSpec, StatOpts } from "../stats.ts";
import { F2_BASELINES } from "./config.ts";
import type { RunConfig } from "./config.ts";
import type { DatasetRun, RunResult } from "./run.ts";

// compare.csv, density.csv and the verdict lines (design "Statistics" and "Density"). The per-user NDCG@K of each method comes
// from the perUser ranks of a run. The tested functions of stats.ts do the statistics; this file only says which rows exist.

/** K of the density rows: the H1 metric (NDCG@10). density.csv has no k column. */
export const DENSITY_K = 10;

/** F1 groups: every group but "all" (blueprint 3.3). F2 groups: 0-4, 5-19, 20+ and all. */
const F1_GROUPS: readonly string[] = GROUPS.filter((g) => g !== "all");
const F2_GROUPS: readonly string[] = GROUPS.slice(BUCKETS_0_4.length);

interface RankInfo {
  bucket: string;
  rank: number;
}

/** Method to user to the rank of the user's item, from the perUser rows of one dataset. */
function ranksByMethod(run: DatasetRun): Map<string, Map<number, RankInfo>> {
  const out = new Map<string, Map<number, RankInfo>>();
  for (const r of run.perUser) {
    let m = out.get(r.method);
    if (m === undefined) {
      m = new Map();
      out.set(r.method, m);
    }
    m.set(r.userId, { bucket: r.bucket, rank: r.rank });
  }
  return out;
}

/** The NDCG@K of the users of one group. */
function ndcgOfGroup(ranks: ReadonlyMap<number, RankInfo>, k: number, group: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const [user, info] of ranks) if (groupsOf(info.bucket).includes(group)) out.set(user, ndcgAt(info.rank, k));
  return out;
}

function describe(spec: CompareSpec): string {
  return `${spec.dataset} ${spec.family} ${spec.method} - ${spec.ref}, K ${spec.k}, group ${spec.bucket}`;
}

function emptyRow(spec: CompareSpec): CompareRow {
  return { ...spec, n: 0, meanDiff: Number.NaN, ciLow: Number.NaN, ciHigh: Number.NaN, pRaw: null, pHolm: null };
}

/**
 * The ranks of one method. A run with no per-user row at all (no kept user) gives an empty map for every method. A method with
 * no row while others have rows is an error: it was not in the run.
 */
function needMethod(by: ReadonlyMap<string, Map<number, RankInfo>>, dataset: string, method: string): Map<number, RankInfo> {
  const m = by.get(method);
  if (m !== undefined) return m;
  if (by.size === 0) return new Map();
  throw new Error(`${dataset}: no per-user row for ${method}, so it cannot be compared`);
}

/**
 * The rows of compare.csv for a run. `families`: F1 and F2 of blueprint 3.3 (15 and 84 rows per dataset), and a row with no
 * user stops the run. `none`: every method but `ref`, for each K and group, with the bootstrap interval only; a row with no
 * user has n 0 and NaN numbers (the writer prints them empty). Holm is applied within each (dataset, family).
 */
export function compareRows(result: RunResult, cfg: RunConfig, o: StatOpts): CompareRow[] {
  if (cfg.compare === undefined) throw new Error('the run config has no "compare": nothing to compare');
  const { mode, ref } = cfg.compare;
  const ks = loadFrozen().k;
  const rows: CompareRow[] = [];
  for (const run of result.datasets) {
    const by = ranksByMethod(run);
    const one = (spec: CompareSpec): CompareRow => {
      const method = needMethod(by, spec.dataset, spec.method);
      const base = needMethod(by, spec.dataset, spec.ref);
      const d = pairedDifferences(ndcgOfGroup(method, spec.k, spec.bucket), ndcgOfGroup(base, spec.k, spec.bucket));
      if (d.length === 0) {
        if (spec.family !== "none") throw new Error(`a row of family ${spec.family} has no user: ${describe(spec)}`);
        return emptyRow(spec);
      }
      return compareRow(spec, d, o);
    };
    if (mode === "families") {
      for (const k of ks) for (const bucket of F1_GROUPS) rows.push(one({ dataset: run.dataset, family: "F1", method: "H", ref: "BL2", k, bucket }));
      for (const base of F2_BASELINES) {
        for (const k of ks) for (const bucket of F2_GROUPS) rows.push(one({ dataset: run.dataset, family: "F2", method: "H", ref: base, k, bucket }));
      }
    } else {
      const methods = cfg.methods.filter((m) => m !== ref).sort((a, b) => methodIndex(a) - methodIndex(b));
      for (const method of methods) {
        for (const k of ks) for (const bucket of GROUPS) rows.push(one({ dataset: run.dataset, family: "none", method, ref, k, bucket }));
      }
    }
  }
  return applyHolm(rows);
}

/**
 * Writes <dir>/compare.csv. The bytes are those of `writeCompare` of stats.ts, except that a row with no user (n 0, NaN numbers)
 * has empty number cells: `writeCompare` would print NaN there.
 */
export function writeCompareRows(dir: string, rows: readonly CompareRow[]): FileEntry {
  if (rows.every((r) => r.n > 0)) return writeCompare(dir, rows);
  const sorted = [...rows].sort(
    (a, b) =>
      compareStrings(a.dataset, b.dataset) ||
      compareStrings(a.family, b.family) ||
      methodIndex(a.method) - methodIndex(b.method) ||
      methodIndex(a.ref) - methodIndex(b.ref) ||
      a.k - b.k ||
      GROUPS.indexOf(a.bucket) - GROUPS.indexOf(b.bucket),
  );
  const num = (r: CompareRow, x: number): string => (r.n === 0 ? "" : f6(x));
  const cells = sorted.map((r) => [
    r.dataset,
    r.family,
    r.method,
    r.ref,
    String(r.k),
    r.bucket,
    String(r.n),
    num(r, r.meanDiff),
    num(r, r.ciLow),
    num(r, r.ciHigh),
    r.pRaw === null ? "" : f6(r.pRaw),
    r.pHolm === null ? "" : f6(r.pHolm),
  ]);
  return writeCsv(dir, "compare.csv", COMPARE_HEADER, cells);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface DensityRow {
  dataset: string;
  /** The bin of the user's number of followees: bucketOf, so the history bucket labels. */
  bin: string;
  method: string;
  ref: string;
  n: number;
  /** NaN when the bin has no user. */
  meanDiff: number;
  ciLow: number;
  ciHigh: number;
}

export const DENSITY_HEADER = ["dataset", "density_bin", "method", "ref", "n", "mean_diff", "ci_low", "ci_high"] as const;

/**
 * E3: H - ref on NDCG@10 per kept user, in bins of the user's number of followees (n_followees at the item time) by `bucketOf`.
 * One row per bin, in the order of the history buckets. A bin with no user has n 0 and NaN numbers. No family.
 */
export function densityRows(run: DatasetRun, ref: string, o: StatOpts): DensityRow[] {
  const by = ranksByMethod(run);
  const h = needMethod(by, run.dataset, "H");
  const base = needMethod(by, run.dataset, ref);
  const followees = new Map<number, number>();
  for (const r of run.perUser) if (r.method === "H") followees.set(r.userId, r.nFollowees);
  return BUCKET_LABELS.map((bin) => {
    const inBin = (user: number): boolean => bucketOf(followees.get(user) as number) === bin;
    const a = new Map<number, number>();
    const b = new Map<number, number>();
    for (const [user, info] of h) if (inBin(user)) a.set(user, ndcgAt(info.rank, DENSITY_K));
    for (const [user, info] of base) if (inBin(user)) b.set(user, ndcgAt(info.rank, DENSITY_K));
    const d = pairedDifferences(a, b);
    if (d.length === 0) return { dataset: run.dataset, bin, method: "H", ref, n: 0, meanDiff: Number.NaN, ciLow: Number.NaN, ciHigh: Number.NaN };
    const r = pairedBootstrap(d, o);
    return { dataset: run.dataset, bin, method: "H", ref, n: d.length, meanDiff: r.meanDiff, ciLow: r.ciLow, ciHigh: r.ciHigh };
  });
}

/** Writes <dir>/density.csv (blueprint 2.7): 6 decimals, rows sorted by dataset and then by bin order. */
export function writeDensity(dir: string, rows: readonly DensityRow[]): FileEntry {
  const sorted = [...rows].sort((a, b) => compareStrings(a.dataset, b.dataset) || BUCKET_LABELS.indexOf(a.bin) - BUCKET_LABELS.indexOf(b.bin));
  const num = (r: DensityRow, x: number): string => (r.n === 0 ? "" : f6(x));
  return writeCsv(
    dir,
    "density.csv",
    DENSITY_HEADER,
    sorted.map((r) => [r.dataset, r.bin, r.method, r.ref, String(r.n), num(r, r.meanDiff), num(r, r.ciLow), num(r, r.ciHigh)]),
  );
}

/**
 * The lines the harness prints after a run with a verdict. In mode `families`: one `H1 <dataset>: pass|fail` line per dataset
 * (blueprint 3.4, `h1Verdict`). With `h0Gate`: the `H0 gate: pass|fail` line (blueprint 3.5, `h0Gate`). `gateFailed` is true when
 * the gate fails.
 */
export function verdictLines(rows: readonly CompareRow[], cfg: RunConfig): { lines: string[]; gateFailed: boolean } {
  const lines: string[] = [];
  if (cfg.compare?.mode === "families") {
    for (const dataset of cfg.datasets) {
      const v = h1Verdict(rows.filter((r) => r.dataset === dataset));
      lines.push(`H1 ${dataset}: ${v.pass ? "pass" : "fail"}  p_holm ${f6(v.row.pHolm as number)}  ci_low ${f6(v.row.ciLow)}`);
    }
  }
  let gateFailed = false;
  if (cfg.h0Gate === true) {
    const g = h0Gate(rows);
    if (g.row.n === 0) throw new Error("the H0 gate row (syn-W0-M, H - BL2, K 10, all) has no user, so the gate cannot be checked");
    lines.push(`H0 gate: ${g.pass ? "pass" : "fail"}  ci_low ${f6(g.row.ciLow)}`);
    gateFailed = !g.pass;
  }
  return { lines, gateFailed };
}
