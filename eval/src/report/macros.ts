import { csvText } from "../results-csv.ts";
import { formatP, roundDecimal } from "./round.ts";
import type { RunFilesMap } from "./read.ts";

// Macros (design "Macros and tables", blueprint 2.8). One macro is one cell of a results CSV, rounded by the rule of round.ts. Every
// macro traces to its cell through macros.csv: name, value, file, row_key, column. The list of macros is a fixed table.

export interface MacroRow {
  name: string;
  /** The cell after `roundDecimal` or `formatP`; counts stay plain integers. */
  value: string;
  /** Relative to .docs/results/: `<runId>/<file>`. */
  file: string;
  /** The key cells of the row, joined with "|", in the order of KEY_COLUMNS. */
  rowKey: string;
  column: string;
}

export interface MacroSpec {
  /** The words of the name: experiment, dataset, metric, K, group, what. A name has letters only. */
  parts: string[];
  run: string;
  file: string;
  /** Key column to value: it finds one row of the file. */
  key: Record<string, string>;
  column: string;
}

/** The columns that name a row of each results file (blueprint 2.7). */
export const KEY_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  "compare.csv": ["dataset", "family", "method", "ref", "k", "bucket"],
  "summary.csv": ["dataset", "split", "method", "k", "bucket"],
  "coverage.csv": ["dataset", "split", "method", "k"],
  "leftout.csv": ["dataset", "split", "bucket"],
  "density.csv": ["dataset", "density_bin", "method", "ref"],
  "tuning.csv": ["dataset", "method", "param", "value"],
};

const LETTERS = /^[A-Za-z]+$/;

/**
 * The name of a macro: its words put together. Letters only, because LaTeX does not allow a digit in a command name. With `used`, a
 * name that is already in the set is an error, and a new name is added to it.
 */
export function macroName(parts: readonly string[], used?: Set<string>): string {
  const name = parts.join("");
  if (name === "") throw new Error("a macro name cannot be empty");
  if (!LETTERS.test(name)) throw new Error(`macro name "${name}" must have letters only (no digit, space or sign)`);
  if (used !== undefined) {
    if (used.has(name)) throw new Error(`macro name "${name}" is used twice`);
    used.add(name);
  }
  return name;
}

/** How a column is written: p-values by `formatP`, counts as they are, every other number to 3 decimals. */
function formatCell(column: string, cell: string): string {
  if (column === "p_holm" || column === "p_raw") return formatP(cell);
  if (column === "n" || column === "n_users" || column === "n_test_users" || column === "n_left_out") return cell;
  return roundDecimal(cell, 3);
}

// ---- the words ----

const DATASET_WORD: Readonly<Record<string, string>> = {
  "syn-W0-M": "WZero",
  "syn-W1-M": "WOne",
  "syn-W2L-M": "WTwoL",
  "syn-W2M-M": "WTwoM",
  "syn-W2H-M": "WTwoH",
  "syn-W2M-M-shuffled": "WTwoMShuffled",
  digg2009: "Digg",
};
const METHOD_WORD: Readonly<Record<string, string>> = {
  BL2: "BLTwo",
  H: "H",
  "H-follow": "HFollow",
  "H-comm": "HComm",
  "H-noauthor": "HNoauthor",
  "H-noengager": "HNoengager",
};
const K_WORD: Readonly<Record<number, string>> = { 5: "Five", 10: "Ten", 20: "Twenty" };
const GROUP_WORD: Readonly<Record<string, string>> = { "0": "Zero", "1-4": "OneFour", "0-4": "ZeroFour", "5-19": "FiveNineteen", "20+": "TwentyPlus", all: "All" };
const WHAT_WORD: Readonly<Record<string, string>> = {
  mean_diff: "Gain",
  ci_low: "CiLow",
  ci_high: "CiHigh",
  p_holm: "PHolm",
  n: "N",
  ndcg: "Value",
  coverage: "Value",
  n_test_users: "N",
  n_left_out: "N",
};

function word<T>(table: Readonly<Record<string | number, T>>, key: string | number, what: string): T {
  const w = table[key];
  if (w === undefined) throw new Error(`no macro word for ${what} "${String(key)}"`);
  return w;
}

const MAIN_DATASETS = ["syn-W2M-M", "digg2009"];

/** A row of compare.csv: the gain of `method` over BL2. `metric` is "Ndcg" or "Ndcg" plus the method word. */
function cmp(exp: string, run: string, dataset: string, family: string, method: string, bucket: string, column: string, metric = "Ndcg"): MacroSpec {
  return {
    parts: [exp, word(DATASET_WORD, dataset, "dataset"), metric, K_WORD[10] as string, word(GROUP_WORD, bucket, "group"), word(WHAT_WORD, column, "column")],
    run,
    file: "compare.csv",
    key: { dataset, family, method, ref: "BL2", k: "10", bucket },
    column,
  };
}

