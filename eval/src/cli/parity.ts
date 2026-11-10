import { checkNode } from "../frozen.ts";
import { parityCommand } from "../parity/write.ts";

// Usage: npm run parity -w @breadit/eval -- --param alpha=<v> --param beta=<v> [--dataset <id>] [--out <dir>]
// Draws 100 (user, asOf) pairs of syn-W2M-M with the "parity" stream and writes the harness order of each pair for each
// `algo` of the live feed to .docs/results/p6-parity/ (the parity test of the backend reads them).
checkNode();
try {
  process.stdout.write(parityCommand(process.argv.slice(2)).join("\n") + "\n");
} catch (e) {
  process.stderr.write(`parity: ${(e as Error).message}\n`);
  process.exitCode = 1;
}
