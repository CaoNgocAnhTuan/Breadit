import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TEST_RUNS, buildTestConfigs, freezeCommand, readTuningInput } from "./freeze.ts";
import { parseRunConfig, validateConfig } from "./config.ts";
import type { RunConfig } from "./config.ts";
import { canonicalJson } from "../canonical/manifest.ts";
import { sha256Hex } from "../canonical/csv.ts";
import { tempDir } from "../checks/fixture.ts";
import { loadFrozen } from "../frozen.ts";

// TC8 (design DW1, DW2, F4, F5): freeze writes the ten test configs from the chosen rows of the tuning, and refuses a tuning
// that breaks the rule of super-plan section 5 or whose files differ from their manifests.
const frozen = loadFrozen();

const RUN_IDS = ["p7-h0", "p7-main", "p7-e5-worlds", "p7-e4-terms", "p7-e4-m0", "p7-e4-m2", "p7-e4-m10", "p7-e6-ties", "p7-e8-pool", "p7-e5-shuffle"];

/** The chosen grid point of each (dataset, tuned method): the value, or alpha/beta. */
const CHOSEN: Record<string, Record<string, string>> = {
  "syn-W2M-M": { BL2t: "0.5", BL4: "22500", BL5: "1.2", BL6: "4", H: "2/8" },
  digg2009: { BL2t: "0.125", BL4: "90000", BL5: "1.5", BL6: "1", H: "8/0" },
  "syn-W0-M": { H: "0/0" },
  "syn-W1-M": { H: "1/4" },
  "syn-W2L-M": { H: "4/2" },
  "syn-W2H-M": { H: "16/16" },
};
const MAIN_DATASETS = ["syn-W2M-M", "digg2009"];
const WORLD_DATASETS = ["syn-W0-M", "syn-W1-M", "syn-W2L-M", "syn-W2H-M"];
const PARAM_NAME: Record<string, string> = { BL2t: "ageWeight", BL4: "divisor", BL5: "gravity", BL6: "alpha", H: "alpha/beta" };

function gridOf(method: string): string[] {
  const g = frozen.alphaBetaGrid.map(String);
  if (method === "BL2t") return frozen.baselineGrids.BL2t.map(String);
  if (method === "BL4") return frozen.baselineGrids.BL4.map(String);
  if (method === "BL5") return frozen.baselineGrids.BL5.map(String);
  if (method === "BL6") return g;
  return g.flatMap((a) => g.map((b) => `${a}/${b}`));
}

interface Fault {
  /** Change the text of a tuning.csv line (by dataset and method) after it was made. */
  twoChosen?: boolean;
  notBest?: boolean;
  noGroup?: string;
}

/** The lines of a tuning.csv for the given datasets and methods. A point is better when it is the chosen one. */
function tuningLines(datasets: string[], methods: string[], fault: Fault = {}): string[] {
  const out: string[] = [];
  for (const dataset of datasets) {
    for (const method of methods) {
      if (fault.noGroup === `${dataset}/${method}`) continue;
      const chosen = (CHOSEN[dataset] as Record<string, string>)[method] as string;
      // On Digg beta has no effect, so every point with the chosen alpha ties at the top, and the smaller beta is chosen.
      const alpha = chosen.split("/")[0];
      for (const value of gridOf(method)) {
        const top = method === "H" && dataset === "digg2009" ? value.split("/")[0] === alpha : value === chosen;
        const isChosen = value === chosen;
        let ndcg = top ? "0.400000" : "0.300000";
        let flag = isChosen ? "1" : "0";
        if (fault.twoChosen && isChosen) flag = "1";
        if (fault.twoChosen && method === "BL4" && dataset === "digg2009" && value === "11250") flag = "1";
        if (fault.notBest && method === "BL5" && dataset === "digg2009") {
          if (isChosen) flag = "0";
          if (value === "2.4") flag = "1";
        }
        if (fault.notBest && method === "BL5" && dataset === "digg2009" && value === "2.4") ndcg = "0.300000";
        out.push([dataset, method, PARAM_NAME[method], value, ndcg, flag].join(","));
      }
    }
  }
  return out;
}

