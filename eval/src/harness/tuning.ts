import type { MethodId } from "@breadit/ranking";
import { join } from "node:path";
import { loadDataset } from "../canonical/dataset.ts";
import type { FileEntry } from "../canonical/csv.ts";
import { loadFrozen } from "../frozen.ts";
import { methodIndex } from "../metrics.ts";
import { csvText, writeCsvText } from "../results-csv.ts";
import { REQUIRED_PARAMS, resolveParam, validateConfig } from "./config.ts";
import type { ParamValue, RunConfig, Variant } from "./config.ts";
import { defaultDataDir, runDataset } from "./run.ts";
import type { DatasetRunOptions, RunConfigOptions } from "./run.ts";
import type { DatasetTables } from "./random-data.ts";

// Tuning (design "Tuning", super-plan section 5): every grid point is run on the validation split, the choice is by
// NDCG@10 over all kept users, and a tie goes to the smaller value. For several params the tuple is compared from the first
// element on, in the order of REQUIRED_PARAMS (alpha, then beta). The test split is never used here.

/** The K of the choice rule: NDCG@10. */
const TUNING_K = 10;

function ascending(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

/** The grid of a param, from frozen-v1.json (super-plan section 7). `m` has none: it is a frozen value. */
export function gridFor(method: string, param: string): number[] {
  const f = loadFrozen();
  if (method === "BL2t" && param === "ageWeight") return ascending(f.baselineGrids.BL2t);
  if (method === "BL4" && param === "divisor") return ascending(f.baselineGrids.BL4);
  if (method === "BL5" && param === "gravity") return ascending(f.baselineGrids.BL5);
  if ((param === "alpha" || param === "beta") && REQUIRED_PARAMS[method as MethodId]?.includes(param)) return ascending(f.alphaBetaGrid);
  throw new Error(`there is no grid for param "${param}" of ${method}`);
}

function lessThan(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if ((a[i] as number) !== (b[i] as number)) return (a[i] as number) < (b[i] as number);
  }
  return false;
}

/** Index of the best point: the largest NDCG@10, and among equal values the smaller tuple. It does not depend on the input order. */
export function pickBest(points: readonly { tuple: readonly number[]; ndcg: number }[]): number {
  if (points.length === 0) throw new Error("no grid point to choose from");
  let best = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i] as { tuple: readonly number[]; ndcg: number };
    const b = points[best] as { tuple: readonly number[]; ndcg: number };
    if (p.ndcg > b.ndcg || (p.ndcg === b.ndcg && lessThan(p.tuple, b.tuple))) best = i;
  }
  return best;
}

export interface TuningRow {
  dataset: string;
  method: string;
  /** The tuned params, joined with "/" when there are several (alpha/beta). */
  param: string;
  /** The values of the grid point, in the same order, joined with "/". */
  value: string;
  /** NDCG@10 over all kept validation users, 6 decimals. */
  valNdcg10: string;
  chosen: boolean;
}

export interface Tuned {
  rows: TuningRow[];
  /** The config's methods with their params: fixed ones as given, tuned ones at the chosen grid point. */
  variants: Variant[];
}

function product(grids: readonly (readonly number[])[]): number[][] {
  let out: number[][] = [[]];
  for (const g of grids) out = out.flatMap((prefix) => g.map((v) => [...prefix, v]));
  return out;
}

