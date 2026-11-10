import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { sha256Hex } from "../canonical/csv.ts";
import type { FileEntry } from "../canonical/csv.ts";
import { loadDataset } from "../canonical/dataset.ts";
import { canonicalJson } from "../canonical/manifest.ts";
import { loadFrozen } from "../frozen.ts";
import { defaultDataDir, prepare } from "../harness/run.ts";
import { csvText, writeCsvText } from "../results-csv.ts";
import { PARITY_ALGOS, expectedOrders } from "./expected.ts";
import type { ExpectedRow, ParityParams } from "./expected.ts";
import { bucketCounts, drawParityPairs } from "./sample.ts";
import type { ParityPair } from "./sample.ts";

// The files of the parity sample (design "Parity sample (eval)", "Output"). pairs.csv, expected.csv and manifest.json are
// committed in .docs/results/p6-parity/. orders.csv holds the whole orders, for finding the first difference of a
// mismatch. It goes to the git-ignored eval/results/p6-parity/, and its hash is in the manifest.

export const RUN_ID = "p6-parity";
export const PAIRS_HEADER = ["pair", "user_id", "as_of", "as_of_unix", "bucket", "n_history", "n_followees", "n_communities", "pool_size"] as const;
export const EXPECTED_HEADER = ["pair", "algo", "method", "pool_size", "order_sha256", "top20"] as const;
export const ORDERS_HEADER = ["pair", "algo", "order"] as const;

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
/** 25 pairs in each of the four history buckets of super-plan section 7. */
const PER_BUCKET = 25;
const MAX_DRAWS = 1_000_000;

export interface ParityWriteInput {
  runId: string;
  datasetId: string;
  /** SHA-256 of the manifest.json of the dataset. */
  datasetManifestSha256: string;
  epochSeconds: number;
  /** The epoch plus the smallest post created_at. */
  firstPostUnix: number;
  counts: { users: number; posts: number; interactions: number };
  params: ParityParams;
  pairs: readonly ParityPair[];
  expected: readonly ExpectedRow[];
}

export interface ParityManifest {
  schemaVersion: number;
  runId: string;
  masterSeed: number;
  node: string;
  dataset: { id: string; manifestSha256: string };
  params: ParityParams;
  /** The `algo` of the live feed to the method of @breadit/ranking. */
  methods: Record<string, string>;
  epochSeconds: number;
  firstPostUnix: number;
  counts: { users: number; posts: number; interactions: number };
  files: Record<string, FileEntry>;
  /** Written to the git-ignored folder. Their hash is still in `files`. */
  external: string[];
}

/** The text of the three CSV files. The rows are in the order of the pairs and of the algo map. */
export function parityTexts(i: Pick<ParityWriteInput, "epochSeconds" | "pairs" | "expected">): { pairs: string; expected: string; orders: string } {
  return {
    pairs: csvText(
      PAIRS_HEADER,
      i.pairs.map((p) => [p.pair, p.user, p.asOf, i.epochSeconds + p.asOf, p.bucket, p.nHistory, p.nFollowees, p.nCommunities, p.poolSize].map(String)),
    ),
    expected: csvText(
      EXPECTED_HEADER,
      i.expected.map((r) => [String(r.pair), r.algo, r.method, String(r.poolSize), r.orderSha256, r.top20.join(" ")]),
    ),
    orders: csvText(
      ORDERS_HEADER,
      i.expected.map((r) => [String(r.pair), r.algo, r.order.join(" ")]),
    ),
  };
}

/** Writes pairs.csv, expected.csv and manifest.json to `outDir`, and orders.csv to `externalDir`. Returns the manifest. */
export function writeParity(i: ParityWriteInput, o: { outDir: string; externalDir: string }): ParityManifest {
  const t = parityTexts(i);
  const files: Record<string, FileEntry> = {
    "expected.csv": writeCsvText(o.outDir, "expected.csv", t.expected),
    "orders.csv": writeCsvText(o.externalDir, "orders.csv", t.orders),
    "pairs.csv": writeCsvText(o.outDir, "pairs.csv", t.pairs),
  };
  const manifest: ParityManifest = {
    schemaVersion: 1,
    runId: i.runId,
    masterSeed: loadFrozen().masterSeed,
    node: process.version,
    dataset: { id: i.datasetId, manifestSha256: i.datasetManifestSha256 },
    params: i.params,
    methods: Object.fromEntries(PARITY_ALGOS.map((a) => [a.algo, a.method])),
    epochSeconds: i.epochSeconds,
    firstPostUnix: i.firstPostUnix,
    counts: i.counts,
    files,
    external: ["orders.csv"],
  };
  mkdirSync(o.outDir, { recursive: true });
  writeFileSync(join(o.outDir, "manifest.json"), canonicalJson(manifest), "utf8");
  return manifest;
}

