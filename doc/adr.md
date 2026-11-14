---
status: accepted
date: 2026-11-08
decision-makers: consoleillusion
consulted: []
informed: []
---

# Agent-facing iteration interface: constrained formatting, measurable feedback, and token-efficient analytics

## Context and Problem Statement

`maid` (Metric Assisted AI Driven Development) exists to present an **interface through which an agent can intelligently iterate on a codebase, making wise decisions, using fewer tokens, and within a strict set of constraints**.

The problem is how to provide that interface concretely: agents need deterministic constraints (format/style, quality gates), reliable measurable feedback (complexity/FTA, test pass/fail and *which* tests, trends including the latest in-progress state), and outputs that are practical to consume without excessive token cost (CLI/MCP-accessible, structured/machine-readable where supported, stable schemas). These capabilities must work with Git’s realities (commit hashes unknown pre-commit) and remain correct (formatting transforms must preserve semantics). Key components: `src/cli/*`, `src/mcp/*`, `src/metrics/*`, `src/style/*`, `scripts/hooks/*`, `./maid.db`, `docs/cli.md`.

## Decision Drivers

* **Agent iteration loop:** expose tools/commands an agent can use repeatedly to assess state, apply constraints, and decide next actions (format/check, metrics, gate, history/report, codegraph/MCP).
* **Wise decisions via measurable feedback:** FTA (cyclomatic, Halstead, score, LOC, assessment), gate thresholds, test counts **and which tests pass/fail for every snapshot**, and commit/pending history trends.
* **Fewer tokens / efficient consumption:** machine-readable and compact outputs where available (e.g. `--format json`/`toon`/structured CLI/MCP results, stable snapshot schema), focused diagnostics, and deterministic formatting to reduce noisy diffs/churn.
* **Strict constraints:** Biome-first normalization; optional functional/leading-comma layout as a constrained diff over normalization; configurable thresholds/gates; hook-enforced pre-commit capture and post-commit finalization; semantically-correct printer behavior (operator precedence/parenthesization, valid TS/JS output).
* **Git-compatible “current” feedback:** latest analytics must be visible before a hash exists (labeled `current`) without amending/rewriting history by default.
* **Portability/back-compat:** embedded SQLite `./maid.db` (normalized per-test storage) with legacy JSON import and tolerant handling of older/count-only data.

## Considered Options

* **Iteration feedback model:** A) pending snapshot rendered as `current` + finalize to `HEAD` staged for next commit (no amend); B) finalize + `git amend` to same commit; C) separate metrics commits; D) git-tracked text snapshots with DB cache.
* **Per-test detail:** record counts only vs. record *which* tests pass/fail per snapshot in normalized tables (`test_cases`, `snapshot_tests`) plus summary counts.
* **Formatting constraint:** Biome-only vs. Biome-first normalization with a constrained functional printer pass (must preserve semantics).

## Decision Outcome

Chosen option: **A (pending-as-`current`, no amend) + normalized per-test SQLite storage + Biome-first constrained formatting**, because it gives agents immediate, hash-independent “current” feedback and durable per-snapshot test identity for wise decisions, enforces strict/deterministic constraints, and avoids history rewrites — while keeping data queryable and outputs/tooling suitable for agent consumption.

### Consequences

* Good, because agents get a tight loop: constrained `format`/`check`/`gate`, measurable `metrics`/history (including *which* tests), and `current` (pending) visibility in report/history before a commit hash exists.
* Good, because per-test results are stored for **every snapshot** in normalized tables keyed by test hierarchy (`file`, `suite/classname`, `name`) with per-snapshot status/duration/error, supporting precise diagnosis rather than counts alone.
* Good, because tracked hooks (`scripts/hooks/pre-commit`, `post-commit`, installed via `maid init --hooks`) automate capture/finalization within explicit constraints (no amend); `MAID_SKIP_HOOKS` and rebase/merge guards reduce risk.
* Good, because formatter correctness fixes (precedence/parenthesization, Babel 8 TS/return/type-arg handling, `=> ({})`/call/member safety) protect the “strict constraints” guarantee that transformations remain valid.
* Bad/neutral, because finalized hash binding is typically staged into the **next** commit (by design) and `maid.db` is a changing binary-ish artifact (merge friction possible).
* Bad/neutral, because default Bun test flow captures per-test detail via JUnit; incompatible custom `--test-command` falls back to counts-only for per-test names.

### Confirmation

* Automated: `bun test` (store/history/report/CLI/test-runner/functional printer specs, including `spec/per-test-snapshots.test.ts` for per-test-per-snapshot, pending-as-`current`, finalize remapping, and report details).
* Constraint checks: `maid check`/`format`, `maid gate`, functional `format --style functional [--no-semicolons]` over `src` with `tsc --noEmit`/tests as applicable.
* Agent interface: CLI help/docs (`docs/cli.md`, Stricli-generated), MCP tools, and report generation (`maid report --output metrics-report.html`, pending labeled `current`).

## Pros and Cons of the Options

### A. Pending-as-`current`, no amend
* Good, because stable SHAs and immediate `current` feedback for agents.
* Good, because aligns with pre-commit/post-commit Git semantics.
* Neutral, because hash is attached via finalize staged for next commit.
* Bad, because requires discipline around `maid.db` updates.

### B. Amend to same commit
* Good, because hash and DB can co-locate in one amended commit.
* Bad, because rewritten SHAs harm shared/history-safe workflows; hook complexity.

### C/D. Separate commits or text snapshots + DB cache
* Good, because can reduce binary churn (D) or avoid amend (C).
* Bad, because C adds noise; D requires larger refactor/migration.

## More Information

* Agent-facing surfaces: `maid` CLI (Stricli, `docs/cli.md`), MCP server (`src/mcp/server.ts`), metrics/gate/report/history (`src/metrics/*`), formatter (`src/style/*`), hooks (`scripts/hooks/*`, `init --hooks`).
* DB: `./maid.db` — `snapshots`, `test_cases`, `snapshot_tests`; `__pending__` rendered as `current`. WAL/SHM patterns ignored per `.gitignore`.
* Revisit if: token/output efficiency needs stronger compact formats by default, `maid.db` merge conflicts motivate text-snapshot storage (D), or custom test reporters require per-test adapters.
