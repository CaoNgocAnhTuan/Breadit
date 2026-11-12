import type { CanonicalTables } from "../../../eval/src/adapters/digg.ts";
import type { Row } from "../../../eval/src/canonical/csv.ts";

// The Hive transform (task p7-hive-check, design "One transform, used by both stages" and "Transform rules").
// It turns the raw rows of the BigQuery export into the six canonical tables of blueprint section 2.2.
// It is pure: no file, no clock, no randomness. gate.ts reads the files and calls it. In Stage 2 this file moves
// with `git mv` into eval/src/adapters/ and the adapter calls it the same way.
//
// ---------------------------------------------------------------------------------------------------------------
// The raw tables. The SQL of queries/q2 to q6 must return exactly these columns, in this order, one CSV file per
// part (a table may be split by month: votes-2021-01.csv, votes-2021-02.csv, ...). Every cell is plain text as it
// comes out of the CSV. Every time is an integer Unix second written as a decimal string (UNIX_SECONDS of the block
// timestamp): "1609459200", never "1609459200.0", never an ISO date. The first row of a file is the header, with
// the column names below. A cell with a comma, a quote or a line break is quoted as in RFC 4180 (""), which is what
// the BigQuery export does.
//
//   posts       author, permlink, community, t
//               The root posts of the slice. `community` is the name `hive-NNNNNN`, the parent_permlink of the
//               comment_operation. `t` is the block time of the operation.
//   votes       voter, author, permlink, weight, t
//               vote_operation rows on slice posts: `author` and `permlink` name the post that was voted.
//               `weight` is an integer from -10000 to 10000.
//   replies     author, permlink, parent_author, parent_permlink, t
//               comment_operation rows that are not root posts: `author` and `permlink` name the reply, the two
//               `parent_` columns name what it answers.
//   reblogs     account, author, permlink, t
//               custom_json `reblog` rows: `account` reblogs the post (`author`, `permlink`).
//   subscribes  account, community, t
//               custom_json `community` `subscribe` rows only (an unsubscribe is not exported: the contract has
//               additions only, Spec Open question 4).
//   follows     follower, following, what, t
//               custom_json `follow` rows, one pair per row. `what` is the list as text, for example ["blog"].
//               A follow counts only when the list is exactly ["blog"]; [] is an unfollow and is dropped;
//               any other list (for example ["ignore"]) is dropped too.
//
// Raw rows may repeat the same operation (an edit sends the operation again, a voter changes a vote). The rows
// can come in any order and in any split into files: the output does not depend on them.
//
// Strict parse: an account name must match ^[a-z0-9.-]{3,16}$, a community ^hive-[0-9]+$, a permlink 1 to 256
// printable ASCII characters (no space), a time an integer, a weight an integer in [-10000, 10000]. A cell that
// fails stops the run with the file and the row ("votes-2021-01.csv row 4": the header is row 1, as in a
// spreadsheet). This holds for every row, also for one that a rule drops later.
// ---------------------------------------------------------------------------------------------------------------

export const HIVE_COLUMNS = {
  posts: ["author", "permlink", "community", "t"],
  votes: ["voter", "author", "permlink", "weight", "t"],
  replies: ["author", "permlink", "parent_author", "parent_permlink", "t"],
  reblogs: ["account", "author", "permlink", "t"],
  subscribes: ["account", "community", "t"],
  follows: ["follower", "following", "what", "t"],
} as const;

export type HiveTable = keyof typeof HIVE_COLUMNS;
export const HIVE_TABLES = Object.keys(HIVE_COLUMNS) as HiveTable[];

/** One raw row: every column as text. */
export type HiveRow<T extends HiveTable> = Record<(typeof HIVE_COLUMNS)[T][number], string>;

/** The rows of one raw file. `file` is the name used in error messages. */
export interface RawPart<T extends HiveTable> {
  file: string;
  rows: Array<HiveRow<T>>;
}

