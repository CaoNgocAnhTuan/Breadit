import { f6 } from "../metrics.ts";
import { parseCsv } from "../report/read.ts";
import { rng } from "../rng.ts";

// The pure part of the E7 summary (task p7-cost-benchmark, design "Approach", step 3). E7 is the cost of the three `algo` feeds:
// the latency of page 1 (k6, Class R) and the Prisma queries per request (Class D). The unit of the latency CI is the run:
// the median of the 4 kept run medians, with a bootstrap over those 4 values (spec question 5).

export const E7_ALGOS = ["chrono", "engagement", "social"] as const;
export type E7Algo = (typeof E7_ALGOS)[number];

/** Round 1 is warm-up. The other 4 rounds are kept, and fewer than 4 stops the summary. */
export const MIN_KEPT_RUNS = 4;

export const RUNS_HEADER = ["round", "algo", "warmup", "requests", "failed", "min_ms", "median_ms", "p95_ms", "max_ms"] as const;
export const QUERIES_RAW_HEADER = ["pair", "user_id", "as_of_unix", "algo", "status", "posts_on_page", "queries"] as const;
export const LATENCY_HEADER = ["algo", "runs", "median_ms", "ci_low_ms", "ci_high_ms", "p95_ms"] as const;
export const QUERIES_HEADER = ["algo", "requests", "mean", "min", "max"] as const;

/** One k6 run: 100 requests of one algo. */
export interface RunRow {
  round: number;
  algo: string;
  warmup: boolean;
  requests: number;
  /** Requests that failed (k6 `http_req_failed`). */
  failed: number;
  minMs: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
}

export interface LatencyRow {
  algo: E7Algo;
  /** Kept runs (without warm-up). */
  runs: number;
  /** Median of the kept run medians. */
  medianMs: number;
  ciLow: number;
  ciHigh: number;
  /** Median of the kept run p95 values. */
  p95Ms: number;
}

/** One feed request of the prepare step. */
export interface QueryRaw {
  pair: number;
  userId: string;
  asOfUnix: number;
  algo: string;
  status: number;
  postsOnPage: number;
  queries: number;
}

export interface QueryRow {
  algo: E7Algo;
  requests: number;
  mean: number;
  min: number;
  max: number;
}

export interface BootstrapOpts {
  masterSeed: number;
  /** B, super-plan section 7. */
  resamples: number;
  level: number;
}

const byNumber = (a: number, b: number): number => a - b;

/** Median of a list (the mean of the two middle values when the count is even). The input is not changed. */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("median needs at least one value");
  const s = [...values].sort(byNumber);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** numpy's default ("linear") percentile of a sorted array, q in [0, 1] (the same rule as `pairedBootstrap`). */
function quantileSorted(sorted: Float64Array, q: number): number {
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return (sorted[lo] as number) + ((sorted[hi] as number) - (sorted[lo] as number)) * (pos - lo);
}

/**
 * Bootstrap of the median: B resamples of n values each, from the stream rng(masterSeed, "bootstrap-median"). The interval is the
 * (1 - level) / 2 and (1 + level) / 2 percentiles of the B resample medians. The stream starts again at every call.
 */
export function bootstrapMedian(values: readonly number[], o: BootstrapOpts): { median: number; ciLow: number; ciHigh: number } {
  const n = values.length;
  if (n === 0) throw new Error("bootstrapMedian needs at least one value");
  const gen = rng(o.masterSeed, "bootstrap-median");
  const medians = new Float64Array(o.resamples);
  const pick = new Array<number>(n);
  for (let b = 0; b < o.resamples; b++) {
    for (let i = 0; i < n; i++) pick[i] = values[gen.int(n)] as number;
    medians[b] = median(pick);
  }
  medians.sort((a, b) => a - b);
  return { median: median(values), ciLow: quantileSorted(medians, (1 - o.level) / 2), ciHigh: quantileSorted(medians, (1 + o.level) / 2) };
}

function checkAlgo(algo: string): E7Algo {
  if (!(E7_ALGOS as readonly string[]).includes(algo)) throw new Error(`unknown algo "${algo}"; allowed: ${E7_ALGOS.join(", ")}`);
  return algo as E7Algo;
}

/**
 * One row per algo, in the order chrono, engagement, social. A run with `failed > 0` stops the summary, warm-up included (DW5).
 * The warm-up runs are dropped; an algo with fewer than `MIN_KEPT_RUNS` kept runs stops it too.
 */
