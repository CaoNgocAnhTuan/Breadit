import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex, writeTable } from "../canonical/csv.ts";
import type { FileEntry, Row } from "../canonical/csv.ts";
import { writeManifest } from "../canonical/manifest.ts";
import type { Manifest } from "../canonical/manifest.ts";
import { SCHEMAS, TABLES } from "../canonical/schema.ts";
import type { TableName } from "../canonical/schema.ts";
import { datasetDir } from "../generator/generate.ts";
import { parseFriends, parseVotes } from "./digg-parse.ts";
import type { LinkRows, VoteRows } from "./digg-parse.ts";
import { readEncryptedMember } from "./zip.ts";

// The Digg 2009 source: two zips, their SHA-256, the password from the Digg page, and the choices of the
// adapter (task p4-digg-adapter, Spec open questions 1, 2, 4 and 5). digg.test.ts keeps the zip table equal to
// .docs/datasets.md section 4, so the doc stays the source and the code cannot drift from it.

export interface DiggZip {
  /** File name in the raw folder. */
  file: string;
  /** Internet Archive capture URL. */
  url: string;
  /** Capture time, ISO string (a fact of the source, never a clock). */
  capturedAt: string;
  sha256: string;
  /** The one member inside the zip, and its size when unpacked. */
  member: string;
  memberBytes: number;
}

export interface DiggChoices {
  /** Open question 1: drop follow links with date 0 (unknown date). */
  dropZeroDateLinks: boolean;
  /** Open question 2: add the reverse link for a `mutual` = 1 row. */
  addMutualReverse: boolean;
  /** Open question 4: ids are Digg's own `voter_id`, `user_id` and `story_id`. */
  idSource: "digg";
  /** Open question 5: `joined_at` is the earliest time the id appears. */
  joinedAt: "firstAppearance";
}

export interface DiggConfig {
  version: number;
  datasetId: string;
  page: { url: string; citation: string };
  /** Published on the Digg page. */
  password: string;
  zips: { votes: DiggZip; friends: DiggZip };
  choices: DiggChoices;
}

export function diggConfigUrl(): URL {
  return new URL("../../config/digg2009.json", import.meta.url);
}

export function loadDiggConfig(): DiggConfig {
  return JSON.parse(readFileSync(diggConfigUrl(), "utf8")) as DiggConfig;
}

// ---------------------------------------------------------------- the transform (design "Parse strictly, then transform")

/** Rows read and rows dropped by each rule, in the order of the counts table (DW4). */
export interface DiggCounts {
  voteRows: number;
  repeatedVotesDropped: number;
  stories: number;
  positives: number;
  linkRows: number;
  zeroDateLinksDropped: number;
  selfLinksDropped: number;
  mutualReversesAdded: number;
  repeatedLinksDropped: number;
  follows: number;
  users: number;
}

export type CanonicalTables = Record<TableName, Row[]>;

/**
 * Digg rows to the six canonical tables with the P2 rules (blueprint section 3.7):
 * a repeated (voter, story) pair keeps its earliest vote; a story's author and created_at come from its first vote
 * (time ties to the smaller voter id); the author's vote is the post, not a like; every other vote is a like,
 * numbered from 1 in (t, voter, story) order; links with date 0 and self-links are dropped; a link pair keeps its
 * earliest date; users are the voters plus the ids in kept links, joined at their first appearance.
 */