export type HiveRaw = { [T in HiveTable]: Array<RawPart<T>> };

/** Rows read, rows dropped by each rule (in the order of the rules) and rows written. */
export interface HiveCounts {
  postRows: number;
  postsOutsideCommunitiesDropped: number;
  repeatedPostsDropped: number;
  posts: number;

  voteRows: number;
  votesOnOtherPostsDropped: number;
  votesNonPositiveDropped: number;
  repeatedVotesDropped: number;
  selfVotesDropped: number;
  votesNotAfterPostDropped: number;
  likes: number;

  replyRows: number;
  repliesToRepliesDropped: number;
  repliesToOtherPostsDropped: number;
  repeatedRepliesDropped: number;
  selfRepliesDropped: number;
  repliesNotAfterPostDropped: number;
  comments: number;

  reblogRows: number;
  reblogsOfOtherPostsDropped: number;
  repeatedReblogsDropped: number;
  selfReblogsDropped: number;
  reblogsNotAfterPostDropped: number;
  reposts: number;

  subscribeRows: number;
  subscribesOutsideCommunitiesDropped: number;
  repeatedSubscribesDropped: number;
  memberships: number;

  followRows: number;
  unfollowsDropped: number;
  otherFollowListsDropped: number;
  selfFollowsDropped: number;
  repeatedFollowsDropped: number;
  followsOutsideSliceDropped: number;
  follows: number;

  users: number;
  communities: number;
}

// ---------------------------------------------------------------- strict cells

const ACCOUNT = /^[a-z0-9.-]{3,16}$/;
const COMMUNITY = /^hive-[0-9]+$/;
const PERMLINK = /^[!-~]{1,256}$/;
const INT = /^(0|[1-9][0-9]*)$/;
const WEIGHT = /^(0|-?[1-9][0-9]*)$/;
const MAX_WEIGHT = 10000;

function byteCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function bad(file: string, no: number, field: string, value: unknown, why: string): never {
  throw new Error(`${file} row ${no}: ${field} ${JSON.stringify(value)} ${why}`);
}

function account(file: string, no: number, field: string, v: unknown): string {
  if (typeof v !== "string" || !ACCOUNT.test(v)) bad(file, no, field, v, "is not an account name (3 to 16 of a-z 0-9 . -)");
  return v;
}

function community(file: string, no: number, field: string, v: unknown): string {
  if (typeof v !== "string" || !COMMUNITY.test(v)) bad(file, no, field, v, "is not a community name (hive-<digits>)");
  return v;
}

function permlink(file: string, no: number, field: string, v: unknown): string {
  if (typeof v !== "string" || !PERMLINK.test(v)) bad(file, no, field, v, "is not a permlink (1 to 256 printable ASCII characters, no space)");
  return v;
}

function time(file: string, no: number, field: string, v: unknown): number {
  if (typeof v !== "string" || !INT.test(v) || !Number.isSafeInteger(Number(v))) bad(file, no, field, v, "is not an integer number of seconds");
  return Number(v);
}

function weight(file: string, no: number, field: string, v: unknown): number {
  if (typeof v !== "string" || !WEIGHT.test(v) || Math.abs(Number(v)) > MAX_WEIGHT) {
    bad(file, no, field, v, `is not an integer from -${MAX_WEIGHT} to ${MAX_WEIGHT}`);
  }
  return Number(v);
}

/** The rows of every part, parts in file-name order. `no` is the row number in the file (the header is row 1). */
function* rowsOf<T extends HiveTable>(parts: ReadonlyArray<RawPart<T>>): Generator<{ row: HiveRow<T>; file: string; no: number }> {
  for (const part of [...parts].sort((a, b) => byteCompare(a.file, b.file))) {
    for (let i = 0; i < part.rows.length; i++) yield { row: part.rows[i] as HiveRow<T>, file: part.file, no: i + 2 };
  }
}

