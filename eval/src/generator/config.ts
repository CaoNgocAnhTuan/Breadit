import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { CalibrationKey, CalibrationTargets } from "../checks/calibration.ts";
import type { Frozen } from "../frozen.ts";

export const WORLDS = ["W0", "W1", "W2L", "W2M", "W2H"] as const;
export type WorldId = (typeof WORLDS)[number];
export const SIZES = ["S", "M"] as const;
export type SizeId = (typeof SIZES)[number];

export interface Target {
  key: CalibrationKey;
  value: number;
  row: string;
  file: string;
}

export interface Param {
  value: number;
  kind: "calibrated" | "chosen";
  note?: string;
  targets?: Target[];
}

export interface WorldKnobs {
  homophily: Param;
  influenceSocial: Param;
  influenceCommunity: Param;
}

export interface SyntheticConfig {
  version: number;
  params: Record<string, Param>;
  worlds: Record<WorldId, WorldKnobs>;
}

const DAY = 86400;

export function configUrl(): URL {
  return new URL("../../config/synthetic-v1.json", import.meta.url);
}

export function configText(): string {
  return readFileSync(configUrl(), "utf8");
}

export function configSha256(): string {
  return createHash("sha256").update(configText()).digest("hex");
}

export function loadConfig(): SyntheticConfig {
  return JSON.parse(configText()) as SyntheticConfig;
}

/** The calibration targets, collected from the `targets` of the calibrated parameters. */
export function loadTargets(c: SyntheticConfig): CalibrationTargets {
  const out: Partial<CalibrationTargets> = {};
  for (const p of Object.values(c.params)) {
    for (const t of p.targets ?? []) out[t.key] = t.value;
  }
  const keys: CalibrationKey[] = ["votesPerUserMean", "votesPerUserMedian", "activitySkewTop20", "followeesMean"];
  for (const k of keys) if (out[k] === undefined) throw new Error(`no calibration target for ${k}`);
  return out as CalibrationTargets;
}

/** The parameters of one dataset: the config, one world and one size, with times as seconds from the base epoch. */
export interface GenParams {
  world: WorldId;
  nUsers: number;
  nPosts: number;
  /** Activity span, seconds from the base epoch. */
  spanStart: number;
  spanEnd: number;
  activityTailAlpha: number;
  /** Shares of users with 1, 2-4, 5-19 and 20 or more actions. */
  activityBinShares: number[];
  maxUserActionShare: number;
  interactionsPerUserMean: number;
  followeesMean: number;
  followListShare: number;
  twoWayShare: number;
  followInSpanShare: number;
  secondaryParetoAlpha: number;
  topics: number;
  interestSpread: number;
  noMembershipShare: number;
  maxMembershipsPerUser: number;
  communityPostShare: number;
  lateJoinerShare: number;
  candidateWindowSec: number;
  freshnessTauHours: number;
  popularityPi: number;
  typeShareLike: number;
  typeShareComment: number;
  typeShareRepost: number;
  homophily: number;
  influenceSocial: number;
  influenceCommunity: number;
}

export function makeParams(c: SyntheticConfig, f: Frozen, world: WorldId, size: SizeId): GenParams {
  const v = (name: string): number => {
    const p = c.params[name];
    if (!p) throw new Error(`config has no parameter "${name}"`);
    return p.value;
  };
  const w = c.worlds[world];
  if (!w) throw new Error(`config has no world "${world}"`);
  const spanStart = v("beforeDays") * DAY;
  return {
    world,
    nUsers: f.sizes[size].users,
    nPosts: f.sizes[size].posts,
    spanStart,
    spanEnd: spanStart + v("spanDays") * DAY,
    activityTailAlpha: v("activityTailAlpha"),
    activityBinShares: [v("activityBinShare1"), v("activityBinShare2to4"), v("activityBinShare5to19"), v("activityBinShare20plus")],
    maxUserActionShare: v("maxUserActionShare"),
    interactionsPerUserMean: v("interactionsPerUserMean"),
    followeesMean: v("followeesMean"),
    followListShare: v("followListShare"),
    twoWayShare: v("twoWayShare"),
    followInSpanShare: v("followInSpanShare"),
    secondaryParetoAlpha: v("secondaryParetoAlpha"),
    topics: v("topics"),
    interestSpread: v("interestSpread"),
    noMembershipShare: v("noMembershipShare"),
    maxMembershipsPerUser: v("maxMembershipsPerUser"),
    communityPostShare: v("communityPostShare"),
    lateJoinerShare: v("lateJoinerShare"),
    candidateWindowSec: v("candidateWindowDays") * DAY,
    freshnessTauHours: v("freshnessTauHours"),
    popularityPi: v("popularityPi"),
    typeShareLike: v("typeShareLike"),
    typeShareComment: v("typeShareComment"),
    typeShareRepost: v("typeShareRepost"),
    homophily: w.homophily.value,
    influenceSocial: w.influenceSocial.value,
    influenceCommunity: w.influenceCommunity.value,
  };
}
