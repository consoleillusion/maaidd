/**
 * Object literals, arrays, and destructuring patterns.
 */
import { printNode } from "./dispatch.js";
import { printParams } from "./functions.js";
import { printKey } from "./literals.js";

/**
 * Comma-first object:
 * { a: 1
 * , b: 2
 * , c: 3
 * }
 */
export function printObject(node, ctx, depth) {
  const props = node.properties;
  if (!props.length) return "{}";

  if (props.length === 1 && isCompactProp(props[0])) {
    return "{ " + printObjectProp(props[0], ctx, depth) + " }";
  }

  // Wider: { first
  //        , second
  //        }
  // No leading pad — caller reindents when embedding.
  const lines = [];
  for (let i = 0; i < props.length; i++) {
    const p = printObjectProp(props[i], ctx, depth + 1).trimStart();
    lines.push((i === 0 ? "{ " : ", ") + p);
  }
  lines.push("}");
  return lines.join("\n");
}

function isCompactProp(prop) {
  if (prop.type === "SpreadElement") return false;
  if (prop.type === "ObjectMethod") return false;
  if (prop.type !== "ObjectProperty") return false;
  const v = prop.value;
  if (!v) return true;
  return (
    v.type === "Identifier" ||
    v.type === "StringLiteral" ||
    v.type === "NumericLiteral" ||
    v.type === "BooleanLiteral" ||
    v.type === "NullLiteral"
  );
}

export function printObjectProp(prop, ctx, depth) {
  if (prop.type === "SpreadElement") {
    return printNode(prop, ctx, depth);
  }
  if (prop.type === "ObjectMethod") {
    const async = prop.async ? "async " : "";
    const gen = prop.generator ? "*" : "";
    const key = printKey(prop, ctx, depth);
    const params = printParams(prop.params, ctx, depth);
    const body = printNode(prop.body, ctx, depth);
    const kind =
      prop.kind === "get" || prop.kind === "set" ? prop.kind + " " : "";
    return `${kind}${async}${gen}${key}(${params}) ${body.trimStart()}`;
  }
  // ObjectProperty
  const key = printKey(prop, ctx, depth);
  if (prop.shorthand) return key;
  return key + ": " + printNode(prop.value, ctx, depth);
}

export function printArray(node, ctx, depth) {
  const elts = node.elements;
  if (!elts.length) return "[]";

  const allSimple = elts.every(
    (e) =>
      !e ||
      ["Identifier", "StringLiteral", "NumericLiteral", "BooleanLiteral", "NullLiteral"].includes(
        e.type
      )
  );
  if (allSimple && elts.length <= 4) {
    return (
      "[ " +
      elts.map((e) => (e ? printNode(e, ctx, depth) : "")).join(", ") +
      " ]"
    );
  }

  const lines = [];
  for (let i = 0; i < elts.length; i++) {
    const el = elts[i] ? printNode(elts[i], ctx, depth + 1).trimStart() : "";
    lines.push((i === 0 ? "[ " : ", ") + el);
  }
  lines.push("]");
  return lines.join("\n");
}

export function printArrayPattern(node, ctx, depth) {
  return (
    "[" +
    node.elements.map((e) => (e ? printNode(e, ctx, depth) : "")).join(", ") +
    "]"
  );
}

export function printObjectPattern(node, ctx, depth) {
  return (
    "{ " +
    node.properties.map((p) => printObjectProp(p, ctx, depth)).join(", ") +
    " }"
  );
}
