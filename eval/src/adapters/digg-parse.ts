// Strict parser for the two Digg 2009 files (task p4-digg-adapter, design "Parse strictly", F4).
// No header row, every value a double-quoted non-negative integer, a line ends with CR, LF or CR LF.
// The last line may have no line end. Anything else stops with the member name and the line number.
// Rows go into typed arrays, not one object per row, to keep memory low (3 million vote rows).

const QUOTE = 0x22;
const COMMA = 0x2c;
const CR = 0x0d;
const LF = 0x0a;
const MINUS = 0x2d;
const ZERO = 0x30;
const NINE = 0x39;
const MAX_DIGITS = 15;
const MAX_ID = 2147483647;

export interface VoteRows {
  count: number;
  /** vote_date: Unix seconds. */
  t: Float64Array;
  voter: Int32Array;
  story: Int32Array;
}

export interface LinkRows {
  count: number;
  /** 1 when the file says the link is two-way. */
  mutual: Uint8Array;
  /** friend_date: Unix seconds, 0 when unknown. */
  t: Float64Array;
  /** The fan: user_id follows friend_id. */
  user: Int32Array;
  friend: Int32Array;
}

interface Field {
  name: string;
  max: number;
}

class ParseError extends Error {
  constructor(member: string, line: number, why: string) {
    super(`${member}: line ${line}: ${why}`);
  }
}

function describe(b: number): string {
  if (b === CR || b === LF) return "end of line";
  if (b >= 0x20 && b < 0x7f) return `"${String.fromCharCode(b)}"`;
  return `byte 0x${b.toString(16).padStart(2, "0")}`;
}

/** An upper bound for the number of rows: line-end bytes plus one. */
function rowBound(buf: Uint8Array): number {
  let n = 1;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i] as number;
    if (b === CR || b === LF) n++;
  }
  return n;
}

/** Calls `row` with the field values of every line. `vals` is reused: copy from it, do not keep it. */
function scan(buf: Uint8Array, fields: readonly Field[], member: string, row: (vals: Float64Array) => void): void {
  const len = buf.length;
  const nf = fields.length;
  const vals = new Float64Array(nf);
  let pos = 0;
  let line = 1;
  while (pos < len) {
    if (buf[pos] === CR || buf[pos] === LF) throw new ParseError(member, line, "empty line");
    for (let f = 0; f < nf; f++) {
      const field = fields[f] as Field;
      if (f > 0) {
        const b = buf[pos];
        if (b === COMMA) pos++;
        else if (b === undefined || b === CR || b === LF) throw new ParseError(member, line, `missing field (expected ${nf} fields, got ${f})`);
        else throw new ParseError(member, line, `expected "," after field ${f}, got ${describe(b)}`);
      }
      const open = buf[pos];
      if (open !== QUOTE) {
        throw new ParseError(member, line, `field ${f + 1} (${field.name}): expected an opening quote, got ${open === undefined ? "end of file" : describe(open)}`);
      }
      pos++;
      let value = 0;
      let digits = 0;
      for (;;) {
        const b = buf[pos];
        if (b !== undefined && b >= ZERO && b <= NINE) {
          if (++digits > MAX_DIGITS) throw new ParseError(member, line, `field ${f + 1} (${field.name}) has more than ${MAX_DIGITS} digits`);
          value = value * 10 + (b - ZERO);
          pos++;
        } else if (b === QUOTE) {
          if (digits === 0) throw new ParseError(member, line, `empty field ${f + 1} (${field.name})`);
          pos++;
          break;
        } else if (b === MINUS) {
          throw new ParseError(member, line, `field ${f + 1} (${field.name}) has a negative sign`);
        } else {
          throw new ParseError(member, line, `field ${f + 1} (${field.name}): expected a digit or a closing quote, got ${b === undefined ? "end of file" : describe(b)}`);
        }
      }
      if (value > field.max) throw new ParseError(member, line, `${field.name} ${value} is too large (limit ${field.max})`);
      vals[f] = value;
    }
    // After the last field: a line end (CR, LF or CR LF), or the end of the file.
    const b = buf[pos];
    if (b === CR) {
      pos++;
      if (buf[pos] === LF) pos++;
    } else if (b === LF) {
      pos++;
    } else if (b !== undefined) {
      throw new ParseError(member, line, b === COMMA ? `extra field (expected ${nf} fields)` : `expected end of line after field ${nf}, got ${describe(b)}`);
    }
    row(vals);
    line++;
  }
}

const VOTE_FIELDS: readonly Field[] = [
  { name: "vote_date", max: Number.MAX_SAFE_INTEGER },
  { name: "voter_id", max: MAX_ID },
  { name: "story_id", max: MAX_ID },
];

const FRIEND_FIELDS: readonly Field[] = [
  { name: "mutual", max: 1 },
  { name: "friend_date", max: Number.MAX_SAFE_INTEGER },
  { name: "user_id", max: MAX_ID },
  { name: "friend_id", max: MAX_ID },
];

/** `vote_date, voter_id, story_id` per line. */
export function parseVotes(buf: Uint8Array, member = "digg_votes1.csv"): VoteRows {
  const bound = rowBound(buf);
  const t = new Float64Array(bound);
  const voter = new Int32Array(bound);
  const story = new Int32Array(bound);
  let n = 0;
  scan(buf, VOTE_FIELDS, member, (v) => {
    t[n] = v[0] as number;
    voter[n] = v[1] as number;
    story[n] = v[2] as number;
    n++;
  });
  return { count: n, t: t.slice(0, n), voter: voter.slice(0, n), story: story.slice(0, n) };
}

/** `mutual, friend_date, user_id, friend_id` per line. */
export function parseFriends(buf: Uint8Array, member = "digg_friends.csv"): LinkRows {
  const bound = rowBound(buf);
  const mutual = new Uint8Array(bound);
  const t = new Float64Array(bound);
  const user = new Int32Array(bound);
  const friend = new Int32Array(bound);
  let n = 0;
  scan(buf, FRIEND_FIELDS, member, (v) => {
    mutual[n] = v[0] as number;
    t[n] = v[1] as number;
    user[n] = v[2] as number;
    friend[n] = v[3] as number;
    n++;
  });
  return { count: n, mutual: mutual.slice(0, n), t: t.slice(0, n), user: user.slice(0, n), friend: friend.slice(0, n) };
}
