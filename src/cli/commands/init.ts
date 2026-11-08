/**
 * `maaidd init` — initialize MAAIDD in a project.
 *
 * - Default: Biome config baseline. Enabling functional style enables the
 *   additional functional options.
 * - Every maaidd.config.json option is available as an explicit CLI flag and
 *   is written into the generated config.
 * - Interactive by default (TTY): prompts for hooks/confirmations unless
 *   explicit flags are provided. Destructive actions require confirmation.
 * - Non-interactive: requires explicit flags for hooks and any destructive
 *   action (format/force overwrite). `--accept-git-hooks` installs hooks
 *   without prompting.
 */
import { buildCommand } from "@stricli/core";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createInterface } from "node:readline/promises";
import { dirname, join, resolve } from "node:path";
import { DEFAULT_CONFIG, type MaaiddConfig } from "../../types.ts";
import { format } from "../../index.ts";
import { resolveFormatOptions } from "../../config.ts";
import { collectFiles, wasFlagProvided } from "./shared.ts";

type Flags = Record<string, unknown>;

const stdout = (s: string) => process.stdout.write(`${s}\n`);
const stderr = (s: string) => process.stderr.write(`${s}\n`);

function parseIndentInput(input: string): number | "tab" {
  if (input === "tab") return "tab";
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return 2;
  return Math.min(8, Math.round(n));
}

function parseNonNegative(input: string): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function cloneConfig(): MaaiddConfig {
  return structuredClone(DEFAULT_CONFIG);
}

function applyFlagsToConfig(flags: Flags): MaaiddConfig {
  const c = cloneConfig();
  if (flags.style !== undefined) c.style = flags.style as MaaiddConfig["style"];
  if (flags.indent !== undefined)
    c.indent = parseIndentInput(String(flags.indent));
  if (flags.lineWidth !== undefined)
    c.lineWidth = parseNonNegative(String(flags.lineWidth));
  if (wasFlagProvided("semicolons", "no-semicolons"))
    c.semicolons = Boolean(flags.semicolons);
  if (flags.quoteStyle !== undefined)
    c.quoteStyle = flags.quoteStyle as MaaiddConfig["quoteStyle"];
  if (flags.trailingComma !== undefined)
    c.trailingComma = flags.trailingComma as MaaiddConfig["trailingComma"];
  if (wasFlagProvided("to-arrow", "no-to-arrow"))
    c.toArrow = Boolean(flags.toArrow);
  if (wasFlagProvided("biome", "no-biome")) c.biome = Boolean(flags.biome);

  if (flags.functionalCommaStyle !== undefined)
    c.functional.commaStyle = flags.functionalCommaStyle as any;
  if (flags.functionalObjectValueIndent !== undefined)
    c.functional.objectValueIndent = parseNonNegative(
      String(flags.functionalObjectValueIndent),
    );
  if (flags.functionalArrayValueIndent !== undefined)
    c.functional.arrayValueIndent = parseNonNegative(
      String(flags.functionalArrayValueIndent),
    );
  if (
    wasFlagProvided(
      "functional-force-blank-lines",
      "no-functional-force-blank-lines",
    )
  )
    c.functional.forceBlankLines = Boolean(flags.functionalForceBlankLines);
  if (wasFlagProvided("functional-semicolons", "no-functional-semicolons"))
    c.functional.semicolons = Boolean(flags.functionalSemicolons);
  if (flags.functionalMaxInlineArrayItems !== undefined)
    c.functional.maxInlineArrayItems = parseNonNegative(
      String(flags.functionalMaxInlineArrayItems),
    );

  if (flags.metricsExcludeUnder !== undefined)
    c.metrics.excludeUnder = parseNonNegative(
      String(flags.metricsExcludeUnder),
    );
  if (flags.metricsTestCommand !== undefined)
    c.metrics.testCommand = String(flags.metricsTestCommand);
  if (flags.metricsMaxCyclomatic !== undefined)
    c.metrics.thresholds.maxCyclomatic = parseNonNegative(
      String(flags.metricsMaxCyclomatic),
    );
  if (flags.metricsMinFtaScore !== undefined)
    c.metrics.thresholds.minFtaScore = parseNonNegative(
      String(flags.metricsMinFtaScore),
    );

  if (wasFlagProvided("mcp-codegraph", "no-mcp-codegraph"))
    c.mcp.codegraph = Boolean(flags.mcpCodegraph);
  if (wasFlagProvided("mcp-metrics", "no-mcp-metrics"))
    c.mcp.metrics = Boolean(flags.mcpMetrics);

  return c;
}

