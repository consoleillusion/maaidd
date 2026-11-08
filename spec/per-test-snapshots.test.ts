import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  finalizeSnapshot,
  readAggregatedHistory,
  savePendingSnapshot,
  saveSnapshot,
} from "../src/metrics/history.ts";
import { generateReport } from "../src/metrics/report.ts";
import type { FtaFileMetric } from "../src/metrics/fta.ts";
import type { TestRunSummary } from "../src/metrics/test-runner.ts";
import { makeTempDir } from "./test-utils.ts";

const thresholds = { maxCyclomatic: 20, minFtaScore: 50 };
const metrics: FtaFileMetric[] = [
  {
    file_name: "a.ts",
    cyclo: 1,
    fta_score: 60,
    assessment: "OK",
    line_count: 10,
  },
];
const testsWithResults = (failed = 1): TestRunSummary => ({
  command: "bun test",
  total: 2,
  passed: 2 - failed,
  failed,
  skipped: 0,
  todo: 0,
  exitCode: failed ? 1 : 0,
  resultsDetail: "full",
  results: [
    {
      suite: "suite",
      name: "passes",
      file: "a.test.ts",
      status: "pass",
      durationMs: 1,
    },
    failed
      ? {
          suite: "suite",
          name: "fails",
          file: "a.test.ts",
          status: "fail",
          durationMs: 2,
          error: "boom",
        }
      : {
          suite: "suite",
          name: "fails-now-passes",
          file: "a.test.ts",
          status: "pass",
          durationMs: 2,
        },
  ],
});

const temporaryDirs: string[] = [];
function tempMetricDir(): string {
  const root = makeTempDir();
  temporaryDirs.push(root);
  const dir = join(root, "metric");
  mkdirSync(dir, { recursive: true });
  return dir;
}
afterEach(() => {
  for (const dir of temporaryDirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("per-test snapshot analytics", () => {
  it("stores and loads per-test results for every saved snapshot", () => {
    const dir = tempMetricDir();
    const a = "1".repeat(40);
    const b = "2".repeat(40);
    saveSnapshot(dir, a, metrics, testsWithResults(1));
    saveSnapshot(dir, b, metrics, testsWithResults(0));
    const history = readAggregatedHistory(dir, thresholds);
    expect(history).toHaveLength(2);
    const statuses = (h: (typeof history)[number]) =>
      (h.testResults ?? []).map((r) => [r.name, r.status, r.error] as const);
    expect(statuses(history[0])).toEqual([
      ["fails", "fail", "boom"],
      ["passes", "pass", undefined],
    ]);
    expect(statuses(history[1])).toEqual([
      ["fails-now-passes", "pass", undefined],
      ["passes", "pass", undefined],
    ]);
  });

  it("includes pending snapshot as latest labeled current", () => {
    const dir = tempMetricDir();
    saveSnapshot(dir, "3".repeat(40), metrics, testsWithResults(0));
    savePendingSnapshot(dir, metrics, testsWithResults(1));
    const history = readAggregatedHistory(dir, thresholds, {
      includePending: true,
    });
    expect(history).toHaveLength(2);
    expect(history[1].shortSha).toBe("current");
    expect(history[1].testResults?.find((r) => r.status === "fail")?.name).toBe(
      "fails",
    );
  });

  it("finalize moves pending per-test results to the commit", () => {
    const dir = tempMetricDir();
    savePendingSnapshot(dir, metrics, testsWithResults(1));
    finalizeSnapshot(dir, "4".repeat(40));
    const history = readAggregatedHistory(dir, thresholds);
    expect(history).toHaveLength(1);
    expect(history[0].commit).toBe("4".repeat(40));
    expect(history[0].testResults).toHaveLength(2);
  });

  it("report shows current and per-snapshot test details", () => {
    const dir = tempMetricDir();
    saveSnapshot(dir, "5".repeat(40), metrics, testsWithResults(0));
    savePendingSnapshot(dir, metrics, testsWithResults(1));
    const html = generateReport(dir);
    expect(html).toContain(">current<");
    expect(html).toContain("Test results (per snapshot)");
    expect(html).toContain("a.test.ts › suite › fails");
    expect(html).toContain("boom");
  });
});
