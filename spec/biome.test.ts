import { describe, it, expect } from "bun:test";
import { format } from "../src/index.ts";

describe("biome formatter", () => {
  it("formats with double quotes by default", () => {
    const out = format("const x = 'hello';", {
      style: "biome",
      filename: "test.ts",
    });
    expect(out).toContain('"hello"');
  });

  it("adds trailing commas", () => {
    const out = format("const x = { a: 1, b: 2, c: 3 };", {
      style: "biome",
      filename: "test.ts",
    });
    expect(out).toContain(",");
  });

  it("preserves semicolons", () => {
    const out = format("const x = 1;", {
      style: "biome",
      filename: "test.ts",
    });
    expect(out.trim()).toBe("const x = 1;");
  });

  it("normalizes indentation to 2 spaces", () => {
    const out = format("function foo() {\n  return 1;\n}", {
      style: "biome",
      filename: "test.ts",
    });
    expect(out).toContain("  return");
  });

  it("is idempotent", () => {
    const src = "const x = { a: 1, b: { c: 2 } };";
    const out1 = format(src, { style: "biome", filename: "test.ts" });
    const out2 = format(out1, { style: "biome", filename: "test.ts" });
    expect(out2).toBe(out1);
  });
});
