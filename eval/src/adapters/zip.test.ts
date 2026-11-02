// TC2: the zip reader. The main fixture comes from the system zip tool (Info-ZIP 3.0), made once and committed:
//   cd eval/src/adapters/fixtures && zip -X -P tiny-test-password tiny.zip tiny.txt
// It has flag bits 0 and 3 (flag 9) and method 8. The test also builds zips in memory (zip-fixture.ts):
// one with bit 3 cleared, so the check byte is the high byte of the CRC-32, and the unsupported shapes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readEncryptedMember } from "./zip.ts";
import { buildZip } from "./zip-fixture.ts";

const PASSWORD = "tiny-test-password";
const tinyZip = readFileSync(new URL("./fixtures/tiny.zip", import.meta.url));
const tinyText = readFileSync(new URL("./fixtures/tiny.txt", import.meta.url));

/** Offset of the central directory entry of a zip with one member and no comment. */
function centralOffset(zip: Buffer): number {
  return zip.readUInt32LE(zip.length - 22 + 16);
}

function patched(zip: Buffer, change: (copy: Buffer) => void): Buffer {
  const copy = Buffer.from(zip);
  change(copy);
  return copy;
}

test("TC2: the fixture is from the system zip tool: flag 9, deflate, one member", () => {
  assert.equal(tinyZip.readUInt16LE(6), 9);
  assert.equal(tinyZip.readUInt16LE(8), 8);
  assert.equal(tinyZip.readUInt16LE(tinyZip.length - 22 + 10), 1);
});

test("TC2: the right password gives exactly tiny.txt (system zip, bit 3 set)", () => {
  const m = readEncryptedMember(tinyZip, PASSWORD);
  assert.equal(m.name, "tiny.txt");
  assert.ok(m.data.equals(tinyText));
});

test("TC2: bit 3 set and bit 3 cleared both work (time byte and CRC-32 byte as check byte)", () => {
  for (const bit3 of [true, false]) {
    const zip = buildZip([{ name: "tiny.txt", data: tinyText, password: PASSWORD, bit3 }]);
    assert.equal(zip.readUInt16LE(6), bit3 ? 9 : 1);
    const m = readEncryptedMember(zip, PASSWORD);
    assert.equal(m.name, "tiny.txt");
    assert.ok(m.data.equals(tinyText), `bit3 ${String(bit3)}`);
  }
});

test("TC2: a wrong password stops with 'wrong password'", () => {
  assert.throws(() => readEncryptedMember(tinyZip, "not-the-password"), /wrong password/);
  const clear = buildZip([{ name: "tiny.txt", data: tinyText, password: PASSWORD, bit3: false }]);
  assert.throws(() => readEncryptedMember(clear, "not-the-password"), /wrong password/);
});

test("TC2: one changed byte of the compressed data stops the reader", () => {
  const start = 30 + "tiny.txt".length + 12;
  for (const zip of [tinyZip, buildZip([{ name: "tiny.txt", data: tinyText, password: PASSWORD }])]) {
    const bad = patched(zip, (c) => {
      c[start + 20] = (c[start + 20] as number) ^ 0x01;
    });
    assert.throws(() => readEncryptedMember(bad, PASSWORD), /damaged data/);
  }
});

test("TC2: a wrong CRC-32 or size in the central entry stops the reader", () => {
  const cen = centralOffset(tinyZip);
  const badCrc = patched(tinyZip, (c) => c.writeUInt32LE((c.readUInt32LE(cen + 16) ^ 0x01) >>> 0, cen + 16));
  assert.throws(() => readEncryptedMember(badCrc, PASSWORD), /CRC-32/);
  const bigger = patched(tinyZip, (c) => c.writeUInt32LE(c.readUInt32LE(cen + 24) + 1, cen + 24));
  assert.throws(() => readEncryptedMember(bigger, PASSWORD), /size/);
  const smaller = patched(tinyZip, (c) => c.writeUInt32LE(c.readUInt32LE(cen + 24) - 1, cen + 24));
  assert.throws(() => readEncryptedMember(smaller, PASSWORD), /size/);
});

test("TC2: more than one member is unsupported", () => {
  const two = buildZip([
    { name: "a.txt", data: "a\n", password: PASSWORD },
    { name: "b.txt", data: "b\n", password: PASSWORD },
  ]);
  assert.throws(() => readEncryptedMember(two, PASSWORD), /unsupported.*2 members/);
  const none = buildZip([]);
  assert.throws(() => readEncryptedMember(none, PASSWORD), /unsupported.*0 members/);
});

test("TC2: a method other than deflate is unsupported", () => {
  const stored = buildZip([{ name: "a.txt", data: "abc\n", password: PASSWORD, method: 0 }]);
  assert.throws(() => readEncryptedMember(stored, PASSWORD), /unsupported.*method 0/);
});

test("TC2: zip64 sizes are unsupported", () => {
  const cen = centralOffset(tinyZip);
  const big = patched(tinyZip, (c) => c.writeUInt32LE(0xffffffff, cen + 20));
  assert.throws(() => readEncryptedMember(big, PASSWORD), /unsupported.*zip64/);
  const offset = patched(tinyZip, (c) => c.writeUInt32LE(0xffffffff, c.length - 22 + 16));
  assert.throws(() => readEncryptedMember(offset, PASSWORD), /unsupported.*zip64/);
});

test("TC2: a member that is not encrypted is unsupported", () => {
  const plain = buildZip([{ name: "a.txt", data: "abc\n" }]);
  assert.throws(() => readEncryptedMember(plain, PASSWORD), /unsupported.*not encrypted/);
});

test("TC2: bytes that are not a zip stop the reader", () => {
  assert.throws(() => readEncryptedMember(Buffer.from("not a zip file at all, just text\n"), PASSWORD), /not a zip/);
  assert.throws(() => readEncryptedMember(Buffer.alloc(0), PASSWORD), /not a zip/);
  const cut = tinyZip.subarray(0, tinyZip.length - 30);
  assert.throws(() => readEncryptedMember(cut, PASSWORD), /not a zip|damaged/);
});
