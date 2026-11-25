import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { sha256Hex } from "./canonical/csv.ts";
import { canonicalJson } from "./canonical/manifest.ts";
import { f6, ndcgAt, recallAt } from "./metrics.ts";
import { parseCsv } from "./report/read.ts";
import { csvText } from "./results-csv.ts";
import { pairedBootstrap, statOpts } from "./stats.ts";
import type { StatOpts } from "./stats.ts";

// The group comparison of the supervisor's Orientation (step 5): H against BL2 for users with 5 or fewer earlier interactions and for
// users with more than 20. These bounds are not the frozen history buckets (super-plan section 7), and they were chosen after the test
// run, so the result is exploratory: a mean, a paired bootstrap interval with the frozen settings, and no p-value. It reads the per-user
// ranks of the run p7-main (per_user.csv) after checking their SHA-256 against the run manifest, and writes .docs/results/p9-orient-groups/.
// It reads no clock and no other file, so two runs write the same bytes.

export const ORIENT_RUN = "p9-orient-groups";
export const ORIENT_SOURCE_RUN = "p7-main";
export const ORIENT_K = 10;
export const ORIENT_METHOD = "H";
export const ORIENT_REF = "BL2";

/** The two groups of the Orientation, as labels in the style of the history buckets: "<= 5" is 0-5, "> 20" is 21+. */
export const ORIENT_GROUPS: ReadonlyArray<{ label: string; test: (nHistory: number) => boolean }> = [
  { label: "0-5", test: (h) => h <= 5 },
  { label: "21+", test: (h) => h > 20 },
];
const METRICS: ReadonlyArray<{ label: string; score: (rank: number) => number }> = [
  { label: "recall", score: (r) => recallAt(r, ORIENT_K) },
  { label: "ndcg", score: (r) => ndcgAt(r, ORIENT_K) },
];

export const GROUPS_HEADER = ["dataset", "group", "metric", "k", "n", "h", "bl2", "mean_diff", "ci_low", "ci_high"] as const;

