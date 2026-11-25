import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "../canonical/csv.ts";
import { canonicalJson } from "../canonical/manifest.ts";
import { loadFrozen } from "../frozen.ts";
import { GROUPS, f6, methodIndex } from "../metrics.ts";
import { csvText } from "../results-csv.ts";
import { pickBest } from "../harness/tuning.ts";

// Test helper: a results folder with the thirteen P7 runs (the twelve of the harness and the E7 benchmark), the Orientation group run and hand-made numbers, the shapes the harness writes (summary, coverage, leftout,
// compare, density, tuning, manifest). The numbers come from a hash of the row, so every run of a test gives the same files. Not used by
// production code.

const frozen = loadFrozen();
const KS = frozen.k;
const NINE = ["BL0", "BL1", "BL2", "BL2t", "BL3", "BL4", "BL5", "BL6", "H"];
const TERMS = ["BL2", "H", "H-follow", "H-comm", "H-noauthor", "H-noengager"];
const SWEEP_METHODS = ["BL2", "H"];
const MAIN = ["syn-W2M-M", "digg2009"];
const F1_GROUPS = GROUPS.filter((g) => g !== "all");
const F2_GROUPS = ["0-4", "5-19", "20+", "all"];
const F2_BASELINES = ["BL0", "BL1", "BL2t", "BL3", "BL4", "BL5", "BL6"];
const BINS = ["0", "1-4", "5-19", "20+"];

interface FixtureRun {
  id: string;
  split: "validation" | "test";
  /** The dataset names written in the rows. */
  datasets: string[];
  methods: string[];
  compare?: "families" | "none";
  density?: boolean;
  tuning?: string[];
  /** The E7 run: latency.csv, queries.csv and runs.csv instead of the summary files. */
  e7?: boolean;
  /** The Orientation group comparison: groups.csv instead of the summary files. */
  groups?: boolean;
}

export const FIXTURE_RUNS: readonly FixtureRun[] = [
  { id: "p7-tune-main", split: "validation", datasets: MAIN, methods: NINE, tuning: ["BL2t", "BL4", "BL5", "BL6", "H"] },
  { id: "p7-tune-worlds", split: "validation", datasets: ["syn-W0-M", "syn-W1-M", "syn-W2L-M", "syn-W2H-M"], methods: ["BL2", "H"], tuning: ["H"] },
  { id: "p7-h0", split: "test", datasets: ["syn-W0-M"], methods: ["BL2", "H", "H-follow"], compare: "none" },
  { id: "p7-main", split: "test", datasets: MAIN, methods: NINE, compare: "families", density: true },
  { id: "p7-e5-worlds", split: "test", datasets: ["syn-W0-M", "syn-W1-M", "syn-W2L-M", "syn-W2M-M", "syn-W2H-M"], methods: SWEEP_METHODS, compare: "none", density: true },
  { id: "p7-e4-terms", split: "test", datasets: MAIN, methods: TERMS, compare: "none" },
  { id: "p7-e4-m0", split: "test", datasets: MAIN, methods: SWEEP_METHODS, compare: "none" },
  { id: "p7-e4-m2", split: "test", datasets: MAIN, methods: SWEEP_METHODS, compare: "none" },
  { id: "p7-e4-m10", split: "test", datasets: MAIN, methods: SWEEP_METHODS, compare: "none" },
  { id: "p7-e6-ties", split: "test", datasets: MAIN, methods: NINE },
  { id: "p7-e8-pool", split: "test", datasets: ["syn-W2M-M"], methods: ["BL2", "BL4", "H"], compare: "none" },
  { id: "p7-e5-shuffle", split: "test", datasets: ["syn-W2M-M-shuffled"], methods: SWEEP_METHODS, compare: "none" },
  { id: "p7-e7", split: "test", datasets: [], methods: [], e7: true },
  { id: "p9-orient-groups", split: "test", datasets: MAIN, methods: ["BL2", "H"], groups: true },
];

/** A number from a hash of `seed`, in [lo, hi), with 6 decimals. */
function num(seed: string, lo: number, hi: number): string {
  const h = parseInt(sha256Hex(seed).slice(0, 8), 16) / 0x100000000;
  return f6(lo + (hi - lo) * h);
}

type Rec = Record<string, string>;
type Table = { header: string[]; rows: Rec[] };

function groupSize(dataset: string, group: string): number {
  const base: Record<string, number> = { "0": 59, "1-4": 115, "5-19": 210, "20+": 310 };
  const d = dataset.length * 3;
  if (group === "all") return 59 + 115 + 210 + 310 + 4 * d;
  if (group === "0-4") return 59 + 115 + 2 * d;
  return (base[group] as number) + d;
}

