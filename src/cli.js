#!/usr/bin/env bun
/**
 * Legacy MAAIDD entry point — forwards to the Stricli CLI.
 * Prefer: `maaidd` / `bun src/cli/index.ts`.
 */
await import("./cli/index.ts");
