# MAAIDD — Metric Assisted AI Driven Development

MAAIDD is a Bun/TypeScript CLI and library for orchestrating AI-assisted development with **consistent formatting** and **measurable feedback**.

- **Biome-first formatting** for normalization and consistent diffs.
- **Functional formatting mode** (Dhall/Haskell-like leading commas) applied as a *layout diff on top of Biome normalization*.
- **Code metrics** via [FTA](https://github.com/sgb-io/fta) (cyclomatic complexity, Halstead, FTA score, LOC).
- **Gates** to enforce metric thresholds.
- **Per-commit snapshots** (tests + FTA) stored in an embedded **SQLite** database (`metric/maaidd.db`), with legacy JSON import.
- **uPlot HTML reports** to visualize trends over git commits.
- **MCP server** exposing metrics, gate, history, and codegraph tools to AI agents.

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
# Format (writes in place / use --check to verify)
bun run format -- src
bun src/cli/index.ts check src

# Metrics
bun src/cli/index.ts metrics src
bun src/cli/index.ts metrics src --format json

# Enforce thresholds from maaidd.config.json
bun src/cli/index.ts gate src

# Save a snapshot (runs test command + FTA, stores in metric/maaidd.db)
bun src/cli/index.ts metrics src --save

# Generate an HTML trend report
bun src/cli/index.ts report -o metric/report.html

# Run the MCP server (stdio)
bun src/cli/index.ts mcp
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
| `init` | Initialize project/tooling config |
| `completion` | Shell completion support |

Full, generated reference: [`docs/cli.md`](./docs/cli.md) (regenerate with `bun run docs:cli`).

## Configuration

MAAIDD reads `maaidd.config.json` (by default, discovered/loaded from the working context as implemented in `src/config.ts`). Key areas:

- `style`: `"biome"` (default) or `"functional"`
- Biome/format options: `indent`, `lineWidth`, `semicolons`, `quoteStyle`, `trailingComma`, `toArrow`, `biome`
- `functional`: leading-comma layout options (`commaStyle`, indents, `forceBlankLines`, `maxInlineArrayItems`, etc.)
- `metrics`: `excludeUnder`, `testCommand` (default `bun run test`), `thresholds.maxCyclomatic`, `thresholds.minFtaScore`
- `mcp`: `codegraph`, `metrics`

See [`docs/configuration.md`](./docs/configuration.md).

## Library API

```ts
import { format, formatFunctional, formatWithBiome, loadConfig } from "maaidd";

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

- **Snapshots** are stored in `metric/maaidd.db` (SQLite, via Bun `bun:sqlite`). Legacy `metric/<commit>.json` files are imported automatically and non-destructively.
- `maaidd metrics --save` records **FTA metrics** and **test-runner counts** (from `metrics.testCommand`) for the current `HEAD`.
- Use `--pending` before a commit and `--finalize` after to attach the snapshot to the new commit SHA.
- `maaidd gate` checks FTA results against thresholds (FTA gate ≠ test pass/fail).
- `maaidd report` generates a self-contained uPlot HTML dashboard over commit history.

See [`docs/metrics-and-gates.md`](./docs/metrics-and-gates.md) and [`docs/snapshots-and-reports.md`](./docs/snapshots-and-reports.md).

## MCP server

`maaidd mcp` starts a stdio MCP server exposing tools for agents (e.g. `metrics`, `gate`, `history`, `codegraph`). See [`docs/mcp-and-codegraph.md`](./docs/mcp-and-codegraph.md).

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
metric/     metrics DB (maaidd.db) and/or legacy JSON snapshots
docs/       documentation (cli.md is generated)
scripts/    maintenance scripts (CLI doc generation)
```

## License

MIT
