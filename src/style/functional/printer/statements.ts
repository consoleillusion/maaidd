/**
 * Statements: variables, blocks, conditionals, loops, switch, try/catch.
 */
import { printNode } from "./dispatch.ts";
import { semi } from "./context.ts";
import { shiftContinuations } from "./layout.ts";
import { takeLeadingComments } from "./comments.ts";
export function printVariableDeclaration(
  node: any,
  ctx: any,
  depth: number,
): string {
  const kind = node.kind;
  // const | let | var
  const decls = node.declarations.map((d: any) =>
    printVariableDeclarator(d, ctx, depth),
  );
  if (decls.length === 1) {
    return ctx.ind(depth) + kind + " " + decls[0] + semi(ctx);
  }
  const pad = kind.length + 1;
  const lines = decls.map((d: string, i: number) =>
    i === 0 ? d : ctx.ind(depth) + " ".repeat(pad) + d,
  );
  return ctx.ind(depth) + kind + " " + lines.join(",\n") + semi(ctx);
}
export function printVariableDeclarator(
  node: any,
  ctx: any,
  depth: number,
): string {
  let id = printNode(node.id, ctx, depth);
  if (node.id.type !== "Identifier" && node.id.typeAnnotation) {
    id += printNode(node.id.typeAnnotation, ctx, depth);
  }
  if (!node.init) return id;
  const init = printNode(node.init, ctx, depth);
  // If the initializer is an object/array that expands, break after `=`
  if (init.includes("\n") && init.startsWith("{")) {
    return (
      id +
      " =\n" +
      ctx.ind(depth + 1) +
      shiftContinuations(init, ctx.ind(depth + 1))
    );
  }
  if (init.includes("\n") && init.startsWith("[")) {
    return (
      id +
      " =\n" +
      ctx.ind(depth + 1) +
      shiftContinuations(init, ctx.ind(depth + 1))
    );
  }
  return id + " = " + shiftContinuations(init, ctx.ind(depth));
}
export function printBlock(node: any, ctx: any, depth: number): string {
  if (!node.body.length) return "{}";
  const lines = node.body.flatMap((s: any) => [
    ...takeLeadingComments(s, ctx, depth + 1),
    printNode(s, ctx, depth + 1),
  ]);
  return "{\n" + lines.join("\n") + "\n" + ctx.ind(depth) + "}";
}
export function printIf(node: any, ctx: any, depth: number): string {
  const test = printNode(node.test, ctx, depth);
  const consequent = formatClause(node.consequent, ctx, depth);
  let out = ctx.ind(depth) + "if (" + test + ") " + consequent;
  if (node.alternate) {
    if (node.alternate.type === "IfStatement") {
      out +=
        "\n" +
        ctx.ind(depth) +
        "else " +
        printNode(node.alternate, ctx, depth).trimStart();
    } else {
      out +=
        (node.consequent.type === "BlockStatement"
          ? " "
          : "\n" + ctx.ind(depth)) +
        "else " +
        formatClause(node.alternate, ctx, depth);
    }
  }
  return out;
}
const formatClause = (node: any, ctx: any, depth: number) => {
  if (node.type === "BlockStatement") {
    return printNode(node, ctx, depth).trimStart();
  }
  return "\n" + printNode(node, ctx, depth + 1);
};
export function printLoop(node: any, ctx: any, depth: number): string {
  if (node.type === "WhileStatement") {
    return (
      ctx.ind(depth) +
      "while (" +
      printNode(node.test, ctx, depth) +
      ") " +
      formatClause(node.body, ctx, depth)
    );
  }
  if (node.type === "DoWhileStatement") {
    return (
      ctx.ind(depth) +
      "do " +
      formatClause(node.body, ctx, depth) +
      " while (" +
      printNode(node.test, ctx, depth) +
      ")" +
      semi(ctx)
    );
  }
  if (node.type === "ForStatement") {
    const init = node.init
      ? printNode(node.init, ctx, depth).replace(semi(ctx), "")
      : "";
    const test = node.test ? printNode(node.test, ctx, depth) : "";
    const update = node.update ? printNode(node.update, ctx, depth) : "";
    return (
      ctx.ind(depth) +
      `for (${init}; ${test}; ${update}) ` +
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
export function printSwitch(node: any, ctx: any, depth: number): string {
  const discriminant = printNode(node.discriminant, ctx, depth);
  if (!node.cases.length) {
    return ctx.ind(depth) + "switch (" + discriminant + ") {}";
  }
  const lines: string[] = [];
  lines.push(ctx.ind(depth) + "switch (" + discriminant + ") {");
  for (const c of node.cases) {
    if (c.test) {
      lines.push(
        ctx.ind(depth + 1) + "case " + printNode(c.test, ctx, depth + 1) + ":",
      );
    } else {
      lines.push(ctx.ind(depth + 1) + "default:");
    }
    for (const s of c.consequent ?? []) {
      lines.push(printNode(s, ctx, depth + 2));
    }
  }
  lines.push(ctx.ind(depth) + "}");
  return lines.join("\n");
}
export function printLabeled(node: any, ctx: any, depth: number): string {
  return (
    ctx.ind(depth) +
    node.label.name +
    ": " +
    printNode(node.body, ctx, depth).trimStart()
  );
}
export function printTry(node: any, ctx: any, depth: number): string {
  let out =
    ctx.ind(depth) + "try " + printNode(node.block, ctx, depth).trimStart();
  if (node.handler) {
    const param = node.handler.param
      ? " (" + printNode(node.handler.param, ctx, depth) + ")"
      : "";
    out +=
      " catch" +
      param +
      " " +
      printNode(node.handler.body, ctx, depth).trimStart();
  }
  if (node.finalizer) {
    out += " finally " + printNode(node.finalizer, ctx, depth).trimStart();
  }
  return out;
}