// A key for a Map. Account names and permlinks never hold a space, so a space cannot join two keys wrongly.
function key(...parts: string[]): string {
  return parts.join(" ");
}

type FollowList = "follow" | "unfollow" | "other";

/** The follow list: exactly ["blog"] is a follow, [] an unfollow, anything else (also text that is not JSON) other. */
function followList(what: string): FollowList {
  let v: unknown;
  try {
    v = JSON.parse(what);
  } catch {
    return "other";
  }
  if (!Array.isArray(v)) return "other";
  if (v.length === 0) return "unfollow";
  if (v.length === 1 && v[0] === "blog") return "follow";
  return "other";
}

// ---------------------------------------------------------------- the transform

interface Post {
  author: string;
  permlink: string;
  community: string;
  communityId: number;
  t: number;
}

/** A positive of one user on one slice post, before the self and same-second rules. */
interface Hit {
  user: string;
  post: string;
  t: number;
}

/** Keeps the earliest hit per (user, post) and sorts out the author's own and the not-after-the-post hits. */
function settle(
  hits: readonly Hit[],
  posts: ReadonlyMap<string, Post>,
): { kept: Hit[]; repeated: number; self: number; notAfter: number } {
  const first = new Map<string, Hit>();
  for (const h of hits) {
    const k = key(h.user, h.post);
    const cur = first.get(k);
    if (cur === undefined || h.t < cur.t) first.set(k, h);
  }
  const kept: Hit[] = [];
  let self = 0;
  let notAfter = 0;
  for (const h of first.values()) {
    const p = posts.get(h.post) as Post;
    if (h.user === p.author) self++;
    else if (h.t <= p.t) notAfter++;
    else kept.push(h);
  }
  return { kept, repeated: hits.length - first.size, self, notAfter };
}

function minInto<K>(m: Map<K, number>, k: K, t: number): void {
  const cur = m.get(k);
  if (cur === undefined || t < cur) m.set(k, t);
}

/**
 * Raw Hive rows to the six canonical tables. `communities` are the names of the slice (`hive-NNNNNN`).
 * The rules are the table "Transform rules" of the design; every row is either kept or counted as dropped by
 * exactly one rule. The result does not depend on the order of the raw rows.
 */
