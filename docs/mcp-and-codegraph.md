# MCP and codegraph

MAAIDD can run as an [MCP](https://modelcontextprotocol.io/) stdio server so AI agents can query metrics and project analysis tools.

## Start the server

```bash
bun src/cli/index.ts mcp
```

(Also `bun run mcp`.) The server uses stdio transport (`src/mcp/server.ts`).

## Tools

| Tool | Description |
|---|---|
| `metrics` | Run FTA on a path and return results (`json`/`toon`/`table`). |
| `gate` | Check FTA results against configured thresholds; reports pass/fail and violations. |
| `history` | Read aggregated snapshot history from `./maaidd.db` (tests, LOC, gate counts, cyclo, FTA, Halstead; includes pending as `current` where supported). |
| `codegraph` | Inspect code-graph index status or run code-graph commands/queries (supports `query` or exact `args`). Requires an index (e.g. `bunx @sdsrs/code-graph incremental-index`). |

Tool availability/behavior is implemented in `src/mcp/server.ts` and respects project config where applicable.

## Planned

See [Roadmap](./roadmap.md): planned expansion includes delivering benchmarking and composite commit scoring via MCP, dependency/library-selection guidance metrics, and completing/extending the MCP server as the primary token-efficient agent interface (stable, structured outputs).

## Codegraph setup

MAAIDD integrates with `@sdsrs/code-graph`. Typical setup (see also `cli.sh init`):

```bash
bunx -y @sdsrs/code-graph incremental-index
```

Model/index paths may depend on environment variables (e.g. `CODE_GRAPH_MODEL_DIR`, `CODE_GRAPH_HOOK_INDEX`). The MCP `codegraph` tool reports when no index is found and can execute supported commands when configured.

## Configuration

`maaidd.config.json` includes an `mcp` section (e.g. `codegraph`, `metrics` toggles) used by the application’s MCP/config logic.
