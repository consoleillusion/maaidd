/**
 * `maaidd graph <query>` — human-facing codegraph query wrapper.
 */
import { buildCommand } from "@stricli/core";
import { existsSync } from "node:fs";
import {
  codegraphIndexPath,
  codegraphStatus,
  runCodegraph,
} from "../../codegraph.ts";
const graphCommand = buildCommand({
  docs: { brief: "Query the code-graph index" },
  parameters: {
    positional: {
      kind: "array",
      parameter: {
        parse: String,
        brief: "Query arguments passed to code-graph",
        optional: true,
      },
    },
  } as any,
  func: (_flags: any, ...args) => {
    const stdout = (s: string) => process.stdout.write(s + "\n");
    const stderr = (s: string) => process.stderr.write(s + "\n");
    if (!existsSync(codegraphIndexPath())) {
      stderr(
        "No code-graph index found. Run `bunx @sdsrs/code-graph incremental-index` first.",
      );
      process.exitCode = 1;
      return;
    }
    if (args.length === 0) {
      stdout(codegraphStatus());
      return;
    }
    const result = runCodegraph(args);
    if (result.error) {
      stdout(codegraphStatus());
      stderr(`Unable to run code-graph: ${result.error}`);
      process.exitCode = 1;
      return;
    }
    if (result.stdout) stdout(result.stdout.trimEnd());
    if (result.stderr) stderr(result.stderr.trimEnd());
    if (result.status !== 0) process.exitCode = result.status;
  },
});
export { graphCommand };
