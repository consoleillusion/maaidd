/**
 * Commit guidance for small, intelligently iterative commits.
 *
 * Shared by `maid commit-guide` and the MCP `commit_guide` tool. It combines
 * the working tree, pending snapshot, tests, gate outcomes, dependency changes,
 * and configurable size limits into explicit blockers and suggestions.
 */
import { buildDependencies } from "./dependencies.ts";
import type { InsightState, WorkingTreeFile } from "./state.ts";
import { loadInsightState } from "./state.ts";
import { resolveCurrent } from "./compare.ts";

export interface CommitGuideOptions {
  root?: string;
  snapshot?: string;
  detail?: "summary" | "full";
}

interface Check {
  required: boolean;
  passed: boolean | null;
  message: string;
}

const check = (
  required: boolean,
  passed: boolean | null,
  message: string,
): Check => ({ required, passed, message });

const groupFiles = (files: WorkingTreeFile[]): Record<string, string[]> => {
  const groups: Record<string, string[]> = {};
  for (const file of files) {
    groups[file.group] = [...(groups[file.group] ?? []), file.path];
  }
  return groups;
};

const isDocs = (path: string): boolean =>
  path.endsWith(".md") || path.startsWith("docs/") || path === "README.md";

const isTest = (path: string): boolean =>
  /(^|\/)(spec|test|tests|__tests__)\//.test(path) ||
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(path);

const isAnalytics = (path: string): boolean =>
  /^maid\.db(?:-(?:wal|shm))?$/.test(path);

const manifestPaths = (manifests: string[]) => new Set(manifests);

const messageFor = (
  group: string,
  files: string[],
  manifests: Set<string>,
): string => {
  if (files.every((file) => manifests.has(file))) {
    return "chore(deps): update dependencies";
  }
  if (files.every(isAnalytics)) {
    return "chore: record analytics snapshot";
  }
  if (files.every(isDocs)) {
    return "docs: update documentation";
  }
  if (files.every(isTest)) {
    return "test: update tests";
  }
  if (group === "(root)") return "chore: update project files";
  return `feat(${group}): update ${group}`;
};

