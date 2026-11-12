import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { canonicalJson } from "../canonical/manifest.ts";
import type { FileEntry } from "../canonical/csv.ts";
import { loadFrozen } from "../frozen.ts";
import { csvText, writeCsvText } from "../results-csv.ts";
import {
  LATENCY_HEADER,
  MIN_KEPT_RUNS,
  QUERIES_HEADER,
  QUERIES_RAW_HEADER,
  RUNS_HEADER,
  latencyCells,
  parseQueriesRaw,
  parseRuns,
  queriesCells,
  queriesRawCells,
  runsCells,
  summarizeLatency,
  summarizeQueries,
} from "./e7.ts";

// The E7 summary (task p7-cost-benchmark, design "Approach", step 3). It reads the raw files of the prepare step and the
// runner from the git-ignored eval/results/p7-e7/, and writes the committed results to .docs/results/p7-e7/. It computes
// everything before it writes anything, so a failed run leaves no new file. It never touches Postgres, Redis or HTTP.

export const RUN_ID = "p7-e7";
const REPO_ROOT = new URL("../../../", import.meta.url).pathname;

/** The keys the runner writes to environment.json (Class R: the manifest records the machine). */
const ENVIRONMENT_KEYS = ["os", "cpuModel", "cores", "memoryBytes", "node", "k6", "postgres", "postgresImage", "redisImage", "cacheEnabled", "throttleLimit", "loadProfile"] as const;

interface Params {
  ALGO_METHOD: Record<string, string>;
  SOCIAL_PARAMS: { alpha: number; beta: number };
  PRIOR_M: number;
  POOL_PARAMS: { windowSec: number; maxPosts: number };
}

function readRaw(dir: string, name: string): string {
  const path = join(dir, name);
  if (!existsSync(path)) throw new Error(`${name} not found in ${dir}. Run \`npm run bench:e7\` first (it makes the raw files)`);
  return readFileSync(path, "utf8");
}

