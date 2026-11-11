import { parseArgs } from "node:util";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { MethodId } from "@breadit/ranking";
import { canonicalJson } from "../canonical/manifest.ts";
import { sha256Hex } from "../canonical/csv.ts";
import { METHOD_ORDER } from "../metrics.ts";
import type { SummaryRow } from "../metrics.ts";
import { REQUIRED_PARAMS, validateConfig } from "./config.ts";
import type { CompareConfig, ParamValue, PoolName, RunConfig } from "./config.ts";
import { TUNING_HEADER, pickBest } from "./tuning.ts";
import type { TuningRow } from "./tuning.ts";

// The freeze (design "Freeze"): the ten test configs of P7 are written from the rows of tuning.csv with chosen = 1, by a fixed table,
// so no number is copied by hand. The tuning files are checked against their run manifests first (F5), and the rule of
// super-plan section 5 is checked on every tuned (dataset, method) (DW1). `--approve` is the author's OK for the test split.

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;

const TUNE_MAIN = "p7-tune-main";
const TUNE_WORLDS = "p7-tune-worlds";
/** The dataset of E1 to E8 and of the H0 gate params (OQ1). */
const MAIN = "syn-W2M-M";
const DIGG = "digg2009";
/** The tuning table of the design: (datasets, tuned methods) of each tuning run. */
const TUNED_MAIN: readonly string[] = ["BL2t", "BL4", "BL5", "BL6", "H"];
const GROUPS_REQUIRED: ReadonlyArray<[string, string]> = [
  ...[MAIN, DIGG].flatMap((d) => TUNED_MAIN.map((m): [string, string] => [d, m])),
  ...["syn-W0-M", "syn-W1-M", "syn-W2L-M", "syn-W2H-M"].map((d): [string, string] => [d, "H"]),
];
/** The methods E8 may add: every baseline (blueprint 4, E8 row). */
const BASELINES: readonly string[] = ["BL0", "BL1", "BL2", "BL2t", "BL3", "BL4", "BL5", "BL6"];
const NINE: readonly string[] = [...BASELINES, "H"];

/** A row of the table "The runs" (design): what one test config holds. */
export interface TestRun {
  runId: string;
  /** What the run answers (for the reader of this table). */
  forWhat: string;
  datasets: readonly string[];
  methods: readonly string[];
  /** "own": each dataset uses its own chosen rows. A dataset id: every dataset uses that dataset's rows (the H0 gate uses syn-W2M-M). */
  from: "own" | string;
  /** The m sweep: a number for `m`. Default: "frozen". */
  m?: number;
  /** E8: add the baseline with the best validation NDCG@10. */
  addBaseline?: boolean;
  pool?: PoolName;
  tieBreak?: "id-asc";
  shuffle?: boolean;
  compare?: CompareConfig;
  density?: boolean;
  h0Gate?: boolean;
}

const NONE_BL2: CompareConfig = { mode: "none", ref: "BL2" };
const TERMS = ["BL2", "H", "H-follow", "H-comm", "H-noauthor", "H-noengager"];

