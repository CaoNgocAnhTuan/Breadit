import { checkNode } from "../frozen.ts";
import { freezeCommand } from "../harness/freeze.ts";

// Usage: npm run freeze -w @breadit/eval [-- --approve <name>] [-- --check]
// Reads .docs/results/p7-tune-main and p7-tune-worlds, checks them, and writes the ten test configs in eval/config/runs/.
// Without --approve the configs have no testApprovedBy and the harness refuses them. --approve is the author's OK for the test split.
checkNode();
try {
  process.stdout.write(freezeCommand(process.argv.slice(2)).join("\n") + "\n");
} catch (e) {
  process.stderr.write(`freeze: ${(e as Error).message}\n`);
  process.exitCode = 1;
}
