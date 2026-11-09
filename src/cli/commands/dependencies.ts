/**
 * `maid dependencies` — dependency changes and library-selection guidance.
 *
 * CLI counterpart of the MCP `dependencies` tool; both use the same core.
 */
import { buildCommand } from "@stricli/core";
import {
  getDependencies,
  renderInsight,
  type InsightFormat,
} from "../../insights/index.ts";

const dependenciesCommand = buildCommand({
  docs: {
    brief: "Show dependency changes and library-selection guidance",
    fullDescription:
      "Returns the same structured payload as the MCP `dependencies` tool: added/removed/changed dependencies, transparent score impact, and guidance.",
  },
  parameters: {
    flags: {
      baseline: {
        kind: "parsed",
        parse: String,
        brief: "Baseline selector: previous, first, head, pending, or a commit",
        placeholder: "ref",
        optional: true,
      },
      snapshot: {
        kind: "parsed",
        parse: String,
        brief: "Current snapshot selector (default: pending, else HEAD)",
        placeholder: "ref",
        optional: true,
      },
      format: {
        kind: "enum",
        values: ["json", "toon"],
        brief: "Output format (default: json)",
        optional: true,
      },
    },
  } as any,
  func: (flags: any) => {
    const payload = getDependencies({
      root: process.cwd(),
      baseline: flags.baseline,
      snapshot: flags.snapshot,
    });
    process.stdout.write(
      `${renderInsight(payload, (flags.format ?? "json") as InsightFormat)}\n`,
    );
  },
});

export { dependenciesCommand };
