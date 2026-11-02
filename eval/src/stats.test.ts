import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyHolm,
  compareRow,
  exactRandomizationTest,
  h0Gate,
  h1Verdict,
  holm,
  pairedBootstrap,
  pairedDifferences,
  randomizationTest,
  statOpts,
  writeCompare,
} from "./stats.ts";
import type { CompareRow } from "./stats.ts";
import { loadFrozen } from "./frozen.ts";
import { tempDir } from "./checks/fixture.ts";

const frozen = loadFrozen();
const opts = statOpts();

// The 14 paired values of eval/src/stats-fixture.csv, and the scipy reference made from them (Step 3).
function fixtureDiffs(): number[] {
  const text = readFileSync(new URL("./stats-fixture.csv", import.meta.url), "utf8");
  const lines = text.trim().split("\n");
  assert.equal(lines[0], "user_id,method,ref");
  return lines.slice(1).map((l) => {
    const [, m, r] = l.split(",");
    return Number(m) - Number(r);
  });
}

interface Reference {
  n: number;
  exact_p: number;
  ci_low: number;
  ci_high: number;
  mean_diff: number;
  versions: { python: string; numpy: string; scipy: string };
}
const reference = JSON.parse(
  readFileSync(new URL("../../.docs/works/2026-11-02-p5-eval-harness/stats_reference.json", import.meta.url), "utf8"),
) as Reference;

test("the fixture has 14 pairs, tied differences and at least one zero difference", () => {
  const d = fixtureDiffs();
  assert.equal(d.length, 14);
  assert.equal(reference.n, 14);
  assert.ok(d.includes(0));
  assert.ok(new Set(d).size < d.length);
});

// DW5: exact p equals scipy's exact permutation p to 1e-12.
test("exactRandomizationTest equals the scipy exact p to 1e-12", () => {
  const p = exactRandomizationTest(fixtureDiffs());
  assert.ok(Math.abs(p - reference.exact_p) <= 1e-12, `ours ${p}, scipy ${reference.exact_p}`);
});

test("randomizationTest is within 3 standard errors of the exact p", () => {
  const p = randomizationTest(fixtureDiffs(), opts);
  const se = Math.sqrt((reference.exact_p * (1 - reference.exact_p)) / frozen.permutations);
  assert.ok(Math.abs(p - reference.exact_p) <= 3 * se, `ours ${p}, exact ${reference.exact_p}, 3 se ${3 * se}`);
});

test("pairedBootstrap CI bounds are within 0.02 of scipy's, and the mean is exact", () => {
  const b = pairedBootstrap(fixtureDiffs(), opts);
  assert.ok(Math.abs(b.meanDiff - reference.mean_diff) <= 1e-12);
  assert.ok(Math.abs(b.ciLow - reference.ci_low) <= 0.02, `low: ours ${b.ciLow}, scipy ${reference.ci_low}`);
  assert.ok(Math.abs(b.ciHigh - reference.ci_high) <= 0.02, `high: ours ${b.ciHigh}, scipy ${reference.ci_high}`);
});

test("exactRandomizationTest on hand cases", () => {
  // d = [1, 2]: sums +-1 +-2 are 3, 1, -1, -3; |sum| >= 3 for two of four.
  assert.equal(exactRandomizationTest([1, 2]), 0.5);
  // d = [1, 1, 1]: only all-plus and all-minus reach |3|: 2 / 8.
  assert.equal(exactRandomizationTest([1, 1, 1]), 0.25);
  // Nothing to detect: every pattern ties with the observed value.
  assert.equal(exactRandomizationTest([0, 0, 0]), 1);
  assert.throws(() => exactRandomizationTest([]));
  assert.throws(() => exactRandomizationTest(new Array(31).fill(1)), /too many/);
});

test("randomizationTest and pairedBootstrap on degenerate input", () => {
  assert.equal(randomizationTest([0, 0, 0, 0], opts), 1); // (1 + P) / (P + 1)
  const b = pairedBootstrap([0.25, 0.25, 0.25], opts);
  assert.deepEqual(b, { meanDiff: 0.25, ciLow: 0.25, ciHigh: 0.25 });
  assert.throws(() => pairedBootstrap([], opts));
  assert.throws(() => randomizationTest([], opts));
});

test("two runs give identical numbers", () => {
  const d = fixtureDiffs();
  assert.deepEqual(pairedBootstrap(d, opts), pairedBootstrap(d, opts));
  assert.equal(randomizationTest(d, opts), randomizationTest(d, opts));
  assert.deepEqual(
    compareRow({ dataset: "d", family: "F1", method: "H", ref: "BL2", k: 10, bucket: "0-4" }, d, opts),
    compareRow({ dataset: "d", family: "F1", method: "H", ref: "BL2", k: 10, bucket: "0-4" }, d, opts),
  );
});

