import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Blueprint section 1: eval may import @prisma/client only in src/loader/, and the design keeps it to src/loader/db.ts
// so that the mapping, ids and time code stay pure (DW1).
const SPEC = String.raw`["']@prisma\/client(?:\/[^"']*)?["']`;
const PATTERNS = [new RegExp(String.raw`\bfrom\s+${SPEC}`), new RegExp(String.raw`\bimport\s*\(\s*${SPEC}`), new RegExp(String.raw`\brequire\s*\(\s*${SPEC}`), new RegExp(String.raw`^\s*import\s+${SPEC}`)];

/** True when the text imports @prisma/client. A comment that only names it does not count. */
export function importsPrisma(text: string): boolean {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "");
  return code.split("\n").some((line) => {
    const noComment = line.replace(/\/\/.*$/, "");
    return PATTERNS.some((re) => re.test(noComment));
  });
}

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...tsFiles(path));
    else if (name.endsWith(".ts")) out.push(path);
  }
  return out;
}

test("the detector finds each form of import and ignores comments", () => {
  assert.equal(importsPrisma(`import { PrismaClient } from "@prisma/client";`), true);
  assert.equal(importsPrisma(`import { PrismaClient } from '@prisma/client';`), true);
  assert.equal(importsPrisma(`import type { Prisma } from "@prisma/client";`), true);
  assert.equal(importsPrisma(`import {\n  PrismaClient,\n} from "@prisma/client";`), true);
  assert.equal(importsPrisma(`const { PrismaClient } = require("@prisma/client");`), true);
  assert.equal(importsPrisma(`const m = await import('@prisma/client');`), true);
  assert.equal(importsPrisma(`import "@prisma/client";`), true);
  assert.equal(importsPrisma(`import { Decimal } from "@prisma/client/runtime/library";`), true);
  assert.equal(importsPrisma(`// import { PrismaClient } from "@prisma/client";`), false);
  assert.equal(importsPrisma(`const x = 1; // from "@prisma/client"`), false);
  assert.equal(importsPrisma(`/* from "@prisma/client" */\nconst x = 1;`), false);
  assert.equal(importsPrisma(`/**\n * Only db.ts imports from "@prisma/client".\n */\nconst x = 1;`), false);
  assert.equal(importsPrisma(`import { x } from "./client.ts";`), false);
  assert.equal(importsPrisma(`import { x } from "@prisma/other";`), false);
});

test("no file outside src/loader/ imports @prisma/client (DW1)", () => {
  const root = new URL(".", import.meta.url).pathname;
  const self = new URL(import.meta.url).pathname;
  const loader = join(root, "loader") + "/";
  const files = tsFiles(root).filter((f) => f !== self && !f.startsWith(loader));
  assert.ok(files.length > 10);
  const found = files.filter((f) => importsPrisma(readFileSync(f, "utf8"))).map((f) => relative(root, f));
  assert.deepEqual(found, []);
});

test("inside src/loader/, only db.ts imports @prisma/client", () => {
  const root = new URL(".", import.meta.url).pathname;
  const files = tsFiles(join(root, "loader"));
  assert.ok(files.length > 5);
  const found = files.filter((f) => importsPrisma(readFileSync(f, "utf8"))).map((f) => relative(join(root, "loader"), f));
  assert.deepEqual(found, ["db.ts"]);
});
