# 07 · Determinism and reproducibility

[Guidance Manual](../Guidance-Manual.md) · English · [Tiếng Việt](../vi/07-determinism.md)

**After reading this you can:** explain why every number in the thesis comes out the same on every run, name the rules that make it so, and show how a reader can check it.

Sources: super-plan §2, implementation-plan §2.3 and §2.4, `eval/src/rng.ts`, `.claude/rules/determinism.md`. Terms: [09 Glossary](09-glossary.md).

---

## 1. The main rule

**Every number in the thesis must come from a command that gives the same result every time.**

Why so strict? The pre-thesis report had numbers that could not be traced: the abstract and chapter 5 disagreed, and a k6 results file did not come from the script it claimed. If every number is rebuilt by a command and checked by a hash, that cannot happen again.

## 2. Two classes of results

| Class | What | Promise | How it is reported |
|---|---|---|---|
| **D**, byte-identical | datasets, features, rankings, metrics, statistics, table data | a re-run gives the same files, byte for byte | SHA-256 of each file in a manifest |
| **R**, repeatable | latency, throughput (E7) | a re-run gives similar numbers | 5 runs, first dropped, median with a confidence interval |

Timing depends on the machine and the moment, so it can never be identical. The thesis says "repeatable", never "identical", for Class R.

## 3. The rules that keep Class D

**No clock.** `Date.now()` and `Math.random()` are not allowed in `packages/ranking/` or `eval/`. Time is always an argument (`asOf`). A test greps the code for them, and an editor hook warns after each edit.

**One seeded random generator.** All randomness comes from the master seed **20261014**:

```
rng(masterSeed, stage) = sfc32 seeded from sha256("20261014:<stage>"), first 12 outputs dropped
```

- **sfc32** is a small, fast, well-tested generator with 128 bits of state.
- **One stream per stage**: `users`, `follows`, `communities`, `posts`, `interactions`, `bootstrap`, `permutation`, `parity`, `shuffle`. Adding a stage never changes another stage's numbers. Names are never reused.
- Not `mulberry32` from `seed.ts`: it has only 32 bits of state.

**Integer scores.** Every score is `floor(score × 100)`. Sums run in a fixed order. File 03 shows why: 9.7 can become 9.6999…, and the integer step makes that harmless because every run does the same.

**A total tie-break.** Sort by `(scoreFixed desc, postId desc)`. Two posts can never be "equal", so the order never depends on database row order or sort stability.

**Canonical files.** CSV, UTF-8, LF line ends, header row, fixed column order, sorted rows, metrics with 6 decimals, negative zero printed as 0. Two runs that compute the same values write the same bytes.

**A pinned environment.** Node v22.23.4 in `.nvmrc`, `engine-strict` on, Docker images pinned by digest, `npm ci`. The Node version goes into every manifest, because math functions like `Math.log2` can differ between engines.

**No cache, no HTTP.** The evaluation reads files directly. It never goes through Redis, the rate limiter or the API, whose state could change a result.

## 4. Manifests and hashes

Every output folder has a `manifest.json`:

```
schemaVersion, datasetId or runId, source (config path + SHA-256, or zip URLs + SHA-256),
masterSeed, epoch, node, files: { name: { rows, sha256 } }
```

**SHA-256** is a fingerprint: change one byte of a file and the hash changes completely. So comparing two manifests compares every file at once.

## 5. The tests that prove it

| Test | What it shows |
|---|---|
| Generator double run | generating twice gives identical manifests (P3) |
| Adapter double run | converting Digg twice gives identical files (P4) |
| Golden test | a tiny hand-checked dataset gives exactly the committed CSV (P5) |
| Leakage test | changing every event after t_u leaves u's rows unchanged (P5) |
| Harness double run | two full runs give byte-identical results (P5) |
| P7 double run ✅ | every P7 run and the report, made again from empty folders, give byte-identical files and manifests (task 9) |
| Parity test ✅ | the live app and the harness give the same order: 300 of 300 at the feed module and 300 of 300 over HTTP (task 8, `npm run test:parity -w @breadit/backend`) |
| `thesis:repro` ✅ | one command rebuilds every Class D result and compares every hash with `.docs/results/manifest.json` (task 11, `npm run thesis:repro`) |

## 6. Frozen values

Some values must be fixed **before** the test split runs, or they could be tuned to make the result look good: the seed, K, the buckets, the α and β grid, m, the window and pool cap, the cut time T, the baseline grids, the synthetic parameters. They are in super-plan §7. Changing one needs a new config version and a dated line in the change log. `eval/config/frozen-v1.json` holds them for the code, and the harness stops if its own T differs from the frozen T.

## 7. From a number in the thesis back to its source

Built in task 9: `npm run report -w @breadit/eval` turns the result CSVs into LaTeX macros (`results-macros.tex`), LaTeX tables, `results.md` (the same tables in Markdown) and a `macros.csv` that records, for each macro, the file, the row and the column it came from. It checks every input file against its run manifest, and every macro against its cell. The text uses only macros, never typed numbers. So:

```
number in the PDF → macro name → macros.csv row → results CSV cell → manifest hash → command that made it
```

## 8. How a reviewer can check

1. Clone, `nvm use`, `npm ci`.
2. `npm run gen -w @breadit/eval` and compare the dataset manifests.
3. Run a harness config and compare `.docs/results/<runId>/manifest.json`.
4. `npm run thesis:repro` does all of it in one step. It needs Docker `db` and `redis` and the two Digg zips, and it takes about 3 hours. It deletes the Class D results, rebuilds them from nothing, and compares every hash with `.docs/results/manifest.json`. It stops at the first step that fails and at the first hash that differs, and it names the file.

**The merged manifest.** `.docs/results/manifest.json` holds the SHA-256 of the manifest of each of the 16 results folders and of the 9 dataset manifests. Each of those manifests lists its files with their SHA-256, so one compare checks every file, including the git-ignored ones. The E7 folder is marked Class R (latency never gives the same bytes), so it is listed but not compared.

## 9. Check yourself

1. Why is latency Class R and not Class D?
2. Why does each stage have its own random stream?
3. What could go wrong without a total tie-break?
4. Why is the Node version recorded in the manifest?
5. Why must frozen values be fixed before the test split runs?
