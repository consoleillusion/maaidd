/**
 * Project context used by MCP initialization.
 *
 * `maaidd.project.json` is the canonical, machine-readable project definition.
 * `PROJECT.md` is a deterministic projection of that file plus the effective
 * `maaidd.config.json`; it is never authored by a model.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { z } from "zod";
import { loadConfig } from "./config.ts";
import { DEFAULT_CONFIG, type MaaiddConfig } from "./types.ts";

export const PROJECT_SCHEMA_VERSION = 1 as const;
export const PROJECT_FILE = "maaidd.project.json";
export const PROJECT_DOC = "PROJECT.md";
const CONFIG_FILE = "maaidd.config.json";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const mergeDeep = <T>(base: T, patch: unknown): T => {
  if (!isRecord(patch)) return structuredClone(base);
  const out: Record<string, unknown> = {
    ...(structuredClone(base) as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries(patch)) {
    const current = out[key];
    if (isRecord(current) && isRecord(value)) {
      out[key] = mergeDeep(current, value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as T;
};

const stringList = z.array(z.string());

export const ProjectInputSchema = z.object({
  name: z.string().optional(),
  goal: z.string().optional(),
  scope: z
    .object({
      in: stringList.optional(),
      out: stringList.optional(),
    })
    .optional(),
  software: z
    .object({
      languages: stringList.optional(),
      runtime: z.string().optional(),
      packageManager: z.string().optional(),
      frameworks: stringList.optional(),
      testCommand: z.string().optional(),
      buildCommand: z.string().optional(),
    })
    .optional(),
  design: z
    .object({
      summary: z.string().optional(),
      principles: stringList.optional(),
      architecture: z.string().optional(),
    })
    .optional(),
  constraints: stringList.optional(),
  bestPractices: z
    .object({
      commits: z.string().optional(),
      formatting: z.string().optional(),
      testing: z.string().optional(),
      documentation: z.string().optional(),
    })
    .optional(),
});

export type ProjectInput = z.infer<typeof ProjectInputSchema>;

export const ConfigPatchSchema = z.object({
  style: z.enum(["biome", "functional"]).optional(),
  indent: z.union([z.number(), z.literal("tab")]).optional(),
  lineWidth: z.number().optional(),
  semicolons: z.boolean().optional(),
  quoteStyle: z.enum(["double", "single"]).optional(),
  trailingComma: z.enum(["all", "es5", "none"]).optional(),
  toArrow: z.boolean().optional(),
  biome: z.boolean().optional(),
  functional: z
    .object({
      commaStyle: z.enum(["leading", "trailing"]).optional(),
      objectValueIndent: z.number().optional(),
      arrayValueIndent: z.number().optional(),
      forceBlankLines: z.boolean().optional(),
      semicolons: z.boolean().optional(),
      maxInlineArrayItems: z.number().optional(),
    })
    .optional(),
  metrics: z
    .object({
      excludeUnder: z.number().optional(),
      testCommand: z.string().optional(),
      thresholds: z
        .object({
          maxCyclomatic: z.number().optional(),
          minFtaScore: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
  mcp: z
    .object({
      codegraph: z.boolean().optional(),
      metrics: z.boolean().optional(),
    })
    .optional(),
});

export type ConfigPatch = z.infer<typeof ConfigPatchSchema>;

export interface ProjectScope {
  in: string[];
  out: string[];
}

export interface ProjectSoftware {
  languages: string[];
  runtime: string;
  packageManager: string;
  frameworks: string[];
  testCommand: string;
  buildCommand: string;
}

export interface ProjectDesign {
  summary: string;
  principles: string[];
  architecture: string;
}

export interface ProjectBestPractices {
  commits: string;
  formatting: string;
  testing: string;
  documentation: string;
}

export interface ProjectContext {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  name: string;
  goal: string;
  scope: ProjectScope;
  software: ProjectSoftware;
  design: ProjectDesign;
  constraints: string[];
  bestPractices: ProjectBestPractices;
  createdAt: string;
  updatedAt: string;
}

export const PROJECT_DEFAULTS: Omit<
  ProjectContext,
  "schemaVersion" | "name" | "createdAt" | "updatedAt"
> = {
  goal: "",
  scope: { in: [], out: [] },
  software: {
    languages: [],
    runtime: "",
    packageManager: "",
    frameworks: [],
    testCommand: "",
    buildCommand: "",
  },
  design: {
    summary: "",
    principles: [
      "Prefer small, focused modules with clear boundaries.",
      "Keep behavior covered by tests and measurable with maaidd metrics and gates.",
      "Avoid unnecessary dependencies; justify additions.",
    ],
    architecture: "",
  },
  constraints: [],
  bestPractices: {
    commits:
      "Make small, atomic commits. Use an imperative subject line (72 characters or fewer) and explain why in the body. Run tests and `maaidd gate` before committing. Capture a pending snapshot before a commit and finalize after.",
    formatting:
      "Run `maaidd format` and `maaidd check`; Biome is the source of truth for formatting.",
    testing:
      "Keep the full test suite passing and add or update tests for behavior changes.",
    documentation:
      "Update README or docs for user-visible or workflow changes.",
  },
};

export interface DetectedSoftware {
  languages: string[];
  runtime: string;
  packageManager: string;
  frameworks: string[];
  testCommand: string;
  buildCommand: string;
}

export interface DetectedProject {
  name: string;
  goal: string;
  software: DetectedSoftware;
  sources: string[];
}

export type ProjectStatus = "missing" | "partial" | "complete";

export interface ProjectStatusResult {
  status: ProjectStatus;
  missing: string[];
}

export interface RequiredQuestion {
  key: string;
  question: string;
  suggested?: unknown;
}

export interface SetupOption {
  key: string;
  type: string;
  value: unknown;
  description: string;
}

export interface ProjectInitPlan {
  status: ProjectStatus;
  root: string;
  projectFile: string;
  projectDoc: string;
  missing: string[];
  detected: DetectedProject;
  required: RequiredQuestion[];
  defaults?: {
    bestPractices: ProjectBestPractices;
    designPrinciples: string[];
    constraints: string[];
  };
  optional?: SetupOption[];
  guidance: string;
  next: string;
}

export interface UpdateProjectOptions {
  root?: string;
  project?: ProjectInput;
  config?: ConfigPatch;
  dryRun?: boolean;
}

export interface UpdateProjectResult {
  root: string;
  status: ProjectStatus;
  missing: string[];
  projectFile: string;
  projectDoc: string;
  written: string[];
  dryRun: boolean;
  project: ProjectContext;
  markdown: string;
  config: MaaiddConfig;
}

export interface ProjectReadResult {
  root: string;
  status: ProjectStatus;
  missing: string[];
  projectFile: string;
  projectDoc: string;
  project: ProjectContext | null;
  markdown: string | null;
  docInSync: boolean;
}

type PackageJson = {
  name?: unknown;
  description?: unknown;
  packageManager?: unknown;
  scripts?: unknown;
  dependencies?: unknown;
  devDependencies?: unknown;
};

const readJson = <T>(path: string): T | null => {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
};

const asString = (value: unknown): string => {
  return typeof value === "string" ? value : "";
};

const asRecord = (value: unknown): Record<string, unknown> => {
  return isRecord(value) ? value : {};
};

const firstExisting = (root: string, names: string[]): string | undefined => {
  return names.find((name) => existsSync(join(root, name)));
};

const packageManagerFromLock = (
  root: string,
  packageJson: PackageJson | null,
): string => {
  const declared = asString(packageJson?.packageManager).split("@")[0];
  if (declared) return declared;
  if (firstExisting(root, ["bun.lock", "bun.lockb", "bunfig.toml"]))
    return "bun";
  if (firstExisting(root, ["pnpm-lock.yaml"])) return "pnpm";
  if (firstExisting(root, ["yarn.lock"])) return "yarn";
  if (firstExisting(root, ["package-lock.json"])) return "npm";
  return "";
};

const frameworkNames: Array<[string, string]> = [
  ["next", "Next.js"],
  ["react", "React"],
  ["vue", "Vue"],
  ["svelte", "Svelte"],
  ["@sveltejs/kit", "SvelteKit"],
  ["solid-js", "Solid"],
  ["@angular/core", "Angular"],
  ["@nestjs/core", "NestJS"],
  ["express", "Express"],
  ["fastify", "Fastify"],
  ["hono", "Hono"],
];

const detectFrameworks = (dependencies: Record<string, unknown>): string[] => {
  const names = new Set(Object.keys(dependencies));
  return frameworkNames
    .filter(([packageName]) => names.has(packageName))
    .map(([, label]) => label);
};

const defaultTestCommand = (
  root: string,
  languages: string[],
  runtime: string,
  packageManager: string,
): string => {
  if (packageManager === "bun") return "bun test";
  if (packageManager === "pnpm") return "pnpm test";
  if (packageManager === "yarn") return "yarn test";
  if (packageManager === "npm" || runtime === "node") return "npm test";
  if (runtime === "deno") return "deno test";
  if (languages.includes("Python")) return "pytest";
  if (languages.includes("Rust")) return "cargo test";
  if (languages.includes("Go")) return "go test ./...";
  if (existsSync(join(root, "bun.lock")) || existsSync(join(root, "bun.lockb")))
    return "bun test";
  return "";
};

/** Detect the software stack from common project manifests. */
export function detectProject(root = process.cwd()): DetectedProject {
  const abs = resolve(root);
  const sources: string[] = [];
  const packageJson = readJson<PackageJson>(join(abs, "package.json"));
  if (packageJson) sources.push("package.json");

  const packageManager = packageManagerFromLock(abs, packageJson);
  if (packageManager) sources.push(`${packageManager} lockfile`);

  const dependencies = {
    ...asRecord(packageJson?.dependencies),
    ...asRecord(packageJson?.devDependencies),
  };
  const hasTypeScript =
    dependencies.typescript !== undefined ||
    existsSync(join(abs, "tsconfig.json"));
  if (existsSync(join(abs, "tsconfig.json"))) sources.push("tsconfig.json");
  if (existsSync(join(abs, "biome.json"))) sources.push("biome.json");

  const languages: string[] = [];
  if (hasTypeScript || existsSync(join(abs, "deno.json")))
    languages.push("TypeScript");
  else if (packageJson) languages.push("JavaScript");
  if (
    existsSync(join(abs, "pyproject.toml")) ||
    existsSync(join(abs, "requirements.txt"))
  ) {
    languages.push("Python");
    sources.push("python manifest");
  }
  if (existsSync(join(abs, "Cargo.toml"))) {
    languages.push("Rust");
    sources.push("Cargo.toml");
  }
  if (existsSync(join(abs, "go.mod"))) {
    languages.push("Go");
    sources.push("go.mod");
  }

  let runtime = "";
  if (existsSync(join(abs, "deno.json"))) {
    runtime = "deno";
    sources.push("deno.json");
  } else if (
    packageManager === "bun" ||
    existsSync(join(abs, "bun.lock")) ||
    existsSync(join(abs, "bun.lockb")) ||
    existsSync(join(abs, "bunfig.toml"))
  ) {
    runtime = "bun";
  } else if (packageJson) {
    runtime = "node";
  } else if (languages.includes("Python")) {
    runtime = "python";
  } else if (languages.includes("Rust")) {
    runtime = "rust";
  } else if (languages.includes("Go")) {
    runtime = "go";
  }

  const scripts = asRecord(packageJson?.scripts);
  const testCommand =
    asString(scripts.test) ||
    defaultTestCommand(abs, languages, runtime, packageManager);
  const buildCommand = asString(scripts.build);

  return {
    name: asString(packageJson?.name) || basename(abs),
    goal: asString(packageJson?.description),
    software: {
      languages: [...new Set(languages)],
      runtime,
      packageManager,
      frameworks: detectFrameworks(dependencies),
      testCommand,
      buildCommand,
    },
    sources: [...new Set(sources)],
  };
}

