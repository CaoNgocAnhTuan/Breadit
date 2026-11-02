import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gridFor, pickBest, tuneConfig, tuneDataset, tuningText, writeTuning } from "./tuning.ts";
import type { TuningRow } from "./tuning.ts";
import { runDataset } from "./run.ts";
import { fixedVariants } from "./config.ts";
import type { RunConfig } from "./config.ts";
import { positiveEvents } from "./index-data.ts";
import { loadDataset } from "../canonical/dataset.ts";
import { tempDir } from "../checks/fixture.ts";
import { loadFrozen } from "../frozen.ts";

// TC7: the grids come from frozen-v1.json, the choice is by NDCG@10 on the validation items, ties go to the smaller value
// (for H to the smaller (alpha, beta), alpha first).
const frozen = loadFrozen();
const GOLDEN = new URL("./fixtures/golden", import.meta.url).pathname;
const golden = loadDataset(GOLDEN);
const GOLDEN_T = 673200;

const CONFIG: RunConfig = {
  datasets: ["golden"],
  split: "validation",
  methods: ["BL2", "BL2t", "BL4", "BL5", "BL6", "H", "H-follow", "H-comm"],
  params: {
    BL2t: { ageWeight: "grid" },
    BL4: { divisor: "grid" },
    BL5: { gravity: "grid" },
    BL6: { alpha: "grid" },
    H: { alpha: "grid", beta: "grid", m: "frozen" },
    "H-follow": { alpha: "grid", m: "frozen" },
    "H-comm": { beta: "grid", m: "frozen" },
  },
  pool: "normal",
  mode: "fast",
};

test("the grids are the frozen ones: three baseline grids, and the alpha/beta grid for alpha and beta", () => {
  assert.deepEqual(gridFor("BL2t", "ageWeight"), frozen.baselineGrids.BL2t);
  assert.deepEqual(gridFor("BL4", "divisor"), frozen.baselineGrids.BL4);
  assert.deepEqual(gridFor("BL5", "gravity"), frozen.baselineGrids.BL5);
  assert.deepEqual(gridFor("BL6", "alpha"), frozen.alphaBetaGrid);
  assert.deepEqual(gridFor("H", "alpha"), frozen.alphaBetaGrid);
  assert.deepEqual(gridFor("H", "beta"), frozen.alphaBetaGrid);
  assert.throws(() => gridFor("H", "m"), /m/);
  assert.throws(() => gridFor("BL4", "gravity"), /gravity/);
});

test("pickBest takes the highest NDCG@10 and breaks ties toward the smaller tuple, first element first", () => {
  assert.equal(pickBest([{ tuple: [1], ndcg: 0.5 }, { tuple: [2], ndcg: 0.7 }, { tuple: [4], ndcg: 0.6 }]), 1);
  // A tie goes to the smaller value, whatever the order of the input.
  assert.equal(pickBest([{ tuple: [4], ndcg: 0.7 }, { tuple: [1], ndcg: 0.7 }, { tuple: [2], ndcg: 0.7 }]), 1);
  // (alpha, beta): compare alpha first, then beta.
  assert.equal(
    pickBest([
      { tuple: [2, 0], ndcg: 0.4 },
      { tuple: [1, 8], ndcg: 0.4 },
      { tuple: [1, 4], ndcg: 0.4 },
      { tuple: [4, 0], ndcg: 0.3 },
    ]),
    2,
  );
  assert.throws(() => pickBest([]));
});

function best(rows: TuningRow[], method: string): TuningRow[] {
  return rows.filter((r) => r.method === method && r.chosen);
}

