/**
 * Run the project's tests and retain the counts used by metric snapshots.
 *
 * Test failures are data, not a reason to abort snapshot creation. Both Bun's
 * summary and Node's `node --test` TAP summary are understood; npm wrappers
 * work because their child runner prints the same summary.
 */
import { spawnSync } from "node:child_process";

export interface TestRunSummary {
  command: string;
  total: number | null;
  passed: number | null;
  failed: number | null;
  skipped: number | null;
  todo: number | null;
  exitCode: number;
  error?: string;
}

export interface TestRunnerOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

function count(output: string, bun: RegExp, node: RegExp): number | null {
  const match = bun.exec(output) ?? node.exec(output);
  return match ? Number(match[1]) : null;
}

/** Parse Bun and Node test summaries without depending on ANSI styling. */
export function parseTestOutput(
  command: string,
  input: string,
  exitCode: number,
): TestRunSummary {
  // Bun may color its summary even when spawned by another process.
  const output = input.replace(/\u001b\[[0-9;]*m/g, "");
  const bunCount = (name: string) =>
    new RegExp(`^\\s*(\\d+)\\s+${name}\\s*$`, "m");
  const nodeCount = (name: string) =>
    new RegExp(`^\\s*#\\s+${name}\\s+(\\d+)\\s*$`, "m");

  const passed = count(output, bunCount("pass"), nodeCount("pass"));
  const failed = count(output, bunCount("fail"), nodeCount("fail"));
  const skipped = count(
    output,
    bunCount("skip(?:ped)?"),
    nodeCount("skipped"),
  );
  const todo = count(output, bunCount("todo"), nodeCount("todo"));

  const bunTotal = /^\s*Ran\s+(\d+)\s+tests?\b/m.exec(output);
  const nodeTotal = /^\s*#\s+tests\s+(\d+)\s*$/m.exec(output);
  const summed = [passed, failed, skipped, todo]
    .filter((value): value is number => value !== null)
    .reduce((sum, value) => sum + value, 0);
  const hasCounts = [passed, failed, skipped, todo].some(
    (value) => value !== null,
  );
  const total = bunTotal
    ? Number(bunTotal[1])
    : nodeTotal
      ? Number(nodeTotal[1])
      : hasCounts
        ? summed
        : null;

  return { command, total, passed, failed, skipped, todo, exitCode };
}

/** Run a test command and return its summary; never throw for test failures. */
export function runTestSuite(
  command = "bun run test",
  options: TestRunnerOptions = {},
): TestRunSummary {
  const result = spawnSync(command, {
    cwd: options.cwd,
    env: options.env,
    shell: true,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const exitCode = result.status ?? 1;
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const summary = parseTestOutput(command, output, exitCode);

  if (result.error) {
    summary.error = result.error.message;
  } else if (summary.total === null) {
    summary.error = "Could not find test counts in the test runner output";
  }
  return summary;
}
