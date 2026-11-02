import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadDataset } from "../canonical/dataset.ts";
import type { Dataset } from "../canonical/dataset.ts";
import { sha256Hex } from "../canonical/csv.ts";
import { loadFrozen } from "../frozen.ts";
import { configSha256, loadConfig, loadTargets } from "../generator/config.ts";
import { datasetIds } from "../generator/generate.ts";
import { bucketReport, KEPT_THRESHOLD } from "./buckets.ts";
import { calibrate } from "./calibration.ts";
import { checkFormat } from "./format.ts";
import { computeLift } from "./lift.ts";

const DAY = 86400;
/** One q for every dataset (blueprint section 3.1). */
const Q = "0.8";

export interface CheckAllResult {
  pass: boolean;
  text: string;
}

function f6(x: number | null): string {
  return x === null ? "n/a" : x.toFixed(6);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function folders(dataDir: string): string[] {
  if (!existsSync(dataDir)) return [];
  const names = readdirSync(dataDir).filter((n) => statSync(join(dataDir, n)).isDirectory());
  const known = datasetIds().filter((id) => names.includes(id)) as string[];
  const other = names.filter((n) => !known.includes(n)).sort(compare);
  return [...known, ...other];
}

function table(header: string[], rows: string[][]): string[] {
  const width = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] as string).length)));
  const line = (cells: string[]): string => "  " + cells.map((c, i) => c.padStart(width[i] as number)).join("  ");
  return [line(header), ...rows.map(line)];
}

function sizeM(data: Dataset): boolean {
  return data.manifest.source.kind === "synthetic" && data.manifest.source.size === "M";
}

// The checks read only the canonical files of each dataset folder (design: "Checks read only the canonical files").
export function checkAll(dataDir: string): CheckAllResult {
  const frozen = loadFrozen();
  const windowSec = frozen.windowDays * DAY;
  const cfgSha = configSha256();
  const targets = loadTargets(loadConfig());
  const lines: string[] = [];
  let pass = true;

  lines.push(`synthetic-v1.json sha256 ${cfgSha}`);
  lines.push(`window W ${frozen.windowDays} days, pool cap N_max ${frozen.poolCap}, q ${Q}`);

  const ids = folders(dataDir);
  if (ids.length === 0) {
    lines.push("", "no dataset folder found in " + dataDir);
    return { pass: false, text: lines.join("\n") + "\n" };
  }

  const lifts = new Map<string, number | null>();
  for (const id of ids) {
    const dir = join(dataDir, id);
    lines.push("", `== ${id} ==`);
    const fmt = checkFormat(dir);
    if (!fmt.pass) {
      pass = false;
      lines.push("format: FAIL");
      for (const p of fmt.problems) lines.push(`  - ${p.rule}: ${p.count} (first: ${p.example})`);
      continue;
    }
    const manifestSha = sha256Hex(readFileSync(join(dir, "manifest.json")));
    const data = loadDataset(dir);
    lines.push(`manifest sha256 ${manifestSha}`);
    lines.push(
      "rows " +
        Object.keys(data.manifest.files)
          .map((n) => `${n.replace(".csv", "")}=${(data.manifest.files[n] as { rows: number }).rows}`)
          .join(" "),
    );
    if (typeof data.manifest.source.skippedActions === "number") {
      lines.push(`skipped actions (no candidate): ${String(data.manifest.source.skippedActions)}`);
    }
    if (data.manifest.source.kind === "synthetic" && data.manifest.source.configSha256 !== cfgSha) {
      pass = false;
      lines.push("config: FAIL (the manifest was made with another synthetic-v1.json; generate again)");
    }
    lines.push("format: pass");

    if (!sizeM(data)) continue;

    const cal = calibrate(data, targets);
    if (!cal.pass) pass = false;
    lines.push(`calibration: ${cal.pass ? "pass" : "FAIL"}`);
    lines.push(
      ...table(
        ["value", "generated", "target", "tolerance", "result"],
        cal.rows.map((r) => [r.name, f6(r.generated), f6(r.target), r.tolerance, r.pass ? "pass" : "FAIL"]),
      ),
    );

    const lift = computeLift(data, windowSec);
    lifts.set(id, lift.lift);
    lines.push(
      `lift: ${f6(lift.lift)} (actions ${lift.actions}, on exposed posts ${lift.exposedActions}, expected exposed ${f6(lift.expectedExposed)})` +
        (lift.note ? ` ${lift.note}` : ""),
    );

    if (id === "syn-W2M-M") {
      const b = bucketReport(data, Q, windowSec, frozen.poolCap);
      const iso = new Date((data.manifest.epoch.seconds + b.cutTime) * 1000).toISOString();
      lines.push(`buckets (q ${b.q}): positives ${b.n}, T ${b.cutTime} (${iso}), test users ${b.testUsers}`);
      lines.push(`  pool at T: ${b.poolAtT} (window only: ${b.poolAtTWindow}), median pool over kept test users ${f6(b.poolMedian)}`);
      lines.push(
        ...table(
          ["bucket", "test_users", "kept", "left_out", "kept_with_followee"],
          b.rows.map((r) => [r.bucket, String(r.testUsers), String(r.kept), String(r.leftOut), String(r.keptWithFollowee)]),
        ),
      );
      lines.push(`  kept test users in bucket 0-4: ${b.kept04} (threshold ${KEPT_THRESHOLD}): ${b.meetsThreshold ? "pass" : "FAIL"}`);
      if (!b.meetsThreshold) pass = false;
    }
  }

  const w = (world: string): number | null | undefined => lifts.get(`syn-${world}-M`);
  const worlds = ["W0", "W1", "W2L", "W2M", "W2H"];
  if (worlds.some((x) => w(x) !== undefined)) {
    lines.push("", "== lift per size M world ==");
    lines.push(...table(["world", "lift"], worlds.filter((x) => w(x) !== undefined).map((x) => [x, f6(w(x) as number | null)])));
    const [w0, w1, l, m, h] = worlds.map((x) => w(x));
    if ([w0, l, m, h].every((v) => typeof v === "number")) {
      const lo = Math.min(...[w1, l, m, h].filter((v): v is number => typeof v === "number"));
      const ok = (w0 as number) < lo && (l as number) < (m as number) && (m as number) < (h as number);
      lines.push(`lift order (W0 lowest, W2L < W2M < W2H): ${ok ? "pass" : "FAIL"}`);
      if (!ok) pass = false;
    } else {
      lines.push("lift order: not checked (needs W0, W2L, W2M and W2H of size M)");
    }
  }

  lines.push("", `result: ${pass ? "pass" : "FAIL"}`);
  return { pass, text: lines.join("\n") + "\n" };
}
