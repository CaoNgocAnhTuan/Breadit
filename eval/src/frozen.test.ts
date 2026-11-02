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

test("checkNode accepts the pinned version and rejects another", () => {
  const pinned = readFileSync(new URL("../../.nvmrc", import.meta.url), "utf8").trim();
  assert.doesNotThrow(() => checkNode(pinned));
  assert.throws(() => checkNode("v22.14.0"), /v22\.14\.0/);
  assert.throws(() => checkNode("v23.0.0"), /\.nvmrc/);
});