function biomeConfigFor(c: MaaiddConfig): Record<string, unknown> {
  return {
    $schema: "https://biomejs.dev/schemas/2.6.6/schema.json",
    formatter: {
      enabled: true,
      indentStyle: c.indent === "tab" ? "tab" : "space",
      indentWidth: c.indent === "tab" ? 2 : c.indent,
      lineWidth: c.lineWidth,
      lineEnding: "lf",
    },
    javascript: {
      formatter: {
        quoteStyle: c.quoteStyle,
        jsxQuoteStyle: c.quoteStyle,
        semicolons: c.semicolons ? "always" : "asNeeded",
        trailingCommas: c.trailingComma,
        arrowParentheses: "always",
        quoteProperties: "preserve",
      },
    },
    linter: { enabled: true, rules: { recommended: true } },
  };
}

function isInteractive(flags: Flags): boolean {
  if (flags.nonInteractive || flags.yes) return false;
  if (wasFlagProvided("non-interactive", "yes")) return false;
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function promptLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(question);
    return answer;
  } finally {
    rl.close();
  }
}

async function confirm(question: string): Promise<boolean> {
  const answer = (await promptLine(`${question} [y/N]: `)).trim();
  return answer === "y" || answer === "Y";
}

function hooksAcceptedByFlag(): boolean | undefined {
  if (wasFlagProvided("accept-git-hooks", "acceptGitHooks")) return true;
  if (wasFlagProvided("no-hooks", "reject-git-hooks", "rejectGitHooks"))
    return false;
  if (wasFlagProvided("hooks") && !wasFlagProvided("no-hooks")) return true;
  return undefined;
}

function installHooks(dir: string): void {
  for (const name of ["pre-commit", "post-commit"]) {
    const hp = join(dir, "scripts", "hooks", name);
    if (existsSync(hp)) {
      try {
        chmodSync(hp, 0o755);
      } catch {}
    }
  }
  execFileSync("git", ["config", "core.hooksPath", "scripts/hooks"], {
    cwd: dir,
    stdio: ["pipe", "pipe", "ignore"],
  });
}