const SUMMARY_HEADER = "dataset,split,method,k,bucket,n_users,recall,ndcg";
function summaryLines(nd: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [method, v] of Object.entries(nd)) out.push(["syn-W2M-M", "validation", method, "10", "all", "300", "0.500000", v].join(","));
  // rows the rule must not read: other K, other group, other dataset
  out.push(["syn-W2M-M", "validation", "BL1", "5", "all", "300", "0.9", "0.900000"].join(","));
  out.push(["syn-W2M-M", "validation", "BL0", "10", "0-4", "100", "0.9", "0.900000"].join(","));
  out.push(["digg2009", "validation", "BL6", "10", "all", "300", "0.9", "0.900000"].join(","));
  return out;
}
const BASE_NDCG: Record<string, string> = { BL0: "0.200000", BL1: "0.210000", BL2: "0.300000", BL2t: "0.310000", BL3: "0.350000", BL4: "0.330000", BL5: "0.350000", BL6: "0.340000", H: "0.400000" };

interface FolderOptions {
  fault?: Fault;
  summary?: Record<string, string>;
  /** Write a manifest that does not match this file of this run. */
  wrongSha?: { run: string; file: string };
}

/** A results folder with p7-tune-main and p7-tune-worlds, each with tuning.csv, summary.csv and a manifest that matches them. */
function resultsDir(o: FolderOptions = {}): string {
  const dir = tempDir();
  const runs: Record<string, { tuning: string[]; summary: string[] }> = {
    "p7-tune-main": { tuning: tuningLines(MAIN_DATASETS, ["BL2t", "BL4", "BL5", "BL6", "H"], o.fault), summary: summaryLines(o.summary ?? BASE_NDCG) },
    "p7-tune-worlds": { tuning: tuningLines(WORLD_DATASETS, ["H"], o.fault), summary: ["syn-W0-M,validation,BL2,10,all,300,0.5,0.300000", "syn-W0-M,validation,H,10,all,300,0.5,0.300000"] },
  };
  for (const [run, { tuning, summary }] of Object.entries(runs)) {
    const d = join(dir, run);
    mkdirSync(d, { recursive: true });
    const files = {
      "tuning.csv": ["dataset,method,param,value,val_ndcg10,chosen", ...tuning].join("\n") + "\n",
      "summary.csv": [SUMMARY_HEADER, ...summary].join("\n") + "\n",
    };
    const entries: Record<string, { rows: number; sha256: string }> = {};
    for (const [name, text] of Object.entries(files)) {
      writeFileSync(join(d, name), text);
      entries[name] = { rows: text.split("\n").length - 2, sha256: sha256Hex(text) };
    }
    if (o.wrongSha?.run === run) (entries[o.wrongSha.file] as { sha256: string }).sha256 = sha256Hex("something else");
    writeFileSync(join(d, "manifest.json"), canonicalJson({ schemaVersion: 1, runId: run, files: entries }));
  }
  return dir;
}

function freeze(dir: string, cfgDir: string, extra: string[] = []): string[] {
  return freezeCommand(["--results-dir", dir, "--config-dir", cfgDir, ...extra]);
}

function readConfig(cfgDir: string, id: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(cfgDir, `${id}.json`), "utf8")) as Record<string, unknown>;
}

function chosenNumbers(dataset: string, method: string): Record<string, number> {
  const v = (CHOSEN[dataset] as Record<string, string>)[method] as string;
  if (method === "H") {
    const [a, b] = v.split("/").map(Number);
    return { alpha: a as number, beta: b as number };
  }
  return { [(PARAM_NAME[method] as string)]: Number(v) };
}

test("TEST_RUNS lists the ten runs in the order of the design", () => {
  assert.deepEqual(TEST_RUNS.map((r) => r.runId), RUN_IDS);
});

