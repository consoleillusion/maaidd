/**
 * Function declarations, expressions, arrows, and parameter lists.
 */
import { printNode } from "./dispatch.js";

export function printParams(params, ctx, depth) {
  // Always single-line for function arguments
  return params.map((p) => printNode(p, ctx, depth)).join(", ");
}

export function printFunction(node, ctx, depth, isDecl) {
  const async = node.async ? "async " : "";
  const gen = node.generator ? "*" : "";
  const name = node.id ? printNode(node.id, ctx, depth) : "";
  const params = printParams(node.params, ctx, depth);
  const body = printNode(node.body, ctx, depth);
  const head = `${async}function${gen}${name ? " " + name : ""}(${params})`;
  if (isDecl) {
    return ctx.ind(depth) + head + " " + body.trimStart();
  }
  return head + " " + body.trimStart();
}

export function printArrow(node, ctx, depth) {
  const async = node.async ? "async " : "";
  const params = printParams(node.params, ctx, depth);
  // Single param without defaults/destructure can drop parens — keep parens for consistency
  const paramStr = `(${params})`;
  let body;
  if (node.body.type === "BlockStatement") {
    body = " " + printNode(node.body, ctx, depth).trimStart();
  } else {
    body = " " + printNode(node.body, ctx, depth);
  }
  return `${async}${paramStr} =>${body}`;
}
