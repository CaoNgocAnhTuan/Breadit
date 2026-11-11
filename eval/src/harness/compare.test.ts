import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DENSITY_HEADER, compareRows, densityRows, verdictLines, writeCompareRows, writeDensity } from "./compare.ts";
import type { RunConfig } from "./config.ts";
import type { DatasetRun, PerUserRow, RunResult } from "./run.ts";
import { applyHolm, compareRow, h0Gate, h1Verdict, pairedDifferences, writeCompare } from "../stats.ts";
import type { CompareRow, StatOpts } from "../stats.ts";
import { bucketOf } from "../checks/buckets.ts";
import { tempDir } from "../checks/fixture.ts";
import { loadFrozen } from "../frozen.ts";
import { f6, ndcgAt } from "../metrics.ts";

// TC6 (design DW3 to DW6, F6, F7): compare.csv rows, density rows and the verdict lines, on hand-made per-user rows.
const frozen = loadFrozen();
const KS = frozen.k;
// Few resamples and permutations: the tests check which rows exist and how they are wired, not the size of the intervals.
const OPTS: StatOpts = { masterSeed: frozen.masterSeed, resamples: 200, permutations: 200, level: frozen.confidenceLevel, holmLevel: frozen.holmLevel };

const F1_GROUPS = ["0", "1-4", "0-4", "5-19", "20+"];
const F2_GROUPS = ["0-4", "5-19", "20+", "all"];
const F2_BASELINES = ["BL0", "BL1", "BL2t", "BL3", "BL4", "BL5", "BL6"];
const NINE = ["BL0", "BL1", "BL2", "BL2t", "BL3", "BL4", "BL5", "BL6", "H"];

type RankOf = (method: string, i: number, bucket: string) => number;

/** A DatasetRun with `perBucket[bucket]` users in each bucket (user ids 1, 2, ... in bucket order) and a rank for each (method, user). */
function fake(dataset: string, perBucket: Record<string, number>, methods: readonly string[], rankOf: RankOf, nFollowees: (i: number) => number = (i) => i % 25): DatasetRun {
  const perUser: PerUserRow[] = [];
  let i = 0;
  for (const bucket of ["0", "1-4", "5-19", "20+"]) {
    for (let j = 0; j < (perBucket[bucket] ?? 0); j++) {
      i++;
      for (const method of methods) {
        perUser.push({ dataset, split: "test", method, userId: i, bucket, nHistory: bucket === "0" ? 0 : 3, nFollowees: nFollowees(i), testPostId: 1000 + i, rank: rankOf(method, i, bucket) });
      }
    }
  }
  return { dataset, split: "test", T: 1, perUser, summary: [], coverage: [], leftOut: [] };
}

/** H is always first, every other method is far down: H beats all of them for every user. */
const H_WINS: RankOf = (m, i) => (m === "H" ? 1 : 2 + (i % 5));
/** H and BL2 give the same rank for every user, the other methods are worse. */
const H_TIES: RankOf = (m, i) => (m === "H" || m === "BL2" ? 1 + (i % 4) : 8);

const FIVE = { "0": 5, "1-4": 5, "5-19": 5, "20+": 5 };

function famCfg(datasets: string[]): RunConfig {
  return {
    datasets,
    split: "test",
    testApprovedBy: "author",
    methods: NINE,
    params: { BL2t: { ageWeight: 1 }, BL4: { divisor: 1 }, BL5: { gravity: 1 }, BL6: { alpha: 1 }, H: { alpha: 1, beta: 1, m: 5 } },
    pool: "normal",
    mode: "fast",
    compare: { mode: "families", ref: "BL2" },
  };
}

function byString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function key(r: CompareRow): string {
  return `${r.dataset}|${r.family}|${r.method}|${r.ref}|${r.k}|${r.bucket}`;
}