/** The ten test configs, in run order (design, "The runs"). */
export const TEST_RUNS: readonly TestRun[] = [
  { runId: "p7-h0", forWhat: "H0 gate", datasets: ["syn-W0-M"], methods: ["BL2", "H"], from: MAIN, compare: NONE_BL2, h0Gate: true },
  { runId: "p7-main", forWhat: "E1, E2, E3 (Digg)", datasets: [MAIN, DIGG], methods: NINE, from: "own", compare: { mode: "families", ref: "BL2" }, density: true },
  {
    runId: "p7-e5-worlds",
    forWhat: "E5, E3 (W2 cells)",
    datasets: ["syn-W0-M", "syn-W1-M", "syn-W2L-M", MAIN, "syn-W2H-M"],
    methods: ["BL2", "H"],
    from: "own",
    compare: NONE_BL2,
    density: true,
  },
  { runId: "p7-e4-terms", forWhat: "E4", datasets: [MAIN, DIGG], methods: TERMS, from: "own", compare: NONE_BL2 },
  { runId: "p7-e4-m0", forWhat: "E4, m sweep", datasets: [MAIN, DIGG], methods: ["BL2", "H"], from: "own", m: 0, compare: NONE_BL2 },
  { runId: "p7-e4-m2", forWhat: "E4, m sweep", datasets: [MAIN, DIGG], methods: ["BL2", "H"], from: "own", m: 2, compare: NONE_BL2 },
  { runId: "p7-e4-m10", forWhat: "E4, m sweep", datasets: [MAIN, DIGG], methods: ["BL2", "H"], from: "own", m: 10, compare: NONE_BL2 },
  { runId: "p7-e6-ties", forWhat: "E6", datasets: [MAIN, DIGG], methods: NINE, from: "own", tieBreak: "id-asc" },
  { runId: "p7-e8-pool", forWhat: "E8", datasets: [MAIN], methods: ["BL2", "H"], from: "own", addBaseline: true, pool: "large", compare: NONE_BL2 },
  { runId: "p7-e5-shuffle", forWhat: "E5, shuffle", datasets: [MAIN], methods: ["BL2", "H"], from: "own", shuffle: true, compare: NONE_BL2 },
];

// ---- reading the tuning ----

export interface TuningInput {
  /** The rows of both tuning.csv files, p7-tune-main first. */
  tuning: TuningRow[];
  /** The rows of p7-tune-main/summary.csv (the run at the chosen values). */
  summary: SummaryRow[];
}

/** The rows of a results CSV text as arrays of cells, after the header was checked. The writers allow no comma inside a cell. */
export function parseCsvRecords(text: string, header: readonly string[], what: string): string[][] {
  if (!text.endsWith("\n")) throw new Error(`${what} does not end with a line break`);
  const lines = text.slice(0, -1).split("\n");
  if (lines[0] !== header.join(",")) throw new Error(`${what} has the header "${lines[0]}", expected "${header.join(",")}"`);
  return lines.slice(1).map((l, i) => {
    const cells = l.split(",");
    if (cells.length !== header.length) throw new Error(`${what} line ${i + 2} has ${cells.length} cells, expected ${header.length}`);
    return cells;
  });
}

const SUMMARY_HEADER = ["dataset", "split", "method", "k", "bucket", "n_users", "recall", "ndcg"] as const;

/** Reads a file of a run folder and checks its SHA-256 against the run manifest (F5). */
function readChecked(dir: string, runId: string, file: string): string {
  const mPath = join(dir, "manifest.json");
  if (!existsSync(mPath)) throw new Error(`${runId}: no manifest.json in ${dir}. Run the harness on ${runId} first`);
  const manifest = JSON.parse(readFileSync(mPath, "utf8")) as { files?: Record<string, { sha256: string }> };
  const want = manifest.files?.[file]?.sha256;
  if (want === undefined) throw new Error(`${runId}: the manifest does not list ${file}`);
  const path = join(dir, file);
  if (!existsSync(path)) throw new Error(`${runId}: ${file} is missing in ${dir}`);
  const text = readFileSync(path, "utf8");
  if (sha256Hex(text) !== want) throw new Error(`${runId}: ${file} differs from its run manifest (SHA-256 ${sha256Hex(text)}, manifest ${want}). The file was changed after the run`);
  return text;
}

function parseTuning(text: string, what: string): TuningRow[] {
  return parseCsvRecords(text, TUNING_HEADER, what).map((c) => {
    if (c[5] !== "0" && c[5] !== "1") throw new Error(`${what}: chosen must be 0 or 1, got "${c[5]}"`);
    return { dataset: c[0] as string, method: c[1] as string, param: c[2] as string, value: c[3] as string, valNdcg10: c[4] as string, chosen: c[5] === "1" };
  });
}

