# Overview

## Goal

MAAIDD (**Metric Assisted AI Driven Development**) gives AI agents and developers concrete feedback loops:

1. **Consistent formatting** so diffs stay meaningful across commits.
2. **Complexity/quality metrics** (FTA: cyclomatic, Halstead, FTA score, LOC) so changes can be evaluated objectively.
3. **Commit history** of measurements (including test-runner results) so progress/regressions are visible.
4. **Agent-facing tools** (MCP) to query metrics, gates, history, and codegraph context.

## Architecture

```text
source
  ├─ Biome (normalize/format)
  └─ optional functional layout pass (leading-comma diff on top of Biome)
        ↓
formatted output

src/ path
  ├─ FTA → metrics + gate
  ├─ test runner → pass/fail/total counts
  ├─ snapshot store → metric/maaidd.db (SQLite, embedded via bun:sqlite)
  └─ report → uPlot HTML (commit-ordered trends)

MCP server (stdio)
  └─ tools: metrics, gate, history, codegraph
```

## Key design choices

- **Biome-first:** Biome provides the baseline normalization. The functional style is a *layout diff* applied after normalization, which keeps formatting stable and diff-friendly rather than inventing an independent formatter.
- **Tests vs FTA gate:** test pass/fail counts come from the configured test runner. FTA gate results (files passing/failing thresholds) are separate measurements and are not mislabeled as test results.
- **Embedded SQLite:** metric snapshots are stored in `metric/maaidd.db` for reliable local storage and querying. Legacy `metric/*.json` snapshots are imported automatically (non-destructive).
- **Deterministic CLI docs:** `docs/cli.md` is generated from the real CLI (`bun run docs:cli`) to avoid drift.
