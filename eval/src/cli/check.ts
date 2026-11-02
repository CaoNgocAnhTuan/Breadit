import { resolve } from "node:path";
import { checkAll } from "../checks/run.ts";
import { checkNode } from "../frozen.ts";

// Usage: npm run check -w @breadit/eval [dataDir]    (default: eval/data; a relative path is relative to eval/)
checkNode();
const dir = process.argv[2] ? resolve(process.argv[2]) : new URL("../../data", import.meta.url).pathname;
const r = checkAll(dir);
process.stdout.write(r.text);
process.exitCode = r.pass ? 0 : 1;
