/**
 * MCP server — exposes codegraph + metrics tools to AI agents.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runFta } from "../metrics/fta.ts";
import { checkGate } from "../metrics/gate.ts";
import { metricsToToon } from "../metrics/toon.ts";
import { readAggregatedHistory } from "../metrics/history.ts";
import { loadConfig } from "../config.ts";
import { existsSync } from "node:fs";
import {
  codegraphIndexPath,
  codegraphStatus,
  runCodegraph,
} from "../codegraph.ts";
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "maaidd", version: "0.1.0" });
  // metrics tool — run FTA and return results
  server.tool(
    "metrics",
    "Run FTA code metrics on a path and return the results",
    {
      path: z.string().default("src").describe("Path to analyze"),
      format: z
        .enum(["json", "toon", "table"])
        .default("json")
        .describe("Output format"),
    },
    async ({ path, format }) => {
      const config = loadConfig();
      try {
        const result = runFta(path, config.metrics.excludeUnder);
        let text: string;
        if (format === "toon") {
          text = metricsToToon(result);
        } else if (format === "table") {
          text = result.metrics
            .sort((a, b) => a.file_name.localeCompare(b.file_name))
            .map(
              (m) =>
                `  ${m.file_name.padEnd(40)}  cyclo=${String(m.cyclo).padStart(3)}  fta=${m.fta_score.toFixed(1).padStart(6)}  ${m.assessment}`,
            )
            .join("\n");
        } else {
          text = JSON.stringify(result, null, 2);
        }
        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
  // gate tool — check thresholds
  server.tool(
    "gate",
    "Check code metrics against configured thresholds",
    { path: z.string().default("src").describe("Path to check") },
    async ({ path }) => {
      const config = loadConfig();
      try {
        const result = runFta(path, config.metrics.excludeUnder);
        const violations = checkGate(result, config.metrics.thresholds);
        const passed = violations.length === 0;
        const text = passed
          ? `Gate passed: ${result.total} files checked`
          : `Gate failed: ${violations.length} violations\n${violations.map((v) => `  ${v.message}`).join("\n")}`;
        return { content: [{ type: "text" as const, text }], isError: !passed };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
  // history tool — read metric snapshots with aggregated trend values
  server.tool(
    "history",
    "Read aggregated metric history snapshots from maaidd.db (per-commit trend: tests, lines of code, cyclo, FTA score, Halstead)",
    {},
    async () => {
      const config = loadConfig();
      const history = readAggregatedHistory(".", config.metrics.thresholds);
      if (!history.length) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No metric history found (maaidd.db).",
            },
          ],
        };
      }
      const text = history
        .map((s) => {
          const tests =
            s.testsTotal === null
              ? "tests=n/a"
              : `tests=${s.testsPassed ?? "?"}/${s.testsTotal}, failed=${s.testsFailed ?? "?"}`;
          return `${s.shortSha}: ${tests}, ${s.totalFiles} files, ${s.totalLines} lines, gate=${s.passing}/${s.totalFiles}, avg cyclo=${s.avgCyclo.toFixed(1)}, max cyclo=${s.maxCyclo}, avg FTA=${s.avgFtaScore.toFixed(1)}`;
        })
        .join("\n");
      return { content: [{ type: "text" as const, text }] };
    },
  );
  // codegraph tool — run code-graph commands or inspect the local index.
  server.tool(
    "codegraph",
    "Run code-graph queries and inspect index status/recommendations",
    {
      query: z
        .string()
        .optional()
        .describe("Simple code-graph command, e.g. 'map' or 'search format'"),
      args: z
        .array(z.string())
        .optional()
        .describe(
          "Exact code-graph argv; preferred when arguments contain spaces",
        ),
    },
    async ({ query, args }) => {
      const indexDb = codegraphIndexPath();
      if (!existsSync(indexDb)) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No code-graph index found. Run `bunx @sdsrs/code-graph incremental-index` to build one.",
            },
          ],
          isError: true,
        };
      }
      const commandArgs =
        args ?? (query?.trim() ? query.trim().split(/\s+/) : []);
      if (commandArgs.length === 0) {
        return {
          content: [{ type: "text" as const, text: codegraphStatus() }],
        };
      }
      const result = runCodegraph(commandArgs);
      const output = [result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n")
        .trim();
      const text = result.error
        ? `Unable to run code-graph: ${result.error}\n${codegraphStatus()}`
        : output || `code-graph exited with status ${result.status}`;
      return {
        content: [{ type: "text" as const, text }],
        isError: result.status !== 0 || Boolean(result.error),
      };
    },
  );
  return server;
}
export async function runMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
