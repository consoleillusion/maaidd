/**
 * Composite commit score.
 *
 * Combines gate outcomes, FTA, cyclomatic complexity, tests, recent trend, and
 * dependency impact into one transparent 0-100 score. Shared by `maid score`
 * and the MCP `score` tool.
 */
import type { InsightScoreConfig } from "../types.ts";
import { buildBenchmark } from "./benchmark.ts";
import { buildDependencies } from "./dependencies.ts";
import type { InsightState } from "./state.ts";
import { loadInsightState } from "./state.ts";
import { passRate, resolveCurrent } from "./compare.ts";

export interface ScoreOptions {
  root?: string;
  baseline?: string;
  snapshot?: string;
  detail?: "summary" | "full";
}

interface Component {
  key: keyof InsightScoreConfig["weights"];
  weight: number;
  /** Normalized component score in [0, 1]. */
  value: number;
  points: number;
  source: string;
  missing: boolean;
}

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

const gradeFor = (score: number, grades: InsightScoreConfig["grades"]) => {
  if (score >= grades.A) return "A";
  if (score >= grades.B) return "B";
  if (score >= grades.C) return "C";
  if (score >= grades.D) return "D";
  return "F";
};

/** Build the composite score payload from already-collected insight state. */
export function buildScore(
  state: InsightState,
  options: Omit<ScoreOptions, "root"> = {},
) {
  const config = state.config.insights.score;
  const current = resolveCurrent(state, options.snapshot);
  const benchmark = buildBenchmark(state, options);
  const dependencies = buildDependencies(state, options);
  const missing = config.missingDataCredit;
  const components: Component[] = [];

  const add = (
    key: keyof InsightScoreConfig["weights"],
    value: number | null,
    source: string,
  ) => {
    const weight = config.weights[key];
    const isMissing = value === null;
    const normalized = clamp(isMissing ? missing : value);
    components.push({
      key,
      weight,
      value: normalized,
      points: normalized * weight,
      source,
      missing: isMissing,
    });
  };

  const totalFiles = current?.totalFiles ?? 0;
  add(
    "gate",
    totalFiles > 0 ? (current?.passing ?? 0) / totalFiles : null,
    "snapshot files passing configured FTA gate thresholds",
  );
  add(
    "fta",
    current ? clamp(current.avgFtaScore / 100) : null,
    "average FTA score (0-100)",
  );
  const maxCyclomatic = state.config.metrics.thresholds.maxCyclomatic;
  add(
    "complexity",
    current && maxCyclomatic > 0
      ? clamp(1 - current.avgCyclo / maxCyclomatic)
      : null,
    `average cyclomatic complexity relative to max ${maxCyclomatic}`,
  );
  add("tests", passRate(current), "test pass rate");
  const checks = Object.values(benchmark.metrics).filter(
    (metric) => metric.passed !== null,
  );
  add(
    "trend",
    checks.length > 0
      ? checks.filter((metric) => metric.passed).length / checks.length
      : null,
    "benchmark targets met versus the baseline",
  );
  add(
    "dependencies",
    dependencies.baseline
      ? clamp(
          dependencies.scoreDelta >= 0 ? 1 : 1 + dependencies.scoreDelta / 20,
        )
      : null,
    "dependency additions/removals (negative deltas reduce the component)",
  );

  const totalWeight = components.reduce(
    (sum, component) => sum + component.weight,
    0,
  );
  const rawScore =
    totalWeight > 0
      ? components.reduce((sum, component) => sum + component.points, 0) /
        totalWeight
      : 0;
  const score = Math.round(rawScore * 1000) / 10;
  const grade = gradeFor(score, config.grades);
  const next: string[] = [];
  if (!current) {
    next.push(
      "No snapshot available; capture one before relying on the score.",
    );
  }
  for (const metric of benchmark.targets.failed) {
    next.push(`Improve benchmark metric: ${metric}.`);
  }
  if (dependencies.scoreDelta < 0) {
    next.push(
      `Dependency changes reduce the score by ${Math.abs(dependencies.scoreDelta)} points; offset them with LOC or complexity reductions.`,
    );
  }
  if (grade === "D" || grade === "F") {
    next.push(
      "Prefer small, focused iterations: fix tests and gate violations before adding scope.",
    );
  }
  return {
    schemaVersion: 1,
    kind: "score",
    root: state.root,
    snapshot: current
      ? {
          commit: current.commit,
          shortSha: current.shortSha,
          source: current.source,
        }
      : null,
    score,
    grade,
    components,
    weights: config.weights,
    grades: config.grades,
    benchmark: {
      passed: benchmark.targets.passed,
      failed: benchmark.targets.failed,
    },
    dependencies: {
      scoreDelta: dependencies.scoreDelta,
      added: dependencies.counts.added,
      removed: dependencies.counts.removed,
      changed: dependencies.counts.changed,
    },
    next,
  };
}

/** Collect state and compute the composite score. */
export function getScore(options: ScoreOptions = {}) {
  return buildScore(loadInsightState(options.root), options);
}
