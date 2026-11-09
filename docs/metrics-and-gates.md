# Metrics and gates

MAID uses [FTA (Fast TypeScript Analyzer / FTA CLI)](https://github.com/sgb-io/fta) to measure code and can enforce thresholds (“gates”).

## FTA metrics

`maid metrics [path]` runs FTA and reports per-file metrics (e.g. `cyclo`, `fta_score`, `assessment`, `line_count`, Halstead fields when available).

```bash
bun src/cli/index.ts metrics src
bun src/cli/index.ts metrics src --format json
bun src/cli/index.ts metrics src --format toon
bun src/cli/index.ts metrics src --format html   # emits the history report
```

Options include `--exclude-under N` and `--config <path>`. See [CLI reference](./cli.md).

## Gates

`maid gate [path]` checks FTA results against configured thresholds:

- `metrics.thresholds.maxCyclomatic`
- `metrics.thresholds.minFtaScore`

```bash
bun src/cli/index.ts gate src
```

- Exit `0` when all checked files pass.
- Exit non-zero when there are violations (details printed to stderr).

**Important:** an FTA gate pass/fail is about _source metric thresholds_. It is **not** the same as test pass/fail counts.

## Test-runner integration (snapshots)

When saving snapshots (`--save` or `--pending`), MAID can run the configured test command (`metrics.testCommand`, default `bun run test`) and store the parsed counts alongside FTA:

```bash
bun src/cli/index.ts metrics src --save
bun src/cli/index.ts metrics src --pending --test-command "bun test"
bun src/cli/index.ts metrics src --pending --no-tests   # omit test collection
```

- Test failures are recorded as measurement data (a failed run can still produce a snapshot).
- The report and history use **recorded test-runner counts**; they do not treat FTA gate thresholds as “tests passed”.
- Parsing supports Bun-style and Node `--test` TAP-style summaries (see `src/metrics/test-runner.ts`).

## Benchmarking

`maid benchmark` (and MCP `benchmark`) compares the current snapshot against a baseline and the configurable targets in `insights.benchmark`:

```bash
maid benchmark
maid benchmark --baseline first
maid benchmark --snapshot HEAD --format toon
```

The payload reports current/baseline values, deltas, target pass/fail, per-test fixed/broken/added/removed outcomes, and a short recent trend (last five snapshots). The baseline defaults to the previous commit; `first`, `head`, `pending`, or an explicit commit are also accepted.

## Composite score

`maid score` (and MCP `score`) combines six weighted components into a transparent 0-100 score:

| Component | Meaning |
|---|---|
| `gate` | Fraction of files passing the configured FTA gate thresholds. |
| `fta` | Average FTA score normalized to 0-1. |
| `complexity` | Average cyclomatic complexity relative to `metrics.thresholds.maxCyclomatic`. |
| `tests` | Test pass rate. |
| `trend` | Fraction of benchmark targets met versus the baseline. |
| `dependencies` | Dependency impact (unchanged/improved = 1; penalties reduce it). |

Weights, grade cutoffs, and `missingDataCredit` are configurable in `insights.score`. The payload lists each component's normalized value, weight, and point contribution, so the score is auditable rather than opaque.

## Dependency guidance

`maid dependencies` (and MCP `dependencies`) compares `package.json` (configurable via `insights.dependencies.manifests`) against the baseline commit:

- Runtime/dev/optional/peer additions subtract configurable points; removals add points.
- `allow` dependencies take half the normal penalty; `deny` dependencies double it and are called out in guidance.
- Reducing LOC by `offset.minLinesReduced` or average cyclomatic complexity by `offset.minCyclomaticReduced` earns `offset.bonusPerDependency` per added dependency.
- The payload reports `scoreDelta`, and the `score` tool folds it into its `dependencies` component.

Only manifests with a matching adapter are scanned; `package.json` is supported today. Additional ecosystems can be added by extending the adapter table in `src/insights/dependencies.ts`.

## Commit guidance

`maid commit-guide` (and MCP `commit_guide`, plus the `commit-guidance` prompt) checks whether the working tree is ready to commit:

- Required blockers: pending snapshot present, tests passing, and gate passing (each configurable under `insights.commit`).
- Warnings: commit size beyond `maxChangedFiles`/`maxChangedLines`, and dependency manifest changes mixed with other files.
- Suggestions: split the change into focused commits (dependencies, code by directory, tests, docs, analytics), each with a conventional commit message.
- `ready` is true only when there are no blockers, no size/separation warnings, and something to commit.

Commit guidance deliberately reuses the benchmark and dependency analysis, so the same project state produces consistent recommendations across `status`, `benchmark`, `score`, `dependencies`, and `commit-guide`.
