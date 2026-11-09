# Development

## Repo layout

- `src/` — implementation
  - `cli/` — Stricli app and commands
  - `style/` — Biome integration and functional layout pass
  - `printer/`, `transforms/` — legacy Babel/comma-first printer and transforms
  - `metrics/` — FTA, gates, test runner, snapshot store (SQLite), reports, TOON
  - `mcp/` — MCP server
  - `project.ts` — project context schema, detection, persistence, and deterministic `PROJECT.md`
  - `codegraph.ts` — code-graph integration
- `spec/` — Bun tests (`bun:test`)
- `fixtures/` — golden formatting fixtures
- `examples/` — sample inputs
- `metric/` — `maaidd.db` (SQLite) and/or legacy imported JSON snapshots
- `docs/` — documentation (`cli.md` is generated)
- `scripts/` — maintenance scripts

## Common tasks

```bash
bun install
bun test
bunx tsc --noEmit
bun run docs:cli
bun run docs:cli -- --check   # fail if docs/cli.md is stale
```

## Style conventions

- Double quotes, semicolons, 2-space indent, trailing commas (match existing code).
- Prefer the TypeScript/Stricli CLI (`src/cli/index.ts`) and `maaidd.config.json` for current behavior.

## Generated CLI docs

`docs/cli.md` is generated from the real CLI help output:

```bash
bun scripts/generate-cli-docs.ts
```

Do not hand-edit `docs/cli.md`. Update command definitions in `src/cli/` and regenerate. Keep the command list in `scripts/generate-cli-docs.ts` in sync with `src/cli/app.ts` route keys.

## Metrics storage

Snapshots use embedded SQLite at `metric/maaidd.db` (`src/metrics/store.ts`, re-exported via `history.ts`). Tests should use temp directories and the public history API; do not assume JSON snapshot files are created for new saves.

## Nix

A `flake.nix` provides a Bun-based app entry (`maaidd`). Validate Nix changes in an environment with Nix if needed.