/** Tunes every "grid" param of the config on the validation items of one dataset. */
export function tuneDataset(datasetId: string, data: DatasetTables, cfg: RunConfig, opts: DatasetRunOptions = {}): Tuned {
  validateConfig(cfg);
  if (cfg.split !== "validation") throw new Error('tuning runs on the validation split only; the config has split "test"');
  if (!loadFrozen().k.includes(TUNING_K)) throw new Error(`K ${TUNING_K} is not in the frozen K`);

  interface Plan {
    method: string;
    names: string[];
    tuples: number[][];
    fixed: Record<string, number>;
    labels: string[];
  }
  const plans: Plan[] = [];
  const gridVariants: Variant[] = [];
  for (const method of cfg.methods) {
    const given = cfg.params[method] ?? {};
    const names = REQUIRED_PARAMS[method as MethodId].filter((p) => given[p] === "grid");
    const fixed: Record<string, number> = {};
    for (const p of REQUIRED_PARAMS[method as MethodId]) if (!names.includes(p)) fixed[p] = resolveParam(given[p] as ParamValue);
    const tuples = names.length === 0 ? [] : product(names.map((n) => gridFor(method, n)));
    const labels = tuples.map((_, i) => `${method}#${i}`);
    tuples.forEach((tuple, i) => {
      const params: Record<string, number> = { ...fixed };
      names.forEach((n, j) => {
        params[n] = tuple[j] as number;
      });
      gridVariants.push({ label: labels[i] as string, method: method as MethodId, params });
    });
    plans.push({ method, names, tuples, fixed, labels });
  }
  if (gridVariants.length === 0) throw new Error('nothing to tune: no param of the config is "grid"');

  // One pass over the items: the pool and the features are shared by every grid point.
  const run = runDataset(datasetId, data, { split: "validation", variants: gridVariants, pool: cfg.pool, mode: cfg.mode }, opts);
  const rows: TuningRow[] = [];
  const variants: Variant[] = [];
  for (const plan of plans) {
    if (plan.tuples.length === 0) {
      variants.push({ label: plan.method, method: plan.method as MethodId, params: plan.fixed });
      continue;
    }
    const scores = plan.labels.map((label, i) => {
      const s = run.summary.find((x) => x.method === label && x.k === TUNING_K && x.bucket === "all");
      if (s === undefined || s.nUsers === 0) throw new Error(`${datasetId}: no kept validation user, so ${plan.method} cannot be tuned`);
      return { tuple: plan.tuples[i] as number[], text: s.ndcg, ndcg: Number(s.ndcg) };
    });
    const best = pickBest(scores);
    plan.tuples.forEach((tuple, i) => {
      rows.push({
        dataset: datasetId,
        method: plan.method,
        param: plan.names.join("/"),
        value: tuple.join("/"),
        valNdcg10: (scores[i] as { text: string }).text,
        chosen: i === best,
      });
    });
    const params: Record<string, number> = { ...plan.fixed };
    plan.names.forEach((n, j) => {
      params[n] = (plan.tuples[best] as number[])[j] as number;
    });
    variants.push({ label: plan.method, method: plan.method as MethodId, params });
  }
  return { rows, variants };
}

export const TUNING_HEADER = ["dataset", "method", "param", "value", "val_ndcg10", "chosen"] as const;

/** The text of tuning.csv: rows sorted by dataset and method order; the grid order inside a method is kept. */
export function tuningText(rows: readonly TuningRow[]): string {
  const sorted = [...rows].sort((a, b) => (a.dataset < b.dataset ? -1 : a.dataset > b.dataset ? 1 : 0) || methodIndex(a.method) - methodIndex(b.method));
  return csvText(
    TUNING_HEADER,
    sorted.map((r) => [r.dataset, r.method, r.param, r.value, r.valNdcg10, r.chosen ? "1" : "0"]),
  );
}

export function writeTuning(dir: string, rows: readonly TuningRow[]): FileEntry {
  return writeCsvText(dir, "tuning.csv", tuningText(rows));
}

/** Tunes a config on each of its datasets (each on its own validation items). Task 9 runs it on real data. */
export function tuneConfig(cfg: RunConfig, o: RunConfigOptions = {}): { rows: TuningRow[]; variants: Record<string, Variant[]> } {
  validateConfig(cfg);
  const cutTimes = o.cutTimes ?? loadFrozen().cutTimes;
  for (const id of cfg.datasets) {
    if (cutTimes[id] === undefined) throw new Error(`dataset ${id} has no T in cutTimes: record it with --record-t first`);
  }
  const dataDir = o.dataDir ?? defaultDataDir();
  const rows: TuningRow[] = [];
  const variants: Record<string, Variant[]> = {};
  for (const id of cfg.datasets) {
    const t = tuneDataset(id, loadDataset(join(dataDir, id)), cfg, { expectedT: cutTimes[id] as number });
    rows.push(...t.rows);
    variants[id] = t.variants;
  }
  return { rows, variants };
}
