import { test } from "node:test";
import assert from "node:assert/strict";
import { E6_LARGEST, MACRO_SPECS, buildMacros, checkTieChanges, macroName, macrosTex, macrosCsv, tieChanges, verifyMacros } from "./macros.ts";
import type { MacroRow, TieChange } from "./macros.ts";
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
  const keys: Record<string, number> = { "compare.csv": 6, "summary.csv": 5, "coverage.csv": 4, "leftout.csv": 3, "density.csv": 4, "tuning.csv": 4, "latency.csv": 1, "queries.csv": 1, "groups.csv": 4 };
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

test("MACRO_SPECS: 157 specs of the P7 runs, 15 of E7 and 44 of the Orientation groups, every name is letters only and none repeats", () => {
  const e7 = MACRO_SPECS.filter((s) => s.run === "p7-e7");
  const orient = MACRO_SPECS.filter((s) => s.run === "p9-orient-groups");
  assert.equal(e7.length, 15);
  // 2 datasets x 2 groups: per metric (recall, ndcg) the gain, its interval and the two means (10), and the user count once (1)
  assert.equal(orient.length, 44);
  assert.equal(MACRO_SPECS.length - e7.length - orient.length, 157, "138 after task p9-report-macros, 19 new ones (task p9-missing-macros)");
  assert.equal(MACRO_SPECS.length, 216);
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
    // a name that ends in Full holds its 6-decimal cell, the column value (a grid value) is the cell as written (task p9-report-macros)
    const want =
      m.name.endsWith("Full") || m.column === "value"
        ? cell
        : m.column === "p_holm" || m.column === "p_raw"
          ? formatP(cell)
          : /^n(_|$)/.test(m.column)
            ? cell
            : roundDecimal(cell, 3);
    assert.equal(m.value, want, m.name);
    if (m.name.endsWith("Full")) assert.match(m.value, /^-?[0-9]+\.[0-9]{6}$/, m.name);
    assert.match(m.file, /^p[79]-[a-z0-9-]+\/[a-z_]+\.csv$/);
  }
  // five macros picked by hand
  const byName = new Map(macros.map((m) => [m.name, m]));
  const pick = (name: string): MacroRow => byName.get(name) as MacroRow;
  assert.equal(pick("eTwoDiggNdcgTenZeroFourGain").file, "p7-main/compare.csv");
  assert.equal(pick("eTwoDiggNdcgTenZeroFourGain").rowKey, "digg2009|F1|H|BL2|10|0-4");
  assert.equal(pick("eTwoDiggNdcgTenZeroFourGain").column, "mean_diff");
  assert.equal(pick("eTwoWTwoMNdcgTenZeroFourN").column, "n");
  // amendment 1: the H0 macros read the H-follow row of p7-h0, not the H row
  assert.equal(pick("hZeroWZeroNdcgHFollowTenAllGain").file, "p7-h0/compare.csv");
  assert.equal(pick("hZeroWZeroNdcgHFollowTenAllGain").rowKey, "syn-W0-M|none|H-follow|BL2|10|all");
  assert.equal(pick("hZeroWZeroNdcgHFollowTenAllCiLow").column, "ci_low");
  assert.equal(pick("hZeroWZeroNdcgHFollowTenAllCiHigh").column, "ci_high");
  assert.ok(!byName.has("hZeroWZeroNdcgTenAllGain"), "no H0 macro on the H row");
  // the gate macros are the ones named hZero (the E5 topic macros read p7-h0 too)
  const h0 = macros.filter((m) => m.name.startsWith("hZero"));
  assert.equal(h0.length, 3);
  for (const m of h0) assert.equal(m.file, "p7-h0/compare.csv", m.name);
  for (const m of h0) assert.ok(m.rowKey.startsWith("syn-W0-M|none|H-follow|BL2|"), m.name);
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
  // E7 (task p7-cost-benchmark): latency.csv and queries.csv, one row per algo
  assert.equal(pick("eSevenSocialMedian").file, "p7-e7/latency.csv");
  assert.equal(pick("eSevenSocialMedian").rowKey, "social");
  assert.equal(pick("eSevenSocialMedian").column, "median_ms");
  assert.equal(pick("eSevenChronoCiLow").column, "ci_low_ms");
  assert.equal(pick("eSevenEngagementCiHigh").column, "ci_high_ms");
  assert.equal(pick("eSevenChronoPNinetyFive").column, "p95_ms");
  assert.equal(pick("eSevenEngagementQueriesMean").file, "p7-e7/queries.csv");
  assert.equal(pick("eSevenEngagementQueriesMean").column, "mean");
  assert.equal(macros.filter((m) => m.file.startsWith("p7-e7/")).length, 15);
  assert.ok(!byName.has("eFourDiggNdcgHCommTenAllGain"), "the Digg table of E4 leaves out H-comm");
  assert.ok(byName.has("eFourWTwoMNdcgHCommTenAllGain"));
  // the macros are the same on a second build
  assert.deepEqual(buildMacros(runs), macros);
});

