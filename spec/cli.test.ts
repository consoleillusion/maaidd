import { describe, it, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { makeTempDir } from "./test-utils.ts";

const CLI = resolve("src/cli/index.ts");

function makeTempProject(): string {
  const dir = makeTempDir("maid-cli-init-");
  writeFileSync(
    join(dir, "package.json"),
    `${JSON.stringify(
      {
        name: "init-demo",
        scripts: { test: "bun test" },
        devDependencies: { typescript: "^5" },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(join(dir, "tsconfig.json"), "{}\n", "utf8");
  writeFileSync(join(dir, "bun.lock"), "", "utf8");
  return dir;
}

function runInit(dir: string, ...args: string[]) {
  return spawnSync(
    "bun",
    [
      "run",
      CLI,
      "init",
      "--non-interactive",
      "--write-config",
      "--no-hooks",
      ...args,
    ],
    {
      encoding: "utf8",
      cwd: dir,
    },
  );
}

function runCli(...args: string[]): {
  stdout: string;
  stderr: string;
  status: number | null;
} {
  const result = spawnSync("bun", ["run", CLI, ...args], {
    encoding: "utf8",
    cwd: process.cwd(),
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}

describe("CLI", () => {
  it("shows help", () => {
    const { stdout, status } = runCli("--help");
    expect(status).toBe(0);
    expect(stdout).toContain("format");
    expect(stdout).toContain("metrics");
    expect(stdout).toContain("mcp");
  });

  it("formats stdin in functional style", () => {
    const result = spawnSync(
      "bun",
      ["run", CLI, "format", "--style", "functional"],
      {
        encoding: "utf8",
        input: "const x = { a: 1, b: 2 };",
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(",");
  });

  it("formats stdin in biome style", () => {
    const result = spawnSync(
      "bun",
      ["run", CLI, "format", "--style", "biome"],
      {
        encoding: "utf8",
        input: "const x = {'a':1};",
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"a"');
  });

  it("runs metrics on examples/", () => {
    const { stdout, status } = runCli("metrics", "examples");
    expect(status).toBe(0);
    expect(stdout).toContain("file");
  });

  it("runs gate on examples/ (may pass or fail)", () => {
    const { status } = runCli("gate", "examples");
    expect(status).not.toBeNull();
  });

  it("init creates config, project context, and generated docs", () => {
    const tmp = makeTempProject();
    const result = runInit(tmp);
    expect(result.status).toBe(0);
    expect(existsSync(`${tmp}/maid.config.json`)).toBe(true);
    expect(existsSync(`${tmp}/biome.json`)).toBe(true);
    expect(existsSync(`${tmp}/maid.project.json`)).toBe(true);
    expect(existsSync(`${tmp}/PROJECT.md`)).toBe(true);

    const project = JSON.parse(
      readFileSync(`${tmp}/maid.project.json`, "utf8"),
    ) as {
      name: string;
      goal: string;
      bestPractices: { commits: string };
    };
    expect(project.name).toBe("init-demo");
    expect(project.goal).toBe("");
    expect(project.bestPractices.commits).toContain("atomic");
    expect(result.stdout).toContain("Missing project fields: goal, scope.in");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("init completes project context from non-interactive flags", () => {
    const tmp = makeTempProject();
    const result = runInit(
      tmp,
      "--goal",
      "Build the initial project",
      "--scope-in",
      "core, docs",
      "--scope-out",
      "billing",
    );
    expect(result.status).toBe(0);

    const project = JSON.parse(
      readFileSync(`${tmp}/maid.project.json`, "utf8"),
    ) as {
      goal: string;
      scope: { in: string[]; out: string[] };
    };
    expect(project.goal).toBe("Build the initial project");
    expect(project.scope).toEqual({
      in: ["core", "docs"],
      out: ["billing"],
    });
    expect(result.stdout).toContain("Project status: complete");

    const doc = readFileSync(`${tmp}/PROJECT.md`, "utf8");
    expect(doc).toContain("Build the initial project");
    expect(doc).toContain("- core");
    expect(doc).toContain("- billing");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("init --skip-project leaves project files untouched", () => {
    const tmp = makeTempProject();
    const result = runInit(tmp, "--skip-project");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Skipped project context initialization.");
    expect(existsSync(`${tmp}/maid.project.json`)).toBe(false);
    expect(existsSync(`${tmp}/PROJECT.md`)).toBe(false);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("init --show-options prints the optional catalog", () => {
    const tmp = makeTempProject();
    const result = runInit(tmp, "--skip-project", "--show-options");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Optional project settings");
    expect(result.stdout).toContain("design.principles");
    expect(result.stdout).toContain("config.lineWidth");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("init preserves project context and regenerates docs for config changes", () => {
    const tmp = makeTempProject();
    const first = runInit(
      tmp,
      "--goal",
      "Keep this goal",
      "--scope-in",
      "core",
    );
    expect(first.status).toBe(0);
    const firstProject = readFileSync(`${tmp}/maid.project.json`, "utf8");

    const second = runInit(tmp, "--force", "--line-width", "100");
    expect(second.status).toBe(0);
    expect(readFileSync(`${tmp}/maid.project.json`, "utf8")).toBe(firstProject);

    const doc = readFileSync(`${tmp}/PROJECT.md`, "utf8");
    expect(doc).toContain("Keep this goal");
    expect(doc).toContain("**Line width:** `100`");
    rmSync(tmp, { recursive: true, force: true });
  });
});
