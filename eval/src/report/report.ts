import { parseArgs } from "node:util";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { canonicalJson } from "../canonical/manifest.ts";
import { sha256Hex } from "../canonical/csv.ts";
import { csvText } from "../results-csv.ts";
import { buildMacros, macrosCsv, macrosTex, verifyMacros } from "./macros.ts";
import type { MacroRow } from "./macros.ts";
import { parseCsv, readRun } from "./read.ts";
import type { RunFiles, RunFilesMap } from "./read.ts";
import { buildTables, figE2Rows, figE3Rows, figE5Rows, toLatex, toMarkdown } from "./tables.ts";

// The report (design "Report"): reads the thirteen P7 runs, checks every file against its run manifest, and writes macros.csv,
// results-macros.tex, one table file per table, results.md, the three figure files (fig-e2-history.csv, fig-e3-density.csv and
// fig-e5-worlds.csv) and manifest.json into .docs/results/p7-report/.
// Nothing here reads the clock or the folder name, so two runs write the same bytes.

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;

/** The thirteen runs of P7: two tuning runs, ten test runs and the E7 cost benchmark. */
export const REPORT_RUNS: readonly string[] = [
  "p7-tune-main",
  "p7-tune-worlds",
  "p7-h0",
  "p7-main",
  "p7-e5-worlds",
  "p7-e4-terms",
  "p7-e4-m0",
  "p7-e4-m2",
  "p7-e4-m10",
  "p7-e6-ties",
  "p7-e8-pool",
  "p7-e5-shuffle",
  "p7-e7",
];

// The three figure files have the same columns; the second one names the bin (E3), the history group (E2) or the variant (E5).
const FIG_HEADER = ["dataset", "bin", "n", "mean_diff", "ci_low", "ci_high"] as const;
const FIG_E5_HEADER = ["dataset", "variant", "n", "mean_diff", "ci_low", "ci_high"] as const;

function resultsMd(tables: { caption: string; id: string; md: string }[], macros: readonly MacroRow[]): string {
  const lines = ["# P7 results", "", "Written by `npm run report -w @breadit/eval` from the results of the thirteen P7 runs. Do not edit: change the results and run it again.", ""];
  for (const t of tables) lines.push(`## ${t.id}: ${t.caption}`, "", t.md);
  lines.push("## Macros", "", "| Macro | Value | Cell |", "| --- | ---: | --- |");
  for (const m of macros) lines.push(`| \\${m.name} | ${m.value} | ${m.file} ${m.rowKey} ${m.column} |`);
  return lines.join("\n") + "\n";
}

/**
 * `report [--results-dir <dir>] [--out <dir>]`. Reads the runs of `REPORT_RUNS` from the results folder (default .docs/results), and writes
 * the report into `--out` (default <results-dir>/p7-report). It checks each macro against its cell after writing, and stops on a mismatch.
 */
export function reportCommand(argv: string[]): string[] {
  const { values } = parseArgs({ args: argv, options: { "results-dir": { type: "string" }, out: { type: "string" } }, strict: true });
  const resultsDir = values["results-dir"] !== undefined ? resolve(values["results-dir"]) : join(REPO_ROOT, ".docs", "results");
  const outDir = values.out !== undefined ? resolve(values.out) : join(resultsDir, "p7-report");

  const runs: RunFilesMap = new Map<string, RunFiles>(REPORT_RUNS.map((id) => [id, readRun(resultsDir, id)]));
  const macros = buildMacros(runs);
  const tables = buildTables(runs);
  const fig = figE3Rows(runs);
  const figE2 = figE2Rows(runs);
  const figE5 = figE5Rows(runs);

  const files: Record<string, string> = {};
  files["macros.csv"] = macrosCsv(macros);
  files["results-macros.tex"] = macrosTex(macros);
  for (const t of tables) files[`tables/${t.id}.tex`] = toLatex(t);
  files["results.md"] = resultsMd(
    tables.map((t) => ({ id: t.id, caption: t.caption, md: toMarkdown(t) })),
    macros,
  );
  files["fig-e2-history.csv"] = csvText(
    FIG_HEADER,
    figE2.map((r) => [r.dataset, r.bin, r.n, r.mean_diff, r.ci_low, r.ci_high]),
  );
  files["fig-e3-density.csv"] = csvText(
    FIG_HEADER,
    fig.map((r) => [r.dataset, r.bin, r.n, r.mean_diff, r.ci_low, r.ci_high]),
  );
  files["fig-e5-worlds.csv"] = csvText(
    FIG_E5_HEADER,
    figE5.map((r) => [r.dataset, r.variant, r.n, r.mean_diff, r.ci_low, r.ci_high]),
  );

  const entries: Record<string, { rows: number; sha256: string }> = {};
  for (const name of Object.keys(files).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const text = files[name] as string;
    mkdirSync(join(outDir, name, ".."), { recursive: true });
    writeFileSync(join(outDir, name), text, "utf8");
    entries[name] = { rows: text.split("\n").length - 1, sha256: sha256Hex(text) };
  }
  const inputs = Object.fromEntries(REPORT_RUNS.map((id) => [id, (runs.get(id) as RunFiles).manifestSha256]));
  writeFileSync(join(outDir, "manifest.json"), canonicalJson({ schemaVersion: 1, inputs, files: entries }), "utf8");

  // Read the written macros again: each one must still find its cell and give its value (DW10).
  const written = parseCsv(readFileSync(join(outDir, "macros.csv"), "utf8"), "macros.csv").rows.map(
    (r): MacroRow => ({ name: r.name as string, value: r.value as string, file: r.file as string, rowKey: r.row_key as string, column: r.column as string }),
  );
  verifyMacros(written, runs);
  const tex = readFileSync(join(outDir, "results-macros.tex"), "utf8");
  const commands = tex.split("\n").filter((l) => l.startsWith("\\newcommand")).length;
  if (commands !== written.length) throw new Error(`results-macros.tex has ${commands} \\newcommand lines, macros.csv has ${written.length} rows`);

  return [
    `report: ${macros.length} macros, ${tables.length} tables, ${fig.length} figure rows, from ${REPORT_RUNS.length} runs`,
    `macros verified: ${written.length} of ${written.length} found their cell again`,
    `results: ${outDir}`,
    `manifest sha256 ${sha256Hex(readFileSync(join(outDir, "manifest.json")))}`,
  ];
}