/** Build commit guidance from already-collected insight state. */
export function buildCommitGuide(
  state: InsightState,
  options: Omit<CommitGuideOptions, "root"> = {},
) {
  const config = state.config.insights.commit;
  const current = resolveCurrent(state, options.snapshot);
  const dependencies = buildDependencies(state, {
    snapshot: options.snapshot,
  });
  const files = state.workingTree.files;
  const changedLines = state.workingTree.added + state.workingTree.removed;
  const groups = groupFiles(files);
  const manifests = manifestPaths(state.config.insights.dependencies.manifests);
  const dependencyFiles = files.filter((file) => manifests.has(file.path));
  const nonDependencyFiles = files.filter(
    (file) => !manifests.has(file.path) && !isAnalytics(file.path),
  );

  const pending = check(
    config.requirePendingSnapshot,
    !config.requirePendingSnapshot || Boolean(state.pending),
    state.pending
      ? "Pending snapshot available for finalization."
      : "No pending snapshot captured.",
  );
  const tests = check(
    config.requireTestsPassing,
    !config.requireTestsPassing
      ? true
      : current?.testsTotal != null
        ? (current.testsFailed ?? 0) === 0
        : null,
    current?.testsTotal == null
      ? "No test data in the current snapshot."
      : `${current.testsPassed ?? 0}/${current.testsTotal} tests passing.`,
  );
  const gate = check(
    config.requireGatePassing,
    !config.requireGatePassing ? true : current ? current.failing === 0 : null,
    current
      ? `${current.passing}/${current.totalFiles} files pass gate thresholds.`
      : "No snapshot available to evaluate gate thresholds.",
  );
  const filesWithinLimit = files.length <= config.maxChangedFiles;
  const linesWithinLimit = changedLines <= config.maxChangedLines;
  const size = check(
    false,
    filesWithinLimit && linesWithinLimit,
    `${files.length}/${config.maxChangedFiles} files, ${changedLines}/${config.maxChangedLines} changed lines.`,
  );
  const dependencySeparate = check(
    false,
    !config.dependencyChangesSeparate ||
      dependencyFiles.length === 0 ||
      nonDependencyFiles.length === 0,
    dependencyFiles.length > 0 && nonDependencyFiles.length > 0
      ? "Dependency changes are mixed with other files."
      : "Dependency changes are isolated or absent.",
  );

  const checks = { pending, tests, gate, size, dependencySeparate };
  const blockers = Object.entries(checks)
    .filter(([, value]) => value.required && value.passed !== true)
    .map(([key]) => key);
  const warnings = Object.entries(checks)
    .filter(
      ([key, value]) =>
        !blockers.includes(key) &&
        value.passed !== null &&
        value.passed === false,
    )
    .map(([key]) => key);

  const suggestionMap = new Map<
    string,
    { message: string; files: string[]; priority: number }
  >();
  const addSuggestion = (
    key: string,
    message: string,
    priority: number,
    path: string,
  ) => {
    const existing = suggestionMap.get(key);
    if (existing) {
      existing.files.push(path);
      return;
    }
    suggestionMap.set(key, {
      message,
      files: [path],
      priority,
    });
  };
  for (const file of files) {
    if (manifests.has(file.path)) {
      addSuggestion(
        "dependencies",
        "chore(deps): update dependencies",
        0,
        file.path,
      );
    } else if (isAnalytics(file.path)) {
      addSuggestion(
        "analytics",
        "chore: record analytics snapshot",
        9,
        file.path,
      );
    } else if (isDocs(file.path)) {
      addSuggestion("docs", "docs: update documentation", 3, file.path);
    } else if (isTest(file.path)) {
      addSuggestion("tests", "test: update tests", 2, file.path);
    } else {
      addSuggestion(
        `code:${file.group}`,
        messageFor(file.group, [file.path], manifests),
        1,
        file.path,
      );
    }
  }
  const suggestions = [...suggestionMap.values()]
    .map((suggestion) => ({
      message: suggestion.message,
      files: suggestion.files.sort((a, b) => a.localeCompare(b)),
      count: suggestion.files.length,
      priority: suggestion.priority,
    }))
    .sort(
      (a, b) => a.priority - b.priority || a.message.localeCompare(b.message),
    )
    .map(({ priority: _priority, ...suggestion }) => suggestion);

  const ready =
    blockers.length === 0 &&
    files.length > 0 &&
    size.passed !== false &&
    dependencySeparate.passed !== false;
  const next: string[] = [];
  if (files.length === 0) {
    next.push("Working tree is clean; there is nothing to commit.");
  }
  if (config.requirePendingSnapshot && !state.pending) {
    next.push("Run `maid metrics --pending` before committing.");
  }
  const failedTests = tests.passed === false;
  if (failedTests) {
    next.push("Fix failing tests before committing.");
  }
  if (gate.passed === false) {
    next.push("Resolve gate violations before committing.");
  }
  if (!filesWithinLimit || !linesWithinLimit) {
    next.push(
      `Commit is larger than the configured limit; split into smaller commits.`,
    );
  }
  if (!dependencySeparate.passed) {
    next.push("Commit dependency manifest changes separately.");
  }
  if (ready && next.length === 0) {
    next.push(
      suggestions[0]
        ? `Ready to commit. Suggested: ${suggestions[0].message}`
        : "Ready to commit.",
    );
  }

  return {
    schemaVersion: 1,
    kind: "commit",
    root: state.root,
    branch: state.workingTree.branch,
    head: state.workingTree.head,
    clean: state.workingTree.clean,
    change: {
      files: options.detail === "full" ? files : files.map((file) => file.path),
      counts: {
        files: files.length,
        addedLines: state.workingTree.added,
        removedLines: state.workingTree.removed,
        changedLines,
      },
      groups,
    },
    snapshot: current
      ? {
          commit: current.commit,
          shortSha: current.shortSha,
          source: current.source,
        }
      : null,
    dependencies: {
      files: dependencyFiles.map((file) => file.path),
      added: dependencies.counts.added,
      removed: dependencies.counts.removed,
      changed: dependencies.counts.changed,
    },
    checks,
    blockers,
    warnings,
    ready,
    suggestions,
    suggestedMessage: suggestions[0]?.message ?? null,
    next,
  };
}

/** Collect state and produce commit guidance. */
export function getCommitGuide(options: CommitGuideOptions = {}) {
  return buildCommitGuide(loadInsightState(options.root), options);
}
