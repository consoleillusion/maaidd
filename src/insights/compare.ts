/** Shared snapshot selection and comparison helpers for insight tools. */
import type { InsightState, SnapshotPoint } from "./state.ts";

export const round = (value: number, places = 4): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

export const passRate = (point: SnapshotPoint | null): number | null => {
  if (!point) return null;
  if (point.testsTotal === null || point.testsTotal === 0) return null;
  const passed = point.testsPassed ?? 0;
  return round(passed / point.testsTotal);
};

export const delta = (
  current: number | null,
  baseline: number | null,
): number | null => {
  if (current === null || baseline === null) return null;
  return round(current - baseline);
};

export const sameCommit = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
};

export const findPoint = (
  state: InsightState,
  selector: string,
): SnapshotPoint | null => {
  const value = selector.trim();
  if (!value) return null;
  if (value === "head") return state.head;
  if (value === "pending" || value === "current") return state.pending;
  return state.history.find((entry) => sameCommit(entry.commit, value)) ?? null;
};

export const resolveCurrent = (
  state: InsightState,
  selector?: string,
): SnapshotPoint | null => {
  if (!selector) return state.current;
  const point = findPoint(state, selector);
  if (!point) throw new Error(`Snapshot not found: ${selector}`);
  return point;
};

/**
 * Resolve a baseline. `previous` compares against the commit before the
 * current one; pending snapshots fall back to HEAD.
 */
export const resolveBaseline = (
  state: InsightState,
  current: SnapshotPoint | null,
  selector: string | undefined,
  configured: string,
): SnapshotPoint | null => {
  const value = (selector ?? configured ?? "previous").trim();
  if (value === "first") return state.history[0] ?? null;
  if (value === "head") return state.head;
  if (value === "pending" || value === "current") return state.pending;
  if (value === "previous") {
    if (!current) return null;
    const exact = state.history.find((entry) =>
      sameCommit(entry.commit, current.commit),
    );
    if (exact) {
      const index = state.history.indexOf(exact);
      return index > 0 ? state.history[index - 1] : null;
    }
    // Pending snapshots are not in history: compare against HEAD.
    return state.head ?? state.history.at(-1) ?? null;
  }
  const explicit = findPoint(state, value);
  if (!explicit) throw new Error(`Baseline snapshot not found: ${value}`);
  return explicit;
};
