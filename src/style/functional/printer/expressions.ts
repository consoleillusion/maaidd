/**
 * Expression helpers: calls and member access.
 */
import { printNode } from "./dispatch.ts";
import { shiftContinuations } from "./layout.ts";

export function printCall(node: any, ctx: any, depth: number): string {
  const callee = printNode(node.callee, ctx, depth);
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
  const obj = printNode(node.object, ctx, depth);
  if (node.computed) {
    return obj + (node.optional ? "?." : "") + "[" + printNode(node.property, ctx, depth) + "]";
  }
  return obj + (node.optional ? "?." : ".") + printNode(node.property, ctx, depth);
}
