import { checkNode } from "../frozen.ts";
import { mergedCommand } from "../repro/merged.ts";

// Usage: npm run results:manifest -w @breadit/eval [-- --write]
// Check mode (no flag): compares the SHA-256 of every results manifest in .docs/results/ and of every dataset manifest in
// eval/data/, and of every file they list, with .docs/results/manifest.json. Exit 1 and one line per difference when they differ.
// --write: makes .docs/results/manifest.json from the tree (only a tree that equals its own manifests).
// It reads files only: no Postgres, Redis or HTTP. The folders of Class R numbers (p7-e7) are listed, not compared.
checkNode();
try {
  process.stdout.write(mergedCommand(process.argv.slice(2)).join("\n") + "\n");
} catch (e) {
  process.stderr.write(`results-manifest: ${(e as Error).message}\n`);
  process.exitCode = 1;
}
