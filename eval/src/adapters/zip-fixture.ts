import { deflateRawSync, crc32 } from "node:zlib";

// Test helper: builds small zip files in memory, with traditional ZipCrypto. Not used by production code.
// It writes its own encryption, so zip.ts is tested against code that does not share its functions.
// The fixture made by the system `zip -P` (fixtures/tiny.zip) is the independent check of both.

export interface ZipMember {
  name: string;
  data: Buffer | string;
  /** Encrypt with this password. Without it the member is stored in clear (flag bit 0 off). */
  password?: string;
  /** Set flag bit 3 (data descriptor). The check byte is then the high byte of the DOS time, else of the CRC-32. */
  bit3?: boolean;
  /** 8 is deflate (default), 0 is stored. */
  method?: 0 | 8;
}

const DOS_TIME = 0x7a59;
const DOS_DATE = 0x5d62;

const TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  TABLE[n] = c >>> 0;
}
const step = (crc: number, b: number): number => (TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8)) >>> 0;

/** Traditional PKWARE encryption of `plain` (12 header bytes first), written from the zip format notes. */
export function zipCryptoEncrypt(plain: Buffer, password: string, checkByte: number): Buffer {
  let k0 = 0x12345678;
  let k1 = 0x23456789;
  let k2 = 0x34567890;
  const update = (b: number): void => {
    k0 = step(k0, b);
    k1 = (Math.imul((k1 + (k0 & 0xff)) >>> 0, 134775813) + 1) >>> 0;
    k2 = step(k2, k1 >>> 24);
  };
  for (const b of Buffer.from(password, "utf8")) update(b);
  const header = Buffer.alloc(12);
  for (let i = 0; i < 11; i++) header[i] = (i * 37 + 11) & 0xff; // fixed, so the output is repeatable
  header[11] = checkByte;
  const all = Buffer.concat([header, plain]);
  const out = Buffer.alloc(all.length);
  for (let i = 0; i < all.length; i++) {
    const t = (k2 | 2) & 0xffff;
    const stream = (Math.imul(t, t ^ 1) >>> 8) & 0xff;
    const p = all[i] as number;
    out[i] = p ^ stream;
    update(p);
  }
  return out;
}

export function buildZip(members: readonly ZipMember[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const m of members) {
    const raw = Buffer.from(m.data);
    const method = m.method ?? 8;
    const crc = crc32(raw);
    let body = method === 8 ? deflateRawSync(raw) : raw;
    const bit3 = m.bit3 === true;
    if (m.password !== undefined) {
      body = zipCryptoEncrypt(body, m.password, bit3 ? (DOS_TIME >>> 8) & 0xff : crc >>> 24);
    }
    const flags = (m.password !== undefined ? 1 : 0) | (bit3 ? 8 : 0);
    const name = Buffer.from(m.name, "utf8");

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(flags, 8);
    cen.writeUInt16LE(method, 10);
    cen.writeUInt16LE(DOS_TIME, 12);
    cen.writeUInt16LE(DOS_DATE, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(raw.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cen, name]));

    parts.push(local, name, body);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(members.length, 8);
  eocd.writeUInt16LE(members.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, eocd]);
}
