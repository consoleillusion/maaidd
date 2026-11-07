/**
 * Classes, class bodies, methods, and properties.
 */
import { printNode } from "./dispatch.js";
import { semi } from "./context.js";
import { printParams } from "./functions.js";
import { printKey } from "./literals.js";

export function printClass(node, ctx, depth) {
  const name = node.id ? " " + printNode(node.id, ctx, depth) : "";
  const superClass = node.superClass
    ? " extends " + printNode(node.superClass, ctx, depth)
    : "";
  const body = printNode(node.body, ctx, depth);
  const head = (node.type === "ClassDeclaration" ? ctx.ind(depth) : "") + "class" + name + superClass;
  return head + " " + body.trimStart();
}

export function printClassBody(node, ctx, depth) {
  if (!node.body.length) return "{}";
  const lines = node.body.map((m) => printNode(m, ctx, depth + 1));
  return "{\n" + lines.join("\n") + "\n" + ctx.ind(depth) + "}";
}

export function printClassMethod(node, ctx, depth) {
  const static_ = node.static ? "static " : "";
  const async = node.async ? "async " : "";
  const gen = node.generator ? "*" : "";
  const kind =
    node.kind === "get" || node.kind === "set" ? node.kind + " " : "";
  const key = printKey(node, ctx, depth);
  const params = printParams(node.params, ctx, depth);
  const body = printNode(node.body, ctx, depth);
  return (
    ctx.ind(depth) +
    `${static_}${kind}${async}${gen}${key}(${params}) ${body.trimStart()}`
  );
}

export function printClassProperty(node, ctx, depth) {
  const static_ = node.static ? "static " : "";
  const key = printKey(node, ctx, depth);
  const val = node.value ? " = " + printNode(node.value, ctx, depth) : "";
  return ctx.ind(depth) + static_ + key + val + semi(ctx);
}