function parseParam(s: string): [string, number] {
  const m = /^([A-Za-z]+)=(.+)$/.exec(s);
  if (!m) throw new Error(`--param needs name=value, got "${s}"`);
  const n = Number(m[2]);
  if (!Number.isFinite(n)) throw new Error(`--param ${m[1]} needs a number, got "${m[2]}"`);
  return [m[1] as string, n];
}

/**
 * `parity [--dataset <id>] --param alpha=<v> --param beta=<v> [--out <dir>] [--data-dir <dir>]`. Draws the pairs, ranks them with
 * the harness code, writes the files and returns the lines to print (design "Parity sample (eval)", "CLI").
 * `m` is the prior strength of frozen-v1.json.
 */
export function parityCommand(argv: string[]): string[] {
  const { values } = parseArgs({
    args: argv,
    options: { dataset: { type: "string" }, param: { type: "string", multiple: true }, out: { type: "string" }, "data-dir": { type: "string" } },
    strict: true,
  });
  const given: Record<string, number> = {};
  for (const p of values.param ?? []) {
    const [name, v] = parseParam(p);
    if (name !== "alpha" && name !== "beta") throw new Error(`--param ${name} is not allowed: only alpha and beta (m comes from frozen-v1.json)`);
    given[name] = v;
  }
  for (const name of ["alpha", "beta"]) {
    if (!(name in given)) throw new Error(`parity needs --param ${name}=<value> (the live feed uses the same value: SOCIAL_PARAMS in the backend)`);
  }
  const frozen = loadFrozen();
  const params: ParityParams = { alpha: given.alpha as number, beta: given.beta as number, m: frozen.priorStrength };
  const datasetId = values.dataset ?? "syn-W2M-M";
  const dataDir = values["data-dir"] !== undefined ? resolve(values["data-dir"]) : defaultDataDir();
  const dir = join(dataDir, datasetId);
  const data = loadDataset(dir);
  const prep = prepare(datasetId, data, "fast");

  const buckets = frozen.historyBuckets.length;
  const pairs = drawParityPairs(prep, data, { n: PER_BUCKET * buckets, perBucket: PER_BUCKET, maxDraws: MAX_DRAWS });
  const expected = expectedOrders(prep, pairs, params);

  const outDir = values.out !== undefined ? resolve(values.out) : join(REPO_ROOT, ".docs", "results", RUN_ID);
  const externalDir = values.out !== undefined ? outDir : join(REPO_ROOT, "eval", "results", RUN_ID);
  let firstPost = Number.POSITIVE_INFINITY;
  for (const p of data.posts) if (p.createdAt < firstPost) firstPost = p.createdAt;
  const manifest = writeParity(
    {
      runId: RUN_ID,
      datasetId,
      datasetManifestSha256: sha256Hex(readFileSync(join(dir, "manifest.json"))),
      epochSeconds: data.manifest.epoch.seconds,
      firstPostUnix: data.manifest.epoch.seconds + firstPost,
      counts: { users: data.users.length, posts: data.posts.length, interactions: data.interactions.length },
      params,
      pairs,
      expected,
    },
    { outDir, externalDir },
  );

  const lines = [`${datasetId}  ${pairs.length} pairs  alpha ${params.alpha}  beta ${params.beta}  m ${params.m}`];
  lines.push("pairs per history bucket");
  for (const b of bucketCounts(pairs)) lines.push(`  ${b.bucket.padEnd(5)}  ${String(b.n).padStart(3)}`);
  lines.push(`results: ${outDir}`);
  lines.push(`not committed: orders.csv in ${externalDir}`);
  for (const name of Object.keys(manifest.files)) lines.push(`${name}  rows ${(manifest.files[name] as FileEntry).rows}  sha256 ${(manifest.files[name] as FileEntry).sha256}`);
  lines.push(`manifest sha256 ${sha256Hex(readFileSync(join(outDir, "manifest.json")))}`);
  return lines;
}
