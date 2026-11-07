/**
 * Statements: variables, blocks, conditionals, loops, and try/catch.
 */
import { printNode } from "./dispatch.js";
import { semi } from "./context.js";
import { indentContinuations } from "./layout.js";

export function printVariableDeclaration(node, ctx, depth) {
  const kind = node.kind; // const | let | var
  const decls = node.declarations.map((d) => printVariableDeclarator(d, ctx, depth));
  // Multi-declarator: const a = 1, b = 2  → keep simple for now
  if (decls.length === 1) {
    return ctx.ind(depth) + kind + " " + decls[0] + semi(ctx);
  }
  const pad = kind.length + 1;
  const lines = decls.map((d, i) =>
    i === 0 ? d : ctx.ind(depth) + " ".repeat(pad) + d
  );
  return ctx.ind(depth) + kind + " " + lines.join(",\n") + semi(ctx);
}

export function printVariableDeclarator(node, ctx, depth) {
  const id = printNode(node.id, ctx, depth);
  if (!node.init) return id;
  const init = printNode(node.init, ctx, depth);
  // Keep first line after `= `; indent Wider continuations under the statement
  return id + " = " + indentContinuations(init, ctx.ind(depth));
}

export function printBlock(node, ctx, depth) {
  if (!node.body.length) return "{}";
  const lines = node.body.map((s) => printNode(s, ctx, depth + 1));
  return "{\n" + lines.join("\n") + "\n" + ctx.ind(depth) + "}";
}

export function printIf(node, ctx, depth) {
  let out =
    ctx.ind(depth) +
    "if (" +
    printNode(node.test, ctx, depth) +
    ") " +
    formatClause(node.consequent, ctx, depth);
  if (node.alternate) {
    out +=
      (node.consequent.type === "BlockStatement" ? " " : "\n" + ctx.ind(depth)) +
      "else " +
      formatClause(node.alternate, ctx, depth);
  }
  return out;
}

function formatClause(node, ctx, depth) {
  if (node.type === "BlockStatement") {
    return printNode(node, ctx, depth).trimStart();
  }
  return "\n" + printNode(node, ctx, depth + 1);
}

export function printLoop(node, ctx, depth) {
  // Minimal support — enough not to explode
  if (node.type === "WhileStatement") {
    return (
      ctx.ind(depth) +
      "while (" +
      printNode(node.test, ctx, depth) +
      ") " +
      formatClause(node.body, ctx, depth)
    );
  }
  if (node.type === "ForStatement") {
    const init = node.init ? printNode(node.init, ctx, depth).replace(semi(ctx), "") : "";
    const test = node.test ? printNode(node.test, ctx, depth) : "";
    const up = node.update ? printNode(node.update, ctx, depth) : "";
    return (
      ctx.ind(depth) +
      `for (${init}; ${test}; ${up}) ` +
      formatClause(node.body, ctx, depth)
    );
  }
  if (node.type === "ForOfStatement" || node.type === "ForInStatement") {
    const kw = node.type === "ForOfStatement" ? "of" : "in";
    const left =
      node.left.type === "VariableDeclaration"
        ? printNode(node.left, ctx, depth).trim().replace(semi(ctx), "")
        : printNode(node.left, ctx, depth);
    return (
      ctx.ind(depth) +
      `for (${left} ${kw} ${printNode(node.right, ctx, depth)}) ` +
      formatClause(node.body, ctx, depth)
    );
  }
  return ctx.ind(depth) + "/* loop */";
}

export function printTry(node, ctx, depth) {
  let out =
    ctx.ind(depth) + "try " + printNode(node.block, ctx, depth).trimStart();
  if (node.handler) {
    const p = node.handler.param
      ? "(" + printNode(node.handler.param, ctx, depth) + ")"
      : "";
    out += " catch" + p + " " + printNode(node.handler.body, ctx, depth).trimStart();
  }
  if (node.finalizer) {
    out += " finally " + printNode(node.finalizer, ctx, depth).trimStart();
  }
  return out;
}
