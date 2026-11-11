import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPORT_RUNS, reportCommand } from "./report.ts";
import { FIXTURE_RUNS, editResultsFile, writeResultsFixture } from "./fixture.ts";
import { buildTables, cellText, toLatex, toMarkdown } from "./tables.ts";
import type { Table } from "./tables.ts";
import { readRun } from "./read.ts";
import { parseCsv } from "./read.ts";
import { sha256Hex } from "../canonical/csv.ts";
import { tempDir } from "../checks/fixture.ts";

// TC11 (design DW6, DW9, DW10): the report on a hand-made results folder for the twelve run ids.
const TABLE_IDS = ["tuning", "leftout", "e1", "e2", "e3", "e4", "e5", "e6", "e8"];
const FILES = ["fig-e3-density.csv", "macros.csv", "manifest.json", "results-macros.tex", "results.md", ...TABLE_IDS.map((t) => `tables/${t}.tex`)];

function report(dir: string, out: string): string[] {
  return reportCommand(["--results-dir", dir, "--out", out]);
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.isDirectory()) out.push(...listFiles(join(dir, name.name)).map((f) => `${name.name}/${f}`));
    else out.push(name.name);
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

test("REPORT_RUNS is the twelve runs of P7, and the fixture has the same twelve", () => {
  assert.equal(REPORT_RUNS.length, 12);
  assert.deepEqual([...REPORT_RUNS], FIXTURE_RUNS.map((r) => r.id));
});

