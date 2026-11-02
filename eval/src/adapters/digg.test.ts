import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadDiggConfig, toCanonical } from "./digg.ts";
import type { DiggChoices } from "./digg.ts";
import type { LinkRows, VoteRows } from "./digg-parse.ts";

// TC1: the config equals the zip table of .docs/datasets.md section 4. The doc is the source (design F10).
const datasets = readFileSync(new URL("../../../.docs/datasets.md", import.meta.url), "utf8");

function section4(): string {
  const start = datasets.indexOf("## 4. File evidence");
  assert.ok(start >= 0, "section 4 not found in datasets.md");
  const end = datasets.indexOf("\n## 5.", start);
  assert.ok(end > start, "section 5 not found in datasets.md");
  return datasets.slice(start, end);
}

// The two value cells (votes, friends) of one row of the zip table.
function zipRow(label: string): [string, string] {
  for (const line of section4().split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length >= 4 && cells[1] === label) return [cells[2] as string, cells[3] as string];
  }
  throw new Error(`row "${label}" not found in the zip table of datasets.md section 4`);
}

function code(cell: string): string {
  const m = /`([^`]+)`/.exec(cell);
  assert.ok(m, `no code span in "${cell}"`);
  return m[1] as string;
}

test("TC1: the config holds both zips, the password and the choices", () => {
  const c = loadDiggConfig();
  assert.equal(c.datasetId, "digg2009");
  assert.deepEqual(Object.keys(c.zips).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), ["friends", "votes"]);
  assert.equal(c.zips.votes.file, "digg_votes.zip");
  assert.equal(c.zips.friends.file, "digg_friends.zip");
  assert.deepEqual(c.choices, {
    dropZeroDateLinks: true,
    addMutualReverse: false,
    idSource: "digg",
    joinedAt: "firstAppearance",
  });
  assert.ok(c.page.url.startsWith("http"));
  assert.match(c.page.citation, /Hogg/);
});

test("TC1: capture URL, SHA-256, member name and member size equal datasets.md section 4", () => {
  const c = loadDiggConfig();
  const url = zipRow("Capture URL");
  const sha = zipRow("SHA-256");
  const member = zipRow("Member (only one)");
  const time = zipRow("Capture time");
  (["votes", "friends"] as const).forEach((k, i) => {
    const z = c.zips[k];
    assert.equal(z.url, code(url[i] as string), `${k} url`);
    assert.equal(z.sha256, code(sha[i] as string), `${k} sha256`);
    assert.match(z.sha256, /^[0-9a-f]{64}$/);
    const m = /`([^`]+)`,\s*([\d,]+) bytes/.exec(member[i] as string);
    assert.ok(m, `cannot read member from "${member[i] as string}"`);
    assert.equal(z.member, m[1], `${k} member`);
    assert.equal(z.memberBytes, Number((m[2] as string).replace(/,/g, "")), `${k} member size`);
    // "2013-08-26 05:35:17 UTC" is "2013-08-26T05:35:17Z"
    const t = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC$/.exec(time[i] as string);
    assert.ok(t, `cannot read capture time from "${time[i] as string}"`);
    assert.equal(z.capturedAt, `${t[1] as string}T${t[2] as string}Z`, `${k} capture time`);
  });
});

test("TC1: the password equals the one quoted in datasets.md section 4", () => {
  const m = /The password is ([A-Za-z0-9_]+)\./.exec(section4());
  assert.ok(m, "password sentence not found in datasets.md section 4");
  assert.equal(loadDiggConfig().password, m[1]);
});

// ---------------------------------------------------------------- TC4: the transform (the P2 choices)

const P2: DiggChoices = { dropZeroDateLinks: true, addMutualReverse: false, idSource: "digg", joinedAt: "firstAppearance" };

