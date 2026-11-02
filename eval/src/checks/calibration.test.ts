import { test } from "node:test";
import assert from "node:assert/strict";
import { calibrate, measure, withinTolerance } from "./calibration.ts";
import type { CalibrationTargets } from "./calibration.ts";
import { loadDataset } from "../canonical/dataset.ts";
import { writeFixture } from "./fixture.ts";
import type { Row } from "../canonical/csv.ts";

// Users 1..5 act 1, 2, 3, 4 and 10 times. Users 6 and 7 never act and are not counted as actors.
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

const exact: CalibrationTargets = {
  votesPerUserMean: 4,
  votesPerUserMedian: 3,
  votesPerUserP90: 10,
  votesPerUserP99: 10,
  shareUsers1: 0.2,
  shareUsers2to4: 0.6,
  shareUsers5to19: 0.2,
  shareUsers20plus: 0,
  activitySkewTop20: 0.5,
  followeesMean: 3,
  followListShare: 2 / 7,
};

test("measure: mean, median, percentiles (nearest rank), bin shares, skew, followees, list share", () => {
  const m = measure(fixtureDataset());
  assert.equal(m.actors, 5);
  assert.equal(m.votesPerUserMean, 4);
  assert.equal(m.votesPerUserMedian, 3);
  assert.equal(m.votesPerUserP90, 10);
  assert.equal(m.votesPerUserP99, 10);
  assert.equal(m.shareUsers1, 0.2);
  assert.equal(m.shareUsers2to4, 0.6);
  assert.equal(m.shareUsers5to19, 0.2);
  assert.equal(m.shareUsers20plus, 0);
  assert.equal(m.activitySkewTop20, 0.5);
  assert.equal(m.followeesMean, 3);
  assert.equal(m.followListShare, 2 / 7);
  assert.equal(m.topUserActions, 10);
  assert.equal(m.topUserShare, 0.5);
});

test("percentiles use the nearest rank on 100 users", () => {
  const interactions: Row[] = [];
  let id = 1;
  for (let u = 1; u <= 100; u++) {
    for (let i = 0; i < u; i++) interactions.push({ event_id: id++, user_id: u, post_id: id, type: "like", created_at: 5 });
  }
  const m = measure(loadDataset(writeFixture({ users: [{ user_id: 1, joined_at: 0 }], interactions })));
  assert.equal(m.votesPerUserMedian, 50);
  assert.equal(m.votesPerUserP90, 90);
  assert.equal(m.votesPerUserP99, 99);
});

test("calibrate passes when every value is at its target and the top user is under the limit", () => {
  const r = calibrate(fixtureDataset(), exact, { maxUserActionShare: 0.5 });
  assert.equal(r.pass, true);
  assert.equal(r.rows.length, Object.keys(exact).length + 1);
  assert.ok(r.rows.every((x) => x.pass));
});

test("calibrate fails for a value outside the tolerance and names it", () => {
  const r = calibrate(fixtureDataset(), { ...exact, activitySkewTop20: 0.9 }, { maxUserActionShare: 0.5 });
  assert.equal(r.pass, false);
  assert.deepEqual(r.rows.filter((x) => !x.pass).map((x) => x.name), ["activitySkewTop20"]);
});

test("the share limit fails when one user is above maxUserActionShare", () => {
  const r = calibrate(fixtureDataset(), exact, { maxUserActionShare: 0.4 });
  assert.equal(r.pass, false);
  assert.deepEqual(r.rows.filter((x) => !x.pass).map((x) => x.name), ["maxUserActionShare"]);
  assert.equal(r.topUserShare, 0.5);
});

test("users at the cap are counted when a cap is given", () => {
  const r = calibrate(fixtureDataset(), exact, { maxUserActionShare: 0.5, cap: 10 });
  assert.equal(r.usersAtCap, 1);
  assert.equal(calibrate(fixtureDataset(), exact, { maxUserActionShare: 0.5, cap: 11 }).usersAtCap, 0);
});

test("tolerance edges: 10% for means and medians, 25% for tail percentiles, 5 points for shares", () => {
  assert.equal(withinTolerance("relative", 11, 10), true);
  assert.equal(withinTolerance("relative", 9, 10), true);
  assert.equal(withinTolerance("relative", 11.0001, 10), false);
  assert.equal(withinTolerance("relative", 8.9999, 10), false);
  assert.equal(withinTolerance("tail", 125, 100), true);
  assert.equal(withinTolerance("tail", 75, 100), true);
  assert.equal(withinTolerance("tail", 125.01, 100), false);
  assert.equal(withinTolerance("tail", 74.99, 100), false);
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
  assert.equal(m.followListShare, 0);
  const r = calibrate(ds, { votesPerUserMean: 1, followeesMean: 3 });
  assert.equal(r.pass, false);
  assert.deepEqual(r.rows.filter((x) => !x.pass).map((x) => x.name), ["followeesMean"]);
});

test("only targets that exist are checked", () => {
  const r = calibrate(fixtureDataset(), { votesPerUserMean: 4 });
  assert.equal(r.rows.length, 1);
  assert.equal(r.pass, true);
});
