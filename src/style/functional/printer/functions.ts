import type { Ctx } from "./context.ts";
import { fits } from "./layout.ts";
import { printNode } from "./dispatch.ts";

export function printParams(
  params: any[],
  ctx: Ctx,
  depth: number,
  column?: number,
): string {
  const parts = params.map((param) => printNode(param, ctx, depth + 1));
  const flat = "(" + parts.join(", ") + ")";
  const start = column ?? depth * ctx.indentWidth;
  if (!flat.includes("\n") && fits(flat, ctx, start)) return flat;

  const lines = parts.map((part, index) => {
    const suffix = index === parts.length - 1 ? "" : ",";
    return ctx.ind(depth + 1) + part + suffix;
  });
  return "(\n" + lines.join("\n") + "\n" + ctx.ind(depth) + ")";
}

export function printFunction(node: any, ctx: Ctx, depth: number, isDecl: boolean): string {
  const async = node.async ? "async " : "";
  const generator = node.generator ? "*" : "";
  const name = node.id ? " " + printNode(node.id, ctx, depth) : "";
  const params = printParams(node.params ?? [], ctx, depth, depth * ctx.indentWidth + 9);
  const typeParameters = node.typeParameters
    ? printNode(node.typeParameters, ctx, depth)
    : "";
  const returnType = node.returnType ? printNode(node.returnType, ctx, depth) : "";
  const head = `${async}function${generator}${name}${typeParameters}${params}${returnType}`;
  const body = printNode(node.body, ctx, depth);
  const text = head + " " + body.trimStart();
  return isDecl ? ctx.ind(depth) + text : text;
}

export function printArrow(node: any, ctx: Ctx, depth: number): string {
  const async = node.async ? "async " : "";
  const typeParameters = node.typeParameters
    ? printNode(node.typeParameters, ctx, depth)
    : "";
  const params = printParams(node.params ?? [], ctx, depth, depth * ctx.indentWidth + 2);
  const returnType = node.returnType ? printNode(node.returnType, ctx, depth) : "";
  const head = `${async}${typeParameters}${params}${returnType} =>`;

  if (node.body?.type === "BlockStatement") {
    return head + " " + printNode(node.body, ctx, depth).trimStart();
  }

  const body = printNode(node.body, ctx, depth, depth * ctx.indentWidth + head.length + 1);
  if (!body.includes("\n")) return head + " " + body;
  return head + "\n" + ctx.ind(depth + 1) + printNode(node.body, ctx, depth + 1);
}
