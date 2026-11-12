import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFormat } from "../../../eval/src/checks/format.ts";
import { writeFixture } from "../../../eval/src/checks/fixture.ts";
import { HIVE_COLUMNS, hiveCountsTable, parseHiveCsv, toHiveCanonical } from "./hive-transform.ts";
import type { HiveRaw, HiveRow, HiveTable } from "./hive-transform.ts";

// TC1 of plan.md: the Hive transform on a hand-made HiveRaw. The accounts are alice, bob, carol, dave, erin, frank,
// grace and zedmund. The slice is the two communities hive-100001 and hive-100002.

const SLICE = ["hive-100001", "hive-100002"];

/** Rows from lines of cells separated by "|", in the column order of the table. */
function rows<T extends HiveTable>(table: T, lines: string[]): HiveRow<T>[] {
  const cols = HIVE_COLUMNS[table];
  return lines.map((line) => {
    const cells = line.split("|");
    assert.equal(cells.length, cols.length, `fixture line "${line}" for ${table}`);
    const row: Record<string, string> = {};
    cols.forEach((c, i) => (row[c] = cells[i] as string));
    return row as HiveRow<T>;
  });
}

function input(): HiveRaw {
  return {
    posts: [
      {
        file: "posts.csv",
        rows: rows("posts", [
          "alice|post-a|hive-100001|1000",
          "bob|post-b|hive-100002|1100",
          "carol|post-c|hive-100999|1200", // outside the slice
          "alice|post-a|hive-100001|1500", // an edit: the first time stays
          "alice|post-d|hive-100001|2000",
        ]),
      },
    ],
    votes: [
      {
        file: "votes-2021-01.csv",
        rows: rows("votes", [
          "bob|alice|post-a|10000|1010", // first vote: a like
          "bob|alice|post-a|5000|1020", // changed vote: repeated
          "carol|alice|post-a|-10000|1030", // downvote
          "carol|alice|post-a|0|1040", // weight 0
          "alice|alice|post-a|10000|1050", // self vote
          "dave|alice|post-a|100|1000", // same second as the post
          "frank|alice|post-a|-100|1005", // a downvote first ...
          "frank|alice|post-a|100|1070", // ... then an upvote: the first positive vote counts
          "erin|carol|post-c|100|1300", // a post that is not in the slice
        ]),
      },
      { file: "votes-2021-02.csv", rows: rows("votes", ["erin|alice|post-d|100|2100"]) },
    ],
    replies: [
      {
        file: "replies.csv",
        rows: rows("replies", [
          "bob|re-1|alice|post-a|1100", // a comment
          "bob|re-2|alice|post-a|1110", // a second reply by the same user to the same post
          "carol|re-c|bob|post-b|1200", // a comment
          "dave|re-d|bob|re-1|1250", // a reply to a reply
          "alice|re-self|alice|post-a|1300", // self reply
          "erin|re-e|alice|post-a|1000", // same second as the post
          "frank|re-f|grace|unknown|1400", // a parent that is not a post of the slice
        ]),
      },
    ],
    reblogs: [
      {
        file: "reblogs.csv",
        rows: rows("reblogs", [
          "carol|alice|post-a|1400", // a repost
          "carol|alice|post-a|1450", // repeated
          "alice|alice|post-a|1500", // self reblog
          "dave|alice|post-a|1000", // same second as the post
          "erin|bob|post-b|1600", // a repost
          "grace|carol|post-c|1700", // a post that is not in the slice
        ]),
      },
    ],
    subscribes: [
      {
        file: "subscribes.csv",
        rows: rows("subscribes", [
          "bob|hive-100001|500",
          "bob|hive-100001|600", // repeated
          "carol|hive-100001|900",
          "alice|hive-100002|100",
          "dave|hive-100999|50", // outside the slice
          "erin|hive-100002|3000",
        ]),
      },
    ],
    follows: [
      {
        file: "follows.csv",
        rows: rows("follows", [
          'alice|bob|["blog"]|300',
          'alice|bob|["blog"]|350', // repeated pair
          "bob|alice|[]|400", // unfollow
          'carol|alice|["ignore"]|410', // not a follow of blogs
          'carol|carol|["blog"]|420', // self follow
          'dave|alice|["blog"]|200', // dave has no kept row in the slice
          'alice|zedmund|["blog"]|450', // zedmund has no kept row in the slice
          'erin|alice|[ "blog" ]|460', // the same list with spaces
        ]),
      },
    ],
  };
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

test("TC1: ids, times, every rule and every count on the hand-made fixture", () => {
  const { tables, counts } = toHiveCanonical(input(), SLICE);

  // users: the accounts of the kept rows, sorted by name, joined at their first kept row
  assert.deepEqual(tables.users, [
    { user_id: 1, joined_at: 100 }, // alice
    { user_id: 2, joined_at: 300 }, // bob
    { user_id: 3, joined_at: 900 }, // carol
    { user_id: 4, joined_at: 460 }, // erin
    { user_id: 5, joined_at: 1070 }, // frank
  ]);
  assert.deepEqual(tables.communities, [
    { community_id: 100001, created_at: 500 },
    { community_id: 100002, created_at: 100 },
  ]);
  // posts: numbered in (created_at, author, permlink) order; an edit keeps the first time
  assert.deepEqual(tables.posts, [
    { post_id: 1, author_id: 1, community_id: 100001, created_at: 1000 },
    { post_id: 2, author_id: 2, community_id: 100002, created_at: 1100 },
    { post_id: 3, author_id: 1, community_id: 100001, created_at: 2000 },
  ]);
  assert.deepEqual(tables.interactions, [
    { event_id: 1, user_id: 2, post_id: 1, type: "like", created_at: 1010 },
    { event_id: 2, user_id: 5, post_id: 1, type: "like", created_at: 1070 },
    { event_id: 3, user_id: 2, post_id: 1, type: "comment", created_at: 1100 },
    { event_id: 4, user_id: 3, post_id: 2, type: "comment", created_at: 1200 },
    { event_id: 5, user_id: 3, post_id: 1, type: "repost", created_at: 1400 },
    { event_id: 6, user_id: 4, post_id: 2, type: "repost", created_at: 1600 },
    { event_id: 7, user_id: 4, post_id: 3, type: "like", created_at: 2100 },
  ]);
  assert.deepEqual(tables.memberships, [
    { user_id: 1, community_id: 100002, joined_at: 100 },
    { user_id: 2, community_id: 100001, joined_at: 500 },
    { user_id: 3, community_id: 100001, joined_at: 900 },
    { user_id: 4, community_id: 100002, joined_at: 3000 },
  ]);
  assert.deepEqual(tables.follows, [
    { follower_id: 1, followee_id: 2, created_at: 300 },
    { follower_id: 4, followee_id: 1, created_at: 460 },
  ]);

  assert.deepEqual(counts, {
    postRows: 5,
    postsOutsideCommunitiesDropped: 1,
    repeatedPostsDropped: 1,
    posts: 3,
    voteRows: 10,
    votesOnOtherPostsDropped: 1,
    votesNonPositiveDropped: 3,
    repeatedVotesDropped: 1,
    selfVotesDropped: 1,
    votesNotAfterPostDropped: 1,
    likes: 3,
    replyRows: 7,
    repliesToRepliesDropped: 1,
    repliesToOtherPostsDropped: 1,
    repeatedRepliesDropped: 1,
    selfRepliesDropped: 1,
    repliesNotAfterPostDropped: 1,
    comments: 2,
    reblogRows: 6,
    reblogsOfOtherPostsDropped: 1,
    repeatedReblogsDropped: 1,
    selfReblogsDropped: 1,
    reblogsNotAfterPostDropped: 1,
    reposts: 2,
    subscribeRows: 6,
    subscribesOutsideCommunitiesDropped: 1,
    repeatedSubscribesDropped: 1,
    memberships: 4,
    followRows: 8,
    unfollowsDropped: 1,
    otherFollowListsDropped: 1,
    selfFollowsDropped: 1,
    repeatedFollowsDropped: 1,
    followsOutsideSliceDropped: 2,
    follows: 2,
    users: 5,
    communities: 2,
  });
  assert.ok(hiveCountsTable(counts).some((l) => /likes\s+3$/.test(l)));
});

test("TC1: every row is counted once, as kept or as dropped by one rule", () => {
  const { counts: c } = toHiveCanonical(input(), SLICE);
  assert.equal(c.postRows, c.posts + c.postsOutsideCommunitiesDropped + c.repeatedPostsDropped);
  assert.equal(
    c.voteRows,
    c.likes + c.votesOnOtherPostsDropped + c.votesNonPositiveDropped + c.repeatedVotesDropped + c.selfVotesDropped + c.votesNotAfterPostDropped,
  );
  assert.equal(
    c.replyRows,
    c.comments + c.repliesToRepliesDropped + c.repliesToOtherPostsDropped + c.repeatedRepliesDropped + c.selfRepliesDropped + c.repliesNotAfterPostDropped,
  );
  assert.equal(
    c.reblogRows,
    c.reposts + c.reblogsOfOtherPostsDropped + c.repeatedReblogsDropped + c.selfReblogsDropped + c.reblogsNotAfterPostDropped,
  );
  assert.equal(c.subscribeRows, c.memberships + c.subscribesOutsideCommunitiesDropped + c.repeatedSubscribesDropped);
  assert.equal(
    c.followRows,
    c.follows + c.unfollowsDropped + c.otherFollowListsDropped + c.selfFollowsDropped + c.repeatedFollowsDropped + c.followsOutsideSliceDropped,
  );
});

test("TC1: the output passes checkFormat except community-non-member (design F7)", () => {
  const { tables } = toHiveCanonical(input(), SLICE);
  const res = checkFormat(writeFixture(tables));
  // Hive has no rule that an author joins a community before a post. The three posts here have no earlier membership.
  assert.deepEqual(
    res.problems.map((p) => [p.rule, p.count]),
    [["community-non-member", 3]],
  );
});

test("TC1: two calls give equal output and the input is not changed", () => {
  const raw = input();
  const before = JSON.stringify(raw);
  const a = toHiveCanonical(raw, SLICE);
  const b = toHiveCanonical(raw, SLICE);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(raw), before);
});

