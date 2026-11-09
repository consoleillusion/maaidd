/**
 * Dependency/library guidance.
 *
 * Compares dependency manifests between the current project state and a
 * baseline commit, then converts additions/removals into a transparent score
 * delta and guidance. Starts with `package.json` behind an extensible manifest
 * adapter.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { InsightDependencyConfig } from "../types.ts";
import type { InsightState } from "./state.ts";
import { loadInsightState } from "./state.ts";
import { delta, resolveBaseline, resolveCurrent } from "./compare.ts";

export type DependencyScope = "runtime" | "dev" | "optional" | "peer";

export interface DependencyChange {
  name: string;
  scope: DependencyScope;
  version: string;
}

export interface DependencyOptions {
  root?: string;
  baseline?: string;
  snapshot?: string;
  detail?: "summary" | "full";
}

interface ManifestAdapter {
  path: string;
  scopes: Record<DependencyScope, string>;
}

const ADAPTERS: Record<string, ManifestAdapter> = {
  "package.json": {
    path: "package.json",
    scopes: {
      runtime: "dependencies",
      dev: "devDependencies",
      optional: "optionalDependencies",
      peer: "peerDependencies",
    },
  },
};

const scopeOrder: DependencyScope[] = ["runtime", "dev", "optional", "peer"];

const gitShow = (root: string, commit: string, path: string): string | null => {
  try {
    return execFileSync("git", ["show", `${commit}:${path}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
};

const readCurrentManifest = (
  root: string,
  manifest: string,
  head: string | null,
): string | null => {
  const file = join(root, manifest);
  if (existsSync(file)) return readFileSync(file, "utf8");
  return head ? gitShow(root, head, manifest) : null;
};

const parseManifest = (
  text: string | null,
  adapter: ManifestAdapter,
): Record<DependencyScope, Record<string, string>> => {
  const empty: Record<DependencyScope, Record<string, string>> = {
    runtime: {},
    dev: {},
    optional: {},
    peer: {},
  };
  if (!text) return empty;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return empty;
  }
  if (typeof parsed !== "object" || parsed === null) return empty;
  const record = parsed as Record<string, unknown>;
  for (const scope of scopeOrder) {
    const value = record[adapter.scopes[scope]];
    if (typeof value !== "object" || value === null) continue;
    for (const [name, version] of Object.entries(
      value as Record<string, unknown>,
    )) {
      empty[scope][name] =
        typeof version === "string" ? version : String(version);
    }
  }
  return empty;
};

const isAllowed = (name: string, config: InsightDependencyConfig): boolean =>
  config.allow.some(
    (allowed) => name === allowed || name.startsWith(`${allowed}/`),
  );

const isDenied = (name: string, config: InsightDependencyConfig): boolean =>
  config.deny.some(
    (denied) => name === denied || name.startsWith(`${denied}/`),
  );

const penaltyFor = (
  name: string,
  scope: DependencyScope,
  config: InsightDependencyConfig,
): number => {
  const base = config.penalties[scope];
  if (isDenied(name, config)) return base * 2;
  if (isAllowed(name, config)) return base / 2;
  return base;
};

const bonusFor = (
  scope: DependencyScope,
  config: InsightDependencyConfig,
): number => config.removalBonuses[scope];

/** Analyze dependency changes from the current state against a baseline. */
export function buildDependencies(
  state: InsightState,
  options: Omit<DependencyOptions, "root"> = {},
) {
  const config = state.config.insights.dependencies;
  const current = resolveCurrent(state, options.snapshot);
  const baseline = resolveBaseline(
    state,
    current,
    options.baseline,
    state.config.insights.benchmark.baseline,
  );
  const adapters = config.manifests
    .map((manifest) => ADAPTERS[manifest])
    .filter((adapter): adapter is ManifestAdapter => Boolean(adapter));

  const added: (DependencyChange & {
    allowed: boolean;
    denied: boolean;
    penalty: number;
  })[] = [];
  const removed: (DependencyChange & { bonus: number })[] = [];
  const changed: {
    name: string;
    scope: DependencyScope;
    from: string;
    to: string;
  }[] = [];
  const manifests: {
    path: string;
    present: boolean;
    counts: Record<DependencyScope, number>;
  }[] = [];

  for (const adapter of adapters) {
    const afterText = readCurrentManifest(
      state.root,
      adapter.path,
      state.workingTree.head,
    );
    const before = parseManifest(
      baseline ? gitShow(state.root, baseline.commit, adapter.path) : afterText,
      adapter,
    );
    const after = parseManifest(afterText, adapter);
    for (const scope of scopeOrder) {
      for (const [name, version] of Object.entries(after[scope])) {
        const previous = before[scope][name];
        if (previous === undefined) {
          const allowed = isAllowed(name, config);
          const denied = isDenied(name, config);
          added.push({
            name,
            scope,
            version,
            allowed,
            denied,
            penalty: penaltyFor(name, scope, config),
          });
        } else if (previous !== version) {
          changed.push({ name, scope, from: previous, to: version });
        }
      }
      for (const [name, version] of Object.entries(before[scope])) {
        if (!(name in after[scope])) {
          removed.push({
            name,
            scope,
            version,
            bonus: bonusFor(scope, config),
          });
        }
      }
    }
    manifests.push({
      path: adapter.path,
      present: existsSync(join(state.root, adapter.path)),
      counts: {
        runtime: Object.keys(after.runtime).length,
        dev: Object.keys(after.dev).length,
        optional: Object.keys(after.optional).length,
        peer: Object.keys(after.peer).length,
      },
    });
  }

  const sort = <T extends { name: string; scope: DependencyScope }>(
    values: T[],
  ): T[] =>
    values.sort(
      (a, b) =>
        scopeOrder.indexOf(a.scope) - scopeOrder.indexOf(b.scope) ||
        a.name.localeCompare(b.name),
    );
  sort(added);
  sort(removed);
  sort(changed);

  const penalties = added.reduce((sum, entry) => sum + entry.penalty, 0);
  const bonuses = removed.reduce((sum, entry) => sum + entry.bonus, 0);
  const linesReduced = delta(
    baseline?.totalLines ?? null,
    current?.totalLines ?? null,
  );
  const cyclomaticReduced = delta(
    baseline?.avgCyclo ?? null,
    current?.avgCyclo ?? null,
  );
  const reductionApplied =
    added.length > 0 &&
    ((linesReduced !== null && linesReduced >= config.offset.minLinesReduced) ||
      (cyclomaticReduced !== null &&
        cyclomaticReduced >= config.offset.minCyclomaticReduced));
  const offsetBonus = reductionApplied
    ? added.length * config.offset.bonusPerDependency
    : 0;
  const scoreDelta =
    Math.round((bonuses + offsetBonus - penalties) * 100) / 100;

  const guidance: string[] = [];
  const denied = added.filter((entry) => entry.denied);
  if (denied.length > 0) {
    guidance.push(
      `Avoid adding denied dependencies: ${denied.map((entry) => entry.name).join(", ")}.`,
    );
  }
  if (added.length > 0) {
    const names = added
      .map((entry) => `${entry.name} (${entry.scope})`)
      .join(", ");
    guidance.push(
      `Adding ${names} costs ${penalties} points. Prefer the standard library or existing dependencies first.`,
    );
  }
  if (reductionApplied && added.length > 0) {
    guidance.push(
      `The change reduces ${linesReduced ?? 0} lines and ${cyclomaticReduced ?? 0} cyclomatic complexity, offsetting ${offsetBonus} points.`,
    );
  }
  if (removed.length > 0) {
    guidance.push(
      `Removing ${removed.map((entry) => entry.name).join(", ")} earns ${bonuses} points.`,
    );
  }
  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    guidance.push("No dependency changes.");
  }
  if (changed.length > 0) {
    guidance.push(
      `Version changes: ${changed.map((entry) => `${entry.name} ${entry.from} -> ${entry.to}`).join(", ")}.`,
    );
  }

  return {
    schemaVersion: 1,
    kind: "dependencies",
    root: state.root,
    baseline: baseline
      ? { commit: baseline.commit, shortSha: baseline.shortSha }
      : null,
    current: current
      ? { commit: current.commit, shortSha: current.shortSha }
      : null,
    manifests,
    changes: {
      added,
      removed,
      changed,
    },
    counts: {
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      runtimeAdded: added.filter((entry) => entry.scope === "runtime").length,
      devAdded: added.filter((entry) => entry.scope === "dev").length,
    },
    offset: {
      linesReduced,
      cyclomaticReduced,
      applied: reductionApplied,
      bonus: offsetBonus,
    },
    penalties,
    bonuses,
    scoreDelta,
    guidance,
    next:
      added.length > 0
        ? [
            "Prefer standard-library or existing solutions; if a dependency is required, offset it with a measurable reduction in LOC or complexity.",
          ]
        : [],
  };
}

/** Collect state and analyze dependency changes. */
export function getDependencies(options: DependencyOptions = {}) {
  return buildDependencies(loadInsightState(options.root), options);
}
