import type { MethodId, TieBreak } from "@breadit/ranking";
import { loadFrozen } from "../frozen.ts";
import { METHOD_ORDER } from "../metrics.ts";
import type { SplitName } from "./split.ts";

// Run configs (design "Runs are configs"). A config is a JSON file, eval/config/runs/<runId>.json. It is checked before
// any dataset is loaded: a bad split, a bad method or a missing param stops the run at once (design F6, F10).

/** A number, "grid" (the value is tuned on the validation split) or "frozen" (only for `m`: the value of super-plan section 7). */
export type ParamValue = number | "grid" | "frozen";
export type PoolName = "normal" | "large";
export type ModeName = "fast" | "reference";
/** What goes into compare.csv: the families of blueprint 3.3, or every method against `ref` with no family. */
export type CompareMode = "families" | "none";
export interface CompareConfig {
  mode: CompareMode;
  ref: string;
}

export interface RunConfig {
  datasets: string[];
  split: SplitName;
  methods: string[];
  /** Per method, every param the method needs (see REQUIRED_PARAMS). */
  params: Record<string, Record<string, ParamValue>>;
  pool: PoolName;
  /** "fast" always, except in the tests that compare it with "reference". */
  mode: ModeName;
  /** Needed for split "test": the author's approval, written in the file. */
  testApprovedBy?: string;
  // The keys of P7. All are optional: a config without them runs as in P5 (design "Approach", the six keys).
  /** Per dataset, per method: numbers that replace `params` for that dataset (each dataset has its own tuned values). */
  datasetParams?: Record<string, Record<string, Record<string, number>>>;
  /** Order of posts with equal scores. Default "id-desc", the production order. "id-asc" is E6. */
  tieBreak?: TieBreak;
  /** E5: run on interactions shuffled inside each post. */
  shuffle?: boolean;
  /** Which rows go into compare.csv. */
  compare?: CompareConfig;
  /** E3: write density.csv. Needs `compare` and H. */
  density?: boolean;
  /** Check the H0 gate after the run. */
  h0Gate?: boolean;
}

/** The params each scorer of @breadit/ranking reads (a missing one makes the scorer throw). */
export const REQUIRED_PARAMS: Readonly<Record<MethodId, readonly string[]>> = {
  BL0: [],
  BL1: [],
  BL2: [],
  BL2t: ["ageWeight"],
  BL3: [],
  BL4: ["divisor"],
  BL5: ["gravity"],
  BL6: ["alpha"],
  H: ["alpha", "beta", "m"],
  "H-follow": ["alpha", "m"],
  "H-comm": ["beta", "m"],
  "H-noauthor": ["alpha", "beta", "m"],
  "H-noengager": ["alpha", "beta", "m"],
};

const KEYS = ["datasets", "split", "methods", "params", "pool", "mode", "testApprovedBy", "datasetParams", "tieBreak", "shuffle", "compare", "density", "h0Gate"];

export function parseRunConfig(text: string): RunConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`run config is not valid JSON: ${(e as Error).message}`);
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new Error("run config must be a JSON object");
  const obj = raw as Record<string, unknown>;
  for (const k of Object.keys(obj)) if (!KEYS.includes(k)) throw new Error(`run config has an unknown key "${k}"`);
  for (const k of ["datasets", "split", "methods", "params", "pool", "mode"]) {
    if (!(k in obj)) throw new Error(`run config has no "${k}"`);
  }
  const c = obj as unknown as RunConfig;
  validateConfig(c);
  return c;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** The guards. It throws on the first problem, before any data is loaded. */
