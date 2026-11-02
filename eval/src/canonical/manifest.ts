import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FileEntry } from "./csv.ts";

// Blueprint section 2.3. Keys are written sorted.
export interface Manifest {
  schemaVersion: number;
  datasetId: string;
  source: Record<string, unknown>;
  masterSeed?: number;
  epoch: { iso: string; seconds: number };
  node: string;
  files: Record<string, FileEntry>;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as object).sort(compare)) out[k] = sortKeys((value as Record<string, unknown>)[k]);
    return out;
  }
  return value;
}

export function manifestText(m: Manifest): string {
  return JSON.stringify(sortKeys(m), null, 2) + "\n";
}

export function writeManifest(dir: string, m: Manifest): void {
  writeFileSync(join(dir, "manifest.json"), manifestText(m), "utf8");
}

export function readManifest(dir: string): Manifest {
  return JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as Manifest;
}
