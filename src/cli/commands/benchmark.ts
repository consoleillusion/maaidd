/**
 * `maid benchmark` — compare the current snapshot against a baseline.
 *
 * CLI counterpart of the MCP `benchmark` tool; both use the same core payload.
 */
import { buildCommand } from "@stricli/core";
import {
  getBenchmark,
  renderInsight,
  type InsightFormat,
} from "../../insights/index.ts";

const benchmarkCommand = buildCommand({
  docs: {
    brief:
      "Benchmark current metrics against a baseline and configured targets",
    fullDescription:
      "Returns the same structured payload as the MCP `benchmark` tool. The baseline defaults to insights.benchmark.baseline (normally the previous commit).",
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
      detail: {
        kind: "enum",
        values: ["summary", "full"],
        brief: "Test-change detail (default: summary)",
        optional: true,
      },
    },
  } as any,
  func: (flags: any) => {
    const payload = getBenchmark({
      root: process.cwd(),
      baseline: flags.baseline,
      snapshot: flags.snapshot,
      detail: flags.detail === "full" ? "full" : "summary",
    });
    process.stdout.write(
      `${renderInsight(payload, (flags.format ?? "json") as InsightFormat)}\n`,
    );
  },
});

export { benchmarkCommand };
