import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeTable, sha256Hex } from "../canonical/csv.ts";
import type { Row } from "../canonical/csv.ts";
import { writeManifest } from "../canonical/manifest.ts";
import type { Manifest } from "../canonical/manifest.ts";
import { SCHEMAS, TABLES } from "../canonical/schema.ts";
import type { TableName } from "../canonical/schema.ts";

// Test helper: writes a small dataset folder with the Step 4 writer. Not used by production code.

export type FixtureTables = Partial<Record<TableName, Row[]>>;

export interface FixtureOptions {
  datasetId?: string;
  /** Change the text of a table file after it was written. The manifest then matches the changed file. */
  mutate?: Partial<Record<TableName, (text: string) => string>>;
  /** Change the manifest after it was built. */
  manifest?: (m: Manifest) => Manifest;
  /** Extra files in the folder (name to text). */
  extraFiles?: Record<string, string>;
}

const made: string[] = [];
process.on("exit", () => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

export function tempDir(prefix = "eval-fixture-"): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  made.push(d);
  return d;
}

export function writeFixture(tables: FixtureTables, opts: FixtureOptions = {}): string {
  const dir = tempDir();
  const files: Manifest["files"] = {};
  for (const t of TABLES) {
    writeTable(dir, t, tables[t] ?? []);
    const path = join(dir, SCHEMAS[t].file);
    let text = readFileSync(path, "utf8");
    const mutate = opts.mutate?.[t];
    if (mutate) {
      text = mutate(text);
      writeFileSync(path, text, "utf8");
    }
    files[SCHEMAS[t].file] = { rows: text.split("\n").length - 2, sha256: sha256Hex(text) };
  }
  for (const [name, text] of Object.entries(opts.extraFiles ?? {})) writeFileSync(join(dir, name), text, "utf8");
  let manifest: Manifest = {
    schemaVersion: 1,
    datasetId: opts.datasetId ?? "fixture",
    source: { kind: "fixture" },
    masterSeed: 1,
    epoch: { iso: "1970-01-01T00:00:00Z", seconds: 0 },
    node: "v0",
    files,
  };
  if (opts.manifest) manifest = opts.manifest(manifest);
  writeManifest(dir, manifest);
  return dir;
}
