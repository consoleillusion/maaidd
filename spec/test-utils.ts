import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dir, "..");
export const CLI = join(ROOT, "src", "cli", "index.ts");
export const FTA_BIN = join(ROOT, "node_modules", ".bin", "fta");

/** Temporary projects live inside this repository and are removed by each spec. */
export function makeTempDir(prefix = "maid-spec-"): string {
  return mkdtempSync(join(ROOT, prefix));
}

export interface CliResult {
  stdout: string;
  stderr: string;
  status: number | null;
}

export function runCli(
  args: string[],
  options: { cwd?: string; input?: string; env?: NodeJS.ProcessEnv } = {},
): CliResult {
  const result = spawnSync("bun", ["run", CLI, ...args], {
    cwd: options.cwd ?? ROOT,
    input: options.input,
    encoding: "utf8",
    env: { ...process.env, FTA_BIN, ...options.env },
  });
  return {
    stdout: result.stdout ?? "",
    stderr: (result.stderr ?? "") + (result.error?.message ?? ""),
    status: result.status,
  };
}

export function writeExecutable(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
  chmodSync(path, 0o755);
}