/** Walk up from start looking for a maaidd project or config file. */
export function findProjectRoot(start = process.cwd()): string {
  const origin = resolve(start);
  let dir = origin;
  for (;;) {
    if (
      existsSync(join(dir, PROJECT_FILE)) ||
      existsSync(join(dir, CONFIG_FILE))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return origin;
    dir = parent;
  }
}

export function projectFileExists(root = findProjectRoot()): boolean {
  return existsSync(join(root, PROJECT_FILE));
}

export function loadEffectiveConfig(root = findProjectRoot()): MaaiddConfig {
  return loadConfig(join(root, CONFIG_FILE));
}

const createProject = (
  root: string,
  detected: DetectedProject,
  now: string,
): ProjectContext => {
  const software = detected.software;
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    name: detected.name || basename(root),
    goal: "",
    scope: structuredClone(PROJECT_DEFAULTS.scope),
    software: {
      languages: [...software.languages],
      runtime: software.runtime,
      packageManager: software.packageManager,
      frameworks: [...software.frameworks],
      testCommand: software.testCommand,
      buildCommand: software.buildCommand,
    },
    design: structuredClone(PROJECT_DEFAULTS.design),
    constraints: [],
    bestPractices: structuredClone(PROJECT_DEFAULTS.bestPractices),
    createdAt: now,
    updatedAt: now,
  };
};

