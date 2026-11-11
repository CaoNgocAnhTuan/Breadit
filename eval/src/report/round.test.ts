import { test } from "node:test";
import assert from "node:assert/strict";
import { formatP, roundDecimal } from "./round.ts";

// TC9 (design DW10, F12): rounding on the decimal string, half away from zero, so a table and a macro never disagree.
test("roundDecimal to 3 places: half away from zero, and a negative zero has no sign", () => {
  assert.equal(roundDecimal("0.012500", 3), "0.013");
  assert.equal(roundDecimal("-0.012500", 3), "-0.013");
  assert.equal(roundDecimal("0.999500", 3), "1.000");
  assert.equal(roundDecimal("-0.000400", 3), "0.000");
  assert.equal(roundDecimal("12.000000", 3), "12.000");
});

test("roundDecimal: carries, other places, and strings a float would round the wrong way", () => {
  assert.equal(roundDecimal("0.012499", 3), "0.012");
  assert.equal(roundDecimal("0.099999", 3), "0.100");
  assert.equal(roundDecimal("9.999500", 3), "10.000");
  assert.equal(roundDecimal("-9.999500", 3), "-10.000");
  assert.equal(roundDecimal("0.000500", 3), "0.001");
  assert.equal(roundDecimal("-0.000500", 3), "-0.001");
  assert.equal(roundDecimal("0.000499", 3), "0.000");
  // 1.0005 is stored as 1.000499999... by a float, so toFixed(3) gives 1.000; on the string it is half, and goes away from zero
  assert.equal(roundDecimal("1.000500", 3), "1.001");
  assert.equal(roundDecimal("2.675000", 2), "2.68");
  assert.equal(roundDecimal("0.5", 0), "1");
  assert.equal(roundDecimal("0.4999", 0), "0");
  assert.equal(roundDecimal("7", 3), "7.000");
  assert.equal(roundDecimal("0.25", 3), "0.250");
  assert.equal(roundDecimal("0.000000", 3), "0.000");
  assert.equal(roundDecimal("-0.000000", 3), "0.000");
  assert.equal(roundDecimal("0.123456", 6), "0.123456");
  assert.equal(roundDecimal("100.000000", 1), "100.0");
});

test("roundDecimal refuses what is not a decimal number", () => {
  for (const bad of ["", "abc", "1e-3", "0,5", "--1", "1.", ".5", "NaN", " 1"]) assert.throws(() => roundDecimal(bad, 3), /decimal/, bad);
  assert.throws(() => roundDecimal("1", -1), /places/);
  assert.throws(() => roundDecimal("1", 1.5), /places/);
});

test("formatP: three places, and <0.001 under 0.001", () => {
  assert.equal(formatP("0.000999"), "<0.001");
  assert.equal(formatP("0.001000"), "0.001");
  assert.equal(formatP("1.000000"), "1.000");
  assert.equal(formatP("0.000000"), "<0.001");
  assert.equal(formatP("0.0005"), "<0.001");
  assert.equal(formatP("0.049500"), "0.050");
  assert.equal(formatP("0.0495"), "0.050");
  assert.equal(formatP("0.012500"), "0.013");
  assert.throws(() => formatP("-0.1"), /p-value/);
  assert.throws(() => formatP("2"), /p-value/);
  assert.throws(() => formatP(""), /decimal|p-value/);
});