/** A row of summary.csv: NDCG@10 of `method`, all users, on the test split. */
function sum(exp: string, run: string, dataset: string, method: string): MacroSpec {
  return {
    parts: [exp, word(DATASET_WORD, dataset, "dataset"), `Ndcg${word(METHOD_WORD, method, "method")}`, "Ten", "All", "Value"],
    run,
    file: "summary.csv",
    key: { dataset, split: "test", method, k: "10", bucket: "all" },
    column: "ndcg",
  };
}

function build(): MacroSpec[] {
  const out: MacroSpec[] = [];
  // H1 (E2): the F1 row H - BL2, K 10, group 0-4 (gain, interval, p_holm, n), and the groups 0 and 1-4 (gain), both datasets.
  for (const d of MAIN_DATASETS) {
    for (const column of ["mean_diff", "ci_low", "ci_high", "p_holm", "n"]) out.push(cmp("eTwo", "p7-main", d, "F1", "H", "0-4", column));
    for (const g of ["0", "1-4"]) out.push(cmp("eTwo", "p7-main", d, "F1", "H", g, "mean_diff"));
  }
  // H0 gate: K 10, all users: gain and interval.
  for (const column of ["mean_diff", "ci_low", "ci_high"]) out.push(cmp("hZero", "p7-h0", "syn-W0-M", "none", "H", "all", column));
  // E1: NDCG@10 and Coverage@10 of H and BL2.
  for (const d of MAIN_DATASETS) {
    for (const m of ["H", "BL2"]) out.push(sum("eOne", "p7-main", d, m));
    for (const m of ["H", "BL2"]) {
      out.push({
        parts: ["eOne", word(DATASET_WORD, d, "dataset"), `Cov${word(METHOD_WORD, m, "method")}`, "Ten", "All", "Value"],
        run: "p7-main",
        file: "coverage.csv",
        key: { dataset: d, split: "test", method: m, k: "10" },
        column: "coverage",
      });
    }
  }
  // Left out: test users and left out, group all.
  for (const d of MAIN_DATASETS) {
    for (const [column, metric] of [["n_test_users", "TestUsers"], ["n_left_out", "LeftOut"]] as const) {
      out.push({ parts: ["eOne", word(DATASET_WORD, d, "dataset"), metric, "All", "N"], run: "p7-main", file: "leftout.csv", key: { dataset: d, split: "test", bucket: "all" }, column });
    }
  }
  // E3: the gain in the density bins 0 and 20+. The three W2 cells come from p7-e5-worlds, Digg from p7-main (the sources of fig-e3-density.csv).
  for (const [run, d] of [["p7-e5-worlds", "syn-W2L-M"], ["p7-e5-worlds", "syn-W2M-M"], ["p7-e5-worlds", "syn-W2H-M"], ["p7-main", "digg2009"]] as const) {
    for (const bin of ["0", "20+"]) {
      out.push({
        parts: ["eThree", word(DATASET_WORD, d, "dataset"), "Ndcg", "Ten", word(GROUP_WORD, bin, "bin"), "Gain"],
        run,
        file: "density.csv",
        key: { dataset: d, density_bin: bin, method: "H", ref: "BL2" },
        column: "mean_diff",
      });
    }
  }
  // E4: the gain of each ablation (Digg leaves out H-comm: its community term is 0) and of each m of the sweep.
  for (const d of MAIN_DATASETS) {
    for (const m of ["H", "H-follow", "H-comm", "H-noauthor", "H-noengager"]) {
      if (d === "digg2009" && m === "H-comm") continue;
      out.push(cmp("eFour", "p7-e4-terms", d, "none", m, "all", "mean_diff", `Ndcg${word(METHOD_WORD, m, "method")}`));
    }
    for (const [run, mWord] of [["p7-e4-m0", "Zero"], ["p7-e4-m2", "Two"], ["p7-e4-m10", "Ten"]] as const) out.push(cmp("eFour", run, d, "none", "H", "all", "mean_diff", `NdcgHM${mWord}`));
  }
  // E5: the gain and the lower end of the interval in each world, and with the shuffled timestamps.
  for (const [run, d] of [["p7-e5-worlds", "syn-W0-M"], ["p7-e5-worlds", "syn-W1-M"], ["p7-e5-worlds", "syn-W2L-M"], ["p7-e5-worlds", "syn-W2M-M"], ["p7-e5-worlds", "syn-W2H-M"], ["p7-e5-shuffle", "syn-W2M-M-shuffled"]] as const) {
    for (const column of ["mean_diff", "ci_low"]) out.push(cmp("eFive", run, d, "none", "H", "all", column));
  }
  // E6 and E8: NDCG@10 of H and BL2 with the reversed tie-break and with the larger pool.
  for (const d of MAIN_DATASETS) for (const m of ["H", "BL2"]) out.push(sum("eSix", "p7-e6-ties", d, m));
  for (const m of ["H", "BL2"]) out.push(sum("eEight", "p7-e8-pool", "syn-W2M-M", m));
  return out;
}