export function validateConfig(c: RunConfig): void {
  if (!Array.isArray(c.datasets) || c.datasets.length === 0 || c.datasets.some((d) => typeof d !== "string" || d === "")) {
    throw new Error('run config "datasets" must be a non-empty list of dataset ids');
  }
  if (new Set(c.datasets).size !== c.datasets.length) throw new Error('run config "datasets" lists a dataset twice');
  if (c.split !== "validation" && c.split !== "test") throw new Error(`run config "split" must be "validation" or "test", got ${String(c.split)}`);
  if (c.split === "test" && (typeof c.testApprovedBy !== "string" || c.testApprovedBy.trim() === "")) {
    throw new Error('split "test" needs "testApprovedBy" in the run config: the test split runs once, after tuning is frozen, and the author decides');
  }
  if (c.pool !== "normal" && c.pool !== "large") throw new Error(`run config "pool" must be "normal" or "large", got ${String(c.pool)}`);
  if (c.mode !== "fast" && c.mode !== "reference") throw new Error(`run config "mode" must be "fast" or "reference", got ${String(c.mode)}`);
  if (!Array.isArray(c.methods) || c.methods.length === 0) throw new Error('run config "methods" must be a non-empty list');
  if (new Set(c.methods).size !== c.methods.length) throw new Error('run config "methods" lists a method twice');
  for (const m of c.methods) {
    if (!METHOD_ORDER.includes(m)) throw new Error(`unknown method "${m}"; allowed: ${METHOD_ORDER.join(", ")}`);
  }
  if (c.params === null || typeof c.params !== "object") throw new Error('run config "params" must be an object');
  for (const m of Object.keys(c.params)) {
    if (!c.methods.includes(m)) throw new Error(`params are given for "${m}", which is not in "methods"`);
  }
  for (const m of c.methods) {
    const need = REQUIRED_PARAMS[m as MethodId];
    const given = c.params[m] ?? {};
    for (const p of need) if (!(p in given)) throw new Error(`method ${m} needs the param "${p}" in the run config`);
    for (const p of Object.keys(given)) if (!need.includes(p)) throw new Error(`method ${m} has no param "${p}"`);
    for (const p of need) {
      const v = given[p];
      if (v === "grid") {
        if (p === "m") throw new Error(`param "m" of ${m} cannot be "grid": m is a frozen value`);
        if (c.split === "test") throw new Error(`param "${p}" of ${m} is "grid": tuning runs on the validation split only`);
      } else if (v === "frozen") {
        if (p !== "m") throw new Error(`only "m" can be "frozen", not "${p}" of ${m}`);
      } else if (!isFiniteNumber(v)) {
        throw new Error(`param "${p}" of ${m} must be a finite number, got ${String(v)}`);
      } else if (p === "divisor" && v <= 0) {
        throw new Error(`param "divisor" of ${m} must be above 0, got ${v}`);
      }
    }
  }
  validateDatasetParams(c);
  validateP7Keys(c);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** The families of blueprint 3.3 exist only on these datasets. */
const FAMILY_DATASETS: readonly string[] = ["syn-W2M-M", "digg2009"];
/** The seven baselines of family F2. F1 and F2 also need H and BL2 (the reference). */
export const F2_BASELINES: readonly string[] = ["BL0", "BL1", "BL2t", "BL3", "BL4", "BL5", "BL6"];

function validateDatasetParams(c: RunConfig): void {
  if (c.datasetParams === undefined) return;
  if (!isRecord(c.datasetParams)) throw new Error('run config "datasetParams" must be an object');
  const hasGrid = Object.values(c.params).some((per) => Object.values(per).includes("grid"));
  if (hasGrid) throw new Error('run config has "datasetParams" and a "grid" param: tuning configs take no datasetParams');
  for (const [d, perMethod] of Object.entries(c.datasetParams)) {
    if (!c.datasets.includes(d)) throw new Error(`datasetParams names the dataset "${d}", which is not in "datasets"`);
    if (!isRecord(perMethod)) throw new Error(`datasetParams of ${d} must be an object`);
    for (const [m, given] of Object.entries(perMethod)) {
      if (!c.methods.includes(m)) throw new Error(`datasetParams of ${d} names "${m}", which is not in "methods"`);
      if (!isRecord(given)) throw new Error(`datasetParams of ${d} and ${m} must be an object`);
      const need = REQUIRED_PARAMS[m as MethodId];
      for (const [p, v] of Object.entries(given)) {
        if (!need.includes(p)) throw new Error(`datasetParams of ${d}: method ${m} has no param "${p}"`);
        if (!isFiniteNumber(v)) throw new Error(`datasetParams of ${d}: param "${p}" of ${m} must be a finite number, got ${String(v)}`);
        if (p === "divisor" && v <= 0) throw new Error(`datasetParams of ${d}: param "divisor" of ${m} must be above 0, got ${v}`);
      }
    }
  }
}

function validateP7Keys(c: RunConfig): void {
  if (c.tieBreak !== undefined && c.tieBreak !== "id-desc" && c.tieBreak !== "id-asc") {
    throw new Error(`run config "tieBreak" must be "id-desc" or "id-asc", got ${String(c.tieBreak)}`);
  }
  for (const k of ["shuffle", "density", "h0Gate"] as const) {
    if (c[k] !== undefined && typeof c[k] !== "boolean") throw new Error(`run config "${k}" must be true or false, got ${String(c[k])}`);
  }
  if (c.compare !== undefined) {
    if (!isRecord(c.compare)) throw new Error('run config "compare" must be an object { mode, ref }');
    for (const k of Object.keys(c.compare)) if (k !== "mode" && k !== "ref") throw new Error(`run config "compare" has an unknown key "${k}"`);
    const { mode, ref } = c.compare;
    if (mode !== "families" && mode !== "none") throw new Error(`run config "compare.mode" must be "families" or "none", got ${String(mode)}`);
    if (typeof ref !== "string" || !c.methods.includes(ref)) throw new Error(`run config "compare.ref" must be one of "methods", got ${String(ref)}`);
    if (mode === "families") {
      for (const d of c.datasets) {
        if (!FAMILY_DATASETS.includes(d)) throw new Error(`compare mode "families" runs only on ${FAMILY_DATASETS.join(" and ")}, not on ${d}`);
      }
      if (ref !== "BL2") throw new Error(`compare mode "families" needs ref "BL2", got ${ref}`);
      for (const m of ["H", "BL2", ...F2_BASELINES]) {
        if (!c.methods.includes(m)) throw new Error(`compare mode "families" needs ${m} in "methods"`);
      }
    }
  }
  if (c.density === true) {
    if (c.compare === undefined) throw new Error('"density" needs "compare" in the run config');
    if (!c.methods.includes("H")) throw new Error('"density" needs H in "methods"');
  }
  if (c.h0Gate === true) {
    if (c.compare === undefined || c.compare.mode !== "none") throw new Error('"h0Gate" needs "compare" with mode "none"');
    if (c.compare.ref !== "BL2") throw new Error(`"h0Gate" needs compare.ref "BL2", got ${c.compare.ref}`);
    if (!c.methods.includes("H")) throw new Error('"h0Gate" needs H in "methods"');
    if (!c.datasets.includes("syn-W0-M")) throw new Error('"h0Gate" needs the dataset "syn-W0-M"');
  }
}

/** One method with its params, ready for a scorer. `label` is the method id in a normal run. */
export interface Variant {
  label: string;
  method: MethodId;
  params: Readonly<Record<string, number>>;
}

export function resolveParam(v: ParamValue): number {
  if (v === "frozen") return loadFrozen().priorStrength;
  if (v === "grid") throw new Error('a param is "grid": run it through the tuning first');
  return v;
}

/** The variants of a config with no "grid" left. */
export function fixedVariants(c: RunConfig): Variant[] {
  return buildVariants(c, undefined);
}

/**
 * The variants for one dataset: `fixedVariants`, with that dataset's `datasetParams` replacing the params it names.
 * Another dataset, or a config with no `datasetParams`, gives `fixedVariants`.
 */
export function variantsFor(c: RunConfig, datasetId: string): Variant[] {
  return buildVariants(c, c.datasetParams?.[datasetId]);
}

function buildVariants(c: RunConfig, over: Record<string, Record<string, number>> | undefined): Variant[] {
  return c.methods.map((m) => {
    const given = c.params[m] ?? {};
    const replaced = over?.[m] ?? {};
    const params: Record<string, number> = {};
    for (const p of REQUIRED_PARAMS[m as MethodId]) {
      params[p] = p in replaced ? (replaced[p] as number) : resolveParam(given[p] as ParamValue);
    }
    return { label: m, method: m as MethodId, params };
  });
}
