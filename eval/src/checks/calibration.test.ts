import { test } from "node:test";
import assert from "node:assert/strict";
import { calibrate, measure, withinTolerance } from "./calibration.ts";
import type { CalibrationTargets } from "./calibration.ts";
import { loadDataset } from "../canonical/dataset.ts";
import { writeFixture } from "./fixture.ts";
import type { Row } from "../canonical/csv.ts";

// Users 1..5 act 1, 2, 3, 4 and 10 times. Users 6 and 7 never act and are not counted.
function fixtureDataset() {
  const counts: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 10 };
  const interactions: Row[] = [];
  let id = 1;
  for (const [u, c] of Object.entries(counts)) {
    for (let i = 0; i < c; i++) {
      interactions.push({ event_id: id, user_id: Number(u), post_id: 100 + id, type: "like", created_at: 1000 + id });
      id++;
    }
  }
  const follows: Row[] = [
    { follower_id: 1, followee_id: 2, created_at: 1 },
    { follower_id: 1, followee_id: 3, created_at: 1 },
    { follower_id: 2, followee_id: 1, created_at: 1 },
    { follower_id: 2, followee_id: 3, created_at: 1 },
    { follower_id: 2, followee_id: 4, created_at: 1 },
    { follower_id: 2, followee_id: 5, created_at: 1 },
  ];
  const users: Row[] = [1, 2, 3, 4, 5, 6, 7].map((u) => ({ user_id: u, joined_at: 0 }));
  return loadDataset(writeFixture({ users, follows, interactions }));
}

test("measure: mean, median (nearest rank), top-20% share, followees of users with a list", () => {
  const m = measure(fixtureDataset());
  assert.equal(m.votesPerUserMean, 4);
  assert.equal(m.votesPerUserMedian, 3);
  assert.equal(m.activitySkewTop20, 0.5);
  assert.equal(m.followeesMean, 3);
  assert.equal(m.actors, 5);
});

test("calibrate passes when every value is at its target", () => {
  const targets: CalibrationTargets = { votesPerUserMean: 4, votesPerUserMedian: 3, activitySkewTop20: 0.5, followeesMean: 3 };
  const r = calibrate(fixtureDataset(), targets);
  assert.equal(r.pass, true);
  assert.equal(r.rows.length, 4);
  assert.ok(r.rows.every((x) => x.pass));
});

test("calibrate fails for a value outside the tolerance and names it", () => {
  const targets: CalibrationTargets = { votesPerUserMean: 4, votesPerUserMedian: 3, activitySkewTop20: 0.9, followeesMean: 3 };
  const r = calibrate(fixtureDataset(), targets);
  assert.equal(r.pass, false);
  assert.deepEqual(r.rows.filter((x) => !x.pass).map((x) => x.name), ["activitySkewTop20"]);
});

test("tolerance edges: 10% for means and medians, 5 points for the skew", () => {
  assert.equal(withinTolerance("relative", 11, 10), true);
  assert.equal(withinTolerance("relative", 9, 10), true);
  assert.equal(withinTolerance("relative", 11.0001, 10), false);
  assert.equal(withinTolerance("relative", 8.9999, 10), false);
  assert.equal(withinTolerance("points", 0.55, 0.5), true);
  assert.equal(withinTolerance("points", 0.45, 0.5), true);
  assert.equal(withinTolerance("points", 0.5501, 0.5), false);
  assert.equal(withinTolerance("points", 0.4499, 0.5), false);
});

test("a dataset with no follows has no followee mean and fails", () => {
  const ds = loadDataset(writeFixture({
    users: [{ user_id: 1, joined_at: 0 }],
    interactions: [{ event_id: 1, user_id: 1, post_id: 1, type: "like", created_at: 5 }],
  }));
  const m = measure(ds);
  assert.equal(m.followeesMean, null);
  const r = calibrate(ds, { votesPerUserMean: 1, votesPerUserMedian: 1, activitySkewTop20: 1, followeesMean: 3 });
  assert.equal(r.pass, false);
});
