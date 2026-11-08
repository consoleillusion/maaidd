/**
 * `maaidd check [paths...]` — check formatting without writing.
 * Exits 1 if any file would change.
 */
import { buildCommand } from "@stricli/core";
import { resolveFormatOptions, loadConfig, format } from "../../index.ts";
import { readFileSync, statSync } from "node:fs";
import {
  collectFiles,
  isDirectory,
  wasFlagProvided,
  parseIndent,
  parsePositiveInt,
} from "./shared.ts";

const checkCommand = buildCommand({
  docs: {
    brief: "Check formatting without writing; exits 1 if any file would change",
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
        brief: "Expect semicolons (use --no-semicolons)",
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
        brief: "Convert function declarations to const arrows (functional only)",
      },
      biome: {
        kind: "boolean",
        default: true,
        brief: "Pass through Biome (use --no-biome for functional-only)",
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
        brief: "Files or directories to check (default: stdin)",
        optional: true,
      },
    },
  } as any,
  func: (flags: any, ...paths: string[]) => {
    const stderr = (s: string) => process.stderr.write(s + "\n");
    const stdout = (s: string) => process.stdout.write(s + "\n");

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

    let changed = 0;
    let checked = 0;
    let failed = 0;

    const checkFile = (path: string): void => {
      let source: string;
      try {
        source = readFileSync(path, "utf8");
      } catch (err) {
        failed++;
        stderr(`Cannot read ${path}: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
      if (!source.trim()) return;
      checked++;

      try {
        const result = format(source, { ...resolved, filename: path });
        if (result !== source) {
          changed++;
          stderr(`Would format: ${path}`);
        }
      } catch (err) {
        failed++;
        stderr(`Check error: ${path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    if (paths.length === 0) {
      const source = readFileSync(0, "utf8");
      if (source.trim()) {
        checked++;
        try {
          const result = format(source, { ...resolved, filename: "stdin.ts" });
          if (result !== source) {
            changed++;
            stderr("Would format: stdin");
          }
        } catch (err) {
          failed++;
          stderr(`Check error: stdin: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } else {
      for (const p of paths) {
        try {
          statSync(p);
        } catch {
          stderr(`Input not found: ${p}`);
          process.exitCode = 1;
          continue;
        }
        if (isDirectory(p)) {
          for (const f of collectFiles(p)) checkFile(f);
        } else {
          checkFile(p);
        }
      }
    }

    if (checked > 0) {
      const status = changed > 0 ? `${changed} would change` : "all clean";
      stderr(`${checked} checked, ${status}${failed ? `, ${failed} failed` : ""}`);
    }

    if (changed > 0 || failed > 0) process.exitCode = 1;
  },
});

export { checkCommand };