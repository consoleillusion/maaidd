/**
 * Imports and exports.
 */
import { printNode } from "./dispatch.ts";
import { semi } from "./context.ts";
import { printLiteral } from "./literals.ts";
export function printImport(node: any, ctx: any, depth: number): string {
  const src = printLiteral(node.source);
  if (!node.specifiers.length) {
    return ctx.ind(depth) + "import " + src + semi(ctx);
  }
  const def = node.specifiers.find(
    (s: any) => s.type === "ImportDefaultSpecifier",
  );
  const ns = node.specifiers.find(
    (s: any) => s.type === "ImportNamespaceSpecifier",
  );
  const named = node.specifiers.filter(
    (s: any) => s.type === "ImportSpecifier",
  );
  const parts: string[] = [];
  if (def) parts.push(def.local.name);
  if (ns) parts.push("* as " + ns.local.name);
  if (named.length) {
    parts.push(
      "{ " +
        named
          .map((s: any) =>
            s.imported.name === s.local.name
              ? s.local.name
              : s.imported.name + " as " + s.local.name,
          )
          .join(", ") +
        " }",
    );
  }
  const typePrefix = node.importKind === "type" ? "type " : "";
  return (
    ctx.ind(depth) +
    "import " +
    typePrefix +
    parts.join(", ") +
    " from " +
    src +
    semi(ctx)
  );
}
export function printExportNamed(node: any, ctx: any, depth: number): string {
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
      .map((s: any) =>
        s.exported.name === s.local.name
          ? s.local.name
          : s.local.name + " as " + s.exported.name,
      )
      .join(", ") +
    " }";
  const src = node.source ? " from " + printLiteral(node.source) : "";
  const typePrefix = node.exportKind === "type" ? "type " : "";
  return ctx.ind(depth) + "export " + typePrefix + specs + src + semi(ctx);
}
export function printExportDefault(node: any, ctx: any, depth: number): string {
  const decl = printNode(node.declaration, ctx, depth).trimStart();
  const needsSemi = !node.declaration.type.endsWith("Declaration");
  return (
    ctx.ind(depth) + "export default " + decl + (needsSemi ? semi(ctx) : "")
  );
}
export function printExportAll(node: any, ctx: any, depth: number): string {
  const src = printLiteral(node.source);
  const exported = node.exported ? " " + node.exported.name : "";
  return ctx.ind(depth) + "export *" + exported + " from " + src + semi(ctx);
}
