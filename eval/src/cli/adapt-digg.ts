import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { sha256Hex } from "../canonical/csv.ts";
import { adaptDigg, countsTable, loadDiggConfig } from "../adapters/digg.ts";
import { checkNode } from "../frozen.ts";

// Usage: npm run adapt:digg -w @breadit/eval [rawDir [outDir]]
// Defaults: rawDir datasets/raw/digg2009 (the two zips), outDir eval/data. A relative path is relative to eval/.
// Reads the zips in memory, checks their SHA-256 first, writes <outDir>/digg2009/. Never extracts a file.
checkNode();
const raw = process.argv[2] ? resolve(process.argv[2]) : new URL("../../../datasets/raw/digg2009", import.meta.url).pathname;
const out = process.argv[3] ? resolve(process.argv[3]) : new URL("../../data", import.meta.url).pathname;
try {
  const config = loadDiggConfig();
  const { counts } = adaptDigg(raw, out, config);
  const sha = sha256Hex(readFileSync(join(out, config.datasetId, "manifest.json")));
  process.stdout.write([`${config.datasetId} written to ${join(out, config.datasetId)}`, ...countsTable(counts), `manifest sha256 ${sha}`, ""].join("\n"));
} catch (e) {
  process.stderr.write(`error: ${(e as Error).message}\n`);
  process.exitCode = 1;
}
