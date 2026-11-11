import { checkNode } from "../frozen.ts";
import { reportCommand } from "../report/report.ts";

// Usage: npm run report -w @breadit/eval
// Reads the twelve P7 runs in .docs/results/, checks each file against its run manifest, and writes .docs/results/p7-report/:
// macros.csv, results-macros.tex, tables/<id>.tex, results.md, fig-e3-density.csv and manifest.json.
checkNode();
try {
  process.stdout.write(reportCommand(process.argv.slice(2)).join("\n") + "\n");
} catch (e) {
  process.stderr.write(`report: ${(e as Error).message}\n`);
  process.exitCode = 1;
}