export function toHiveCanonical(raw: HiveRaw, communities: readonly string[]): { tables: CanonicalTables; counts: HiveCounts } {
  if (communities.length === 0) throw new Error("no communities given");
  const communityId = new Map<string, number>();
  const numbers = new Set<number>();
  for (const name of communities) {
    if (!COMMUNITY.test(name)) throw new Error(`community ${JSON.stringify(name)} is not a community name (hive-<digits>)`);
    if (communityId.has(name)) throw new Error(`community ${name} is given twice`);
    const id = Number(name.slice("hive-".length));
    if (!Number.isSafeInteger(id)) throw new Error(`community ${name}: the number is too large`);
    if (numbers.has(id)) throw new Error(`community ${name} has the same number as another community`);
    numbers.add(id);
    communityId.set(name, id);
  }

  // ---- parse every row first: a bad cell stops the run, also in a row that a rule would drop
  const postRows = [...rowsOf(raw.posts)].map(({ row, file, no }) => ({
    author: account(file, no, "author", row.author),
    permlink: permlink(file, no, "permlink", row.permlink),
    community: community(file, no, "community", row.community),
    t: time(file, no, "t", row.t),
  }));
  const voteRows = [...rowsOf(raw.votes)].map(({ row, file, no }) => ({
    voter: account(file, no, "voter", row.voter),
    author: account(file, no, "author", row.author),
    permlink: permlink(file, no, "permlink", row.permlink),
    weight: weight(file, no, "weight", row.weight),
    t: time(file, no, "t", row.t),
  }));
  const replyRows = [...rowsOf(raw.replies)].map(({ row, file, no }) => ({
    author: account(file, no, "author", row.author),
    permlink: permlink(file, no, "permlink", row.permlink),
    parentAuthor: account(file, no, "parent_author", row.parent_author),
    parentPermlink: permlink(file, no, "parent_permlink", row.parent_permlink),
    t: time(file, no, "t", row.t),
  }));
  const reblogRows = [...rowsOf(raw.reblogs)].map(({ row, file, no }) => ({
    account: account(file, no, "account", row.account),
    author: account(file, no, "author", row.author),
    permlink: permlink(file, no, "permlink", row.permlink),
    t: time(file, no, "t", row.t),
  }));
  const subscribeRows = [...rowsOf(raw.subscribes)].map(({ row, file, no }) => ({
    account: account(file, no, "account", row.account),
    community: community(file, no, "community", row.community),
    t: time(file, no, "t", row.t),
  }));
  const followRows = [...rowsOf(raw.follows)].map(({ row, file, no }) => {
    if (typeof row.what !== "string") bad(file, no, "what", row.what, "is not text");
    return {
      follower: account(file, no, "follower", row.follower),
      following: account(file, no, "following", row.following),
      list: followList(row.what),
      t: time(file, no, "t", row.t),
    };
  });

  // ---- posts: in the slice, the first time per (author, permlink)
  const inSlice = postRows.filter((p) => communityId.has(p.community));
  const posts = new Map<string, Post>();
  for (const p of inSlice) {
    const k = key(p.author, p.permlink);
    const cur = posts.get(k);
    // equal times: the smaller community name, so the pick never depends on the row order
    if (cur === undefined || p.t < cur.t || (p.t === cur.t && p.community < cur.community)) {
      posts.set(k, { author: p.author, permlink: p.permlink, community: p.community, communityId: communityId.get(p.community) as number, t: p.t });
    }
  }

  // ---- likes: positive votes on slice posts
  let votesOnOtherPosts = 0;
  let votesNonPositive = 0;
  const voteHits: Hit[] = [];
  for (const v of voteRows) {
    const post = key(v.author, v.permlink);
    if (!posts.has(post)) votesOnOtherPosts++;
    else if (v.weight <= 0) votesNonPositive++;
    else voteHits.push({ user: v.voter, post, t: v.t });
  }
  const likes = settle(voteHits, posts);

  // ---- comments: direct replies to slice posts
  const replyKeys = new Set(replyRows.map((r) => key(r.author, r.permlink)));
  let repliesToReplies = 0;
  let repliesToOtherPosts = 0;
  const replyHits: Hit[] = [];
  for (const r of replyRows) {
    const parent = key(r.parentAuthor, r.parentPermlink);
    if (posts.has(parent)) replyHits.push({ user: r.author, post: parent, t: r.t });
    else if (replyKeys.has(parent)) repliesToReplies++;
    else repliesToOtherPosts++;
  }
  const comments = settle(replyHits, posts);

  // ---- reposts: reblogs of slice posts
  let reblogsOfOtherPosts = 0;
  const reblogHits: Hit[] = [];
  for (const r of reblogRows) {
    const post = key(r.author, r.permlink);
    if (posts.has(post)) reblogHits.push({ user: r.account, post, t: r.t });
    else reblogsOfOtherPosts++;
  }
  const reposts = settle(reblogHits, posts);

  // ---- memberships: the first subscribe per (user, community)
  let subscribesOutside = 0;
  let subscribeCandidates = 0;
  const memberFirst = new Map<string, { user: string; communityId: number; t: number }>();
  for (const s of subscribeRows) {
    const cid = communityId.get(s.community);
    if (cid === undefined) {
      subscribesOutside++;
      continue;
    }
    subscribeCandidates++;
    const k = key(s.account, s.community);
    const cur = memberFirst.get(k);
    if (cur === undefined || s.t < cur.t) memberFirst.set(k, { user: s.account, communityId: cid, t: s.t });
  }
  const memberships = [...memberFirst.values()];

  // ---- the first time each account and each community appears in a kept row
  const joined = new Map<string, number>();
  const communityCreated = new Map<number, number>();
  for (const p of posts.values()) {
    minInto(joined, p.author, p.t);
    minInto(communityCreated, p.communityId, p.t);
  }
  for (const h of [...likes.kept, ...comments.kept, ...reposts.kept]) minInto(joined, h.user, h.t);
  for (const m of memberships) {
    minInto(joined, m.user, m.t);
    minInto(communityCreated, m.communityId, m.t);
  }

  // ---- follows: exactly ["blog"], not self, the first time per pair, both users in the slice
  const sliceUsers = new Set(joined.keys());
  let unfollows = 0;
  let otherLists = 0;
  let selfFollows = 0;
  let followCandidates = 0;
  const pairFirst = new Map<string, { follower: string; following: string; t: number }>();
  for (const f of followRows) {
    if (f.list === "unfollow") unfollows++;
    else if (f.list === "other") otherLists++;
    else if (f.follower === f.following) selfFollows++;
    else {
      followCandidates++;
      const k = key(f.follower, f.following);
      const cur = pairFirst.get(k);
      if (cur === undefined || f.t < cur.t) pairFirst.set(k, f);
    }
  }
  const follows = [...pairFirst.values()].filter((f) => sliceUsers.has(f.follower) && sliceUsers.has(f.following));
  for (const f of follows) {
    minInto(joined, f.follower, f.t);
    minInto(joined, f.following, f.t);
  }

  // ---- ids: accounts by name from 1, posts by (created_at, author, permlink) from 1, events by (created_at, user, post, type) from 1
  const names = [...joined.keys()].sort(byteCompare);
  const userId = new Map<string, number>(names.map((n, i) => [n, i + 1]));
  const uid = (name: string): number => userId.get(name) as number;

  const sortedPosts = [...posts.values()].sort((a, b) => a.t - b.t || byteCompare(a.author, b.author) || byteCompare(a.permlink, b.permlink));
  const postId = new Map<string, number>(sortedPosts.map((p, i) => [key(p.author, p.permlink), i + 1]));

  const events: Array<{ t: number; user: number; post: number; type: "like" | "comment" | "repost" }> = [];
  for (const [type, kept] of [
    ["like", likes.kept],
    ["comment", comments.kept],
    ["repost", reposts.kept],
  ] as const) {
    for (const h of kept) events.push({ t: h.t, user: uid(h.user), post: postId.get(h.post) as number, type });
  }
  events.sort((a, b) => a.t - b.t || a.user - b.user || a.post - b.post || byteCompare(a.type, b.type));

  // Every table is returned in the sort order of its schema (blueprint section 2.2), so the rows never depend on a Map order.
  const tables: CanonicalTables = {
    users: names.map((n) => ({ user_id: uid(n), joined_at: joined.get(n) as number })),
    follows: follows
      .map((f): Row => ({ follower_id: uid(f.follower), followee_id: uid(f.following), created_at: f.t }))
      .sort((a, b) => (a.follower_id as number) - (b.follower_id as number) || (a.followee_id as number) - (b.followee_id as number)),
    communities: [...communityCreated.entries()]
      .map(([id, t]): Row => ({ community_id: id, created_at: t }))
      .sort((a, b) => (a.community_id as number) - (b.community_id as number)),
    memberships: memberships
      .map((m): Row => ({ user_id: uid(m.user), community_id: m.communityId, joined_at: m.t }))
      .sort((a, b) => (a.user_id as number) - (b.user_id as number) || (a.community_id as number) - (b.community_id as number)),
    posts: sortedPosts.map(
      (p, i): Row => ({ post_id: i + 1, author_id: uid(p.author), community_id: p.communityId, created_at: p.t }),
    ),
    interactions: events.map((e, i): Row => ({ event_id: i + 1, user_id: e.user, post_id: e.post, type: e.type, created_at: e.t })),
  };

  const counts: HiveCounts = {
    postRows: postRows.length,
    postsOutsideCommunitiesDropped: postRows.length - inSlice.length,
    repeatedPostsDropped: inSlice.length - posts.size,
    posts: posts.size,

    voteRows: voteRows.length,
    votesOnOtherPostsDropped: votesOnOtherPosts,
    votesNonPositiveDropped: votesNonPositive,
    repeatedVotesDropped: likes.repeated,
    selfVotesDropped: likes.self,
    votesNotAfterPostDropped: likes.notAfter,
    likes: likes.kept.length,

    replyRows: replyRows.length,
    repliesToRepliesDropped: repliesToReplies,
    repliesToOtherPostsDropped: repliesToOtherPosts,
    repeatedRepliesDropped: comments.repeated,
    selfRepliesDropped: comments.self,
    repliesNotAfterPostDropped: comments.notAfter,
    comments: comments.kept.length,

    reblogRows: reblogRows.length,
    reblogsOfOtherPostsDropped: reblogsOfOtherPosts,
    repeatedReblogsDropped: reposts.repeated,
    selfReblogsDropped: reposts.self,
    reblogsNotAfterPostDropped: reposts.notAfter,
    reposts: reposts.kept.length,

    subscribeRows: subscribeRows.length,
    subscribesOutsideCommunitiesDropped: subscribesOutside,
    repeatedSubscribesDropped: subscribeCandidates - memberFirst.size,
    memberships: memberships.length,

    followRows: followRows.length,
    unfollowsDropped: unfollows,
    otherFollowListsDropped: otherLists,
    selfFollowsDropped: selfFollows,
    repeatedFollowsDropped: followCandidates - pairFirst.size,
    followsOutsideSliceDropped: pairFirst.size - follows.length,
    follows: follows.length,

    users: names.length,
    communities: communityCreated.size,
  };
  return { tables, counts };
}

