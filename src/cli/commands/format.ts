/**
 * `maid format [paths...]` — format files/dirs/stdin.
 */
import { buildCommand } from "@stricli/core";
import { resolveFormatOptions, loadConfig } from "../../index.ts";
import {
  formatPaths,
  wasFlagProvided,
  parseIndent,
  parsePositiveInt,
} from "./shared.ts";
const formatCommand = buildCommand({
  docs: {
    brief: "Format files, directories, or stdin with Biome or functional style",
  },
  parameters: {
    flags: {
      style: {
        kind: "enum",
        values: ["biome", "functional"],
        brief: "Formatting style (default: biome)",
        optional: true,
      },
      indent: {
        kind: "parsed",
        parse: (input: string) => input,
        brief: "Indent width (2|4|8|tab)",
        placeholder: "N|tab",
        optional: true,
      },
      lineWidth: {
        kind: "parsed",
        parse: (input: string) => input,
        brief: "Maximum line width",
        placeholder: "N",
        optional: true,
      },
      semicolons: {
        kind: "boolean",
        default: true,
        brief: "Emit semicolons (use --no-semicolons to omit)",
      },
      quoteStyle: {
        kind: "enum",
        values: ["double", "single"],
        brief: "Quote style",
        optional: true,
      },
      trailingComma: {
        kind: "enum",
        values: ["all", "es5", "none"],
        brief: "Trailing comma style",
        optional: true,
      },
      toArrow: {
        kind: "boolean",
        optional: true,
        brief:
          "Convert function declarations to const arrows (functional only)",
      },
      biome: {
        kind: "boolean",
        default: true,
        brief: "Pass through Biome (use --no-biome for functional-only)",
      },
      config: {
        kind: "parsed",
        parse: (input: string) => input,
        brief: "Path to maid.config.json",
        placeholder: "path",
        optional: true,
      },
      output: {
        kind: "parsed",
        parse: (input: string) => input,
        brief: "Output file or directory",
        placeholder: "path",
        optional: true,
      },
    },
    positional: {
      kind: "array",
      parameter: {
        parse: String,
        brief: "Files or directories to format (default: stdin)",
        optional: true,
      },
    },
  } as any,
  func: (flags: any, ...paths) => {
    const stdout = (s: string) => process.stdout.write(s);
    const stderr = (s: string) => process.stderr.write(s + "\n");
    const config = flags.config ? loadConfig(flags.config) : loadConfig();
    const options: Record<string, unknown> = {};
    if (flags.style !== undefined) options.style = flags.style;
    if (flags.indent !== undefined) options.indent = parseIndent(flags.indent);
    if (flags.lineWidth !== undefined) {
      options.lineWidth = parsePositiveInt(flags.lineWidth);
    }
    if (wasFlagProvided("semicolons", "no-semicolons")) {
      options.semicolons = flags.semicolons;
    }
    if (flags.quoteStyle !== undefined) options.quoteStyle = flags.quoteStyle;
    if (flags.trailingComma !== undefined) {
      options.trailingComma = flags.trailingComma;
    }
    if (wasFlagProvided("to-arrow")) options.toArrow = flags.toArrow;
    if (wasFlagProvided("biome", "no-biome")) options.biome = flags.biome;
    if (flags.config !== undefined) options.configPath = flags.config;
    const resolved = resolveFormatOptions(options, config);
    formatPaths(paths, flags.output, resolved, stdout, stderr);
  },
});
export { formatCommand };
