/**
 * Expression helpers: calls and member access.
 */
import { printNode } from "./dispatch.ts";
import { shiftContinuations } from "./layout.ts";

function needsParens(node: any): boolean {
  return (
    node?.type === "TSAsExpression" ||
    node?.type === "TSSatisfiesExpression" ||
    node?.type === "TSTypeAssertion" ||
    node?.type === "SequenceExpression" ||
    node?.type === "AssignmentExpression" ||
    node?.type === "ConditionalExpression" ||
    node?.type === "ArrowFunctionExpression" ||
    node?.type === "YieldExpression"
  );
}

export function printCall(node: any, ctx: any, depth: number): string {
  let callee = printNode(node.callee, ctx, depth);
  if (needsParens(node.callee)) callee = "(" + callee + ")";
  const neu = node.type === "NewExpression" ? "new " : "";
  const opt = node.optional ? "?." : "";
  const typeArgs = node.typeArguments ?? node.typeParameters;
  const typeArgsText = typeArgs ? printNode(typeArgs, ctx, depth) : "";

  if (node.type === "NewExpression" && !node.arguments.length) {
    return neu + callee + typeArgsText + "()";
  }

  const printedArgs = node.arguments.map((a: any) => printNode(a, ctx, depth));
  const anyMulti = printedArgs.some((a: string) => a.includes("\n"));
  const flat = neu + callee + typeArgsText + opt + "(" + printedArgs.join(", ") + ")";

  if (!anyMulti && !flat.includes("\n") && flat.length <= ctx.opts.lineWidth) {
    return flat;
  }

  const pad = ctx.ind(depth + 1);
  const lines: string[] = [];
  for (let i = 0; i < printedArgs.length; i++) {
    const a = printedArgs[i];
    if (i === 0) {
      lines.push(pad + (a.includes("\n") ? shiftContinuations(a, pad) : a));
    } else {
      lines.push(pad + ", " + shiftContinuations(a, pad));
    }
  }
  return neu + callee + typeArgsText + opt + "(\n" + lines.join("\n") + "\n" + ctx.ind(depth) + ")";
}

export function printMember(node: any, ctx: any, depth: number): string {
  let obj = printNode(node.object, ctx, depth);
  if (needsParens(node.object)) obj = "(" + obj + ")";
  if (node.computed) {
    return obj + (node.optional ? "?." : "") + "[" + printNode(node.property, ctx, depth) + "]";
  }
  return obj + (node.optional ? "?." : ".") + printNode(node.property, ctx, depth);
}
