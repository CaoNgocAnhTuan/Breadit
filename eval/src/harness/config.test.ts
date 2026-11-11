import { test } from "node:test";
import assert from "node:assert/strict";
import { fixedVariants, parseRunConfig, validateConfig, variantsFor } from "./config.ts";
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

// TC2 (design F13): the six keys of P7. A good value is accepted, a bad one is refused before any data is loaded.
const F2_BASELINES = ["BL0", "BL1", "BL2t", "BL3", "BL4", "BL5", "BL6"];
function nineMethods(): Partial<RunConfig> {
  return {
    datasets: ["syn-W2M-M", "digg2009"],
    methods: ["BL0", "BL1", "BL2", "BL2t", "BL3", "BL4", "BL5", "BL6", "H"],
    params: {
      BL2t: { ageWeight: 1 },
      BL4: { divisor: 45000 },
      BL5: { gravity: 1.8 },
      BL6: { alpha: 1 },
      H: { alpha: 1, beta: 1, m: "frozen" },
    },
    compare: { mode: "families", ref: "BL2" },
  };
}

test("datasetParams: a good value passes, and every bad one is refused", () => {
  validateConfig(base({ datasets: ["syn-W0-S", "syn-W1-S"], datasetParams: { "syn-W1-S": { H: { alpha: 0.5, beta: 2 }, BL4: { divisor: 9000 } } } }));
  const dp = (d: unknown): Partial<RunConfig> => ({ datasets: ["syn-W0-S", "syn-W1-S"], datasetParams: d as RunConfig["datasetParams"] });
  assert.throws(() => validateConfig(base(dp({ "syn-W2M-S": { H: { alpha: 1 } } }))), /syn-W2M-S/);
  assert.throws(() => validateConfig(base(dp({ "syn-W1-S": { BL5: { gravity: 2 } } }))), /BL5/);
  assert.throws(() => validateConfig(base(dp({ "syn-W1-S": { H: { speed: 2 } } }))), /speed/);
  assert.throws(() => validateConfig(base(dp({ "syn-W1-S": { H: { alpha: "x" } } }))), /alpha/);
  assert.throws(() => validateConfig(base(dp({ "syn-W1-S": { H: { alpha: Number.NaN } } }))), /alpha/);
  assert.throws(() => validateConfig(base(dp({ "syn-W1-S": { H: { alpha: "frozen" } } }))), /alpha/);
  assert.throws(() => validateConfig(base(dp({ "syn-W1-S": { BL4: { divisor: 0 } } }))), /divisor/);
  assert.throws(() => validateConfig(base(dp({ "syn-W1-S": { BL4: { divisor: -3 } } }))), /divisor/);
  assert.throws(() => validateConfig(base(dp(null))), /datasetParams/);
  assert.throws(() => validateConfig(base(dp([]))), /datasetParams/);
  // a config with a "grid" param cannot have datasetParams
  assert.throws(
    () => validateConfig(base({ params: { BL4: { divisor: "grid" }, H: { alpha: 1, beta: 1, m: "frozen" } }, datasetParams: { "syn-W0-S": { H: { alpha: 1 } } } })),
    /grid/,
  );
});

test("variantsFor replaces only the named params of the named dataset", () => {
  const cfg = base({
    datasets: ["syn-W0-S", "syn-W1-S"],
    datasetParams: { "syn-W1-S": { H: { alpha: 0.5 }, BL4: { divisor: 9000 } } },
  });
  validateConfig(cfg);
  const w1 = variantsFor(cfg, "syn-W1-S");
  assert.deepEqual(w1[1]?.params, { divisor: 9000 });
  assert.deepEqual(w1[2]?.params, { alpha: 0.5, beta: 1, m: loadFrozen().priorStrength });
  assert.deepEqual(w1.map((v) => v.label), ["BL2", "BL4", "H"]);
  // any other dataset, and a config with no datasetParams, give fixedVariants
  assert.deepEqual(variantsFor(cfg, "syn-W0-S"), fixedVariants({ ...cfg, datasetParams: undefined }));
  assert.deepEqual(variantsFor(base(), "syn-W0-S"), fixedVariants(base()));
  // the config itself is not changed
  assert.deepEqual(cfg.params.H, { alpha: 1, beta: 1, m: "frozen" });
  // a numeric m can replace "frozen"
  const m0 = base({ datasetParams: { "syn-W0-S": { H: { m: 0 } } } });
  assert.deepEqual(variantsFor(m0, "syn-W0-S")[2]?.params, { alpha: 1, beta: 1, m: 0 });
});

