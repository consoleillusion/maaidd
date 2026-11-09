import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  DEFAULT_CONFIG,
  type FormatOptions,
  type Indent,
  type MaidConfig,
  type ResolvedFormatOptions,
} from "./types.ts";
import { resolveInsightsConfig } from "./insights/config.ts";
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
      out[key] = mergeDeep<Record<string, unknown>>(current, value);
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
/** Fill defaults and validate a raw config document. */
export function normalizeConfig(raw: unknown): MaidConfig {
  const merged = mergeDeep(
    DEFAULT_CONFIG as unknown as Record<string, unknown>,
    raw,
  ) as unknown as MaidConfig;
  merged.insights = resolveInsightsConfig(merged.insights);
  return merged;
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
  return normalizeConfig(parsed);
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
