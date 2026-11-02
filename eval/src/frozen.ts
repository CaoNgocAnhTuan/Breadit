import { readFileSync } from "node:fs";

export interface HistoryBucket {
  label: string;
  min: number;
  max: number | null;
}

export interface Frozen {
  /** Super-plan section 7, row "alpha, beta grid". */
  alphaBetaGrid: number[];
  baseEpoch: { iso: string; seconds: number };
  /** Row "Baseline grids": the tuning grid of each tuned baseline. */
  baselineGrids: { BL2t: number[]; BL4: number[]; BL5: number[] };
  bootstrapResamples: number;
  confidenceLevel: number;
  /** The q of row "Cut time T" (blueprint section 3.1). */
  cutQuantile: number;
  /** Row "Cut time T": dataset id to T. The harness stops when its own T differs. */
  cutTimes: Record<string, number>;
  historyBuckets: HistoryBucket[];
  holmLevel: number;
  /** Row "K". */
  k: number[];
  masterSeed: number;
  permutations: number;
  poolCap: number;
  /** Row "Larger pool (W_L, N_L) for E8". */
  poolLarge: { windowDays: number; poolCap: number };
  /** Row "Prior strength m". */
  priorStrength: number;
  sizes: { M: { posts: number; users: number }; S: { posts: number; users: number } };
  windowDays: number;
}

// The values of super-plan section 7 that eval code reads. frozen.test.ts keeps this file equal to section 7.
export function loadFrozen(): Frozen {
  const text = readFileSync(new URL("../config/frozen-v1.json", import.meta.url), "utf8");
  return JSON.parse(text) as Frozen;
}

export function pinnedNodeVersion(): string {
  return readFileSync(new URL("../../.nvmrc", import.meta.url), "utf8").trim();
}

// Stops the run unless the Node version is the one in .nvmrc (design F1).
export function checkNode(version: string = process.version): void {
  const pinned = pinnedNodeVersion();
  if (version !== pinned) {
    throw new Error(`Node ${version} is not the version in .nvmrc (${pinned}). Run "nvm use" in the repo root first.`);
  }
}
