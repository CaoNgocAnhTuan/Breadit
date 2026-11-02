import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "../canonical/csv.ts";
import { readManifest } from "../canonical/manifest.ts";
import type { Manifest } from "../canonical/manifest.ts";
import { INTERACTION_TYPES, SCHEMAS, TABLES } from "../canonical/schema.ts";
import type { TableName } from "../canonical/schema.ts";

// Format check (DW4): the rules of blueprint section 2.2, the manifest, and the D1 rule.
// It reads only the files in the folder.

export interface Problem {
  rule: string;
  count: number;
  example: string;
}

export interface FormatResult {
  datasetId: string;
  pass: boolean;
  problems: Problem[];
}

type Cell = number | string | null;
type ParsedRow = Record<string, Cell>;

const INT = /^(0|[1-9][0-9]*)$/;

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

class Collector {
  readonly byRule = new Map<string, Problem>();
  add(rule: string, example: string): void {
    const p = this.byRule.get(rule);
    if (p) p.count++;
    else this.byRule.set(rule, { rule, count: 1, example });
  }
  list(): Problem[] {
    return [...this.byRule.values()];
  }
}

function parseTable(dir: string, table: TableName, manifest: Manifest, out: Collector): ParsedRow[] | null {
  const schema = SCHEMAS[table];
  const path = join(dir, schema.file);
  const entry = manifest.files[schema.file];
  if (!entry) {
    out.add("missing-from-manifest", schema.file);
  }
  if (!existsSync(path)) {
    out.add("missing-file", schema.file);
    return null;
  }
  const buf = readFileSync(path);
  if (entry && sha256Hex(buf) !== entry.sha256) out.add("sha256", schema.file);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    out.add("not-utf8", schema.file);
    return null;
  }
  if (text.includes("\r")) {
    out.add("crlf", schema.file);
    text = text.replace(/\r/g, "");
  }
  if (!text.endsWith("\n")) {
    out.add("no-final-lf", schema.file);
    text += "\n";
  }
  const lines = text.slice(0, -1).split("\n");
  if (lines[0] !== schema.columns.join(",")) {
    out.add("header", `${schema.file}: "${lines[0] ?? ""}"`);
    return null;
  }
  if (entry && entry.rows !== lines.length - 1) out.add("row-count", `${schema.file}: manifest ${entry.rows}, file ${lines.length - 1}`);
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = (lines[i] as string).split(",");
    if (parts.length !== schema.columns.length) {
      out.add("column-count", `${schema.file} line ${i + 1}`);
      continue;
    }
    const row: ParsedRow = {};
    let ok = true;
    schema.columns.forEach((c, j) => {
      const p = parts[j] as string;
      if (p === "" && schema.nullable.includes(c)) row[c] = null;
      else if (schema.text.includes(c)) {
        if ((INTERACTION_TYPES as readonly string[]).includes(p)) row[c] = p;
        else {
          out.add("bad-type", `${schema.file} line ${i + 1}: "${p}"`);
          ok = false;
        }
      } else if (INT.test(p) && Number.isSafeInteger(Number(p))) row[c] = Number(p);
      else {
        out.add("not-integer", `${schema.file} line ${i + 1}: "${p}" in ${c}`);
        ok = false;
      }
    });
    if (ok) rows.push(row);
  }
  return rows;
}

function checkOrder(table: TableName, rows: ParsedRow[], out: Collector): void {
  const schema = SCHEMAS[table];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1] as ParsedRow;
    const b = rows[i] as ParsedRow;
    let cmp = 0;
    for (const k of schema.sortKeys) {
      cmp = (a[k] as number) - (b[k] as number);
      if (cmp !== 0) break;
    }
    const where = `${schema.file} row ${i + 1}`;
    if (cmp > 0) out.add("unsorted", where);
    else if (cmp === 0) out.add(table === "follows" ? "repeated-follow" : "duplicate-key", where);
  }
  if (table === "interactions") {
    const seen = new Set<number>();
    for (const r of rows) {
      const id = r.event_id as number;
      if (seen.has(id)) out.add("duplicate-key", `interactions.csv event_id ${id}`);
      seen.add(id);
    }
  }
}

export function checkFormat(dir: string): FormatResult {
  const out = new Collector();
  let manifest: Manifest;
  try {
    manifest = readManifest(dir);
  } catch (e) {
    out.add("manifest-missing", String((e as Error).message));
    return { datasetId: "?", pass: false, problems: out.list() };
  }

  const known = new Set<string>(TABLES.map((t) => SCHEMAS[t].file));
  const names = readdirSync(dir).sort(compare);
  for (const name of names) {
    if (name === "manifest.json") continue;
    if (!(name in manifest.files)) out.add("file-not-in-manifest", name);
  }
  for (const name of Object.keys(manifest.files).sort(compare)) {
    if (!known.has(name)) out.add("manifest-unknown-file", name);
  }

  const t: Partial<Record<TableName, ParsedRow[]>> = {};
  for (const table of TABLES) {
    const rows = parseTable(dir, table, manifest, out);
    if (rows) {
      t[table] = rows;
      checkOrder(table, rows, out);
    }
  }

  for (const f of t.follows ?? []) {
    if (f.follower_id === f.followee_id) out.add("self-follow", `user ${String(f.follower_id)}`);
  }

  const communities = new Set<number>((t.communities ?? []).map((c) => c.community_id as number));
  // joined_at of each (user, community) pair
  const joined = new Map<string, number>();
  for (const m of t.memberships ?? []) joined.set(`${String(m.user_id)}:${String(m.community_id)}`, m.joined_at as number);

  const postById = new Map<number, ParsedRow>();
  for (const p of t.posts ?? []) {
    postById.set(p.post_id as number, p);
    if (p.community_id === null) continue;
    const cid = p.community_id as number;
    if (!communities.has(cid)) {
      out.add("unknown-community", `post ${String(p.post_id)} in community ${cid}`);
      continue;
    }
    const since = joined.get(`${String(p.author_id)}:${cid}`);
    if (since === undefined || since > (p.created_at as number)) {
      out.add("community-non-member", `post ${String(p.post_id)}: author ${String(p.author_id)} in community ${cid}`);
    }
  }

  for (const e of t.interactions ?? []) {
    const post = postById.get(e.post_id as number);
    if (!post) {
      out.add("unknown-post", `event ${String(e.event_id)}: post ${String(e.post_id)}`);
      continue;
    }
    if ((e.created_at as number) <= (post.created_at as number)) {
      out.add("interaction-not-after-post", `event ${String(e.event_id)}`);
    }
    if (e.user_id === post.author_id) out.add("own-post", `event ${String(e.event_id)}`);
  }

  return { datasetId: manifest.datasetId, pass: out.byRule.size === 0, problems: out.list() };
}