/** The Orientation group of a user with `nHistory` earlier interactions, or null (6 to 20 are in neither group). */
export function orientGroup(nHistory: number): string | null {
  if (!Number.isInteger(nHistory) || nHistory < 0) throw new Error(`n_history must be an integer >= 0, got ${nHistory}`);
  for (const g of ORIENT_GROUPS) if (g.test(nHistory)) return g.label;
  return null;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function mean(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/**
 * The rows of groups.csv from the text of per_user.csv: for each dataset (sorted), group (in ORIENT_GROUPS order) and metric (recall,
 * then ndcg), the users of the test split that have a rank for both H and BL2, in the order of their H rows in the file. Every value
 * has 6 decimals.
 */
export function groupRows(perUserText: string, o: Pick<StatOpts, "masterSeed" | "resamples" | "level">): string[][] {
  const table = parseCsv(perUserText, "per_user.csv");
  for (const c of ["dataset", "split", "method", "user_id", "n_history", "rank"]) {
    if (!table.header.includes(c)) throw new Error(`per_user.csv has no column ${c}`);
  }
  // dataset -> user id -> rank and history of the reference; the H rows in file order.
  const ref = new Map<string, Map<string, { rank: number; history: number }>>();
  const hRows: Array<{ dataset: string; user: string; rank: number; history: number }> = [];
  for (const r of table.rows) {
    if (r.split !== "test") continue;
    const row = { dataset: r.dataset as string, user: r.user_id as string, rank: Number(r.rank), history: Number(r.n_history) };
    if (r.method === ORIENT_REF) {
      let m = ref.get(row.dataset);
      if (m === undefined) ref.set(row.dataset, (m = new Map()));
      if (m.has(row.user)) throw new Error(`per_user.csv has two ${ORIENT_REF} rows for user ${row.user} of ${row.dataset}`);
      m.set(row.user, { rank: row.rank, history: row.history });
    } else if (r.method === ORIENT_METHOD) {
      hRows.push(row);
    }
  }
  const out: string[][] = [];
  const datasets = [...new Set(hRows.map((r) => r.dataset))].sort(compareStrings);
  for (const dataset of datasets) {
    const refs = ref.get(dataset);
    if (refs === undefined) throw new Error(`per_user.csv has ${ORIENT_METHOD} rows but no ${ORIENT_REF} rows for ${dataset}`);
    const users = hRows.filter((r) => r.dataset === dataset);
    if (users.length !== refs.size) throw new Error(`${dataset}: ${users.length} ${ORIENT_METHOD} rows and ${refs.size} ${ORIENT_REF} rows`);
    for (const g of ORIENT_GROUPS) {
      const pairs: Array<{ h: number; b: number }> = [];
      for (const u of users) {
        const b = refs.get(u.user);
        if (b === undefined) throw new Error(`${dataset}: user ${u.user} has no ${ORIENT_REF} row`);
        if (b.history !== u.history) throw new Error(`${dataset}: user ${u.user} has n_history ${u.history} for ${ORIENT_METHOD} and ${b.history} for ${ORIENT_REF}`);
        if (orientGroup(u.history) === g.label) pairs.push({ h: u.rank, b: b.rank });
      }
      if (pairs.length === 0) throw new Error(`${dataset}: no user in group ${g.label}`);
      for (const metric of METRICS) {
        const h = pairs.map((p) => metric.score(p.h));
        const b = pairs.map((p) => metric.score(p.b));
        const d = h.map((x, i) => x - (b[i] as number));
        const boot = pairedBootstrap(d, o);
        out.push([dataset, g.label, metric.label, String(ORIENT_K), String(pairs.length), f6(mean(h)), f6(mean(b)), f6(boot.meanDiff), f6(boot.ciLow), f6(boot.ciHigh)]);
      }
    }
  }
  return out;
}

interface SourceManifest {
  files: Record<string, { sha256: string }>;
  external?: string[];
}

/**
 * `orient [--results-dir <dir>] [--raw-dir <dir>]`. Reads <results-dir>/p7-main/manifest.json and the per_user.csv it lists (in
 * <raw-dir>/p7-main/ when the manifest marks it external), checks its SHA-256, and writes <results-dir>/p9-orient-groups/groups.csv and
 * manifest.json. Defaults: .docs/results and eval/results. Nothing is written when the check fails.
 */
export function orientCommand(argv: string[]): string[] {
  const { values } = parseArgs({ args: argv, options: { "results-dir": { type: "string" }, "raw-dir": { type: "string" } }, strict: true });
  const root = new URL("../../", import.meta.url).pathname;
  const resultsDir = values["results-dir"] !== undefined ? resolve(values["results-dir"]) : join(root, ".docs", "results");
  const rawDir = values["raw-dir"] !== undefined ? resolve(values["raw-dir"]) : join(root, "eval", "results");

  const manifestPath = join(resultsDir, ORIENT_SOURCE_RUN, "manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`${manifestPath} does not exist: run the harness for ${ORIENT_SOURCE_RUN} first`);
  const manifestText = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText) as SourceManifest;
  const entry = manifest.files["per_user.csv"];
  if (entry === undefined) throw new Error(`${ORIENT_SOURCE_RUN}/manifest.json lists no per_user.csv`);
  const external = (manifest.external ?? []).includes("per_user.csv");
  const perUserPath = join(external ? rawDir : resultsDir, ORIENT_SOURCE_RUN, "per_user.csv");
  if (!existsSync(perUserPath)) throw new Error(`${perUserPath} does not exist: run the harness for ${ORIENT_SOURCE_RUN} again`);
  const perUserText = readFileSync(perUserPath, "utf8");
  const perUserSha = sha256Hex(perUserText);
  if (perUserSha !== entry.sha256) throw new Error(`${perUserPath} has SHA-256 ${perUserSha}, but ${ORIENT_SOURCE_RUN}/manifest.json lists ${entry.sha256}`);

  const o = statOpts();
  const text = csvText(GROUPS_HEADER, groupRows(perUserText, o));
  const outDir = join(resultsDir, ORIENT_RUN);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "groups.csv"), text, "utf8");
  const out = {
    schemaVersion: 1,
    runId: ORIENT_RUN,
    masterSeed: o.masterSeed,
    node: process.version,
    source: { inputs: { [`${ORIENT_SOURCE_RUN}/manifest.json`]: sha256Hex(manifestText), [`${ORIENT_SOURCE_RUN}/per_user.csv`]: perUserSha } },
    files: { "groups.csv": { rows: text.split("\n").length - 2, sha256: sha256Hex(text) } },
  };
  writeFileSync(join(outDir, "manifest.json"), canonicalJson(out), "utf8");
  return [`orient: ${text.split("\n").length - 2} rows from ${perUserPath}`, `results: ${outDir}`, `groups.csv sha256 ${sha256Hex(text)}`];
}