function parseSummary(text: string, what: string): SummaryRow[] {
  return parseCsvRecords(text, SUMMARY_HEADER, what).map((c) => ({
    dataset: c[0] as string,
    split: c[1] as string,
    method: c[2] as string,
    k: Number(c[3]),
    bucket: c[4] as string,
    nUsers: Number(c[5]),
    recall: c[6] as string,
    ndcg: c[7] as string,
  }));
}

/** Reads the two tuning runs from `<resultsDir>/p7-tune-main/` and `<resultsDir>/p7-tune-worlds/`, each file checked against its manifest. */
export function readTuningInput(resultsDir: string): TuningInput {
  const main = join(resultsDir, TUNE_MAIN);
  const worlds = join(resultsDir, TUNE_WORLDS);
  const tuning = [
    ...parseTuning(readChecked(main, TUNE_MAIN, "tuning.csv"), `${TUNE_MAIN}/tuning.csv`),
    ...parseTuning(readChecked(worlds, TUNE_WORLDS, "tuning.csv"), `${TUNE_WORLDS}/tuning.csv`),
  ];
  const summary = parseSummary(readChecked(main, TUNE_MAIN, "summary.csv"), `${TUNE_MAIN}/summary.csv`);
  readChecked(worlds, TUNE_WORLDS, "summary.csv"); // checked too: no file of a tuning run may be edited
  return { tuning, summary };
}

// ---- the rule of super-plan section 5 (DW1) ----

function tupleOf(value: string): number[] {
  return value.split("/").map(Number);
}

/**
 * For each (dataset, method) group: exactly one row with chosen = 1, and it is the row `pickBest` takes (the highest val_ndcg10, a tie
 * to the smaller value or pair). Returns the number of groups, or throws with every violation.
 */
export function checkTuningRule(rows: readonly TuningRow[]): number {
  const groups = new Map<string, TuningRow[]>();
  for (const r of rows) {
    const key = `${r.dataset}\u0000${r.method}`;
    const l = groups.get(key);
    if (l) l.push(r);
    else groups.set(key, [r]);
  }
  const violations: string[] = [];
  for (const [key, list] of groups) {
    const [dataset, method] = key.split("\u0000") as [string, string];
    const chosen = list.filter((r) => r.chosen);
    if (chosen.length !== 1) {
      violations.push(`${dataset} ${method}: ${chosen.length} rows have chosen = 1, expected exactly one`);
      continue;
    }
    const best = list[pickBest(list.map((r) => ({ tuple: tupleOf(r.value), ndcg: Number(r.valNdcg10) })))] as TuningRow;
    if (chosen[0] !== best) {
      violations.push(`${dataset} ${method}: the chosen row is ${chosen[0]?.param} ${chosen[0]?.value} (${chosen[0]?.valNdcg10}), the rule gives ${best.value} (${best.valNdcg10})`);
    }
  }
  for (const [dataset, method] of GROUPS_REQUIRED) {
    if (!groups.has(`${dataset}\u0000${method}`)) violations.push(`${dataset} ${method}: no tuning rows`);
  }
  if (violations.length > 0) throw new Error(`the tuning breaks the rule of super-plan section 5 (${violations.length} violations, DW1):\n${violations.join("\n")}`);
  return groups.size;
}

// ---- building the configs ----

/** The chosen numbers of (dataset, tuned method): alpha and beta for H, the one param otherwise. */
function chosenNumbers(rows: readonly TuningRow[], dataset: string, method: string): Record<string, number> {
  const row = rows.find((r) => r.dataset === dataset && r.method === method && r.chosen);
  if (row === undefined) throw new Error(`no chosen row for ${dataset} ${method}`);
  const names = row.param.split("/");
  const values = tupleOf(row.value);
  if (names.length !== values.length || values.some((v) => !Number.isFinite(v))) throw new Error(`the chosen row of ${dataset} ${method} is not readable: ${row.param} ${row.value}`);
  return Object.fromEntries(names.map((n, i) => [n, values[i] as number]));
}

