import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { INTERACTION_TYPES, SCHEMAS, isTableName } from "./schema.ts";
import type { TableName, TableSchema } from "./schema.ts";

export type Row = Record<string, number | string | null>;
export interface FileEntry {
  rows: number;
  sha256: string;
}

const INT = /^(0|[1-9][0-9]*)$/;

function schemaOf(table: string): TableSchema {
  if (!isTableName(table)) throw new Error(`unknown table "${table}"`);
  return SCHEMAS[table];
}

function checkRow(table: string, schema: TableSchema, row: Row, index: number): void {
  for (const key of Object.keys(row)) {
    if (!schema.columns.includes(key)) throw new Error(`${table} row ${index}: unknown column "${key}"`);
  }
  for (const col of schema.columns) {
    const v = row[col];
    if (v === undefined) throw new Error(`${table} row ${index}: missing column "${col}"`);
    if (v === null) {
      if (!schema.nullable.includes(col)) throw new Error(`${table} row ${index}: column "${col}" cannot be empty`);
    } else if (schema.text.includes(col)) {
      if (typeof v !== "string" || !(INTERACTION_TYPES as readonly string[]).includes(v)) {
        throw new Error(`${table} row ${index}: column "${col}" must be one of ${INTERACTION_TYPES.join(", ")}, got ${String(v)}`);
      }
    } else if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) {
      throw new Error(`${table} row ${index}: column "${col}" must be a non-negative integer, got ${String(v)}`);
    }
  }
}

function cell(v: number | string | null): string {
  return v === null ? "" : String(v);
}

export function sha256Hex(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

// Sorts by the keys of blueprint section 2.2 and writes <dir>/<table>.csv (UTF-8, LF, header row).
export function writeTable(dir: string, table: TableName, rows: readonly Row[]): FileEntry {
  const schema = schemaOf(table);
  rows.forEach((r, i) => checkRow(table, schema, r, i));
  const sorted = [...rows].sort((a, b) => {
    for (const k of schema.sortKeys) {
      const d = (a[k] as number) - (b[k] as number);
      if (d !== 0) return d;
    }
    return 0;
  });
  const lines = [schema.columns.join(",")];
  for (const r of sorted) lines.push(schema.columns.map((c) => cell(r[c] as number | string | null)).join(","));
  const text = lines.join("\n") + "\n";
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, schema.file), text, "utf8");
  return { rows: sorted.length, sha256: sha256Hex(text) };
}

// Strict reader: throws on CR, a wrong header, a wrong column count or a bad cell.
export function readTable(dir: string, table: TableName): Row[] {
  const schema = schemaOf(table);
  const text = readFileSync(join(dir, schema.file), "utf8");
  if (text.includes("\r")) throw new Error(`${schema.file}: contains CR`);
  if (!text.endsWith("\n")) throw new Error(`${schema.file}: no final LF`);
  const lines = text.slice(0, -1).split("\n");
  if (lines[0] !== schema.columns.join(",")) throw new Error(`${schema.file}: header is not "${schema.columns.join(",")}"`);
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = (lines[i] as string).split(",");
    if (parts.length !== schema.columns.length) throw new Error(`${schema.file} line ${i + 1}: wrong column count`);
    const row: Row = {};
    schema.columns.forEach((c, j) => {
      const p = parts[j] as string;
      if (p === "" && schema.nullable.includes(c)) row[c] = null;
      else if (schema.text.includes(c)) row[c] = p;
      else if (INT.test(p)) row[c] = Number(p);
      else throw new Error(`${schema.file} line ${i + 1}: "${p}" is not an integer`);
    });
    rows.push(row);
  }
  return rows;
}
