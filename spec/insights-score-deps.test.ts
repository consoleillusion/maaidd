import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDependencies } from "../src/insights/dependencies.ts";
import { getScore } from "../src/insights/score.ts";
import { savePendingSnapshot, saveSnapshot } from "../src/metrics/store.ts";
import type { FtaFileMetric } from "../src/metrics/fta.ts";
import type { TestRunSummary } from "../src/metrics/test-runner.ts";
import { runCli } from "./test-utils.ts";

const metric = (lineCount: number, cyclo = 4): FtaFileMetric => ({
  file_name: "src/a.ts",
  cyclo,
  fta_score: 80,
  assessment: "OK",
  line_count: lineCount,
  halstead: { bugs: 0.05 },
});

const tests: TestRunSummary = {
  command: "bun test",
  total: 2,
  passed: 2,
  failed: 0,
  skipped: 0,
  todo: 0,
  exitCode: 0,
};

const git = (dir: string, args: string[]): string =>
  execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), "maid-score-"));
  writeFileSync(join(dir, "maid.config.json"), "{}\n", "utf8");
  const manifest = {
    name: "fixture",
    dependencies: { left: "^1.0.0" },
    devDependencies: { old: "^1.0.0" },
  };
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(manifest)}\n`);
  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "baseline"]);
  const baseline = git(dir, ["rev-parse", "HEAD"]);
  saveSnapshot(dir, baseline, [metric(120)], tests);
  const updated = {
    name: "fixture",
    dependencies: { left: "^1.0.0", right: "^2.0.0" },
    devDependencies: {},
  };
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(updated)}\n`);
  savePendingSnapshot(dir, [metric(100)], tests);
  return { dir, baseline };
};

describe("dependency guidance", () => {
  it("reports additions, removals, and a transparent score delta", () => {
    const { dir, baseline } = setup();
    try {
      const payload = getDependencies({ root: dir });
      expect(payload.kind).toBe("dependencies");
      expect(payload.baseline?.commit).toBe(baseline);
      expect(payload.changes.added.map((entry) => entry.name)).toEqual([
        "right",
      ]);
      expect(payload.changes.added[0].scope).toBe("runtime");
      expect(payload.changes.removed.map((entry) => entry.name)).toEqual([
        "old",
      ]);
      expect(payload.changes.removed[0].bonus).toBe(1);
      // +1 removal, -5 runtime add, +2 offset for 20 fewer LOC.
      expect(payload.scoreDelta).toBe(-2);
      expect(payload.offset.applied).toBe(true);
      expect(payload.guidance.join(" ")).toContain("right");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prints the same payload from the CLI", () => {
    const { dir } = setup();
    try {
      const result = runCli(["dependencies"], { cwd: dir });
      expect(result.status).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload.kind).toBe("dependencies");
      expect(payload.counts.added).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("composite score", () => {
  it("combines weighted components into a transparent score", () => {
    const { dir } = setup();
    try {
      const payload = getScore({ root: dir });
      expect(payload.kind).toBe("score");
      expect(payload.score).toBeGreaterThan(0);
      expect(["A", "B", "C", "D", "F"]).toContain(payload.grade);
      expect(payload.components.map((component) => component.key)).toEqual([
        "gate",
        "fta",
        "complexity",
        "tests",
        "trend",
        "dependencies",
      ]);
      const dependency = payload.components.find(
        (component) => component.key === "dependencies",
      );
      expect(dependency?.missing).toBe(false);
      expect(dependency?.value).toBeCloseTo(0.9);
      expect(payload.dependencies.scoreDelta).toBe(-2);
      expect(payload.next.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prints the same payload from the CLI in toon format", () => {
    const { dir } = setup();
    try {
      const result = runCli(["score", "--format", "toon"], { cwd: dir });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("score");
      expect(result.stdout).toContain("grade");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
