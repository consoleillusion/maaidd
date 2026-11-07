/**
 * Expression helpers: calls and member access.
 */
import { printNode } from "./dispatch.js";
import { reindent } from "./layout.js";

export function printCall(node, ctx, depth) {
  const callee = printNode(node.callee, ctx, depth);
  const printedArgs = node.arguments.map((a) => printNode(a, ctx, depth));
  const neu = node.type === "NewExpression" ? "new " : "";
  const opt = node.optional ? "?." : "";

  if (node.type === "NewExpression" && !node.arguments.length) {
    return neu + callee;
  }

  const anyMulti = printedArgs.some((a) => a.includes("\n"));
  if (!anyMulti) {
    return neu + callee + opt + "(" + printedArgs.join(", ") + ")";
  }

  // format(source,
  // { indent
  // , trailingComma
  // })
  const pad = ctx.ind(depth);
  let out = neu + callee + opt + "(";
  printedArgs.forEach((a, i) => {
    const multi = a.includes("\n");
    if (i === 0) {
      if (multi) {
        out += "\n" + reindent(a, pad);
      } else {
        out += a;
      }
    } else if (multi) {
      out += ",\n" + reindent(a, pad);
    } else {
      out += ", " + a;
    }
  });
  out += ")";
  return out;
}

export function printMember(node, ctx, depth) {
  const obj = printNode(node.object, ctx, depth);
  const opt = node.optional ? "?" : "";
  if (node.computed) {
    return obj + opt + "[" + printNode(node.property, ctx, depth) + "]";
  }
  return obj + opt + "." + printNode(node.property, ctx, depth);
}