export function toCanonical(
  votes: VoteRows,
  links: LinkRows,
  choices: DiggChoices,
): { tables: CanonicalTables; counts: DiggCounts } {
  // ---- votes: sort by (t, voter, story), drop repeats, split the post from the likes
  const order = new Uint32Array(votes.count);
  for (let i = 0; i < order.length; i++) order[i] = i;
  order.sort((a, b) => votes.t[a]! - votes.t[b]! || votes.voter[a]! - votes.voter[b]! || votes.story[a]! - votes.story[b]!);

  const votersByStory = new Map<number, Set<number>>();
  const authorOf = new Map<number, number>();
  const posts: Row[] = [];
  const interactions: Row[] = [];
  const firstSeen = new Map<number, number>(); // user id -> joined_at
  let repeated = 0;
  let eventId = 0;
  for (const i of order) {
    const t = votes.t[i] as number;
    const voter = votes.voter[i] as number;
    const story = votes.story[i] as number;
    let seen = votersByStory.get(story);
    if (seen === undefined) {
      seen = new Set();
      votersByStory.set(story, seen);
    }
    if (seen.has(voter)) {
      repeated++;
      continue;
    }
    seen.add(voter);
    if (!firstSeen.has(voter)) firstSeen.set(voter, t);
    if (!authorOf.has(story)) {
      authorOf.set(story, voter);
      posts.push({ post_id: story, author_id: voter, community_id: null, created_at: t });
    } else {
      eventId++;
      interactions.push({ event_id: eventId, user_id: voter, post_id: story, type: "like", created_at: t });
    }
  }

  // ---- links: drop self-links and date 0, add reverses if asked, keep the earliest date of a pair
  let zero = 0;
  let self = 0;
  const lu: number[] = [];
  const lf: number[] = [];
  const lt: number[] = [];
  let reverses = 0;
  for (let i = 0; i < links.count; i++) {
    const user = links.user[i] as number;
    const friend = links.friend[i] as number;
    const t = links.t[i] as number;
    if (user === friend) {
      self++;
      continue;
    }
    if (t === 0 && choices.dropZeroDateLinks) {
      zero++;
      continue;
    }
    lu.push(user);
    lf.push(friend);
    lt.push(t);
    if (links.mutual[i] === 1 && choices.addMutualReverse) {
      lu.push(friend);
      lf.push(user);
      lt.push(t);
      reverses++;
    }
  }
  const lorder = new Uint32Array(lu.length);
  for (let i = 0; i < lorder.length; i++) lorder[i] = i;
  lorder.sort((a, b) => lu[a]! - lu[b]! || lf[a]! - lf[b]! || lt[a]! - lt[b]!);

  const follows: Row[] = [];
  let repeatedLinks = 0;
  let prevUser = -1;
  let prevFriend = -1;
  for (const i of lorder) {
    const user = lu[i] as number;
    const friend = lf[i] as number;
    if (user === prevUser && friend === prevFriend) {
      repeatedLinks++;
      continue;
    }
    prevUser = user;
    prevFriend = friend;
    const t = lt[i] as number;
    follows.push({ follower_id: user, followee_id: friend, created_at: t });
    for (const id of [user, friend]) {
      const cur = firstSeen.get(id);
      if (cur === undefined || t < cur) firstSeen.set(id, t);
    }
  }

  const users: Row[] = [...firstSeen.entries()].sort((a, b) => a[0] - b[0]).map(([id, joined]) => ({ user_id: id, joined_at: joined }));
  const tables: CanonicalTables = {
    users,
    follows,
    communities: [],
    memberships: [],
    posts,
    interactions,
  };
  const counts: DiggCounts = {
    voteRows: votes.count,
    repeatedVotesDropped: repeated,
    stories: posts.length,
    positives: interactions.length,
    linkRows: links.count,
    zeroDateLinksDropped: zero,
    selfLinksDropped: self,
    mutualReversesAdded: reverses,
    repeatedLinksDropped: repeatedLinks,
    follows: follows.length,
    users: users.length,
  };
  return { tables, counts };
}

// ---------------------------------------------------------------- the adapter (design "Adapt" sequence)

/** The rules that are fixed in the code (the P2 rules of blueprint section 3.7), named in the manifest. */
export const RULES: readonly string[] = [
  "repeatedVote: a repeated (voter, story) pair keeps its earliest vote",
  "story: author and created_at come from the first vote, a time tie goes to the smaller voter id",
  "authorVote: the first vote is the post, not a like",
  "otherVotes: every other vote is a like, event_id is the 1-based rank in (t, voter_id, story_id) order",
  "selfLinks: dropped",
  "repeatedLink: a (user, friend) pair keeps its earliest date",
  "followsCountedAt: the adapter keeps every dated link with its date, the harness counts a link when it is dated before the test time of the item (AsOf)",
];