test("families: 15 F1 and 84 F2 rows for each dataset, every one with p_raw and p_holm, and nothing else", () => {
  const result: RunResult = {
    datasets: [fake("syn-W2M-M", FIVE, NINE, H_WINS), fake("digg2009", FIVE, NINE, H_WINS)],
    inputs: {},
  };
  const rows = compareRows(result, famCfg(["syn-W2M-M", "digg2009"]), OPTS);
  assert.equal(rows.length, 2 * (15 + 84));
  for (const dataset of ["syn-W2M-M", "digg2009"]) {
    const mine = rows.filter((r) => r.dataset === dataset);
    const f1 = mine.filter((r) => r.family === "F1");
    const f2 = mine.filter((r) => r.family === "F2");
    assert.equal(f1.length, 15);
    assert.equal(f2.length, 84);
    assert.deepEqual(
      f1.map(key).sort(byString),
      KS.flatMap((k) => F1_GROUPS.map((g) => `${dataset}|F1|H|BL2|${k}|${g}`)).sort(byString),
    );
    assert.deepEqual(
      f2.map(key).sort(byString),
      F2_BASELINES.flatMap((b) => KS.flatMap((k) => F2_GROUPS.map((g) => `${dataset}|F2|H|${b}|${k}|${g}`))).sort(byString),
    );
    for (const r of mine) {
      assert.ok(r.pRaw !== null && r.pHolm !== null, key(r));
      assert.ok((r.pHolm as number) >= (r.pRaw as number) && (r.pHolm as number) <= 1, key(r));
      assert.ok(r.n >= 1);
    }
  }
  // n is the number of users of the group: 5 per bucket, 10 for 0-4, 20 for all
  const n = (g: string): number => (rows.find((r) => r.dataset === "digg2009" && r.family === "F2" && r.ref === "BL0" && r.k === 10 && r.bucket === g) as CompareRow).n;
  assert.deepEqual([n("0-4"), n("5-19"), n("20+"), n("all")], [10, 5, 5, 20]);
});

test("families: each row is compareRow on the paired NDCG@K differences, and Holm is applied within (dataset, family)", () => {
  const result: RunResult = {
    datasets: [fake("syn-W2M-M", FIVE, NINE, (m, i) => (m === "H" ? 1 + (i % 3) : 1 + ((i * 7 + m.length) % 9))), fake("digg2009", FIVE, NINE, H_TIES)],
    inputs: {},
  };
  const rows = compareRows(result, famCfg(["syn-W2M-M", "digg2009"]), OPTS);
  // By hand for one row: F1, H - BL2, K 10, group 0-4 on syn-W2M-M
  const run = result.datasets[0] as DatasetRun;
  const ndcg = (method: string): Map<number, number> =>
    new Map(run.perUser.filter((r) => r.method === method && (r.bucket === "0" || r.bucket === "1-4")).map((r) => [r.userId, ndcgAt(r.rank, 10)]));
  const d = pairedDifferences(ndcg("H"), ndcg("BL2"));
  const one = compareRow({ dataset: "syn-W2M-M", family: "F1", method: "H", ref: "BL2", k: 10, bucket: "0-4" }, d, OPTS);
  const got = rows.find((r) => key(r) === "syn-W2M-M|F1|H|BL2|10|0-4") as CompareRow;
  assert.equal(got.n, 10);
  assert.equal(got.meanDiff, one.meanDiff);
  assert.equal(got.ciLow, one.ciLow);
  assert.equal(got.ciHigh, one.ciHigh);
  assert.equal(got.pRaw, one.pRaw);
  // Holm per (dataset, family): the same as applyHolm on the raw rows of that dataset and family alone
  const raw = rows.map((r) => ({ ...r, pHolm: null }));
  for (const dataset of ["syn-W2M-M", "digg2009"]) {
    for (const family of ["F1", "F2"]) {
      const alone = applyHolm(raw.filter((r) => r.dataset === dataset && r.family === family));
      assert.deepEqual(alone.map((r) => r.pHolm), rows.filter((r) => r.dataset === dataset && r.family === family).map((r) => r.pHolm), `${dataset} ${family}`);
    }
  }
  // the numbers of a dataset do not depend on the other dataset in the run
  const only = compareRows({ datasets: [result.datasets[1] as DatasetRun], inputs: {} }, famCfg(["digg2009"]), OPTS);
  assert.deepEqual(only, rows.filter((r) => r.dataset === "digg2009"));
});

