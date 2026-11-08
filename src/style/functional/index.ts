/**
 * Functional style pipeline: Biome → reparse → leading-comma layout.
 *
 * The functional printer is a *diff from Biome*, not an independent formatter.
 * Biome normalizes whitespace, quotes, semicolons, and comments first; then
 * the leading-comma printer re-parses the Biome output and applies only the
 * collection layout (leading commas, expanded objects, operator chains).
 * This is what makes diffs across commits consistent.
 */
import { parse } from "@babel/parser";
import { formatWithBiome } from "../biome.ts";
import { makeContext } from "./printer/context.ts";
import { printNode } from "./printer/dispatch.ts";
import { applyToArrow } from "../../transforms/toArrow.ts";
import type { ResolvedFormatOptions } from "../../types.ts";

export function formatFunctional(
  source: string,
  options: ResolvedFormatOptions,
): string {
  // 1. Biome normalizes everything (quotes, semis, whitespace, comments).
  const biomeOptions: ResolvedFormatOptions = {
    ...options,
    semicolons: true, // Biome adds semicolons; the printer preserves them
  };
  const normalized = formatWithBiome(source, biomeOptions, {
    forceStyle: true,
  });

  // 2. Re-parse the Biome output.
  const isTS = /\.(?:[cm]?ts|tsx)$/i.test(options.filename);
  const ast = parse(normalized, {
    sourceType: "module",
    allowReturnOutsideFunction: true,
    plugins: [
      "jsx",
      ...(isTS ? ["typescript"] : []),
      "classProperties",
      "classPrivateProperties",
      "classPrivateMethods",
      "dynamicImport",
      "optionalChaining",
      "nullishCoalescingOperator",
      "topLevelAwait",
      "decorators-legacy",
    ] as any,
  });

  // 3. Optionally transform function declarations to const arrows.
  if (options.toArrow) {
    applyToArrow(ast);
  }

  // 4. Apply leading-comma layout as a diff from Biome.
  const ctx = makeContext({
    indent: options.indent,
    lineWidth: options.lineWidth,
    semicolons: options.semicolons,
    commaStyle: options.functional.commaStyle,
    objectValueIndent: options.functional.objectValueIndent,
    arrayValueIndent: options.functional.arrayValueIndent,
    forceBlankLines: options.functional.forceBlankLines,
    maxInlineArrayItems: options.functional.maxInlineArrayItems,
  });

  return printNode(ast, ctx, 0) + "\n";
}
