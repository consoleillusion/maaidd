#!/usr/bin/env bun
/**
 * MAAIDD CLI entry point.
 */
import { run } from "@stricli/core";
import { buildApp } from "./app.ts";

const app = buildApp();

// Pass the real process so Stricli can propagate command failures to exitCode.
await run(app, process.argv.slice(2), { process });