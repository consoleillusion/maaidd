import { describe, it, expect } from "bun:test";
import { format } from "../src/index.ts";
import { readFileSync } from "node:fs";

describe("functional formatter — golden fixtures", () => {
  it("formats const obj to leading-comma style", () => {
    const input = readFileSync("fixtures/obj-input.js", "utf8");
    const expected = readFileSync("fixtures/obj-expected.js", "utf8");
    const out = format(input, { style: "functional", filename: "obj.js" });
    expect(out.trim()).toBe(expected.trim());
  });

  it("formats keySchema to leading-comma style", () => {
    const input = readFileSync("fixtures/keyschema-input.js", "utf8");
    const expected = readFileSync("fixtures/keyschema-expected.js", "utf8");
    const out = format(input, {
      style: "functional",
      filename: "keyschema.js",
    });
    expect(out.trim()).toBe(expected.trim());
  });
});

describe("functional formatter — idempotency", () => {
  it("format(format(obj)) === format(obj)", () => {
    const input = readFileSync("fixtures/obj-input.js", "utf8");
    const out1 = format(input, { style: "functional", filename: "obj.js" });
    const out2 = format(out1, { style: "functional", filename: "obj.js" });
    expect(out2).toBe(out1);
  });

  it("format(format(keySchema)) === format(keySchema)", () => {
    const input = readFileSync("fixtures/keyschema-input.js", "utf8");
    const out1 = format(input, {
      style: "functional",
      filename: "keyschema.js",
    });
    const out2 = format(out1, {
      style: "functional",
      filename: "keyschema.js",
    });
    expect(out2).toBe(out1);
  });

  it("is idempotent on a simple arrow function", () => {
    const src = "const add = (a, b) => a + b;";
    const out1 = format(src, { style: "functional", filename: "test.ts" });
    const out2 = format(out1, { style: "functional", filename: "test.ts" });
    expect(out2).toBe(out1);
  });

  it("is idempotent on a large object with nested arrays", () => {
    const src = `const config = { server: { host: "localhost", port: 8080, timeouts: [1000, 2000, 3000, 4000, 5000] }, debug: true };`;
    const out1 = format(src, { style: "functional", filename: "test.ts" });
    const out2 = format(out1, { style: "functional", filename: "test.ts" });
    expect(out2).toBe(out1);
  });
});

describe("functional formatter — layout rules", () => {
  it("expands objects that don't fit on one line", () => {
    const src = `const x = { name: "test", value: 42, description: "a description that is long enough to force expansion of the object" };`;
    const out = format(src, { style: "functional", filename: "test.ts" });
    expect(out).toContain("\n  ,");
  });

  it("inlines short objects that fit on one line", () => {
    const src = "const x = { a: 1, b: 2 };";
    const out = format(src, { style: "functional", filename: "test.ts" });
    expect(out.trim()).toBe("const x = { a: 1, b: 2 };");
  });

  it("inlines arrays with ≤ 3 simple items in property position", () => {
    const src = `const x = { name: "test", value: 42, items: [10, 20, 30], more: "padding to force object expansion and test array inline in property" };`;
    const out = format(src, { style: "functional", filename: "test.ts" });
    expect(out).toContain("[ 10, 20, 30 ]");
  });

  it("expands arrays with > 3 items in property position", () => {
    const src = `const x = { name: "test", value: 42, items: [10, 20, 30, 40, 50], more: "padding to force object expansion" };`;
    const out = format(src, { style: "functional", filename: "test.ts" });
    expect(out).toContain("\n      ,");
  });

  it("uses leading commas in expanded objects", () => {
    const src = `const x = { name: "test", value: 42, description: "long enough description to force expansion of the whole object" };`;
    const out = format(src, { style: "functional", filename: "test.ts" });
    expect(out).toContain("\n  , ");
    expect(out).not.toMatch(/,\s*$/m);
  });
});

describe("functional formatter — pipeline order", () => {
  it("passes through Biome first (normalizes quotes)", () => {
    const src = "const x = { a: 'hello' };";
    const out = format(src, { style: "functional", filename: "test.ts" });
    expect(out).toContain('"hello"');
    expect(out).not.toContain("'hello'");
  });

  it("preserves semicolons from Biome", () => {
    const src = "const x = 1;";
    const out = format(src, { style: "functional", filename: "test.ts" });
    expect(out.trim()).toBe("const x = 1;");
  });
});
