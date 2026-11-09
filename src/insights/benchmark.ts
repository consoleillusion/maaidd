/**
 * Benchmark the current snapshot against a baseline and configured targets.
 *
 * Shared by `maid benchmark` and the MCP `benchmark` tool. Inputs and payloads
 * are identical; only the transport differs.
 */
import type { InsightsConfig } from "../types.ts";
import type { InsightState, SnapshotPoint } from "./state.ts";
import { loadInsightState } from "./state.ts";
import {
  delta,
  passRate,
  resolveBaseline,
  resolveCurrent,
  round,
} from "./compare.ts";

export interface BenchmarkOptions {
  root?: string;
  baseline?: string;
  snapshot?: string;
  detail?: "summary" | "full";
}

interface Comparison {
  current: number | null;
  baseline: number | null;
  delta: number | null;
  target: number | null;
  tolerance: number;
  passed: boolean | null;
}

interface TestComparison {
  passRate: Comparison;
  total: Comparison;
  fixed: string[];
  broken: string[];
  added: string[];
  removed: string[];
}

const comparison = (
  current: number | null,
  baseline: number | null,
  target: number | null,
  tolerance: number,
  direction: "min" | "max" | "none",
): Comparison => {
  const value = delta(current, baseline);
  let passed: boolean | null = null;
  if (target !== null && value !== null) {
    passed =
      direction === "min"
        ? value >= target - tolerance
        : direction === "max"
          ? value <= target + tolerance
          : null;
  }
  return {
    current,
    baseline,
    delta: value,
    target,
    tolerance,
    passed,
  };
};

const testKey = (suite: string, name: string): string =>
  suite ? `${suite} :: ${name}` : name;

const compareTests = (
  current: SnapshotPoint | null,
  baseline: SnapshotPoint | null,
  config: InsightsConfig,
): TestComparison => {
  const tolerance = config.benchmark.tolerance.testsPassRate;
  const currentRate = passRate(current);
  const baselineRate = passRate(baseline);
  const target = config.benchmark.targets.minTestPassRate;
  const rateComparison: Comparison = {
    current: currentRate,
    baseline: baselineRate,
    delta: delta(currentRate, baselineRate),
    target,
    tolerance,
    passed: currentRate === null ? null : currentRate >= target - tolerance,
  };
  const countComparison = (
    currentValue: number | null,
    baselineValue: number | null,
  ): Comparison => ({
    current: currentValue,
    baseline: baselineValue,
    delta: delta(currentValue, baselineValue),
    target: null,
    tolerance: 0,
    passed: null,
  });
  const fixed: string[] = [];
  const broken: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  if (current?.testResults && baseline?.testResults) {
    const currentResults = new Map(
      current.testResults.map((test) => [
        testKey(test.suite, test.name),
        test.status,
      ]),
    );
    const baselineResults = new Map(
      baseline.testResults.map((test) => [
        testKey(test.suite, test.name),
        test.status,
      ]),
    );
    for (const [key, status] of currentResults) {
      const before = baselineResults.get(key);
      if (before === undefined) {
        added.push(key);
      } else if (before === "fail" && status === "pass") {
        fixed.push(key);
      } else if (before === "pass" && status === "fail") {
        broken.push(key);
      }
    }
    for (const key of baselineResults.keys()) {
      if (!currentResults.has(key)) removed.push(key);
    }
  }
  const sort = (values: string[]) => values.sort((a, b) => a.localeCompare(b));
  return {
    passRate: rateComparison,
    total: countComparison(
      current?.testsTotal ?? null,
      baseline?.testsTotal ?? null,
    ),
    fixed: sort(fixed),
    broken: sort(broken),
    added: sort(added),
    removed: sort(removed),
  };
};

const trendFor = (
  history: SnapshotPoint[],
  window: number,
  value: (point: SnapshotPoint) => number | null,
) => {
  const points = history
    .slice(-window)
    .map((point) => ({ commit: point.shortSha, value: value(point) }))
    .filter((point) => point.value !== null);
  if (points.length < 2) {
    return { direction: "flat" as const, points };
  }
  const first = points[0].value!;
  const last = points[points.length - 1].value!;
  const difference = last - first;
  return {
    direction:
      Math.abs(difference) < 1e-9
        ? ("flat" as const)
        : difference > 0
          ? ("up" as const)
          : ("down" as const),
    points,
  };
};

