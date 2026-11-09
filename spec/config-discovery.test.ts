import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  findConfigPath,
  loadConfig,
  normalizeIndent,
  resolveFormatOptions,
} from "../src/config.ts";
import { DEFAULT_CONFIG } from "../src/types.ts";
import { makeTempDir } from "./test-utils.ts";

const temporaryDirs: string[] = [];
afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("config discovery and normalization", () => {
  it("walks upward from nested directories", () => {
    const dir = makeTempDir();
    temporaryDirs.push(dir);
    const nested = join(dir, "a", "b");
    mkdirSync(nested, { recursive: true });
    const path = join(dir, "maid.config.json");
    writeFileSync(
      path,
      JSON.stringify({ metrics: { testCommand: "node --test" } }),
    );

    expect(findConfigPath(nested)).toBe(path);
    const config = loadConfig(path);
    expect(config.metrics.testCommand).toBe("node --test");
    expect(config.metrics.thresholds).toEqual(
      DEFAULT_CONFIG.metrics.thresholds,
    );
  });

  it("reports malformed config files with their path", () => {
    const dir = makeTempDir();
    temporaryDirs.push(dir);
    const path = join(dir, "broken.json");
    writeFileSync(path, "{broken");
    expect(() => loadConfig(path)).toThrow(path);
  });

  it("normalizes indentation and respects explicit TypeScript overrides", () => {
    expect(normalizeIndent("tab")).toBe("tab");
    expect(normalizeIndent(3.4)).toBe(3);
    expect(normalizeIndent(100)).toBe(8);
    expect(normalizeIndent(-1)).toBe(2);

    expect(resolveFormatOptions({ filename: "a.ts" }).typescript).toBe(true);
    expect(resolveFormatOptions({ filename: "a.js" }).typescript).toBe(false);
    expect(
      resolveFormatOptions({ filename: "a.ts", typescript: false }).typescript,
    ).toBe(false);
  });

  it("does not mutate the default config during deep merges", () => {
    const dir = makeTempDir();
    temporaryDirs.push(dir);
    const path = join(dir, "config.json");
    writeFileSync(
      path,
      JSON.stringify({ metrics: { thresholds: { maxCyclomatic: 1 } } }),
    );
    expect(loadConfig(path).metrics.thresholds.maxCyclomatic).toBe(1);
    expect(DEFAULT_CONFIG.metrics.thresholds.maxCyclomatic).toBe(20);
  });
});
