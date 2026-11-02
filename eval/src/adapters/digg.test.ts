import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadDiggConfig } from "./digg.ts";

// TC1: the config equals the zip table of .docs/datasets.md section 4. The doc is the source (design F10).
const datasets = readFileSync(new URL("../../../.docs/datasets.md", import.meta.url), "utf8");

function section4(): string {
  const start = datasets.indexOf("## 4. File evidence");
  assert.ok(start >= 0, "section 4 not found in datasets.md");
  const end = datasets.indexOf("\n## 5.", start);
  assert.ok(end > start, "section 5 not found in datasets.md");
  return datasets.slice(start, end);
}

// The two value cells (votes, friends) of one row of the zip table.
function zipRow(label: string): [string, string] {
  for (const line of section4().split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length >= 4 && cells[1] === label) return [cells[2] as string, cells[3] as string];
  }
  throw new Error(`row "${label}" not found in the zip table of datasets.md section 4`);
}

function code(cell: string): string {
  const m = /`([^`]+)`/.exec(cell);
  assert.ok(m, `no code span in "${cell}"`);
  return m[1] as string;
}

test("TC1: the config holds both zips, the password and the choices", () => {
  const c = loadDiggConfig();
  assert.equal(c.datasetId, "digg2009");
  assert.deepEqual(Object.keys(c.zips).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), ["friends", "votes"]);
  assert.equal(c.zips.votes.file, "digg_votes.zip");
  assert.equal(c.zips.friends.file, "digg_friends.zip");
  assert.deepEqual(c.choices, {
    dropZeroDateLinks: true,
    addMutualReverse: false,
    idSource: "digg",
    joinedAt: "firstAppearance",
  });
  assert.ok(c.page.url.startsWith("http"));
  assert.match(c.page.citation, /Hogg/);
});

test("TC1: capture URL, SHA-256, member name and member size equal datasets.md section 4", () => {
  const c = loadDiggConfig();
  const url = zipRow("Capture URL");
  const sha = zipRow("SHA-256");
  const member = zipRow("Member (only one)");
  const time = zipRow("Capture time");
  (["votes", "friends"] as const).forEach((k, i) => {
    const z = c.zips[k];
    assert.equal(z.url, code(url[i] as string), `${k} url`);
    assert.equal(z.sha256, code(sha[i] as string), `${k} sha256`);
    assert.match(z.sha256, /^[0-9a-f]{64}$/);
    const m = /`([^`]+)`,\s*([\d,]+) bytes/.exec(member[i] as string);
    assert.ok(m, `cannot read member from "${member[i] as string}"`);
    assert.equal(z.member, m[1], `${k} member`);
    assert.equal(z.memberBytes, Number((m[2] as string).replace(/,/g, "")), `${k} member size`);
    // "2013-08-26 05:35:17 UTC" is "2013-08-26T05:35:17Z"
    const t = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC$/.exec(time[i] as string);
    assert.ok(t, `cannot read capture time from "${time[i] as string}"`);
    assert.equal(z.capturedAt, `${t[1] as string}T${t[2] as string}Z`, `${k} capture time`);
  });
});

test("TC1: the password equals the one quoted in datasets.md section 4", () => {
  const m = /The password is ([A-Za-z0-9_]+)\./.exec(section4());
  assert.ok(m, "password sentence not found in datasets.md section 4");
  assert.equal(loadDiggConfig().password, m[1]);
});