test("TC1: the output does not depend on the order of the raw rows or on how they are split into files", () => {
  const base = toHiveCanonical(input(), SLICE);
  const raw = input();
  const shuffled = {} as Record<string, unknown>;
  for (const t of Object.keys(HIVE_COLUMNS) as HiveTable[]) {
    const all = raw[t].flatMap((p) => p.rows as Array<Record<string, string>>).reverse();
    const half = all.length >> 1;
    shuffled[t] = [
      { file: `${t}-b.csv`, rows: all.slice(half) },
      { file: `${t}-a.csv`, rows: all.slice(0, half) },
    ];
  }
  assert.deepEqual(toHiveCanonical(shuffled as unknown as HiveRaw, SLICE), base);
});

test("TC1: ids follow (created_at, author, permlink) for posts and (created_at, user id, post id, type) for events", () => {
  const raw: HiveRaw = {
    posts: [
      {
        file: "p.csv",
        rows: rows("posts", ["zzz|p1|hive-100001|10", "yyy|p2|hive-100001|10", "yyy|p0|hive-100001|10"]),
      },
    ],
    votes: [
      {
        file: "v.csv",
        rows: rows("votes", ["ccc|zzz|p1|1|20", "bbb|zzz|p1|1|20", "aaa|yyy|p0|1|20"]),
      },
    ],
    replies: [{ file: "r.csv", rows: rows("replies", ["ccc|re-1|zzz|p1|20"]) }],
    reblogs: [{ file: "b.csv", rows: rows("reblogs", ["ccc|zzz|p1|20"]) }],
    subscribes: [{ file: "s.csv", rows: [] }],
    follows: [{ file: "f.csv", rows: [] }],
  };
  const { tables } = toHiveCanonical(raw, SLICE);
  // users by name: aaa 1, bbb 2, ccc 3, yyy 4, zzz 5. Posts: yyy/p0 1, yyy/p2 2, zzz/p1 3.
  assert.deepEqual(
    tables.posts.map((p) => [p.post_id, p.author_id]),
    [
      [1, 4],
      [2, 4],
      [3, 5],
    ],
  );
  assert.deepEqual(
    tables.interactions.map((e) => [e.event_id, e.user_id, e.post_id, e.type]),
    [
      [1, 1, 1, "like"],
      [2, 2, 3, "like"],
      [3, 3, 3, "comment"], // at the same time, the type goes in byte order: comment, like, repost
      [4, 3, 3, "like"],
      [5, 3, 3, "repost"],
    ],
  );
});

