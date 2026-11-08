# Snapshots and reports

## Storage: embedded SQLite

Per-commit metric snapshots are stored in an embedded SQLite database:

- **Path:** `metric/maaidd.db` (under the `metric/` directory)
- **Engine:** Bun `bun:sqlite`

Snapshots contain:
- commit SHA, creation time, schema version
- **FTA** results (files/metrics, totals/averages)
- **Test-runner** summary (optional; `null` when not collected)

## Legacy JSON import (non-destructive)

If `metric/` contains legacy files, MAAIDD imports them automatically on access:

- `metric/<commit>.json` — either a legacy raw FTA array or a versioned snapshot document
- `metric/.pending.json` — imported as pending state if applicable

Imported JSON files are **not deleted**.

## Snapshot lifecycle

```bash
# Save for current HEAD (fails if snapshot exists unless --force)
bun src/cli/index.ts metrics src --save [--force] [--no-tests] [--test-command "..."]

# Capture before commit (HEAD/SHA not finalized for the new commit)
bun src/cli/index.ts metrics src --pending [--no-tests] [--test-command "..."]

# Finalize pending snapshot to current HEAD
bun src/cli/index.ts metrics --finalize [--force]
```

Behavior notes:
- Commits are validated as git SHAs; saving requires a resolvable `HEAD` when using `--save`/`--finalize` (see `src/metrics/history.ts` / store implementation).
- Existing snapshots are protected unless `--force` is provided.

## `cli.sh` helpers

`cli.sh` provides `precommit`, `postcommit`, and `commit` helpers that format and record snapshots via `maaidd metrics --pending/--finalize` (SQLite-backed).

## Reports (uPlot)

`maaidd report` generates a self-contained HTML dashboard from stored snapshots:

```bash
bun src/cli/index.ts report -o metric/report.html
```

- **X-axis:** git commits in chronological order.
- **Series include:** test totals/passed/failed/skipped (when recorded), files passing/failing the FTA gate, total files, LOC, avg/max cyclomatic, avg FTA score, avg Halstead difficulty/volume, total Halstead bugs.
- Missing test data (legacy snapshots) is shown as gaps (`null`), not zero.
- “Files passing/failing gate” are FTA threshold results — distinct from test-runner pass/fail.

Implementation: `src/metrics/report.ts` + `src/metrics/history.ts` (store).