/** Vote rows as [vote_date, voter_id, story_id]. */
function votes(rows: Array<[number, number, number]>): VoteRows {
  return {
    count: rows.length,
    t: Float64Array.from(rows.map((r) => r[0])),
    voter: Int32Array.from(rows.map((r) => r[1])),
    story: Int32Array.from(rows.map((r) => r[2])),
  };
}

/** Link rows as [mutual, friend_date, user_id, friend_id]. */
function links(rows: Array<[number, number, number, number]> = []): LinkRows {
  return {
    count: rows.length,
    mutual: Uint8Array.from(rows.map((r) => r[0])),
    t: Float64Array.from(rows.map((r) => r[1])),
    user: Int32Array.from(rows.map((r) => r[2])),
    friend: Int32Array.from(rows.map((r) => r[3])),
  };
}

function run(v: Array<[number, number, number]>, l: Array<[number, number, number, number]> = [], c: DiggChoices = P2) {
  return toCanonical(votes(v), links(l), c);
}

/** Interactions as [event_id, user_id, post_id, created_at]. */
function likes(r: ReturnType<typeof run>): Array<[number, number, number, number]> {
  return r.tables.interactions.map((x) => [x.event_id, x.user_id, x.post_id, x.created_at] as [number, number, number, number]);
}

function follows(r: ReturnType<typeof run>): Array<[number, number, number]> {
  return r.tables.follows.map((x) => [x.follower_id, x.followee_id, x.created_at] as [number, number, number]);
}

test("TC4: the first vote of a story is its post, even when it is not first in the file", () => {
  const r = run([[110, 11, 1], [100, 10, 1], [120, 12, 1], [205, 20, 2], [200, 21, 2]]);
  assert.deepEqual(
    r.tables.posts.map((p) => [p.post_id, p.author_id, p.community_id, p.created_at]),
    [[1, 10, null, 100], [2, 21, null, 200]],
  );
  // the author's vote is not an interaction
  assert.deepEqual(likes(r).map((x) => [x[1], x[2], x[3]]), [[11, 1, 110], [12, 1, 120], [20, 2, 205]]);
});

test("TC4: a time tie at the first vote goes to the smaller voter id", () => {
  const r = run([[100, 9, 1], [100, 4, 1], [100, 7, 1]]);
  assert.deepEqual(r.tables.posts.map((p) => [p.author_id, p.created_at]), [[4, 100]]);
});

test("TC4: a repeated (voter, story) pair keeps its earliest vote", () => {
  const r = run([[300, 5, 1], [150, 5, 1], [200, 5, 1], [160, 6, 1]]);
  assert.equal(r.counts.voteRows, 4);
  assert.equal(r.counts.repeatedVotesDropped, 2);
  assert.deepEqual(r.tables.posts.map((p) => [p.author_id, p.created_at]), [[5, 150]]);
  assert.deepEqual(likes(r), [[1, 6, 1, 160]]);
  // the same voter on another story is not a repeat
  assert.equal(run([[100, 5, 1], [100, 5, 2]]).counts.repeatedVotesDropped, 0);
});

test("TC4: an author who votes again on the own story adds no like (repeat dropped)", () => {
  const r = run([[100, 5, 1], [200, 5, 1], [150, 6, 1]]);
  assert.equal(r.counts.repeatedVotesDropped, 1);
  assert.deepEqual(likes(r), [[1, 6, 1, 150]]);
});

test("TC4: event_id is the 1-based rank in (t, voter, story) order, and every interaction is a like", () => {
  // stories 1 and 2 are authored by voters 1 and 2 (their first votes)
  const r = run([[50, 9, 2], [50, 3, 2], [50, 3, 1], [40, 8, 1], [1, 1, 1], [2, 2, 2]]);
  assert.deepEqual(likes(r), [[1, 8, 1, 40], [2, 3, 1, 50], [3, 3, 2, 50], [4, 9, 2, 50]]);
  assert.ok(r.tables.interactions.every((x) => x.type === "like"));
});

