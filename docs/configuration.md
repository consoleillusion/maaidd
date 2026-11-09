# Configuration

MAID is configured primarily via `maid.config.json` (see `src/config.ts`, `src/types.ts`, and `maid.config.json` in this repo).

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

## `insights`

`insights` configures the shared iteration interface used identically by `maid status` (and the other insight commands) and the corresponding MCP tools. Every value may be omitted; defaults are deep-merged and validated when the config is loaded.

| Key | Type | Default | Description |
|---|---|---|---|
| `benchmark.baseline` | `"previous" \| "first" \| string` | `"previous"` | Default comparison point: the previous commit, the first snapshot, or a specific commit. |
| `benchmark.targets.minTestPassRate` | `number` (0–1) | `1` | Minimum test pass rate. |
| `benchmark.targets.maxCyclomaticDelta` | `number` | `0` | Maximum allowed average cyclomatic increase. |
| `benchmark.targets.minAvgFtaScoreDelta` | `number` | `0` | Minimum allowed average FTA score increase. |
| `benchmark.targets.maxHalsteadBugsDelta` | `number` | `0` | Maximum allowed Halstead bugs increase. |
| `benchmark.targets.maxTotalLinesDelta` | `number \| null` | `null` | Maximum allowed LOC increase (`null` disables). |
| `benchmark.tolerance.*` | `number` | small | Fuzzy comparison tolerance for pass-rate, FTA, cyclomatic, Halstead, and LOC deltas. |
| `score.weights.*` | `number` | `gate=25, fta=20, complexity=15, tests=25, trend=10, dependencies=5` | Weights for the composite score; must sum to a positive value. |
| `score.grades.*` | `number` | `A=90, B=80, C=70, D=60` | Grade cutoffs; must be ordered `A >= B >= C >= D`. |
| `score.missingDataCredit` | `number` (0–1) | `0.5` | Credit applied to a score component when its input data is unavailable. |
| `dependencies.manifests` | `string[]` | `["package.json"]` | Manifest files scanned for dependency changes. |
| `dependencies.penalties.*` | `number` | `runtime=5, dev=2, optional=1, peer=1` | Score penalty for adding a dependency by scope. |
| `dependencies.removalBonuses.*` | `number` | `runtime=3, dev=1, optional=0.5, peer=0.5` | Score bonus for removing a dependency by scope. |
| `dependencies.offset.*` | `number` | see below | Offsets that earn a bonus for reducing LOC/complexity. |
| `dependencies.allow` | `string[]` | `[]` | Preferred dependencies (reduced penalty). |
| `dependencies.deny` | `string[]` | `[]` | Dependencies that should be avoided. |
| `commit.requirePendingSnapshot` | `boolean` | `true` | Recommend capturing a pending snapshot before committing. |
| `commit.requireTestsPassing` | `boolean` | `true` | Require tests to pass before committing. |
| `commit.requireGatePassing` | `boolean` | `true` | Require the metrics gate to pass before committing. |
| `commit.maxChangedFiles` | `number` | `10` | Recommended maximum files per commit. |
| `commit.maxChangedLines` | `number` | `300` | Recommended maximum changed lines per commit. |
| `commit.suggestSplit` | `boolean` | `true` | Suggest splitting when the change exceeds the limits. |
| `commit.dependencyChangesSeparate` | `boolean` | `true` | Suggest committing dependency changes separately. |

`dependencies.offset` starts at `minLinesReduced=20`, `minCyclomaticReduced=1`, and `bonusPerDependency=2`.

## Project context (`maid.project.json`)

`maid init` and MCP project initialization write a separate `maid.project.json` at the project root. It is the canonical project definition used by `project_read` and the `initialize-project` flow:

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

`PROJECT.md` is generated deterministically from `maid.project.json` and the effective `maid.config.json`. Do not edit it directly; call `project_update` to regenerate it. `project_read({ verify: true })` checks that it is in sync.

From the CLI, use `maid init --goal ... --scope-in ...` for non-interactive setup, `maid init --show-options` to print the optional settings catalog, and `maid init --skip-project` to leave project context untouched.

## Notes

- `maid.config.json` contains *configuration* (including a `metrics` section). The **metric snapshot directory** is `metric/` (containing `maid.db`); it is not named `metrics/`.
- Biome formatting also respects `biome.json` where applicable; MAID forwards only explicitly provided style flags in Biome mode so project Biome config can govern defaults.