const mergeProject = (
  base: ProjectContext,
  input: ProjectInput,
): ProjectContext => {
  const merged = mergeDeep(base, input);
  merged.schemaVersion = PROJECT_SCHEMA_VERSION;
  merged.createdAt = base.createdAt;
  merged.updatedAt = base.updatedAt;
  return merged;
};

const projectContent = (project: ProjectContext): string => {
  const { createdAt, updatedAt, ...content } = project;
  return JSON.stringify(content);
};

export function projectStatus(
  project: ProjectContext | null,
): ProjectStatusResult {
  if (!project) {
    return {
      status: "missing",
      missing: ["name", "goal", "scope.in", "software"],
    };
  }
  const missing: string[] = [];
  if (!project.name.trim()) missing.push("name");
  if (!project.goal.trim()) missing.push("goal");
  if (project.scope.in.length === 0) missing.push("scope.in");
  if (!project.software.languages.length && !project.software.runtime)
    missing.push("software");
  return {
    status: missing.length === 0 ? "complete" : "partial",
    missing,
  };
}

/** Load and normalize a project context; returns null when not initialized. */
export function loadProject(root = findProjectRoot()): ProjectContext | null {
  const file = join(root, PROJECT_FILE);
  if (!existsSync(file)) return null;
  const raw = readJson<unknown>(file);
  if (raw === null) {
    throw new Error(`Cannot read ${PROJECT_FILE}: invalid JSON`);
  }
  const parsed = ProjectInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid ${PROJECT_FILE}: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  const now = new Date().toISOString();
  const detected = detectProject(root);
  const base = createProject(root, detected, now);
  const merged = mergeProject(base, parsed.data);
  const meta = asRecord(raw);
  if (typeof meta.createdAt === "string") merged.createdAt = meta.createdAt;
  if (typeof meta.updatedAt === "string") merged.updatedAt = meta.updatedAt;
  return merged;
}