/** The tuned numbers of a method on a dataset (without `m`): ablations take H's alpha and beta (OQ2). */
function tunedNumbers(rows: readonly TuningRow[], dataset: string, method: string): Record<string, number> {
  switch (method) {
    case "BL0":
    case "BL1":
    case "BL2":
    case "BL3":
      return {};
    case "BL2t":
    case "BL4":
    case "BL5":
    case "BL6":
      return chosenNumbers(rows, dataset, method);
    case "H":
    case "H-noauthor":
    case "H-noengager":
      return chosenNumbers(rows, dataset, "H");
    case "H-follow":
      return { alpha: chosenNumbers(rows, dataset, "H").alpha as number };
    case "H-comm":
      return { beta: chosenNumbers(rows, dataset, "H").beta as number };
    default:
      throw new Error(`no tuned params for method ${method}`);
  }
}

/** E8 baseline (design "Freeze"): the highest validation NDCG@10 (K 10, all) on syn-W2M-M among BL0 to BL6. A tie goes to the method order. */
export function e8Baseline(summary: readonly SummaryRow[]): { method: string; ndcg: string } {
  let best: { method: string; ndcg: string } | undefined;
  for (const method of METHOD_ORDER.filter((m) => BASELINES.includes(m))) {
    const row = summary.find((r) => r.dataset === MAIN && r.method === method && r.k === 10 && r.bucket === "all");
    if (row === undefined || row.nUsers === 0 || row.ndcg === "") throw new Error(`${TUNE_MAIN}/summary.csv has no NDCG@10 (K 10, all) row for ${method} on ${MAIN}`);
    if (best === undefined || Number(row.ndcg) > Number(best.ndcg)) best = { method, ndcg: row.ndcg };
  }
  return best as { method: string; ndcg: string };
}

function buildOne(run: TestRun, rows: readonly TuningRow[], baseline: string): RunConfig {
  const methods = METHOD_ORDER.filter((m) => run.methods.includes(m) || (run.addBaseline === true && m === baseline));
  const source = (dataset: string): string => (run.from === "own" ? dataset : run.from);
  const m: ParamValue = run.m ?? "frozen";
  const params: Record<string, Record<string, ParamValue>> = {};
  for (const method of methods) {
    const need = REQUIRED_PARAMS[method as MethodId];
    if (need.length === 0) continue;
    params[method] = { ...tunedNumbers(rows, source(run.datasets[0] as string), method), ...(need.includes("m") ? { m } : {}) };
  }
  const cfg: RunConfig = {
    datasets: [...run.datasets],
    split: "test",
    methods,
    params,
    pool: run.pool ?? "normal",
    mode: "fast",
  };
  if (run.datasets.length > 1) {
    cfg.datasetParams = Object.fromEntries(
      run.datasets.map((d) => [
        d,
        Object.fromEntries(
          methods
            .map((method) => [method, tunedNumbers(rows, source(d), method)] as const)
            .filter(([, numbers]) => Object.keys(numbers).length > 0),
        ),
      ]),
    );
  }
  if (run.tieBreak !== undefined) cfg.tieBreak = run.tieBreak;
  if (run.shuffle !== undefined) cfg.shuffle = run.shuffle;
  if (run.compare !== undefined) cfg.compare = run.compare;
  if (run.density !== undefined) cfg.density = run.density;
  if (run.h0Gate !== undefined) cfg.h0Gate = run.h0Gate;
  // Well-formed as an approved test config, or it stops here and not at the first test run.
  validateConfig({ ...cfg, testApprovedBy: "check" });
  return cfg;
}