test("new macros (task p9-report-macros): tuning, E1 for nine methods, E2 for five groups, E5 topic row", () => {
  const dir = tempDir();
  writeResultsFixture(dir);
  const runs = load(dir);
  const macros = buildMacros(runs);
  const byName = new Map(macros.map((m) => [m.name, m]));
  const pick = (name: string): MacroRow => {
    const m = byName.get(name);
    assert.ok(m, `no macro ${name}`);
    return m;
  };
  const rowOf = (m: MacroRow): Record<string, string> => {
    const [run, csv] = m.file.split("/") as [string, string];
    const table = runs.get(run)?.files.get(csv);
    assert.ok(table);
    const cols = table.header.slice(0, 4);
    const hits = table.rows.filter((r) => cols.map((c) => r[c]).join("|") === m.rowKey);
    assert.equal(hits.length, 1, m.name);
    return hits[0] as Record<string, string>;
  };
  const datasets: [string, string][] = [["WTwoM", "syn-W2M-M"], ["Digg", "digg2009"]];

  // tuning: the chosen value of five methods on both datasets, read from the row with chosen = 1
  const tuned: [string, string][] = [["H", "H"], ["BLTwoT", "BL2t"], ["BLFour", "BL4"], ["BLFive", "BL5"], ["BLSix", "BL6"]];
  for (const [dWord, d] of datasets) {
    for (const [mWord, m] of tuned) {
      const macro = pick(`tune${dWord}${mWord}Chosen`);
      assert.equal(macro.file, "p7-tune-main/tuning.csv");
      assert.equal(macro.column, "value");
      assert.ok(macro.rowKey.startsWith(`${d}|${m}|`), macro.name);
      assert.equal(rowOf(macro).chosen, "1", `${macro.name} reads the chosen row`);
    }
  }
  assert.equal(macros.filter((m) => /^tune[A-Za-z]+Chosen$/.test(m.name)).length, 10);
  // tuning points, full precision, found by their grid value
  for (const [name, value] of [["tuneWTwoMHValNdcgTenFiveTwelveFull", "512/512"], ["tuneWTwoMHValNdcgTenTenTwentyFourFull", "1024/1024"]] as const) {
    const m = pick(name);
    assert.equal(m.file, "p7-tune-main/tuning.csv");
    assert.equal(m.column, "val_ndcg10");
    assert.equal(m.rowKey, `syn-W2M-M|H|alpha/beta|${value}`);
    assert.equal(m.value, rowOf(m).val_ndcg10);
  }
  assert.equal(macros.filter((m) => m.file === "p7-tune-main/tuning.csv").length, 12);

  // E1: NDCG@10 of all nine methods on both datasets
  const nine: [string, string][] = [["BLZero", "BL0"], ["BLOne", "BL1"], ["BLTwo", "BL2"], ["BLTwoT", "BL2t"], ["BLThree", "BL3"], ["BLFour", "BL4"], ["BLFive", "BL5"], ["BLSix", "BL6"], ["H", "H"]];
  for (const [dWord, d] of datasets) {
    for (const [mWord, m] of nine) {
      const macro = pick(`eOne${dWord}Ndcg${mWord}TenAllValue`);
      assert.equal(macro.file, "p7-main/summary.csv");
      assert.equal(macro.rowKey, `${d}|test|${m}|10|all`);
      assert.equal(macro.column, "ndcg");
    }
  }
  assert.equal(pick("eOneDiggNdcgBLFourTenAllValue").rowKey, "digg2009|test|BL4|10|all");

  // E2: five groups, five columns, both datasets
  const groups: [string, string][] = [["Zero", "0"], ["OneFour", "1-4"], ["ZeroFour", "0-4"], ["FiveNineteen", "5-19"], ["TwentyPlus", "20+"]];
  const columns: [string, string][] = [["Gain", "mean_diff"], ["CiLow", "ci_low"], ["CiHigh", "ci_high"], ["PHolm", "p_holm"], ["N", "n"]];
  for (const [dWord, d] of datasets) {
    for (const [gWord, g] of groups) {
      for (const [cWord, c] of columns) {
        const macro = pick(`eTwo${dWord}NdcgTen${gWord}${cWord}`);
        assert.equal(macro.file, "p7-main/compare.csv");
        assert.equal(macro.rowKey, `${d}|F1|H|BL2|10|${g}`);
        assert.equal(macro.column, c);
      }
    }
  }
  assert.equal(pick("eTwoWTwoMNdcgTenTwentyPlusPHolm").column, "p_holm");

  // E5 topic row: the H row of p7-h0 (not H-follow)
  for (const [cWord, c] of [["Gain", "mean_diff"], ["CiLow", "ci_low"], ["CiHigh", "ci_high"]] as const) {
    const m = pick(`eFiveWZeroTopicNdcgTenAll${cWord}`);
    assert.equal(m.file, "p7-h0/compare.csv");
    assert.equal(m.rowKey, "syn-W0-M|none|H|BL2|10|all");
    assert.equal(m.column, c);
  }
  // the E5 world macro of W0 keeps its own name and file
  assert.equal(pick("eFiveWZeroNdcgTenAllGain").file, "p7-e5-worlds/compare.csv");
});

