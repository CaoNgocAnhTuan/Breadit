import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { sha256Hex } from "../canonical/csv.ts";
import { checkNode } from "../frozen.ts";
import { datasetDir, datasetIds, generateDataset } from "../generator/generate.ts";

// Usage: npm run gen -w @breadit/eval [outDir [datasetId ...]]
// Default outDir: eval/data (a relative path is relative to eval/). Default: all eight datasets.
checkNode();
const out = process.argv[2] ? resolve(process.argv[2]) : new URL("../../data", import.meta.url).pathname;
const ids = process.argv.length > 3 ? process.argv.slice(3) : datasetIds();
for (const id of ids) {
  const m = generateDataset(id, out);
  const rows = Object.keys(m.files)
    .map((n) => `${n.replace(".csv", "")}=${(m.files[n] as { rows: number }).rows}`)
    .join(" ");
  const sha = sha256Hex(readFileSync(join(datasetDir(out, id), "manifest.json")));
  process.stdout.write(`${id} ${rows} ${sha}\n`);
}
