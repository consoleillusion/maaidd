import type { Ctx } from "./context.ts";
import { printNode } from "./dispatch.ts";
export function printLiteral(node: any): string {
  if (node.type === "StringLiteral") {
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
export function printTemplate(node: any, ctx: Ctx, depth: number): string {
  let out = "`";
  for (let i = 0; i < node.quasis.length; i++) {
    out += node.quasis[i].value.raw;
    if (i < node.expressions.length) {
      out += "${" + printNode(node.expressions[i], ctx, depth) + "}";
    }
  }
  return out + "`";
}
export function printKey(prop: any, ctx: Ctx, depth: number): string {
  if (prop.computed) {
    return "[" + printNode(prop.key, ctx, depth) + "]";
  }
  if (prop.key.type === "Identifier") return prop.key.name;
  return printNode(prop.key, ctx, depth);
}
