import { afterEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { saveSnapshot } from "../src/metrics/history.ts";
import { makeTempDir, runCli, writeExecutable } from "./test-utils.ts";

const temporaryDirs: string[] = [];
function project(): string {
  const dir = makeTempDir();
  temporaryDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("format and check commands", () => {
  it("checks without writing, formats in place, then reports clean", () => {
    const dir = project();
    const file = join(dir, "input.ts");
    writeFileSync(file, "const message = {'a':1};\n");

    const dirty = runCli(["check", file], { cwd: dir });
    expect(dirty.status).toBe(1);
    expect(dirty.stderr).toContain("Would format:");
    expect(readFileSync(file, "utf8")).toBe("const message = {'a':1};\n");

    const formatted = runCli(["format", file, "--output", file], { cwd: dir });
    expect(formatted.status).toBe(0);
    expect(readFileSync(file, "utf8")).toContain('"a": 1');

    const clean = runCli(["check", file], { cwd: dir });
    expect(clean.status).toBe(0);
    expect(clean.stderr).toContain("all clean");
  });

  it("mirrors directories and skips dependency directories", () => {
    const dir = project();
    const source = join(dir, "src");
    const output = join(dir, "out");
    mkdirSync(join(source, "node_modules"), { recursive: true });
    mkdirSync(output);
    writeFileSync(join(source, "a.ts"), "const value = {'a':1};");
    writeFileSync(join(source, "node_modules", "ignored.ts"), "const no = {'b':2};");

    const result = runCli(["format", source, "--output", output], { cwd: dir });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("Formatted 1 file");
    expect(readFileSync(join(output, "a.ts"), "utf8")).toContain('"a"');
    expect(existsSync(join(output, "node_modules"))).toBe(false);
  });

  it("accepts documented kebab-case style flags on stdin", () => {
    const result = runCli(
      ["format", "--quote-style", "single", "--no-semicolons"],
      { input: 'const message = "hello";' },
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("const message = 'hello'");
  });

  it("handles empty stdin and missing inputs", () => {
    const empty = runCli(["format"], { input: "" });
    expect(empty.status).toBe(0);
    expect(empty.stdout).toBe("");

    const missing = runCli(["format", ".does-not-exist.ts"]);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("Input not found:");
  });
});

describe("project commands", () => {
  it("writes a uPlot report to an output file", () => {
    const dir = project();
    saveSnapshot(dir, "a".repeat(40), [
      { file_name: "a.ts", cyclo: 2, fta_score: 90, assessment: "OK", line_count: 20 },
    ]);
    const output = join(dir, "dashboard.html");

    const result = runCli(["report", "--output", output], { cwd: dir });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("Report written to");
    expect(readFileSync(output, "utf8")).toContain("new uPlot");
  });

  it("initializes without overwriting existing config files", () => {
    const dir = project();
    const first = runCli(["init"], { cwd: dir });
    expect(first.status).toBe(0);

    const configPath = join(dir, "maaidd.config.json");
    const original = readFileSync(configPath, "utf8");
    expect(JSON.parse(original).metrics.testCommand).toBe("bun run test");
    expect(existsSync(join(dir, "biome.json"))).toBe(true);

    const second = runCli(["init"], { cwd: dir });
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("Already exists:");
    expect(readFileSync(configPath, "utf8")).toBe(original);
  });

  it("reports a missing codegraph index", () => {
    const result = runCli(["graph"], { cwd: project() });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("No code-graph index found");
  });

  it("shows codegraph status and executes queries", () => {
    const dir = project();
    mkdirSync(join(dir, ".code-graph"), { recursive: true });
    writeFileSync(join(dir, ".code-graph", "index.db"), "");
    writeFileSync(join(dir, ".code-graph", "source-roots.json"), '{"roots":["src"]}');

    const status = runCli(["graph"], { cwd: dir });
    expect(status.status).toBe(0);
    expect(status.stdout).toContain("Code-graph index:");
    expect(status.stdout).toContain('"roots":["src"]');

    const binary = join(dir, "fake-codegraph");
    writeExecutable(binary, "#!/bin/sh\nprintf 'query:%s\\n' \"$*\"\n");
    const query = runCli(["graph", "search", "format"], {
      cwd: dir,
      env: { CODEGRAPH_BIN: binary },
    });
    expect(query.status).toBe(0);
    expect(query.stdout).toContain("query:search format");
  });

  it("exposes completion subcommands without installing them", () => {
    const result = runCli(["completion", "--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("install");
    expect(result.stdout).toContain("uninstall");
  });
});
