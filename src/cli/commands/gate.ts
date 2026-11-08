/**
 * `maaidd gate [path]` — enforce metric thresholds; exit 1 on violations.
 */
import { buildCommand } from "@stricli/core";
import { runFta } from "../../metrics/fta.ts";
import { checkGate } from "../../metrics/gate.ts";
import { loadConfig } from "../../config.ts";

const gateCommand = buildCommand({
  docs: {
    brief: "Enforce FTA metric thresholds; exits 1 on violations",
  },
  parameters: {
    flags: {
      excludeUnder: {
        kind: "parsed",
        parse: (input: string) => input,
        brief: "Exclude files under N lines",
        placeholder: "N",
        optional: true,
      },
      config: {
        kind: "parsed",
        parse: (input: string) => input,
        brief: "Path to maaidd.config.json",
        placeholder: "path",
        optional: true,
      },
    },
    positional: {
      kind: "array",
      parameter: {
        parse: String,
        brief: "Path to analyze (default: src)",
        optional: true,
      },
    },
  } as any,
  func: (flags: any, ...paths: string[]) => {
    const stdout = (s: string) => process.stdout.write(s + "\n");
    const stderr = (s: string) => process.stderr.write(s + "\n");

    const config = flags.config ? loadConfig(flags.config) : loadConfig();
    const path = paths[0] ?? "src";
    const excludeUnder = flags.excludeUnder
      ? Number(flags.excludeUnder)
      : config.metrics.excludeUnder;

    const result = runFta(path, excludeUnder);
    const violations = checkGate(result, config.metrics.thresholds);

    if (violations.length === 0) {
      stdout(`Gate passed: ${result.total} files checked`);
      return;
    }

    stderr(
      `Gate failed: ${violations.length} violation${violations.length === 1 ? "" : "s"}`,
    );
    for (const v of violations) {
      stderr(`  ${v.message}`);
    }
    process.exitCode = 1;
  },
});

export { gateCommand };
