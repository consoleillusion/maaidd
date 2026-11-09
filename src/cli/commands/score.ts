/**
 * `maid score` — composite commit score.
 *
 * CLI counterpart of the MCP `score` tool; both use the same core payload.
 */
import { buildCommand } from "@stricli/core";
import {
  getScore,
  renderInsight,
  type InsightFormat,
} from "../../insights/index.ts";

const scoreCommand = buildCommand({
  docs: {
    brief: "Show the composite commit score and its components",
    fullDescription:
      "Returns the same structured payload as the MCP `score` tool: gate, FTA, complexity, tests, trend, and dependency components, weighted into a 0-100 score with a configurable grade.",
  },
  parameters: {
    flags: {
      baseline: {
        kind: "parsed",
        parse: String,
        brief: "Baseline selector for trend comparison",
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
    const payload = getScore({
      root: process.cwd(),
      baseline: flags.baseline,
      snapshot: flags.snapshot,
    });
    process.stdout.write(
      `${renderInsight(payload, (flags.format ?? "json") as InsightFormat)}\n`,
    );
  },
});

export { scoreCommand };
