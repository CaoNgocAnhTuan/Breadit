import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "./canonical/csv.ts";
import type { FileEntry } from "./canonical/csv.ts";

// Results files (blueprint section 2.7): CSV, UTF-8, LF, header row, fixed column order. The caller sorts the rows.

export function csvText(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [header.join(",")];
  for (const r of rows) {
    if (r.length !== header.length) throw new Error(`row has ${r.length} cells, header has ${header.length}`);
    for (const c of r) if (/[,\r\n]/.test(c)) throw new Error(`cell "${c}" has a comma or a line break`);
    lines.push(r.join(","));
  }
  return lines.join("\n") + "\n";
}

/** Writes <dir>/<name> and returns its row count (without the header) and SHA-256. */
export function writeCsv(dir: string, name: string, header: readonly string[], rows: readonly (readonly string[])[]): FileEntry {
  const text = csvText(header, rows);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), text, "utf8");
  return { rows: rows.length, sha256: sha256Hex(text) };
}
