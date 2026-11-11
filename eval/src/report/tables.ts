import { BUCKET_LABELS } from "../checks/buckets.ts";
import { loadFrozen } from "../frozen.ts";
import { GROUPS, METHOD_ORDER } from "../metrics.ts";
import { latexValue } from "./macros.ts";
import type { RunFilesMap } from "./read.ts";
import { formatP, roundDecimal } from "./round.ts";

// The tables of Chapter 5 and the appendix (design "Macros and tables"). Each is built once from the results CSVs and written twice: as a
// booktabs tabular for the thesis and as a Markdown table for the drafts. Both use roundDecimal and formatP, so the two files and the
// macros never disagree on a rounded number.

export type CellKind = "text" | "int" | "dec" | "p";

export interface Cell {
  /** The text of the CSV cell, as it was written. */
  v: string;
  kind: CellKind;
}

export interface Table {
  id: string;
  caption: string;
  columns: string[];
  rows: Cell[][];
}

const text = (v: string): Cell => ({ v, kind: "text" });
const int = (v: string): Cell => ({ v, kind: "int" });
const dec = (v: string): Cell => ({ v, kind: "dec" });
const pval = (v: string): Cell => ({ v, kind: "p" });

/** The text a reader sees: 3 decimals for a number, `<0.001` for a small p, a count as it is. An empty cell stays empty. */
export function cellText(c: Cell): string {
  if (c.v === "") return "";
  if (c.kind === "dec") return roundDecimal(c.v, 3);
  if (c.kind === "p") return formatP(c.v);
  return c.v;
}

const LATEX_SPECIAL: Readonly<Record<string, string>> = { "\\": "\\textbackslash{}", "&": "\\&", "%": "\\%", $: "\\$", "#": "\\#", _: "\\_", "{": "\\{", "}": "\\}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}" };