export function summarizeLatency(runs: readonly RunRow[], o: BootstrapOpts): LatencyRow[] {
  for (const r of runs) {
    checkAlgo(r.algo);
    if (r.failed > 0) throw new Error(`http_req_failed: ${r.failed} of ${r.requests} requests failed in ${r.algo}, round ${r.round}`);
  }
  return E7_ALGOS.map((algo) => {
    const kept = runs.filter((r) => r.algo === algo && !r.warmup);
    if (kept.length < MIN_KEPT_RUNS) throw new Error(`${algo} has ${kept.length} kept runs, at least ${MIN_KEPT_RUNS} are needed (warm-up runs do not count)`);
    const b = bootstrapMedian(
      kept.map((r) => r.medianMs),
      o,
    );
    return { algo, runs: kept.length, medianMs: b.median, ciLow: b.ciLow, ciHigh: b.ciHigh, p95Ms: median(kept.map((r) => r.p95Ms)) };
  });
}

/** Requests, mean, min and max of the query count of each algo, in the order chrono, engagement, social. */
export function summarizeQueries(raw: readonly QueryRaw[]): QueryRow[] {
  for (const r of raw) {
    checkAlgo(r.algo);
    if (r.status !== 200) throw new Error(`pair ${r.pair} ${r.algo} gave status ${r.status}, not 200`);
  }
  return E7_ALGOS.map((algo) => {
    const q = raw.filter((r) => r.algo === algo).map((r) => r.queries);
    if (q.length === 0) throw new Error(`${algo} has no request in the query counts`);
    let sum = 0;
    for (const x of q) sum += x;
    return { algo, requests: q.length, mean: sum / q.length, min: Math.min(...q), max: Math.max(...q) };
  });
}

function int(s: string, what: string): number {
  if (!/^-?\d+$/.test(s)) throw new Error(`${what} is "${s}", not a whole number`);
  return Number(s);
}

function num(s: string, what: string): number {
  const x = Number(s);
  if (s === "" || !Number.isFinite(x)) throw new Error(`${what} is "${s}", not a number`);
  return x;
}

/** `runs.csv` of the runner to rows. Stops on a wrong header or a cell that is not a number. */
export function parseRuns(text: string, what: string): RunRow[] {
  const t = parseCsv(text, what);
  if (t.header.join(",") !== RUNS_HEADER.join(",")) throw new Error(`${what} has the columns ${t.header.join(",")}, expected ${RUNS_HEADER.join(",")}`);
  return t.rows.map((r, i) => {
    const at = `${what} line ${i + 2}`;
    if (r.warmup !== "true" && r.warmup !== "false") throw new Error(`${at}: warmup is "${r.warmup}", expected true or false`);
    return {
      round: int(r.round as string, `${at} round`),
      algo: r.algo as string,
      warmup: r.warmup === "true",
      requests: int(r.requests as string, `${at} requests`),
      failed: int(r.failed as string, `${at} failed`),
      minMs: num(r.min_ms as string, `${at} min_ms`),
      medianMs: num(r.median_ms as string, `${at} median_ms`),
      p95Ms: num(r.p95_ms as string, `${at} p95_ms`),
      maxMs: num(r.max_ms as string, `${at} max_ms`),
    };
  });
}

/** `queries-raw.csv` of the prepare step to rows. */
export function parseQueriesRaw(text: string, what: string): QueryRaw[] {
  const t = parseCsv(text, what);
  if (t.header.join(",") !== QUERIES_RAW_HEADER.join(",")) throw new Error(`${what} has the columns ${t.header.join(",")}, expected ${QUERIES_RAW_HEADER.join(",")}`);
  return t.rows.map((r, i) => {
    const at = `${what} line ${i + 2}`;
    return {
      pair: int(r.pair as string, `${at} pair`),
      userId: r.user_id as string,
      asOfUnix: int(r.as_of_unix as string, `${at} as_of_unix`),
      algo: r.algo as string,
      status: int(r.status as string, `${at} status`),
      postsOnPage: int(r.posts_on_page as string, `${at} posts_on_page`),
      queries: int(r.queries as string, `${at} queries`),
    };
  });
}

export const latencyCells = (r: LatencyRow): string[] => [r.algo, String(r.runs), f6(r.medianMs), f6(r.ciLow), f6(r.ciHigh), f6(r.p95Ms)];
export const queriesCells = (r: QueryRow): string[] => [r.algo, String(r.requests), f6(r.mean), String(r.min), String(r.max)];
export const runsCells = (r: RunRow): string[] => [String(r.round), r.algo, String(r.warmup), String(r.requests), String(r.failed), f6(r.minMs), f6(r.medianMs), f6(r.p95Ms), f6(r.maxMs)];
export const queriesRawCells = (r: QueryRaw): string[] => [String(r.pair), r.userId, String(r.asOfUnix), r.algo, String(r.status), String(r.postsOnPage), String(r.queries)];