test("freeze writes the ten configs in canonical JSON, with no testApprovedBy, and prints the rule line", () => {
  const dir = resultsDir();
  const cfgDir = tempDir();
  const lines = freeze(dir, cfgDir);
  assert.deepEqual(readdirSync(cfgDir).sort((a, b) => (a < b ? -1 : 1)), RUN_IDS.map((r) => `${r}.json`).sort((a, b) => (a < b ? -1 : 1)));
  assert.ok(lines.some((l) => l === "rule check: 14 groups, 0 violations"), lines.join("\n"));
  for (const id of RUN_IDS) {
    const text = readFileSync(join(cfgDir, `${id}.json`), "utf8");
    assert.equal(text, canonicalJson(JSON.parse(text)), `${id} is canonical JSON`);
    const cfg = JSON.parse(text) as RunConfig;
    assert.equal(cfg.split, "test", id);
    assert.equal(cfg.mode, "fast", id);
    assert.ok(!("testApprovedBy" in cfg), id);
    // refused without approval, valid with it
    assert.throws(() => parseRunConfig(text), /testApprovedBy/, id);
    validateConfig({ ...cfg, testApprovedBy: "author" });
    assert.ok(!text.includes('"grid"'), id);
  }
  // two writes are byte-identical
  const again = tempDir();
  freeze(dir, again);
  for (const id of RUN_IDS) assert.equal(readFileSync(join(again, `${id}.json`), "utf8"), readFileSync(join(cfgDir, `${id}.json`), "utf8"), id);
});

test("with --approve every config carries the name, parses, and is otherwise the same", () => {
  const dir = resultsDir();
  const plain = tempDir();
  const approved = tempDir();
  freeze(dir, plain);
  freeze(dir, approved, ["--approve", "author"]);
  for (const id of RUN_IDS) {
    const text = readFileSync(join(approved, `${id}.json`), "utf8");
    const cfg = parseRunConfig(text);
    assert.equal(cfg.testApprovedBy, "author");
    const { testApprovedBy: _t, ...rest } = cfg;
    assert.deepEqual(rest, JSON.parse(readFileSync(join(plain, `${id}.json`), "utf8")));
    assert.equal(text, canonicalJson(JSON.parse(text)));
  }
  assert.throws(() => freeze(dir, tempDir(), ["--approve", ""]), /approve/);
});

