<!-- Generated from maid.project.json and maid.config.json by maid. Do not edit directly. -->

# init-demo

## Goal

_Not set._

## Scope

### In scope

_None recorded._

### Out of scope

_None recorded._

## Software

- **Languages:** TypeScript
- **Runtime:** bun
- **Package manager:** bun
- **Frameworks:** _None recorded._
- **Test command:** `bun test`
- **Build command:** _Not set._

## Design

### Summary

_Not set._

### Principles

- Prefer small, focused modules with clear boundaries.
- Keep behavior covered by tests and measurable with maid metrics and gates.
- Avoid unnecessary dependencies; justify additions.

### Architecture

_Not set._

## Constraints

_None recorded._

## Best practices

### Git commits

Make small, atomic commits. Use an imperative subject line (72 characters or fewer) and explain why in the body. Run tests and `maid gate` before committing. Capture a pending snapshot before a commit and finalize after.

### Formatting

Run `maid format` and `maid check`; Biome is the source of truth for formatting.

### Testing

Keep the full test suite passing and add or update tests for behavior changes.

### Documentation

Update README or docs for user-visible or workflow changes.

## Tooling

- **Style:** `biome`
- **Indent:** `2 spaces`
- **Line width:** `80`
- **Semicolons:** `yes`
- **Quote style:** `double`
- **Trailing commas:** `all`
- **To arrow:** `no`
- **Biome:** `yes`
- **Functional comma style:** `leading`
- **Functional object value indent:** `1`
- **Functional array value indent:** `2`
- **Functional force blank lines:** `yes`
- **Functional semicolons:** `yes`
- **Functional max inline array items:** `3`
- **Metrics exclude under:** `0`
- **Metrics test command:** `bun run test`
- **Max cyclomatic:** `20`
- **Min FTA score:** `50`
- **MCP codegraph:** `yes`
- **MCP metrics:** `yes`

## Insights

- **Benchmark baseline:** `previous`
- **Score weights:** `gate=25, fta=20, complexity=15, tests=25, trend=10, dependencies=5`
- **Dependency manifests:** `package.json`
- **Commit limits:** `10 files / 300 lines`
