# Getting started

## 1) Install

```bash
cd /path/to/maaidd
bun install
```

## 2) (Optional) Initialize tooling

```bash
./init.sh
```

`init.sh` creates `metric/` (the metrics storage directory). For full project initialization via the CLI, see `maaidd init` (`bun src/cli/index.ts init --help`).

## 3) Configure

Create or edit `maaidd.config.json` in your project. Example:

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
# save tests + FTA for current HEAD into metric/maaidd.db
bun src/cli/index.ts metrics src --save

# or: pending before commit, finalize after commit
bun src/cli/index.ts metrics src --pending
git commit -m "..."
bun src/cli/index.ts metrics --finalize

# HTML trend dashboard
bun src/cli/index.ts report -o metric/report.html
```

## 7) MCP server (for AI agents)

```bash
bun src/cli/index.ts mcp
```

This runs an MCP stdio server exposing metrics/gate/history/codegraph tools. See [MCP and codegraph](./mcp-and-codegraph.md).