test("every number of a config equals a chosen row; m is frozen except in the sweep", () => {
  const dir = resultsDir();
  const cfgDir = tempDir();
  freeze(dir, cfgDir);
  const cfg = (id: string): RunConfig => readConfig(cfgDir, id) as unknown as RunConfig;
  // p7-h0: syn-W0-M, H with the values chosen on syn-W2M-M, compare none, the gate
  const h0 = cfg("p7-h0");
  assert.deepEqual(h0.datasets, ["syn-W0-M"]);
  assert.deepEqual(h0.methods, ["BL2", "H"]);
  assert.deepEqual(h0.params, { H: { ...chosenNumbers("syn-W2M-M", "H"), m: "frozen" } });
  assert.deepEqual(h0.compare, { mode: "none", ref: "BL2" });
  assert.equal(h0.h0Gate, true);
  assert.equal(h0.pool, "normal");
  // p7-main: nine methods, each dataset its own values
  const main = cfg("p7-main");
  assert.deepEqual(main.datasets, ["syn-W2M-M", "digg2009"]);
  assert.deepEqual(main.methods, ["BL0", "BL1", "BL2", "BL2t", "BL3", "BL4", "BL5", "BL6", "H"]);
  assert.deepEqual(main.compare, { mode: "families", ref: "BL2" });
  assert.equal(main.density, true);
  for (const d of MAIN_DATASETS) {
    const own = (main.datasetParams as Record<string, Record<string, Record<string, number>>>)[d] as Record<string, Record<string, number>>;
    assert.deepEqual(own, {
      BL2t: chosenNumbers(d, "BL2t"),
      BL4: chosenNumbers(d, "BL4"),
      BL5: chosenNumbers(d, "BL5"),
      BL6: chosenNumbers(d, "BL6"),
      H: chosenNumbers(d, "H"),
    });
  }
  assert.deepEqual(main.params.H, { ...chosenNumbers("syn-W2M-M", "H"), m: "frozen" });
  // p7-e5-worlds: each world its own H
  const worlds = cfg("p7-e5-worlds");
  assert.deepEqual(worlds.datasets, ["syn-W0-M", "syn-W1-M", "syn-W2L-M", "syn-W2M-M", "syn-W2H-M"]);
  assert.deepEqual(worlds.methods, ["BL2", "H"]);
  for (const d of worlds.datasets) assert.deepEqual((worlds.datasetParams as Record<string, unknown>)[d], { H: chosenNumbers(d, "H") }, d);
  assert.deepEqual(worlds.compare, { mode: "none", ref: "BL2" });
  assert.equal(worlds.density, true);
  // p7-e4-terms: H's alpha and beta in every term variant, on both datasets
  const terms = cfg("p7-e4-terms");
  assert.deepEqual(terms.methods, ["BL2", "H", "H-follow", "H-comm", "H-noauthor", "H-noengager"]);
  for (const d of MAIN_DATASETS) {
    const h = chosenNumbers(d, "H");
    assert.deepEqual((terms.datasetParams as Record<string, unknown>)[d], {
      H: h,
      "H-follow": { alpha: h.alpha },
      "H-comm": { beta: h.beta },
      "H-noauthor": h,
      "H-noengager": h,
    });
  }
  assert.deepEqual(terms.params["H-follow"], { alpha: chosenNumbers("syn-W2M-M", "H").alpha, m: "frozen" });
  assert.deepEqual(terms.compare, { mode: "none", ref: "BL2" });
  // the m sweep
  for (const [id, m] of [["p7-e4-m0", 0], ["p7-e4-m2", 2], ["p7-e4-m10", 10]] as const) {
    const c = cfg(id);
    assert.deepEqual(c.methods, ["BL2", "H"], id);
    assert.equal(c.params.H?.m, m, id);
    for (const d of MAIN_DATASETS) assert.deepEqual((c.datasetParams as Record<string, unknown>)[d], { H: chosenNumbers(d, "H") }, `${id} ${d}`);
    assert.deepEqual(c.compare, { mode: "none", ref: "BL2" }, id);
  }
  // p7-e6-ties: the nine of p7-main, reversed ties, no compare
  const ties = cfg("p7-e6-ties");
  assert.equal(ties.tieBreak, "id-asc");
  assert.deepEqual(ties.methods, main.methods);
  assert.deepEqual(ties.datasets, main.datasets);
  assert.deepEqual(ties.datasetParams, main.datasetParams);
  assert.ok(!("compare" in ties));
  // p7-e8-pool: syn-W2M-M, the large pool, BL2, H and the best validation baseline (a tie of BL3 and BL5: BL3 comes first)
  const e8 = cfg("p7-e8-pool");
  assert.deepEqual(e8.datasets, ["syn-W2M-M"]);
  assert.deepEqual(e8.methods, ["BL2", "BL3", "H"]);
  assert.equal(e8.pool, "large");
  assert.deepEqual(e8.params, { H: { ...chosenNumbers("syn-W2M-M", "H"), m: "frozen" } });
  assert.deepEqual(e8.compare, { mode: "none", ref: "BL2" });
  // p7-e5-shuffle
  const sh = cfg("p7-e5-shuffle");
  assert.equal(sh.shuffle, true);
  assert.deepEqual(sh.datasets, ["syn-W2M-M"]);
  assert.deepEqual(sh.methods, ["BL2", "H"]);
  assert.deepEqual(sh.params, { H: { ...chosenNumbers("syn-W2M-M", "H"), m: "frozen" } });
  // no run but the sweep has a number for m
  for (const id of RUN_IDS.filter((r) => !r.startsWith("p7-e4-m"))) {
    for (const p of Object.values(cfg(id).params)) if ("m" in p) assert.equal(p.m, "frozen", id);
  }
});

test("E8 baseline: the highest validation NDCG@10 (K 10, all) of BL0 to BL6 on syn-W2M-M, ties to the method order; BL2 gives a two-method run", () => {
  const cases: Array<[Record<string, string>, string[]]> = [
    [{ ...BASE_NDCG, BL5: "0.360000" }, ["BL2", "BL5", "H"]],
    [{ ...BASE_NDCG, BL1: "0.350000" }, ["BL1", "BL2", "H"]],
    [{ ...BASE_NDCG, BL2: "0.500000" }, ["BL2", "H"]],
    [{ ...BASE_NDCG, BL6: "0.500000", H: "0.900000" }, ["BL2", "BL6", "H"]],
  ];
  for (const [nd, methods] of cases) {
    const cfgDir = tempDir();
    freeze(resultsDir({ summary: nd }), cfgDir);
    const e8 = readConfig(cfgDir, "p7-e8-pool") as unknown as RunConfig;
    assert.deepEqual(e8.methods, methods);
    const baseline = methods.find((m) => m !== "BL2" && m !== "H");
    if (baseline === "BL5") assert.deepEqual(e8.params.BL5, { gravity: 1.2 });
    if (baseline === "BL6") assert.deepEqual(e8.params.BL6, { alpha: 4 });
    if (baseline === undefined) assert.deepEqual(Object.keys(e8.params), ["H"]);
  }
  const lines = freeze(resultsDir(), tempDir());
  assert.ok(lines.some((l) => /^E8 baseline: BL3 /.test(l)), lines.join("\n"));
});