test("families: a family row with no user stops the run and names the row (F6)", () => {
  const noTwenty = { "0": 5, "1-4": 5, "5-19": 5, "20+": 0 };
  const result: RunResult = { datasets: [fake("syn-W2M-M", noTwenty, NINE, H_WINS)], inputs: {} };
  assert.throws(() => compareRows(result, famCfg(["syn-W2M-M"]), OPTS), (e: Error) => /syn-W2M-M/.test(e.message) && /F1/.test(e.message) && /20\+/.test(e.message));
});

test("families: a method of the config with no per-user row stops the run", () => {
  const result: RunResult = { datasets: [fake("syn-W2M-M", FIVE, NINE.filter((m) => m !== "BL6"), H_WINS)], inputs: {} };
  assert.throws(() => compareRows(result, famCfg(["syn-W2M-M"]), OPTS), /BL6/);
});

function noneCfg(datasets: string[], methods: string[], ref = "BL2"): RunConfig {
  return { datasets, split: "test", testApprovedBy: "author", methods, params: { H: { alpha: 1, beta: 1, m: 5 } }, pool: "normal", mode: "fast", compare: { mode: "none", ref } };
}

test("none: every method but the reference, for each K and each group, with no p-value; a group with no user has n 0 and empty numbers", () => {
  const noTwenty = { "0": 4, "1-4": 3, "5-19": 2, "20+": 0 };
  const methods = ["BL2", "H", "H-follow"];
  const result: RunResult = { datasets: [fake("syn-W0-M", noTwenty, methods, (m, i) => (m === "BL2" ? 3 : 1 + (i % 2)))], inputs: {} };
  const rows = compareRows(result, { ...noneCfg(["syn-W0-M"], methods), params: { H: { alpha: 1, beta: 1, m: 5 }, "H-follow": { alpha: 1, m: 5 } } }, OPTS);
  const groups = ["0", "1-4", "0-4", "5-19", "20+", "all"];
  assert.equal(rows.length, 2 * KS.length * groups.length);
  assert.deepEqual(
    rows.map(key).sort(byString),
    ["H", "H-follow"].flatMap((m) => KS.flatMap((k) => groups.map((g) => `syn-W0-M|none|${m}|BL2|${k}|${g}`))).sort(byString),
  );
  for (const r of rows) {
    assert.equal(r.pRaw, null, key(r));
    assert.equal(r.pHolm, null, key(r));
  }
  const empty = rows.filter((r) => r.bucket === "20+");
  assert.equal(empty.length, 2 * KS.length);
  for (const r of empty) {
    assert.equal(r.n, 0);
    assert.ok(Number.isNaN(r.meanDiff) && Number.isNaN(r.ciLow) && Number.isNaN(r.ciHigh), key(r));
  }
  for (const r of rows.filter((x) => x.bucket !== "20+")) {
    assert.ok(r.n >= 1 && Number.isFinite(r.meanDiff) && Number.isFinite(r.ciLow) && Number.isFinite(r.ciHigh), key(r));
  }
});

test("writeCompareRows: the bytes of writeCompare when every row has users, and empty number cells when n is 0", () => {
  const methods = ["BL2", "H"];
  const full: RunResult = { datasets: [fake("syn-W0-M", FIVE, methods, (m, i) => (m === "BL2" ? 3 : 1 + (i % 2)))], inputs: {} };
  const rows = compareRows(full, noneCfg(["syn-W0-M"], methods), OPTS);
  const a = tempDir();
  const b = tempDir();
  const ea = writeCompareRows(a, rows);
  const eb = writeCompare(b, rows);
  assert.equal(readFileSync(join(a, "compare.csv"), "utf8"), readFileSync(join(b, "compare.csv"), "utf8"));
  assert.deepEqual(ea, eb);
  const part: RunResult = { datasets: [fake("syn-W0-M", { ...FIVE, "20+": 0 }, methods, (m) => (m === "BL2" ? 3 : 1))], inputs: {} };
  const dir = tempDir();
  writeCompareRows(dir, compareRows(part, noneCfg(["syn-W0-M"], methods), OPTS));
  const lines = readFileSync(join(dir, "compare.csv"), "utf8").trimEnd().split("\n");
  assert.equal(lines[0], "dataset,family,method,ref,k,bucket,n,mean_diff,ci_low,ci_high,p_raw,p_holm");
  const row20 = lines.filter((l) => l.split(",")[5] === "20+");
  assert.equal(row20.length, KS.length);
  for (const l of row20) assert.match(l, /^syn-W0-M,none,H,BL2,\d+,20\+,0,,,,,$/);
  assert.ok(lines.filter((l) => l.split(",")[5] === "all").every((l) => /^syn-W0-M,none,H,BL2,\d+,all,15,-?\d\.\d{6},-?\d\.\d{6},-?\d\.\d{6},,$/.test(l)));
});