function latexEscape(s: string): string {
  return s.replace(/[\\&%$#_{}~^]/g, (c) => LATEX_SPECIAL[c] as string);
}

function latexCell(c: Cell): string {
  const t = cellText(c);
  return c.kind === "text" ? latexEscape(t) : latexValue(t);
}

/** A booktabs `tabular` with no float around it, so the author adds the caption and the label. */
export function toLatex(t: Table): string {
  const spec = t.columns.map((_, j) => ((t.rows[0] as Cell[] | undefined)?.[j]?.kind ?? "text") === "text" ? "l" : "r").join("");
  const lines = [`% ${t.id}: ${t.caption}`, `\\begin{tabular}{${spec}}`, "\\toprule", t.columns.map(latexEscape).join(" & ") + " \\\\", "\\midrule"];
  for (const row of t.rows) lines.push(row.map(latexCell).join(" & ") + " \\\\");
  lines.push("\\bottomrule", "\\end{tabular}");
  return lines.join("\n") + "\n";
}

/** The same table as Markdown. */
export function toMarkdown(t: Table): string {
  const align = t.columns.map((_, j) => (((t.rows[0] as Cell[] | undefined)?.[j]?.kind ?? "text") === "text" ? "---" : "---:"));
  const lines = [`| ${t.columns.join(" | ")} |`, `| ${align.join(" | ")} |`];
  for (const row of t.rows) lines.push(`| ${row.map(cellText).join(" | ")} |`);
  return lines.join("\n") + "\n";
}

// ---- reading the results ----

type Rec = Readonly<Record<string, string>>;

function rowsOf(runs: RunFilesMap, run: string, file: string): readonly Rec[] {
  const table = runs.get(run)?.files.get(file);
  if (table === undefined) throw new Error(`${run}/${file} is not among the files read`);
  return table.rows;
}

function pick(rows: readonly Rec[], key: Record<string, string>, what: string): Rec {
  const hits = rows.filter((r) => Object.entries(key).every(([c, v]) => r[c] === v));
  if (hits.length !== 1) throw new Error(`${what}: ${hits.length} rows match ${JSON.stringify(key)}, expected one`);
  return hits[0] as Rec;
}

function cellOf(r: Rec, column: string, what: string): string {
  const v = r[column];
  if (v === undefined) throw new Error(`${what}: no column ${column}`);
  return v;
}

const DATASET_ORDER = ["syn-W0-M", "syn-W1-M", "syn-W2L-M", "syn-W2M-M", "syn-W2H-M", "digg2009"];
const MAIN = ["syn-W2M-M", "digg2009"];
const NINE = ["BL0", "BL1", "BL2", "BL2t", "BL3", "BL4", "BL5", "BL6", "H"];
const F1_GROUPS = GROUPS.filter((g) => g !== "all");

function orderIndex(order: readonly string[], v: string): number {
  const i = order.indexOf(v);
  return i < 0 ? order.length : i;
}

/** NDCG@10 or Recall@10 of one method on the test split (all users unless `group` says otherwise). */
function summaryCell(runs: RunFilesMap, run: string, dataset: string, method: string, column: "ndcg" | "recall", group = "all"): string {
  return cellOf(pick(rowsOf(runs, run, "summary.csv"), { dataset, method, k: "10", bucket: group }, `${run}/summary.csv`), column, `${run}/summary.csv`);
}

// ---- the E3 figure data ----

export interface FigRow {
  dataset: string;
  bin: string;
  n: string;
  mean_diff: string;
  ci_low: string;
  ci_high: string;
}

/** The four datasets of the E3 figure (DW6): the three W2 cells from p7-e5-worlds and Digg from p7-main, four density bins each. */
export function figE3Rows(runs: RunFilesMap): FigRow[] {
  const sources: Array<[string, string]> = [["p7-e5-worlds", "syn-W2L-M"], ["p7-e5-worlds", "syn-W2M-M"], ["p7-e5-worlds", "syn-W2H-M"], ["p7-main", "digg2009"]];
  const out: FigRow[] = [];
  for (const [run, dataset] of sources) {
    const density = rowsOf(runs, run, "density.csv");
    for (const bin of BUCKET_LABELS) {
      const r = pick(density, { dataset, density_bin: bin, method: "H", ref: "BL2" }, `${run}/density.csv`);
      out.push({ dataset, bin, n: cellOf(r, "n", "density.csv"), mean_diff: cellOf(r, "mean_diff", "density.csv"), ci_low: cellOf(r, "ci_low", "density.csv"), ci_high: cellOf(r, "ci_high", "density.csv") });
    }
  }
  return out;
}

// ---- the nine tables ----

function tuningTable(runs: RunFilesMap): Table {
  const rows = ["p7-tune-main", "p7-tune-worlds"].flatMap((run) => rowsOf(runs, run, "tuning.csv").filter((r) => r.chosen === "1"));
  rows.sort(
    (a, b) =>
      orderIndex(DATASET_ORDER, a.dataset as string) - orderIndex(DATASET_ORDER, b.dataset as string) ||
      orderIndex(METHOD_ORDER, a.method as string) - orderIndex(METHOD_ORDER, b.method as string),
  );
  return {
    id: "tuning",
    caption: "Values chosen on the validation split (the highest NDCG@10, a tie to the smaller value)",
    columns: ["Dataset", "Method", "Parameter", "Value", "Validation NDCG@10"],
    rows: rows.map((r) => [text(r.dataset as string), text(r.method as string), text(r.param as string), text(r.value as string), dec(r.val_ndcg10 as string)]),
  };
}

function leftoutTable(runs: RunFilesMap): Table {
  const left = rowsOf(runs, "p7-main", "leftout.csv");
  const rows: Cell[][] = [];
  for (const dataset of MAIN) {
    for (const group of GROUPS) {
      const r = pick(left, { dataset, bucket: group }, "p7-main/leftout.csv");
      rows.push([text(dataset), text(group), int(cellOf(r, "n_test_users", "leftout")), int(cellOf(r, "n_left_out", "leftout"))]);
    }
  }
  return { id: "leftout", caption: "Test users and users left out of the pool, by history group", columns: ["Dataset", "Group", "Test users", "Left out"], rows };
}

function e1Table(runs: RunFilesMap): Table {
  const columns = ["Method", ...MAIN.flatMap((d) => [`${d} NDCG@10`, `${d} Recall@10`, `${d} Coverage@10`])];
  const rows = NINE.map((method) => [
    text(method),
    ...MAIN.flatMap((dataset) => [
      dec(summaryCell(runs, "p7-main", dataset, method, "ndcg")),
      dec(summaryCell(runs, "p7-main", dataset, method, "recall")),
      dec(cellOf(pick(rowsOf(runs, "p7-main", "coverage.csv"), { dataset, method, k: "10" }, "p7-main/coverage.csv"), "coverage", "coverage")),
    ]),
  ]);
  return { id: "e1", caption: "All methods on the test split, all users (K = 10)", columns, rows };
}

function e2Table(runs: RunFilesMap): Table {
  const compare = rowsOf(runs, "p7-main", "compare.csv");
  const rows: Cell[][] = [];
  for (const dataset of MAIN) {
    for (const group of F1_GROUPS) {
      const f1 = pick(compare, { dataset, family: "F1", method: "H", ref: "BL2", k: "10", bucket: group }, "p7-main/compare.csv");
      rows.push([
        text(dataset),
        text(group),
        int(cellOf(f1, "n", "compare")),
        dec(summaryCell(runs, "p7-main", dataset, "BL2", "ndcg", group)),
        dec(summaryCell(runs, "p7-main", dataset, "H", "ndcg", group)),
        dec(cellOf(f1, "mean_diff", "compare")),
        dec(cellOf(f1, "ci_low", "compare")),
        dec(cellOf(f1, "ci_high", "compare")),
        pval(cellOf(f1, "p_holm", "compare")),
      ]);
    }
  }
  return {
    id: "e2",
    caption: "H against BL2 by history group, NDCG@10 (family F1, Holm-adjusted p)",
    columns: ["Dataset", "Group", "Users", "BL2", "H", "Gain", "CI low", "CI high", "p (Holm)"],
    rows,
  };
}

function e3Table(runs: RunFilesMap): Table {
  return {
    id: "e3",
    caption: "Gain of H over BL2 by social density (number of followees), NDCG@10",
    columns: ["Dataset", "Followees", "Users", "Gain", "CI low", "CI high"],
    rows: figE3Rows(runs).map((r) => [text(r.dataset), text(r.bin), int(r.n), dec(r.mean_diff), dec(r.ci_low), dec(r.ci_high)]),
  };
}

function e4Table(runs: RunFilesMap): Table {
  const m = loadFrozen().priorStrength;
  const rows: Cell[][] = [];
  for (const dataset of MAIN) {
    const variants: Array<{ label: string; run: string; method: string }> = [
      { label: "BL2", run: "p7-e4-terms", method: "BL2" },
      { label: `H (m = ${m})`, run: "p7-e4-terms", method: "H" },
      ...["H-follow", "H-comm", "H-noauthor", "H-noengager"].map((method) => ({ label: method, run: "p7-e4-terms", method })),
      ...[0, 2, 10].map((v) => ({ label: `H (m = ${v})`, run: `p7-e4-m${v}`, method: "H" })),
    ];
    for (const v of variants) {
      if (dataset === "digg2009" && v.method === "H-comm") continue; // the community term is 0 on Digg
      const gain = v.method === "BL2" ? "" : cellOf(pick(rowsOf(runs, v.run, "compare.csv"), { dataset, method: v.method, ref: "BL2", k: "10", bucket: "all" }, `${v.run}/compare.csv`), "mean_diff", "compare");
      rows.push([text(dataset), text(v.label), dec(summaryCell(runs, v.run, dataset, v.method, "ndcg")), dec(summaryCell(runs, v.run, dataset, v.method, "ndcg", "0-4")), dec(gain)]);
    }
  }
  return { id: "e4", caption: "Terms of H and the prior strength m, NDCG@10 (gain over BL2, all users)", columns: ["Dataset", "Variant", "NDCG@10 all", "NDCG@10 0-4", "Gain over BL2"], rows };
}

function e5Table(runs: RunFilesMap): Table {
  const rows: Cell[][] = [];
  const add = (label: string, run: string, dataset: string): void => {
    const r = pick(rowsOf(runs, run, "compare.csv"), { dataset, method: "H", ref: "BL2", k: "10", bucket: "all" }, `${run}/compare.csv`);
    rows.push([text(label), text(dataset), int(cellOf(r, "n", "compare")), dec(cellOf(r, "mean_diff", "compare")), dec(cellOf(r, "ci_low", "compare")), dec(cellOf(r, "ci_high", "compare"))]);
  };
  for (const dataset of ["syn-W0-M", "syn-W1-M", "syn-W2L-M", "syn-W2M-M", "syn-W2H-M"]) add("own tuning", "p7-e5-worlds", dataset);
  add("H0 gate (values of syn-W2M-M)", "p7-h0", "syn-W0-M");
  add("timestamps shuffled", "p7-e5-shuffle", "syn-W2M-M-shuffled");
  return { id: "e5", caption: "Gain of H over BL2 in each world, NDCG@10 (K = 10, all users, no p-value)", columns: ["Run", "Dataset", "Users", "Gain", "CI low", "CI high"], rows };
}

function e6Table(runs: RunFilesMap): Table {
  const columns = ["Method", ...MAIN.flatMap((d) => [`${d} normal`, `${d} reversed ties`])];
  const rows = NINE.map((method) => [
    text(method),
    ...MAIN.flatMap((dataset) => [dec(summaryCell(runs, "p7-main", dataset, method, "ndcg")), dec(summaryCell(runs, "p7-e6-ties", dataset, method, "ndcg"))]),
  ]);
  return { id: "e6", caption: "NDCG@10, all users, with the normal and the reversed tie-break", columns, rows };
}

function e8Table(runs: RunFilesMap): Table {
  const methods = [...new Set(rowsOf(runs, "p7-e8-pool", "summary.csv").map((r) => r.method as string))].sort((a, b) => METHOD_ORDER.indexOf(a) - METHOD_ORDER.indexOf(b));
  const dataset = "syn-W2M-M";
  const rows = methods.map((method) => [
    text(method),
    dec(summaryCell(runs, "p7-main", dataset, method, "ndcg")),
    dec(summaryCell(runs, "p7-main", dataset, method, "ndcg", "0-4")),
    dec(summaryCell(runs, "p7-e8-pool", dataset, method, "ndcg")),
    dec(summaryCell(runs, "p7-e8-pool", dataset, method, "ndcg", "0-4")),
  ]);
  return { id: "e8", caption: `NDCG@10 on ${dataset} with the normal and the larger pool`, columns: ["Method", "Normal, all", "Normal, 0-4", "Larger pool, all", "Larger pool, 0-4"], rows };
}

/** The nine tables, in the order of the design. */
export function buildTables(runs: RunFilesMap): Table[] {
  return [tuningTable(runs), leftoutTable(runs), e1Table(runs), e2Table(runs), e3Table(runs), e4Table(runs), e5Table(runs), e6Table(runs), e8Table(runs)];
}