/** `cell` (a 6-decimal number, 0 or more) minus `micro` millionths, by whole millionths (no float). */
function minusMicro(cell: string, micro: number): string {
  const [whole, frac] = cell.split(".") as [string, string];
  const left = Number(whole) * 1_000_000 + Number(frac) - micro;
  if (left < 0) throw new Error(`fixture: ${cell} minus ${micro} millionths is below 0`);
  return `${Math.floor(left / 1_000_000)}.${String(left % 1_000_000).padStart(6, "0")}`;
}

function summary(run: FixtureRun): Table {
  const rows: Rec[] = [];
  for (const dataset of run.datasets) {
    for (const method of run.methods) {
      for (const k of KS) {
        for (const group of GROUPS) {
          // Task p9-missing-macros: the E6 rows at K 10, bucket all, equal the E1 rows (same seed), as in the real results where ties
          // do not move H and BL2. One pair moves clearly: BL4 on syn-W2M-M is the E1 value minus 0.010000.
          const asE1 = run.id === "p7-e6-ties" && k === 10 && group === "all";
          const seed = `${asE1 ? "p7-main" : run.id}|${dataset}|${method}|${k}|${group}`;
          const e1Ndcg = num(`n${seed}`, 0.01, 0.4);
          const ndcg = asE1 && dataset === "syn-W2M-M" && method === "BL4" ? minusMicro(e1Ndcg, 10_000) : e1Ndcg;
          rows.push({ dataset, split: run.split, method, k: String(k), bucket: group, n_users: String(groupSize(dataset, group)), recall: num(`r${seed}`, 0.01, 0.6), ndcg });
        }
      }
    }
  }
  return { header: ["dataset", "split", "method", "k", "bucket", "n_users", "recall", "ndcg"], rows };
}

function coverage(run: FixtureRun): Table {
  const rows: Rec[] = [];
  for (const dataset of run.datasets) {
    for (const method of run.methods) {
      for (const k of KS) rows.push({ dataset, split: run.split, method, k: String(k), coverage: num(`c${run.id}|${dataset}|${method}|${k}`, 0.05, 0.9) });
    }
  }
  return { header: ["dataset", "split", "method", "k", "coverage"], rows };
}

function leftout(run: FixtureRun): Table {
  const rows: Rec[] = [];
  for (const dataset of run.datasets) {
    for (const group of GROUPS) {
      const n = groupSize(dataset, group);
      rows.push({ dataset, split: run.split, bucket: group, n_test_users: String(n), n_left_out: String(Math.floor(n / 11)) });
    }
  }
  return { header: ["dataset", "split", "bucket", "n_test_users", "n_left_out"], rows };
}

/** groups.csv of the Orientation run: dataset, group (0-5, 21+), metric (recall, ndcg), K 10. */
function groups(run: FixtureRun): Table {
  const rows: Rec[] = [];
  for (const dataset of run.datasets) {
    for (const group of ["0-5", "21+"]) {
      for (const metric of ["recall", "ndcg"]) {
        const seed = `${run.id}|${dataset}|${group}|${metric}`;
        const h = Number(num(`h${seed}`, 0.01, 0.2));
        const bl2 = Number(num(`b${seed}`, 0.0, 0.05));
        const half = Number(num(`w${seed}`, 0.002, 0.03));
        const d = h - bl2;
        rows.push({ dataset, group, metric, k: "10", n: String(groupSize(dataset, group === "0-5" ? "0-4" : "20+")), h: f6(h), bl2: f6(bl2), mean_diff: f6(d), ci_low: f6(d - half), ci_high: f6(d + half) });
      }
    }
  }
  return { header: ["dataset", "group", "metric", "k", "n", "h", "bl2", "mean_diff", "ci_low", "ci_high"], rows };
}

function compareRow(run: FixtureRun, dataset: string, family: string, method: string, ref: string, k: number, bucket: string, withP: boolean): Rec {
  const seed = `${run.id}|${dataset}|${family}|${method}|${ref}|${k}|${bucket}`;
  const mean = Number(num(`m${seed}`, -0.02, 0.08));
  const half = Number(num(`h${seed}`, 0.002, 0.03));
  const p = num(`p${seed}`, 0, 0.2);
  return {
    dataset,
    family,
    method,
    ref,
    k: String(k),
    bucket,
    n: String(groupSize(dataset, bucket) - Math.floor(groupSize(dataset, bucket) / 11)),
    mean_diff: f6(mean),
    ci_low: f6(mean - half),
    ci_high: f6(mean + half),
    p_raw: withP ? p : "",
    p_holm: withP ? f6(Math.min(1, Number(p) * 3)) : "",
  };
}

