import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BASE_URL, DEFAULT_SCHEMA, schemaOf, targetUrl } from "./target.ts";

const BASE = "postgresql://breadit:breaditpassword@localhost:5433/breadit";

test("the default target is the eval_load schema on the Docker database", () => {
  assert.equal(DEFAULT_SCHEMA, "eval_load");
  assert.equal(DEFAULT_BASE_URL, BASE);
});

test("targetUrl sets ?schema= on a URL with no schema and keeps the rest unchanged", () => {
  assert.equal(targetUrl(BASE, "eval_load"), `${BASE}?schema=eval_load`);
});

test("targetUrl overwrites an existing schema, so public and it_test cannot leak in from DATABASE_URL", () => {
  assert.equal(targetUrl(`${BASE}?schema=public`, "eval_load"), `${BASE}?schema=eval_load`);
  assert.equal(targetUrl(`${BASE}?schema=it_test`, "eval_x"), `${BASE}?schema=eval_x`);
});

test("targetUrl keeps the other query parameters", () => {
  const url = targetUrl(`${BASE}?connection_limit=5&schema=public`, "eval_load");
  assert.equal(new URL(url).searchParams.get("schema"), "eval_load");
  assert.equal(new URL(url).searchParams.get("connection_limit"), "5");
});

test("targetUrl refuses public, it_test, an empty name, upper case and odd characters", () => {
  for (const bad of ["public", "it_test", "", "eval_", "Eval_load", "eval_LOAD", "eval-load", "eval_x;drop", 'eval_"x', "eval_x y", "eval_é", "xeval_x", "eval"]) {
    assert.throws(() => targetUrl(BASE, bad), /schema/, `should refuse "${bad}"`);
  }
});

test("targetUrl accepts eval_ names of lower case letters, digits and underscores", () => {
  for (const ok of ["eval_load", "eval_demo_2", "eval_0"]) assert.doesNotThrow(() => targetUrl(BASE, ok));
});

test("schemaOf reads the schema back from a target URL and refuses any URL that is not a target", () => {
  assert.equal(schemaOf(targetUrl(BASE, "eval_demo")), "eval_demo");
  assert.throws(() => schemaOf(BASE), /schema/);
  assert.throws(() => schemaOf(`${BASE}?schema=public`), /schema/);
  assert.throws(() => schemaOf(`${BASE}?schema=it_test`), /schema/);
});