const summaryPoint = (point: SnapshotPoint | null) => {
  if (!point) return null;
  return {
    commit: point.commit,
    shortSha: point.shortSha,
    source: point.source,
    tests: {
      total: point.testsTotal,
      passed: point.testsPassed,
      failed: point.testsFailed,
      skipped: point.testsSkipped,
      passRate: passRate(point),
    },
    metrics: {
      totalFiles: point.totalFiles,
      totalLines: point.totalLines,
      avgCyclomatic: point.avgCyclo,
      maxCyclomatic: point.maxCyclo,
      avgFtaScore: point.avgFtaScore,
      halsteadBugs: point.totalHalsteadBugs,
    },
  };
};

/** Build the benchmark payload from already-collected insight state. */
export function buildBenchmark(
  state: InsightState,
  options: Omit<BenchmarkOptions, "root"> = {},
) {
  const config = state.config.insights;
  const current = resolveCurrent(state, options.snapshot);
  const baseline = resolveBaseline(
    state,
    current,
    options.baseline,
    config.benchmark.baseline,
  );
  const targets = config.benchmark.targets;
  const tolerance = config.benchmark.tolerance;
  const tests = compareTests(current, baseline, config);
  const metrics = {
    testPassRate: tests.passRate,
    avgFtaScore: comparison(
      current?.avgFtaScore ?? null,
      baseline?.avgFtaScore ?? null,
      targets.minAvgFtaScoreDelta,
      tolerance.avgFtaScore,
      "min",
    ),
    avgCyclomatic: comparison(
      current?.avgCyclo ?? null,
      baseline?.avgCyclo ?? null,
      targets.maxCyclomaticDelta,
      tolerance.avgCyclomatic,
      "max",
    ),
    halsteadBugs: comparison(
      current?.totalHalsteadBugs ?? null,
      baseline?.totalHalsteadBugs ?? null,
      targets.maxHalsteadBugsDelta,
      tolerance.halsteadBugs,
      "max",
    ),
    totalLines: comparison(
      current?.totalLines ?? null,
      baseline?.totalLines ?? null,
      targets.maxTotalLinesDelta,
      tolerance.totalLines,
      "max",
    ),
  };
  const checks = Object.entries(metrics)
    .filter(([, value]) => value.passed !== null)
    .map(([key, value]) => ({ metric: key, passed: value.passed === true }));
  const failed = checks.filter((check) => !check.passed).map((c) => c.metric);
  const detail = options.detail ?? "summary";
  const trend = {
    window: 5,
    avgFtaScore: trendFor(state.history, 5, (point) => point.avgFtaScore),
    avgCyclomatic: trendFor(state.history, 5, (point) => point.avgCyclo),
    totalLines: trendFor(state.history, 5, (point) => point.totalLines),
    testPassRate: trendFor(state.history, 5, (point) => passRate(point)),
  };
  const next: string[] = [];
  if (!current) {
    next.push(
      "No current snapshot; capture one with `maid metrics --pending` or `--save`.",
    );
  }
  if (!baseline) {
    next.push("No baseline snapshot; commit history is required to benchmark.");
  }
  for (const metric of failed) {
    next.push(`Benchmark target not met: ${metric}.`);
  }
  if (tests.broken.length > 0) {
    next.push(
      `Fix newly failing tests: ${tests.broken.slice(0, 5).join(", ")}.`,
    );
  }
  return {
    schemaVersion: 1,
    kind: "benchmark",
    root: state.root,
    baselineRef: options.baseline ?? config.benchmark.baseline,
    current: summaryPoint(current),
    baseline: summaryPoint(baseline),
    metrics,
    tests: {
      passRate: tests.passRate,
      total: tests.total,
      fixed: detail === "full" ? tests.fixed : tests.fixed.slice(0, 10),
      broken: detail === "full" ? tests.broken : tests.broken.slice(0, 10),
      added: detail === "full" ? tests.added : tests.added.slice(0, 10),
      removed: detail === "full" ? tests.removed : tests.removed.slice(0, 10),
      counts: {
        fixed: tests.fixed.length,
        broken: tests.broken.length,
        added: tests.added.length,
        removed: tests.removed.length,
      },
    },
    targets: {
      passed: failed.length === 0,
      failed,
    },
    trend,
    next,
  };
}

/** Collect state and benchmark it. */
export function getBenchmark(options: BenchmarkOptions = {}) {
  return buildBenchmark(loadInsightState(options.root), options);
}
