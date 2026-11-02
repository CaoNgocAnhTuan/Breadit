import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeTable, readTable } from "./csv.ts";
import { writeManifest, readManifest } from "./manifest.ts";
import { TABLES, SCHEMAS } from "./schema.ts";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "eval-canon-"));
}

test("six tables with the columns of blueprint section 2.2", () => {
  assert.deepEqual([...TABLES], ["users", "follows", "communities", "memberships", "posts", "interactions"]);
  assert.deepEqual([...SCHEMAS.users.columns], ["user_id", "joined_at"]);
  assert.deepEqual([...SCHEMAS.follows.columns], ["follower_id", "followee_id", "created_at"]);
  assert.deepEqual([...SCHEMAS.communities.columns], ["community_id", "created_at"]);
  assert.deepEqual([...SCHEMAS.memberships.columns], ["user_id", "community_id", "joined_at"]);
  assert.deepEqual([...SCHEMAS.posts.columns], ["post_id", "author_id", "community_id", "created_at"]);
  assert.deepEqual([...SCHEMAS.interactions.columns], ["event_id", "user_id", "post_id", "type", "created_at"]);
});

test("writeTable sorts, writes a header, LF, and an empty community_id as empty", () => {
  const dir = tmp();
  try {
    const entry = writeTable(dir, "posts", [
      { post_id: 3, author_id: 1, community_id: null, created_at: 30 },
      { post_id: 1, author_id: 2, community_id: 7, created_at: 10 },
      { post_id: 2, author_id: 2, community_id: null, created_at: 20 },
    ]);
    const text = readFileSync(join(dir, "posts.csv"), "utf8");
    assert.equal(text, "post_id,author_id,community_id,created_at\n1,2,7,10\n2,2,,20\n3,1,,30\n");
    assert.ok(!text.includes("\r"));
    assert.equal(entry.rows, 3);
    assert.equal(entry.sha256, createHash("sha256").update(readFileSync(join(dir, "posts.csv"))).digest("hex"));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("sort keys: follows by (follower, followee), interactions by (created_at, event_id)", () => {
  const dir = tmp();
  try {
    writeTable(dir, "follows", [
      { follower_id: 2, followee_id: 1, created_at: 5 },
      { follower_id: 1, followee_id: 9, created_at: 5 },
      { follower_id: 1, followee_id: 3, created_at: 5 },
    ]);
    assert.equal(readFileSync(join(dir, "follows.csv"), "utf8"), "follower_id,followee_id,created_at\n1,3,5\n1,9,5\n2,1,5\n");
    writeTable(dir, "interactions", [
      { event_id: 5, user_id: 1, post_id: 1, type: "like", created_at: 20 },
      { event_id: 2, user_id: 1, post_id: 2, type: "comment", created_at: 20 },
      { event_id: 9, user_id: 1, post_id: 3, type: "repost", created_at: 10 },
    ]);
    assert.equal(
      readFileSync(join(dir, "interactions.csv"), "utf8"),
      "event_id,user_id,post_id,type,created_at\n9,1,3,repost,10\n2,1,2,comment,20\n5,1,1,like,20\n",
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("a header-only table is valid (communities for Digg)", () => {
  const dir = tmp();
  try {
    const e = writeTable(dir, "communities", []);
    assert.equal(e.rows, 0);
    assert.equal(readFileSync(join(dir, "communities.csv"), "utf8"), "community_id,created_at\n");
    assert.deepEqual(readTable(dir, "communities"), []);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("writeTable throws on bad input", () => {
  const dir = tmp();
  try {
    assert.throws(() => writeTable(dir, "users", [{ user_id: 1.5, joined_at: 1 }]), /integer/);
    assert.throws(() => writeTable(dir, "users", [{ user_id: 1, joined_at: -1 }]), /integer/);
    assert.throws(() => writeTable(dir, "users", [{ user_id: "7", joined_at: 1 }]), /integer/);
    assert.throws(() => writeTable(dir, "users", [{ user_id: 1 }]), /joined_at/);
    assert.throws(() => writeTable(dir, "users", [{ user_id: 1, joined_at: 1, extra: 3 }]), /extra/);
    assert.throws(() => writeTable(dir, "users", [{ user_id: null, joined_at: 1 }]), /user_id/);
    // @ts-expect-error unknown table
    assert.throws(() => writeTable(dir, "likes", []), /unknown table/);
    assert.throws(
      () => writeTable(dir, "interactions", [{ event_id: 1, user_id: 1, post_id: 1, type: "dislike", created_at: 1 }]),
      /type/,
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("readTable reads back the same rows (sorted)", () => {
  const dir = tmp();
  try {
    const rows = [
      { post_id: 2, author_id: 2, community_id: null, created_at: 20 },
      { post_id: 1, author_id: 2, community_id: 7, created_at: 10 },
    ];
    writeTable(dir, "posts", rows);
    assert.deepEqual(readTable(dir, "posts"), [rows[1], rows[0]]);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("writeManifest: sorted keys, two-space JSON, final LF, blueprint section 2.3 keys", () => {
  const dir = tmp();
  try {
    const entry = writeTable(dir, "users", [{ user_id: 1, joined_at: 0 }]);
    writeManifest(dir, {
      schemaVersion: 1,
      datasetId: "syn-W0-S",
      source: { kind: "synthetic", config: "eval/config/synthetic-v1.json", configSha256: "ab" },
      masterSeed: 20261014,
      epoch: { iso: "2026-01-01T00:00:00Z", seconds: 1767225600 },
      node: "v22.23.4",
      files: { "users.csv": entry },
    });
    const text = readFileSync(join(dir, "manifest.json"), "utf8");
    assert.ok(text.endsWith("}\n"));
    assert.ok(!text.includes("\r"));
    const m = JSON.parse(text) as Record<string, unknown>;
    assert.deepEqual(Object.keys(m), ["datasetId", "epoch", "files", "masterSeed", "node", "schemaVersion", "source"]);
    assert.deepEqual(Object.keys(m.source as object), ["config", "configSha256", "kind"]);
    assert.ok(text.includes('\n  "datasetId": "syn-W0-S",\n'));
    assert.deepEqual(readManifest(dir).files["users.csv"], entry);
    const onDisk = createHash("sha256").update(readFileSync(join(dir, "users.csv"))).digest("hex");
    assert.equal(readManifest(dir).files["users.csv"]!.sha256, onDisk);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("same input gives the same bytes", () => {
  const a = tmp();
  const b = tmp();
  try {
    for (const d of [a, b]) {
      const e = writeTable(d, "users", [{ user_id: 2, joined_at: 5 }, { user_id: 1, joined_at: 4 }]);
      writeManifest(d, {
        schemaVersion: 1, datasetId: "x", source: { kind: "synthetic" }, masterSeed: 1,
        epoch: { iso: "e", seconds: 0 }, node: "v", files: { "users.csv": e },
      });
    }
    assert.equal(readFileSync(join(a, "manifest.json"), "utf8"), readFileSync(join(b, "manifest.json"), "utf8"));
    assert.equal(readFileSync(join(a, "users.csv"), "utf8"), readFileSync(join(b, "users.csv"), "utf8"));
  } finally {
    rmSync(a, { recursive: true });
    rmSync(b, { recursive: true });
  }
});