test("TC1: the same post at the same time in two communities is decided by byte order, not by row order", () => {
  const mk = (order: string[]): HiveRaw => ({
    posts: [{ file: "p.csv", rows: rows("posts", order) }],
    votes: [],
    replies: [],
    reblogs: [],
    subscribes: [],
    follows: [],
  });
  const a = toHiveCanonical(mk(["alice|p|hive-100001|10", "alice|p|hive-100002|10"]), SLICE);
  const b = toHiveCanonical(mk(["alice|p|hive-100002|10", "alice|p|hive-100001|10"]), SLICE);
  assert.deepEqual(a, b);
  assert.equal(a.tables.posts[0]?.community_id, 100001);
});

test("TC1: a bad account name, a bad community name and a non-integer time throw with the file and the row", () => {
  const cases: Array<[string, (raw: HiveRaw) => void, RegExp]> = [
    ["upper case account", (r) => void (r.posts[0]!.rows[1]!.author = "Bob"), /posts\.csv row 3: author "Bob"/],
    ["short account", (r) => void (r.votes[0]!.rows[2]!.voter = "ab"), /votes-2021-01\.csv row 4: voter "ab"/],
    ["long account", (r) => void (r.reblogs[0]!.rows[0]!.account = "abcdefghijklmnopq"), /reblogs\.csv row 2: account/],
    ["bad parent account", (r) => void (r.replies[0]!.rows[0]!.parent_author = "AL"), /replies\.csv row 2: parent_author "AL"/],
    ["bad followee", (r) => void (r.follows[0]!.rows[2]!.following = "ALICE"), /follows\.csv row 4: following "ALICE"/],
    ["bad community in posts", (r) => void (r.posts[0]!.rows[0]!.community = "hive-abc"), /posts\.csv row 2: community "hive-abc"/],
    ["bad community in subscribes", (r) => void (r.subscribes[0]!.rows[3]!.community = "Hive-100001"), /subscribes\.csv row 5: community/],
    ["bad permlink", (r) => void (r.votes[1]!.rows[0]!.permlink = "has space"), /votes-2021-02\.csv row 2: permlink/],
    ["decimal time", (r) => void (r.votes[0]!.rows[1]!.t = "12.5"), /votes-2021-01\.csv row 3: t "12\.5"/],
    ["negative time", (r) => void (r.replies[0]!.rows[3]!.t = "-5"), /replies\.csv row 5: t "-5"/],
    ["exponent time", (r) => void (r.posts[0]!.rows[4]!.t = "1e3"), /posts\.csv row 6: t "1e3"/],
    ["empty time", (r) => void (r.subscribes[0]!.rows[0]!.t = ""), /subscribes\.csv row 2: t ""/],
    ["time with a space", (r) => void (r.follows[0]!.rows[0]!.t = " 5"), /follows\.csv row 2: t " 5"/],
    ["weight is not an integer", (r) => void (r.votes[0]!.rows[0]!.weight = "abc"), /votes-2021-01\.csv row 2: weight "abc"/],
    ["weight out of range", (r) => void (r.votes[0]!.rows[0]!.weight = "10001"), /votes-2021-01\.csv row 2: weight "10001"/],
  ];
  for (const [name, mutate, re] of cases) {
    const raw = clone(input());
    mutate(raw);
    assert.throws(() => toHiveCanonical(raw, SLICE), re, name);
  }
});