/** Lines of the counts table, one per count (for gate.md and, in Stage 2, the manifest log). */
export function hiveCountsTable(c: HiveCounts): string[] {
  const rows: Array<[string, number]> = [
    ["post rows read", c.postRows],
    ["posts outside the communities dropped", c.postsOutsideCommunitiesDropped],
    ["repeated posts (edits) dropped", c.repeatedPostsDropped],
    ["posts", c.posts],
    ["vote rows read", c.voteRows],
    ["votes on other posts dropped", c.votesOnOtherPostsDropped],
    ["votes with weight 0 or below dropped", c.votesNonPositiveDropped],
    ["repeated votes dropped", c.repeatedVotesDropped],
    ["self votes dropped", c.selfVotesDropped],
    ["votes not after the post dropped", c.votesNotAfterPostDropped],
    ["likes", c.likes],
    ["reply rows read", c.replyRows],
    ["replies to replies dropped", c.repliesToRepliesDropped],
    ["replies to other posts dropped", c.repliesToOtherPostsDropped],
    ["repeated replies dropped", c.repeatedRepliesDropped],
    ["self replies dropped", c.selfRepliesDropped],
    ["replies not after the post dropped", c.repliesNotAfterPostDropped],
    ["comments", c.comments],
    ["reblog rows read", c.reblogRows],
    ["reblogs of other posts dropped", c.reblogsOfOtherPostsDropped],
    ["repeated reblogs dropped", c.repeatedReblogsDropped],
    ["self reblogs dropped", c.selfReblogsDropped],
    ["reblogs not after the post dropped", c.reblogsNotAfterPostDropped],
    ["reposts", c.reposts],
    ["subscribe rows read", c.subscribeRows],
    ["subscribes outside the communities dropped", c.subscribesOutsideCommunitiesDropped],
    ["repeated subscribes dropped", c.repeatedSubscribesDropped],
    ["memberships", c.memberships],
    ["follow rows read", c.followRows],
    ["unfollows dropped", c.unfollowsDropped],
    ["other follow lists dropped", c.otherFollowListsDropped],
    ["self follows dropped", c.selfFollowsDropped],
    ["repeated follows dropped", c.repeatedFollowsDropped],
    ["follows outside the slice dropped", c.followsOutsideSliceDropped],
    ["follows", c.follows],
    ["users", c.users],
    ["communities", c.communities],
  ];
  const width = Math.max(...rows.map((r) => r[0].length));
  return rows.map(([name, n]) => `  ${name.padEnd(width)}  ${String(n).padStart(10)}`);
}

