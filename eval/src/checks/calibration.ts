import type { Dataset } from "../canonical/dataset.ts";

// Calibration check (DW5). Values are counted over users with at least one action, as for Digg
// (.docs/datasets.md section 6a). Targets come from synthetic-v1.json, so this file holds no Digg number.

export interface CalibrationTargets {
  votesPerUserMean: number;
  votesPerUserMedian: number;
  /** Share of actions by the top 20% of acting users, as a fraction. */
  activitySkewTop20: number;
  /** Mean number of followees over users with at least one followee. */
  followeesMean: number;
}

export interface Measured {
  /** Users with at least one action. */
  actors: number;
  votesPerUserMean: number | null;
  votesPerUserMedian: number | null;
  activitySkewTop20: number | null;
  followeesMean: number | null;
}

export interface CalibrationRow {
  name: keyof CalibrationTargets;
  generated: number | null;
  target: number;
  tolerance: string;
  pass: boolean;
}

export interface CalibrationResult {
  pass: boolean;
  rows: CalibrationRow[];
}

const EPS = 1e-9;

// "relative": within 10% of the target. "points": within 5 percentage points (0.05) of a share.
export function withinTolerance(kind: "relative" | "points", generated: number, target: number): boolean {
  if (kind === "relative") return Math.abs(generated - target) <= 0.1 * Math.abs(target) + EPS;
  return Math.abs(generated - target) <= 0.05 + EPS;
}

function numeric(a: number, b: number): number {
  return a - b;
}

export function measure(data: Dataset): Measured {
  const perUser = new Map<number, number>();
  for (const e of data.interactions) perUser.set(e.userId, (perUser.get(e.userId) ?? 0) + 1);
  const counts = [...perUser.values()].sort(numeric);
  const actors = counts.length;
  let mean: number | null = null;
  let median: number | null = null;
  let skew: number | null = null;
  if (actors > 0) {
    let total = 0;
    for (const c of counts) total += c;
    mean = total / actors;
    median = counts[Math.ceil(actors / 2) - 1] as number; // nearest rank
    const top = Math.ceil(actors / 5);
    let topSum = 0;
    for (let i = 0; i < top; i++) topSum += counts[actors - 1 - i] as number;
    skew = topSum / total;
  }
  const perFollower = new Map<number, number>();
  for (const f of data.follows) perFollower.set(f.followerId, (perFollower.get(f.followerId) ?? 0) + 1);
  let followeesMean: number | null = null;
  if (perFollower.size > 0) {
    let s = 0;
    for (const c of perFollower.values()) s += c;
    followeesMean = s / perFollower.size;
  }
  return { actors, votesPerUserMean: mean, votesPerUserMedian: median, activitySkewTop20: skew, followeesMean };
}

export function calibrate(data: Dataset, targets: CalibrationTargets): CalibrationResult {
  const m = measure(data);
  const spec: Array<[keyof CalibrationTargets, number | null, "relative" | "points"]> = [
    ["votesPerUserMean", m.votesPerUserMean, "relative"],
    ["votesPerUserMedian", m.votesPerUserMedian, "relative"],
    ["activitySkewTop20", m.activitySkewTop20, "points"],
    ["followeesMean", m.followeesMean, "relative"],
  ];
  const rows: CalibrationRow[] = spec.map(([name, generated, kind]) => ({
    name,
    generated,
    target: targets[name],
    tolerance: kind === "relative" ? "10%" : "5 points",
    pass: generated !== null && withinTolerance(kind, generated, targets[name]),
  }));
  return { pass: rows.every((r) => r.pass), rows };
}
