/**
 * Wider-style printer: comma-first objects/arrays, configurable indent,
 * optional trailing leading-comma on last items, semicolon control.
 */
import { makeIndent } from "./context.js";
import { printNode } from "./dispatch.js";

/**
 * @param {import('@babel/types').Node} node
 * @param {object} options
 * @returns {string}
 */
export function print(node, options = {}) {
  const opts = {
    indent: 2,
    trailingComma: true,
    semicolons: true,
    ...options,
  };
  const ind = makeIndent(opts);
  const ctx = {
    opts,
    ind,
    // column where current line's content started (for comma-first align)
    alignCol: 0,
  };
  return printNode(node, ctx, 0).replace(/\s+$/m, "") + "\n";
}
