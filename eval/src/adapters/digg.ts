import { readFileSync } from "node:fs";

// The Digg 2009 source: two zips, their SHA-256, the password from the Digg page, and the choices of the
// adapter (task p4-digg-adapter, Spec open questions 1, 2, 4 and 5). digg.test.ts keeps the zip table equal to
// .docs/datasets.md section 4, so the doc stays the source and the code cannot drift from it.

export interface DiggZip {
  /** File name in the raw folder. */
  file: string;
  /** Internet Archive capture URL. */
  url: string;
  /** Capture time, ISO string (a fact of the source, never a clock). */
  capturedAt: string;
  sha256: string;
  /** The one member inside the zip, and its size when unpacked. */
  member: string;
  memberBytes: number;
}

export interface DiggChoices {
  /** Open question 1: drop follow links with date 0 (unknown date). */
  dropZeroDateLinks: boolean;
  /** Open question 2: add the reverse link for a `mutual` = 1 row. */
  addMutualReverse: boolean;
  /** Open question 4: ids are Digg's own `voter_id`, `user_id` and `story_id`. */
  idSource: "digg";
  /** Open question 5: `joined_at` is the earliest time the id appears. */
  joinedAt: "firstAppearance";
}

export interface DiggConfig {
  version: number;
  datasetId: string;
  page: { url: string; citation: string };
  /** Published on the Digg page. */
  password: string;
  zips: { votes: DiggZip; friends: DiggZip };
  choices: DiggChoices;
}

export function diggConfigUrl(): URL {
  return new URL("../../config/digg2009.json", import.meta.url);
}

export function loadDiggConfig(): DiggConfig {
  return JSON.parse(readFileSync(diggConfigUrl(), "utf8")) as DiggConfig;
}
