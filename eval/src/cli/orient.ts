import { checkNode } from "../frozen.ts";
import { orientCommand } from "../orient.ts";

// Usage: npm run orient -w @breadit/eval
// The Orientation's group comparison (exploratory): reads the per-user ranks of p7-main (checked against its manifest) and writes
// .docs/results/p9-orient-groups/groups.csv and manifest.json. Run it after the harness run p7-main and before the report.
checkNode();
try {
  process.stdout.write(orientCommand(process.argv.slice(2)).join("\n") + "\n");
} catch (e) {
  process.stderr.write(`orient: ${(e as Error).message}\n`);
  process.exitCode = 1;
}
