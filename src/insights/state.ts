/**
 * Shared state collection for insight tools.
 *
 * All CLI and MCP surfaces build on this module so they observe the same
 * snapshots, git state, project context, and resolved config.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { loadConfig } from "../config.ts";
import {
  aggregateSnapshot,
  currentCommit,
  readHistory,
  type HistoryEntry,
  type SnapshotAggregate,
} from "../metrics/store.ts";
import {
  findProjectRoot,
  loadProject,
  projectStatus,
  type ProjectContext,
  type ProjectStatusResult,
} from "../project.ts";
import type { MaidConfig } from "../types.ts";

export type SnapshotSource = "pending" | "head" | "history" | "live" | "none";

export interface SnapshotPoint extends SnapshotAggregate {
  source: SnapshotSource;
  hasTests: boolean;
}

export interface WorkingTreeFile {
  path: string;
  status: string;
  added: number | null;
  removed: number | null;
  group: string;
}

export interface WorkingTreeState {
  isRepo: boolean;
  branch: string;
  head: string | null;
  clean: boolean;
  files: WorkingTreeFile[];
  added: number;
  removed: number;
  groups: Record<string, number>;
}

export interface InsightState {
  root: string;
  config: MaidConfig;
  project: ProjectContext | null;
  projectStatus: ProjectStatusResult;
  history: SnapshotPoint[];
  pending: SnapshotPoint | null;
  head: SnapshotPoint | null;
  current: SnapshotPoint | null;
  workingTree: WorkingTreeState;
}

const git = (root: string, args: string[]): string | null => {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

const groupOf = (path: string): string => {
  const parts = path.split("/").filter(Boolean);
  return parts.length > 1 ? parts[0] : "(root)";
};

const parseNumstat = (
  root: string,
): Map<string, { added: number; removed: number }> => {
  const result = new Map<string, { added: number; removed: number }>();
  const out = git(root, ["diff", "--numstat", "HEAD", "--"]);
  if (!out) return result;
  for (const line of out.split("\n")) {
    const [added, removed, ...rest] = line.split("\t");
    const path = rest.join("\t");
    if (!path) continue;
    result.set(path, {
      added: Number.isFinite(Number(added)) ? Number(added) : 0,
      removed: Number.isFinite(Number(removed)) ? Number(removed) : 0,
    });
  }
  return result;
};

/** Read tracked, staged, and untracked working-tree changes. */
export function readWorkingTree(root: string): WorkingTreeState {
  const status = git(root, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]) ?? "";
  const head = git(root, ["rev-parse", "HEAD"]);
  if (status === null) {
    return {
      isRepo: false,
      branch,
      head,
      clean: true,
      files: [],
      added: 0,
      removed: 0,
      groups: {},
    };
  }
  const numstat = parseNumstat(root);
  const files: WorkingTreeFile[] = [];
  for (const raw of status.split("\n").filter(Boolean)) {
    const code = raw.slice(0, 2);
    let path = raw.slice(3).trim();
    const rename = path.match(/^(.+?) -> (.+)$/);
    if (rename) path = rename[2];
    const stats = numstat.get(path);
    files.push({
      path,
      status: code,
      added: stats?.added ?? null,
      removed: stats?.removed ?? null,
      group: groupOf(path),
    });
  }
  const groups: Record<string, number> = {};
  for (const file of files) {
    groups[file.group] = (groups[file.group] ?? 0) + 1;
  }
  return {
    isRepo: true,
    branch,
    head,
    clean: files.length === 0,
    files,
    added: files.reduce((sum, file) => sum + (file.added ?? 0), 0),
    removed: files.reduce((sum, file) => sum + (file.removed ?? 0), 0),
    groups,
  };
}

const point = (
  entry: HistoryEntry,
  config: MaidConfig,
  source: SnapshotSource,
): SnapshotPoint => {
  const aggregate = aggregateSnapshot(
    entry.metrics,
    config.metrics.thresholds,
    entry.tests,
  );
  return {
    ...aggregate,
    commit: entry.commit,
    shortSha:
      (entry as HistoryEntry & { shortSha?: string }).shortSha ??
      entry.commit.slice(0, 8),
    timestamp: entry.timestamp,
    source,
    hasTests: entry.tests?.total !== null && entry.tests?.total !== undefined,
    ...(entry.tests?.results?.length
      ? { testResults: entry.tests.results }
      : {}),
  };
};

const sameCommit = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
};

/** Load all snapshots and resolve pending/HEAD/current points. */
export function loadSnapshots(
  root: string,
  config: MaidConfig,
): {
  history: SnapshotPoint[];
  pending: SnapshotPoint | null;
  head: SnapshotPoint | null;
  current: SnapshotPoint | null;
} {
  const entries = readHistory(root, { includePending: true });
  const history: SnapshotPoint[] = [];
  let pending: SnapshotPoint | null = null;
  for (const entry of entries) {
    const shortSha = (entry as HistoryEntry & { shortSha?: string }).shortSha;
    if (shortSha === "current" || entry.commit.startsWith("__")) {
      pending = point(entry, config, "pending");
    } else {
      history.push(point(entry, config, "history"));
    }
  }
  let headSha: string | null = null;
  try {
    headSha = currentCommit(root);
  } catch {}
  const head = headSha
    ? (history.find((entry) => sameCommit(entry.commit, headSha!)) ?? null)
    : null;
  const current = pending ?? head ?? history.at(-1) ?? null;
  return { history, pending, head, current };
}

/** Collect the complete state used by status, score, dependency, and commit tools. */
export function loadInsightState(root = findProjectRoot()): InsightState {
  const abs = findProjectRoot(root);
  const config = loadConfig(join(abs, "maid.config.json"));
  const project = loadProject(abs);
  const snapshots = loadSnapshots(abs, config);
  return {
    root: abs,
    config,
    project,
    projectStatus: projectStatus(project),
    ...snapshots,
    workingTree: readWorkingTree(abs),
  };
}
