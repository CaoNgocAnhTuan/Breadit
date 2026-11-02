import type { Dataset } from "../canonical/dataset.ts";

// Calibration check (DW5, amended by design section 4). Values are counted over users with at least one
// action, as for Digg (.docs/datasets.md section 6a). Targets come from synthetic-v1.json, so this file
// holds no Digg number.

export type CalibrationKey =
  | "votesPerUserMean"
  | "votesPerUserMedian"
  | "votesPerUserP90"
  | "votesPerUserP99"
  | "shareUsers1"
  | "shareUsers2to4"
  | "shareUsers5to19"
  | "shareUsers20plus"
  | "activitySkewTop20"
  | "followeesMean"
  | "followListShare";

/** A key may be missing: only the targets that exist are checked. */
export type CalibrationTargets = Partial<Record<CalibrationKey, number>>;

export type ToleranceKind = "relative" | "tail" | "points";

/** relative: 10% of the target. tail: 25% (a tail percentile is noisy with 1,000 users). points: 5 percentage points. */
export const TOLERANCE: Readonly<Record<CalibrationKey, ToleranceKind>> = {
  votesPerUserMean: "relative",
  votesPerUserMedian: "relative",
  votesPerUserP90: "tail",
  votesPerUserP99: "tail",
  shareUsers1: "points",
  shareUsers2to4: "points",
  shareUsers5to19: "points",
  shareUsers20plus: "points",
  activitySkewTop20: "points",
  followeesMean: "relative",
  followListShare: "points",
};

const KEYS = Object.keys(TOLERANCE) as CalibrationKey[];

export type Measured = Record<CalibrationKey, number | null> & {
  /** Users with at least one action. */
  actors: number;
  topUserActions: number;
  /** Largest number of actions of one user, divided by all actions. */
  topUserShare: number | null;
};

export interface CalibrationRow {
  name: CalibrationKey | "maxUserActionShare";
  generated: number | null;
  target: number;
  tolerance: string;
  pass: boolean;
}

export interface CalibrationLimits {
  maxUserActionShare: number;
  /** The cap on actions per user, to count the users at it. */
  cap?: number;
}

export interface CalibrationResult {
  pass: boolean;
  rows: CalibrationRow[];
  topUserShare: number | null;
  topUserActions: number;
  usersAtCap: number | null;
}

const EPS = 1e-9;

export function withinTolerance(kind: ToleranceKind, generated: number, target: number): boolean {
  if (kind === "relative") return Math.abs(generated - target) <= 0.1 * Math.abs(target) + EPS;
  if (kind === "tail") return Math.abs(generated - target) <= 0.25 * Math.abs(target) + EPS;
  return Math.abs(generated - target) <= 0.05 + EPS;
}

function toleranceText(kind: ToleranceKind): string {
  return kind === "relative" ? "10%" : kind === "tail" ? "25%" : "5 points";
}

function numeric(a: number, b: number): number {
  return a - b;
}

/** Nearest rank: the value at rank ceil(p n / 100) of the sorted list. */
function percentile(sorted: readonly number[], pct: number): number {
  const rank = Math.floor((sorted.length * pct + 99) / 100);
  return sorted[rank - 1] as number;
}

export function measure(data: Dataset): Measured {
  const perUser = new Map<number, number>();
  for (const e of data.interactions) perUser.set(e.userId, (perUser.get(e.userId) ?? 0) + 1);
  const counts = [...perUser.values()].sort(numeric);
  const actors = counts.length;
  const m: Measured = {
    actors,
    topUserActions: 0,
    topUserShare: null,
    votesPerUserMean: null,
    votesPerUserMedian: null,
    votesPerUserP90: null,
    votesPerUserP99: null,
    shareUsers1: null,
    shareUsers2to4: null,
    shareUsers5to19: null,
    shareUsers20plus: null,
    activitySkewTop20: null,
    followeesMean: null,
    followListShare: null,
  };
  if (actors > 0) {
    let total = 0;
    for (const c of counts) total += c;
    m.votesPerUserMean = total / actors;
    m.votesPerUserMedian = percentile(counts, 50);
    m.votesPerUserP90 = percentile(counts, 90);
    m.votesPerUserP99 = percentile(counts, 99);
    m.shareUsers1 = counts.filter((c) => c === 1).length / actors;
    m.shareUsers2to4 = counts.filter((c) => c >= 2 && c <= 4).length / actors;
    m.shareUsers5to19 = counts.filter((c) => c >= 5 && c <= 19).length / actors;
    m.shareUsers20plus = counts.filter((c) => c >= 20).length / actors;
    const top = Math.ceil(actors / 5);
    let topSum = 0;
    for (let i = 0; i < top; i++) topSum += counts[actors - 1 - i] as number;
    m.activitySkewTop20 = topSum / total;
    m.topUserActions = counts[actors - 1] as number;
    m.topUserShare = m.topUserActions / total;
  }
  const perFollower = new Map<number, number>();
  for (const f of data.follows) perFollower.set(f.followerId, (perFollower.get(f.followerId) ?? 0) + 1);
  if (perFollower.size > 0) {
    let s = 0;
    for (const c of perFollower.values()) s += c;
    m.followeesMean = s / perFollower.size;
  }
  m.followListShare = data.users.length > 0 ? perFollower.size / data.users.length : null;
  return m;
}

export function calibrate(data: Dataset, targets: CalibrationTargets, limits?: CalibrationLimits): CalibrationResult {
  const m = measure(data);
  const rows: CalibrationRow[] = [];
  for (const key of KEYS) {
    const target = targets[key];
    if (target === undefined) continue;
    const generated = m[key];
    const kind = TOLERANCE[key];
    rows.push({
      name: key,
      generated,
      target,
      tolerance: toleranceText(kind),
      pass: generated !== null && withinTolerance(kind, generated, target),
    });
  }
  let usersAtCap: number | null = null;
  if (limits) {
    rows.push({
      name: "maxUserActionShare",
      generated: m.topUserShare,
      target: limits.maxUserActionShare,
      tolerance: "limit",
      pass: m.topUserShare !== null && m.topUserShare <= limits.maxUserActionShare + EPS,
    });
    if (limits.cap !== undefined) {
      const perUser = new Map<number, number>();
      for (const e of data.interactions) perUser.set(e.userId, (perUser.get(e.userId) ?? 0) + 1);
      // a user at the cap may lose a few actions that found no candidate
      usersAtCap = [...perUser.values()].filter((c) => c >= 0.99 * (limits.cap as number)).length;
    }
  }
  return { pass: rows.every((r) => r.pass), rows, topUserShare: m.topUserShare, topUserActions: m.topUserActions, usersAtCap };
}
