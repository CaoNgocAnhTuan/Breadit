import { test } from "node:test";
import assert from "node:assert/strict";
import { PASSWORD_HASH, appUserId, canonicalUserId, repostOffset } from "./ids.ts";

test("appUserId is u plus the integer padded to 10 digits", () => {
  assert.equal(appUserId(42), "u0000000042");
  assert.equal(appUserId(1), "u0000000001");
  assert.equal(appUserId(1000), "u0000001000");
  assert.equal(appUserId(9999999999), "u9999999999");
});

test("appUserId refuses a number that is not a non-negative integer or has more than 10 digits", () => {
  for (const bad of [-1, 1.5, Number.NaN, 10000000000]) assert.throws(() => appUserId(bad), /user id/);
});

test("canonicalUserId reverses appUserId and refuses anything else", () => {
  assert.equal(canonicalUserId("u0000000042"), 42);
  assert.equal(canonicalUserId(appUserId(336047)), 336047);
  for (const bad of ["", "42", "u42", "u00000000420", "U0000000042", "u000000004x", "u-000000042", "u0000000042 ", "user1", "admin"]) {
    assert.throws(() => canonicalUserId(bad), /user id/, `should refuse "${bad}"`);
  }
});

test("repostOffset is the largest postId, and 0 for no posts", () => {
  assert.equal(repostOffset([]), 0);
  assert.equal(repostOffset([{ postId: 7 }]), 7);
  assert.equal(repostOffset([{ postId: 3 }, { postId: 20000 }, { postId: 12 }]), 20000);
});

test("PASSWORD_HASH looks like a bcrypt hash of cost 10", () => {
  assert.match(PASSWORD_HASH, /^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/);
});
