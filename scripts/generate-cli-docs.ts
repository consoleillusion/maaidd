#!/usr/bin/env bun
/**
 * Generate `docs/cli.md` using Stricli's built-in documentation APIs.
 *
 * Usage:
 *   bun scripts/generate-cli-docs.ts
 *   bun scripts/generate-cli-docs.ts --check
 */
import { generateHelpTextForAllCommands } from "@stricli/core";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildApp } from "../src/cli/app.ts";

const OUT = join(import.meta.dir, "..", "docs", "cli.md");

function render(): string {
  const app = buildApp();
  const fmt = {
    useAliasInUsageLine: false,
    onlyRequiredInUsageLine: false,
    caseStyle: "convert-camel-to-kebab" as const,
  };
  const rootHelp = app.root.formatHelp({
    prefix: ["maid"],
    config: fmt,
    ansiColor: false,
    text: app.defaultText,
    additionalFlags: [],
    includeArgumentEscapeSequenceFlag: true,
    includeHidden: false,
  });
  const commands = generateHelpTextForAllCommands(app);
  const lines = [
    "# CLI reference (`maid`)",
    "",
    "> Generated with Stricli built-ins (`generateHelpTextForAllCommands`, `formatHelp`). Run `bun scripts/generate-cli-docs.ts`.",
    "",
    "## `maid`",
    "",
    "```text",
    rootHelp.trimEnd(),
    "```",
    "",
  ];
  for (const [route, helpText] of commands) {
    lines.push(`## \`${route}\``, "", "```text", helpText.trimEnd(), "```", "");
  }
  return lines.join("\n");
}

const next = render();
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {}
  if (current !== next) {
    process.stderr.write(
      "docs/cli.md is stale. Run: bun scripts/generate-cli-docs.ts\n",
    );
    process.exit(1);
  }
  process.stdout.write("docs/cli.md is up to date.\n");
} else {
  writeFileSync(OUT, next, "utf8");
  process.stdout.write(`Wrote ${OUT}\n`);
}
