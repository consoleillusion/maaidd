# Formatting

MAAIDD formats JavaScript/TypeScript with a **Biome-first** pipeline and an optional **functional** layout mode.

## Modes

### `style: "biome"` (default)

- Runs Biome formatting/normalization.
- Produces standard, consistent output suitable for CI and diff stability.
- `toArrow` is **not** supported in pure Biome mode (Biome does not provide that transform). Use functional mode or the legacy transform pipeline if you need it.
- When using the TS API, explicitly provided style flags may be forwarded; unspecified flags allow `biome.json` to govern.

### `style: "functional"`

- **Biome normalization first**, then a functional layout pass.
- The functional pass applies Dhall/Haskell-like **leading-comma** layout as a *diff on top of Biome* (the goal is consistent diffs, not a fully independent formatter).
- `toArrow` can be applied in the functional pipeline (after normalization) when enabled.
- Controlled by `functional` options in `maaidd.config.json` (comma style, value indents, blank lines, inline array threshold, etc.).

## Legacy printer (JS)

The repository also contains the original Babel-based comma-first printer:

- `src/index.js` — legacy `format()` API
- `src/cli.js` — legacy shim that forwards to the Stricli CLI
- `src/printer/*` — custom printer modules (dispatch, layout, literals, functions, objects, statements, expressions, classes, modules)
- `src/transforms/toArrow.js` — function-to-arrow transform

The TypeScript API (`src/index.ts`) is the primary, Biome-first implementation.

## Deterministic formatting

Use `maaidd check` in CI/precommit to ensure files are formatted, and `maaidd format` to apply changes. The `cli.sh` helpers show a commit workflow that formats and records a pending metric snapshot.
