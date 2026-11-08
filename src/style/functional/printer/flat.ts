import type { Ctx } from "./context.ts";
import { printLiteral } from "./literals.ts";
import { printJsxFlat } from "./jsx.ts";
import { printTypeFlat } from "./typescript.ts";

function hasUnprintedComments(node: any, ctx: Ctx): boolean {
  for (const key of ["leadingComments", "trailingComments", "innerComments"] as const) {
    for (const comment of node?.[key] ?? []) {
      if (typeof comment.start !== "number" || !ctx.printedComments.has(comment.start)) return true;
    }
  }
  return false;
}

function flatList(nodes: any[], ctx: Ctx, depth: number, separator = ", "): string | null {
  const parts: string[] = [];
  for (const node of nodes) {
    if (!node) {
      parts.push("");
      continue;
    }
    const flat = printFlat(node, ctx, depth);
    if (flat === null) return null;
    parts.push(flat);
  }
  return parts.join(separator);
}

export function printFlat(node: any, ctx: Ctx, depth: number): string | null {
  if (!node) return "";
  if (hasUnprintedComments(node, ctx)) return null;

  switch (node.type) {
    case "Identifier":
      return node.name;
    case "PrivateName":
      return "#" + node.id.name;
    case "StringLiteral":
    case "NumericLiteral":
    case "BooleanLiteral":
    case "BigIntLiteral":
      return printLiteral(node);
    case "NullLiteral":
      return "null";
    case "RegExpLiteral":
      return `/${node.pattern}/${node.flags || ""}`;
    case "ThisExpression":
      return "this";
    case "Super":
      return "super";
    case "MetaProperty":
      return `${node.meta.name}.${node.property.name}`;

    case "TemplateLiteral": {
      let out = "`";
      for (let i = 0; i < node.quasis.length; i++) {
        out += node.quasis[i].value.raw;
        if (i < node.expressions.length) {
          const expr = printFlat(node.expressions[i], ctx, depth);
          if (expr === null) return null;
          out += "${" + expr + "}";
        }
      }
      return out + "`";
    }
    case "TaggedTemplateExpression": {
      const tag = printFlat(node.tag, ctx, depth);
      const quasi = printFlat(node.quasi, ctx, depth);
      if (tag === null || quasi === null) return null;
      return tag + quasi;
    }

    case "ObjectExpression": {
      if (!node.properties.length) return "{}";
      const props: string[] = [];
      for (const prop of node.properties) {
        const flat = printFlatProperty(prop, ctx, depth);
        if (flat === null) return null;
        props.push(flat);
      }
      return "{ " + props.join(", ") + " }";
    }
    case "ArrayExpression": {
      if (!node.elements.length) return "[]";
      const parts: string[] = [];
      for (const element of node.elements) {
        if (!element) {
          parts.push("");
          continue;
        }
        const flat = printFlat(element, ctx, depth);
        if (flat === null) return null;
        parts.push(flat);
      }
      return "[ " + parts.join(", ") + " ]";
    }
    case "ObjectPattern": {
      if (!node.properties.length) return "{}";
      const props: string[] = [];
      for (const prop of node.properties) {
        const flat = printFlatProperty(prop, ctx, depth);
        if (flat === null) return null;
        props.push(flat);
      }
      return "{ " + props.join(", ") + " }";
    }
    case "ArrayPattern": {
      if (!node.elements.length) return "[]";
      const parts: string[] = [];
      for (const element of node.elements) {
        if (!element) {
          parts.push("");
          continue;
        }
        const flat = printFlat(element, ctx, depth);
        if (flat === null) return null;
        parts.push(flat);
      }
      return "[ " + parts.join(", ") + " ]";
    }
    case "AssignmentPattern": {
      const left = printFlat(node.left, ctx, depth);
      const right = printFlat(node.right, ctx, depth);
      if (left === null || right === null) return null;
      return `${left} = ${right}`;
    }
    case "RestElement":
    case "SpreadElement": {
      const argument = printFlat(node.argument, ctx, depth);
      return argument === null ? null : "..." + argument;
    }

    case "CallExpression":
    case "NewExpression": {
      const callee = printFlat(node.callee, ctx, depth);
      const args = flatList(node.arguments, ctx, depth);
      if (callee === null || args === null) return null;
      const prefix = node.type === "NewExpression" ? "new " : "";
      const optional = node.optional ? "?." : "";
      return `${prefix}${callee}${optional}(${args})`;
    }
    case "MemberExpression":
    case "OptionalMemberExpression": {
      const object = printFlat(node.object, ctx, depth);
      if (object === null) return null;
      const optional = node.optional ? "?." : "";
      if (node.computed) {
        const property = printFlat(node.property, ctx, depth);
        if (property === null) return null;
        return `${object}${node.optional ? "?." : ""}[${property}]`;
      }
      const property = printFlat(node.property, ctx, depth);
      if (property === null) return null;
      return `${object}${optional}.${property}`;
    }
    case "BinaryExpression":
    case "LogicalExpression": {
      const left = printFlat(node.left, ctx, depth);
      const right = printFlat(node.right, ctx, depth);
      if (left === null || right === null) return null;
      return `${left} ${node.operator} ${right}`;
    }
    case "UnaryExpression": {
      const argument = printFlat(node.argument, ctx, depth);
      if (argument === null) return null;
      const space =
        node.operator === "typeof" || node.operator === "void" || node.operator === "delete"
          ? " "
          : "";
      return node.operator + space + argument;
    }
    case "UpdateExpression": {
      const argument = printFlat(node.argument, ctx, depth);
      if (argument === null) return null;
      return node.prefix ? node.operator + argument : argument + node.operator;
    }
    case "AssignmentExpression": {
      const left = printFlat(node.left, ctx, depth);
      const right = printFlat(node.right, ctx, depth);
      if (left === null || right === null) return null;
      return `${left} ${node.operator} ${right}`;
    }
    case "ConditionalExpression": {
      const test = printFlat(node.test, ctx, depth);
      const consequent = printFlat(node.consequent, ctx, depth);
      const alternate = printFlat(node.alternate, ctx, depth);
      if (test === null || consequent === null || alternate === null) return null;
      return `${test} ? ${consequent} : ${alternate}`;
    }
    case "SequenceExpression": {
      const expressions = flatList(node.expressions, ctx, depth);
      return expressions;
    }
    case "AwaitExpression": {
      const argument = printFlat(node.argument, ctx, depth);
      return argument === null ? null : "await " + argument;
    }
    case "YieldExpression": {
      if (!node.argument) return "yield" + (node.delegate ? "*" : "");
      const argument = printFlat(node.argument, ctx, depth);
      if (argument === null) return null;
      return `yield${node.delegate ? "*" : ""} ${argument}`;
    }
    case "ImportExpression": {
      const source = printFlat(node.source, ctx, depth);
      return source === null ? null : `import(${source})`;
    }
    case "ArrowFunctionExpression":
    case "FunctionExpression": {
      const params = flatList(node.params, ctx, depth);
      if (params === null) return null;
      const async = node.async ? "async " : "";
      if (node.type === "ArrowFunctionExpression") {
        if (node.body?.type === "BlockStatement") {
          return node.body.body.length === 0 ? `${async}(${params}) => {}` : null;
        }
        const body = printFlat(node.body, ctx, depth);
        if (body === null) return null;
        const wrapped = node.body.type === "ObjectExpression" ? `(${body})` : body;
        return `${async}(${params}) => ${wrapped}`;
      }
      if (node.body?.type !== "BlockStatement" || node.body.body.length > 0) return null;
      const name = node.id ? " " + node.id.name : "";
      return `${async}function${node.generator ? "*" : ""}${name}(${params}) {}`;
    }
    case "ClassExpression":
      return null;
    case "TSAsExpression":
    case "TSSatisfiesExpression": {
      const expression = printFlat(node.expression, ctx, depth);
      const type = printTypeFlat(node.typeAnnotation, ctx, depth);
      if (expression === null || type === null) return null;
      return `${expression} ${node.type === "TSAsExpression" ? "as" : "satisfies"} ${type}`;
    }
    case "TSTypeAssertion": {
      const expression = printFlat(node.expression, ctx, depth);
      const type = printTypeFlat(node.typeAnnotation, ctx, depth);
      if (expression === null || type === null) return null;
      return `<${type}>${expression}`;
    }
    case "TSNonNullExpression": {
      const expression = printFlat(node.expression, ctx, depth);
      return expression === null ? null : expression + "!";
    }
    case "JSXElement":
    case "JSXFragment":
      return printJsxFlat(node, ctx, depth);

    default:
      if (node.value != null && typeof node.value !== "object") return String(node.value);
      return null;
  }
}

