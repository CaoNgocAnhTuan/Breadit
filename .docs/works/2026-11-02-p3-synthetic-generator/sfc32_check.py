#!/usr/bin/env python3
"""Independent sfc32 check for eval/src/rng.ts (task p3-synthetic-generator, Step 3).

Run:  python3 -I sfc32_check.py [masterSeed] [stage] [count]

Prints the first `count` outputs (default 8) of rng(masterSeed, stage):
sfc32, state = first 16 bytes of sha256("<masterSeed>:<stage>") as four
big-endian uint32 (a, b, c, counter), first 12 outputs dropped.
Standard library only. The TypeScript values must be equal to these.
"""
import hashlib
import struct
import sys

M = 0xFFFFFFFF


def sfc32(a, b, c, d):
    def nxt():
        nonlocal a, b, c, d
        t = (a + b) & M
        a = b ^ (b >> 9)
        b = (c + ((c << 3) & M)) & M
        c = (((c << 21) & M) | (c >> 11))
        d = (d + 1) & M
        t = (t + d) & M
        c = (c + t) & M
        return t
    return nxt


def rng(master_seed, stage):
    digest = hashlib.sha256(("%s:%s" % (master_seed, stage)).encode("utf-8")).digest()
    a, b, c, d = struct.unpack(">4I", digest[:16])
    gen = sfc32(a, b, c, d)
    for _ in range(12):
        gen()
    return gen


if __name__ == "__main__":
    seed = sys.argv[1] if len(sys.argv) > 1 else "20261014"
    stage = sys.argv[2] if len(sys.argv) > 2 else "users"
    count = int(sys.argv[3]) if len(sys.argv) > 3 else 8
    g = rng(seed, stage)
    print([g() for _ in range(count)])
