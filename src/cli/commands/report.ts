/**
 * `maaidd report` — generate uPlot HTML history dashboard from metric/*.json.
 *
 * One line chart: x-axis = git commits, one line per tracked metric
 * (passing tests, lines of code, cyclomatic complexity, FTA score,
 * Halstead volume/difficulty).
 */
import { buildCommand } from "@stricli/core";
import { generateReport } from "../../metrics/report.ts";
import { writeFileSync } from "node:fs";

const reportCommand = buildCommand({
  docs: {
    brief: "Generate uPlot HTML history dashboard from metric snapshots",
  },
  parameters: {
    flags: {
      output: {
        kind: "parsed",
        parse: (input: string) => input,
        brief: "Output HTML file (default: stdout)",
        placeholder: "path",
        optional: true,
      },
    },
  } as any,
  func: (flags: any) => {
    const stdout = (s: string) => process.stdout.write(s);
    const html = generateReport();

    if (flags.output) {
      writeFileSync(flags.output, html, "utf8");
      process.stderr.write(`Report written to ${flags.output}\n`);
    } else {
      stdout(html);
    }
  },
});

export { reportCommand };