function printFlatProperty(prop: any, ctx: Ctx, depth: number): string | null {
  if (prop.type === "SpreadElement" || prop.type === "RestElement") {
    const argument = printFlat(prop.argument, ctx, depth);
    return argument === null ? null : "..." + argument;
  }
  if (prop.type === "ObjectMethod") {
    if (prop.body?.body?.length > 0) return null;
    const key = printFlatKey(prop, ctx, depth);
    const params = flatList(prop.params, ctx, depth);
    if (key === null || params === null) return null;
    const kind = prop.kind === "get" || prop.kind === "set" ? prop.kind + " " : "";
    const async = prop.async ? "async " : "";
    return `${kind}${async}${prop.generator ? "*" : ""}${key}(${params}) {}`;
  }
  const key = printFlatKey(prop, ctx, depth);
  if (key === null) return null;
  if (prop.shorthand) return key;
  const value = printFlat(prop.value, ctx, depth);
  if (value === null) return null;
  return `${key}: ${value}`;
}

function printFlatKey(prop: any, ctx: Ctx, depth: number): string | null {
  if (prop.computed) {
    const key = printFlat(prop.key, ctx, depth);
    return key === null ? null : `[${key}]`;
  }
  if (prop.key?.type === "Identifier") return prop.key.name;
  return printFlat(prop.key, ctx, depth);
}