/** The 6-decimal text of a cell as whole millionths (no float). */
function micro(cell: string): number {
  const m = /^(0|[1-9][0-9]*)\.([0-9]{6})$/.exec(cell);
  assert.ok(m, `"${cell}" is not a 6-decimal cell`);
  return Number(m[1]) * 1_000_000 + Number(m[2]);
}

/** Whole millionths (>= 0) as a 6-decimal text. */
function fromMicro(n: number): string {
  assert.ok(Number.isInteger(n) && n >= 0, `${n} is not whole millionths >= 0`);
  return `${Math.floor(n / 1_000_000)}.${String(n % 1_000_000).padStart(6, "0")}`;
}

const SUMMARY = "summary.csv";

/** The E1 NDCG@10 cell (p7-main) of a method on a dataset, test split, bucket all, as written. */
function e1Cell(runs: RunFilesMap, dataset: string, method: string): string {
  const hits = (runs.get("p7-main")?.files.get(SUMMARY)?.rows ?? []).filter((r) => r.dataset === dataset && r.split === "test" && r.method === method && r.k === "10" && r.bucket === "all");
  assert.equal(hits.length, 1, `${dataset} ${method}`);
  return (hits[0] as Record<string, string>).ndcg as string;
}

/** A fixture where the E6 NDCG@10 of each listed pair is its E1 cell plus `deltaMicro` (the fixture is written twice, once to read the E1 cells). */
function fixtureWithE6Shift(shifts: ReadonlyArray<readonly [dataset: string, method: string, deltaMicro: number]>): RunFilesMap {
  const first = tempDir();
  writeResultsFixture(first);
  const base = load(first);
  const cells: Record<string, string> = {};
  for (const [dataset, method, delta] of shifts) cells[`p7-e6-ties/${SUMMARY}|${dataset}|test|${method}|10|all|ndcg`] = fromMicro(micro(e1Cell(base, dataset, method)) + delta);
  const dir = tempDir();
  writeResultsFixture(dir, { cells });
  return load(dir);
}

