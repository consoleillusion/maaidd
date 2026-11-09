/**
 * Project + snapshot + iteration status shared by `maid status` and MCP
 * `status`. All sections reuse the same core payloads as their dedicated tools.
 */
import type { SnapshotPoint } from "./state.ts";
import { loadInsightState } from "./state.ts";
import { buildBenchmark } from "./benchmark.ts";
import { buildScore } from "./score.ts";
import { buildDependencies } from "./dependencies.ts";
import { buildCommitGuide } from "./commit.ts";

export interface StatusOptions {
  root?: string;
  sections?: string[];
  detail?: "summary" | "full";
}

const DEFAULT_SECTIONS = [
  "project",
  "snapshot",
  "git",
  "benchmark",
  "score",
  "dependencies",
  "commit",
];

const snapshotSummary = (point: SnapshotPoint | null) => {
  if (!point) return null;
  return {
    commit: point.commit,
    shortSha: point.shortSha,
    source: point.source,
    totalFiles: point.totalFiles,
    passing: point.passing,
    failing: point.failing,
    totalLines: point.totalLines,
    avgCyclo: point.avgCyclo,
    maxCyclo: point.maxCyclo,
    avgFtaScore: point.avgFtaScore,
    tests:
      point.testsTotal === null
        ? null
        : {
            total: point.testsTotal,
            passed: point.testsPassed,
            failed: point.testsFailed,
            skipped: point.testsSkipped,
          },
  };
};

export function getStatus(options: StatusOptions = {}) {
  const state = loadInsightState(options.root);
  const sections = options.sections?.length
    ? options.sections
    : DEFAULT_SECTIONS;
  const include = (section: string) => sections.includes(section);
  const detail = options.detail ?? "summary";
  const payload: Record<string, unknown> = {
    schemaVersion: 1,
    kind: "status",
    root: state.root,
    next: [] as string[],
  };

  let benchmark: ReturnType<typeof buildBenchmark> | null = null;
  const getBenchmarkSection = () =>
    (benchmark ??= buildBenchmark(state, {
      detail: detail === "full" ? "full" : "summary",
    }));
  let dependencies: ReturnType<typeof buildDependencies> | null = null;
  const getDependencySection = () =>
    (dependencies ??= buildDependencies(state, {
      detail: detail === "full" ? "full" : "summary",
    }));

  if (include("project")) {
    payload.project = {
      status: state.projectStatus.status,
      missing: state.projectStatus.missing,
      name: state.project?.name ?? null,
      goal: state.project?.goal ?? null,
      projectFile: "maid.project.json",
    };
  }
  if (include("snapshot")) {
    payload.snapshot = {
      pending: snapshotSummary(state.pending),
      head: snapshotSummary(state.head),
      current: snapshotSummary(state.current),
    };
  }
  if (include("git")) {
    payload.git = {
      isRepo: state.workingTree.isRepo,
      branch: state.workingTree.branch,
      head: state.workingTree.head,
      clean: state.workingTree.clean,
      files: detail === "full" ? state.workingTree.files : undefined,
      changedFiles: state.workingTree.files.length,
      addedLines: state.workingTree.added,
      removedLines: state.workingTree.removed,
      groups: state.workingTree.groups,
    };
  }
  if (include("benchmark")) {
    const result = getBenchmarkSection();
    payload.benchmark =
      detail === "full"
        ? result
        : {
            baselineRef: result.baselineRef,
            current: result.current,
            baseline: result.baseline,
            metrics: result.metrics,
            targets: result.targets,
            testCounts: result.tests.counts,
            next: result.next,
          };
  }
  if (include("score")) {
    const result = buildScore(state, {
      detail: detail === "full" ? "full" : "summary",
    });
    payload.score =
      detail === "full"
        ? result
        : {
            score: result.score,
            grade: result.grade,
            components: result.components,
            benchmark: result.benchmark,
            dependencies: result.dependencies,
            next: result.next,
          };
  }
  if (include("dependencies")) {
    const result = getDependencySection();
    payload.dependencies =
      detail === "full"
        ? result
        : {
            baseline: result.baseline,
            current: result.current,
            counts: result.counts,
            scoreDelta: result.scoreDelta,
            offset: result.offset,
            guidance: result.guidance,
          };
  }
  if (include("commit")) {
    const result = buildCommitGuide(state, {
      detail: detail === "full" ? "full" : "summary",
    });
    payload.commit =
      detail === "full"
        ? result
        : {
            clean: result.clean,
            counts: result.change.counts,
            ready: result.ready,
            blockers: result.blockers,
            warnings: result.warnings,
            suggestedMessage: result.suggestedMessage,
            next: result.next,
          };
  }

  const next: string[] = [];
  if (state.projectStatus.status !== "complete") {
    next.push(
      "Call project_init (MCP) or run `maid init` to complete project context.",
    );
  }
  if (!state.pending && !state.workingTree.clean) {
    next.push(
      "Capture a pending snapshot with `maid metrics --pending` before committing.",
    );
  }
  if (!state.current) {
    next.push(
      "No metric snapshot found; save one with `maid metrics --save` or `--pending`.",
    );
  }
  if (include("score") && !payload.score) {
    next.push("Run `maid score` for the composite iteration score.");
  }
  if (include("commit") && payload.commit) {
    const commit = payload.commit as { ready?: boolean };
    if (commit.ready === false) {
      next.push("Review `maid commit-guide` before committing.");
    }
  }
  payload.next = next;
  return payload;
}
