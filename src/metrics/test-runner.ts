/**
 * Run the project's tests and retain counts plus per-test results for snapshots.
 *
 * Test failures are data, not a reason to abort snapshot creation. Both Bun's
 * summary and Node's `node --test` TAP summary are understood for counts; per-
 * test details are captured from Bun's JUnit reporter when possible.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type TestStatus = "pass" | "fail" | "skip" | "todo";

export interface TestCaseResult {
  /** Stable identity: suite hierarchy (e.g. describe/classname) */
  suite: string;
  name: string;
  file: string;
  status: TestStatus;
  durationMs: number | null;
  error?: string;
}

export interface TestRunSummary {
  command: string;
  total: number | null;
  passed: number | null;
  failed: number | null;
  skipped: number | null;
  todo: number | null;
  exitCode: number;
  error?: string;
  /** Per-test results when collected (e.g. Bun JUnit); absent for legacy/counts-only. */
  results?: TestCaseResult[];
  resultsDetail?: "full" | "counts-only";
}

export interface TestRunnerOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

function count(output: string, bun: RegExp, node: RegExp): number | null {
  const match = bun.exec(output) ?? node.exec(output);
  return match ? Number(match[1]) : null;
}

function attr(tag: string, name: string): string {
  const m = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : "";
}

function unesc(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

/** Parse Bun/JUnit XML into per-test results (best-effort). */
export function parseJunitResults(xml: string): TestCaseResult[] {
  const results: TestCaseResult[] = [];
  const tc = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
  let m: RegExpExecArray | null;
  while ((m = tc.exec(xml))) {
    const attrs = m[1];
    const body = m[2] ?? "";
    const name = attr("<x " + attrs, "name");
    const suite = attr("<x " + attrs, "classname");
    const file = attr("<x " + attrs, "file");
    const time = Number(attr("<x " + attrs, "time"));
    let status: TestStatus = "pass";
    let error: string | undefined;
    if (/<skipped\b/i.test(body)) status = "skip";
    else if (/<failure\b|<error\b/i.test(body)) {
      status = "fail";
      const msg = /<(?:failure|error)\b[^>]*message="([^"]*)"/i.exec(body)?.[1];
      const text = /<(?:failure|error)\b[^>]*>([\s\S]*?)<\/(?:failure|error)>/i.exec(body)?.[1];
      error = unesc((msg ?? text ?? "").trim()).slice(0, 4000) || undefined;
    }
    results.push({
      suite,
      name,
      file,
      status,
      durationMs: Number.isFinite(time) ? Math.round(time * 1000) : null,
      ...(error ? { error } : {}),
    });
  }
  return results;
}

function isBunTestCommand(command: string): boolean {
  // default "bun run test" and direct "bun test" forms
  return /^\s*bun\s+run\s+test\b/.test(command) || /^\s*bun\s+test\b/.test(command);
}

function withJunit(command: string, outfile: string): string {
  const flags = `--reporter=junit --reporter-outfile=${JSON.stringify(outfile)}`;
  if (/^\s*bun\s+run\s+test\b/.test(command)) return `${command} -- ${flags}`;
  if (/^\s*bun\s+test\b/.test(command)) return `${command} ${flags}`;
  return command;
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
  const skipped = count(output, bunCount("skip(?:ped)?"), nodeCount("skipped"));
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
  const bun = isBunTestCommand(command);
  let tmp: string | null = null;
  let outfile: string | null = null;
  let runCommand = command;
  if (bun) {
    tmp = mkdtempSync(join(tmpdir(), "maaidd-junit-"));
    outfile = join(tmp, "junit.xml");
    runCommand = withJunit(command, outfile);
  }
  try {
    const result = spawnSync(runCommand, {
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
    }
    if (outfile) {
      try {
        const xml = readFileSync(outfile, "utf8");
        const results = parseJunitResults(xml);
        if (results.length) {
          summary.results = results;
          summary.resultsDetail = "full";
        } else {
          summary.resultsDetail = "counts-only";
        }
      } catch {
        summary.resultsDetail = "counts-only";
      }
    } else {
      summary.resultsDetail = "counts-only";
    }
    if (summary.total === null) {
      summary.error = summary.error ?? "Could not find test counts in the test runner output";
    }
    return summary;
  } finally {
    if (tmp) try { rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
}