test("each comparison restarts its stream: B before or after A gives the same B", () => {
  const dA = fixtureDiffs();
  const dB = dA.map((x, i) => x * (i % 3 === 0 ? -1 : 1) + 0.0625);
  const specA = { dataset: "d", family: "F1", method: "H", ref: "BL2", k: 10, bucket: "0-4" };
  const specB = { dataset: "d", family: "F1", method: "H", ref: "BL2", k: 20, bucket: "all" };
  const first = [compareRow(specA, dA, opts), compareRow(specB, dB, opts)];
  const second = [compareRow(specB, dB, opts), compareRow(specA, dA, opts)];
  assert.deepEqual(first[0], second[1]);
  assert.deepEqual(first[1], second[0]);
});

// Holm (1979), a worked example by hand. Four p-values in the order 0.01, 0.04, 0.03, 0.005 (m = 4).
// Sorted: 0.005, 0.01, 0.03, 0.04. The step-down factors are m - j + 1 = 4, 3, 2, 1:
//   0.005 * 4 = 0.02, 0.01 * 3 = 0.03, 0.03 * 2 = 0.06, 0.04 * 1 = 0.04 -> after the running maximum: 0.02, 0.03, 0.06, 0.06.
// At level 0.05 the sequential test compares p_(j) with 0.05 / (m - j + 1) = 0.0125, 0.016667, 0.025, 0.05:
//   0.005 <= 0.0125 reject, 0.01 <= 0.016667 reject, 0.03 > 0.025 stop. So two rejections, the same as p_holm < 0.05.
test("holm equals the worked example of Holm (1979)", () => {
  const p = [0.01, 0.04, 0.03, 0.005];
  const adj = holm(p.map((x, i) => ({ key: `c${i}`, p: x })));
  const expected = [0.03, 0.06, 0.06, 0.02];
  adj.forEach((a, i) => assert.ok(Math.abs(a - (expected[i] as number)) <= 1e-12, `p ${p[i]}: ${a} vs ${expected[i]}`));
  assert.deepEqual(adj.map((a) => a < 0.05), [true, false, false, true]);
});

test("holm caps at 1, keeps the order of the adjusted values and breaks ties by key", () => {
  const adj = holm([
    { key: "a", p: 0.001 },
    { key: "b", p: 0.5 },
    { key: "c", p: 0.4 },
  ]);
  // sorted 0.001, 0.4, 0.5 -> 0.003, 0.8, 1 * 0.5 = 0.5 -> running max 0.8
  assert.ok(Math.abs((adj[0] as number) - 0.003) <= 1e-12);
  assert.ok(Math.abs((adj[1] as number) - 0.8) <= 1e-12);
  assert.ok(Math.abs((adj[2] as number) - 0.8) <= 1e-12);
  // capped at 1
  assert.deepEqual(holm([{ key: "a", p: 0.6 }, { key: "b", p: 0.9 }]), [1, 1]);
  // equal p: the order depends on the key, not on the input order
  const t1 = holm([{ key: "x", p: 0.1 }, { key: "y", p: 0.1 }, { key: "z", p: 0.2 }]);
  const t2 = holm([{ key: "z", p: 0.2 }, { key: "y", p: 0.1 }, { key: "x", p: 0.1 }]);
  assert.deepEqual([t1[0], t1[1], t1[2]], [t2[2], t2[1], t2[0]]);
  assert.deepEqual(holm([]), []);
});

function row(over: Partial<CompareRow>): CompareRow {
  return {
    dataset: "syn-W2M-M",
    family: "F1",
    method: "H",
    ref: "BL2",
    k: 10,
    bucket: "0-4",
    n: 100,
    meanDiff: 0.05,
    ciLow: 0.01,
    ciHigh: 0.09,
    pRaw: 0.001,
    pHolm: 0.01,
    ...over,
  };
}

// Blueprint section 3.4: H1 passes when, for the F1 row (NDCG@10, group 0-4), p_holm < Holm level and ci_low > 0.
test("h1Verdict needs both the Holm p below the level and the CI above 0", () => {
  assert.equal(h1Verdict([row({})]).pass, true);
  assert.equal(h1Verdict([row({ pHolm: 0.05 })]).pass, false); // not below
  assert.equal(h1Verdict([row({ pHolm: 0.049999 })]).pass, true);
  assert.equal(h1Verdict([row({ ciLow: 0 })]).pass, false); // not above 0
  assert.equal(h1Verdict([row({ ciLow: -0.01 })]).pass, false);
  // other rows do not matter, and the right row is found among them
  const others = [row({ k: 5, pHolm: 0.9 }), row({ bucket: "all", pHolm: 0.9 }), row({ family: "F2", pHolm: 0.9 }), row({ ref: "BL1", pHolm: 0.9 })];
  assert.equal(h1Verdict([...others, row({})]).pass, true);
  assert.throws(() => h1Verdict(others), /no row/);
  assert.throws(() => h1Verdict([row({ pHolm: null })]), /p_holm/);
  assert.throws(() => h1Verdict([row({}), row({})]), /more than one/);
});

