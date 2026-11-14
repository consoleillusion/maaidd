# Insights: status, benchmark, score, dependencies, and commit guidance

MAID's insight layer is a thin, deterministic interface over the same project state. **The CLI is a first-class interface**: every command below is backed by the same core function as its MCP tool and returns the same payload. You can use MAID entirely from the CLI, or let an agent consume the identical surface over MCP.

| CLI command | MCP tool | Purpose |
|---|---|---|
| `maid status` | `status` | One-call project, snapshot, git, benchmark, score, dependency, and commit summary. |
| `maid benchmark` | `benchmark` | Compare current metrics and per-test outcomes against a baseline and targets. |
| `maid score` | `score` | Transparent 0-100 composite score with configurable weights and grades. |
| `maid dependencies` | `dependencies` | Dependency additions/removals and library-selection guidance. |
| `maid commit-guide` | `commit_guide` | Commit readiness, size checks, split suggestions, and a suggested message. |

Every command supports `--format json|toon`. The canonical payload is deterministic JSON; `toon` is a token-efficient encoding for agents. MCP tools use the same parameter names (`format`, `baseline`, `snapshot`, `detail`, `sections`).

## Data sources

Insight commands read the same state:

- `maid.project.json` and the effective `maid.config.json`.
- Snapshots in `./maid.db` (pending as `current`, HEAD, and history).
- The git working tree.
- The current dependency manifest.

The default current snapshot is **pending**, then **HEAD**, then the latest history entry. The default benchmark baseline is the **previous commit**; `first`, `head`, `pending`, or an explicit commit are also accepted.

## `status`

```bash
maid status
maid status --section snapshot,score --detail full
maid status --format toon
```

Sections: `project`, `snapshot`, `git`, `benchmark`, `score`, `dependencies`, `commit`. The default includes all sections in compact form; `--detail full` returns the dedicated tools' full payloads. The top-level `next` list is the shortest recommended action sequence.

## `benchmark`

```bash
maid benchmark
maid benchmark --baseline first
maid benchmark --snapshot HEAD --format toon
```

The payload reports:

- Current and baseline snapshots (tests, LOC, cyclomatic complexity, FTA, Halstead bugs).
- Metric deltas and pass/fail against `insights.benchmark.targets`.
- Per-test fixed/broken/added/removed outcomes (counts plus names; `--detail full` avoids truncation).
- A short trend over the last five snapshots.

Targets are explicit and configurable, so an agent can be held to a stable definition of "better" rather than improvising one.

## `score`

```bash
maid score
maid score --format toon
```

The composite score combines six components:

| Component | Meaning |
|---|---|
| `gate` | Fraction of files passing the configured FTA gate thresholds. |
| `fta` | Average FTA score normalized to 0-1. |
| `complexity` | Average cyclomatic complexity relative to `metrics.thresholds.maxCyclomatic`. |
| `tests` | Test pass rate. |
| `trend` | Fraction of benchmark targets met versus the baseline. |
| `dependencies` | Dependency impact; unchanged/improved starts at 1 and penalties reduce it. |

Each component reports its normalized value, weight, and point contribution. Weights, grade cutoffs, and `missingDataCredit` live in `insights.score`.

## `dependencies`

```bash
maid dependencies
maid dependencies --baseline first
```

Dependency changes are compared against the baseline manifest. `package.json` is supported today behind an adapter table in `src/insights/dependencies.ts`; additional ecosystems can be added there.

- Runtime/dev/optional/peer additions subtract configurable points.
- Removals add points.
- `allow` dependencies take half penalty; `deny` dependencies double it and are called out.
- Reducing LOC or average cyclomatic complexity by the configured offset earns a bonus per added dependency.
- The payload includes `scoreDelta`, the exact changes, and guidance; `score` folds this into its `dependencies` component.

## `commit-guide`

```bash
maid commit-guide
maid commit-guide --detail full
```

Checks:

- **Blockers** (configurable): pending snapshot present, tests passing, gate passing.
- **Warnings**: commit larger than `insights.commit.maxChangedFiles` / `maxChangedLines`, dependency manifest changes mixed with other files.
- **Suggestions**: split commits by dependency, code directory, tests, docs, and analytics, each with a conventional commit message.

`ready` is true only when there are no blockers, no size/separation warnings, and something to commit. The MCP server also exposes a `commit-guidance` prompt that tells an agent to call `commit_guide`, `benchmark`, and `score` before committing and to finalize the snapshot afterwards.

## Suggested iteration loop

```bash
# 1. Check the current state
maid status

# 2. Make a small change, then measure it
maid metrics src --pending

# 3. Compare against the previous commit
maid benchmark

# 4. Check the composite score
maid score

# 5. Check whether the commit is appropriately small
maid commit-guide

# 6. Commit, then finalize the snapshot for the new commit
git commit -m "..."
maid metrics --finalize

# 7. Confirm the final state
maid status
```

The same loop works over MCP with `status`, `metrics`, `benchmark`, `score`, `commit_guide`, and the finalize flow.

## Configuration

All insight behavior is configurable in `maid.config.json` under `insights`:

```json
{
  "insights": {
    "benchmark": {
      "baseline": "previous",
      "targets": { "minTestPassRate": 1, "maxCyclomaticDelta": 0 }
    },
    "score": {
      "weights": { "gate": 25, "fta": 20, "complexity": 15, "tests": 25, "trend": 10, "dependencies": 5 }
    },
    "dependencies": {
      "manifests": ["package.json"],
      "allow": ["zod"],
      "deny": ["left-pad"]
    },
    "commit": {
      "maxChangedFiles": 10,
      "maxChangedLines": 300
    }
  }
}
```

Partial overrides are deep-merged over defaults and validated on load. See [Configuration](./configuration.md#insights) for every key.
