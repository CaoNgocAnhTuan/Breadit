import { checkNode } from "../frozen.ts";
import { e7SummaryCommand } from "../bench/write.ts";

// Usage: npm run e7:summary -w @breadit/eval
// Reads the raw files of the E7 benchmark in eval/results/p7-e7/ (made by `npm run bench:e7`) and writes .docs/results/p7-e7/:
// latency.csv, queries.csv, runs.csv, queries-raw.csv and manifest.json. It reads files only: no Postgres, Redis or HTTP.
checkNode();
try {
  process.stdout.write(e7SummaryCommand(process.argv.slice(2)).join("\n") + "\n");
} catch (e) {
  process.stderr.write(`e7-summary: ${(e as Error).message}\n`);
  process.exitCode = 1;
}