test("the report writes every file of the design and a manifest with their SHA-256 and the run manifests' SHA-256", () => {
  const dir = tempDir();
  writeResultsFixture(dir);
  const out = tempDir();
  const lines = report(dir, out);
  assert.deepEqual(listFiles(out), [...FILES].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  assert.ok(lines.some((l) => /^macros verified: \d+ of \d+ found their cell again$/.test(l)), lines.join("\n"));
  const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")) as { files: Record<string, { rows: number; sha256: string }>; inputs: Record<string, string> };
  assert.deepEqual(Object.keys(manifest.files).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), FILES.filter((f) => f !== "manifest.json").sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  for (const [name, e] of Object.entries(manifest.files)) assert.equal(e.sha256, sha256Hex(readFileSync(join(out, name), "utf8")), name);
  assert.deepEqual(Object.keys(manifest.inputs).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), [...REPORT_RUNS].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  for (const run of REPORT_RUNS) assert.equal(manifest.inputs[run], sha256Hex(readFileSync(join(dir, run, "manifest.json"), "utf8")), run);
  // macros.csv and results-macros.tex agree: as many \newcommand lines as rows
  const macros = parseCsv(readFileSync(join(out, "macros.csv"), "utf8"), "macros.csv");
  assert.deepEqual(macros.header, ["name", "value", "file", "row_key", "column"]);
  for (const r of macros.rows) assert.match(r.name as string, /^[A-Za-z]+$/);
  const tex = readFileSync(join(out, "results-macros.tex"), "utf8");
  assert.equal(tex.split("\n").filter((l) => l.startsWith("\\newcommand")).length, macros.rows.length);
  // every macro is in results.md with its value
  const md = readFileSync(join(out, "results.md"), "utf8");
  for (const r of macros.rows) assert.ok(md.includes(`| \\${r.name} | ${r.value} |`), r.name);
});

test("two runs give byte-identical files", () => {
  const dir = tempDir();
  writeResultsFixture(dir);
  const a = tempDir();
  const b = tempDir();
  report(dir, a);
  report(dir, b);
  for (const f of FILES) assert.equal(readFileSync(join(a, f), "utf8"), readFileSync(join(b, f), "utf8"), f);
  // and a rewritten fixture folder gives the same bytes too
  const dir2 = tempDir();
  writeResultsFixture(dir2);
  const c = tempDir();
  report(dir2, c);
  for (const f of FILES) assert.equal(readFileSync(join(a, f), "utf8"), readFileSync(join(c, f), "utf8"), f);
});

test("an input file that differs from its run manifest stops the report, and so does a missing run", () => {
  for (const [run, file] of [["p7-main", "summary.csv"], ["p7-tune-worlds", "tuning.csv"], ["p7-e8-pool", "compare.csv"], ["p7-e5-worlds", "density.csv"]]) {
    const dir = tempDir();
    writeResultsFixture(dir);
    editResultsFile(dir, run as string, file as string, (t) => t.replace(/0\.(\d)/, "0.9$1"));
    const out = tempDir();
    assert.throws(() => report(dir, out), (e: Error) => e.message.includes(run as string) && e.message.includes(file as string) && /manifest/.test(e.message), `${run}/${file}`);
    assert.deepEqual(readdirSync(out), [], "nothing was written");
  }
  const dir = tempDir();
  writeResultsFixture(dir);
  editResultsFile(dir, "p7-h0", "compare.csv", (t) => t.replace(/^(syn-W0-M,none,H,BL2,10,all,\d+,)[^,]+/m, "$10.123456"), true);
  report(dir, tempDir()); // a rewritten run with its manifest fixed is read as it is
  const noRun = tempDir();
  writeResultsFixture(noRun);
  const full = readRun(noRun, "p7-main");
  assert.ok(full.files.has("summary.csv"));
  assert.throws(() => reportCommand(["--results-dir", join(noRun, "p7-main"), "--out", tempDir()]), /p7-tune-main/);
});

test("per_user.csv is never read: the manifests list it and the files are not there", () => {
  const dir = tempDir();
  writeResultsFixture(dir);
  for (const run of REPORT_RUNS) {
    assert.ok(!existsSync(join(dir, run, "per_user.csv")));
    const m = JSON.parse(readFileSync(join(dir, run, "manifest.json"), "utf8")) as { files: Record<string, unknown> };
    assert.ok("per_user.csv" in m.files, run);
    assert.ok(!readRun(dir, run).files.has("per_user.csv"), run);
  }
  report(dir, tempDir());
});

test("fig-e3-density.csv has exactly the four datasets of DW6, four bins each, and its n sums to the kept test users of each run", () => {
  const dir = tempDir();
  writeResultsFixture(dir);
  const out = tempDir();
  report(dir, out);
  const fig = parseCsv(readFileSync(join(out, "fig-e3-density.csv"), "utf8"), "fig-e3-density.csv");
  assert.deepEqual(fig.header, ["dataset", "bin", "n", "mean_diff", "ci_low", "ci_high"]);
  const datasets = ["syn-W2L-M", "syn-W2M-M", "syn-W2H-M", "digg2009"];
  assert.deepEqual([...new Set(fig.rows.map((r) => r.dataset))], datasets);
  assert.equal(fig.rows.length, 16);
  for (const d of datasets) {
    const mine = fig.rows.filter((r) => r.dataset === d);
    assert.deepEqual(mine.map((r) => r.bin), ["0", "1-4", "5-19", "20+"]);
    // the run each dataset comes from: Digg from p7-main, the three W2 cells from p7-e5-worlds
    const run = d === "digg2009" ? "p7-main" : "p7-e5-worlds";
    const left = readRun(dir, run).files.get("leftout.csv")!.rows.find((r) => r.dataset === d && r.bucket === "all")!;
    assert.equal(mine.reduce((n, r) => n + Number(r.n), 0), Number(left.n_test_users) - Number(left.n_left_out), d);
    // the numbers are the cells of density.csv, not rounded
    const cell = readRun(dir, run).files.get("density.csv")!.rows.find((r) => r.dataset === d && r.density_bin === "20+")!;
    assert.equal((mine[3] as Record<string, string>).mean_diff, cell.mean_diff);
  }
});

/** The cells of a table file, as the reader sees them: the numbers after rounding, with the LaTeX and Markdown marks taken off. */
function texCells(text: string): string[][] {
  return text
    .split("\n")
    .filter((l) => l.endsWith(" \\\\") && !l.startsWith("\\"))
    .map((l) => l.slice(0, -3).split(" & ").map((c) => c.replace(/^\$|\$$/g, "").replace(/\\_/g, "_").trim()));
}

function mdCells(text: string): string[][] {
  return text
    .split("\n")
    .filter((l) => l.startsWith("|"))
    .slice(2)
    .map((l) => l.slice(1, -1).split("|").map((c) => c.trim()));
}

test("each table has the same rounded numbers in its .tex and in results.md, and the same as the macros", () => {
  const dir = tempDir();
  writeResultsFixture(dir);
  const out = tempDir();
  report(dir, out);
  const md = readFileSync(join(out, "results.md"), "utf8");
  const sections = md.split("\n## ").slice(1);
  for (const id of TABLE_IDS) {
    const tex = readFileSync(join(out, "tables", `${id}.tex`), "utf8");
    assert.ok(tex.includes("\\begin{tabular}") && tex.includes("\\toprule") && tex.includes("\\midrule") && tex.includes("\\bottomrule") && tex.includes("\\end{tabular}"), id);
    assert.ok(!tex.includes("\\begin{table}"), `${id}: no float around the tabular`);
    const section = sections.find((s) => s.startsWith(`${id}: `)) as string;
    assert.ok(section, `${id} is in results.md`);
    const a = texCells(tex).slice(1); // the first line is the header
    const b = mdCells(section);
    assert.ok(a.length > 0, id);
    assert.deepEqual(a, b, id);
    for (const row of a) for (const c of row) assert.ok(!/\d\.\d{4,}/.test(c), `${id}: "${c}" is not rounded to 3 decimals`);
  }
  // the tuning table: one row for each of the 14 chosen (dataset, method) groups
  assert.equal(mdCells(sections.find((s) => s.startsWith("tuning: ")) as string).length, 14);
  // the E2 row of syn-W2M-M, group 0-4, has the same gain, interval and p as the macros
  const macros = new Map(parseCsv(readFileSync(join(out, "macros.csv"), "utf8"), "m").rows.map((r) => [r.name as string, r.value as string]));
  const e2 = mdCells(sections.find((s) => s.startsWith("e2: ")) as string).find((r) => r[0] === "syn-W2M-M" && r[1] === "0-4") as string[];
  assert.equal(e2[5], macros.get("eTwoWTwoMNdcgTenZeroFourGain"));
  assert.equal(e2[6], macros.get("eTwoWTwoMNdcgTenZeroFourCiLow"));
  assert.equal(e2[7], macros.get("eTwoWTwoMNdcgTenZeroFourCiHigh"));
  assert.equal(e2[8], macros.get("eTwoWTwoMNdcgTenZeroFourPHolm"));
  assert.equal(e2[2], macros.get("eTwoWTwoMNdcgTenZeroFourN"));
});

test("toLatex and toMarkdown round with the same rule, escape LaTeX marks, and put a minus sign and < in math mode", () => {
  const t: Table = {
    id: "x",
    caption: "a table",
    columns: ["Name_1", "Gain", "p"],
    rows: [
      [{ v: "a_b", kind: "text" }, { v: "-0.012500", kind: "dec" }, { v: "0.000999", kind: "p" }],
      [{ v: "c", kind: "text" }, { v: "0.999500", kind: "dec" }, { v: "0.049500", kind: "p" }],
      [{ v: "d", kind: "text" }, { v: "", kind: "dec" }, { v: "1.000000", kind: "p" }],
    ],
  };
  const tex = toLatex(t);
  assert.ok(tex.includes("\\begin{tabular}{lrr}"));
  assert.ok(tex.includes("Name\\_1 & Gain & p \\\\"));
  assert.ok(tex.includes("a\\_b & $-0.013$ & $<0.001$ \\\\"));
  assert.ok(tex.includes("c & 0.1000 & 0.050 \\\\".replace("0.1000", "1.000")));
  assert.ok(tex.includes("d &  & 1.000 \\\\"));
  const md = toMarkdown(t);
  assert.ok(md.includes("| a_b | -0.013 | <0.001 |"));
  assert.ok(md.includes("| c | 1.000 | 0.050 |"));
  assert.ok(md.includes("| d |  | 1.000 |"));
  assert.equal(cellText({ v: "-0.000400", kind: "dec" }), "0.000");
});

test("buildTables gives the nine tables of the design in order", () => {
  const dir = tempDir();
  writeResultsFixture(dir);
  const runs = new Map(REPORT_RUNS.map((r) => [r, readRun(dir, r)]));
  const tables = buildTables(runs);
  assert.deepEqual(tables.map((t) => t.id), TABLE_IDS);
  for (const t of tables) for (const row of t.rows) assert.equal(row.length, t.columns.length, t.id);
  // E4 leaves out H-comm on Digg only
  const e4 = tables.find((t) => t.id === "e4") as Table;
  assert.ok(e4.rows.some((r) => r[0]?.v === "syn-W2M-M" && r[1]?.v === "H-comm"));
  assert.ok(!e4.rows.some((r) => r[0]?.v === "digg2009" && r[1]?.v === "H-comm"));
  // E8: the three methods of the run
  assert.deepEqual(((tables.find((t) => t.id === "e8") as Table).rows).map((r) => r[0]?.v), ["BL2", "BL4", "H"]);
});
