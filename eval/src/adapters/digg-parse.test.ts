// TC3: the strict parser for the two Digg files (no header row, every value in quotes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFriends, parseVotes } from "./digg-parse.ts";

const buf = (s: string): Buffer => Buffer.from(s, "latin1");

test("TC3: votes with CR, LF and CR LF line ends give the same rows", () => {
  const rows = ['"1246573330","318","1"', '"1246603391","399","1"', '"1246573479","1749","2"'];
  for (const eol of ["\r", "\n", "\r\n"]) {
    const v = parseVotes(buf(rows.join(eol) + eol));
    assert.equal(v.count, 3, JSON.stringify(eol));
    assert.deepEqual([...v.t], [1246573330, 1246603391, 1246573479]);
    assert.deepEqual([...v.voter], [318, 399, 1749]);
    assert.deepEqual([...v.story], [1, 1, 2]);
  }
});

test("TC3: one empty last line is allowed, and so is a last line with no line end", () => {
  assert.equal(parseVotes(buf('"1","2","3"\r')).count, 1);
  assert.equal(parseVotes(buf('"1","2","3"')).count, 1);
  assert.equal(parseVotes(buf('"1","2","3"\n"4","5","6"')).count, 2);
  assert.equal(parseVotes(buf("")).count, 0);
});

test("TC3: line ends may be mixed, and the line number counts CR LF once", () => {
  const v = parseVotes(buf('"1","2","3"\r\n"4","5","6"\r"7","8","9"\n'));
  assert.equal(v.count, 3);
  assert.throws(() => parseVotes(buf('"1","2","3"\r\n"4","5","6"\r"7","8"\n')), /line 3/);
});

test("TC3: friends give mutual, date, user and friend", () => {
  const f = parseFriends(buf('"1","1214799565","336224","266641"\r\n"0","1230047012","336224","215086"\r\n'));
  assert.equal(f.count, 2);
  assert.deepEqual([...f.mutual], [1, 0]);
  assert.deepEqual([...f.t], [1214799565, 1230047012]);
  assert.deepEqual([...f.user], [336224, 336224]);
  assert.deepEqual([...f.friend], [266641, 215086]);
});

test("TC3: the member name and the line number are in the message", () => {
  assert.throws(() => parseVotes(buf('"1","2","3"\n"4","5"\n'), "digg_votes1.csv"), /digg_votes1\.csv: line 2/);
});

// Each bad case stops with the line number. The bad line is line 3 in every case.
const GOOD = '"1","2","3"\n"4","5","6"\n';
const VOTE_BAD: Array<[string, string, RegExp]> = [
  ["a missing opening quote", '"7",8,"9"', /quote/],
  ["a missing closing quote", '"7","8,"9"', /quote|digit/],
  ["an unquoted line", "7,8,9", /quote/],
  ["an extra field", '"7","8","9","10"', /extra field/],
  ["a missing field", '"7","8"', /missing field/],
  ["a non-digit", '"7","x8","9"', /digit/],
  ["a negative sign", '"7","-8","9"', /negative/],
  ["an empty field", '"7","","9"', /empty field/],
  ["a decimal point", '"7","8.5","9"', /digit/],
  ["a space", '"7", "8","9"', /quote/],
  ["an empty line in the middle", "", /empty line/],
  ["a value too large for an id", '"7","99999999999","9"', /too large/],
];
for (const [name, line, re] of VOTE_BAD) {
  test(`TC3: votes stop on ${name}`, () => {
    const text = GOOD + line + "\n" + '"10","11","12"\n';
    assert.throws(
      () => parseVotes(buf(text)),
      (e: Error) => /line 3/.test(e.message) && re.test(e.message),
    );
  });
}

test("TC3: two line ends at the end of the file are an empty line, not an empty last line", () => {
  assert.throws(() => parseVotes(buf('"1","2","3"\r\n\r\n')), /line 2: empty line/);
});

const FRIEND_GOOD = '"1","100","5","6"\r\n"0","101","5","7"\r\n';
const FRIEND_BAD: Array<[string, string, RegExp]> = [
  ["a missing quote", '"1","102",5,"8"', /quote/],
  ["an extra field", '"1","102","5","8","9"', /extra field/],
  ["a missing field", '"1","102","5"', /missing field/],
  ["a non-digit", '"1","102","a5","8"', /digit/],
  ["a negative sign", '"1","-102","5","8"', /negative/],
  ["an empty field", '"1","102","5",""', /empty field/],
  ["a mutual flag that is not 0 or 1", '"2","102","5","8"', /mutual/],
];
for (const [name, line, re] of FRIEND_BAD) {
  test(`TC3: friends stop on ${name}`, () => {
    const text = FRIEND_GOOD + line + "\r\n" + '"1","103","5","9"\r\n';
    assert.throws(
      () => parseFriends(buf(text), "digg_friends.csv"),
      (e: Error) => /digg_friends\.csv: line 3/.test(e.message) && re.test(e.message),
    );
  });
}
