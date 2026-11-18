import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CLASS_R, buildMerged, checkTree, mergedCommand } from "./merged.ts";
import { canonicalJson } from "../canonical/manifest.ts";
import { sha256Hex } from "../canonical/csv.ts";
import { tempDir } from "../checks/fixture.ts";

// TC2 (design DW3, DW4): the merged manifest on a small tree in a temp folder. The tree has two datasets, two Class D result
// folders (r1 has one external file, r2 has a file in a sub-folder) and one Class R folder (p7-e7).

const MERGED = ".docs/results/manifest.json";

function put(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text, "utf8");
}

interface Spec {
  /** Name to file text. */
  files: Record<string, string>;
  /** Names that live in `externalDir` and not next to the manifest. */
  external?: string[];
  externalDir?: string;
  /** Other keys of the manifest. */
  extra?: Record<string, unknown>;
}

/** Writes a folder with its listed files and a manifest in the shape every manifest of the repo has. */
function folder(root: string, dir: string, spec: Spec): void {
  const entries: Record<string, { rows: number; sha256: string }> = {};
  for (const name of Object.keys(spec.files).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const text = spec.files[name] as string;
    const external = spec.external?.includes(name) === true;
    put(root, join(external ? (spec.externalDir as string) : dir, name), text);
    entries[name] = { rows: text.split("\n").length - 1, sha256: sha256Hex(text) };
  }
  const manifest: Record<string, unknown> = { schemaVersion: 1, files: entries, ...spec.extra };
  if (spec.external !== undefined) manifest.external = spec.external;
  put(root, join(dir, "manifest.json"), canonicalJson(manifest));
}

function makeTree(): string {
  const root = tempDir("merged-");
  folder(root, "eval/data/dsA", { files: { "users.csv": "id\n1\n2\n", "posts.csv": "id\n7\n" } });
  folder(root, "eval/data/dsB", { files: { "users.csv": "id\n3\n" } });
  folder(root, ".docs/results/r1", {
    files: { "summary.csv": "a,b\n1,2\n", "per_user.csv": "u,x\n1,0.5\n2,0.25\n" },
    external: ["per_user.csv"],
    externalDir: "eval/results/r1",
  });
  folder(root, ".docs/results/r2", { files: { "compare.csv": "a\n1\n", "tables/e1.tex": "\\begin{table}\n" } });
  folder(root, ".docs/results/p7-e7", { files: { "latency.csv": "algo,median\nchrono,36.8\n" } });
  return root;
}

function append(root: string, path: string, text: string): void {
  writeFileSync(join(root, path), readFileSync(join(root, path), "utf8") + text, "utf8");
}

test("CLASS_R is the E7 folder only", () => {
  assert.deepEqual([...CLASS_R], ["p7-e7"]);
});

test("buildMerged lists every dataset and every results folder with the SHA-256 of its manifest, and marks the Class R one", () => {
  const root = makeTree();
  const merged = buildMerged(root);
  assert.equal(merged.schemaVersion, 1);
  assert.deepEqual(Object.keys(merged.datasets), ["dsA", "dsB"]);
  assert.deepEqual(Object.keys(merged.results), ["p7-e7", "r1", "r2"]);
  assert.equal(merged.datasets.dsA?.manifestSha256, sha256Hex(readFileSync(join(root, "eval/data/dsA/manifest.json"), "utf8")));
  assert.equal(merged.results.r1?.manifestSha256, sha256Hex(readFileSync(join(root, ".docs/results/r1/manifest.json"), "utf8")));
  assert.equal(merged.results.r1?.class, "D");
  assert.equal(merged.results["p7-e7"]?.class, "R");
});

test("an equal tree gives no difference", () => {
  const root = makeTree();
  assert.deepEqual(checkTree(root, buildMerged(root)), []);
});

test("one changed byte in a results file gives one line that names the file (DW4)", () => {
  const root = makeTree();
  const merged = buildMerged(root);
  append(root, ".docs/results/r1/summary.csv", "9");
  const diffs = checkTree(root, merged);
  assert.equal(diffs.length, 1);
  assert.match(diffs[0] as string, /\.docs\/results\/r1\/summary\.csv/);
  assert.match(diffs[0] as string, /SHA-256/);
});

test("a removed results file gives one line that names the file (DW4)", () => {
  const root = makeTree();
  const merged = buildMerged(root);
  rmSync(join(root, ".docs/results/r2/tables/e1.tex"));
  const diffs = checkTree(root, merged);
  assert.equal(diffs.length, 1);
  assert.match(diffs[0] as string, /\.docs\/results\/r2\/tables\/e1\.tex/);
  assert.match(diffs[0] as string, /missing/);
});

test("a file that its manifest does not list gives one line that names the file", () => {
  const root = makeTree();
  const merged = buildMerged(root);
  put(root, ".docs/results/r2/tables/extra.tex", "x\n");
  const diffs = checkTree(root, merged);
  assert.equal(diffs.length, 1);
  assert.match(diffs[0] as string, /\.docs\/results\/r2\/tables\/extra\.tex/);
  assert.match(diffs[0] as string, /not listed/);
});