const textOr = (value: string): string => {
  const trimmed = value.trim();
  return trimmed ? trimmed : "_Not set._";
};

const listOr = (values: string[]): string => {
  return values.length
    ? values.map((value) => `- ${value}`).join("\n")
    : "_None recorded._";
};

const codeOr = (value: string): string => {
  return value.trim() ? `\`${value.trim()}\`` : "_Not set._";
};

const yesNo = (value: boolean): string => (value ? "yes" : "no");

/**
 * Render PROJECT.md deterministically from the project context and effective
 * tooling config. The output contains no generated prose or timestamps.
 */
export function renderProjectMarkdown(
  project: ProjectContext,
  config: MaaiddConfig,
): string {
  const software = project.software;
  const best = project.bestPractices;
  const lines = [
    "<!-- Generated from maaidd.project.json and maaidd.config.json by maaidd. Do not edit directly. -->",
    "",
    `# ${project.name.trim() || "Project"}`,
    "",
    "## Goal",
    "",
    textOr(project.goal),
    "",
    "## Scope",
    "",
    "### In scope",
    "",
    listOr(project.scope.in),
    "",
    "### Out of scope",
    "",
    listOr(project.scope.out),
    "",
    "## Software",
    "",
    `- **Languages:** ${software.languages.length ? software.languages.join(", ") : "_Not set._"}`,
    `- **Runtime:** ${software.runtime || "_Not set._"}`,
    `- **Package manager:** ${software.packageManager || "_Not set._"}`,
    `- **Frameworks:** ${software.frameworks.length ? software.frameworks.join(", ") : "_None recorded._"}`,
    `- **Test command:** ${codeOr(software.testCommand)}`,
    `- **Build command:** ${codeOr(software.buildCommand)}`,
    "",
    "## Design",
    "",
    "### Summary",
    "",
    textOr(project.design.summary),
    "",
    "### Principles",
    "",
    listOr(project.design.principles),
    "",
    "### Architecture",
    "",
    textOr(project.design.architecture),
    "",
    "## Constraints",
    "",
    listOr(project.constraints),
    "",
    "## Best practices",
    "",
    "### Git commits",
    "",
    textOr(best.commits),
    "",
    "### Formatting",
    "",
    textOr(best.formatting),
    "",
    "### Testing",
    "",
    textOr(best.testing),
    "",
    "### Documentation",
    "",
    textOr(best.documentation),
    "",
    "## Tooling",
    "",
    `- **Style:** \`${config.style}\``,
    `- **Indent:** \`${config.indent === "tab" ? "tab" : `${config.indent} spaces`}\``,
    `- **Line width:** \`${config.lineWidth}\``,
    `- **Semicolons:** \`${yesNo(config.semicolons)}\``,
    `- **Quote style:** \`${config.quoteStyle}\``,
    `- **Trailing commas:** \`${config.trailingComma}\``,
    `- **To arrow:** \`${yesNo(config.toArrow)}\``,
    `- **Biome:** \`${yesNo(config.biome)}\``,
    `- **Functional comma style:** \`${config.functional.commaStyle}\``,
    `- **Functional object value indent:** \`${config.functional.objectValueIndent}\``,
    `- **Functional array value indent:** \`${config.functional.arrayValueIndent}\``,
    `- **Functional force blank lines:** \`${yesNo(config.functional.forceBlankLines)}\``,
    `- **Functional semicolons:** \`${yesNo(config.functional.semicolons)}\``,
    `- **Functional max inline array items:** \`${config.functional.maxInlineArrayItems}\``,
    `- **Metrics exclude under:** \`${config.metrics.excludeUnder}\``,
    `- **Metrics test command:** \`${config.metrics.testCommand}\``,
    `- **Max cyclomatic:** \`${config.metrics.thresholds.maxCyclomatic}\``,
    `- **Min FTA score:** \`${config.metrics.thresholds.minFtaScore}\``,
    `- **MCP codegraph:** \`${yesNo(config.mcp.codegraph)}\``,
    `- **MCP metrics:** \`${yesNo(config.mcp.metrics)}\``,
  ];
  return `${lines.join("\n").trimEnd()}\n`;
}