test("--check prints equal for the files it wrote (with or without approval) and reports each changed number", () => {
  const dir = resultsDir();
  const cfgDir = tempDir();
  freeze(dir, cfgDir);
  assert.ok(freeze(dir, cfgDir, ["--check"]).includes("equal"));
  // approval is ignored by --check
  freeze(dir, cfgDir, ["--approve", "author"]);
  assert.ok(freeze(dir, cfgDir, ["--check"]).includes("equal"));
  // a changed number is reported with its path, and the command fails
  const path = join(cfgDir, "p7-main.json");
  const cfg = JSON.parse(readFileSync(path, "utf8")) as RunConfig;
  (cfg.datasetParams as Record<string, Record<string, Record<string, number>>>)["digg2009"].H.alpha = 4;
  writeFileSync(path, canonicalJson(cfg));
  assert.throws(() => freeze(dir, cfgDir, ["--check"]), (e: Error) => /p7-main/.test(e.message) && /digg2009/.test(e.message) && /alpha/.test(e.message) && !/^equal/m.test(e.message));
  // a missing file is a difference too
  const other = tempDir();
  freeze(dir, other);
  writeFileSync(join(other, "p7-h0.json"), "{}\n");
  assert.throws(() => freeze(dir, other, ["--check"]), /p7-h0/);
  assert.throws(() => freeze(dir, tempDir(), ["--check"]), /p7-h0/);
});

test("the rule of super-plan 5: two chosen rows, a chosen row that is not the best, or a missing group stops the command", () => {
  const cfgDir = tempDir();
  assert.throws(() => freeze(resultsDir({ fault: { twoChosen: true } }), cfgDir), (e: Error) => /digg2009/.test(e.message) && /BL4/.test(e.message) && /chosen/.test(e.message));
  assert.throws(() => freeze(resultsDir({ fault: { notBest: true } }), cfgDir), (e: Error) => /digg2009/.test(e.message) && /BL5/.test(e.message));
  assert.throws(() => freeze(resultsDir({ fault: { noGroup: "syn-W1-M/H" } }), cfgDir), (e: Error) => /syn-W1-M/.test(e.message) && /H/.test(e.message));
  assert.deepEqual(readdirSync(cfgDir), [], "nothing was written");
});

test("a tuning or summary file whose SHA-256 differs from its run manifest stops the command (F5)", () => {
  const cfgDir = tempDir();
  for (const [run, file] of [["p7-tune-main", "tuning.csv"], ["p7-tune-main", "summary.csv"], ["p7-tune-worlds", "tuning.csv"], ["p7-tune-worlds", "summary.csv"]]) {
    assert.throws(() => freeze(resultsDir({ wrongSha: { run, file } }), cfgDir), (e: Error) => e.message.includes(run) && e.message.includes(file as string), `${run} ${file}`);
  }
  assert.deepEqual(readdirSync(cfgDir), []);
  assert.throws(() => freeze(tempDir(), cfgDir), /p7-tune-main/);
  // a changed byte in tuning.csv after the run
  const dir = resultsDir();
  const path = join(dir, "p7-tune-main", "tuning.csv");
  writeFileSync(path, readFileSync(path, "utf8").replace("0.300000", "0.300001"));
  assert.throws(() => freeze(dir, cfgDir), /tuning\.csv/);
});

test("readTuningInput and buildTestConfigs work on rows without files", () => {
  const input = readTuningInput(resultsDir());
  const configs = buildTestConfigs(input);
  assert.deepEqual(Object.keys(configs), RUN_IDS);
  assert.deepEqual(buildTestConfigs(input), configs);
});
