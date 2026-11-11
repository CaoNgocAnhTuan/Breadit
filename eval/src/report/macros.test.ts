import { test } from "node:test";
import assert from "node:assert/strict";
import { MACRO_SPECS, buildMacros, macroName, macrosTex, macrosCsv, verifyMacros } from "./macros.ts";
import type { MacroRow } from "./macros.ts";
import { readRun } from "./read.ts";
import type { RunFiles, RunFilesMap } from "./read.ts";
import { FIXTURE_RUNS, editResultsFile, writeResultsFixture } from "./fixture.ts";
import { formatP, roundDecimal } from "./round.ts";
import { tempDir } from "../checks/fixture.ts";

// TC10 (design DW10, F12): macro names, values and the check that each macro still finds its cell.
function load(dir: string): RunFilesMap {
  return new Map<string, RunFiles>(FIXTURE_RUNS.map((r) => [r.id, readRun(dir, r.id)]));
}

/** The cell of a macro, found by hand: file is <run>/<csv>, row_key the key cells joined with "|". */
function cellOf(runs: RunFilesMap, m: MacroRow): string {
  const [run, csv] = m.file.split("/") as [string, string];
  const keys: Record<string, number> = { "compare.csv": 6, "summary.csv": 5, "coverage.csv": 4, "leftout.csv": 3, "density.csv": 4 };
  const table = runs.get(run)?.files.get(csv);
  assert.ok(table, `${m.file} is not in the fixture`);
  const cols = table.header.slice(0, keys[csv] as number);
  const hits = table.rows.filter((r) => cols.map((c) => r[c]).join("|") === m.rowKey);
  assert.equal(hits.length, 1, `${m.name}: ${hits.length} rows for ${m.file} ${m.rowKey}`);
  return (hits[0] as Record<string, string>)[m.column] as string;
}

test("macroName: letters only, and it throws on a digit, on an empty name and on a repeated name", () => {
  assert.equal(macroName(["e", "Two", "Digg", "Ndcg", "Ten", "ZeroFour", "Gain"]), "eTwoDiggNdcgTenZeroFourGain");
  assert.equal(macroName(["eTwo", "Digg", "Ndcg", "Ten", "ZeroFour", "Gain"]), "eTwoDiggNdcgTenZeroFourGain");
  for (const bad of [["e", "Two1"], ["e", "Two", "10"], ["e", "T-wo"], ["e", "Tw o"], ["e", "Tw_o"], [], [""]]) {
    assert.throws(() => macroName(bad), /letters|empty/, JSON.stringify(bad));
  }
  const used = new Set<string>();
  assert.equal(macroName(["e", "One"], used), "eOne");
  assert.equal(macroName(["e", "Two"], used), "eTwo");
  assert.throws(() => macroName(["e", "One"], used), /twice|already|repeat/);
});

test("MACRO_SPECS: about 70 specs, every name is letters only and none repeats", () => {
  assert.ok(MACRO_SPECS.length >= 60 && MACRO_SPECS.length <= 80, `${MACRO_SPECS.length} specs`);
  const used = new Set<string>();
  for (const s of MACRO_SPECS) {
    const name = macroName(s.parts, used);
    assert.match(name, /^[A-Za-z]+$/);
  }
  assert.equal(used.size, MACRO_SPECS.length);
});