// Blueprint section 3.5: on syn-W0-M, the CI of H - BL2 (NDCG@10, all users) must not lie above 0.
test("h0Gate passes when the CI does not lie above 0", () => {
  const w0 = (over: Partial<CompareRow>): CompareRow =>
    row({ dataset: "syn-W0-M", family: "none", bucket: "all", pRaw: null, pHolm: null, ...over });
  assert.equal(h0Gate([w0({ ciLow: -0.02, ciHigh: 0.02 })]).pass, true);
  assert.equal(h0Gate([w0({ ciLow: -0.05, ciHigh: -0.01 })]).pass, true);
  assert.equal(h0Gate([w0({ ciLow: 0, ciHigh: 0.03 })]).pass, true); // ci_low <= 0
  assert.equal(h0Gate([w0({ ciLow: 0.001, ciHigh: 0.03 })]).pass, false);
  assert.throws(() => h0Gate([row({})]), /no row/);
});

test("pairedDifferences subtracts in user_id order and rejects different user sets", () => {
  const a = new Map([[3, 0.5], [1, 1], [2, 0.25]]);
  const b = new Map([[2, 0.25], [3, 0.125], [1, 0.5]]);
  assert.deepEqual(pairedDifferences(a, b), [0.5, 0, 0.375]);
  assert.throws(() => pairedDifferences(a, new Map([[1, 1]])), /users/);
});

test("applyHolm corrects each family of each dataset on its own, and leaves the no-family rows alone", () => {
  const spec = (dataset: string, family: string, k: number) => ({ dataset, family, method: "H", ref: "BL2", k, bucket: "all" });
  const d1 = [0.5, 0.25, 0.375, 0.5, 0.125, 0.25, 0.5, 0.375];
  const d0 = [0, 0, 0.0625, 0, -0.0625, 0, 0, 0];
  const rows = [
    compareRow(spec("a", "F1", 5), d1, opts),
    compareRow(spec("a", "F1", 10), d0, opts),
    compareRow(spec("a", "F2", 5), d1, opts),
    compareRow(spec("b", "F1", 5), d1, opts),
    compareRow(spec("c", "none", 5), d1, opts),
  ];
  const out = applyHolm(rows);
  // F1 of dataset a has two rows (m = 2), F2 of a, F1 of b have one row each (m = 1).
  const pa5 = (rows[0] as CompareRow).pRaw as number;
  const pa10 = (rows[1] as CompareRow).pRaw as number;
  const lo = Math.min(pa5, pa10);
  const hi = Math.max(pa5, pa10);
  const adjLo = Math.min(1, 2 * lo);
  const adjHi = Math.max(adjLo, Math.min(1, hi));
  assert.equal((out[0] as CompareRow).pHolm, pa5 <= pa10 ? adjLo : adjHi);
  assert.equal((out[1] as CompareRow).pHolm, pa10 < pa5 ? adjLo : adjHi);
  assert.equal((out[2] as CompareRow).pHolm, (rows[2] as CompareRow).pRaw);
  assert.equal((out[3] as CompareRow).pHolm, (rows[3] as CompareRow).pRaw);
  // No family: bootstrap CI only, no p-value.
  assert.equal((out[4] as CompareRow).pRaw, null);
  assert.equal((out[4] as CompareRow).pHolm, null);
});

test("writeCompare writes the columns of blueprint 2.7, sorted, with 6 decimals", () => {
  const dir = tempDir();
  const rows: CompareRow[] = [
    row({ k: 20, bucket: "all", meanDiff: 1 / 3, ciLow: -0.0000001, ciHigh: 0.5, pRaw: 0.0001, pHolm: 0.0015 }),
    row({ k: 5, bucket: "5-19", family: "F1" }),
    row({ dataset: "syn-W0-M", family: "none", bucket: "all", pRaw: null, pHolm: null }),
    row({ k: 5, bucket: "0" }),
  ];
  const entry = writeCompare(dir, rows);
  assert.equal(entry.rows, 4);
  const text = readFileSync(join(dir, "compare.csv"), "utf8");
  assert.ok(text.endsWith("\n") && !text.includes("\r"));
  const lines = text.trimEnd().split("\n");
  assert.equal(lines[0], "dataset,family,method,ref,k,bucket,n,mean_diff,ci_low,ci_high,p_raw,p_holm");
  assert.deepEqual(lines.slice(1), [
    "syn-W0-M,none,H,BL2,10,all,100,0.050000,0.010000,0.090000,,",
    "syn-W2M-M,F1,H,BL2,5,0,100,0.050000,0.010000,0.090000,0.001000,0.010000",
    "syn-W2M-M,F1,H,BL2,5,5-19,100,0.050000,0.010000,0.090000,0.001000,0.010000",
    "syn-W2M-M,F1,H,BL2,20,all,100,0.333333,0.000000,0.500000,0.000100,0.001500",
  ]);
  assert.match(entry.sha256, /^[0-9a-f]{64}$/);
});
