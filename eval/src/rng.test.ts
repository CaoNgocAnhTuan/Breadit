import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { rng, STAGE_NAMES } from "./rng.ts";
import { loadFrozen } from "./frozen.ts";

const seed = loadFrozen().masterSeed;

function childValues(stage: string, count: number): number[] {
  const code = `
    import { rng } from ${JSON.stringify(new URL("./rng.ts", import.meta.url).href)};
    const r = rng(${seed}, ${JSON.stringify(stage)});
    const out = [];
    for (let i = 0; i < ${count}; i++) out.push(r.next());
    console.log(JSON.stringify(out));
  `;
  const text = execFileSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8" });
  return JSON.parse(text) as number[];
}

test("equal seed and stage give equal sequences in two child processes", () => {
  const a = childValues("users", 1000);
  const b = childValues("users", 1000);
  assert.equal(a.length, 1000);
  assert.deepEqual(a, b);
  const r = rng(seed, "users");
  const here = Array.from({ length: 1000 }, () => r.next());
  assert.deepEqual(a, here);
});

test("users and follows give different sequences", () => {
  const a = childValues("users", 1000);
  const b = childValues("follows", 1000);
  assert.notDeepEqual(a, b);
  assert.equal(a.filter((v, i) => v === b[i]).length < 3, true);
});

test("known-answer vector equals the Python sfc32 (sfc32_check.py, 20261014 users)", () => {
  const r = rng(seed, "users");
  const got = Array.from({ length: 8 }, () => r.next());
  assert.deepEqual(got, [1742472678, 538383103, 1893094604, 3594335267, 4147101037, 3989087089, 1423387505, 3389210833]);
  const f = rng(seed, "follows");
  assert.deepEqual([f.next(), f.next(), f.next(), f.next()], [4281462709, 1369990304, 1286157165, 1624582305]);
});

test("float() is in [0, 1)", () => {
  const r = rng(seed, "posts");
  for (let i = 0; i < 5000; i++) {
    const x = r.float();
    assert.ok(x >= 0 && x < 1);
  }
});

test("int(n) stays in [0, n) and rejects n <= 0 or a non-integer", () => {
  const r = rng(seed, "interactions");
  const seen = new Set<number>();
  for (let i = 0; i < 2000; i++) {
    const x = r.int(7);
    assert.ok(Number.isInteger(x) && x >= 0 && x < 7);
    seen.add(x);
  }
  assert.equal(seen.size, 7);
  assert.equal(r.int(1), 0);
  assert.throws(() => r.int(0));
  assert.throws(() => r.int(-3));
  assert.throws(() => r.int(2.5));
  assert.throws(() => r.int(Number.NaN));
});

test("int(n) has no obvious bias", () => {
  const r = rng(seed, "communities");
  const counts = [0, 0, 0];
  for (let i = 0; i < 30000; i++) counts[r.int(3)]!++;
  for (const c of counts) assert.ok(Math.abs(c - 10000) < 500, `count ${c}`);
});

test("a stage name outside blueprint section 2.4 is a runtime error", () => {
  assert.deepEqual([...STAGE_NAMES], [
    "users", "follows", "communities", "posts", "interactions", "bootstrap", "permutation", "parity", "shuffle",
  ]);
  // @ts-expect-error not a stage name
  assert.throws(() => rng(seed, "usres"), /stage/);
});