test("TC1: a bad row stops the run even when the rule would drop it", () => {
  const raw = clone(input());
  raw.votes[0]!.rows[2]!.t = "x"; // a downvote
  assert.throws(() => toHiveCanonical(raw, SLICE), /votes-2021-01\.csv row 4: t "x"/);
});

test("TC1: the list of communities is checked", () => {
  assert.throws(() => toHiveCanonical(input(), []), /no communit/);
  assert.throws(() => toHiveCanonical(input(), ["Hive-1"]), /community "Hive-1"/);
  assert.throws(() => toHiveCanonical(input(), ["hive-1", "hive-1"]), /twice/);
  assert.throws(() => toHiveCanonical(input(), ["hive-1", "hive-01"]), /same number/);
});

// ---------------------------------------------------------------- the CSV reader

const FOLLOW_COLUMNS = HIVE_COLUMNS.follows;

test("TC1: parseHiveCsv reads quoted fields, doubled quotes, CRLF, a BOM and a missing final newline", () => {
  const want = [
    { follower: "alice", following: "bob", what: '["blog"]', t: "300" },
    { follower: "carol", following: "dave", what: '["blog","reblog"]', t: "400" },
  ];
  const lf = 'follower,following,what,t\nalice,bob,"[""blog""]",300\ncarol,dave,"[""blog"",""reblog""]",400\n';
  assert.deepEqual(parseHiveCsv(lf, "f.csv", FOLLOW_COLUMNS), want);
  assert.deepEqual(parseHiveCsv(lf.replaceAll("\n", "\r\n"), "f.csv", FOLLOW_COLUMNS), want);
  assert.deepEqual(parseHiveCsv("﻿" + lf, "f.csv", FOLLOW_COLUMNS), want);
  assert.deepEqual(parseHiveCsv(lf.slice(0, -1), "f.csv", FOLLOW_COLUMNS), want);
  assert.deepEqual(parseHiveCsv("follower,following,what,t\n", "f.csv", FOLLOW_COLUMNS), []);
  // an empty cell stays an empty string, also at the end of a row
  assert.deepEqual(parseHiveCsv("follower,following,what,t\nalice,bob,,\n", "f.csv", FOLLOW_COLUMNS), [
    { follower: "alice", following: "bob", what: "", t: "" },
  ]);
  // a quoted cell may hold a line break
  assert.equal(parseHiveCsv('follower,following,what,t\na,b,"x\ny",1\n', "f.csv", FOLLOW_COLUMNS)[0]?.what, "x\ny");
});

