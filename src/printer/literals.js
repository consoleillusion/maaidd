/**
 * Literals, templates, and object/member keys.
 */
import { printNode } from "./dispatch.js";

export function printLiteral(node) {
  if (node.type === "StringLiteral") {
    // Prefer original extra.raw when present
    if (node.extra && typeof node.extra.raw === "string") return node.extra.raw;
    return JSON.stringify(node.value);
  }
  if (node.type === "NumericLiteral") {
    if (node.extra && typeof node.extra.raw === "string") return node.extra.raw;
    return String(node.value);
  }
  if (node.type === "BooleanLiteral") return node.value ? "true" : "false";
  if (node.type === "BigIntLiteral") return (node.value ?? node.bigint) + "n";
  if (node.type === "NullLiteral") return "null";
  return String(node.value ?? "");
}

export function printTemplate(node, ctx, depth) {
  let out = "`";
  for (let i = 0; i < node.quasis.length; i++) {
    out += node.quasis[i].value.raw;
    if (i < node.expressions.length) {
      out += "${" + printNode(node.expressions[i], ctx, depth) + "}";
    }
  }
  return out + "`";
}

export function printKey(prop, ctx, depth) {
  if (prop.computed) {
    return "[" + printNode(prop.key, ctx, depth) + "]";
  }
  if (prop.key.type === "Identifier") return prop.key.name;
  return printNode(prop.key, ctx, depth);
}