const requiredQuestions = (
  project: ProjectContext,
  detected: DetectedProject,
): RequiredQuestion[] => {
  const questions: RequiredQuestion[] = [];
  if (!project.name.trim()) {
    questions.push({
      key: "name",
      question: "What is the project name?",
      suggested: detected.name,
    });
  }
  if (!project.goal.trim()) {
    questions.push({
      key: "goal",
      question: "What is the project goal in one sentence?",
      ...(detected.goal ? { suggested: detected.goal } : {}),
    });
  }
  if (project.scope.in.length === 0) {
    questions.push({
      key: "scope.in",
      question: "What is in scope for this project?",
    });
  }
  if (project.scope.out.length === 0) {
    questions.push({
      key: "scope.out",
      question: "What is explicitly out of scope? (recommended)",
    });
  }
  if (!project.software.languages.length && !project.software.runtime) {
    questions.push({
      key: "software",
      question:
        "Confirm the languages, runtime, package manager, frameworks, and test command.",
      suggested: detected.software,
    });
  }
  return questions;
};

const optionalOptions = (
  project: ProjectContext,
  config: MaaiddConfig,
): SetupOption[] => {
  return [
    {
      key: "design.summary",
      type: "string",
      value: project.design.summary,
      description: "Short design summary.",
    },
    {
      key: "design.principles",
      type: "string[]",
      value: project.design.principles,
      description: "Design principles the implementation should follow.",
    },
    {
      key: "design.architecture",
      type: "string",
      value: project.design.architecture,
      description: "Architecture notes or constraints.",
    },
    {
      key: "constraints",
      type: "string[]",
      value: project.constraints,
      description: "Hard project constraints.",
    },
    {
      key: "bestPractices.commits",
      type: "string",
      value: project.bestPractices.commits,
      description: "Git commit expectations.",
    },
    {
      key: "bestPractices.formatting",
      type: "string",
      value: project.bestPractices.formatting,
      description: "Formatting expectations.",
    },
    {
      key: "bestPractices.testing",
      type: "string",
      value: project.bestPractices.testing,
      description: "Testing expectations.",
    },
    {
      key: "bestPractices.documentation",
      type: "string",
      value: project.bestPractices.documentation,
      description: "Documentation expectations.",
    },
    {
      key: "config.style",
      type: "enum: biome|functional",
      value: config.style,
      description: "Formatting style.",
    },
    {
      key: "config.indent",
      type: "number|tab",
      value: config.indent,
      description: "Indent width.",
    },
    {
      key: "config.lineWidth",
      type: "number",
      value: config.lineWidth,
      description: "Maximum line width.",
    },
    {
      key: "config.semicolons",
      type: "boolean",
      value: config.semicolons,
      description: "Emit semicolons.",
    },
    {
      key: "config.quoteStyle",
      type: "enum: double|single",
      value: config.quoteStyle,
      description: "Quote style.",
    },
    {
      key: "config.trailingComma",
      type: "enum: all|es5|none",
      value: config.trailingComma,
      description: "Trailing comma style.",
    },
    {
      key: "config.metrics.excludeUnder",
      type: "number",
      value: config.metrics.excludeUnder,
      description: "Exclude files under this many lines from FTA metrics.",
    },
    {
      key: "config.metrics.testCommand",
      type: "string",
      value: config.metrics.testCommand,
      description: "Test command used for metric snapshots.",
    },
    {
      key: "config.metrics.thresholds.maxCyclomatic",
      type: "number",
      value: config.metrics.thresholds.maxCyclomatic,
      description: "Gate maximum cyclomatic complexity.",
    },
    {
      key: "config.metrics.thresholds.minFtaScore",
      type: "number",
      value: config.metrics.thresholds.minFtaScore,
      description: "Gate minimum FTA score.",
    },
    {
      key: "config.mcp.codegraph",
      type: "boolean",
      value: config.mcp.codegraph,
      description: "Enable codegraph MCP functionality.",
    },
    {
      key: "config.mcp.metrics",
      type: "boolean",
      value: config.mcp.metrics,
      description: "Enable metrics MCP functionality.",
    },
  ];
};