test("a changed external file is found in eval/results and named with that path", () => {
  const root = makeTree();
  const merged = buildMerged(root);
  append(root, "eval/results/r1/per_user.csv", "3,0.1\n");
  const diffs = checkTree(root, merged);
  assert.equal(diffs.length, 1);
  assert.match(diffs[0] as string, /eval\/results\/r1\/per_user\.csv/);
});

test("a missing external file is named with its eval/results path", () => {
  const root = makeTree();
  const merged = buildMerged(root);
  rmSync(join(root, "eval/results/r1/per_user.csv"));
  const diffs = checkTree(root, merged);
  assert.equal(diffs.length, 1);
  assert.match(diffs[0] as string, /eval\/results\/r1\/per_user\.csv/);
  assert.match(diffs[0] as string, /missing/);
});

test("a changed results manifest gives one line that names the manifest", () => {
  const root = makeTree();
  const merged = buildMerged(root);
  append(root, ".docs/results/r2/manifest.json", "\n");
  const diffs = checkTree(root, merged);
  assert.equal(diffs.length, 1);
  assert.match(diffs[0] as string, /\.docs\/results\/r2\/manifest\.json/);
});

test("a missing results folder gives one line that names the folder", () => {
  const root = makeTree();
  const merged = buildMerged(root);
  rmSync(join(root, ".docs/results/r2"), { recursive: true });
  const diffs = checkTree(root, merged);
  assert.equal(diffs.length, 1);
  assert.match(diffs[0] as string, /\.docs\/results\/r2/);
  assert.match(diffs[0] as string, /missing/);
});

test("a results folder that the merged manifest does not list gives one line that names it", () => {
  const root = makeTree();
  const merged = buildMerged(root);
  folder(root, ".docs/results/r3", { files: { "a.csv": "a\n1\n" } });
  const diffs = checkTree(root, merged);
  assert.equal(diffs.length, 1);
  assert.match(diffs[0] as string, /\.docs\/results\/r3/);
  assert.match(diffs[0] as string, /not in/);
});

test("a missing dataset, a changed dataset file and a dataset that is not listed each give one line that names it", () => {
  const root = makeTree();
  const merged = buildMerged(root);
  rmSync(join(root, "eval/data/dsB"), { recursive: true });
  append(root, "eval/data/dsA/users.csv", "9\n");
  folder(root, "eval/data/dsC", { files: { "users.csv": "id\n1\n" } });
  const diffs = checkTree(root, merged);
  assert.equal(diffs.length, 3);
  assert.ok(diffs.some((d) => /eval\/data\/dsA\/users\.csv/.test(d)));
  assert.ok(diffs.some((d) => /eval\/data\/dsB/.test(d) && /missing/.test(d)));
  assert.ok(diffs.some((d) => /eval\/data\/dsC/.test(d) && /not in/.test(d)));
});

test("a change in the Class R folder gives no difference (the report step checks those files)", () => {
  const root = makeTree();
  const merged = buildMerged(root);
  append(root, ".docs/results/p7-e7/latency.csv", "social,40.1\n");
  append(root, ".docs/results/p7-e7/manifest.json", "\n");
  put(root, ".docs/results/p7-e7/other.csv", "x\n");
  assert.deepEqual(checkTree(root, merged), []);
  rmSync(join(root, ".docs/results/p7-e7"), { recursive: true });
  assert.deepEqual(checkTree(root, merged), []);
});

test("write mode twice gives the same bytes, and check mode then says equal with the counts", () => {
  const root = makeTree();
  const first = mergedCommand(["--write", "--root", root]);
  const bytes1 = readFileSync(join(root, MERGED), "utf8");
  const second = mergedCommand(["--write", "--root", root]);
  const bytes2 = readFileSync(join(root, MERGED), "utf8");
  assert.equal(bytes1, bytes2);
  assert.deepEqual(first, second);
  assert.ok(bytes1.endsWith("}\n"));
  const check = mergedCommand(["--root", root]);
  // Class D files: 2 dataset manifests + 3 dataset files, 3 + 3 in r1 and r2 (manifest and listed files, r1's external one too).
  assert.match(check[check.length - 1] as string, /^equal: 11 files in 3 folders and 2 datasets$/);
});

test("check mode throws with every difference when the tree changed, and write mode refuses a broken tree", () => {
  const root = makeTree();
  mergedCommand(["--write", "--root", root]);
  append(root, ".docs/results/r1/summary.csv", "9");
  rmSync(join(root, ".docs/results/r2/compare.csv"));
  assert.throws(
    () => mergedCommand(["--root", root]),
    (e: Error) => /\.docs\/results\/r1\/summary\.csv/.test(e.message) && /\.docs\/results\/r2\/compare\.csv/.test(e.message),
  );
  const before = readFileSync(join(root, MERGED), "utf8");
  assert.throws(() => mergedCommand(["--write", "--root", root]), /\.docs\/results\/r2\/compare\.csv/);
  assert.equal(readFileSync(join(root, MERGED), "utf8"), before);
});

test("check mode without a merged manifest says how to make one", () => {
  const root = makeTree();
  assert.equal(existsSync(join(root, MERGED)), false);
  assert.throws(() => mergedCommand(["--root", root]), /results:manifest.*--write/);
});