// ---------------------------------------------------------------- the CSV reader

/**
 * Reads the text of one raw CSV file (RFC 4180: a cell with a comma, a quote or a line break is in quotes, a quote
 * inside is doubled; rows end with LF or CRLF; a UTF-8 BOM and a missing final newline are accepted). The header
 * must be exactly `columns`. Every row must have that many cells. Anything else stops with the file and the row
 * (the header is row 1).
 */
export function parseHiveCsv<T extends HiveTable>(text: string, file: string, table: T): Array<HiveRow<T>>;
export function parseHiveCsv(text: string, file: string, columns: readonly string[]): Array<Record<string, string>>;
export function parseHiveCsv(text: string, file: string, tableOrColumns: HiveTable | readonly string[]): Array<Record<string, string>> {
  const columns: readonly string[] = typeof tableOrColumns === "string" ? HIVE_COLUMNS[tableOrColumns] : tableOrColumns;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (s.length === 0) throw new Error(`${file}: empty file (no header row)`);
  const n = s.length;
  const records: string[][] = [];
  let rec: string[] = [];
  let i = 0;
  for (;;) {
    if (i >= n && rec.length === 0) break;
    const no = records.length + 1;
    let value: string;
    if (s[i] === '"') {
      i++;
      value = "";
      for (;;) {
        const j = s.indexOf('"', i);
        if (j < 0) throw new Error(`${file} row ${no}: unterminated quoted cell`);
        value += s.slice(i, j);
        if (s[j + 1] === '"') {
          value += '"';
          i = j + 2;
        } else {
          i = j + 1;
          break;
        }
      }
      const c = s[i];
      if (i < n && c !== "," && c !== "\n" && !(c === "\r" && s[i + 1] === "\n")) {
        throw new Error(`${file} row ${no}: text after the closing quote of a cell`);
      }
    } else {
      let j = i;
      while (j < n && s[j] !== "," && s[j] !== "\n") j++;
      value = s.slice(i, j);
      if (j < n && s[j] === "\n" && value.endsWith("\r")) value = value.slice(0, -1);
      if (value.includes("\r")) throw new Error(`${file} row ${no}: stray CR in a cell`);
      if (value.includes('"')) throw new Error(`${file} row ${no}: a quote inside a cell that is not quoted`);
      i = j;
    }
    rec.push(value);
    if (i < n && s[i] === ",") {
      i++;
      continue;
    }
    // end of the row: LF, CRLF or the end of the text
    if (i < n && s[i] === "\r") i++;
    if (i < n && s[i] === "\n") i++;
    records.push(rec);
    rec = [];
  }

  const header = records[0] as string[];
  if (header.length !== columns.length || header.some((h, k) => h !== columns[k])) {
    throw new Error(`${file} row 1: header is not "${columns.join(",")}"`);
  }
  const out: Array<Record<string, string>> = [];
  for (let r = 1; r < records.length; r++) {
    const cells = records[r] as string[];
    if (cells.length !== columns.length) throw new Error(`${file} row ${r + 1}: ${cells.length} fields, expected ${columns.length}`);
    const row: Record<string, string> = {};
    columns.forEach((c, k) => (row[c] = cells[k] as string));
    out.push(row);
  }
  return out;
}
