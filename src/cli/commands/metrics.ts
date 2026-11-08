/**
 * `maaidd metrics [path]` — FTA code metrics and per-commit project snapshots.
 */
import { buildCommand } from "@stricli/core";
import { runFta } from "../../metrics/fta.ts";
import { metricsToToon } from "../../metrics/toon.ts";
import { generateReport } from "../../metrics/report.ts";
import {
  currentCommit,
  finalizeSnapshot,
  savePendingSnapshot,
  saveSnapshot,
} from "../../metrics/history.ts";
import { runTestSuite } from "../../metrics/test-runner.ts";
import { loadConfig } from "../../config.ts";

const metricsCommand = buildCommand({
  docs: {
    brief: "Run FTA metrics; optionally save tests + metrics for a git commit",
  },
  parameters: {
    flags: {
      format: {
        kind: "enum",
        values: ["table", "json", "toon", "html"],
        brief: "Output format (default: table)",
        optional: true,
      },
      save: {
        kind: "boolean",
        optional: true,
        brief: "Save tests + FTA metrics for current HEAD (maaidd.db)",
      },
      pending: {
        kind: "boolean",
        optional: true,
        brief: "Save a pending snapshot to finalize after a commit",
      },
      finalize: {
        kind: "boolean",
        optional: true,
        brief: "Finalize the pending snapshot using the current HEAD",
      },
      force: {
        kind: "boolean",
        optional: true,
        brief: "Replace an existing snapshot for the same commit",
      },
      tests: {
        kind: "boolean",
        default: true,
        brief: "Include test-runner counts when saving (use --no-tests to omit)",
      },
      testCommand: {
        kind: "parsed",
        parse: (input: string) => input,
        brief: "Command used to collect test counts",
        placeholder: "command",
        optional: true,
      },
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
    const dbDir = ".";
    if (flags.finalize) {
      const path = finalizeSnapshot(dbDir, currentCommit(), {
        force: flags.force === true,
      });
      stderr(`Saved: ${path}`);
      return;
    }

    const path = paths[0] ?? "src";
    const fmt = flags.format ?? "table";
    const excludeUnder = flags.excludeUnder
      ? Number(flags.excludeUnder)
      : config.metrics.excludeUnder;

    const result = runFta(path, excludeUnder);

    switch (fmt) {
      case "json":
        stdout(JSON.stringify(result.metrics, null, 2));
        break;
      case "toon":
        stdout(metricsToToon(result));
        break;
      case "html":
        stdout(generateReport());
        break;
      default:
        printTable(result.metrics, result.average, result.total, stdout);
        break;
    }

    if (flags.save || flags.pending) {
      const tests = flags.tests
        ? runTestSuite(flags.testCommand ?? config.metrics.testCommand)
        : null;
      if (tests) {
        const passed = tests.passed === null ? "?" : tests.passed;
        const total = tests.total === null ? "?" : tests.total;
        const failed = tests.failed === null ? "?" : tests.failed;
        stderr(`Tests: ${passed}/${total} passed, ${failed} failed`);
        if (tests.error) stderr(`Test summary warning: ${tests.error}`);
      }

      const saved = flags.pending
        ? savePendingSnapshot(dbDir, result.metrics, tests)
        : saveSnapshot(dbDir, currentCommit(), result.metrics, tests, {
            force: flags.force === true,
          });
      stderr(`Saved: ${saved}`);
    }
  },
});

function printTable(
  metrics: { file_name: string; cyclo: number; fta_score: number; assessment: string; line_count: number }[],
  average: number | null,
  total: number,
  stdout: (s: string) => void,
): void {
  if (!metrics.length) {
    stdout("No files to analyze.");
    return;
  }

  const rows = metrics.sort((a, b) => a.file_name.localeCompare(b.file_name));
  const nameWidth = Math.max(8, ...rows.map((r) => r.file_name.length));
  const header = `  ${"file".padEnd(nameWidth)}  cyclo  fta    lines  assessment`;
  stdout(header);
  stdout("  " + "-".repeat(header.length - 2));

  for (const m of rows) {
    stdout(
      `  ${m.file_name.padEnd(nameWidth)}  ${String(m.cyclo).padStart(5)}  ${m.fta_score.toFixed(1).padStart(5)}  ${String(m.line_count).padStart(5)}  ${m.assessment}`,
    );
  }

  stdout("");
  if (average !== null) {
    stdout(`  ${total} files, average FTA: ${average.toFixed(1)}`);
  } else {
    stdout(`  ${total} files`);
  }
}

export { metricsCommand };