test("densityRows: bins by bucketOf(n_followees), n sums to the kept users, an empty bin has n 0 and empty numbers", () => {
  // n_followees: users 1..8 have 0, 2, 3, 7, 9, 21, 30, 4 followees. Bins: 0, 1-4, 5-19, 20+ (bucketOf of the number of followees).
  const nf = [0, 2, 3, 7, 9, 21, 30, 4];
  const run = fake("syn-W2M-M", { "0": 4, "1-4": 4 }, ["BL2", "H"], (m, i) => (m === "BL2" ? 4 : 1 + (i % 2)), (i) => nf[i - 1] as number);
  const rows = densityRows(run, "BL2", OPTS);
  assert.deepEqual(rows.map((r) => r.bin), ["0", "1-4", "5-19", "20+"]);
  assert.deepEqual(rows.map((r) => r.n), [1, 3, 2, 2]);
  assert.equal(rows.reduce((s, r) => s + r.n, 0), 8);
  for (const r of rows) assert.deepEqual([r.dataset, r.method, r.ref], ["syn-W2M-M", "H", "BL2"]);
  // by hand: bin 1-4 holds users 2, 3 and 8; H ranks 1 + (i % 2), BL2 ranks 4 (NDCG@10)
  const d = [2, 3, 8].map((i) => ndcgAt(1 + (i % 2), 10) - ndcgAt(4, 10));
  const mean = d.reduce((s, x) => s + x, 0) / d.length;
  assert.equal((rows[1] as { meanDiff: number }).meanDiff, mean);
  assert.equal(bucketOf(0), "0");
  // an empty bin
  const sparse = fake("digg2009", { "0": 3 }, ["BL2", "H"], (m) => (m === "BL2" ? 4 : 1), () => 2);
  const sp = densityRows(sparse, "BL2", OPTS);
  assert.deepEqual(sp.map((r) => r.n), [0, 3, 0, 0]);
  for (const r of sp.filter((x) => x.n === 0)) assert.ok(Number.isNaN(r.meanDiff) && Number.isNaN(r.ciLow) && Number.isNaN(r.ciHigh));
  assert.ok(Number.isFinite((sp[1] as { meanDiff: number }).meanDiff));
});

test("writeDensity: the columns of blueprint 2.7, 6 decimals, empty numbers for an empty bin, rows by dataset and bin order", () => {
  const a = densityRows(fake("syn-W2M-M", { "0": 4, "1-4": 4 }, ["BL2", "H"], (m, i) => (m === "BL2" ? 4 : 1 + (i % 2)), (i) => [0, 2, 3, 7, 9, 21, 30, 4][i - 1] as number), "BL2", OPTS);
  const b = densityRows(fake("digg2009", { "0": 3 }, ["BL2", "H"], (m) => (m === "BL2" ? 4 : 1), () => 2), "BL2", OPTS);
  const dir = tempDir();
  const entry = writeDensity(dir, [...a, ...b]);
  const text = readFileSync(join(dir, "density.csv"), "utf8");
  const lines = text.trimEnd().split("\n");
  assert.equal(lines[0], "dataset,density_bin,method,ref,n,mean_diff,ci_low,ci_high");
  assert.deepEqual([...DENSITY_HEADER], lines[0]?.split(","));
  assert.equal(entry.rows, 8);
  assert.deepEqual(lines.slice(1).map((l) => l.split(",").slice(0, 2).join(",")), ["digg2009,0", "digg2009,1-4", "digg2009,5-19", "digg2009,20+", "syn-W2M-M,0", "syn-W2M-M,1-4", "syn-W2M-M,5-19", "syn-W2M-M,20+"]);
  assert.equal(lines[1], "digg2009,0,H,BL2,0,,,");
  assert.match(lines[2] as string, /^digg2009,1-4,H,BL2,3,-?\d\.\d{6},-?\d\.\d{6},-?\d\.\d{6}$/);
  assert.equal(entry.sha256.length, 64);
  // the same rows in another order give the same bytes
  const dir2 = tempDir();
  writeDensity(dir2, [...b, ...a].reverse());
  assert.equal(readFileSync(join(dir2, "density.csv"), "utf8"), text);
  assert.equal(f6(-0.0000001), "0.000000");
});

