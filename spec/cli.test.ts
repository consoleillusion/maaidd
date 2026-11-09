import { describe, it, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const CLI = resolve("src/cli/index.ts");

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

  it("init creates config files", () => {
    const tmp = `/tmp/opencode/cli-init-test-${Date.now()}`;
    mkdirSync(tmp, { recursive: true });
    const result = spawnSync(
      "bun",
      ["run", CLI, "init", "--non-interactive", "--write-config", "--no-hooks"],
      {
        encoding: "utf8",
        cwd: tmp,
      },
    );
    expect(result.status).toBe(0);
    expect(existsSync(`${tmp}/maid.config.json`)).toBe(true);
    expect(existsSync(`${tmp}/biome.json`)).toBe(true);
    rmSync(tmp, { recursive: true, force: true });
  });
});