test("tuneDataset on golden: one row per grid point, the rows equal separate fixed runs, one chosen per method", () => {
  const out = tuneDataset("golden", golden, CONFIG, { expectedT: GOLDEN_T });
  const counts: Record<string, number> = {};
  for (const r of out.rows) counts[r.method] = (counts[r.method] ?? 0) + 1;
  assert.deepEqual(counts, { BL2t: 5, BL4: 5, BL5: 5, BL6: 6, H: 36, "H-follow": 6, "H-comm": 6 });
  // Each row equals the NDCG@10 of a separate run with that value fixed.
  const ndcg10 = (m: string, params: Record<string, number>): string => {
    const cfg: RunConfig = { ...CONFIG, methods: [m], params: { [m]: params } };
    const run = runDataset("golden", golden, { split: "validation", variants: fixedVariants(cfg), pool: "normal", mode: "fast" }, { expectedT: GOLDEN_T });
    return (run.summary.find((s) => s.k === 10 && s.bucket === "all") as { ndcg: string }).ndcg;
  };
  for (const r of out.rows) {
    const params: Record<string, number> = {};
    r.param.split("/").forEach((p, i) => {
      params[p] = Number(r.value.split("/")[i]);
    });
    if (r.method === "H" || r.method === "H-follow" || r.method === "H-comm") params.m = frozen.priorStrength;
    assert.equal(r.valNdcg10, ndcg10(r.method, params), `${r.method} ${r.param} ${r.value}`);
  }
  for (const m of ["BL2t", "BL4", "BL5", "BL6", "H", "H-follow", "H-comm"]) assert.equal(best(out.rows, m).length, 1, m);
  // The chosen row is the first row (smallest tuple) with the largest NDCG@10.
  for (const m of ["BL2t", "BL4", "BL5", "BL6", "H", "H-follow", "H-comm"]) {
    const rows = out.rows.filter((r) => r.method === m);
    const top = Math.max(...rows.map((r) => Number(r.valNdcg10)));
    const first = rows.find((r) => Number(r.valNdcg10) === top) as TuningRow;
    assert.equal(best(out.rows, m)[0], first, m);
  }
  // The chosen params are returned as ready variants, with the fixed methods unchanged.
  const v = new Map(out.variants.map((x) => [x.label, x]));
  assert.deepEqual([...v.keys()], CONFIG.methods);
  const h = best(out.rows, "H")[0] as TuningRow;
  const [a, b] = h.value.split("/").map(Number);
  assert.deepEqual(v.get("H")?.params, { alpha: a, beta: b, m: frozen.priorStrength });
  assert.deepEqual(v.get("BL2")?.params, {});
});

test("tuning uses the validation items only: deleting every event after T changes nothing", () => {
  const T = GOLDEN_T;
  const all = tuneDataset("golden", golden, CONFIG, { expectedT: T });
  const events = positiveEvents(golden);
  assert.ok(events.some((e) => e.t > T));
  const cut = {
    ...golden,
    interactions: golden.interactions.filter((e) => e.createdAt <= T),
    follows: golden.follows.filter((f) => f.createdAt <= T),
    memberships: golden.memberships.filter((m) => m.joinedAt <= T),
    posts: golden.posts.filter((p) => p.createdAt <= T),
  };
  const part = tuneDataset("golden", cut, CONFIG, { holdT: T });
  assert.deepEqual(part.rows, all.rows);
});

test("a test-split config is refused for tuning, and so is a config with nothing to tune", () => {
  assert.throws(() => tuneDataset("golden", golden, { ...CONFIG, split: "test", testApprovedBy: "author" }, { expectedT: GOLDEN_T }), /validation/);
  assert.throws(() => tuneDataset("golden", golden, { ...CONFIG, methods: ["BL2"], params: {} }, { expectedT: GOLDEN_T }), /grid/);
});

test("tuning.csv has the columns of blueprint 2.7 and a stable order", () => {
  const out = tuneDataset("golden", golden, { ...CONFIG, methods: ["BL4", "BL2t"], params: { BL2t: { ageWeight: "grid" }, BL4: { divisor: "grid" } } }, { expectedT: GOLDEN_T });
  const text = tuningText(out.rows);
  const lines = text.trimEnd().split("\n");
  assert.equal(lines[0], "dataset,method,param,value,val_ndcg10,chosen");
  assert.equal(lines.length, 11);
  // BL2t comes before BL4 (method order), values ascending inside a method.
  assert.deepEqual(
    lines.slice(1).map((l) => l.split(",").slice(1, 4).join(",")),
    ["BL2t,ageWeight,0.0625", "BL2t,ageWeight,0.125", "BL2t,ageWeight,0.25", "BL2t,ageWeight,0.5", "BL2t,ageWeight,1", "BL4,divisor,11250", "BL4,divisor,22500", "BL4,divisor,45000", "BL4,divisor,90000", "BL4,divisor,180000"],
  );
  for (const l of lines.slice(1)) assert.match(l.split(",")[4] as string, /^\d\.\d{6}$/);
  assert.equal(lines.slice(1).filter((l) => l.endsWith(",1")).length, 2);
  const dir = tempDir();
  const entry = writeTuning(dir, out.rows);
  assert.equal(entry.rows, 10);
  assert.equal(readFileSync(join(dir, "tuning.csv"), "utf8"), text);
});

test("tuneConfig tunes each dataset of a config and needs a recorded T for every one", () => {
  const dataDir = new URL("./fixtures/", import.meta.url).pathname;
  assert.throws(() => tuneConfig(CONFIG, { dataDir }), /cutTimes/);
  const out = tuneConfig(CONFIG, { dataDir, cutTimes: { golden: GOLDEN_T } });
  assert.deepEqual(out.rows, tuneDataset("golden", golden, CONFIG, { expectedT: GOLDEN_T }).rows);
  assert.deepEqual(Object.keys(out.variants), ["golden"]);
  assert.throws(() => tuneConfig({ ...CONFIG, split: "test", testApprovedBy: "author" }, { dataDir, cutTimes: { golden: GOLDEN_T } }), /validation/);
});