test("new macros (task p9-missing-macros): E3 counts of the bin 1-4, E6 for nine methods on both datasets, two Full values of BL4 on syn-W2M-M", () => {
  const dir = tempDir();
  writeResultsFixture(dir);
  const runs = load(dir);
  const macros = buildMacros(runs);
  const byName = new Map(macros.map((m) => [m.name, m]));
  const pick = (name: string): MacroRow => {
    const m = byName.get(name);
    assert.ok(m, `no macro ${name}`);
    return m;
  };
  // E3: the n of the bin 1-4 in the three W2 cells, a plain integer, read from p7-e5-worlds/density.csv
  for (const [dWord, d] of [["WTwoL", "syn-W2L-M"], ["WTwoM", "syn-W2M-M"], ["WTwoH", "syn-W2H-M"]] as const) {
    const m = pick(`eThree${dWord}NdcgTenOneFourN`);
    assert.equal(m.file, "p7-e5-worlds/density.csv");
    assert.equal(m.rowKey, `${d}|1-4|H|BL2`);
    assert.equal(m.column, "n");
    assert.match(m.value, /^[0-9]+$/, m.name);
    assert.equal(m.value, cellOf(runs, m), m.name);
  }
  assert.ok(!byName.has("eThreeDiggNdcgTenOneFourN"), "the text reads the bin 1-4 in the three W2 cells only");
  // E6: NDCG@10 of all nine methods on both datasets (the four of H and BL2 keep their names), 3 decimals, from p7-e6-ties
  const nine: [string, string][] = [["BLZero", "BL0"], ["BLOne", "BL1"], ["BLTwo", "BL2"], ["BLTwoT", "BL2t"], ["BLThree", "BL3"], ["BLFour", "BL4"], ["BLFive", "BL5"], ["BLSix", "BL6"], ["H", "H"]];
  for (const [dWord, d] of [["WTwoM", "syn-W2M-M"], ["Digg", "digg2009"]] as const) {
    for (const [mWord, m] of nine) {
      const macro = pick(`eSix${dWord}Ndcg${mWord}TenAllValue`);
      assert.equal(macro.file, "p7-e6-ties/summary.csv");
      assert.equal(macro.rowKey, `${d}|test|${m}|10|all`);
      assert.equal(macro.column, "ndcg");
      assert.equal(macro.value, roundDecimal(cellOf(runs, macro), 3), macro.name);
    }
  }
  // the two Full values of the pair the text names: 6 decimals, E1 from p7-main and E6 from p7-e6-ties, and the 3-decimal macros stay
  const e1 = pick("eOneWTwoMNdcgBLFourTenAllValueFull");
  const e6 = pick("eSixWTwoMNdcgBLFourTenAllValueFull");
  assert.equal(e1.file, "p7-main/summary.csv");
  assert.equal(e6.file, "p7-e6-ties/summary.csv");
  for (const m of [e1, e6]) {
    assert.equal(m.rowKey, "syn-W2M-M|test|BL4|10|all");
    assert.equal(m.column, "ndcg");
    assert.match(m.value, /^[0-9]\.[0-9]{6}$/, m.name);
    assert.equal(m.value, cellOf(runs, m), m.name);
  }
  assert.equal(micro(e1.value) - micro(e6.value), 10_000, "the fixture moves BL4 on syn-W2M-M by 0.010000");
  assert.equal(pick("eOneWTwoMNdcgBLFourTenAllValue").value, roundDecimal(e1.value, 3));
  assert.equal(pick("eSixWTwoMNdcgBLFourTenAllValue").value, roundDecimal(e6.value, 3));
  assert.equal(macros.filter((m) => m.name.startsWith("eSix")).length, 19, "18 values and one Full");
});

