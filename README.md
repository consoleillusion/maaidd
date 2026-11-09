# MAID — Metric Assisted AI Driven Development

MAID is a Bun/TypeScript CLI and library for orchestrating AI-assisted development with **consistent formatting** and **measurable feedback**.

- **Biome-first formatting** for normalization and consistent diffs.
- **Functional formatting mode** (Dhall/Haskell-like leading commas) applied as a *layout diff on top of Biome normalization*.
- **Code metrics** via [FTA](https://github.com/sgb-io/fta) (cyclomatic complexity, Halstead, FTA score, LOC).
- **Gates** to enforce metric thresholds.
- **Per-commit snapshots** (tests + FTA) stored in an embedded **SQLite** database (`metric/maid.db`), with legacy JSON import.
- **uPlot HTML reports** to visualize trends over git commits.
- **Iteration insights**: `status`, `benchmark`, composite `score`, dependency guidance, and commit guidance, available identically from the CLI and MCP.
- **MCP server** exposing guided project initialization plus metrics, gate, history, codegraph, and insight tools to AI agents.
- **Deterministic project docs**: `maid.project.json` is canonical; `PROJECT.md` is generated from it and `maid.config.json`.

## Requirements

- [Bun](https://bun.sh/) (primary runtime)
- Node.js `>=18` (compatibility target; some paths are Bun-oriented)
- Git (for commit-aware snapshots and history timestamps)
- `fta` available via `node_modules/.bin/fta`, `fta` on PATH, or `FTA_BIN`

## Installation

```bash
bun install
```

## Quick start

```bash
# Initialize project context and tooling (guided)
bun src/cli/index.ts init

# Format (writes in place / use --check to verify)
bun run format -- src
bun src/cli/index.ts check src

# Metrics
bun src/cli/index.ts metrics src
bun src/cli/index.ts metrics src --format json

# Enforce thresholds from maid.config.json
bun src/cli/index.ts gate src

# Save a snapshot (runs test command + FTA, stores in metric/maid.db)
bun src/cli/index.ts metrics src --save

# Generate an HTML trend report
bun src/cli/index.ts report -o metric/report.html

# Run the MCP server (stdio)
bun src/cli/index.ts mcp

# Iteration insights (CLI and MCP expose the same payloads)
bun src/cli/index.ts status
bun src/cli/index.ts metrics src --pending
bun src/cli/index.ts benchmark
bun src/cli/index.ts score
bun src/cli/index.ts dependencies
bun src/cli/index.ts commit-guide
```

You can also use the package scripts: `bun run format`, `bun run check`, `bun run metrics`, `bun run gate`, `bun run report`, `bun run mcp`, `bun test`.

## CLI

The CLI is built with [Stricli](https://github.com/bloomberg/stricli). Commands:

| Command | Purpose |
|---|---|
| `format [paths...]` | Format files (Biome-first; optional functional mode) |
| `check [paths...]` | Check formatting (non-zero on differences) |
| `metrics [path]` | Run FTA metrics; optionally save pending/final snapshots |
| `gate [path]` | Fail if metrics violate configured thresholds |
| `report` | Generate uPlot HTML history dashboard |
| `mcp` | Start MCP server (stdio) for agents |
| `graph` | Code-graph status/query helpers |
| `init` | Initialize project context, tooling config, hooks, and generated docs |
| `status` | Summarize project, snapshot, git, benchmark, score, dependencies, and commit state |
| `benchmark` | Compare current metrics/tests against a baseline and targets |
| `score` | Show the transparent composite commit score |
| `dependencies` | Show dependency changes and library-selection guidance |
| `commit-guide` | Check commit readiness and suggest a small, focused commit |
| `completion` | Shell completion support |

Full, generated reference: [`docs/cli.md`](./docs/cli.md) (regenerate with `bun run docs:cli`).

## Project initialization

`maid init` runs the same guided project setup as the MCP server. It asks only the required questions — goal, in-scope, and out-of-scope (with software detected from the repository) — and applies best-practice defaults for git commits, formatting, and testing without prompting.

```bash
# Interactive guide
bun src/cli/index.ts init

# Non-interactive
bun src/cli/index.ts init --non-interactive --goal "Build the project" --scope-in "core, docs" --scope-out "billing"

# Optional settings catalog only when requested
bun src/cli/index.ts init --show-options
```

The result is written to `maid.project.json`; `PROJECT.md` is deterministically generated from it and `maid.config.json`. Use `--skip-project` to initialize tooling only.

## Configuration

MAID reads `maid.config.json` (by default, discovered/loaded from the working context as implemented in `src/config.ts`). Key areas:

- `style`: `"biome"` (default) or `"functional"`
- Biome/format options: `indent`, `lineWidth`, `semicolons`, `quoteStyle`, `trailingComma`, `toArrow`, `biome`
- `functional`: leading-comma layout options (`commaStyle`, indents, `forceBlankLines`, `maxInlineArrayItems`, etc.)
- `metrics`: `excludeUnder`, `testCommand` (default `bun run test`), `thresholds.maxCyclomatic`, `thresholds.minFtaScore`
- `mcp`: `codegraph`, `metrics`
- `insights`: benchmark targets, score weights/grades, dependency penalties/allow/deny, and commit limits

Project context is stored separately in `maid.project.json` (goal, scope, software, design, constraints, best practices), with a deterministic `PROJECT.md` generated from it and `maid.config.json`.

See [`docs/configuration.md`](./docs/configuration.md).

## Library API

```ts
import { format, formatFunctional, formatWithBiome, loadConfig } from "maid";

const out = format(source, {
  style: "biome", // default
  filename: "file.ts",
});

// Functional mode = Biome normalization + leading-comma layout diff
const functional = format(source, {
  style: "functional",
  filename: "file.ts",
});
```

Notes:
- In **Biome** mode, `toArrow` is not applied (Biome has no equivalent transform); explicitly provided style flags are forwarded selectively so `biome.json` can govern defaults.
- In **functional** mode, `toArrow` is applied in the functional pipeline after normalization.
- A legacy JS formatter API remains at `src/index.js` / `src/printer/*` (Babel-based comma-first printer).

## Metrics, snapshots, and reports

- **Snapshots** are stored in `metric/maid.db` (SQLite, via Bun `bun:sqlite`). Legacy `metric/<commit>.json` files are imported automatically and non-destructively.
- `maid metrics --save` records **FTA metrics** and **test-runner counts** (from `metrics.testCommand`) for the current `HEAD`.
- Use `--pending` before a commit and `--finalize` after to attach the snapshot to the new commit SHA.
- `maid gate` checks FTA results against thresholds (FTA gate ≠ test pass/fail).
- `maid report` generates a self-contained uPlot HTML dashboard over commit history.

See [`docs/metrics-and-gates.md`](./docs/metrics-and-gates.md) and [`docs/snapshots-and-reports.md`](./docs/snapshots-and-reports.md).

## Iteration insights

`maid status`, `benchmark`, `score`, `dependencies`, and `commit-guide` form the agent iteration loop. Each command is a thin CLI adapter over the same core as its MCP counterpart, so manual CLI use and agent-driven MCP use produce identical payloads. All support `--format json|toon`.

See [`docs/insights.md`](./docs/insights.md) for the full workflow and [`docs/configuration.md#insights`](./docs/configuration.md#insights) for configuration.

## MCP server

`maid mcp` starts a stdio MCP server exposing tools for agents (e.g. `project_init`, `project_update`, `project_read`, `metrics`, `gate`, `history`, `codegraph`, `status`, `benchmark`, `score`, `dependencies`, `commit_guide`). In a new project, the server advertises guided setup through its instructions; the caller asks only required questions, applies defaults without prompting, and fetches the optional settings catalog only when desired. `maid init` runs the same guide from the CLI. See [`docs/mcp-and-codegraph.md`](./docs/mcp-and-codegraph.md).

## Roadmap

See [`docs/roadmap.md`](./docs/roadmap.md) for completed and planned work (guided project initialization via CLI and MCP, MCP completion/extension, benchmarking and composite scoring, dependency/library-selection guidance metrics, and commit guidance) aligned with the agent iteration interface.

## Development

```bash
bun test
bunx tsc --noEmit
bun run docs:cli
```

- Tests live in `spec/` and fixtures in `fixtures/`.
- CLI docs are generated from the real CLI: edit command definitions, then run `bun run docs:cli` (or `bun run docs:cli -- --check`).

See [`docs/development.md`](./docs/development.md).

## Project structure

```text
src/        CLI, formatter/styles, metrics, report, MCP, codegraph
spec/       Bun tests
fixtures/   formatting fixtures
metric/     metrics DB (maid.db) and/or legacy JSON snapshots
docs/       documentation (cli.md is generated)
scripts/    maintenance scripts (CLI doc generation)
```

## License

MIT
