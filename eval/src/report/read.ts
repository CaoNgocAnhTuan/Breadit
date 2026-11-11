import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "../canonical/csv.ts";

// Reading a run folder for the report (design "Report"). Every file it reads is checked against the SHA-256 in the run manifest
// (F5), so a file edited by hand after its run stops the report. per_user.csv is never read: it can be over the size limit and
// outside git, and the report needs none of it.

export interface CsvTable {
  header: string[];
  /** One record per line: column name to the cell text, as written (no number is parsed). */
  rows: Record<string, string>[];
}

export interface RunFiles {
  runId: string;
  /** SHA-256 of the run's manifest.json. */
  manifestSha256: string;
  /** File name to table, for every CSV the manifest lists except per_user.csv. */
  files: Map<string, CsvTable>;
}

export type RunFilesMap = ReadonlyMap<string, RunFiles>;

/** A results CSV: a header line, then one line per row, UTF-8 and LF. No cell has a comma (the writers refuse it). */
export function parseCsv(text: string, what: string): CsvTable {
  if (!text.endsWith("\n")) throw new Error(`${what} does not end with a line break`);
  const lines = text.slice(0, -1).split("\n");
  const header = (lines[0] as string).split(",");
  const rows = lines.slice(1).map((l, i) => {
    const cells = l.split(",");
    if (cells.length !== header.length) throw new Error(`${what} line ${i + 2} has ${cells.length} cells, the header has ${header.length}`);
    return Object.fromEntries(header.map((h, j) => [h, cells[j] as string]));
  });
  return { header, rows };
}

/** Reads the CSV files of `<resultsDir>/<runId>/` that its manifest lists (not per_user.csv), each checked against the manifest. */
export function readRun(resultsDir: string, runId: string): RunFiles {
  const dir = join(resultsDir, runId);
  const mPath = join(dir, "manifest.json");
  if (!existsSync(mPath)) throw new Error(`${runId}: no manifest.json in ${dir}. Run the harness on ${runId} first`);
  const mText = readFileSync(mPath, "utf8");
  const manifest = JSON.parse(mText) as { files?: Record<string, { sha256: string }> };
  if (manifest.files === undefined) throw new Error(`${runId}: the manifest lists no files`);
  const files = new Map<string, CsvTable>();
  for (const name of Object.keys(manifest.files).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (!name.endsWith(".csv") || name === "per_user.csv") continue;
    const path = join(dir, name);
    if (!existsSync(path)) throw new Error(`${runId}: ${name} is listed in the manifest but missing in ${dir}`);
    const text = readFileSync(path, "utf8");
    const want = (manifest.files[name] as { sha256: string }).sha256;
    if (sha256Hex(text) !== want) {
      throw new Error(`${runId}: ${name} differs from its run manifest (SHA-256 ${sha256Hex(text)}, manifest ${want}). The file was changed after the run`);
    }
    files.set(name, parseCsv(text, `${runId}/${name}`));
  }
  return { runId, manifestSha256: sha256Hex(mText), files };
}