function writeConfigFile(
  path: string,
  content: string,
  force: boolean,
): "created" | "overwritten" | "skipped" {
  if (existsSync(path)) {
    if (!force) return "skipped";
    writeFileSync(path, content, "utf8");
    return "overwritten";
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
  return "created";
}

async function maybeWriteConfigs(
  dir: string,
  config: MaaiddConfig,
  flags: Flags,
  interactive: boolean,
): Promise<void> {
  const configPath = join(dir, "maaidd.config.json");
  const biomePath = join(dir, "biome.json");
  const configContent = `${JSON.stringify(config, null, 2)}\n`;
  const biomeContent = `${JSON.stringify(biomeConfigFor(config), null, 2)}\n`;
  const force = Boolean(flags.force);
  const writeRequested =
    wasFlagProvided("write-config") ||
    interactive ||
    Boolean(flags.yes) ||
    wasFlagProvided("yes");

  if (existsSync(configPath) || existsSync(biomePath)) {
    const existing = [
      existsSync(configPath) ? "maaidd.config.json" : null,
      existsSync(biomePath) ? "biome.json" : null,
    ]
      .filter(Boolean)
      .join(", ");
    stdout(`Existing config: ${existing}`);
    if (!force) {
      if (interactive) {
        if (!(await confirm("Overwrite existing config files?"))) {
          if (!existsSync(configPath))
            writeConfigFile(configPath, configContent, false);
          if (!existsSync(biomePath))
            writeConfigFile(biomePath, biomeContent, false);
          stdout("Skipped overwriting existing config files.");
          return;
        }
      } else {
        stdout(
          "Non-interactive: pass --force to overwrite existing config files; writing only missing files.",
        );
        const a = writeConfigFile(configPath, configContent, false);
        const b = writeConfigFile(biomePath, biomeContent, false);
        stdout(`maaidd.config.json: ${a}, biome.json: ${b}`);
        return;
      }
    }
  }

  if (!writeRequested && !interactive) {
    stdout(
      "Non-interactive: pass --write-config (or --yes) to write config files.",
    );
    return;
  }
  if (
    interactive &&
    !(await confirm(`Write maaidd.config.json and biome.json in ${dir}?`))
  ) {
    stdout("Skipped writing config files.");
    return;
  }

  const a = writeConfigFile(configPath, configContent, force || interactive);
  const b = writeConfigFile(biomePath, biomeContent, force || interactive);
  stdout(`maaidd.config.json: ${a}, biome.json: ${b}`);
}

async function maybeFormat(
  dir: string,
  config: MaaiddConfig,
  flags: Flags,
  interactive: boolean,
): Promise<void> {
  const formatFlag = wasFlagProvided("format") || Boolean(flags.format);
  const formatPath =
    flags.formatPath !== undefined ? String(flags.formatPath) : ".";
  const paths = [formatPath];
  if (!formatFlag) {
    if (
      interactive &&
      (await confirm(
        "Run initial formatting now? (destructive: rewrites files in place)",
      ))
    ) {
      await doFormat(dir, config, ["."]);
    }
    return;
  }
  if (
    interactive &&
    !(await confirm(`Run initial formatting on ${formatPath}? (destructive)`))
  ) {
    stdout("Skipped formatting.");
    return;
  }
  await doFormat(dir, config, paths);
}

async function doFormat(
  dir: string,
  config: MaaiddConfig,
  paths: string[],
): Promise<void> {
  const resolved = resolveFormatOptions({}, config);
  let total = 0;
  let failed = 0;
  for (const p of paths) {
    const abs = resolve(dir, p);
    if (!existsSync(abs)) {
      stderr(`Format path not found: ${abs}`);
      failed++;
      continue;
    }
    const st = statSync(abs);
    const files = st.isDirectory() ? collectFiles(abs) : [abs];
    for (const file of files) {
      try {
        const source = readFileSync(file, "utf8");
        if (!source.trim()) continue;
        const result = format(source, { ...resolved, filename: file });
        if (result !== source) {
          writeFileSync(file, result, "utf8");
          total++;
        }
      } catch (e) {
        failed++;
        stderr(
          `Format error: ${file}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }
  stdout(
    `Formatted ${total} changed file(s)${failed ? `, ${failed} failed` : ""}.`,
  );
  if (failed) process.exitCode = 1;
}

async function maybeHooks(
  dir: string,
  flags: Flags,
  interactive: boolean,
): Promise<void> {
  const byFlag = hooksAcceptedByFlag();
  let install: boolean;
  if (byFlag !== undefined) {
    install = byFlag;
  } else if (interactive) {
    install = await confirm(
      "Install git pre/post commit hooks? (accept with y; anything else declines)",
    );
  } else {
    stderr(
      "Hooks not configured. In non-interactive mode pass --accept-git-hooks or --no-hooks.",
    );
    process.exitCode = 1;
    return;
  }
  if (!install) {
    stdout("Skipped git hooks.");
    return;
  }
  try {
    installHooks(dir);
    stdout(
      "Installed git hooks (core.hooksPath=scripts/hooks, pre-commit + post-commit).",
    );
  } catch (e) {
    stderr(
      `Could not install git hooks: ${e instanceof Error ? e.message : String(e)}`,
    );
    stderr("Install manually: git config core.hooksPath scripts/hooks");
    process.exitCode = 1;
  }
}

function printMcpHint(dir: string): void {
  stdout("");
  stdout(
    'MCP server (stdio): configure your client with command `bun`, args `["src/cli/index.ts","mcp"]` (or `bun run mcp`), cwd set to this project.',
  );
  stdout(`Example cwd: ${dir}`);
  stdout(
    "Tools: metrics, gate, history, codegraph. Prereqs: fta for metrics/gate; .code-graph/index.db for codegraph; maaidd.db/history as configured.",
  );
}

const initCommand = buildCommand({
  docs: {
    brief:
      "Initialize MAAIDD (maaidd.config.json, biome.json, git hooks, optional formatting)",
    fullDescription:
      "Interactive by default in a TTY. Default config is Biome; enabling functional style enables additional functional options. Every maaidd.config.json option can be set via explicit CLI flags. Destructive actions (formatting/force overwrite) require confirmation or explicit flags. Git hooks: prompted for y (accept) or anything else (decline) unless --accept-git-hooks/--no-hooks is provided.",
  },
  parameters: {
    flags: {
      yes: {
        kind: "boolean",
        brief:
          "Accept safe defaults non-interactively (does not format or force overwrite)",
        optional: true,
      },
      nonInteractive: {
        kind: "boolean",
        brief:
          "Disable prompts; requires explicit flags for hooks/destructive actions",
        optional: true,
      },
      force: {
        kind: "boolean",
        brief: "Overwrite existing config files when writing",
        optional: true,
      },
      writeConfig: {
        kind: "boolean",
        brief: "Write maaidd.config.json and biome.json",
        optional: true,
      },
      format: {
        kind: "boolean",
        brief: "Run initial formatting (destructive; explicit opt-in)",
        optional: true,
      },
      formatPath: {
        kind: "parsed",
        parse: String,
        brief: "Path to format when --format is set (default: .)",
        optional: true,
      },
      acceptGitHooks: {
        kind: "boolean",
        brief: "Install git pre/post commit hooks without prompting",
        optional: true,
      },
      hooks: {
        kind: "boolean",
        brief:
          "Install git hooks (alias for --accept-git-hooks; use --no-hooks to decline)",
        optional: true,
      },
      rejectGitHooks: {
        kind: "boolean",
        brief: "Do not install git hooks without prompting",
        optional: true,
      },
      style: {
        kind: "enum",
        values: ["biome", "functional"],
        brief: "Formatting style (default: biome)",
        optional: true,
      },
      indent: {
        kind: "parsed",
        parse: String,
        brief: "Indent width (2|4|8|tab)",
        optional: true,
      },
      lineWidth: {
        kind: "parsed",
        parse: String,
        brief: "Maximum line width",
        optional: true,
      },
      semicolons: { kind: "boolean", brief: "Emit semicolons", optional: true },
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
        brief: "Convert to const arrows in functional pipeline",
        optional: true,
      },
      biome: { kind: "boolean", brief: "Enable Biome pass", optional: true },
      functionalCommaStyle: {
        kind: "enum",
        values: ["leading", "trailing"],
        brief: "Functional comma style",
        optional: true,
      },
      functionalObjectValueIndent: {
        kind: "parsed",
        parse: String,
        brief: "Functional object value indent",
        optional: true,
      },
      functionalArrayValueIndent: {
        kind: "parsed",
        parse: String,
        brief: "Functional array value indent",
        optional: true,
      },
      functionalForceBlankLines: {
        kind: "boolean",
        brief: "Functional force blank lines",
        optional: true,
      },
      functionalSemicolons: {
        kind: "boolean",
        brief: "Functional semicolons",
        optional: true,
      },
      functionalMaxInlineArrayItems: {
        kind: "parsed",
        parse: String,
        brief: "Functional max inline array items",
        optional: true,
      },
      metricsExcludeUnder: {
        kind: "parsed",
        parse: String,
        brief: "Metrics exclude-under threshold",
        optional: true,
      },
      metricsTestCommand: {
        kind: "parsed",
        parse: String,
        brief: "Test command for metrics snapshots",
        optional: true,
      },
      metricsMaxCyclomatic: {
        kind: "parsed",
        parse: String,
        brief: "Gate max cyclomatic complexity",
        optional: true,
      },
      metricsMinFtaScore: {
        kind: "parsed",
        parse: String,
        brief: "Gate minimum FTA score",
        optional: true,
      },
      mcpCodegraph: {
        kind: "boolean",
        brief: "Enable MCP codegraph tool/config flag",
        optional: true,
      },
      mcpMetrics: {
        kind: "boolean",
        brief: "Enable MCP metrics tool/config flag",
        optional: true,
      },
    },
    aliases: { y: "yes" },
  } as any,
  func: async (flags: Flags) => {
    const dir = process.cwd();
    const interactive = isInteractive(flags);
    const config = applyFlagsToConfig(flags);

    stdout(`MAAIDD init in ${dir}`);
    stdout(
      `Style: ${config.style}${config.style === "functional" ? " (functional options enabled)" : " (Biome default baseline)"}`,
    );

    await maybeWriteConfigs(dir, config, flags, interactive);
    await maybeHooks(dir, flags, interactive);
    await maybeFormat(dir, config, flags, interactive);
    printMcpHint(dir);
  },
});

export { initCommand };