test("buildMacros: each value is its cell after roundDecimal / formatP (counts plain), found again by file, row_key and column", () => {
  const dir = tempDir();
  writeResultsFixture(dir);
  const runs = load(dir);
  const macros = buildMacros(runs);
  assert.equal(macros.length, MACRO_SPECS.length);
  const names = macros.map((m) => m.name);
  assert.deepEqual(names, [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), "sorted by name");
  assert.equal(new Set(names).size, names.length);
  for (const m of macros) {
    assert.match(m.name, /^[A-Za-z]+$/);
    const cell = cellOf(runs, m);
    const want = m.column === "p_holm" || m.column === "p_raw" ? formatP(cell) : /^n(_|$)/.test(m.column) ? cell : roundDecimal(cell, 3);
    assert.equal(m.value, want, m.name);
    assert.match(m.file, /^p7-[a-z0-9-]+\/[a-z_]+\.csv$/);
  }
  // five macros picked by hand
  const byName = new Map(macros.map((m) => [m.name, m]));
  const pick = (name: string): MacroRow => byName.get(name) as MacroRow;
  assert.equal(pick("eTwoDiggNdcgTenZeroFourGain").file, "p7-main/compare.csv");
  assert.equal(pick("eTwoDiggNdcgTenZeroFourGain").rowKey, "digg2009|F1|H|BL2|10|0-4");
  assert.equal(pick("eTwoDiggNdcgTenZeroFourGain").column, "mean_diff");
  assert.equal(pick("eTwoWTwoMNdcgTenZeroFourN").column, "n");
  assert.equal(pick("hZeroWZeroNdcgTenAllGain").file, "p7-h0/compare.csv");
  assert.equal(pick("hZeroWZeroNdcgTenAllGain").rowKey, "syn-W0-M|none|H|BL2|10|all");
  assert.equal(pick("eOneDiggNdcgHTenAllValue").file, "p7-main/summary.csv");
  assert.equal(pick("eOneDiggNdcgHTenAllValue").rowKey, "digg2009|test|H|10|all");
  assert.equal(pick("eOneWTwoMCovBLTwoTenAllValue").file, "p7-main/coverage.csv");
  assert.equal(pick("eOneWTwoMTestUsersAllN").file, "p7-main/leftout.csv");
  assert.equal(pick("eThreeWTwoLNdcgTenTwentyPlusGain").file, "p7-e5-worlds/density.csv");
  assert.equal(pick("eThreeDiggNdcgTenZeroGain").file, "p7-main/density.csv");
  assert.equal(pick("eFourWTwoMNdcgHFollowTenAllGain").file, "p7-e4-terms/compare.csv");
  assert.equal(pick("eFourDiggNdcgHMZeroTenAllGain").file, "p7-e4-m0/compare.csv");
  assert.equal(pick("eFiveWTwoMShuffledNdcgTenAllCiLow").file, "p7-e5-shuffle/compare.csv");
  assert.equal(pick("eFiveWTwoMShuffledNdcgTenAllCiLow").rowKey, "syn-W2M-M-shuffled|none|H|BL2|10|all");
  assert.equal(pick("eSixDiggNdcgBLTwoTenAllValue").file, "p7-e6-ties/summary.csv");
  assert.equal(pick("eEightWTwoMNdcgHTenAllValue").file, "p7-e8-pool/summary.csv");
  assert.ok(!byName.has("eFourDiggNdcgHCommTenAllGain"), "the Digg table of E4 leaves out H-comm");
  assert.ok(byName.has("eFourWTwoMNdcgHCommTenAllGain"));
  // the macros are the same on a second build
  assert.deepEqual(buildMacros(runs), macros);
});

test("rounding on the string: -0.012500 gives -0.013, 0.000999 gives <0.001, 0.999500 gives 1.000, -0.000400 gives 0.000", () => {
  const dir = tempDir();
  const compare = "p7-main/compare.csv|digg2009|F1|H|BL2|10|";
  writeResultsFixture(dir, {
    cells: {
      [`${compare}0-4|mean_diff`]: "-0.012500",
      [`${compare}0-4|p_holm`]: "0.000999",
      [`${compare}0-4|ci_low`]: "0.999500",
      [`${compare}0-4|ci_high`]: "0.012500",
      [`${compare}0|mean_diff`]: "-0.000400",
      [`${compare}1-4|mean_diff`]: "12.000000",
    },
  });
  const byName = new Map(buildMacros(load(dir)).map((m) => [m.name, m.value]));
  assert.equal(byName.get("eTwoDiggNdcgTenZeroFourGain"), "-0.013");
  assert.equal(byName.get("eTwoDiggNdcgTenZeroFourPHolm"), "<0.001");
  assert.equal(byName.get("eTwoDiggNdcgTenZeroFourCiLow"), "1.000");
  assert.equal(byName.get("eTwoDiggNdcgTenZeroFourCiHigh"), "0.013");
  assert.equal(byName.get("eTwoDiggNdcgTenZeroGain"), "0.000");
  assert.equal(byName.get("eTwoDiggNdcgTenOneFourGain"), "12.000");
});

