import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "../canonical/csv.ts";
import { tempDir } from "../checks/fixture.ts";
import { loadFrozen } from "../frozen.ts";
import { f6 } from "../metrics.ts";
import { csvText } from "../results-csv.ts";
import { E7_ALGOS, QUERIES_RAW_HEADER, RUNS_HEADER } from "./e7.ts";
import { e7SummaryCommand } from "./write.ts";

// TC4, the files: DW3 (the files and the manifest), DW4 (two summaries give the same bytes), DW5 (a failed request writes no latency.csv).
const frozen = loadFrozen();
const METHODS = { chrono: "BL0", engagement: "BL2", social: "H" };
const PARAMS = { ALGO_METHOD: METHODS, SOCIAL_PARAMS: { alpha: 1, beta: 1 }, PRIOR_M: 5, POOL_PARAMS: { windowSec: frozen.windowDays * 86400, maxPosts: frozen.poolCap } };
const ENV = {
  os: "darwin 25.0.0 arm64",
  cpuModel: "Test CPU",
  cores: 8,
  memoryBytes: 17179869184,
  node: "v22.23.4",
  k6: "k6 v1.7.1",
  postgres: "PostgreSQL 16.1",
  postgresImage: "postgres:16 sha256:aaa",
  redisImage: "redis:7 sha256:bbb",
  cacheEnabled: false,
  throttleLimit: 1000000,
  loadProfile: { vus: 1, iterations: 100, sleep: 0 },
};

interface Opts {
  failed?: { round: number; algo: string; n: number };
  params?: unknown;
  env?: unknown;
  status429?: boolean;
}

/** A raw folder (what the prepare step and the runner write) and a parity folder, in temp directories. */
function fixture(o: Opts = {}): { raw: string; out: string; parity: string; args: string[] } {
  const raw = tempDir("e7-raw-");
  const out = tempDir("e7-out-");
  const parity = tempDir("e7-parity-");
  writeFileSync(
    join(parity, "manifest.json"),
    JSON.stringify({ dataset: { id: "syn-W2M-M", manifestSha256: "d".repeat(64) }, methods: METHODS, params: { alpha: 1, beta: 1, m: 5 } }),
  );
  const runs: string[][] = [];
  for (let round = 1; round <= 5; round++) {
    for (const [i, algo] of E7_ALGOS.entries()) {
      const base = 10 * (i + 1) + round / 10;
      const failed = o.failed !== undefined && o.failed.round === round && o.failed.algo === algo ? o.failed.n : 0;
      runs.push([String(round), algo, String(round === 1), "100", String(failed), f6(base / 2), f6(base), f6(base * 2), f6(base * 3)]);
    }
  }
  writeFileSync(join(raw, "runs.csv"), csvText(RUNS_HEADER, runs));
  const q: string[][] = [];
  for (let pair = 1; pair <= 4; pair++) {
    for (const [i, algo] of E7_ALGOS.entries()) {
      q.push([String(pair), `u${pair}`, "1787448171", algo, o.status429 === true && pair === 2 ? "429" : "200", "10", String(18 + i + (pair % 2))]);
    }
  }
  writeFileSync(join(raw, "queries-raw.csv"), csvText(QUERIES_RAW_HEADER, q));
  writeFileSync(join(raw, "params.json"), JSON.stringify(o.params ?? PARAMS));
  writeFileSync(join(raw, "environment.json"), JSON.stringify(o.env ?? ENV));
  return { raw, out, parity, args: ["--raw-dir", raw, "--out", out, "--parity-dir", parity] };
}

const read = (dir: string, name: string): string => readFileSync(join(dir, name), "utf8");

test("the summary writes the five files of DW3 and the manifest checks them", () => {
  const f = fixture();
  e7SummaryCommand(f.args);
  const manifest = JSON.parse(read(f.out, "manifest.json"));
  assert.deepEqual(Object.keys(manifest.files), ["latency.csv", "queries-raw.csv", "queries.csv", "runs.csv"]);
  for (const name of Object.keys(manifest.files)) {
    assert.equal(manifest.files[name].sha256, sha256Hex(read(f.out, name)), name);
  }
  assert.equal(manifest.files["runs.csv"].rows, 15);
  assert.equal(manifest.files["queries-raw.csv"].rows, 12);
  assert.equal(manifest.files["latency.csv"].rows, 3);
  assert.equal(manifest.files["queries.csv"].rows, 3);
  assert.equal(manifest.runId, "p7-e7");
  assert.equal(manifest.masterSeed, frozen.masterSeed);
  assert.deepEqual(manifest.dataset, { id: "syn-W2M-M", manifestSha256: "d".repeat(64) });
  assert.deepEqual(manifest.environment, ENV);
  assert.deepEqual(manifest.bootstrap, { keptRunsPerAlgo: 4, level: 0.95, resamples: 10000, stream: "bootstrap-median", unit: "run median" });
  assert.deepEqual(manifest.params, { alpha: 1, beta: 1, m: 5, methods: METHODS, pool: PARAMS.POOL_PARAMS });
});

