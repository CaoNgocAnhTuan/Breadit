import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadFrozen, checkNode } from "./frozen.ts";

const superPlan = readFileSync(new URL("../../.docs/super-plan.md", import.meta.url), "utf8");

// Value cell of one row of the table in super-plan section 7.
function row(name: string): string {
  const start = superPlan.indexOf("## 7. Frozen values");
  assert.ok(start >= 0, "section 7 not found");
  const end = superPlan.indexOf("\n## 8.", start);
  const section = superPlan.slice(start, end);
  for (const line of section.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length >= 4 && cells[1] === name) return cells[2] as string;
  }
  throw new Error(`row "${name}" not found in super-plan section 7`);
}

function num(text: string): number {
  return Number(text.replace(/,/g, ""));
}

test("master seed equals super-plan section 7", () => {
  assert.equal(loadFrozen().masterSeed, num(row("Master seed")));
});

test("base epoch equals super-plan section 7 (ISO and integer seconds)", () => {
  const f = loadFrozen();
  const iso = row("Base epoch").split(",")[0] as string;
  assert.equal(f.baseEpoch.iso, iso);
  assert.equal(f.baseEpoch.seconds, Date.parse(iso) / 1000);
  assert.ok(Number.isInteger(f.baseEpoch.seconds));
});

test("dataset sizes equal super-plan section 7", () => {
  const f = loadFrozen();
  const cell = row("Dataset sizes");
  const m = /S\s+([\d,]+)\s+users,\s*([\d,]+)(k?)\s+posts\s*·\s*M\s+([\d,]+)\s+users,\s*([\d,]+)(k?)\s+posts/.exec(cell);
  assert.ok(m, `cannot read sizes from "${cell}"`);
  const posts = (v: string, k: string) => num(v) * (k === "k" ? 1000 : 1);
  assert.deepEqual(f.sizes.S, { users: num(m[1] as string), posts: posts(m[2] as string, m[3] as string) });
  assert.deepEqual(f.sizes.M, { users: num(m[4] as string), posts: posts(m[5] as string, m[6] as string) });
});

test("history buckets equal super-plan section 7", () => {
  const f = loadFrozen();
  const cell = row("History buckets");
  const parts = cell.split(",").map((p) => p.trim());
  assert.equal(parts.length, f.historyBuckets.length);
  parts.forEach((p, i) => {
    const b = f.historyBuckets[i]!;
    const nums = p.match(/\d+/g)!.map(Number);
    assert.equal(b.min, nums[0]);
    if (p.startsWith("≥")) assert.equal(b.max, null);
    else assert.equal(b.max, nums[nums.length - 1]);
  });
});

test("window W and pool cap N_max equal super-plan section 7", () => {
  const f = loadFrozen();
  const m = /(\d+)\s+days\s*\/\s*([\d,]+)/.exec(row("Window W / pool cap N_max"));
  assert.ok(m);
  assert.equal(f.windowDays, Number(m[1]));
  assert.equal(f.poolCap, num(m[2] as string));
});

// The P5 rows of section 7 (task p5-eval-harness, TC1).
const DATASET_IDS_S = ["syn-W0-S", "syn-W1-S", "syn-W2M-S"];
const DATASET_IDS_M = ["syn-W0-M", "syn-W1-M", "syn-W2L-M", "syn-W2M-M", "syn-W2H-M"];

// "11,250, 22,500": a comma followed by a space separates items, a comma inside a number is a thousands mark.
function numList(text: string): number[] {
  return text.trim().split(/,\s+/).map((x) => num(x.trim()));
}

test("cut times T equal super-plan section 7 for all nine datasets", () => {
  const f = loadFrozen();
  const cell = row("Cut time T");
  const s = /three S datasets (\d+)/.exec(cell);
  const m = /five M datasets (\d+)/.exec(cell);
  const d = /`digg2009` (\d+)/.exec(cell);
  assert.ok(s && m && d, `cannot read T from "${cell}"`);
  assert.deepEqual(Object.keys(f.cutTimes).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), [...DATASET_IDS_S, ...DATASET_IDS_M, "digg2009"].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  for (const id of DATASET_IDS_S) assert.equal(f.cutTimes[id], Number(s[1]), id);
  for (const id of DATASET_IDS_M) assert.equal(f.cutTimes[id], Number(m[1]), id);
  assert.equal(f.cutTimes.digg2009, Number(d[1]));
  assert.equal(f.cutQuantile, num((/`q` = ([\d.]+)/.exec(cell) as RegExpExecArray)[1] as string));
});

test("larger pool (W_L, N_L) equals super-plan section 7", () => {
  const m = /(\d+)\s+days\s*\/\s*([\d,]+)/.exec(row("Larger pool (W_L, N_L) for E8"));
  assert.ok(m);
  assert.deepEqual(loadFrozen().poolLarge, { windowDays: Number(m[1]), poolCap: num(m[2] as string) });
});

test("baseline grids equal super-plan section 7", () => {
  const g = loadFrozen().baselineGrids;
  const cell = row("Baseline grids");
  const bl2t = /BL2t age weight ([\d., ]+?) per hour/.exec(cell);
  const bl4 = /BL4 time divisor ([\d., ]+?) s/.exec(cell);
  const bl5 = /BL5 gravity ([\d., ]+?) \(/.exec(cell);
  assert.ok(bl2t && bl4 && bl5, `cannot read grids from "${cell}"`);
  assert.deepEqual(g.BL2t, numList(bl2t[1] as string));
  assert.deepEqual(g.BL4, numList(bl4[1] as string));
  assert.deepEqual(g.BL5, numList(bl5[1] as string));
  // Each grid holds the published or production value (super-plan section 5).
  assert.ok(g.BL2t.includes(0.25));
  assert.ok(g.BL4.includes(45000));
  assert.ok(g.BL5.includes(1.8));
});

test("K, m, alpha/beta grid, resamples and levels equal super-plan section 7", () => {
  const f = loadFrozen();
  assert.deepEqual(f.k, numList(row("K")));
  assert.equal(f.priorStrength, num((/^(\d+)/.exec(row("Prior strength `m`")) as RegExpExecArray)[1] as string));
  assert.deepEqual(f.alphaBetaGrid, numList((/^([\d, ]+?)\s*\(/.exec(row("α, β grid")) as RegExpExecArray)[1] as string));
  const r = /([\d,]+)\s*\/\s*([\d,]+)/.exec(row("Bootstrap resamples / permutations"));
  assert.ok(r);
  assert.equal(f.bootstrapResamples, num(r[1] as string));
  assert.equal(f.permutations, num(r[2] as string));
  const l = /(\d+)%\s*\/\s*([\d.]+)/.exec(row("Confidence level / Holm level"));
  assert.ok(l);
  assert.equal(f.confidenceLevel, Number(l[1]) / 100);
  assert.equal(f.holmLevel, Number(l[2]));
});

test("checkNode accepts the pinned version and rejects another", () => {
  const pinned = readFileSync(new URL("../../.nvmrc", import.meta.url), "utf8").trim();
  assert.doesNotThrow(() => checkNode(pinned));
  assert.throws(() => checkNode("v22.14.0"), /v22\.14\.0/);
  assert.throws(() => checkNode("v23.0.0"), /\.nvmrc/);
});