test("tieChanges: 18 rows (nine methods, two datasets), |E6 - E1| in whole millionths, largest first, the same on a second call", () => {
  const dir = tempDir();
  writeResultsFixture(dir);
  const runs = load(dir);
  const changes = tieChanges(runs);
  assert.equal(changes.length, 18);
  const first = changes[0] as TieChange;
  assert.deepEqual([first.dataset, first.method, first.changeMicro], ["syn-W2M-M", "BL4", 10_000]);
  assert.equal(micro(first.e1) - micro(first.e6), 10_000);
  assert.equal(first.e1, e1Cell(runs, "syn-W2M-M", "BL4"));
  assert.ok(Number.isInteger(first.changeMicro));
  // H and BL2 do not change, and every other row is 0 too, so the order of the rest is dataset, then method (string order)
  for (const c of changes.slice(1)) assert.equal(c.changeMicro, 0, `${c.dataset} ${c.method}`);
  const methods = ["BL0", "BL1", "BL2", "BL2t", "BL3", "BL4", "BL5", "BL6", "H"];
  assert.deepEqual(
    changes.slice(1).map((c) => `${c.dataset}|${c.method}`),
    [...methods.map((m) => `digg2009|${m}`), ...methods.filter((m) => m !== "BL4").map((m) => `syn-W2M-M|${m}`)],
  );
  assert.deepEqual(tieChanges(runs), changes, "the same order on a second call");
  // the order is by the change, not by the name: a larger change on a later name comes first, and a change down counts as much as one up
  const moved = tieChanges(fixtureWithE6Shift([["digg2009", "H", 30_000], ["syn-W2M-M", "BL0", -5_000]]));
  assert.equal(moved.length, 18);
  assert.deepEqual(moved.slice(0, 3).map((c) => [c.dataset, c.method, c.changeMicro]), [["digg2009", "H", 30_000], ["syn-W2M-M", "BL4", 10_000], ["syn-W2M-M", "BL0", 5_000]]);
  // E6_LARGEST is the pair of the real results, and the first row of the fixture
  assert.deepEqual({ ...E6_LARGEST }, { dataset: "syn-W2M-M", method: "BL4" });
});

test("checkTieChanges: passes on the fixture; throws on another wanted pair, on a tie for the largest change, and when H or BL2 changes at 3 decimals", () => {
  const dir = tempDir();
  writeResultsFixture(dir);
  const runs = load(dir);
  checkTieChanges(runs);
  checkTieChanges(runs, { dataset: "syn-W2M-M", method: "BL4" });
  // another wanted pair: the message names the pair that is the largest and the pair that was wanted
  assert.throws(
    () => checkTieChanges(runs, { dataset: "digg2009", method: "BL4" }),
    (e: Error) => e.message.includes("BL4") && e.message.includes("syn-W2M-M") && e.message.includes("digg2009") && /largest/.test(e.message),
  );
  // two pairs share the largest change (BL4 on digg2009 moves by 0.010000 too)
  assert.throws(() => checkTieChanges(fixtureWithE6Shift([["digg2009", "BL4", -10_000]])), (e: Error) => /not one largest pair/.test(e.message) && e.message.includes("digg2009") && e.message.includes("BL4"));
  // another pair moves more than the wanted one
  assert.throws(() => checkTieChanges(fixtureWithE6Shift([["digg2009", "BL5", 20_000]])), (e: Error) => e.message.includes("BL5") && e.message.includes("digg2009") && /largest/.test(e.message));
  // H and BL2: a change at 3 decimals stops the check, on both datasets (the change is far below the largest one)
  for (const [dataset, method] of [["syn-W2M-M", "H"], ["digg2009", "H"], ["syn-W2M-M", "BL2"], ["digg2009", "BL2"]] as const) {
    assert.throws(() => checkTieChanges(fixtureWithE6Shift([[dataset, method, 1_000]])), (e: Error) => e.message.includes(method) && e.message.includes(dataset) && /3 decimals|ties/.test(e.message), `${dataset} ${method}`);
  }
  // a change in the sixth decimal that does not move the 3-decimal text is fine
  const small = fixtureWithE6Shift([["syn-W2M-M", "H", 1]]);
  assert.equal(roundDecimal(e1Cell(small, "syn-W2M-M", "H"), 3), roundDecimal(fromMicro(micro(e1Cell(small, "syn-W2M-M", "H")) + 1), 3), "the fixture value does not sit on a rounding edge");
  checkTieChanges(small);
});

