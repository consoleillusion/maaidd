import { describe, it, expect } from "bun:test";
import { loadConfig, resolveFormatOptions } from "../src/config.ts";
import { DEFAULT_CONFIG } from "../src/types.ts";

describe("config loading", () => {
  it("returns defaults when no config file", () => {
    const config = loadConfig("/nonexistent/path");
    expect(config.style).toBe(DEFAULT_CONFIG.style);
    expect(config.indent).toBe(DEFAULT_CONFIG.indent);
  });

  it("deep-merges nested objects", () => {
    const config = loadConfig();
    expect(config.functional.commaStyle).toBe("leading");
    expect(config.functional.objectValueIndent).toBe(1);
  });
});

describe("resolveFormatOptions", () => {
  it("uses config defaults", () => {
    const resolved = resolveFormatOptions({}, DEFAULT_CONFIG);
    expect(resolved.style).toBe("biome");
    expect(resolved.indent).toBe(2);
    expect(resolved.lineWidth).toBe(80);
  });

  it("overrides with explicit options", () => {
    const resolved = resolveFormatOptions(
      { style: "functional", indent: 4 },
      DEFAULT_CONFIG,
    );
    expect(resolved.style).toBe("functional");
    expect(resolved.indent).toBe(4);
  });

  it("merges functional options", () => {
    const resolved = resolveFormatOptions(
      { functional: { maxInlineArrayItems: 5 } },
      DEFAULT_CONFIG,
    );
    expect(resolved.functional.maxInlineArrayItems).toBe(5);
    expect(resolved.functional.commaStyle).toBe("leading");
  });

  it("infers typescript from filename", () => {
    const resolved = resolveFormatOptions(
      { filename: "test.ts" },
      DEFAULT_CONFIG,
    );
    expect(resolved.typescript).toBe(true);
  });
});
