/**
 * JSX printing — both expanded and flat.
 */
import { printNode } from "./dispatch.ts";
import { fits, shiftContinuations } from "./layout.ts";
import { printFlat } from "./flat.ts";
import type { Ctx } from "./context.ts";

function printJsxName(node: any, ctx: Ctx, depth: number): string {
  if (node.type === "JSXIdentifier") return node.name;
  if (node.type === "JSXMemberExpression") {
    return (
      printJsxName(node.object, ctx, depth) + "." +
      printJsxName(node.property, ctx, depth)
    );
  }
  if (node.type === "JSXNamespacedName") {
    return node.namespace.name + ":" + node.name.name;
  }
  return printNode(node, ctx, depth);
}

function printJsxAttribute(node: any, ctx: Ctx, depth: number): string {
  if (node.type === "JSXSpreadAttribute") {
    return "{..." + printNode(node.argument, ctx, depth) + "}";
  }
  const name = node.name.name;
  if (!node.value) return name;
  if (node.value.type === "StringLiteral") {
    return name + "=" + (node.value.extra?.raw ?? JSON.stringify(node.value.value));
  }
  if (node.value.type === "JSXExpressionContainer") {
    return name + "={" + printNode(node.value.expression, ctx, depth) + "}";
  }
  return name + "={" + printNode(node.value, ctx, depth) + "}";
}

function normalizeJsxText(value: string): string {
  // Biome introduces indentation-only JSXText around nested elements. It is
  // layout, not content; meaningful text newlines collapse to one space.
  if (!value.trim()) return "";
  return value.replace(/\s*\n\s*/g, " ");
}

function printJsxChild(node: any, ctx: Ctx, depth: number): string {
  if (node.type === "JSXText") {
    return normalizeJsxText(node.value);
  }
  if (node.type === "JSXExpressionContainer") {
    if (node.expression.type === "JSXEmptyExpression") return "{}";
    return "{" + printNode(node.expression, ctx, depth) + "}";
  }
  if (node.type === "JSXSpreadChild") {
    return "{..." + printNode(node.expression, ctx, depth) + "}";
  }
  return printNode(node, ctx, depth);
}

function printJsxChildLines(children: any[], ctx: Ctx, depth: number): string {
  return children
    .map((child) => printJsxChild(child, ctx, depth))
    .filter((text) => text.trim().length > 0)
    .map((text) => ctx.ind(depth) + text)
    .join("\n");
}

export function printJsxFlat(node: any, ctx: Ctx, depth: number): string | null {
  if (node.type === "JSXFragment") {
    if (!node.children.length) return "<></>";
    const parts = node.children.map((c: any) => {
      if (c.type === "JSXText") return normalizeJsxText(c.value);
      return printFlat(c, ctx, depth);
    });
    if (parts.some((p: string | null) => p === null)) return null;
    return "<>" + parts.join("") + "</>";
  }
  if (node.type === "JSXElement") {
    const name = printJsxName(node.openingElement.name, ctx, depth);
    const attrs = node.openingElement.attributes.map((a: any) => {
      if (a.type === "JSXSpreadAttribute") return null;
      return printJsxAttribute(a, ctx, depth);
    });
    if (attrs.some((a: string | null) => a === null)) return null;
    if (!node.children.length) {
      return `<${name}${attrs.length ? " " + attrs.join(" ") : ""} />`;
    }
    const childParts = node.children.map((c: any) => {
      if (c.type === "JSXText") return normalizeJsxText(c.value);
      return printFlat(c, ctx, depth);
    });
    if (childParts.some((p: string | null) => p === null)) return null;
    return (
      `<${name}${attrs.length ? " " + attrs.join(" ") : ""}>` +
      childParts.join("") +
      `</${name}>`
    );
  }
  return null;
}

export function printJsx(node: any, ctx: Ctx, depth: number): string {
  if (node.type === "JSXFragment") {
    return printJsxFragment(node, ctx, depth);
  }
  return printJsxElement(node, ctx, depth);
}

function printJsxElement(node: any, ctx: Ctx, depth: number): string {
  const name = printJsxName(node.openingElement.name, ctx, depth);
  const attrs = node.openingElement.attributes;

  // Try flat first
  const flat = printJsxFlat(node, ctx, depth);
  if (flat && fits(flat, ctx, depth * ctx.indentWidth)) {
    return flat;
  }

  if (!node.children.length) {
    if (!attrs.length) return `<${name} />`;
    const attrLines = attrs.map((a: any) => ctx.ind(depth + 1) + printJsxAttribute(a, ctx, depth + 1));
    return (
      `<${name}\n` +
      attrLines.join("\n") +
      "\n" +
      ctx.ind(depth) +
      "/>"
    );
  }

  // Has children — expand
  if (!attrs.length) {
    const childTexts = printJsxChildLines(node.children, ctx, depth + 1);
    return (
      `<${name}>\n` +
      childTexts +
      "\n" +
      ctx.ind(depth) +
      `</${name}>`
    );
  }

  const attrLines = attrs.map((a: any) => ctx.ind(depth + 1) + printJsxAttribute(a, ctx, depth + 1));
  const childTexts = printJsxChildLines(node.children, ctx, depth + 1);
  return (
    `<${name}\n` +
    attrLines.join("\n") +
    "\n" +
    ctx.ind(depth) +
    ">\n" +
    childTexts +
    "\n" +
    ctx.ind(depth) +
    `</${name}>`
  );
}

function printJsxFragment(node: any, ctx: Ctx, depth: number): string {
  const flat = printJsxFlat(node, ctx, depth);
  if (flat && fits(flat, ctx, depth * ctx.indentWidth)) return flat;

  if (!node.children.length) return "<></>";

  const childTexts = printJsxChildLines(node.children, ctx, depth + 1);
  return (
    "<>\n" +
    childTexts +
    "\n" +
    ctx.ind(depth) +
    "</>"
  );
}