/** The macros of the report (about 70): the numbers the text is likely to cite. */
export const MACRO_SPECS: readonly MacroSpec[] = build();

function rowKeyOf(file: string, row: Readonly<Record<string, string>>): string {
  const cols = KEY_COLUMNS[file];
  if (cols === undefined) throw new Error(`no key columns for the file ${file}`);
  return cols.map((c) => row[c] as string).join("|");
}

/** The one row of `<run>/<file>` whose key cells equal `key` (a column to value map). */
function findRow(runs: RunFilesMap, run: string, file: string, match: (row: Record<string, string>) => boolean, what: string): Record<string, string> {
  const table = runs.get(run)?.files.get(file);
  if (table === undefined) throw new Error(`${what}: ${run}/${file} is not among the files read`);
  const hits = table.rows.filter(match);
  if (hits.length !== 1) throw new Error(`${what}: ${hits.length} rows in ${run}/${file} match, expected one`);
  return hits[0] as Record<string, string>;
}

/** Builds every macro of `MACRO_SPECS` from the files read, sorted by name. */
export function buildMacros(runs: RunFilesMap): MacroRow[] {
  const used = new Set<string>();
  const rows = MACRO_SPECS.map((s): MacroRow => {
    const name = macroName(s.parts, used);
    const row = findRow(runs, s.run, s.file, (r) => Object.entries(s.key).every(([c, v]) => r[c] === v), `macro ${name}`);
    const cell = row[s.column];
    if (cell === undefined) throw new Error(`macro ${name}: ${s.run}/${s.file} has no column ${s.column}`);
    if (cell === "") throw new Error(`macro ${name}: the cell ${s.column} of ${s.run}/${s.file} (${rowKeyOf(s.file, row)}) is empty`);
    return { name, value: formatCell(s.column, cell), file: `${s.run}/${s.file}`, rowKey: rowKeyOf(s.file, row), column: s.column };
  });
  return rows.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** For each macro: the name is letters only and new, the cell is found again by `file`, `rowKey` and `column`, and it gives the value. */
export function verifyMacros(rows: readonly MacroRow[], runs: RunFilesMap): void {
  const used = new Set<string>();
  for (const m of rows) {
    macroName([m.name], used);
    const slash = m.file.indexOf("/");
    if (slash < 0) throw new Error(`macro ${m.name}: the file "${m.file}" is not <run>/<file>`);
    const run = m.file.slice(0, slash);
    const file = m.file.slice(slash + 1);
    const row = findRow(runs, run, file, (r) => rowKeyOf(file, r) === m.rowKey, `macro ${m.name}`);
    const cell = row[m.column];
    if (cell === undefined || cell === "") throw new Error(`macro ${m.name}: no value in column ${m.column} of ${m.file} (${m.rowKey})`);
    const want = formatCell(m.column, cell);
    if (want !== m.value) throw new Error(`macro ${m.name} is ${m.value}, but its cell ${m.column} of ${m.file} (${m.rowKey}) gives ${want}`);
  }
}

/** macros.csv: name, value, file, row_key, column. */
export function macrosCsv(rows: readonly MacroRow[]): string {
  return csvText(
    ["name", "value", "file", "row_key", "column"],
    rows.map((r) => [r.name, r.value, r.file, r.rowKey, r.column]),
  );
}

/** The text of a value in LaTeX: a minus sign and `<` go in math mode. */
export function latexValue(value: string): string {
  return value.startsWith("<") || value.startsWith("-") ? `$${value}$` : value;
}

/** results-macros.tex: one `\newcommand{\<name>}{<value>}` per macro. */
export function macrosTex(rows: readonly MacroRow[]): string {
  const lines = ["% Written by `npm run report -w @breadit/eval`. Do not edit: change the results and run it again.", ...rows.map((r) => `\\newcommand{\\${r.name}}{${latexValue(r.value)}}`)];
  return lines.join("\n") + "\n";
}
