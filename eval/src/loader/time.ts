import type { DatasetTables } from "../harness/random-data.ts";

// Times of the loader (design: Time). A canonical time is integer seconds after the manifest epoch.
// The app time is that plus an optional constant shift (--rebase-to, demo only). No clock is read.

const REBASE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})Z$/;

/** The latest canonical time over all six tables (0 for an empty dataset). */
export function lastEventTime(d: DatasetTables): number {
  let max = 0;
  const see = (t: number): void => {
    if (t > max) max = t;
  };
  for (const r of d.users) see(r.joinedAt);
  for (const r of d.follows) see(r.createdAt);
  for (const r of d.communities) see(r.createdAt);
  for (const r of d.memberships) see(r.joinedAt);
  for (const r of d.posts) see(r.createdAt);
  for (const r of d.interactions) see(r.createdAt);
  return max;
}

const REBASE_FORMAT = "YYYY-MM-DDTHH:MM:SSZ";

/** Unix seconds of a `--rebase-to` value. Only `YYYY-MM-DDTHH:MM:SSZ` is accepted. */
export function parseRebase(iso: string): number {
  const m = REBASE.exec(iso);
  if (m === null) throw new Error(`--rebase-to "${iso}" is not valid: use ${REBASE_FORMAT} (UTC, whole seconds)`);
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number) as [number, number, number, number, number, number];
  const ms = Date.UTC(y, mo - 1, d, h, mi, s);
  // Date.UTC rolls over a day like 2026-02-30, so the round trip must give the same text.
  if (new Date(ms).toISOString() !== `${iso.slice(0, 19)}.000Z`) throw new Error(`--rebase-to "${iso}" is not a real date: use ${REBASE_FORMAT} (UTC, whole seconds)`);
  return ms / 1000;
}

/** The shift (seconds) that puts the dataset's latest event exactly on `iso`. */
export function rebaseShift(d: DatasetTables, epochSec: number, iso: string): number {
  return parseRebase(iso) - (epochSec + lastEventTime(d));
}

/** The app time of canonical time `t`. */
export function toDate(epochSec: number, t: number, shift: number): Date {
  return new Date((epochSec + t + shift) * 1000);
}

/** The canonical time of an app time, with the same shift removed. A time that is not a whole second is an error. */
export function fromDate(x: Date, epochSec: number, shift: number): number {
  const ms = x.getTime();
  if (!Number.isSafeInteger(ms) || ms % 1000 !== 0) throw new Error(`time ${String(ms)} ms is not a whole second`);
  const t = ms / 1000 - epochSec - shift;
  if (t < 0) throw new Error(`time ${x.toISOString()} is before the dataset epoch plus the shift (canonical time ${t} is negative)`);
  return t;
}