function same(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

/** F-checks of the design: the backend params of the run are the ones of the parity sample, and the pool is the frozen one. */
function checkParams(params: Params, parity: { methods: unknown; params: { alpha: number; beta: number; m: number } }): void {
  const frozen = loadFrozen();
  const want = { alpha: parity.params.alpha, beta: parity.params.beta, m: parity.params.m };
  const got = { alpha: params.SOCIAL_PARAMS.alpha, beta: params.SOCIAL_PARAMS.beta, m: params.PRIOR_M };
  if (!same(want, got)) throw new Error(`params.json differs from the parity sample: the run used ${JSON.stringify(got)}, the parity sample ${JSON.stringify(want)}`);
  if (!same(parity.methods, params.ALGO_METHOD)) throw new Error(`params.json differs from the parity sample: the algo map is ${JSON.stringify(params.ALGO_METHOD)}, the parity sample ${JSON.stringify(parity.methods)}`);
  const pool = { windowSec: frozen.windowDays * 86400, maxPosts: frozen.poolCap };
  if (!same(pool, params.POOL_PARAMS)) throw new Error(`params.json has the pool ${JSON.stringify(params.POOL_PARAMS)}, the frozen values are ${JSON.stringify(pool)}`);
}

function checkEnvironment(env: Record<string, unknown>): void {
  for (const k of ENVIRONMENT_KEYS) if (!(k in env)) throw new Error(`environment.json has no "${k}"`);
  if (env.cacheEnabled !== false) throw new Error("environment.json says the page cache was on (cacheEnabled): E7 runs with the cache off");
}

/**
 * `e7-summary [--raw-dir <dir>] [--out <dir>] [--parity-dir <dir>]`. Reads runs.csv, queries-raw.csv, params.json and environment.json
 * from the raw folder (default eval/results/p7-e7), writes latency.csv, queries.csv, runs.csv, queries-raw.csv and manifest.json to
 * `--out` (default .docs/results/p7-e7), and returns the lines to print.
 */
export function e7SummaryCommand(argv: string[]): string[] {
  const { values } = parseArgs({ args: argv, options: { "raw-dir": { type: "string" }, out: { type: "string" }, "parity-dir": { type: "string" } }, strict: true });
  const rawDir = values["raw-dir"] !== undefined ? resolve(values["raw-dir"]) : join(REPO_ROOT, "eval", "results", RUN_ID);
  const outDir = values.out !== undefined ? resolve(values.out) : join(REPO_ROOT, ".docs", "results", RUN_ID);
  const parityDir = values["parity-dir"] !== undefined ? resolve(values["parity-dir"]) : join(REPO_ROOT, ".docs", "results", "p6-parity");

  const parityText = readRaw(parityDir, "manifest.json");
  const parity = JSON.parse(parityText) as { dataset: { id: string; manifestSha256: string }; methods: Record<string, string>; params: { alpha: number; beta: number; m: number } };
  const params = JSON.parse(readRaw(rawDir, "params.json")) as Params;
  const environment = JSON.parse(readRaw(rawDir, "environment.json")) as Record<string, unknown>;
  checkParams(params, parity);
  checkEnvironment(environment);

  const frozen = loadFrozen();
  const runs = parseRuns(readRaw(rawDir, "runs.csv"), "runs.csv");
  const raw = parseQueriesRaw(readRaw(rawDir, "queries-raw.csv"), "queries-raw.csv");
  const latency = summarizeLatency(runs, { masterSeed: frozen.masterSeed, resamples: frozen.bootstrapResamples, level: frozen.confidenceLevel });
  const queries = summarizeQueries(raw);

  const files: Record<string, FileEntry> = {
    "latency.csv": writeCsvText(outDir, "latency.csv", csvText(LATENCY_HEADER, latency.map(latencyCells))),
    "queries-raw.csv": writeCsvText(outDir, "queries-raw.csv", csvText(QUERIES_RAW_HEADER, raw.map(queriesRawCells))),
    "queries.csv": writeCsvText(outDir, "queries.csv", csvText(QUERIES_HEADER, queries.map(queriesCells))),
    "runs.csv": writeCsvText(outDir, "runs.csv", csvText(RUNS_HEADER, runs.map(runsCells))),
  };
  const manifest = {
    schemaVersion: 1,
    runId: RUN_ID,
    masterSeed: frozen.masterSeed,
    node: process.version,
    dataset: parity.dataset,
    params: { alpha: params.SOCIAL_PARAMS.alpha, beta: params.SOCIAL_PARAMS.beta, m: params.PRIOR_M, methods: params.ALGO_METHOD, pool: params.POOL_PARAMS },
    bootstrap: { keptRunsPerAlgo: MIN_KEPT_RUNS, level: frozen.confidenceLevel, resamples: frozen.bootstrapResamples, stream: "bootstrap-median", unit: "run median" },
    environment,
    files,
  };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "manifest.json"), canonicalJson(manifest), "utf8");

  const lines = [`${RUN_ID}  ${parity.dataset.id}  alpha ${params.SOCIAL_PARAMS.alpha}  beta ${params.SOCIAL_PARAMS.beta}  cache off  throttle ${String(environment.throttleLimit)}`];
  lines.push("algo        runs  median_ms  ci_low_ms  ci_high_ms  p95_ms  queries_mean");
  for (const [i, l] of latency.entries()) {
    const q = queries[i];
    lines.push(`${l.algo.padEnd(10)}  ${String(l.runs).padStart(4)}  ${l.medianMs.toFixed(2).padStart(9)}  ${l.ciLow.toFixed(2).padStart(9)}  ${l.ciHigh.toFixed(2).padStart(10)}  ${l.p95Ms.toFixed(2).padStart(6)}  ${q === undefined ? "" : q.mean.toFixed(2)}`);
  }
  lines.push(`results: ${outDir}`);
  return lines;
}
