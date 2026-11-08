/** Shared code-graph CLI access for the `graph` command and MCP tools. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

export interface CodegraphRun {
  stdout: string;
  stderr: string;
  status: number;
  error?: string;
}

export function codegraphIndexPath(cwd = process.cwd()): string {
  return join(cwd, ".code-graph", "index.db");
}

function readOptional(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

export function codegraphStatus(cwd = process.cwd()): string {
  const indexDb = codegraphIndexPath(cwd);
  const recommendations = readOptional(
    join(cwd, ".code-graph", "recommendations.jsonl"),
  );
  const sourceRoots = readOptional(
    join(cwd, ".code-graph", "source-roots.json"),
  );
  return [
    `Code-graph index: ${indexDb}`,
    `Source roots: ${sourceRoots || "(none)"}`,
    `Recommendations:\n${recommendations || "(none)"}`,
  ].join("\n");
}

export function resolveCodegraphBinary(): string {
  if (process.env.CODEGRAPH_BIN) return process.env.CODEGRAPH_BIN;
  try {
    const packageJson = require.resolve("@sdsrs/code-graph/package.json");
    const candidate = join(dirname(packageJson), "bin", "cli.js");
    if (existsSync(candidate)) return candidate;
  } catch {
    // Fall through to the PATH lookup.
  }
  const local = join(process.cwd(), "node_modules", ".bin", "code-graph-mcp");
  return existsSync(local) ? local : "code-graph-mcp";
}

export function runCodegraph(
  args: string[],
  cwd = process.cwd(),
): CodegraphRun {
  const result = spawnSync(resolveCodegraphBinary(), args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
    error: result.error?.message,
  };
}
