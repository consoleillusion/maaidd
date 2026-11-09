# Configuration

MAAIDD is configured primarily via `maaidd.config.json` (see `src/config.ts`, `src/types.ts`, and `maaidd.config.json` in this repo).

## Top-level options

| Key | Type | Default (typical) | Description |
|---|---|---|---|
| `style` | `"biome" \| "functional"` | `"biome"` | Formatting mode. Functional applies a leading-comma layout diff after Biome normalization. |
| `indent` | `number \| "tab"` | `2` | Indent unit. |
| `lineWidth` | `number` | `80` | Line width hint. |
| `semicolons` | `boolean` | `true` | Emit semicolons. |
| `quoteStyle` | `"double" \| "single"` | `"double"` | Quote style. |
| `trailingComma` | `"all" \| "es5" \| "none"` | `"all"` | Trailing comma behavior (interpreted per mode/integration). |
| `toArrow` | `boolean` | `false` | Convert eligible function declarations to `const` arrows (supported in the functional/legacy transform pipeline; not applied by Biome mode). |
| `biome` | `boolean` | `true` | Enable Biome integration. |

## `functional`

Controls the functional (Dhall/Haskell-like) layout pass:

| Key | Description |
|---|---|
| `commaStyle` | `"leading"` (typical) or `"trailing"` |
| `objectValueIndent` | Indentation for object values |
| `arrayValueIndent` | Indentation for array values |
| `forceBlankLines` | Insert blank lines in specific layouts |
| `semicolons` | Semicolon behavior for functional layout |
| `maxInlineArrayItems` | Threshold for inlining arrays |

## `metrics`

| Key | Description |
|---|---|
| `excludeUnder` | Exclude files under N lines from FTA analysis. |
| `testCommand` | Command used to collect test counts for snapshots (default `bun run test`). |
| `thresholds.maxCyclomatic` | Maximum allowed cyclomatic complexity (FTA gate). |
| `thresholds.minFtaScore` | Minimum allowed FTA score (FTA gate). |

## `mcp`

| Key | Description |
|---|---|
| `codegraph` | Enable codegraph-related MCP functionality. |
| `metrics` | Enable metrics-related MCP functionality. |

## Project context (`maaidd.project.json`)

MCP project initialization writes a separate `maaidd.project.json` at the project root. It is the canonical project definition used by `project_read` and the `initialize-project` flow:

| Key | Description |
|---|---|
| `schemaVersion` | Project context schema version. |
| `name` | Project name (detected from `package.json` or the directory name). |
| `goal` | One-sentence project goal. Required during initialization. |
| `scope` | `{ in, out }` lists describing in-scope work and explicit non-goals. |
| `software` | Languages, runtime, package manager, frameworks, test command, and build command. Detected where possible. |
| `design` | Summary, principles, and architecture notes. |
| `constraints` | Hard project constraints. |
| `bestPractices` | Git commit, formatting, testing, and documentation expectations. Best-practice defaults are applied without prompting. |
| `createdAt` / `updatedAt` | Metadata; `updatedAt` only changes when project content changes. |

`PROJECT.md` is generated deterministically from `maaidd.project.json` and the effective `maaidd.config.json`. Do not edit it directly; call `project_update` to regenerate it. `project_read({ verify: true })` checks that it is in sync.

## Notes

- `maaidd.config.json` contains *configuration* (including a `metrics` section). The **metric snapshot directory** is `metric/` (containing `maaidd.db`); it is not named `metrics/`.
- Biome formatting also respects `biome.json` where applicable; MAAIDD forwards only explicitly provided style flags in Biome mode so project Biome config can govern defaults.
