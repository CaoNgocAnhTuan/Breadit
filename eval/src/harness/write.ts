import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson } from "../canonical/manifest.ts";
import { sha256Hex } from "../canonical/csv.ts";
import type { FileEntry } from "../canonical/csv.ts";
import { loadFrozen } from "../frozen.ts";
import { GROUPS, methodIndex } from "../metrics.ts";
import { csvText, writeCsvText } from "../results-csv.ts";
import type { RunResult } from "./run.ts";

// The results files of blueprint section 2.7 and the run manifest (blueprint section 2.3). Rows are sorted, numbers have
// 6 decimals, line ends are LF. Nothing here reads the clock or the folder name, so two runs write the same bytes.

export const PER_USER_HEADER = ["dataset", "split", "method", "user_id", "bucket", "n_history", "n_followees", "test_post_id", "rank"] as const;
export const SUMMARY_HEADER = ["dataset", "split", "method", "k", "bucket", "n_users", "recall", "ndcg"] as const;
export const COVERAGE_HEADER = ["dataset", "split", "method", "k", "coverage"] as const;
export const LEFTOUT_HEADER = ["dataset", "split", "bucket", "n_test_users", "n_left_out"] as const;

/** per_user.csv stays in git below this size (Spec Open question 4). */
export const PER_USER_COMMIT_LIMIT_BYTES = 5 * 1024 * 1024;

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface ResultTexts {
  perUser: string;
  summary: string;
  coverage: string;
  leftOut: string;
}

/** The text of the four result files of a run, without writing anything. */
export function resultTexts(result: RunResult): ResultTexts {
  const perUser = result.datasets
    .flatMap((d) => d.perUser)
    .sort((a, b) => compareStrings(a.dataset, b.dataset) || compareStrings(a.split, b.split) || methodIndex(a.method) - methodIndex(b.method) || a.userId - b.userId);
  const summary = result.datasets
    .flatMap((d) => d.summary)
    .sort(
      (a, b) =>
        compareStrings(a.dataset, b.dataset) ||
        compareStrings(a.split, b.split) ||
        methodIndex(a.method) - methodIndex(b.method) ||
        a.k - b.k ||
        GROUPS.indexOf(a.bucket) - GROUPS.indexOf(b.bucket),
    );
  const coverage = result.datasets
    .flatMap((d) => d.coverage)
    .sort((a, b) => compareStrings(a.dataset, b.dataset) || compareStrings(a.split, b.split) || methodIndex(a.method) - methodIndex(b.method) || a.k - b.k);
  const leftOut = result.datasets
    .flatMap((d) => d.leftOut)
    .sort((a, b) => compareStrings(a.dataset, b.dataset) || compareStrings(a.split, b.split) || GROUPS.indexOf(a.bucket) - GROUPS.indexOf(b.bucket));
  return {
    perUser: csvText(
      PER_USER_HEADER,
      perUser.map((r) => [r.dataset, r.split, r.method, String(r.userId), r.bucket, String(r.nHistory), String(r.nFollowees), String(r.testPostId), String(r.rank)]),
    ),
    summary: csvText(
      SUMMARY_HEADER,
      summary.map((r) => [r.dataset, r.split, r.method, String(r.k), r.bucket, String(r.nUsers), r.recall, r.ndcg]),
    ),
    coverage: csvText(
      COVERAGE_HEADER,
      coverage.map((r) => [r.dataset, r.split, r.method, String(r.k), r.coverage]),
    ),
    leftOut: csvText(
      LEFTOUT_HEADER,
      leftOut.map((r) => [r.dataset, r.split, r.bucket, String(r.nTestUsers), String(r.nLeftOut)]),
    ),
  };
}

export interface RunManifest {
  schemaVersion: number;
  runId: string;
  masterSeed: number;
  node: string;
  source: { configSha256: string; datasets: Record<string, string> };
  files: Record<string, FileEntry>;
  /** Files written to the git-ignored folder instead of the results folder. Their hash is still in `files`. */
  external?: string[];
}

export interface WriteOptions {
  runId: string;
  /** Committed results folder, .docs/results/<runId>/. */
  outDir: string;
  /** Git-ignored folder for a per_user.csv over the limit, eval/results/<runId>/. */
  externalDir: string;
  /** The text of the run config file, for its SHA-256. */
  configText: string;
  perUserLimitBytes?: number;
  /** Other result files already written to outDir (tuning.csv, compare.csv), for the manifest. */
  extraFiles?: Record<string, FileEntry>;
}

/** Writes the result files and manifest.json (design "Output"). Returns the manifest. */
export function writeResults(result: RunResult, o: WriteOptions): RunManifest {
  const t = resultTexts(result);
  const files: Record<string, FileEntry> = { ...(o.extraFiles ?? {}) };
  files["summary.csv"] = writeCsvText(o.outDir, "summary.csv", t.summary);
  files["coverage.csv"] = writeCsvText(o.outDir, "coverage.csv", t.coverage);
  files["leftout.csv"] = writeCsvText(o.outDir, "leftout.csv", t.leftOut);
  const external: string[] = [];
  const limit = o.perUserLimitBytes ?? PER_USER_COMMIT_LIMIT_BYTES;
  const dir = Buffer.byteLength(t.perUser, "utf8") < limit ? o.outDir : o.externalDir;
  files["per_user.csv"] = writeCsvText(dir, "per_user.csv", t.perUser);
  if (dir !== o.outDir) external.push("per_user.csv");
  const sorted: Record<string, FileEntry> = {};
  for (const name of Object.keys(files).sort(compareStrings)) sorted[name] = files[name] as FileEntry;
  const manifest: RunManifest = {
    schemaVersion: 1,
    runId: o.runId,
    masterSeed: loadFrozen().masterSeed,
    node: process.version,
    source: { configSha256: sha256Hex(o.configText), datasets: result.inputs },
    files: sorted,
    ...(external.length > 0 ? { external } : {}),
  };
  mkdirSync(o.outDir, { recursive: true });
  writeFileSync(join(o.outDir, "manifest.json"), canonicalJson(manifest), "utf8");
  return manifest;
}
