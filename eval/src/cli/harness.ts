import { checkNode } from "../frozen.ts";
import { harnessCommand } from "../harness/commands.ts";

// Usage: npm run harness -w @breadit/eval -- <runId|path> [--out <dir>] [--record-t]
// The run config (eval/config/runs/<runId>.json) sets the datasets, the split, the methods and their params.
// There is no --split flag: the split is read from the config file only.
checkNode();
try {
  process.stdout.write(harnessCommand(process.argv.slice(2)).join("\n") + "\n");
} catch (e) {
  process.stderr.write(`harness: ${(e as Error).message}\n`);
  process.exitCode = 1;
}
