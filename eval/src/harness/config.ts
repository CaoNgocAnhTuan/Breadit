import type { MethodId } from "@breadit/ranking";
import { loadFrozen } from "../frozen.ts";
import { METHOD_ORDER } from "../metrics.ts";
import type { SplitName } from "./split.ts";

// Run configs (design "Runs are configs"). A config is a JSON file, eval/config/runs/<runId>.json. It is checked before
// any dataset is loaded: a bad split, a bad method or a missing param stops the run at once (design F6, F10).

/** A number, "grid" (the value is tuned on the validation split) or "frozen" (only for `m`: the value of super-plan section 7). */
export type ParamValue = number | "grid" | "frozen";
export type PoolName = "normal" | "large";
export type ModeName = "fast" | "reference";

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

const KEYS = ["datasets", "split", "methods", "params", "pool", "mode", "testApprovedBy"];

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
  return c.methods.map((m) => {
    const given = c.params[m] ?? {};
    const params: Record<string, number> = {};
    for (const p of REQUIRED_PARAMS[m as MethodId]) params[p] = resolveParam(given[p] as ParamValue);
    return { label: m, method: m as MethodId, params };
  });
}
