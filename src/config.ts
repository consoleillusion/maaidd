import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  DEFAULT_CONFIG,
  FormatOptions,
  Indent,
  MaidConfig,
  ResolvedFormatOptions,
} from "./types.ts";
const isRecord = (value: unknown) => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};
const mergeDeep = (base: T, patch: unknown) => {
  if (!isRecord(patch)) return structuredClone(base);
  const out: Record<string, unknown> = { ...structuredClone(base) };
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
/** Walk up from start looking for maid.config.json. */
export function findConfigPath(start = process.cwd()): string | undefined {
  let dir = resolve(start);
  for (;;) {
    const candidate = join(dir, "maid.config.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
export function loadConfig(configPath?: string): MaidConfig {
  const file = configPath ? resolve(configPath) : findConfigPath();
  if (!file || !existsSync(file)) return structuredClone(DEFAULT_CONFIG);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(
      `Cannot read MAID config ${file}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return mergeDeep(
    DEFAULT_CONFIG as unknown as Record<string, unknown>,
    parsed,
  ) as unknown as MaidConfig;
}
export function normalizeIndent(indent: Indent): Indent {
  if (indent === "tab") return "tab";
  const value = Number(indent);
  if (!Number.isFinite(value) || value <= 0) return 2;
  return Math.min(8, Math.round(value));
}
export function resolveFormatOptions(
  input: FormatOptions = {},
  config: MaidConfig = DEFAULT_CONFIG,
): ResolvedFormatOptions {
  const filename = input.filename ?? "stdin.ts";
  const typescript =
    input.typescript ?? /\.(?:[cm]?ts|tsx)$/i.test(filename) ?? false;
  return {
    style: input.style ?? config.style,
    indent: normalizeIndent(input.indent ?? config.indent),
    lineWidth: input.lineWidth ?? config.lineWidth,
    semicolons: input.semicolons ?? config.semicolons,
    quoteStyle: input.quoteStyle ?? config.quoteStyle,
    trailingComma: input.trailingComma ?? config.trailingComma,
    toArrow: input.toArrow ?? config.toArrow,
    biome: input.biome ?? config.biome,
    filename,
    typescript,
    configPath: input.configPath,
    functional: { ...config.functional, ...(input.functional ?? {}) },
  };
}
