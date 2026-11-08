import { afterEach, describe, expect, it } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import format, { format as namedFormat } from "../src/index.ts";
import { makeTempDir } from "./test-utils.ts";

const temporaryDirs: string[] = [];
afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("public format API", () => {
  it("exports the same function as default and named exports", () => {
    expect(format).toBe(namedFormat);
  });

  it("uses Biome with double quotes by default", () => {
    const output = format("const message = 'hello';", { filename: "a.ts" });
    expect(output.trim()).toBe('const message = "hello";');
  });

  it("applies explicit space and tab indentation", () => {
    const spaces = format("function f(){return 1;}", {
      filename: "a.ts",
      indent: 4,
    });
    const tabs = format("function f(){return 1;}", {
      filename: "a.ts",
      indent: "tab",
    });
    expect(spaces).toContain("    return 1;");
    expect(tabs).toContain("\treturn 1;");
  });

  it("applies quote, semicolon, and trailing-comma overrides", () => {
    const single = format('const message = "hello";', {
      filename: "a.ts",
      quoteStyle: "single",
    });
    const noSemicolon = format('const message = "hello";', {
      filename: "a.ts",
      semicolons: false,
    });
    const noTrailing = format(
      'const value = { alpha: "one", beta: "two", gamma: "three" };',
      { filename: "a.ts", trailingComma: "none", lineWidth: 20 },
    );

    expect(single).toContain("'hello'");
    expect(noSemicolon.trim()).toBe('const message = "hello"');
    expect(noTrailing).toContain('  gamma: "three"\n};');
  });

  it("honors the configured line width", () => {
    const output = format(
      'const value = { alpha: "one", beta: "two", gamma: "three" };',
      { filename: "a.ts", lineWidth: 30 },
    );
    expect(output).toContain("const value = {\n");
  });

  it("supports TypeScript syntax", () => {
    const output = format(
      "interface User { name: string; age: number } const user: User = { name: 'A', age: 1 };",
      { filename: "user.ts" },
    );
    expect(output).toContain("interface User");
    expect(output).toContain('name: "A"');
  });

  it("reports invalid source as a formatting error", () => {
    expect(() => format("const = ;", { filename: "broken.ts" })).toThrow(
      /Biome failed/,
    );
  });

  it("loads style options from an explicit config path", () => {
    const dir = makeTempDir();
    temporaryDirs.push(dir);
    const configPath = join(dir, "custom.json");
    writeFileSync(configPath, JSON.stringify({ style: "functional" }));

    const output = format(
      'const value = { alpha: "one", beta: "two", description: "long enough to expand this object and prove functional style is active" };',
      { filename: "a.ts", configPath },
    );
    expect(output).toContain("\n  ,");
  });
});

describe("functional transform pipeline", () => {
  it("converts function declarations when toArrow is enabled", () => {
    const options = {
      style: "functional" as const,
      filename: "math.ts",
      toArrow: true,
    };
    const once = format("function add(a, b) { return a + b; }", options);
    const twice = format(once, options);

    expect(once).toContain("const add = (a, b) => {");
    expect(once).not.toContain("function add");
    expect(twice).toBe(once);
  });
});
