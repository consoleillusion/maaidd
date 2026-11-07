/**
 * Imports and exports.
 */
import { printNode } from "./dispatch.js";
import { semi } from "./context.js";
import { printLiteral } from "./literals.js";

export function printImport(node, ctx, depth) {
  const src = printLiteral(node.source);
  if (!node.specifiers.length) {
    return ctx.ind(depth) + "import " + src + semi(ctx);
  }
  const def = node.specifiers.find((s) => s.type === "ImportDefaultSpecifier");
  const ns = node.specifiers.find((s) => s.type === "ImportNamespaceSpecifier");
  const named = node.specifiers.filter((s) => s.type === "ImportSpecifier");

  const parts = [];
  if (def) parts.push(def.local.name);
  if (ns) parts.push("* as " + ns.local.name);
  if (named.length) {
    parts.push(
      "{ " +
        named
          .map((s) =>
            s.imported.name === s.local.name
              ? s.local.name
              : s.imported.name + " as " + s.local.name
          )
          .join(", ") +
        " }"
    );
  }
  return ctx.ind(depth) + "import " + parts.join(", ") + " from " + src + semi(ctx);
}

export function printExportNamed(node, ctx, depth) {
  if (node.declaration) {
    return (
      ctx.ind(depth) +
      "export " +
      printNode(node.declaration, ctx, depth).trimStart()
    );
  }
  const specs =
    "{ " +
    node.specifiers
      .map((s) =>
        s.exported.name === s.local.name
          ? s.local.name
          : s.local.name + " as " + s.exported.name
      )
      .join(", ") +
    " }";
  const src = node.source ? " from " + printLiteral(node.source) : "";
  return ctx.ind(depth) + "export " + specs + src + semi(ctx);
}

export function printExportDefault(node, ctx, depth) {
  return (
    ctx.ind(depth) +
    "export default " +
    printNode(node.declaration, ctx, depth).trimStart() +
    (node.declaration.type.endsWith("Declaration") ? "" : semi(ctx))
  );
}

export function printExportAll(node, ctx, depth) {
  return (
    ctx.ind(depth) +
    "export * from " +
    printLiteral(node.source) +
    semi(ctx)
  );
}
