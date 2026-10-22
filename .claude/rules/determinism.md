---
paths:
  - "eval/**"
  - "apps/backend/src/ranking/**"
---

# Determinism rules (super-plan §2)

Code here makes thesis numbers. Class D outputs (datasets, features, rankings, metrics, statistics, the data behind tables and figures) must be byte-identical on every run. Class R numbers (latency, throughput) are repeatable, not identical, and are not made in these folders.

## Do

- Take time as an argument (`asOf`, integer seconds from the base epoch in super-plan §7).
- Get randomness only from `rng(masterSeed, stageName)` (sfc32 seeded from sha256). One stream per stage.
- Keep scores as fixed-point integers (`Math.floor(score * 100)`). Sum in a fixed order (sorted by id).
- Sort with a total order: `(scoreFixed desc, postId desc)`. Never depend on database row order.
- Write canonical files: CSV, UTF-8, LF line endings, sorted rows, fixed column order, metrics with 6 decimals.
- Give generated data explicit IDs (user IDs too) and integer timestamps.
- Read data directly. No HTTP, Redis or throttler on the evaluation path.
- Keep `ranking/core/` pure: no Nest, Prisma or Redis imports.

## Don't

- `Date.now()`, `new Date()` with no argument, `performance.now()`, `Math.random()`, `crypto.randomUUID()`, `cuid()`.
- `.sort()` with no compare function, `localeCompare`, `toLocaleString`, `Intl`.
- Floating-point sums over items in an unknown order.
- Reuse `mulberry32` from `seed.ts` (32 bits of state).

The PostToolUse hook reports these patterns after each edit. A line can opt out with `// harness-allow: <reason>`, only for a real reason; the reviewers check it.

Frozen values (seed, epoch, K, buckets, grids) are in super-plan §7. Read them there. Do not copy a number into comments or docs. Only the author changes one, with /freeze.
