import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getBenchmark } from "../src/insights/benchmark.ts";
import { saveSnapshot } from "../src/metrics/store.ts";
import type { FtaFileMetric } from "../src/metrics/fta.ts";
import type { TestRunSummary } from "../src/metrics/test-runner.ts";
import { runCli } from "./test-utils.ts";

const metric = (overrides: Partial<FtaFileMetric> = {}): FtaFileMetric => ({
  file_name: "src/a.ts",
  cyclo: 4,
  fta_score: 60,
  assessment: "OK",
  line_count: 100,
  halstead: { bugs: 0.1 },
  ...overrides,
});

const tests = (
  results: { name: string; status: "pass" | "fail" }[],
): TestRunSummary => ({
  command: "bun test",
  total: results.length,
  passed: results.filter((result) => result.status === "pass").length,
  failed: results.filter((result) => result.status === "fail").length,
  skipped: 0,
  todo: 0,
  exitCode: results.some((result) => result.status === "fail") ? 1 : 0,
  results: results.map((result) => ({
    suite: "suite",
    name: result.name,
    file: "src/a.test.ts",
    status: result.status,
    durationMs: 1,
  })),
});

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), "maid-benchmark-"));
  writeFileSync(join(dir, "maid.config.json"), "{}\n", "utf8");
  saveSnapshot(
    dir,
    "aaaaaaa1",
    [metric({ fta_score: 50, cyclo: 4, line_count: 90 })],
    tests([
      { name: "a", status: "pass" },
      { name: "b", status: "pass" },
    ]),
  );
  saveSnapshot(
    dir,
    "bbbbbbb2",
    [metric({ fta_score: 60, cyclo: 4, line_count: 100 })],
    tests([
      { name: "a", status: "pass" },
      { name: "b", status: "fail" },
      { name: "c", status: "pass" },
    ]),
  );
  return dir;
};

describe("benchmark insight", () => {
  it("compares the latest snapshot against the previous commit", () => {
    const dir = setup();
    try {
      const payload = getBenchmark({ root: dir });
      expect(payload.kind).toBe("benchmark");
      expect(payload.current?.shortSha).toBe("bbbbbbb2");
      expect(payload.baseline?.shortSha).toBe("aaaaaaa1");
      expect(payload.metrics.avgFtaScore.delta).toBe(10);
      expect(payload.metrics.avgCyclomatic.delta).toBe(0);
      expect(payload.metrics.testPassRate.current).toBeCloseTo(2 / 3);
      expect(payload.tests.counts.broken).toBe(1);
      expect(payload.tests.broken).toEqual(["suite :: b"]);
      expect(payload.tests.counts.added).toBe(1);
      expect(payload.targets.passed).toBe(false);
      expect(payload.targets.failed).toEqual(["testPassRate"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("honors an explicit baseline and reports target success", () => {
    const dir = setup();
    try {
      const payload = getBenchmark({ root: dir, baseline: "first" });
      expect(payload.baselineRef).toBe("first");
      expect(payload.targets.failed).toContain("testPassRate");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prints the same payload from the CLI", () => {
    const dir = setup();
    try {
      const result = runCli(["benchmark", "--snapshot", "bbbbbbb2"], {
        cwd: dir,
      });
      expect(result.status).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload.kind).toBe("benchmark");
      expect(payload.current.shortSha).toBe("bbbbbbb2");
      expect(payload.baseline.shortSha).toBe("aaaaaaa1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
