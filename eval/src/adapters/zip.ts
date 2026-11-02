import { crc32, inflateRawSync } from "node:zlib";

// A small in-memory reader for the zips of the Digg 2009 data (task p4-digg-adapter, design "Read the zips in
// memory"). One member, deflate (method 8), traditional ZipCrypto. Nothing is written to disk. Node has no zip
// reader and no ZipCrypto, so both are here. Any other shape stops with a message (design F2, F3).

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const MAX32 = 0xffffffff;

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function notZip(why: string): Error {
  return new Error(`not a zip file: ${why}`);
}

function unsupported(why: string): Error {
  return new Error(`unsupported zip: ${why}`);
}

function findEocd(zip: Buffer): number {
  const lowest = Math.max(0, zip.length - 22 - 0xffff);
  for (let i = zip.length - 22; i >= lowest; i--) {
    if (zip.readUInt32LE(i) === SIG_EOCD) return i;
  }
  throw notZip("no end-of-central-directory record");
}

/**
 * Reads the one member of an encrypted zip. Checks the ZipCrypto check byte (wrong password), then the CRC-32 and
 * the size of the inflated data against the central directory entry (damaged data).
 */
export function readEncryptedMember(zip: Buffer, password: string): { name: string; data: Buffer } {
  const eocd = findEocd(zip);
  const total = zip.readUInt16LE(eocd + 10);
  const cdOffset = zip.readUInt32LE(eocd + 16);
  const hasLocator = eocd >= 20 && zip.readUInt32LE(eocd - 20) === SIG_ZIP64_LOCATOR;
  if (hasLocator || total === 0xffff || zip.readUInt32LE(eocd + 12) === MAX32 || cdOffset === MAX32) {
    throw unsupported("zip64");
  }
  if (total !== 1) throw unsupported(`${total} members, expected one`);
  if (cdOffset + 46 > zip.length || zip.readUInt32LE(cdOffset) !== SIG_CENTRAL) {
    throw notZip("bad central directory entry");
  }

  const cen = cdOffset;
  const flags = zip.readUInt16LE(cen + 8);
  const method = zip.readUInt16LE(cen + 10);
  const crc = zip.readUInt32LE(cen + 16);
  const csize = zip.readUInt32LE(cen + 20);
  const usize = zip.readUInt32LE(cen + 24);
  const nameLen = zip.readUInt16LE(cen + 28);
  const localOffset = zip.readUInt32LE(cen + 42);
  if (cen + 46 + nameLen > zip.length) throw notZip("central directory entry is cut");
  const name = zip.toString("utf8", cen + 46, cen + 46 + nameLen);
  if (csize === MAX32 || usize === MAX32 || localOffset === MAX32) throw unsupported("zip64 sizes");
  if ((flags & 1) === 0) throw unsupported(`member "${name}" is not encrypted`);
  if ((flags & (1 << 6)) !== 0 || (flags & (1 << 13)) !== 0) throw unsupported(`member "${name}" uses strong encryption`);
  if (method !== 8) throw unsupported(`member "${name}" uses method ${method}, expected 8 (deflate)`);

  if (localOffset + 30 > zip.length || zip.readUInt32LE(localOffset) !== SIG_LOCAL) {
    throw notZip("bad local file header");
  }
  const localFlags = zip.readUInt16LE(localOffset + 6);
  const localTime = zip.readUInt16LE(localOffset + 10);
  const localNameLen = zip.readUInt16LE(localOffset + 26);
  const localExtraLen = zip.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + localNameLen + localExtraLen;
  const end = start + csize;
  if (end > zip.length || csize < 12) throw notZip(`data of member "${name}" is cut`);
  if (zip.toString("utf8", localOffset + 30, localOffset + 30 + localNameLen) !== name) {
    throw notZip("local and central names differ");
  }

  // ZipCrypto: three keys, updated with every plaintext byte. The password goes through the same update.
  let k0 = 0x12345678;
  let k1 = 0x23456789;
  let k2 = 0x34567890;
  const update = (b: number): void => {
    k0 = (CRC_TABLE[(k0 ^ b) & 0xff] as number) ^ (k0 >>> 8);
    k1 = (Math.imul((k1 + (k0 & 0xff)) >>> 0, 134775813) + 1) >>> 0;
    k2 = (CRC_TABLE[(k2 ^ (k1 >>> 24)) & 0xff] as number) ^ (k2 >>> 8);
  };
  for (const b of Buffer.from(password, "utf8")) update(b);

  const plain = Buffer.allocUnsafe(csize);
  for (let i = 0; i < csize; i++) {
    const t = (k2 | 2) & 0xffff;
    const p = (zip[start + i] as number) ^ ((Math.imul(t, t ^ 1) >>> 8) & 0xff);
    plain[i] = p;
    update(p);
  }

  // Last byte of the 12-byte header: the high byte of the CRC-32, or with bit 3 (data descriptor) of the DOS time.
  const expected = (localFlags & 8) !== 0 ? (localTime >>> 8) & 0xff : crc >>> 24;
  if (plain[11] !== expected) throw new Error(`wrong password for member "${name}" (check byte differs)`);

  let data: Buffer;
  try {
    data = inflateRawSync(plain.subarray(12), { maxOutputLength: Math.max(usize, 1) });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "ERR_BUFFER_TOO_LARGE") throw new Error(`member "${name}": size mismatch (damaged data)`);
    throw new Error(`member "${name}": cannot inflate (damaged data): ${(e as Error).message}`);
  }
  if (data.length !== usize) {
    throw new Error(`member "${name}": size ${data.length}, expected ${usize} (damaged data)`);
  }
  if (crc32(data) !== crc) throw new Error(`member "${name}": CRC-32 mismatch (damaged data)`);
  return { name, data };
}
