import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrapMedian, median, summarizeLatency, summarizeQueries, MIN_KEPT_RUNS } from "./e7.ts";
import type { BootstrapOpts, QueryRaw, RunRow } from "./e7.ts";

// TC4 (task p7-cost-benchmark, DW3 and DW5): the pure functions of the E7 summary.
const OPTS: BootstrapOpts = { masterSeed: 20261014, resamples: 10000, level: 0.95 };
const ALGOS = ["chrono", "engagement", "social"] as const;

function run(round: number, algo: string, medianMs: number, o: Partial<RunRow> = {}): RunRow {
  return { round, algo, warmup: round === 1, requests: 100, failed: 0, minMs: 1, medianMs, p95Ms: medianMs * 2, maxMs: medianMs * 3, ...o };
}

/** 5 rounds for each algo; the warm-up round is slow (999) and must not count. */
function fifteenRuns(): RunRow[] {
  const medians: Record<string, number[]> = {
    chrono: [999, 10, 12, 11, 13],
    engagement: [999, 20, 22, 21, 23],
    social: [999, 30, 32, 31, 33],
  };
  return ALGOS.flatMap((a) => (medians[a] as number[]).map((m, i) => run(i + 1, a, m)));
}

test("median: odd count, even count, unsorted input, and the input is not changed", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([7]), 7);
  const v = [5, 1, 3];
  median(v);
  assert.deepEqual(v, [5, 1, 3]);
  assert.throws(() => median([]), /at least one/);
});

test("bootstrapMedian: the same input gives the same bytes twice", () => {
  const a = bootstrapMedian([10, 12, 11, 13], OPTS);
  const b = bootstrapMedian([10, 12, 11, 13], OPTS);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("bootstrapMedian: equal values give an interval of one point", () => {
  assert.deepEqual(bootstrapMedian([5, 5, 5, 5], OPTS), { median: 5, ciLow: 5, ciHigh: 5 });
});

test("bootstrapMedian: two values 1 and 3 give median 2 and the interval 1 to 3 (known answer)", () => {
  // n = 2: the resample median is 1 (p 1/4), 2 (p 1/2) or 3 (p 1/4), so the 2.5th and 97.5th percentiles are 1 and 3.
  assert.deepEqual(bootstrapMedian([1, 3], OPTS), { median: 2, ciLow: 1, ciHigh: 3 });
});

test("bootstrapMedian: the interval of four run medians holds the median and stays inside the data", () => {
  const r = bootstrapMedian([10, 12, 11, 13], OPTS);
  assert.equal(r.median, 11.5);
  assert.ok(r.ciLow <= r.median && r.median <= r.ciHigh);
  assert.ok(r.ciLow >= 10 && r.ciHigh <= 13);
});

test("bootstrapMedian: the stream restarts for every call, so the order of calls does not matter", () => {
  const x = bootstrapMedian([10, 12, 11, 13], OPTS);
  bootstrapMedian([1, 2, 3, 4, 5], OPTS);
  assert.deepEqual(bootstrapMedian([10, 12, 11, 13], OPTS), x);
});

test("bootstrapMedian: no values is an error", () => {
  assert.throws(() => bootstrapMedian([], OPTS), /at least one/);
});

test("summarizeLatency: the warm-up row is dropped and the median is of the 4 kept run medians", () => {
  const rows = summarizeLatency(fifteenRuns(), OPTS);
  assert.deepEqual(
    rows.map((r) => [r.algo, r.runs, r.medianMs, r.p95Ms]),
    [
      ["chrono", 4, 11.5, 23],
      ["engagement", 4, 21.5, 43],
      ["social", 4, 31.5, 63],
    ],
  );
  for (const r of rows) assert.ok(r.ciLow <= r.medianMs && r.medianMs <= r.ciHigh && r.ciHigh < 100);
});

test("summarizeLatency: the rows follow the order chrono, engagement, social, whatever the input order", () => {
  const rows = summarizeLatency(fifteenRuns().reverse(), OPTS);
  assert.deepEqual(rows.map((r) => r.algo), ["chrono", "engagement", "social"]);
});

test("summarizeLatency: a run with failed > 0 throws and names http_req_failed, the round and the algo", () => {
  const runs = fifteenRuns();
  runs[7] = { ...(runs[7] as RunRow), failed: 2 }; // engagement, round 3
  assert.throws(() => summarizeLatency(runs, OPTS), /http_req_failed.*engagement.*round 3|engagement.*round 3.*http_req_failed/);
});

test("summarizeLatency: a failed warm-up run throws too", () => {
  const runs = fifteenRuns();
  runs[0] = { ...(runs[0] as RunRow), failed: 1 };
  assert.throws(() => summarizeLatency(runs, OPTS), /http_req_failed/);
});

test("summarizeLatency: fewer than 4 kept runs for an algo throws", () => {
  assert.equal(MIN_KEPT_RUNS, 4);
  const runs = fifteenRuns().filter((r) => !(r.algo === "social" && r.round === 5));
  assert.throws(() => summarizeLatency(runs, OPTS), /social.*3.*4|social.*at least 4/);
});

test("summarizeLatency: an algo with no run throws", () => {
  const runs = fifteenRuns().filter((r) => r.algo !== "chrono");
  assert.throws(() => summarizeLatency(runs, OPTS), /chrono/);
});

test("summarizeLatency: an unknown algo throws", () => {
  assert.throws(() => summarizeLatency([...fifteenRuns(), run(2, "hot", 5)], OPTS), /hot/);
});

function raw(pair: number, algo: string, queries: number, o: Partial<QueryRaw> = {}): QueryRaw {
  return { pair, userId: `u${pair}`, asOfUnix: 1787448171, algo, status: 200, postsOnPage: 10, queries, ...o };
}

test("summarizeQueries: the known mean, min and max of each algo", () => {
  const rows = summarizeQueries([
    raw(1, "chrono", 20),
    raw(2, "chrono", 17),
    raw(3, "chrono", 21),
    raw(1, "engagement", 20),
    raw(2, "engagement", 20),
    raw(3, "engagement", 20),
    raw(1, "social", 19),
    raw(2, "social", 21),
    raw(3, "social", 20),
    raw(4, "social", 20),
  ]);
  assert.deepEqual(rows, [
    { algo: "chrono", requests: 3, mean: 58 / 3, min: 17, max: 21 },
    { algo: "engagement", requests: 3, mean: 20, min: 20, max: 20 },
    { algo: "social", requests: 4, mean: 20, min: 19, max: 21 },
  ]);
});

test("summarizeQueries: a response that is not 200 throws", () => {
  assert.throws(() => summarizeQueries([raw(1, "chrono", 20), raw(2, "chrono", 0, { status: 429 })]), /429/);
});

test("summarizeQueries: a missing algo or an unknown algo throws", () => {
  assert.throws(() => summarizeQueries([raw(1, "chrono", 20), raw(1, "engagement", 20)]), /social/);
  assert.throws(() => summarizeQueries([raw(1, "hot", 20)]), /hot/);
});
