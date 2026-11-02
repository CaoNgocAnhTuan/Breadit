import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFormat } from "./format.ts";
import { writeFixture } from "./fixture.ts";
import type { FixtureOptions, FixtureTables } from "./fixture.ts";

function base(): FixtureTables {
  return {
    users: [
      { user_id: 1, joined_at: 0 },
      { user_id: 2, joined_at: 0 },
      { user_id: 3, joined_at: 0 },
    ],
    follows: [{ follower_id: 2, followee_id: 1, created_at: 5 }],
    communities: [{ community_id: 1, created_at: 0 }],
    memberships: [
      { user_id: 1, community_id: 1, joined_at: 0 },
      { user_id: 3, community_id: 1, joined_at: 50 },
    ],
    posts: [
      { post_id: 1, author_id: 1, community_id: null, created_at: 100 },
      { post_id: 2, author_id: 1, community_id: 1, created_at: 200 },
      { post_id: 3, author_id: 3, community_id: 1, created_at: 300 },
    ],
    interactions: [
      { event_id: 1, user_id: 2, post_id: 1, type: "like", created_at: 150 },
      { event_id: 2, user_id: 2, post_id: 2, type: "comment", created_at: 250 },
      { event_id: 3, user_id: 3, post_id: 1, type: "repost", created_at: 160 },
    ],
  };
}

function rules(tables: FixtureTables, opts?: FixtureOptions): string[] {
  const r = checkFormat(writeFixture(tables, opts));
  assert.equal(r.pass, r.problems.length === 0);
  return r.problems.map((p) => p.rule);
}

test("a good fixture passes", () => {
  const r = checkFormat(writeFixture(base()));
  assert.deepEqual(r.problems, []);
  assert.equal(r.pass, true);
});

test("self-follow", () => {
  const t = base();
  t.follows!.push({ follower_id: 1, followee_id: 1, created_at: 5 });
  assert.deepEqual(rules(t), ["self-follow"]);
});

test("repeated follow pair", () => {
  const t = base();
  t.follows!.push({ follower_id: 2, followee_id: 1, created_at: 6 });
  assert.deepEqual(rules(t), ["repeated-follow"]);
});

test("interaction on an unknown post", () => {
  const t = base();
  t.interactions![0] = { event_id: 1, user_id: 2, post_id: 99, type: "like", created_at: 150 };
  assert.deepEqual(rules(t), ["unknown-post"]);
});

test("interaction at the same second as its post, and before it", () => {
  const same = base();
  same.interactions![0] = { event_id: 1, user_id: 2, post_id: 1, type: "like", created_at: 100 };
  assert.deepEqual(rules(same), ["interaction-not-after-post"]);
  const before = base();
  before.interactions![0] = { event_id: 1, user_id: 2, post_id: 1, type: "like", created_at: 50 };
  assert.deepEqual(rules(before), ["interaction-not-after-post"]);
});

test("interaction on one's own post", () => {
  const t = base();
  t.interactions![0] = { event_id: 1, user_id: 1, post_id: 1, type: "like", created_at: 150 };
  assert.deepEqual(rules(t), ["own-post"]);
});

test("community post by a non-member", () => {
  const t = base();
  t.posts![1] = { post_id: 2, author_id: 2, community_id: 1, created_at: 200 };
  // user 2 acts on post 2 in the base fixture, which is now their own post: change the actor
  t.interactions![1] = { event_id: 2, user_id: 1, post_id: 2, type: "comment", created_at: 250 };
  assert.deepEqual(rules(t), ["community-non-member"]);
});

test("community post by a member who joined after created_at", () => {
  const t = base();
  t.posts![2] = { post_id: 3, author_id: 3, community_id: 1, created_at: 40 };
  assert.deepEqual(rules(t), ["community-non-member"]);
});

test("a member who joined exactly at created_at is a member", () => {
  const t = base();
  t.posts![2] = { post_id: 3, author_id: 3, community_id: 1, created_at: 50 };
  assert.deepEqual(rules(t), []);
});

test("community post in an unknown community", () => {
  const t = base();
  t.posts![0] = { post_id: 1, author_id: 1, community_id: 9, created_at: 100 };
  assert.deepEqual(rules(t), ["unknown-community"]);
});

test("unsorted rows", () => {
  const out = rules(base(), {
    mutate: {
      users: (text) => {
        const lines = text.trimEnd().split("\n");
        return [lines[0], ...lines.slice(1).reverse()].join("\n") + "\n";
      },
    },
  });
  assert.deepEqual(out, ["unsorted"]);
});

test("a CRLF line ending", () => {
  const out = rules(base(), { mutate: { users: (text) => text.replace(/\n/g, "\r\n") } });
  assert.deepEqual(out, ["crlf"]);
});

test("a file not listed in the manifest", () => {
  assert.deepEqual(rules(base(), { extraFiles: { "notes.txt": "hello\n" } }), ["file-not-in-manifest"]);
});

test("a SHA-256 that differs from the manifest", () => {
  const out = rules(base(), {
    manifest: (m) => {
      m.files["users.csv"] = { rows: m.files["users.csv"]!.rows, sha256: "0".repeat(64) };
      return m;
    },
  });
  assert.deepEqual(out, ["sha256"]);
});

test("a row count that differs from the manifest", () => {
  const out = rules(base(), {
    manifest: (m) => {
      m.files["users.csv"] = { rows: 99, sha256: m.files["users.csv"]!.sha256 };
      return m;
    },
  });
  assert.deepEqual(out, ["row-count"]);
});

test("a wrong header and a non-integer cell", () => {
  assert.deepEqual(rules(base(), { mutate: { users: (t) => t.replace("user_id,joined_at", "id,joined_at") } }), ["header"]);
  assert.deepEqual(rules(base(), { mutate: { users: (t) => t.replace("\n2,0\n", "\n02,0\n") } }), ["not-integer"]);
});

test("a duplicate id", () => {
  const t = base();
  t.users!.push({ user_id: 3, joined_at: 1 });
  assert.deepEqual(rules(t), ["duplicate-key"]);
});

test("an unknown interaction type", () => {
  assert.deepEqual(rules(base(), { mutate: { interactions: (t) => t.replace("like", "dislike") } }), ["bad-type"]);
});

test("missing file", () => {
  const dir = writeFixture(base());
  const r = checkFormat(dir + "/nope");
  assert.equal(r.pass, false);
});
