import { afterEach, describe, expect, it } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseTestOutput, runTestSuite } from "../src/metrics/test-runner.ts";
import { makeTempDir, ROOT } from "./test-utils.ts";

const temporaryDirs: string[] = [];
afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("test-runner summaries", () => {
  it("parses Bun pass, fail, skip, and total counts", () => {
    const summary = parseTestOutput(
      "bun run test",
      "bun test v1.4.2\n\n\u001b[32m 8 pass\u001b[0m\n 2 fail\n 1 skip\n 0 todo\nRan 11 tests across 3 files. [1.20s]",
      1,
    );
    expect(summary).toMatchObject({
      total: 11,
      passed: 8,
      failed: 2,
      skipped: 1,
      todo: 0,
      exitCode: 1,
    });
  });

  it("parses Node --test TAP summaries", () => {
    const summary = parseTestOutput(
      "node --test",
      "TAP version 13\n# tests 5\n# pass 3\n# fail 1\n# skipped 1\n# todo 0",
      1,
    );
    expect(summary).toMatchObject({
      total: 5,
      passed: 3,
      failed: 1,
      skipped: 1,
      todo: 0,
    });
  });

  it("collects counts from an actual failing Bun test run", () => {
    const dir = makeTempDir();
    temporaryDirs.push(dir);
    const file = join(dir, "sample.test.ts");
    writeFileSync(
      file,
      `import { expect, test } from "bun:test";
test("one", () => expect(1).toBe(1));
test("two", () => expect(2).toBe(2));
test("failure", () => expect(3).toBe(4));
`,
    );

    const summary = runTestSuite(`bun test ${file}`, { cwd: ROOT });
    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.exitCode).toBe(1);
    expect(summary.error).toBeUndefined();
  });

  it("retains a useful error for unrecognized runner output", () => {
    const summary = runTestSuite("printf 'not a test summary'");
    expect(summary.total).toBeNull();
    expect(summary.passed).toBeNull();
    expect(summary.error).toContain("Could not find test counts");
  });
});