function compare(run: FixtureRun): Table {
  const rows: Rec[] = [];
  for (const dataset of run.datasets) {
    if (run.compare === "families") {
      for (const k of KS) for (const g of F1_GROUPS) rows.push(compareRow(run, dataset, "F1", "H", "BL2", k, g, true));
      for (const b of F2_BASELINES) for (const k of KS) for (const g of F2_GROUPS) rows.push(compareRow(run, dataset, "F2", "H", b, k, g, true));
    } else {
      for (const method of run.methods.filter((m) => m !== "BL2")) for (const k of KS) for (const g of GROUPS) rows.push(compareRow(run, dataset, "none", method, "BL2", k, g, false));
    }
  }
  return { header: ["dataset", "family", "method", "ref", "k", "bucket", "n", "mean_diff", "ci_low", "ci_high", "p_raw", "p_holm"], rows };
}

function density(run: FixtureRun): Table {
  const rows: Rec[] = [];
  for (const dataset of run.datasets) {
    const all = groupSize(dataset, "all");
    const kept = all - Math.floor(all / 11);
    const parts = [Math.floor(kept / 8), Math.floor(kept / 2), Math.floor(kept / 4), 0];
    parts[3] = kept - (parts[0] as number) - (parts[1] as number) - (parts[2] as number);
    BINS.forEach((bin, i) => {
      const seed = `d${run.id}|${dataset}|${bin}`;
      const mean = Number(num(`m${seed}`, -0.03, 0.1));
      const half = Number(num(`h${seed}`, 0.005, 0.05));
      rows.push({ dataset, density_bin: bin, method: "H", ref: "BL2", n: String(parts[i]), mean_diff: f6(mean), ci_low: f6(mean - half), ci_high: f6(mean + half) });
    });
  }
  return { header: ["dataset", "density_bin", "method", "ref", "n", "mean_diff", "ci_low", "ci_high"], rows };
}

function grid(method: string): string[] {
  const g = frozen.alphaBetaGrid.map(String);
  if (method === "BL2t") return frozen.baselineGrids.BL2t.map(String);
  if (method === "BL4") return frozen.baselineGrids.BL4.map(String);
  if (method === "BL5") return frozen.baselineGrids.BL5.map(String);
  if (method === "BL6") return g;
  return g.flatMap((a) => g.map((b) => `${a}/${b}`));
}

function tuning(run: FixtureRun): Table {
  const rows: Rec[] = [];
  const names: Record<string, string> = { BL2t: "ageWeight", BL4: "divisor", BL5: "gravity", BL6: "alpha", H: "alpha/beta" };
  for (const dataset of run.datasets) {
    for (const method of run.tuning as string[]) {
      const values = grid(method);
      const ndcg = values.map((v) => num(`t${run.id}|${dataset}|${method}|${v}`, 0.05, 0.3));
      const best = pickBest(values.map((v, i) => ({ tuple: v.split("/").map(Number), ndcg: Number(ndcg[i]) })));
      values.forEach((v, i) => rows.push({ dataset, method, param: names[method] as string, value: v, val_ndcg10: ndcg[i] as string, chosen: i === best ? "1" : "0" }));
    }
  }
  rows.sort((a, b) => (a.dataset === b.dataset ? methodIndex(a.method as string) - methodIndex(b.method as string) : (a.dataset as string) < (b.dataset as string) ? -1 : 1));
  return { header: ["dataset", "method", "param", "value", "val_ndcg10", "chosen"], rows };
}

const E7_ALGOS = ["chrono", "engagement", "social"];

/** latency.csv of the E7 run: one row per algo, the columns of eval/src/bench/e7.ts. */
function e7Latency(run: FixtureRun): Table {
  const rows = E7_ALGOS.map((algo) => {
    const median = Number(num(`l${run.id}|${algo}`, 10, 60));
    const half = Number(num(`h${run.id}|${algo}`, 0.2, 3));
    return { algo, runs: "4", median_ms: f6(median), ci_low_ms: f6(median - half), ci_high_ms: f6(median + half), p95_ms: f6(median * 2) };
  });
  return { header: ["algo", "runs", "median_ms", "ci_low_ms", "ci_high_ms", "p95_ms"], rows };
}

/** queries.csv of the E7 run. */
function e7Queries(run: FixtureRun): Table {
  const rows = E7_ALGOS.map((algo) => {
    const mean = Number(num(`q${run.id}|${algo}`, 17, 22));
    return { algo, requests: "100", mean: f6(mean), min: String(Math.floor(mean) - 2), max: String(Math.ceil(mean) + 1) };
  });
  return { header: ["algo", "requests", "mean", "min", "max"], rows };
}

