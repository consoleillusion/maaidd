import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { saveSnapshot } from "../src/metrics/history.ts";
import { generateReport } from "../src/metrics/report.ts";
import type { TestRunSummary } from "../src/metrics/test-runner.ts";
import { makeTempDir } from "./test-utils.ts";

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

const fta = [
  { file_name: "a.ts", cyclo: 4, fta_score: 80, assessment: "OK", line_count: 120 },
  { file_name: "b.ts", cyclo: 8, fta_score: 60, assessment: "OK", line_count: 80 },
];
const firstTests: TestRunSummary = {
  command: "bun run test",
  total: 8,
  passed: 7,
  failed: 1,
  skipped: 0,
  todo: 0,
  exitCode: 1,
};
const secondTests: TestRunSummary = {
  ...firstTests,
  total: 10,
  passed: 10,
  failed: 0,
  exitCode: 0,
};

function payload(html: string): any {
  const match = /const payload = (.*);\nconst labels = payload\.labels;/.exec(html);
  expect(match).not.toBeNull();
  return JSON.parse(match![1]);
}

describe("uPlot commit history", () => {
  it("charts tests, lines of code, and FTA measures for each commit", () => {
    const dir = tempMetricDir();
    const first = "a".repeat(40);
    const second = "b".repeat(40);
    saveSnapshot(dir, second, fta, secondTests);
    saveSnapshot(dir, first, fta, firstTests);

    const html = generateReport(dir);
    const data = payload(html);
    expect(data.labels).toEqual([first.slice(0, 8), second.slice(0, 8)]);
    expect(data.x).toEqual([0, 1]);
    expect(data.series.map((s: any) => s.label)).toEqual(
      expect.arrayContaining([
        "Tests",
        "Passing tests",
        "Failing tests",
        "Lines of code",
        "Avg cyclo",
        "Max cyclo",
        "Avg FTA score",
        "Avg Halstead difficulty",
        "Avg Halstead volume",
        "Halstead bugs",
      ]),
    );

    const valuesFor = (label: string) => {
      const index = data.series.findIndex((s: any) => s.label === label);
      return data.values[index];
    };
    expect(valuesFor("Tests")).toEqual([8, 10]);
    expect(valuesFor("Passing tests")).toEqual([7, 10]);
    expect(valuesFor("Failing tests")).toEqual([1, 0]);
    expect(valuesFor("Lines of code")).toEqual([200, 200]);
    expect(valuesFor("Avg cyclo")).toEqual([6, 6]);
    expect(valuesFor("Max cyclo")).toEqual([8, 8]);
    expect(valuesFor("Avg FTA score")).toEqual([70, 70]);

    expect(html).toContain("new uPlot(opts, chartData");
    expect(html).toContain("splits.map((i) => labels[i]");
    expect(html).toContain("width: 2");
    expect(html).toContain(`${first.slice(0, 8)}</td><td>7 / 8</td><td>1</td>`);
  });

  it("uses gaps rather than zero test passes for legacy FTA-only snapshots", () => {
    const dir = tempMetricDir();
    writeFileSync(join(dir, `${"c".repeat(40)}.json`), JSON.stringify(fta));

    const data = payload(generateReport(dir));
    const index = data.series.findIndex((s: any) => s.label === "Passing tests");
    expect(data.values[index]).toEqual([null]);
  });

  it("returns valid HTML when there is no snapshot history", () => {
    const html = generateReport(tempMetricDir());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("No metric history found");
  });
});
