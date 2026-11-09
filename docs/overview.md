# Overview

## Goal

MAID (**Metric Assisted AI Driven Development**) gives AI agents and developers concrete feedback loops:

1. **Consistent formatting** so diffs stay meaningful across commits.
2. **Complexity/quality metrics** (FTA: cyclomatic, Halstead, FTA score, LOC) so changes can be evaluated objectively.
3. **Commit history** of measurements (including test-runner results) so progress/regressions are visible.
4. **Guided project setup** (CLI and MCP) for goal, scope, software, design, constraints, and best practices.
5. **Iteration insights** — status, benchmarking, composite scoring, dependency guidance, and commit guidance, delivered identically by the CLI and MCP.
6. **Agent-facing tools** (MCP) to query metrics, gates, history, insights, and codegraph context.

## Architecture

```text
source
  ├─ Biome (normalize/format)
  └─ optional functional layout pass (leading-comma diff on top of Biome)
        ↓
formatted output

src/ path
  ├─ FTA → metrics + gate
  ├─ test runner → pass/fail/total counts and per-test results
  ├─ snapshot store → ./maid.db (SQLite, embedded via bun:sqlite)
  └─ report → uPlot HTML (commit-ordered trends, pending as `current`)

project setup
  ├─ maid init (CLI guide)
  └─ MCP: project_init, project_update, project_read
        ↓
  maid.project.json + deterministic PROJECT.md

MCP server (stdio)
  ├─ project context: project_init, project_update, project_read
  ├─ analytics/codegraph: metrics, gate, history, codegraph
  └─ iteration insights: status, benchmark, score, dependencies, commit_guide
```

The CLI and MCP are thin adapters over the same core. `src/insights/` owns the shared state, benchmark, score, dependency, and commit logic; a developer can use only the CLI, and an agent receives the same payloads over MCP.

## Key design choices

- **Biome-first:** Biome provides the baseline normalization. The functional style is a *layout diff* applied after normalization, which keeps formatting stable and diff-friendly rather than inventing an independent formatter.
- **Tests vs FTA gate:** test pass/fail counts come from the configured test runner (including per-test results). FTA gate results (files passing/failing thresholds) are separate measurements and are not mislabeled as test results.
- **Embedded SQLite:** metric snapshots are stored in `./maid.db` for reliable local storage and querying (including normalized per-test results). Legacy `metric/*.json` and legacy `./metric/*.json` snapshots are imported automatically (non-destructive).
- **Current vs finalized snapshots:** pending snapshots are visible as `current` in history/report; post-commit finalization binds them to `HEAD` (no amend by default).
- **Deterministic CLI docs:** `docs/cli.md` is generated from the real CLI (`bun run docs:cli`) to avoid drift.
- **Deterministic project docs:** `maid.project.json` is canonical and `PROJECT.md` is generated from it plus `maid.config.json`; `maid init` and the MCP `project_read` tool share the same guide and can verify they are in sync.

## Roadmap

See [Roadmap](./roadmap.md). All planned work is implemented: guided project initialization, the shared CLI/MCP iteration interface, benchmarking, composite commit scoring, dependency/library-selection guidance, and commit guidance. See [Insights](./insights.md) for the workflow.
