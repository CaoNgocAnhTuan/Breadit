import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { sha256Hex } from "../canonical/csv.ts";
import { canonicalJson } from "../canonical/manifest.ts";

// The merged results manifest (blueprint section 2.3, task p8-repro). It holds the SHA-256 of every results manifest in
// .docs/results/<id>/ and of every dataset manifest in eval/data/<id>/. Each of those manifests has the same `files` map (name to
// rows and sha256, a name may hold a "/" as in tables/e1.tex), so one rule checks datasets, runs, the parity sample and the report.
// A name in the `external` list of a manifest lives in eval/results/<id>/ and not next to the manifest (it is git-ignored).
// This file only reads and hashes files: no Postgres, Redis or HTTP.

/** Folders of .docs/results/ with Class R numbers (latency): they are listed, but never compared (super-plan section 2). */
export const CLASS_R: readonly string[] = ["p7-e7"];

export interface MergedManifest {
  schemaVersion: 1;
  /** eval/data/<id>/manifest.json */
  datasets: Record<string, { manifestSha256: string }>;
  /** .docs/results/<id>/manifest.json */
  results: Record<string, { class: "D" | "R"; manifestSha256: string }>;
}

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const DATA_DIR = "eval/data";
const RESULTS_DIR = ".docs/results";
const RAW_DIR = "eval/results";
const MERGED_FILE = `${RESULTS_DIR}/manifest.json`;

interface FileMap {
  files?: Record<string, { sha256: string }>;
  external?: string[];
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function subfolders(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => statSync(join(dir, n)).isDirectory())
    .sort(compare);
}

/** Every file below `dir`, as a path relative to `dir` with "/" separators, sorted. */
function walk(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort(compare)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path, `${prefix}${name}/`));
    else out.push(`${prefix}${name}`);
  }
  return out;
}

function manifestHash(root: string, dir: string, id: string): string {
  const path = join(root, dir, id, "manifest.json");
  if (!existsSync(path)) throw new Error(`${dir}/${id}/manifest.json does not exist`);
  return sha256Hex(readFileSync(path, "utf8"));
}

/** Reads what is on disk: every folder with a manifest.json in eval/data/ and in .docs/results/. */
export function buildMerged(root: string): MergedManifest {
  const datasets: MergedManifest["datasets"] = {};
  for (const id of subfolders(join(root, DATA_DIR))) {
    if (existsSync(join(root, DATA_DIR, id, "manifest.json"))) datasets[id] = { manifestSha256: manifestHash(root, DATA_DIR, id) };
  }
  const results: MergedManifest["results"] = {};
  for (const id of subfolders(join(root, RESULTS_DIR))) {
    if (existsSync(join(root, RESULTS_DIR, id, "manifest.json"))) {
      results[id] = { class: CLASS_R.includes(id) ? "R" : "D", manifestSha256: manifestHash(root, RESULTS_DIR, id) };
    }
  }
  return { schemaVersion: 1, datasets, results };
}

interface Inspection {
  differences: string[];
  /** Files that were read and compared: manifests, listed files and external files. */
  files: number;
}

/** The files of one manifest: each must exist and have its SHA-256. `where` is the folder of the manifest, `rawWhere` the one of external files. */
function inspectFiles(root: string, where: string, rawWhere: string | null, manifest: FileMap, out: Inspection): void {
  const external = new Set(manifest.external ?? []);
  for (const name of Object.keys(manifest.files ?? {}).sort(compare)) {
    const want = (manifest.files as Record<string, { sha256: string }>)[name]?.sha256 as string;
    const dir = external.has(name) && rawWhere !== null ? rawWhere : where;
    const path = `${dir}/${name}`;
    if (!existsSync(join(root, path))) {
      out.differences.push(`${path}: missing (listed in ${where}/manifest.json)`);
      continue;
    }
    out.files += 1;
    const got = sha256Hex(readFileSync(join(root, path), "utf8"));
    if (got !== want) out.differences.push(`${path}: SHA-256 ${got}, manifest ${want}`);
  }
}