/** The ten test configs, with no `testApprovedBy`, keyed by run id in run order. Every number comes from a chosen row. */
export function buildTestConfigs(input: TuningInput): Record<string, RunConfig> {
  const baseline = e8Baseline(input.summary).method;
  const out: Record<string, RunConfig> = {};
  for (const run of TEST_RUNS) out[run.runId] = buildOne(run, input.tuning, baseline);
  return out;
}

// ---- the command ----

function diffValues(a: unknown, b: unknown, path: string, out: string[]): void {
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
    for (const k of keys) {
      const ka = (a as Record<string, unknown>)[k];
      const kb = (b as Record<string, unknown>)[k];
      const p = path === "" ? k : `${path}.${k}`;
      if (ka === undefined) out.push(`${p}: only in the tuned config`);
      else if (kb === undefined) out.push(`${p}: only in the file`);
      else diffValues(ka, kb, p, out);
    }
    return;
  }
  if (a !== b) out.push(`${path}: file ${JSON.stringify(a)}, tuned ${JSON.stringify(b)}`);
}

/**
 * `freeze [--approve <name>] [--check] [--results-dir <dir>] [--config-dir <dir>]`. Reads the two tuning runs, checks them, and
 * writes `<config-dir>/<runId>.json` for the ten test runs. `--approve` writes `testApprovedBy` too (the author's OK, Open question 7).
 * `--check` writes nothing: it compares the files with the configs rebuilt from the tuning, ignoring `testApprovedBy`.
 */
export function freezeCommand(argv: string[]): string[] {
  const { values } = parseArgs({
    args: argv,
    options: { approve: { type: "string" }, check: { type: "boolean" }, "results-dir": { type: "string" }, "config-dir": { type: "string" } },
    strict: true,
  });
  if (values.approve !== undefined && values.approve.trim() === "") throw new Error("--approve needs the name of the person who approves the test split");
  if (values.check === true && values.approve !== undefined) throw new Error("--check and --approve cannot go together: --check writes nothing");
  const resultsDir = values["results-dir"] !== undefined ? resolve(values["results-dir"]) : join(REPO_ROOT, ".docs", "results");
  const configDir = values["config-dir"] !== undefined ? resolve(values["config-dir"]) : join(REPO_ROOT, "eval", "config", "runs");

  const input = readTuningInput(resultsDir);
  const groups = checkTuningRule(input.tuning);
  const lines = [`rule check: ${groups} groups, 0 violations`];
  const configs = buildTestConfigs(input);
  const e8 = e8Baseline(input.summary);
  lines.push(`E8 baseline: ${e8.method} (validation NDCG@10 ${e8.ndcg}, K 10, all users, ${MAIN})`);

  if (values.check === true) {
    const differences: string[] = [];
    for (const [runId, cfg] of Object.entries(configs)) {
      const path = join(configDir, `${runId}.json`);
      if (!existsSync(path)) {
        differences.push(`${runId}: file ${path} is missing`);
        continue;
      }
      let file: Record<string, unknown>;
      try {
        file = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      } catch (e) {
        differences.push(`${runId}: file is not valid JSON (${(e as Error).message})`);
        continue;
      }
      const { testApprovedBy: _approved, ...rest } = file;
      const found: string[] = [];
      diffValues(rest, cfg, "", found);
      for (const f of found) differences.push(`${runId}: ${f}`);
    }
    if (differences.length > 0) throw new Error([...lines, ...differences].join("\n"));
    lines.push("equal");
    return lines;
  }

  mkdirSync(configDir, { recursive: true });
  for (const [runId, cfg] of Object.entries(configs)) {
    const out = values.approve !== undefined ? { ...cfg, testApprovedBy: values.approve } : cfg;
    writeFileSync(join(configDir, `${runId}.json`), canonicalJson(out), "utf8");
  }
  lines.push(`wrote ${Object.keys(configs).length} test configs to ${configDir}${values.approve !== undefined ? ` with testApprovedBy "${values.approve}"` : " (not approved)"}`);
  return lines;
}