test("latency.csv has one row per algo, from the 4 kept runs; queries.csv has the counts", () => {
  const f = fixture();
  e7SummaryCommand(f.args);
  const lat = read(f.out, "latency.csv").split("\n");
  assert.equal(lat[0], "algo,runs,median_ms,ci_low_ms,ci_high_ms,p95_ms");
  assert.equal(lat.length, 5); // header, 3 rows, final newline
  // chrono medians of rounds 2 to 5: 10.2, 10.3, 10.4, 10.5, and the warm-up 10.1 does not count
  assert.match(lat[1] as string, /^chrono,4,10\.350000,/);
  assert.match(lat[2] as string, /^engagement,4,20\.350000,/);
  assert.match(lat[3] as string, /^social,4,30\.350000,/);
  const q = read(f.out, "queries.csv").split("\n");
  assert.equal(q[0], "algo,requests,mean,min,max");
  assert.equal(q[1], "chrono,4,18.500000,18,19");
});

test("two summaries of the same raw files give the same bytes", () => {
  const a = fixture();
  e7SummaryCommand(a.args);
  const out2 = tempDir("e7-out2-");
  e7SummaryCommand(["--raw-dir", a.raw, "--out", out2, "--parity-dir", a.parity]);
  for (const name of ["latency.csv", "queries.csv", "runs.csv", "queries-raw.csv", "manifest.json"]) assert.equal(read(a.out, name), read(out2, name), name);
});

test("DW5: a failed request stops the summary, names http_req_failed and writes no file", () => {
  const f = fixture({ failed: { round: 3, algo: "social", n: 2 } });
  assert.throws(() => e7SummaryCommand(f.args), /http_req_failed.*social.*round 3/);
  assert.equal(existsSync(join(f.out, "latency.csv")), false);
  assert.equal(existsSync(join(f.out, "manifest.json")), false);
});

test("a failed summary leaves a committed latency.csv as it was", () => {
  const f = fixture({ failed: { round: 2, algo: "chrono", n: 1 } });
  mkdirSync(f.out, { recursive: true });
  writeFileSync(join(f.out, "latency.csv"), "old\n");
  assert.throws(() => e7SummaryCommand(f.args), /http_req_failed/);
  assert.equal(read(f.out, "latency.csv"), "old\n");
});

test("a query response that is not 200 stops the summary", () => {
  const f = fixture({ status429: true });
  assert.throws(() => e7SummaryCommand(f.args), /429/);
  assert.equal(existsSync(join(f.out, "queries.csv")), false);
});

test("params.json that differs from the parity sample stops the summary and names the value", () => {
  const f = fixture({ params: { ...PARAMS, SOCIAL_PARAMS: { alpha: 1024, beta: 1024 } } });
  assert.throws(() => e7SummaryCommand(f.args), /alpha|parity/);
  assert.equal(existsSync(join(f.out, "latency.csv")), false);
});

test("an environment with the cache on stops the summary", () => {
  const f = fixture({ env: { ...ENV, cacheEnabled: true } });
  assert.throws(() => e7SummaryCommand(f.args), /cache/);
});

test("an environment without a required key stops the summary and names the key", () => {
  const { k6: _k6, ...rest } = ENV;
  const f = fixture({ env: rest });
  assert.throws(() => e7SummaryCommand(f.args), /k6/);
});

test("a missing raw file stops the summary and names the file and the command that makes it", () => {
  const f = fixture();
  rmSync(join(f.raw, "runs.csv"));
  assert.throws(() => e7SummaryCommand(f.args), /runs\.csv not found.*bench:e7/);
  assert.equal(existsSync(join(f.out, "latency.csv")), false);
});
