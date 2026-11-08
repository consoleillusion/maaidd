import { parse } from "@babel/parser";
import { print } from "./printer/index.js";
import { applyToArrow } from "./transforms/toArrow.js";

/**
 * Legacy JS formatter API — MAAIDD comma-first style (Babel printer).
 * Prefer the TypeScript API from "./index.ts" for Biome-first/functional modes.
 */
export function format(source, options = {}) {
  const {
    indent = 2,
    trailingComma = true,
    semicolons = true,
    toArrow = false,
    filename = "file.js",
  } = options;

  const isTS = /\.tsx?$/.test(filename) || options.typescript;

  const ast = parse(source, {
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
    ],
  });

  if (toArrow) applyToArrow(ast);

  return print(ast, { indent, trailingComma, semicolons });
}

export default format;
