import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  aggregateSnapshot,
  finalizeSnapshot,
  readAggregatedHistory,
  readHistory,
  savePendingSnapshot,
  saveSnapshot,
} from "../src/metrics/history.ts";
import type { FtaFileMetric } from "../src/metrics/fta.ts";
import type { TestRunSummary } from "../src/metrics/test-runner.ts";
import { makeTempDir } from "./test-utils.ts";

const thresholds = { maxCyclomatic: 20, minFtaScore: 50 };
const metrics: FtaFileMetric[] = [
  {
    file_name: "a.ts",
    cyclo: 5,
    fta_score: 70,
    assessment: "OK",
    line_count: 100,
    halstead: { volume: 200, difficulty: 4, bugs: 0.2 },
  },
  {
    file_name: "b.ts",
    cyclo: 25,
    fta_score: 30,
    assessment: "Needs improvement",
    line_count: 50,
    halstead: { volume: 100, difficulty: 8, bugs: 0.1 },
  },
];
const tests: TestRunSummary = {
  command: "bun run test",
  total: 8,
  passed: 7,
  failed: 1,
  skipped: 0,
  todo: 0,
  exitCode: 1,
};

const temporaryDirs: string[] = [];
function tempMetricDir(): string {
  const root = makeTempDir();
  temporaryDirs.push(root);
  const dir = join(root, "metric");
  mkdirSync(dir, { recursive: true });
  return dir;
}
afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("commit snapshots (SQLite store)", () => {
  it("stores FTA metrics and actual test counts under the commit SHA", () => {
    const dir = tempMetricDir();
    const sha = "a".repeat(40);
    const path = saveSnapshot(dir, sha, metrics, tests);

    expect(path).toContain("maaidd.db");
    expect(path).toContain(sha);
    expect(existsSync(join(dir, "maaidd.db"))).toBe(true);

    const [entry] = readHistory(dir);
    expect(entry.commit).toBe(sha);
    expect(entry.tests?.passed).toBe(7);
    expect(entry.tests?.failed).toBe(1);
    expect(entry.metrics).toHaveLength(2);
    expect(entry.total).toBe(2);
  });

  it("protects existing snapshots unless replacement is explicit", () => {
    const dir = tempMetricDir();
    const sha = "b".repeat(40);
    saveSnapshot(dir, sha, metrics, tests);

    expect(() => saveSnapshot(dir, sha, metrics, tests)).toThrow(
      /already exists/,
    );
    expect(() =>
      saveSnapshot(dir, sha, [], tests, { force: true }),
    ).not.toThrow();
    expect(readHistory(dir)[0].metrics).toHaveLength(0);
  });

  it("finalizes a pending snapshot under the new commit and removes pending state", () => {
    const dir = tempMetricDir();
    const sha = "c".repeat(40);
    savePendingSnapshot(dir, metrics, tests);

    expect(readHistory(dir)).toHaveLength(0);
    expect(() => finalizeSnapshot(dir, sha)).not.toThrow();
    expect(readHistory(dir)).toHaveLength(1);

    const [entry] = readHistory(dir);
    expect(entry.commit).toBe(sha);
    expect(entry.tests?.passed).toBe(7);
    expect(entry.metrics).toHaveLength(2);
    expect(() => finalizeSnapshot(dir, "d".repeat(40))).toThrow(
      /No pending metric snapshot/,
    );
  });

  it("requires a pending document when finalizing", () => {
    const dir = tempMetricDir();
    expect(() => finalizeSnapshot(dir, "d".repeat(40))).toThrow(
      /No pending metric snapshot/,
    );
  });

  it("reads legacy FTA arrays and skips unrelated or malformed files (auto-import)", () => {
    const dir = tempMetricDir();
    const currentSha = "e".repeat(40);
    const legacySha = "f".repeat(40);
    saveSnapshot(dir, currentSha, metrics, tests);
    writeFileSync(join(dir, `${legacySha}.json`), JSON.stringify(metrics));
    writeFileSync(join(dir, `${"1".repeat(40)}.json`), "{broken");
    writeFileSync(join(dir, "notes.json"), "{}");

    const entries = readHistory(dir);
    expect(entries.map((entry) => entry.commit)).toEqual(
      [currentSha, legacySha].sort(),
    );
    const legacy = entries.find((entry) => entry.commit === legacySha);
    expect(legacy?.tests).toBeNull();
    expect(legacy?.metrics).toHaveLength(2);
  });
});

describe("snapshot aggregation", () => {
  it("keeps test-runner counts separate from FTA gate file counts", () => {
    const aggregate = aggregateSnapshot(metrics, thresholds, tests);
    expect(aggregate.passing).toBe(1);
    expect(aggregate.failing).toBe(1);
    expect(aggregate.testsTotal).toBe(8);
    expect(aggregate.testsPassed).toBe(7);
    expect(aggregate.testsFailed).toBe(1);
    expect(aggregate.totalLines).toBe(150);
    expect(aggregate.avgHalsteadVolume).toBe(150);
    expect(aggregate.totalHalsteadBugs).toBeCloseTo(0.3);
  });

  it("uses null test values for legacy snapshots and aggregates all FTA series", () => {
    const dir = tempMetricDir();
    const sha = "2".repeat(40);
    writeFileSync(join(dir, `${sha}.json`), JSON.stringify(metrics));

    const [aggregate] = readAggregatedHistory(dir, thresholds);
    expect(aggregate.commit).toBe(sha);
    expect(aggregate.shortSha).toBe(sha.slice(0, 8));
    expect(aggregate.testsTotal).toBeNull();
    expect(aggregate.testsPassed).toBeNull();
    expect(aggregate.avgCyclo).toBe(15);
    expect(aggregate.maxCyclo).toBe(25);
    expect(aggregate.avgFtaScore).toBe(50);
  });
});
