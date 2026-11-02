import { readFileSync } from "node:fs";

export interface HistoryBucket {
  label: string;
  min: number;
  max: number | null;
}

export interface Frozen {
  baseEpoch: { iso: string; seconds: number };
  historyBuckets: HistoryBucket[];
  masterSeed: number;
  poolCap: number;
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
