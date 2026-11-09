/**
 * `maid init` — initialize MAID in a project.
 *
 * - Default: Biome config baseline. Enabling functional style enables the
 *   additional functional options.
 * - Every maid.config.json option is available as an explicit CLI flag and
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
import { dirname, join, resolve } from "node:path";
import { DEFAULT_CONFIG, type MaidConfig } from "../../types.ts";
import { format } from "../../index.ts";
import { resolveFormatOptions } from "../../config.ts";
import { mergeInsightsConfig } from "../../insights/index.ts";
import {
  buildSetupPlan,
  detectProject,
  readProjectContext,
  updateProject,
  type DetectedSoftware,
  type ProjectInput,
} from "../../project.ts";
import { collectFiles, wasFlagProvided } from "./shared.ts";
import {
  cancel as clackCancel,
  confirm as clackConfirm,
  isCancel,
  multiselect,
  text,
} from "@clack/prompts";

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

function cloneConfig(): MaidConfig {
  return structuredClone(DEFAULT_CONFIG);
}

function applyFlagsToConfig(flags: Flags): MaidConfig {
  const c = cloneConfig();
  if (flags.style !== undefined) c.style = flags.style as MaidConfig["style"];
  if (flags.indent !== undefined)
    c.indent = parseIndentInput(String(flags.indent));
  if (flags.lineWidth !== undefined)
    c.lineWidth = parseNonNegative(String(flags.lineWidth));
  if (wasFlagProvided("semicolons", "no-semicolons"))
    c.semicolons = Boolean(flags.semicolons);
  if (flags.quoteStyle !== undefined)
    c.quoteStyle = flags.quoteStyle as MaidConfig["quoteStyle"];
  if (flags.trailingComma !== undefined)
    c.trailingComma = flags.trailingComma as MaidConfig["trailingComma"];
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

  if (flags.insightsConfig !== undefined) {
    const raw = String(flags.insightsConfig);
    const text = existsSync(raw) ? readFileSync(raw, "utf8") : raw;
    c.insights = mergeInsightsConfig(c.insights, JSON.parse(text));
  }

  return c;
}

function biomeConfigFor(c: MaidConfig): Record<string, unknown> {
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

async function clackText(opts: Parameters<typeof text>[0]): Promise<string> {
  const answer = await text(opts);
  if (isCancel(answer)) {
    clackCancel("Cancelled");
    process.exit(1);
  }
  return answer;
}

async function askConfirm(
  opts: Parameters<typeof clackConfirm>[0],
): Promise<boolean> {
  const answer = await clackConfirm(opts);
  if (isCancel(answer)) {
    clackCancel("Cancelled");
    process.exit(1);
  }
  return answer;
}

async function confirm(
  question: string,
  initialValue = false,
): Promise<boolean> {
  return askConfirm({ message: question, initialValue });
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
  config: MaidConfig,
  flags: Flags,
  interactive: boolean,
): Promise<void> {
  const configPath = join(dir, "maid.config.json");
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
      existsSync(configPath) ? "maid.config.json" : null,
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
        stdout(`maid.config.json: ${a}, biome.json: ${b}`);
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
    !(await confirm(`Write maid.config.json and biome.json in ${dir}?`))
  ) {
    stdout("Skipped writing config files.");
    return;
  }

  const a = writeConfigFile(configPath, configContent, force || interactive);
  const b = writeConfigFile(biomePath, biomeContent, force || interactive);
  stdout(`maid.config.json: ${a}, biome.json: ${b}`);
}

async function maybeFormat(
  dir: string,
  config: MaidConfig,
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
  config: MaidConfig,
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

function splitList(value: unknown): string[] {
  if (value === undefined) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function describeSoftware(software: DetectedSoftware): string {
  const parts = [
    software.languages.length
      ? `languages: ${software.languages.join(", ")}`
      : "",
    software.runtime ? `runtime: ${software.runtime}` : "",
    software.packageManager
      ? `package manager: ${software.packageManager}`
      : "",
    software.frameworks.length
      ? `frameworks: ${software.frameworks.join(", ")}`
      : "",
    software.testCommand ? `test: \`${software.testCommand}\`` : "",
    software.buildCommand ? `build: \`${software.buildCommand}\`` : "",
  ].filter(Boolean);
  return parts.length ? parts.join("; ") : "none detected";
}

function hasProjectFlags(flags: Flags): boolean {
  return (
    flags.name !== undefined ||
    flags.goal !== undefined ||
    flags.scopeIn !== undefined ||
    flags.scopeOut !== undefined
  );
}

async function promptValue(
  label: string,
  fallback: string,
  required: boolean,
): Promise<string> {
  for (;;) {
    const answer = await clackText({
      message: label,
      placeholder: fallback || undefined,
    });
    const value = (answer || "").trim() || fallback;
    if (value || !required) return value;
    stdout(`${label} is required.`);
  }
}

async function promptList(
  label: string,
  fallback: string[],
  required: boolean,
): Promise<string[]> {
  const fallbackText = fallback.join(", ");
  for (;;) {
    const answer = await clackText({
      message: label,
      placeholder: fallbackText || undefined,
    });
    const value = answer ? splitList(answer) : fallback;
    if (value.length || !required) return value;
    stdout(`${label} requires at least one value.`);
  }
}

async function promptSoftware(
  software: DetectedSoftware,
): Promise<DetectedSoftware> {
  return {
    languages: await promptMultiselect(
      "Languages",
      software.languages,
      software.languages,
      true,
    ),
    runtime: await promptValue("Runtime", software.runtime, false),
    packageManager: await promptValue(
      "Package manager",
      software.packageManager,
      false,
    ),
    frameworks: await promptMultiselect(
      "Frameworks",
      software.frameworks,
      software.frameworks,
      false,
    ),
    testCommand: await promptValue("Test command", software.testCommand, false),
    buildCommand: await promptValue(
      "Build command",
      software.buildCommand,
      false,
    ),
  };
}

async function promptMultiselect(
  label: string,
  options: string[],
  initialValues: string[],
  required: boolean,
): Promise<string[]> {
  const answer = await multiselect({
    message: label,
    options: options.map((value) => ({ value, label: value })),
    initialValues,
    required,
    maxItems: 8,
  });
  if (isCancel(answer)) {
    clackCancel("Cancelled");
    process.exit(1);
  }
  return answer;
}

function printOptionalOptions(dir: string): void {
  const plan = buildSetupPlan(dir, "optional");
  const options = plan.optional ?? [];
  stdout("");
  stdout("Optional project settings (not prompted by default):");
  for (const option of options) {
    stdout(
      `- ${option.key} (${option.type}): ${JSON.stringify(option.value)} — ${option.description}`,
    );
  }
  stdout(
    "Set these in maid.project.json or maid.config.json, or via MCP project_update.",
  );
}

function reportProject(result: ReturnType<typeof updateProject>): void {
  stdout(
    `Project context: ${
      result.written.length ? result.written.join(", ") : "already up to date"
    }`,
  );
  stdout(`Project status: ${result.status}`);
  if (result.missing.length) {
    stdout(`Missing project fields: ${result.missing.join(", ")}`);
  }
}

async function maybeProject(
  dir: string,
  flags: Flags,
  interactive: boolean,
): Promise<void> {
  if (flags.skipProject) {
    stdout("Skipped project context initialization.");
    if (flags.showOptions) printOptionalOptions(dir);
    return;
  }

  const detected = detectProject(dir);
  stdout(`Detected software: ${describeSoftware(detected.software)}`);
  const plan = buildSetupPlan(dir, "required");
  const existing = readProjectContext(dir).project;
  const required = new Set(plan.required.map((question) => question.key));
  const flagInput = hasProjectFlags(flags);

  if (existing && (!interactive || plan.status === "complete") && !flagInput) {
    stdout(
      plan.status === "complete"
        ? "Project context is already complete."
        : "Project context already exists.",
    );
    reportProject(updateProject({ root: dir }));
    if (flags.showOptions) printOptionalOptions(dir);
    return;
  }

  let name =
    flags.name !== undefined
      ? String(flags.name).trim()
      : existing?.name.trim()
        ? existing.name
        : detected.name;
  let goal =
    flags.goal !== undefined
      ? String(flags.goal).trim()
      : (existing?.goal ?? "");
  let scopeIn =
    flags.scopeIn !== undefined
      ? splitList(flags.scopeIn)
      : (existing?.scope.in ?? []);
  let scopeOut =
    flags.scopeOut !== undefined
      ? splitList(flags.scopeOut)
      : (existing?.scope.out ?? []);
  const detectedSoftware = detected.software;
  let software = existing
    ? {
        languages: existing.software.languages.length
          ? existing.software.languages
          : detectedSoftware.languages,
        runtime: existing.software.runtime || detectedSoftware.runtime,
        packageManager:
          existing.software.packageManager || detectedSoftware.packageManager,
        frameworks: existing.software.frameworks.length
          ? existing.software.frameworks
          : detectedSoftware.frameworks,
        testCommand:
          existing.software.testCommand || detectedSoftware.testCommand,
        buildCommand:
          existing.software.buildCommand || detectedSoftware.buildCommand,
      }
    : detectedSoftware;
  let promptedSoftware = false;

  if (interactive) {
    if (required.has("name") && flags.name === undefined) {
      name = await promptValue("Project name", detected.name || name, true);
    }
    if (required.has("goal") && flags.goal === undefined) {
      goal = await promptValue(
        "Project goal in one sentence",
        detected.goal || goal,
        true,
      );
    }
    if (required.has("software")) {
      software = await promptSoftware(software);
      promptedSoftware = true;
    }
  }

  const project: ProjectInput = {};
  if (name.trim()) project.name = name.trim();
  if (goal.trim()) project.goal = goal.trim();
  if (
    scopeIn.length ||
    scopeOut.length ||
    flags.scopeIn !== undefined ||
    flags.scopeOut !== undefined
  ) {
    project.scope = {};
    if (scopeIn.length || flags.scopeIn !== undefined) {
      project.scope.in = scopeIn;
    }
    if (scopeOut.length || flags.scopeOut !== undefined) {
      project.scope.out = scopeOut;
    }
  }
  if (promptedSoftware) project.software = software;

  reportProject(updateProject({ root: dir, project }));
  if (flags.showOptions) printOptionalOptions(dir);
}

function printMcpHint(dir: string): void {
  stdout("");
  stdout(
    'MCP server (stdio): configure your client with command `bun`, args `["src/cli/index.ts","mcp"]` (or `bun run mcp`), cwd set to this project.',
  );
  stdout(`Example cwd: ${dir}`);
  stdout(
    "Tools: project_init, project_update, project_read, metrics, gate, history, codegraph. Project context lives in maid.project.json and generated PROJECT.md.",
  );
  stdout(
    "Prereqs: fta for metrics/gate; .code-graph/index.db for codegraph; maid.db/history as configured.",
  );
}

const initCommand = buildCommand({
  docs: {
    brief:
      "Initialize MAID (project context, maid.config.json, biome.json, git hooks, optional formatting)",
    fullDescription:
      "Interactive by default in a TTY. Prompts for the same project guide as the MCP server: goal, scope, and software, with best-practice defaults applied silently. Writes maid.project.json and deterministically regenerates PROJECT.md. Default config is Biome; enabling functional style enables additional functional options. Every maid.config.json option can be set via explicit CLI flags. Destructive actions (formatting/force overwrite) require confirmation or explicit flags. Git hooks: prompted for y (accept) or anything else (decline) unless --accept-git-hooks/--no-hooks is provided. Use --skip-project to skip project context, --show-options to print the optional settings catalog, and --goal/--scope-in/--scope-out for non-interactive project setup.",
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
      skipProject: {
        kind: "boolean",
        brief: "Skip guided project context initialization",
        optional: true,
      },
      showOptions: {
        kind: "boolean",
        brief: "Print the optional project settings catalog",
        optional: true,
      },
      name: {
        kind: "parsed",
        parse: String,
        brief: "Project name for project context",
        optional: true,
      },
      goal: {
        kind: "parsed",
        parse: String,
        brief: "Project goal for non-interactive project setup",
        optional: true,
      },
      scopeIn: {
        kind: "parsed",
        parse: String,
        brief: "Comma-separated in-scope items",
        optional: true,
      },
      scopeOut: {
        kind: "parsed",
        parse: String,
        brief: "Comma-separated out-of-scope items",
        optional: true,
      },
      force: {
        kind: "boolean",
        brief: "Overwrite existing config files when writing",
        optional: true,
      },
      writeConfig: {
        kind: "boolean",
        brief: "Write maid.config.json and biome.json",
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
      insightsConfig: {
        kind: "parsed",
        parse: String,
        brief:
          "Path or inline JSON for partial insights config (benchmark, score, dependencies, commit)",
        placeholder: "path|json",
        optional: true,
      },
    },
    aliases: { y: "yes" },
  } as any,
  func: async (flags: Flags) => {
    const dir = process.cwd();
    const interactive = isInteractive(flags);
    const config = applyFlagsToConfig(flags);

    stdout(`MAID init in ${dir}`);
    stdout(
      `Style: ${config.style}${config.style === "functional" ? " (functional options enabled)" : " (Biome default baseline)"}`,
    );

    await maybeWriteConfigs(dir, config, flags, interactive);
    try {
      await maybeProject(dir, flags, interactive);
    } catch (error) {
      stderr(
        `Project setup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    }
    await maybeHooks(dir, flags, interactive);
    await maybeFormat(dir, config, flags, interactive);
    printMcpHint(dir);
  },
});

export { initCommand };
