/**
 * `maid status` — project, snapshot, and iteration status.
 *
 * This is the CLI counterpart of the MCP `status` tool and uses the same
 * payload-producing core.
 */
import { buildCommand } from "@stricli/core";
import {
  getStatus,
  renderInsight,
  type InsightFormat,
} from "../../insights/index.ts";

const split = (value: unknown): string[] =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const statusCommand = buildCommand({
  docs: {
    brief: "Show project, snapshot, and iteration status",
    fullDescription:
      "Reports the same structured payload as the MCP `status` tool. Use --format toon for token-efficient output and --section/--detail to control the payload.",
  },
  parameters: {
    flags: {
      format: {
        kind: "enum",
        values: ["json", "toon"],
        brief: "Output format (default: json)",
        optional: true,
      },
      section: {
        kind: "parsed",
        parse: String,
        brief:
          "Comma-separated sections (project,snapshot,git,benchmark,score,dependencies,commit)",
        placeholder: "list",
        optional: true,
      },
      detail: {
        kind: "enum",
        values: ["summary", "full"],
        brief: "Payload detail (default: summary)",
        optional: true,
      },
    },
  } as any,
  func: (flags: any) => {
    const payload = getStatus({
      root: process.cwd(),
      sections: split(flags.section),
      detail: flags.detail === "full" ? "full" : "summary",
    });
    process.stdout.write(
      `${renderInsight(payload, (flags.format ?? "json") as InsightFormat)}\n`,
    );
  },
});

export { statusCommand };