/** Lines of the counts table (DW4), one per count. */
export function countsTable(c: DiggCounts): string[] {
  const rows: Array<[string, number]> = [
    ["vote rows read", c.voteRows],
    ["repeated votes dropped", c.repeatedVotesDropped],
    ["stories", c.stories],
    ["positives (likes)", c.positives],
    ["link rows read", c.linkRows],
    ["links with date 0 dropped", c.zeroDateLinksDropped],
    ["self-links dropped", c.selfLinksDropped],
    ["mutual reverses added", c.mutualReversesAdded],
    ["repeated link pairs dropped", c.repeatedLinksDropped],
    ["follows written", c.follows],
    ["users written", c.users],
  ];
  const width = Math.max(...rows.map((r) => r[0].length));
  return rows.map(([name, n]) => `  ${name.padEnd(width)}  ${String(n).padStart(10)}`);
}

function zipBytes(rawDir: string, z: DiggZip): Buffer {
  const path = join(rawDir, z.file);
  if (!existsSync(path)) {
    throw new Error(`zip not found: ${path} (expected ${z.file}, SHA-256 ${z.sha256}, from ${z.url})`);
  }
  const bytes = readFileSync(path);
  const got = sha256Hex(bytes);
  if (got !== z.sha256) {
    throw new Error(`SHA-256 of ${path} is ${got}, expected ${z.sha256} (${z.file} from ${z.url}). No row was read and nothing was written.`);
  }
  return bytes;
}

function memberText(bytes: Buffer, z: DiggZip, password: string): Buffer {
  const m = readEncryptedMember(bytes, password);
  if (m.name !== z.member) throw new Error(`${z.file}: member is "${m.name}", expected "${z.member}"`);
  if (m.data.length !== z.memberBytes) {
    throw new Error(`${z.file}: member "${m.name}" has ${m.data.length} bytes, expected ${z.memberBytes} bytes`);
  }
  return m.data;
}

function zipEntry(z: DiggZip): Record<string, string> {
  return { file: z.file, url: z.url, capturedAt: z.capturedAt, sha256: z.sha256, member: z.member };
}

/**
 * Reads the two zips in memory and writes <outDir>/<datasetId>/ in the canonical format with a manifest.
 * Order (design F1, F2, F9): check the folder path, check both SHA-256 values, read and parse, transform, and only
 * then delete the old folder and write. A failure before the write leaves the old folder as it was.
 */
export function adaptDigg(
  rawDir: string,
  outDir: string,
  config: DiggConfig = loadDiggConfig(),
): { manifest: Manifest; counts: DiggCounts } {
  const dir = datasetDir(outDir, config.datasetId);
  const votesZip = zipBytes(rawDir, config.zips.votes);
  const friendsZip = zipBytes(rawDir, config.zips.friends);
  const votes = parseVotes(memberText(votesZip, config.zips.votes, config.password), config.zips.votes.member);
  const links = parseFriends(memberText(friendsZip, config.zips.friends, config.password), config.zips.friends.member);
  const { tables, counts } = toCanonical(votes, links, config.choices);

  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const files: Record<string, FileEntry> = {};
  for (const t of TABLES) files[SCHEMAS[t].file] = writeTable(dir, t, tables[t]);
  const manifest: Manifest = {
    schemaVersion: 1,
    datasetId: config.datasetId,
    source: {
      kind: "digg",
      page: config.page,
      zips: { votes: zipEntry(config.zips.votes), friends: zipEntry(config.zips.friends) },
      choices: config.choices,
      rules: RULES,
      counts,
    },
    epoch: { iso: "1970-01-01T00:00:00Z", seconds: 0 },
    node: process.version,
    files,
  };
  writeManifest(dir, manifest);
  return { manifest, counts };
}
