import { checkNode } from "../frozen.ts";
import { rankCommand } from "../harness/commands.ts";

// Usage: npm run rank -w @breadit/eval -- --dataset <id> --method <m> --user <u> --asof <t> [--before-event <id>] --top <n>
//        [--param name=value]... [--config <runId|path>] [--pool normal|large]
// Prints post ids in rank order, one per line (blueprint section 2.9). The params come from --config, then from --param.
checkNode();
try {
  const lines = rankCommand(process.argv.slice(2));
  if (lines.length > 0) process.stdout.write(lines.join("\n") + "\n");
} catch (e) {
  process.stderr.write(`rank: ${(e as Error).message}\n`);
  process.exitCode = 1;
}