test("verifyMacros passes on a fresh build, and throws when a cell changed, a row is gone, or a macro is wrong", () => {
  const dir = tempDir();
  writeResultsFixture(dir);
  const macros = buildMacros(load(dir));
  verifyMacros(macros, load(dir));
  // a cell of the macro changed (the run was rewritten and its manifest too): the macro no longer equals its cell
  editResultsFile(dir, "p7-main", "compare.csv", (t) => t.replace(/^(digg2009,F1,H,BL2,10,0-4,\d+,)[^,]+/m, "$19.999999"), true);
  assert.throws(() => verifyMacros(macros, load(dir)), (e: Error) => /eTwoDiggNdcgTenZeroFourGain/.test(e.message));
  // wrong value, wrong name, wrong key, repeated name
  const fresh = tempDir();
  writeResultsFixture(fresh);
  const runs = load(fresh);
  const base = buildMacros(runs);
  const first = base[0] as MacroRow;
  assert.throws(() => verifyMacros([{ ...first, value: "9.999" }, ...base.slice(1)], runs), (e: Error) => e.message.includes(first.name));
  assert.throws(() => verifyMacros([{ ...first, name: "a1" }, ...base.slice(1)], runs), /letters/);
  assert.throws(() => verifyMacros([{ ...first, rowKey: "nobody|F1|H|BL2|10|0-4" }, ...base.slice(1)], runs), /row/);
  assert.throws(() => verifyMacros([{ ...first, file: "p7-nothing/compare.csv" }, ...base.slice(1)], runs), /p7-nothing/);
  assert.throws(() => verifyMacros([first, first], runs), /twice|repeat|already/);
});

test("macrosTex: one newcommand per row, a minus sign and < in math mode; macrosCsv has the five columns", () => {
  const rows: MacroRow[] = [
    { name: "aOne", value: "0.013", file: "p7-main/compare.csv", rowKey: "k", column: "mean_diff" },
    { name: "bTwo", value: "-0.013", file: "p7-main/compare.csv", rowKey: "k", column: "mean_diff" },
    { name: "cThree", value: "<0.001", file: "p7-main/compare.csv", rowKey: "k", column: "p_holm" },
    { name: "dFour", value: "590", file: "p7-main/leftout.csv", rowKey: "k", column: "n_test_users" },
  ];
  const tex = macrosTex(rows);
  assert.equal(tex.split("\n").filter((l) => l.startsWith("\\newcommand")).length, 4);
  assert.ok(tex.includes("\\newcommand{\\aOne}{0.013}"));
  assert.ok(tex.includes("\\newcommand{\\bTwo}{$-0.013$}"));
  assert.ok(tex.includes("\\newcommand{\\cThree}{$<0.001$}"));
  assert.ok(tex.includes("\\newcommand{\\dFour}{590}"));
  assert.ok(tex.endsWith("\n"));
  const csv = macrosCsv(rows);
  assert.equal(csv.split("\n")[0], "name,value,file,row_key,column");
  assert.equal(csv.split("\n").length, 6);
  // on the real list
  const dir = tempDir();
  writeResultsFixture(dir);
  const macros = buildMacros(load(dir));
  assert.equal(macrosTex(macros).split("\n").filter((l) => l.startsWith("\\newcommand")).length, macros.length);
  assert.equal(macrosCsv(macros).trimEnd().split("\n").length, macros.length + 1);
});
