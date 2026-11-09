/**
 * MCP server — exposes project initialization, codegraph, and metrics tools to
 * AI agents.
 */

import { existsSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  codegraphIndexPath,
  codegraphStatus,
  runCodegraph,
} from "../codegraph.ts";
import { loadConfig } from "../config.ts";
import { runFta } from "../metrics/fta.ts";
import { checkGate } from "../metrics/gate.ts";
import { readAggregatedHistory } from "../metrics/history.ts";
import { metricsToToon } from "../metrics/toon.ts";
import {
  buildSetupPlan,
  ConfigPatchSchema,
  findProjectRoot,
  ProjectInputSchema,
  projectFileExists,
  readProjectContext,
  updateProject,
} from "../project.ts";

const projectInstructions = (): string => {
  if (!projectFileExists()) {
    return [
      "MAAIDD project context is not initialized.",
      "Before starting design or implementation work, call `project_init`.",
      "Ask only the required questions and apply the returned defaults without prompting.",
      "Do not ask about defaults such as git commit practice, formatting, or testing expectations.",
      'Call `project_init` with `include: "optional"` only if the user wants to review the optional settings catalog.',
      "Save the result with `project_update`.",
    ].join(" ");
  }
  return [
    "MAAIDD project context is loaded from maaidd.project.json.",
    "Call `project_read` before major design, scope, or constraint decisions.",
    "Use `project_update` when the project context changes; it deterministically regenerates PROJECT.md.",
  ].join(" ");
};

const errorResult = (err: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: `Error: ${err instanceof Error ? err.message : String(err)}`,
    },
  ],
  isError: true,
});

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: "maaidd", version: "0.1.0" },
    { instructions: projectInstructions() },
  );
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
  // project_init — pull-based project setup plan.
  server.registerTool(
    "project_init",
    {
      title: "Initialize project context",
      description:
        "Start guided project initialization. Returns required questions, repository-detected software, automatic defaults, and optionally the optional settings catalog. Call this before other work when maaidd.project.json is missing.",
      inputSchema: {
        include: z
          .enum(["required", "optional", "all"])
          .default("required")
          .describe(
            "Use 'required' for required questions and defaults; use 'optional' only when the user wants to review additional settings.",
          ),
      },
    },
    async ({ include }) => {
      try {
        const plan = buildSetupPlan(findProjectRoot(), include);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(plan, null, 2) },
          ],
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );
  // project_update — merge/save project context and optional tooling overrides.
  server.registerTool(
    "project_update",
    {
      title: "Save project context",
      description:
        "Validate and save project context (goal, scope, software, design, constraints, best practices) and optional maaidd.config.json overrides. Deterministically regenerates PROJECT.md.",
      inputSchema: {
        project: ProjectInputSchema.optional().describe(
          "Project fields to merge into maaidd.project.json.",
        ),
        config: ConfigPatchSchema.optional().describe(
          "Optional tooling overrides to merge into maaidd.config.json.",
        ),
        dryRun: z
          .boolean()
          .default(false)
          .describe("Validate and render without writing files."),
      },
    },
    async ({ project, config, dryRun }) => {
      try {
        const result = updateProject({
          root: findProjectRoot(),
          project,
          config,
          dryRun,
        });
        const payload = {
          status: result.status,
          missing: result.missing,
          projectFile: result.projectFile,
          projectDoc: result.projectDoc,
          written: result.written,
          dryRun: result.dryRun,
          ...(result.dryRun
            ? { project: result.project, markdown: result.markdown }
            : {}),
          next:
            result.status === "complete"
              ? "Project context is complete."
              : "Call project_init for the remaining required questions.",
        };
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(payload, null, 2) },
          ],
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );
  // project_read — read the saved context and optionally verify generated docs.
  server.registerTool(
    "project_read",
    {
      title: "Read project context",
      description:
        "Read the saved project context as Markdown (default) or JSON, and optionally verify that PROJECT.md is in sync with maaidd.project.json and maaidd.config.json.",
      inputSchema: {
        format: z
          .enum(["markdown", "json"])
          .default("markdown")
          .describe("Project representation to return."),
        verify: z
          .boolean()
          .default(false)
          .describe("Include whether PROJECT.md is in sync."),
      },
    },
    async ({ format, verify }) => {
      try {
        const result = readProjectContext(findProjectRoot());
        if (!result.project) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No project context found. Call \`project_init\` to initialize ${result.projectFile}.`,
              },
            ],
          };
        }
        const payload = {
          status: result.status,
          missing: result.missing,
          projectFile: result.projectFile,
          projectDoc: result.projectDoc,
          ...(verify ? { docInSync: result.docInSync } : {}),
          project: format === "json" ? result.project : result.markdown,
          next:
            verify && !result.docInSync
              ? "PROJECT.md is out of sync. Call project_update to regenerate it deterministically."
              : undefined,
        };
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(payload, null, 2) },
          ],
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );
  // Optional prompt for clients that expose MCP prompts.
  server.registerPrompt(
    "initialize-project",
    {
      title: "Initialize MAAIDD project context",
      description:
        "Guide the caller through goal, scope, software, design, constraints, and best practices.",
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Initialize this project for MAAIDD.",
              "Call `project_init` and ask the user only for the required fields.",
              "Apply the returned defaults without prompting for them (for example git commit practice).",
              'Offer the optional settings catalog only if the user wants to review more configuration: call `project_init` with { include: "optional" }.',
              "Persist the result with `project_update`.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
  return server;
}
export async function runMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
