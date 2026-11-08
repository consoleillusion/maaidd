import type { Ctx } from "./context.ts";
import { takeLeadingComments, takeTrailingComment } from "./comments.ts";
import { fits, indentLines, shiftContinuations } from "./layout.ts";
import { printFlat } from "./flat.ts";
import { printNode } from "./dispatch.ts";
import { printKey } from "./literals.ts";
import { printParams } from "./functions.ts";
export interface CollectionOptions {
  forceExpand?: boolean;
  column?: number;
  position?: "value" | "inline";
}
const collectionColumn = (ctx: Ctx, depth: number, column?: number) => {
  return column ?? depth * ctx.indentWidth;
};
/**
 * Leading-comma object.
 *
 * The first line is returned without indentation so the caller can decide
 * whether to place it after `=`, after `key:`, or on a fresh line.
 */
export function printObject(
  node: any,
  ctx: Ctx,
  depth: number,
  options: CollectionOptions = {},
): string {
  const props = node.properties ?? [];
  if (!props.length) return "{}";
  if (!options.forceExpand) {
    const flat = printFlat(node, ctx, depth);
    if (
      flat !== null &&
      fits(flat, ctx, collectionColumn(ctx, depth, options.column))
    ) {
      return flat;
    }
  }
  const lines: string[] = [];
  const first = props[0];
  const firstComments = takeLeadingComments(first, ctx, depth);
  const firstTrailing = takeTrailingComment(first, ctx);
  if (firstComments.length) {
    lines.push("{");
    lines.push(...firstComments);
    lines.push(
      ctx.ind(depth) + printObjectProperty(first, ctx, depth) + firstTrailing,
    );
  } else {
    lines.push("{ " + printObjectProperty(first, ctx, depth) + firstTrailing);
  }
  for (let i = 1; i < props.length; i++) {
    const prop = props[i];
    const comments = takeLeadingComments(prop, ctx, depth);
    if (comments.length) lines.push(...comments);
    const trailing = takeTrailingComment(prop, ctx);
    lines.push(
      ctx.ind(depth) + ", " + printObjectProperty(prop, ctx, depth) + trailing,
    );
  }
  lines.push(ctx.ind(depth) + "}");
  return lines.join("\n");
}
export function printObjectProperty(
  prop: any,
  ctx: Ctx,
  depth: number,
): string {
  if (prop.type === "SpreadElement" || prop.type === "RestElement") {
    return "..." + printNode(prop.argument, ctx, depth);
  }
  if (
    prop.type === "ObjectMethod" ||
    prop.type === "ClassMethod" ||
    prop.type === "ClassPrivateMethod"
  ) {
    return printMethodLike(prop, ctx, depth);
  }
  const key = printKey(prop, ctx, depth);
  if (prop.shorthand) {
    const annotation = prop.typeAnnotation
      ? printNode(prop.typeAnnotation, ctx, depth)
      : "";
    return key + annotation;
  }
  const value = prop.value;
  if (!value) return key;
  if (value.type === "ObjectExpression" && value.properties.length > 0) {
    const valueDepth = depth + ctx.opts.objectValueIndent;
    return (
      key +
      ":\n" +
      ctx.ind(valueDepth) +
      printObject(value, ctx, valueDepth, { forceExpand: true })
    );
  }
  if (value.type === "ArrayExpression") {
    const flat = printFlat(value, ctx, depth);
    const column = depth * ctx.indentWidth + key.length + 2;
    const inline =
      flat !== null &&
      fits(flat, ctx, column) &&
      value.elements.length <= ctx.opts.maxInlineArrayItems;
    if (inline) return key + ": " + flat;
    const valueDepth = depth + ctx.opts.arrayValueIndent;
    return (
      key +
      ":\n" +
      ctx.ind(valueDepth) +
      printArray(value, ctx, valueDepth, { forceExpand: true })
    );
  }
  if (
    value.type === "FunctionExpression" ||
    value.type === "ArrowFunctionExpression" ||
    value.type === "ClassExpression"
  ) {
    return (
      key +
      ": " +
      printNode(value, ctx, depth + 1, depth * ctx.indentWidth + key.length + 2)
    );
  }
  const column = depth * ctx.indentWidth + key.length + 2;
  const printed = printNode(value, ctx, depth, column);
  if (!printed.includes("\n")) return key + ": " + printed;
  return key + ":\n" + ctx.ind(depth + 1) + printNode(value, ctx, depth + 1);
}
const printMethodLike = (prop: any, ctx: Ctx, depth: number) => {
  const kind =
    prop.kind === "get" || prop.kind === "set" ? prop.kind + " " : "";
  const async = prop.async ? "async " : "";
  const generator = prop.generator ? "*" : "";
  const key = printKey(prop, ctx, depth);
  const params = printParams(prop.params, ctx, depth);
  const returnType = prop.returnType
    ? printNode(prop.returnType, ctx, depth)
    : "";
  const body = printNode(prop.body, ctx, depth);
  return `${kind}${async}${generator}${key}(${params})${returnType} ${body.trimStart()}`;
};
export function printArray(
  node: any,
  ctx: Ctx,
  depth: number,
  options: CollectionOptions = {},
): string {
  const elements = node.elements ?? [];
  if (!elements.length) return "[]";
  if (!options.forceExpand) {
    const flat = printFlat(node, ctx, depth);
    if (
      flat !== null &&
      fits(flat, ctx, collectionColumn(ctx, depth, options.column))
    ) {
      return flat;
    }
  }
  const lines: string[] = [];
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const prefix = i === 0 ? "[ " : ", ";
    if (!element) {
      lines.push((i === 0 ? "[ " : ctx.ind(depth) + ", ").trimEnd());
      continue;
    }
    const comments = takeLeadingComments(element, ctx, depth);
    if (comments.length) {
      if (i === 0) lines.push("[");
      lines.push(...comments);
      const text = printArrayElement(element, ctx, depth);
      const trailing = takeTrailingComment(element, ctx);
      lines.push(ctx.ind(depth) + shiftContinuations(text, "  ") + trailing);
      continue;
    }
    const text = printArrayElement(element, ctx, depth);
    const trailing = takeTrailingComment(element, ctx);
    if (i === 0) {
      lines.push(prefix + shiftContinuations(text, "  ") + trailing);
    } else {
      lines.push(
        ctx.ind(depth) + prefix + shiftContinuations(text, "  ") + trailing,
      );
    }
  }
  lines.push(ctx.ind(depth) + "]");
  return lines.join("\n");
}
const printArrayElement = (element: any, ctx: Ctx, depth: number) => {
  return printNode(element, ctx, depth, depth * ctx.indentWidth + 2);
};
export function printObjectPattern(node: any, ctx: Ctx, depth: number): string {
  return printObject(node, ctx, depth);
}
export function printArrayPattern(node: any, ctx: Ctx, depth: number): string {
  return printArray(node, ctx, depth);
}
/** Used by call arguments and JSX children when a collection starts inline. */
export function embedInline(text: string, prefix: string): string {
  return prefix + shiftContinuations(text, " ".repeat(prefix.length));
}
export function indentCollection(
  text: string,
  ctx: Ctx,
  depth: number,
): string {
  return indentLines(text, ctx.ind(depth));
}
