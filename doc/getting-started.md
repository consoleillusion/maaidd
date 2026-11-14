# Getting started

## 1) Install

```bash
cd /path/to/maid
bun install
```

## 2) Initialize project and tooling

```bash
bun src/cli/index.ts init
```

`init` runs the same guided project setup as the MCP server. It asks only the required questions (goal, in-scope, out-of-scope, and software when it cannot be detected), applies best-practice defaults silently, writes `maid.project.json`, deterministically generates `PROJECT.md`, and initializes tooling config.

- Use `--non-interactive --goal "..." --scope-in "core, docs"` for automation.
- Use `--show-options` to print the optional project settings catalog.
- Use `--skip-project` to initialize tooling only.
- `./init.sh` only creates `metric/` (the metrics storage directory).

`maid init` and the MCP server share the same guide:

- Ask only the required questions (goal, scope, and software). Software is detected from the repository where possible.
- Do not prompt for defaults such as best-practice git commits, formatting, and testing expectations; they are applied automatically.
- Request the optional settings catalog only when desired (`maid init --show-options` or MCP `project_init` with `include: "optional"`).
- Save with `project_update`; it writes `maid.project.json` and deterministically generates `PROJECT.md`.
- Use `project_read` in later sessions, and `project_read` with `verify: true` to confirm the generated document is in sync.

See [MCP and codegraph](./mcp-and-codegraph.md#project-initialization).

## 3) Configure

Create or edit `maid.config.json` in your project. Example:

```json
{
  "style": "biome",
  "indent": 2,
  "lineWidth": 80,
  "semicolons": true,
  "quoteStyle": "double",
  "trailingComma": "all",
  "toArrow": false,
  "metrics": {
    "excludeUnder": 0,
    "testCommand": "bun run test",
    "thresholds": { "maxCyclomatic": 20, "minFtaScore": 50 }
  },
  "mcp": { "codegraph": true, "metrics": true }
}
```

See [Configuration](./configuration.md).

## 4) Format and check

```bash
bun src/cli/index.ts format src
bun src/cli/index.ts check src
```

## 5) Measure and gate

```bash
bun src/cli/index.ts metrics src
bun src/cli/index.ts gate src
```

## 6) Save snapshots and generate a report

```bash
# save tests + FTA for current HEAD into metric/maid.db
bun src/cli/index.ts metrics src --save

# or: pending before commit, finalize after commit
bun src/cli/index.ts metrics src --pending
git commit -m "..."
bun src/cli/index.ts metrics --finalize

# HTML trend dashboard
bun src/cli/index.ts report -o metric/report.html
```

## 7) Use the iteration insights (CLI or MCP)

```bash
bun src/cli/index.ts status
bun src/cli/index.ts metrics src --pending
bun src/cli/index.ts benchmark
bun src/cli/index.ts score
bun src/cli/index.ts dependencies
bun src/cli/index.ts commit-guide
```

These commands and their MCP counterparts (`status`, `benchmark`, `score`, `dependencies`, `commit_guide`) call the same core and return the same payloads. Use `--format toon` for token-efficient agent output. See [Insights](./insights.md).

## 8) MCP server (for AI agents)

```bash
bun src/cli/index.ts mcp
```

This runs an MCP stdio server exposing project context, metrics, gate, history, codegraph, and iteration-insight tools. See [MCP and codegraph](./mcp-and-codegraph.md).
