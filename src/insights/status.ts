/**
 * Project + snapshot status summary shared by `maid status` and MCP `status`.
 */
import type { SnapshotPoint } from "./state.ts";
import { loadInsightState } from "./state.ts";

export interface StatusOptions {
  root?: string;
  sections?: string[];
  detail?: "summary" | "full";
}

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
    : ["project", "snapshot", "git"];
  const include = (section: string) => sections.includes(section);
  const payload: Record<string, unknown> = {
    schemaVersion: 1,
    kind: "status",
    root: state.root,
    next: [] as string[],
  };
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
      files: options.detail === "full" ? state.workingTree.files : undefined,
      changedFiles: state.workingTree.files.length,
      addedLines: state.workingTree.added,
      removedLines: state.workingTree.removed,
      groups: state.workingTree.groups,
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
  payload.next = next;
  return payload;
}