export function buildSetupPlan(
  root = findProjectRoot(),
  include: "required" | "optional" | "all" = "required",
): ProjectInitPlan {
  const project = loadProject(root);
  const detected = detectProject(root);
  const now = new Date().toISOString();
  const effective = project ?? createProject(root, detected, now);
  const effectiveStatus = projectStatus(effective);
  const status: ProjectStatus = project ? effectiveStatus.status : "missing";
  const required =
    effectiveStatus.status === "complete"
      ? []
      : requiredQuestions(effective, detected);
  const defaults =
    status === "complete"
      ? undefined
      : {
          bestPractices: effective.bestPractices,
          designPrinciples: effective.design.principles,
          constraints: effective.constraints,
        };
  const optional =
    include === "required"
      ? undefined
      : optionalOptions(effective, loadEffectiveConfig(root));

  return {
    status,
    root,
    projectFile: PROJECT_FILE,
    projectDoc: PROJECT_DOC,
    missing: effectiveStatus.missing,
    detected,
    required,
    ...(defaults ? { defaults } : {}),
    ...(optional ? { optional } : {}),
    guidance:
      "MCP cannot prompt directly. Ask only the required questions. Apply defaults without prompting; request include:'optional' only when the user wants to review additional settings.",
    next:
      status === "complete"
        ? "Project context is complete. Use project_read before major design or scope decisions."
        : "Collect answers and call project_update with a `project` object. Defaults are applied automatically.",
  };
}

