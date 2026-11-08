/**
 * MAAIDD — Metric Assisted AI Driven Development.
 *
 * Public format API. Biome-first by default; functional mode is a layout diff
 * applied on top of Biome's normalization.
 */
import { formatWithBiome } from "./style/biome.ts";
import { formatFunctional } from "./style/functional/index.ts";
import { loadConfig, resolveFormatOptions } from "./config.ts";
import type { FormatOptions, ResolvedFormatOptions } from "./types.ts";
/**
 * Format source code.
 *
 * - `style: "biome"` (default): Biome formatting with config-file-driven defaults.
 * - `style: "functional"`: Biome normalization, then the leading-comma layout diff.
 *   `toArrow` is applied in the functional pipeline after Biome normalization.
 */
export function format(source: string, options: FormatOptions = {}): string {
  const config = options.configPath
    ? loadConfig(options.configPath)
    : loadConfig();
  const resolved = resolveFormatOptions(options, config);
  if (resolved.style === "functional") {
    return formatFunctional(source, resolved);
  }
  // Biome mode: toArrow is not supported (Biome has no equivalent transform).
  // Style flags are only forwarded if explicitly provided, so biome.json governs.
  const explicit = new Set<string>();
  if (options.indent !== undefined) explicit.add("indent");
  if (options.lineWidth !== undefined) explicit.add("line-width");
  if (options.semicolons !== undefined) explicit.add("semicolons");
  if (options.quoteStyle !== undefined) explicit.add("quote-style");
  if (options.trailingComma !== undefined) explicit.add("trailing-comma");
  return formatWithBiome(source, resolved, { explicit });
}
export { formatFunctional, formatWithBiome, loadConfig, resolveFormatOptions };
export type { FormatOptions, ResolvedFormatOptions };
export default format;
