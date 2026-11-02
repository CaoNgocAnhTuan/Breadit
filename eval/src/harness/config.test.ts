import { test } from "node:test";
import assert from "node:assert/strict";
import { fixedVariants, parseRunConfig, validateConfig } from "./config.ts";
import type { RunConfig } from "./config.ts";
import { loadFrozen } from "../frozen.ts";

// TC10 (design F6, F10): a bad run config stops before any data is loaded.
function base(over: Partial<RunConfig> = {}): RunConfig {
  return {
    datasets: ["syn-W0-S"],
    split: "validation",
    methods: ["BL2", "BL4", "H"],
    params: { BL4: { divisor: 45000 }, H: { alpha: 1, beta: 1, m: "frozen" } },
    pool: "normal",
    mode: "fast",
    ...over,
  };
}

test("a valid config passes, and fixed params become variants with m from the frozen values", () => {
  validateConfig(base());
  const v = fixedVariants(base());
  assert.deepEqual(
    v.map((x) => x.label),
    ["BL2", "BL4", "H"],
  );
  assert.deepEqual(v[1]?.params, { divisor: 45000 });
  assert.deepEqual(v[2]?.params, { alpha: 1, beta: 1, m: loadFrozen().priorStrength });
});

test("split test without testApprovedBy stops (design F6)", () => {
  assert.throws(() => validateConfig(base({ split: "test" })), /testApprovedBy/);
  assert.throws(() => validateConfig(base({ split: "test", testApprovedBy: "" })), /testApprovedBy/);
  validateConfig(base({ split: "test", testApprovedBy: "author" }));
});

test("a missing param stops (design F10), and so does an extra one", () => {
  assert.throws(() => validateConfig(base({ params: { H: { alpha: 1, m: "frozen" } } })), /BL4.*divisor|H.*beta/);
  assert.throws(() => validateConfig(base({ params: { BL4: {}, H: { alpha: 1, beta: 1, m: 5 } } })), /BL4.*divisor/);
  assert.throws(() => validateConfig(base({ params: { BL4: { divisor: 45000, speed: 3 }, H: { alpha: 1, beta: 1, m: 5 } } })), /speed/);
  assert.throws(() => validateConfig(base({ methods: ["BL2"], params: { BL2: { x: 1 } } })), /BL2.*x/);
});

test("unknown methods, bad values and empty lists stop", () => {
  assert.throws(() => validateConfig(base({ methods: ["BL2", "BL9"] })), /BL9/);
  assert.throws(() => validateConfig(base({ methods: ["BL2", "BL2"] })), /twice/);
  assert.throws(() => validateConfig(base({ methods: [] })), /methods/);
  assert.throws(() => validateConfig(base({ datasets: [] })), /datasets/);
  assert.throws(() => validateConfig(base({ params: { BL4: { divisor: 0 }, H: { alpha: 1, beta: 1, m: 5 } } })), /divisor/);
  assert.throws(() => validateConfig(base({ params: { BL4: { divisor: Number.NaN }, H: { alpha: 1, beta: 1, m: 5 } } })), /divisor/);
  assert.throws(() => validateConfig(base({ params: { BL4: { divisor: 45000 }, H: { alpha: 1, beta: 1, m: "frozen" }, BL3: {} } })), /BL3/);
  assert.throws(() => validateConfig(base({ params: { BL4: { divisor: "frozen" }, H: { alpha: 1, beta: 1, m: 5 } } })), /frozen/);
});

test("grid is allowed for a tuned param only in a validation config, and fixedVariants refuses it", () => {
  const withGrid = base({ params: { BL4: { divisor: "grid" }, H: { alpha: "grid", beta: "grid", m: "frozen" } } });
  validateConfig(withGrid);
  assert.throws(() => fixedVariants(withGrid), /grid/);
  assert.throws(() => validateConfig({ ...withGrid, split: "test", testApprovedBy: "author" }), /grid/);
  assert.throws(() => validateConfig(base({ params: { BL4: { divisor: 45000 }, H: { alpha: 1, beta: 1, m: "grid" } } })), /m/);
});

test("pool and mode are checked", () => {
  assert.throws(() => validateConfig(base({ pool: "huge" as "normal" })), /pool/);
  assert.throws(() => validateConfig(base({ mode: "slow" as "fast" })), /mode/);
});

test("parseRunConfig reads JSON, defaults nothing silently, and rejects unknown keys", () => {
  const text = JSON.stringify(base());
  assert.deepEqual(parseRunConfig(text), base());
  assert.throws(() => parseRunConfig("{"), /JSON/);
  assert.throws(() => parseRunConfig(JSON.stringify({ ...base(), extra: 1 })), /extra/);
  const { mode: _mode, ...noMode } = base();
  assert.throws(() => parseRunConfig(JSON.stringify(noMode)), /mode/);
});