test("verdictLines: an H1 line for each dataset by h1Verdict, the H0 gate line by h0Gate, and gateFailed matches", () => {
  const result: RunResult = { datasets: [fake("syn-W2M-M", { "0": 20, "1-4": 20, "5-19": 20, "20+": 20 }, NINE, H_WINS), fake("digg2009", { "0": 20, "1-4": 20, "5-19": 20, "20+": 20 }, NINE, H_TIES)], inputs: {} };
  const cfg = famCfg(["syn-W2M-M", "digg2009"]);
  // 15 rows in F1: with p_raw 1 / (P + 1), Holm needs P above 15 / 0.05 to pass
  const rows = compareRows(result, cfg, { ...OPTS, permutations: 2000 });
  const v = verdictLines(rows, cfg);
  assert.equal(v.gateFailed, false);
  assert.equal(v.lines.length, 2);
  const synV = h1Verdict(rows.filter((r) => r.dataset === "syn-W2M-M"));
  const diggV = h1Verdict(rows.filter((r) => r.dataset === "digg2009"));
  assert.equal(synV.pass, true);
  assert.equal(diggV.pass, false);
  assert.equal(v.lines[0], `H1 syn-W2M-M: pass  p_holm ${f6(synV.row.pHolm as number)}  ci_low ${f6(synV.row.ciLow)}`);
  assert.equal(v.lines[1], `H1 digg2009: fail  p_holm ${f6(diggV.row.pHolm as number)}  ci_low ${f6(diggV.row.ciLow)}`);
  // no compare mode families and no gate: no line
  assert.deepEqual(verdictLines(rows, { ...cfg, compare: { mode: "none", ref: "BL2" } }), { lines: [], gateFailed: false });
});

test("verdictLines: the H0 gate passes when H is not above BL2 and fails when its interval lies above 0", () => {
  const methods = ["BL2", "H"];
  const cfg: RunConfig = { ...noneCfg(["syn-W0-M"], methods), h0Gate: true };
  // H equals BL2 everywhere: the interval is [0, 0], the gate passes
  const same = compareRows({ datasets: [fake("syn-W0-M", FIVE, methods, () => 3)], inputs: {} }, cfg, OPTS);
  const pass = verdictLines(same, cfg);
  const g1 = h0Gate(same);
  assert.equal(g1.pass, true);
  assert.deepEqual(pass, { lines: [`H0 gate: pass  ci_low ${f6(g1.row.ciLow)}`], gateFailed: false });
  // H is first for every user and BL2 is far down: the interval lies above 0, the gate fails
  const better = compareRows({ datasets: [fake("syn-W0-M", FIVE, methods, (m) => (m === "H" ? 1 : 9))], inputs: {} }, cfg, OPTS);
  const g2 = h0Gate(better);
  assert.equal(g2.pass, false);
  assert.deepEqual(verdictLines(better, cfg), { lines: [`H0 gate: fail  ci_low ${f6(g2.row.ciLow)}`], gateFailed: true });
  // no user at all for the gate row: an error, not a silent fail
  const none = compareRows({ datasets: [fake("syn-W0-M", {}, methods, () => 3)], inputs: {} }, cfg, OPTS);
  assert.throws(() => verdictLines(none, cfg), /gate/);
});
