# Roadmap

Planned work for `maaidd`’s **agent-facing iteration interface** — helping an agent intelligently iterate on a codebase, make wise decisions, use fewer tokens, and operate within a strict set of constraints.

## Done

1. **Guided MCP project initialization** — `maaidd mcp` detects missing project context at startup and advertises a guided, pull-based setup flow through server `instructions`, the `initialize-project` prompt, and the `project_init` tool. The flow captures goal, scope/non-goals, software/stack (with repository detection), design principles, constraints, and best practices. Best-practice defaults — including small atomic git commits, format/check before commit, and testing expectations — are applied without prompting. Callers request the optional settings catalog only when desired (`include: "optional"`), and `project_update` persists the result to `maaidd.project.json`, optionally merges tooling overrides into `maaidd.config.json`, and deterministically regenerates `PROJECT.md` from both configs (never model-generated). `project_read` exposes the saved context and can verify that `PROJECT.md` is in sync. Because MCP is pull-based, the caller decides which questions to present.

## Planned (ordered)

1. **Complete and extend the MCP server (primary agent interface)** — Evolve the MCP server (`maaidd mcp`, `src/mcp/server.ts`; tools today: `project_init`, `project_update`, `project_read`, `metrics`, `gate`, `history`, `codegraph`) into the authoritative, token-efficient interface for the agent iteration loop. Provide stable, structured, minimal outputs suitable for agent consumption and a clear surface for delivering benchmarks, scores, and guidance.
2. **Benchmarking of scores via MCP** — Benchmark collected metrics/scores (FTA, tests, per-test outcomes, trends, and derived signals) against baselines/targets and deliver benchmark results to the agent through the MCP server, so comparisons are part of the iteration loop.
3. **Composite commit score for the LLM** — Provide a scoring metric to the LLM based on a combination of statistics for each git commit (e.g. FTA/complexity, Halstead, LOC, gate outcomes, test pass/fail and per-test changes, and trends). The score should be transparent, deterministic where possible, and token-efficient to consume.
4. **Dependency/library selection guidance metric** — Provide guidance on when to select a library, surfaced as part of the metric/guidance given by the MCP. Define explicit, transparent rules/weights (e.g. adding a dependency deducts *x* points, while reducing lines of code/complexity or improving constrained outcomes increases points), within a strict set of constraints.
5. **Commit guidance (small, intelligently iterative commits)** — Provide guidance on how and when to make commits to keep them small and project statistics intelligently iterative, aligned with pending/`current` snapshots, the finalize flow, trend visibility, and commit scoring.

## Status

Guided MCP project initialization is **implemented**. The remaining items are **planned** (not yet fully implemented).

Current implemented foundations include the CLI, Biome-first/functional formatting constraints, FTA metrics/gates, SQLite snapshots in `./maaidd.db` with per-test results, pending-as-`current` reporting, tracked hooks, the initial MCP tools (`metrics`, `gate`, `history`, `codegraph`), and MCP project initialization (`project_init`, `project_update`, `project_read`, plus deterministic `PROJECT.md` generation).