/** runs.csv of the E7 run: 5 rounds x 3 algos, round 1 is warm-up. */
function e7Runs(run: FixtureRun): Table {
  const rows: Rec[] = [];
  for (let round = 1; round <= 5; round++) {
    for (const algo of E7_ALGOS) {
      const median = Number(num(`r${run.id}|${algo}|${round}`, 10, 60));
      rows.push({ round: String(round), algo, warmup: String(round === 1), requests: "100", failed: "0", min_ms: f6(median / 2), median_ms: f6(median), p95_ms: f6(median * 2), max_ms: f6(median * 3) });
    }
  }
  return { header: ["round", "algo", "warmup", "requests", "failed", "min_ms", "median_ms", "p95_ms", "max_ms"], rows };
}

/** The key columns of each results file: the cells that name a row (the macros trace a value by them). Same as macros.ts. */
const KEY_OF: Record<string, string[]> = {
  "compare.csv": ["dataset", "family", "method", "ref", "k", "bucket"],
  "summary.csv": ["dataset", "split", "method", "k", "bucket"],
  "coverage.csv": ["dataset", "split", "method", "k"],
  "leftout.csv": ["dataset", "split", "bucket"],
  "density.csv": ["dataset", "density_bin", "method", "ref"],
  "tuning.csv": ["dataset", "method", "param", "value"],
  "latency.csv": ["algo"],
  "queries.csv": ["algo"],
  "runs.csv": ["round", "algo"],
  "groups.csv": ["dataset", "group", "metric", "k"],
};

export interface FixtureOptions {
  /** A cell to set: key `<run>/<file>|<row key>|<column>`. */
  cells?: Record<string, string>;
}

/** Writes the fourteen run folders under `dir`, each with its CSV files and a manifest that matches them. */
export function writeResultsFixture(dir: string, o: FixtureOptions = {}): void {
  const used = new Set<string>();
  for (const run of FIXTURE_RUNS) {
    const files: Record<string, Table> = run.e7
      ? { "latency.csv": e7Latency(run), "queries.csv": e7Queries(run), "runs.csv": e7Runs(run) }
      : run.groups
        ? { "groups.csv": groups(run) }
        : { "summary.csv": summary(run), "coverage.csv": coverage(run), "leftout.csv": leftout(run) };
    if (run.compare) files["compare.csv"] = compare(run);
    if (run.density) files["density.csv"] = density(run);
    if (run.tuning) files["tuning.csv"] = tuning(run);
    const out = join(dir, run.id);
    mkdirSync(out, { recursive: true });
    const entries: Record<string, { rows: number; sha256: string }> = {};
    for (const [name, table] of Object.entries(files)) {
      for (const row of table.rows) {
        const key = (KEY_OF[name] as string[]).map((c) => row[c]).join("|");
        for (const col of table.header) {
          const id = `${run.id}/${name}|${key}|${col}`;
          if (o.cells && id in o.cells) {
            row[col] = o.cells[id] as string;
            used.add(id);
          }
        }
      }
      const text = csvText(table.header, table.rows.map((r) => table.header.map((h) => r[h] as string)));
      writeFileSync(join(out, name), text);
      entries[name] = { rows: table.rows.length, sha256: sha256Hex(text) };
    }
    // per_user.csv is outside the folder (over the size limit): the manifest lists it, the report must not read it
    const manifest: Record<string, unknown> = { schemaVersion: 1, runId: run.id, masterSeed: frozen.masterSeed, node: "v0", source: { configSha256: sha256Hex(run.id), datasets: {} }, files: { ...entries, "per_user.csv": { rows: 7, sha256: sha256Hex("not here") } } };
    if (run.id === "p7-main") manifest.external = ["per_user.csv"];
    writeFileSync(join(out, "manifest.json"), canonicalJson(manifest));
  }
  for (const id of Object.keys(o.cells ?? {})) if (!used.has(id)) throw new Error(`fixture: no cell ${id}`);
}

/** Changes the text of one results file. With `fixManifest` the manifest gets the new SHA-256 (a rewritten run), else it keeps the old one. */
export function editResultsFile(dir: string, run: string, file: string, change: (text: string) => string, fixManifest = false): void {
  const path = join(dir, run, file);
  const text = change(readFileSync(path, "utf8"));
  writeFileSync(path, text);
  if (fixManifest) {
    const mPath = join(dir, run, "manifest.json");
    const m = JSON.parse(readFileSync(mPath, "utf8")) as { files: Record<string, { rows: number; sha256: string }> };
    (m.files[file] as { sha256: string }).sha256 = sha256Hex(text);
    writeFileSync(mPath, canonicalJson(m));
  }
}
