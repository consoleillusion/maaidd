/**
 * MAID CLI application — Stricli route map.
 */
import { buildApplication, buildRouteMap } from "@stricli/core";
import { formatCommand } from "./commands/format.ts";
import { checkCommand } from "./commands/check.ts";
import { metricsCommand } from "./commands/metrics.ts";
import { gateCommand } from "./commands/gate.ts";
import { reportCommand } from "./commands/report.ts";
import { mcpCommand } from "./commands/mcp.ts";
import { graphCommand } from "./commands/graph.ts";
import { initCommand } from "./commands/init.ts";
import { completionCommand } from "./commands/completion.ts";
export function buildApp() {
  const routes = buildRouteMap({
    routes: {
      format: formatCommand,
      check: checkCommand,
      metrics: metricsCommand,
      gate: gateCommand,
      report: reportCommand,
      mcp: mcpCommand,
      graph: graphCommand,
      init: initCommand,
      completion: completionCommand,
    },
    docs: {
      brief: "MAID — Metric Assisted AI Driven Development",
      fullDescription:
        "Guided project context initialization, Biome-first formatting, optional Dhall/Haskell-style leading commas, FTA code metrics, gates, uplot history reports, and an MCP server exposing project context plus codegraph and analytics.",
    },
  });
  return buildApplication(routes, {
    name: "maid",
    versionInfo: { currentVersion: "0.1.0" },
    scanner: {
      // Keep Stricli's camelCase API while accepting documented --kebab-case flags.
      caseStyle: "allow-kebab-for-camel",
    },
    documentation: { caseStyle: "convert-camel-to-kebab" },
  });
}