const readConfigObject = (root: string): unknown => {
  const file = join(root, CONFIG_FILE);
  if (!existsSync(file)) return {};
  const raw = readJson<unknown>(file);
  if (raw === null) {
    throw new Error(`Cannot read ${CONFIG_FILE}: invalid JSON`);
  }
  return raw;
};

const mergedConfig = (root: string, patch: ConfigPatch): MaaiddConfig => {
  const existing = readConfigObject(root);
  const withExisting = mergeDeep(
    DEFAULT_CONFIG as unknown as Record<string, unknown>,
    existing,
  );
  return mergeDeep(withExisting, patch) as unknown as MaaiddConfig;
};

export function updateProject(
  options: UpdateProjectOptions = {},
): UpdateProjectResult {
  const root = options.root ?? findProjectRoot();
  const parsedProject = ProjectInputSchema.parse(options.project ?? {});
  const parsedConfig = options.config
    ? ConfigPatchSchema.parse(options.config)
    : undefined;
  const existing = loadProject(root);
  const detected = detectProject(root);
  const now = new Date().toISOString();
  const base = existing ?? createProject(root, detected, now);
  const candidate = mergeProject(base, parsedProject);
  const changed =
    !existing || projectContent(candidate) !== projectContent(base);
  candidate.createdAt = base.createdAt;
  candidate.updatedAt = changed ? now : base.updatedAt;

  const config = parsedConfig
    ? mergedConfig(root, parsedConfig)
    : loadEffectiveConfig(root);
  const markdown = renderProjectMarkdown(candidate, config);

  const projectPath = join(root, PROJECT_FILE);
  const docPath = join(root, PROJECT_DOC);
  const configPath = join(root, CONFIG_FILE);
  const projectText = `${JSON.stringify(candidate, null, 2)}\n`;
  const configText = `${JSON.stringify(config, null, 2)}\n`;
  const existingProjectText = existsSync(projectPath)
    ? readFileSync(projectPath, "utf8")
    : null;
  const existingDocText = existsSync(docPath)
    ? readFileSync(docPath, "utf8")
    : null;
  const existingConfigText = existsSync(configPath)
    ? readFileSync(configPath, "utf8")
    : null;
  const writeProject = existingProjectText !== projectText;
  const writeDoc = existingDocText !== markdown;
  const writeConfig =
    parsedConfig !== undefined && existingConfigText !== configText;
  const written: string[] = [];
  if (!options.dryRun) {
    if (writeProject) {
      writeFileSync(projectPath, projectText, "utf8");
      written.push(PROJECT_FILE);
    }
    if (writeDoc) {
      writeFileSync(docPath, markdown, "utf8");
      written.push(PROJECT_DOC);
    }
    if (writeConfig) {
      writeFileSync(configPath, configText, "utf8");
      written.push(CONFIG_FILE);
    }
  }
  const status = projectStatus(candidate);
  return {
    root,
    status: status.status,
    missing: status.missing,
    projectFile: PROJECT_FILE,
    projectDoc: PROJECT_DOC,
    written,
    dryRun: Boolean(options.dryRun),
    project: candidate,
    markdown,
    config,
  };
}

export function readProjectContext(
  root = findProjectRoot(),
): ProjectReadResult {
  const project = loadProject(root);
  const status = projectStatus(project);
  if (!project) {
    return {
      root,
      status: status.status,
      missing: status.missing,
      projectFile: PROJECT_FILE,
      projectDoc: PROJECT_DOC,
      project: null,
      markdown: null,
      docInSync: false,
    };
  }
  const config = loadEffectiveConfig(root);
  const markdown = renderProjectMarkdown(project, config);
  const docPath = join(root, PROJECT_DOC);
  const existingDoc = existsSync(docPath)
    ? readFileSync(docPath, "utf8")
    : null;
  return {
    root,
    status: status.status,
    missing: status.missing,
    projectFile: PROJECT_FILE,
    projectDoc: PROJECT_DOC,
    project,
    markdown,
    docInSync: existingDoc === markdown,
  };
}