function inspect(root: string, merged: MergedManifest): Inspection {
  const out: Inspection = { differences: [], files: 0 };

  // The datasets (eval/data/ is git-ignored, so each one is rebuilt by gen or adapt:digg).
  const dataIds = subfolders(join(root, DATA_DIR)).filter((id) => existsSync(join(root, DATA_DIR, id, "manifest.json")));
  for (const id of Object.keys(merged.datasets).sort(compare)) {
    const where = `${DATA_DIR}/${id}`;
    if (!existsSync(join(root, where, "manifest.json"))) {
      out.differences.push(`${where}: missing (the merged manifest lists this dataset)`);
      continue;
    }
    const text = readFileSync(join(root, where, "manifest.json"), "utf8");
    out.files += 1;
    const got = sha256Hex(text);
    const want = (merged.datasets[id] as { manifestSha256: string }).manifestSha256;
    if (got !== want) out.differences.push(`${where}/manifest.json: SHA-256 ${got}, merged manifest ${want}`);
    inspectFiles(root, where, null, JSON.parse(text) as FileMap, out);
  }
  for (const id of dataIds) {
    if (merged.datasets[id] === undefined) out.differences.push(`${DATA_DIR}/${id}: not in ${MERGED_FILE}`);
  }

  // The results folders. A Class R folder is listed as a record and skipped here.
  const resultIds = subfolders(join(root, RESULTS_DIR)).filter((id) => existsSync(join(root, RESULTS_DIR, id, "manifest.json")));
  for (const id of Object.keys(merged.results).sort(compare)) {
    const entry = merged.results[id] as { class: "D" | "R"; manifestSha256: string };
    if (entry.class === "R") continue;
    const where = `${RESULTS_DIR}/${id}`;
    if (!existsSync(join(root, where, "manifest.json"))) {
      out.differences.push(`${where}: missing (the merged manifest lists this folder)`);
      continue;
    }
    const text = readFileSync(join(root, where, "manifest.json"), "utf8");
    out.files += 1;
    const got = sha256Hex(text);
    if (got !== entry.manifestSha256) out.differences.push(`${where}/manifest.json: SHA-256 ${got}, merged manifest ${entry.manifestSha256}`);
    const manifest = JSON.parse(text) as FileMap;
    inspectFiles(root, where, `${RAW_DIR}/${id}`, manifest, out);
    // A file next to the manifest that the manifest does not list.
    const listed = new Set(Object.keys(manifest.files ?? {}).filter((n) => !(manifest.external ?? []).includes(n)));
    listed.add("manifest.json");
    for (const name of walk(join(root, where))) {
      if (!listed.has(name)) out.differences.push(`${where}/${name}: not listed in ${where}/manifest.json`);
    }
  }
  for (const id of resultIds) {
    if (merged.results[id] === undefined) out.differences.push(`${RESULTS_DIR}/${id}: not in ${MERGED_FILE}`);
  }
  return out;
}

/** The differences between the tree under `root` and `merged`, one line each that names the path from `root`. Empty means equal. */
export function checkTree(root: string, merged: MergedManifest): string[] {
  return inspect(root, merged).differences;
}

function summary(merged: MergedManifest, files: number): string {
  return `equal: ${files} files in ${Object.keys(merged.results).length} folders and ${Object.keys(merged.datasets).length} datasets`;
}

function differenceError(what: string, diffs: string[]): Error {
  return new Error(`${what}: ${diffs.length} difference${diffs.length === 1 ? "" : "s"}\n${diffs.map((d) => `  ${d}`).join("\n")}`);
}

/**
 * `[--write] [--root <dir>]`. Check mode reads <root>/.docs/results/manifest.json and compares the tree with it; write mode makes
 * that file from the tree (it refuses a tree that is not equal to its own manifests). Throws with the differences.
 */
export function mergedCommand(argv: string[]): string[] {
  const { values } = parseArgs({ args: argv, options: { write: { type: "boolean" }, root: { type: "string" } }, strict: true });
  const root = values.root !== undefined ? resolve(values.root) : REPO_ROOT;
  const path = join(root, MERGED_FILE);

  if (values.write === true) {
    const built = buildMerged(root);
    const found = inspect(root, built);
    if (found.differences.length > 0) throw differenceError("the tree is not equal to its own manifests, so the merged manifest was not written", found.differences);
    writeFileSync(path, canonicalJson(built), "utf8");
    return [`wrote ${relative(root, path)}`, summary(built, found.files)];
  }

  if (!existsSync(path)) {
    throw new Error(`${MERGED_FILE} does not exist. Make it with: npm run results:manifest -w @breadit/eval -- --write`);
  }
  const merged = JSON.parse(readFileSync(path, "utf8")) as MergedManifest;
  if (merged.schemaVersion !== 1) throw new Error(`${MERGED_FILE} has schemaVersion ${String(merged.schemaVersion)}, expected 1`);
  const found = inspect(root, merged);
  if (found.differences.length > 0) throw differenceError(`the tree differs from ${MERGED_FILE}`, found.differences);
  return [summary(merged, found.files)];
}