test("tieBreak, shuffle, density and h0Gate are checked", () => {
  validateConfig(base({ tieBreak: "id-asc" }));
  validateConfig(base({ tieBreak: "id-desc" }));
  assert.throws(() => validateConfig(base({ tieBreak: "x" as "id-asc" })), /tieBreak/);
  validateConfig(base({ shuffle: true }));
  validateConfig(base({ shuffle: false }));
  assert.throws(() => validateConfig(base({ shuffle: "yes" as unknown as boolean })), /shuffle/);
  assert.throws(() => validateConfig(base({ density: 1 as unknown as boolean })), /density/);
  assert.throws(() => validateConfig(base({ h0Gate: "true" as unknown as boolean })), /h0Gate/);
});

test("compare: mode and ref are checked, and families needs the nine methods on syn-W2M-M and digg2009", () => {
  validateConfig(base({ compare: { mode: "none", ref: "BL2" } }));
  validateConfig(base({ compare: { mode: "none", ref: "BL4" } }));
  assert.throws(() => validateConfig(base({ compare: { mode: "some" as "none", ref: "BL2" } })), /compare/);
  assert.throws(() => validateConfig(base({ compare: { mode: "none", ref: "BL0" } })), /BL0/);
  assert.throws(() => validateConfig(base({ compare: "none" as unknown as RunConfig["compare"] })), /compare/);
  assert.throws(() => validateConfig(base({ compare: { mode: "none", ref: "BL2", extra: 1 } as unknown as RunConfig["compare"] })), /extra/);
  validateConfig(base(nineMethods()));
  validateConfig(base({ ...nineMethods(), datasets: ["digg2009"] }));
  // families: other dataset, a missing F2 baseline, a wrong ref
  assert.throws(() => validateConfig(base({ ...nineMethods(), datasets: ["syn-W2M-M", "syn-W1-M"] })), /syn-W1-M/);
  for (const miss of [...F2_BASELINES, "H"]) {
    const n = nineMethods();
    const methods = (n.methods as string[]).filter((m) => m !== miss);
    const params = { ...(n.params as RunConfig["params"]) };
    delete params[miss];
    assert.throws(() => validateConfig(base({ ...n, methods, params })), new RegExp(miss));
  }
  assert.throws(() => validateConfig(base({ ...nineMethods(), compare: { mode: "families", ref: "BL0" } })), /BL2/);
});

test("density needs compare and H, h0Gate needs compare none with ref BL2, H-follow and syn-W0-M", () => {
  validateConfig(base({ compare: { mode: "none", ref: "BL2" }, density: true }));
  assert.throws(() => validateConfig(base({ density: true })), /compare/);
  assert.throws(() => validateConfig(base({ methods: ["BL2", "BL4"], params: { BL4: { divisor: 1 } }, compare: { mode: "none", ref: "BL2" }, density: true })), /H/);
  // amendment 1: the gate is on H-follow
  const gate = { datasets: ["syn-W0-M"], methods: ["BL2", "H-follow"], params: { "H-follow": { alpha: 1, m: "frozen" as const } } };
  validateConfig(base({ ...gate, compare: { mode: "none", ref: "BL2" }, h0Gate: true }));
  validateConfig(base({ ...gate, compare: { mode: "none", ref: "BL2" }, h0Gate: false }));
  // H may be in the run too (p7-h0 has BL2, H and H-follow)
  validateConfig(base({ ...gate, methods: ["BL2", "H", "H-follow"], params: { H: { alpha: 1, beta: 1, m: "frozen" }, "H-follow": { alpha: 1, m: "frozen" } }, compare: { mode: "none", ref: "BL2" }, h0Gate: true }));
  assert.throws(() => validateConfig(base({ ...gate, h0Gate: true })), /compare/);
  assert.throws(() => validateConfig(base({ ...gate, compare: { mode: "none", ref: "H-follow" }, h0Gate: true })), /BL2/);
  assert.throws(() => validateConfig(base({ ...gate, datasets: ["syn-W1-M"], compare: { mode: "none", ref: "BL2" }, h0Gate: true })), /syn-W0-M/);
  assert.throws(() => validateConfig(base({ ...gate, methods: ["BL2"], params: {}, compare: { mode: "none", ref: "BL2" }, h0Gate: true })), /H-follow/);
  // H alone is not enough any more
  assert.throws(
    () => validateConfig(base({ ...gate, methods: ["BL2", "H"], params: { H: { alpha: 1, beta: 1, m: "frozen" } }, compare: { mode: "none", ref: "BL2" }, h0Gate: true })),
    /H-follow/,
  );
  assert.throws(() => validateConfig(base({ ...nineMethods(), datasets: ["syn-W0-M"], h0Gate: true })), /syn-W0-M|none/);
});

test("parseRunConfig accepts the new keys and still refuses an unknown one", () => {
  const cfg = base({ tieBreak: "id-asc", shuffle: true, compare: { mode: "none", ref: "BL2" }, density: true, h0Gate: false });
  assert.deepEqual(parseRunConfig(JSON.stringify(cfg)), cfg);
  assert.throws(() => parseRunConfig(JSON.stringify({ ...base(), tie_break: "id-asc" })), /tie_break/);
});