test("Full macros: the Digg H1 row keeps its 6 decimals, and the 3-decimal macros keep their rounding", () => {
  const dir = tempDir();
  const compare = "p7-main/compare.csv|digg2009|F1|H|BL2|10|0-4|";
  writeResultsFixture(dir, { cells: { [`${compare}mean_diff`]: "0.000117", [`${compare}ci_low`]: "0.000015", [`${compare}ci_high`]: "0.000225", [`${compare}p_holm`]: "0.335466" } });
  const runs = load(dir);
  const macros = buildMacros(runs);
  const byName = new Map(macros.map((m) => [m.name, m]));
  for (const [what, cell, column] of [["Gain", "0.000117", "mean_diff"], ["CiLow", "0.000015", "ci_low"], ["CiHigh", "0.000225", "ci_high"]] as const) {
    const full = byName.get(`eTwoDiggNdcgTenZeroFour${what}Full`) as MacroRow;
    assert.ok(full, `no Full macro for ${what}`);
    assert.equal(full.value, cell);
    assert.equal(full.file, "p7-main/compare.csv");
    assert.equal(full.rowKey, "digg2009|F1|H|BL2|10|0-4");
    assert.equal(full.column, column);
    assert.equal(byName.get(`eTwoDiggNdcgTenZeroFour${what}`)?.value, "0.000", "the 3-decimal macro keeps its rounding");
  }
  assert.equal(byName.get("eTwoDiggNdcgTenZeroFourPHolm")?.value, "0.335");
  assert.equal(macros.filter((m) => m.name.endsWith("Full")).length, 7, "three Digg macros, two tuning points and two E6 values of BL4 on syn-W2M-M");
  // a Full macro with a tuning cell: the 6 decimals of val_ndcg10
  const tuneRow = (byName.get("tuneWTwoMHValNdcgTenTenTwentyFourFull") as MacroRow).value;
  assert.match(tuneRow, /^0\.[0-9]{6}$/);
});

test("verifyMacros throws when a Full macro holds the 3-decimal value of its cell, and passes on a fresh build", () => {
  const dir = tempDir();
  const compare = "p7-main/compare.csv|digg2009|F1|H|BL2|10|0-4|";
  writeResultsFixture(dir, { cells: { [`${compare}mean_diff`]: "0.000117" } });
  const runs = load(dir);
  const macros = buildMacros(runs);
  verifyMacros(macros, runs);
  const name = "eTwoDiggNdcgTenZeroFourGainFull";
  const rounded = macros.map((m) => (m.name === name ? { ...m, value: "0.000" } : m));
  assert.throws(() => verifyMacros(rounded, runs), (e: Error) => e.message.includes(name) && e.message.includes("0.000117"));
  // a grid value changed to a rounded text is caught too
  const chosen = macros.find((m) => m.name === "tuneWTwoMHChosen") as MacroRow;
  const wrong = macros.map((m) => (m === chosen ? { ...m, value: "1024" } : m));
  assert.throws(() => verifyMacros(wrong, runs), (e: Error) => e.message.includes("tuneWTwoMHChosen"));
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
