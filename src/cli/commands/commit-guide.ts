/**
 * `maid commit-guide` — guidance for small, iterative commits.
 *
 * CLI counterpart of the MCP `commit_guide` tool; both use the same core.
 */
import { buildCommand } from "@stricli/core";
import {
  getCommitGuide,
  renderInsight,
  type InsightFormat,
} from "../../insights/index.ts";

const commitGuideCommand = buildCommand({
  docs: {
    brief: "Guide the next commit: blockers, size, split suggestions, message",
    fullDescription:
      "Returns the same structured payload as the MCP `commit_guide` tool: working-tree size, pending snapshot/test/gate checks, dependency separation, blockers, split suggestions, and a suggested commit message.",
  },
  parameters: {
    flags: {
      snapshot: {
        kind: "parsed",
        parse: String,
        brief: "Snapshot selector for test/gate checks",
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
        brief: "File detail (default: summary)",
        optional: true,
      },
    },
  } as any,
  func: (flags: any) => {
    const payload = getCommitGuide({
      root: process.cwd(),
      snapshot: flags.snapshot,
      detail: flags.detail === "full" ? "full" : "summary",
    });
    process.stdout.write(
      `${renderInsight(payload, (flags.format ?? "json") as InsightFormat)}\n`,
    );
  },
});

export { commitGuideCommand };
