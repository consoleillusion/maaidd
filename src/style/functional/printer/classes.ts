/**
 * Classes, class bodies, methods, and properties.
 */
import { printNode } from "./dispatch.ts";
import { semi } from "./context.ts";
import { printParams } from "./functions.ts";
import { printKey } from "./literals.ts";

export function printClass(node: any, ctx: any, depth: number): string {
  const name = node.id ? " " + printNode(node.id, ctx, depth) : "";
  const superClass = node.superClass
    ? " extends " + printNode(node.superClass, ctx, depth)
    : "";
  const head =
    (node.type === "ClassDeclaration" ? ctx.ind(depth) : "") +
    "class" +
    name +
    superClass;
  const body = printNode(node.body, ctx, depth);
  return head + " " + body.trimStart();
}

export function printClassBody(node: any, ctx: any, depth: number): string {
  if (!node.body.length) return "{}";
  const lines = node.body.map((m: any) => printNode(m, ctx, depth + 1));
  return "{\n" + lines.join("\n") + "\n" + ctx.ind(depth) + "}";
}

export function printClassMethod(node: any, ctx: any, depth: number): string {
  const static_ = node.static ? "static " : "";
  const async = node.async ? "async " : "";
  const gen = node.generator ? "*" : "";
  const kind =
    node.kind === "get" || node.kind === "set" ? node.kind + " " : "";
  const key = printKey(node, ctx, depth);
  const params = printParams(node.params ?? [], ctx, depth);
  const body = printNode(node.body, ctx, depth);
  return (
    ctx.ind(depth) +
    `${static_}${kind}${async}${gen}${key}(${params}) ${body.trimStart()}`
  );
}

export function printClassProperty(node: any, ctx: any, depth: number): string {
  const static_ = node.static ? "static " : "";
  const key = printKey(node, ctx, depth);
  const annotation = node.typeAnnotation
    ? printNode(node.typeAnnotation, ctx, depth)
    : "";
  const val = node.value ? " = " + printNode(node.value, ctx, depth) : "";
  return ctx.ind(depth) + static_ + key + annotation + val + semi(ctx);
}