test("TC4: links with date 0 and self-links are dropped, and a repeated pair keeps its earliest date", () => {
  const r = run([], [
    [0, 0, 1, 2],   // date 0
    [1, 500, 3, 3], // self-link
    [0, 0, 4, 4],   // date 0 and self: counted as a self-link
    [1, 300, 5, 6],
    [0, 200, 5, 6], // same pair, earlier
    [0, 400, 5, 6], // same pair, later
    [0, 100, 6, 5], // the other direction is another pair
  ]);
  assert.deepEqual(follows(r), [[5, 6, 200], [6, 5, 100]]);
  assert.equal(r.counts.linkRows, 7);
  assert.equal(r.counts.zeroDateLinksDropped, 1);
  assert.equal(r.counts.selfLinksDropped, 2);
  assert.equal(r.counts.repeatedLinksDropped, 2);
  assert.equal(r.counts.follows, 2);
});

test("TC4: a mutual row adds no reverse link", () => {
  const r = run([], [[1, 100, 1, 2], [1, 200, 3, 4]]);
  assert.deepEqual(follows(r), [[1, 2, 100], [3, 4, 200]]);
  assert.equal(r.counts.mutualReversesAdded, 0);
});

test("TC4: the other choices work too (reverse for mutual rows, keep date 0)", () => {
  const rev = run([], [[1, 100, 1, 2], [0, 50, 2, 1], [1, 300, 3, 4], [0, 200, 5, 6]], { ...P2, addMutualReverse: true });
  // 2->1 exists with date 50, earlier than the reverse of 1->2 (100): it keeps 50
  assert.deepEqual(follows(rev), [[1, 2, 100], [2, 1, 50], [3, 4, 300], [4, 3, 300], [5, 6, 200]]);
  assert.equal(rev.counts.mutualReversesAdded, 2);
  assert.equal(rev.counts.repeatedLinksDropped, 1);
  assert.equal(rev.counts.follows, 5);
  const keep = run([], [[0, 0, 1, 2]], { ...P2, dropZeroDateLinks: false });
  assert.deepEqual(follows(keep), [[1, 2, 0]]);
  assert.equal(keep.counts.zeroDateLinksDropped, 0);
});

test("TC4: users are the voters plus the ids in kept links; joined_at is the earliest first appearance", () => {
  const r = run(
    [[100, 10, 1], [150, 11, 1], [90, 11, 2], [95, 12, 2]],
    [
      [0, 80, 11, 20],  // 11 appears at 80 (before its first vote at 90), 20 at 80
      [0, 0, 30, 31],   // date 0: dropped, so 30 and 31 are not users
      [0, 70, 21, 12],  // 21 at 70; 12 at 70 (before its vote at 95)
      [0, 60, 12, 12],  // self-link: dropped
    ],
  );
  assert.deepEqual(
    r.tables.users.map((u) => [u.user_id, u.joined_at]),
    [[10, 100], [11, 80], [12, 70], [20, 80], [21, 70]],
  );
  assert.equal(r.counts.users, 5);
});

test("TC4: communities and memberships are empty", () => {
  const r = run([[1, 1, 1], [2, 2, 1]], [[0, 5, 1, 2]]);
  assert.deepEqual(r.tables.communities, []);
  assert.deepEqual(r.tables.memberships, []);
});

test("TC4: the counts table holds the rows read and the rows dropped by every rule", () => {
  const r = run(
    [[100, 1, 1], [100, 1, 1], [120, 2, 1], [130, 3, 1], [200, 4, 2], [210, 1, 2]],
    [[1, 5, 1, 2], [0, 0, 3, 4], [0, 9, 2, 2], [0, 9, 1, 2]],
  );
  assert.deepEqual(r.counts, {
    voteRows: 6,
    repeatedVotesDropped: 1,
    stories: 2,
    positives: 3,
    linkRows: 4,
    zeroDateLinksDropped: 1,
    selfLinksDropped: 1,
    mutualReversesAdded: 0,
    repeatedLinksDropped: 1,
    follows: 1,
    users: 4,
  });
});
