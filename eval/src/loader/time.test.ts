import { test } from "node:test";
import assert from "node:assert/strict";
import type { DatasetTables } from "../harness/random-data.ts";
import { fromDate, lastEventTime, parseRebase, rebaseShift, toDate } from "./time.ts";

const EPOCH = 1767225600; // 2026-01-01T00:00:00Z, as in a manifest

const tables: DatasetTables = {
  users: [{ userId: 1, joinedAt: 5 }],
  follows: [{ followerId: 1, followeeId: 2, createdAt: 40 }],
  communities: [{ communityId: 1, createdAt: 3 }],
  memberships: [{ userId: 1, communityId: 1, joinedAt: 12 }],
  posts: [{ postId: 1, authorId: 1, communityId: null, createdAt: 20 }],
  interactions: [{ eventId: 1, userId: 1, postId: 1, type: "like", createdAt: 30 }],
};

test("parseRebase takes only YYYY-MM-DDTHH:MM:SSZ and returns Unix seconds", () => {
  assert.equal(parseRebase("2026-01-01T00:00:00Z"), EPOCH);
  assert.equal(parseRebase("2026-11-18T12:00:00Z"), Date.UTC(2026, 10, 18, 12, 0, 0) / 1000);
});

test("parseRebase refuses no Z, milliseconds, an offset, a bad date and other text", () => {
  for (const bad of [
    "2026-11-18T12:00:00",
    "2026-11-18T12:00:00.000Z",
    "2026-11-18T12:00:00+00:00",
    "2026-11-18T12:00:00+02:00",
    "2026-11-18 12:00:00Z",
    "2026-11-18",
    "2026-13-18T12:00:00Z",
    "2026-02-30T12:00:00Z",
    "2026-11-18T25:00:00Z",
    "2026-11-18T12:60:00Z",
    "2026-11-18t12:00:00z",
    "",
    "now",
  ]) {
    assert.throws(() => parseRebase(bad), /rebase-to/, `should refuse "${bad}"`);
  }
});

test("lastEventTime is the largest time over all six tables", () => {
  assert.equal(lastEventTime(tables), 40);
  assert.equal(lastEventTime({ ...tables, follows: [] }), 30);
  assert.equal(lastEventTime({ ...tables, interactions: [], follows: [] }), 20);
  assert.equal(lastEventTime({ ...tables, interactions: [], follows: [], posts: [] }), 12);
  assert.equal(lastEventTime({ ...tables, memberships: [{ userId: 1, communityId: 1, joinedAt: 99 }] }), 99);
  assert.equal(lastEventTime({ ...tables, users: [{ userId: 1, joinedAt: 77 }] }), 77);
  assert.equal(lastEventTime({ ...tables, communities: [{ communityId: 1, createdAt: 88 }] }), 88);
});

test("lastEventTime of a dataset with no rows is 0", () => {
  assert.equal(lastEventTime({ users: [], follows: [], communities: [], memberships: [], posts: [], interactions: [] }), 0);
});

test("rebaseShift lands the latest event exactly on the given time", () => {
  const target = "2026-11-18T12:00:00Z";
  const shift = rebaseShift(tables, EPOCH, target);
  assert.equal(toDate(EPOCH, lastEventTime(tables), shift).toISOString(), "2026-11-18T12:00:00.000Z");
  assert.equal(shift, parseRebase(target) - (EPOCH + 40));
});

test("rebaseShift can be negative (a time before the dataset)", () => {
  assert.equal(rebaseShift(tables, EPOCH, "2025-12-31T00:00:00Z"), parseRebase("2025-12-31T00:00:00Z") - (EPOCH + 40));
  assert.ok(rebaseShift(tables, EPOCH, "2025-12-31T00:00:00Z") < 0);
});

test("toDate and fromDate are inverses for a shift of 0 and a nonzero shift", () => {
  for (const shift of [0, 86400, 123456789, -3600]) {
    for (const t of [0, 1, 59, 3600, 5184000]) {
      assert.equal(fromDate(toDate(EPOCH, t, shift), EPOCH, shift), t);
    }
  }
  assert.equal(toDate(EPOCH, 0, 0).toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(toDate(EPOCH, 90, 0).toISOString(), "2026-01-01T00:01:30.000Z");
});

test("fromDate refuses a Date that is not a whole second", () => {
  assert.throws(() => fromDate(new Date((EPOCH + 5) * 1000 + 1), EPOCH, 0), /whole second/);
  assert.throws(() => fromDate(new Date((EPOCH + 5) * 1000 + 500), EPOCH, 7), /whole second/);
  assert.doesNotThrow(() => fromDate(new Date((EPOCH + 5) * 1000), EPOCH, 0));
});

test("fromDate refuses a Date that gives a negative or non-integer canonical time", () => {
  assert.throws(() => fromDate(new Date((EPOCH - 5) * 1000), EPOCH, 0), /negative/);
  assert.throws(() => fromDate(new Date(Number.NaN), EPOCH, 0), /whole second/);
});