test("TC1: parseHiveCsv stops on a bad header, a wrong field count, a bad quote or an empty file", () => {
  const h = "follower,following,what,t\n";
  assert.throws(() => parseHiveCsv("", "f.csv", FOLLOW_COLUMNS), /f\.csv: empty/);
  assert.throws(() => parseHiveCsv("follower,following,t,what\n", "f.csv", FOLLOW_COLUMNS), /f\.csv row 1: header/);
  assert.throws(() => parseHiveCsv(h + "alice,bob,[],1\nalice,bob\n", "f.csv", FOLLOW_COLUMNS), /f\.csv row 3: 2 fields, expected 4/);
  assert.throws(() => parseHiveCsv(h + "a,b,c,d,e\n", "f.csv", FOLLOW_COLUMNS), /f\.csv row 2: 5 fields, expected 4/);
  assert.throws(() => parseHiveCsv(h + 'a,b,"abc,1\n', "f.csv", FOLLOW_COLUMNS), /f\.csv row 2: .*unterminated/);
  assert.throws(() => parseHiveCsv(h + 'a,b,x"y,1\n', "f.csv", FOLLOW_COLUMNS), /f\.csv row 2: .*quote/);
  assert.throws(() => parseHiveCsv(h + 'a,b,"x"y,1\n', "f.csv", FOLLOW_COLUMNS), /f\.csv row 2: .*after the closing quote/);
  assert.throws(() => parseHiveCsv(h + "a,b,x\ry,1\n", "f.csv", FOLLOW_COLUMNS), /f\.csv row 2: .*CR/);
  assert.throws(() => parseHiveCsv(h + "a,b,c,1\n\n", "f.csv", FOLLOW_COLUMNS), /f\.csv row 3: 1 fields/);
});
