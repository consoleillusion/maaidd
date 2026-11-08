/**
 * TypeScript type printing — both expanded and flat.
 */
import { printNode } from "./dispatch.ts";
import { semi } from "./context.ts";
import { fits, joinWithBlankLines } from "./layout.ts";
import { printFlat } from "./flat.ts";
import { printKey } from "./literals.ts";
import type { Ctx } from "./context.ts";

function printTypeArgsFlat(node: any, ctx: Ctx, depth: number): string | null {
  if (!node) return "";
  const params = node.params ?? [];
  if (!params.length) return "";
  const parts: string[] = [];
  for (const p of params) {
    const f = printTypeFlat(p, ctx, depth);
    if (f === null) return null;
    parts.push(f);
  }
  return "<" + parts.join(", ") + ">";
}

export function printTypeFlat(
  node: any,
  ctx: Ctx,
  depth: number,
): string | null {
  if (!node) return "";
  switch (node.type) {
    case "TSAnyKeyword":
      return "any";
    case "TSUnknownKeyword":
      return "unknown";
    case "TSNeverKeyword":
      return "never";
    case "TSStringKeyword":
      return "string";
    case "TSNumberKeyword":
      return "number";
    case "TSBooleanKeyword":
      return "boolean";
    case "TSBigIntKeyword":
      return "bigint";
    case "TSSymbolKeyword":
      return "symbol";
    case "TSObjectKeyword":
      return "object";
    case "TSVoidKeyword":
      return "void";
    case "TSUndefinedKeyword":
      return "undefined";
    case "TSNullKeyword":
      return "null";
    case "TSIntrinsicKeyword":
      return "intrinsic";
    case "TSTypeReference": {
      const name =
        node.typeName.type === "Identifier"
          ? node.typeName.name
          : printTypeFlat(node.typeName, ctx, depth);
      if (name === null) return null;
      const args = printTypeArgsFlat(
        node.typeArguments ?? node.typeParameters,
        ctx,
        depth,
      );
      return args === null ? null : name + args;
    }
    case "TSExpressionWithTypeArguments": {
      const expression = printTypeFlat(node.expression, ctx, depth);
      const args = printTypeArgsFlat(
        node.typeArguments ?? node.typeParameters,
        ctx,
        depth,
      );
      return expression === null || args === null ? null : expression + args;
    }
    case "TSQualifiedName":
      return printTypeFlat(node.left, ctx, depth) + "." + node.right.name;
    case "TSTypeParameterInstantiation":
    case "TSTypeParameterDeclaration":
      return printTypeParams(node, ctx, depth);
    case "TSTypeLiteral":
      return null; // always expand
    case "TSIntersectionType":
    case "TSUnionType": {
      const parts: string[] = [];
      for (const t of node.types) {
        const f = printTypeFlat(t, ctx, depth);
        if (f === null) return null;
        parts.push(f);
      }
      const sep = node.type === "TSIntersectionType" ? " & " : " | ";
      return parts.join(sep);
    }
    case "TSArrayType":
      return printTypeFlat(node.elementType, ctx, depth) + "[]";
    case "TSTupleType": {
      if (!node.elementTypes.length) return "[]";
      const parts: string[] = [];
      for (const t of node.elementTypes) {
        const f = printTypeFlat(t, ctx, depth);
        if (f === null) return null;
        parts.push(f);
      }
      return "[" + parts.join(", ") + "]";
    }
    case "TSFunctionType":
    case "TSConstructorType": {
      const params = (node.params ?? []).map((p: any) =>
        printNode(p, ctx, depth),
      );
      const ret = printTypeFlat(
        node.typeAnnotation?.typeAnnotation,
        ctx,
        depth,
      );
      if (ret === null) return null;
      const prefix = node.type === "TSConstructorType" ? "new " : "";
      return `${prefix}(${params.join(", ")}) => ${ret}`;
    }
    case "TSThisType":
      return "this";
    case "TSTypePredicate":
      return (
        (node.parameterName?.name ?? node.parameterName) +
        " is " +
        printTypeFlat(node.typeAnnotation, ctx, depth)
      );
    case "TSTypeOperator":
      return (
        node.operator +
        " " +
        (printTypeFlat(node.typeAnnotation, ctx, depth) ?? "")
      );
    case "TSInferType":
      return "infer " + node.typeParameter.name;
    case "TSConditionalType": {
      const check = printTypeFlat(node.checkType, ctx, depth);
      const ext = printTypeFlat(node.extendsType, ctx, depth);
      const tru = printTypeFlat(node.trueType, ctx, depth);
      const fal = printTypeFlat(node.falseType, ctx, depth);
      if (!check || !ext || tru === null || fal === null) return null;
      return `${check} extends ${ext} ? ${tru} : ${fal}`;
    }
    case "TSMappedType": {
      const constraint = printTypeFlat(
        node.typeParameter?.constraint,
        ctx,
        depth,
      );
      if (constraint === null) return null;
      const name = node.typeParameter?.name ?? "K";
      const nameType = node.nameType
        ? " as " + printTypeFlat(node.nameType, ctx, depth)
        : "";
      const value = node.typeAnnotation
        ? ": " + printTypeFlat(node.typeAnnotation, ctx, depth)
        : "";
      if (value.startsWith(": null")) return null;
      return `{ [${name} in ${constraint}${nameType}]${value} }`;
    }
    case "TSIndexedAccessType": {
      const obj = printTypeFlat(node.objectType, ctx, depth);
      const idx = printTypeFlat(node.indexType, ctx, depth);
      if (obj === null || idx === null) return null;
      return `${obj}[${idx}]`;
    }
    case "TSImportType": {
      const arg = printTypeFlat(node.argument, ctx, depth);
      if (arg === null) return null;
      const qual = node.qualifier
        ? "." + printTypeFlat(node.qualifier, ctx, depth)
        : "";
      return `import(${arg})${qual}`;
    }
    case "TSTemplateLiteralType": {
      let out = "`";
      for (let i = 0; i < node.quasis.length; i++) {
        out += node.quasis[i].value.raw;
        if (i < node.types.length) {
          const t = printTypeFlat(node.types[i], ctx, depth);
          if (t === null) return null;
          out += "${" + t + "}";
        }
      }
      return out + "`";
    }
    case "TSLiteralType":
      return printFlat(node.literal, ctx, depth);
    case "Identifier":
      return node.name;
    default:
      if (node.value != null && typeof node.value !== "object") {
        return String(node.value);
      }
      return null;
  }
}

function printTypeProperty(prop: any, ctx: Ctx, depth: number): string {
  if (prop.type === "TSPropertySignature") {
    const key = printKey(prop, ctx, depth);
    const optional = prop.optional ? "?" : "";
    const annotation = prop.typeAnnotation
      ? printNode(prop.typeAnnotation, ctx, depth)
      : "";
    return key + optional + annotation;
  }
  if (prop.type === "TSMethodSignature") {
    const key = printKey(prop, ctx, depth);
    const params = (prop.params ?? []).map((p: any) =>
      printNode(p, ctx, depth),
    );
    const annotation = prop.typeAnnotation
      ? printNode(prop.typeAnnotation, ctx, depth)
      : "";
    return `${key}(${params.join(", ")})${annotation}`;
  }
  if (prop.type === "TSCallSignatureDeclaration") {
    const params = (prop.params ?? []).map((p: any) =>
      printNode(p, ctx, depth),
    );
    const annotation = prop.typeAnnotation
      ? printNode(prop.typeAnnotation, ctx, depth)
      : "";
    return `(${params.join(", ")})${annotation}`;
  }
  if (prop.type === "TSConstructSignatureDeclaration") {
    const params = (prop.params ?? []).map((p: any) =>
      printNode(p, ctx, depth),
    );
    const annotation = prop.typeAnnotation
      ? printNode(prop.typeAnnotation, ctx, depth)
      : "";
    return `new (${params.join(", ")})${annotation}`;
  }
  if (prop.type === "TSIndexSignature") {
    const params = (prop.parameters ?? []).map(
      (p: any) => p.name?.name + printNode(p.typeAnnotation, ctx, depth),
    );
    const annotation = prop.typeAnnotation
      ? printNode(prop.typeAnnotation, ctx, depth)
      : "";
    return `[${params.join(", ")}]${annotation}`;
  }
  return `/* ${prop.type} */`;
}

function printTypeLiteral(node: any, ctx: Ctx, depth: number): string {
  const members = node.members ?? [];
  if (!members.length) return "{}";

  const lines: string[] = [];
  lines.push("{");
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const prefix = ctx.ind(depth + 1) + (i === 0 ? "" : ", ");
    lines.push(prefix + printTypeProperty(m, ctx, depth + 1));
  }
  lines.push(ctx.ind(depth) + "}");
  return lines.join("\n");
}

function printUnionOrIntersection(node: any, ctx: Ctx, depth: number): string {
  const sep = node.type === "TSUnionType" ? "| " : "& ";
  const types = node.types;
  if (!types.length) {
    return node.type === "TSUnionType" ? "never" : "unknown";
  }

  // Try flat
  const flatParts: string[] = [];
  for (const t of types) {
    const f = printTypeFlat(t, ctx, depth);
    if (f === null) {
      flatParts.length = 0;
      break;
    }
    flatParts.push(f);
  }
  if (flatParts.length) {
    const flat = flatParts.join(node.type === "TSUnionType" ? " | " : " & ");
    if (fits(flat, ctx, depth * ctx.indentWidth)) return flat;
  }

  const lines: string[] = [];
  for (let i = 0; i < types.length; i++) {
    const f = printTypeFlat(types[i], ctx, depth + 1);
    if (f !== null && fits(f, ctx, (depth + 1) * ctx.indentWidth)) {
      lines.push(ctx.ind(depth + 1) + (i === 0 ? "" : sep) + f);
    } else {
      lines.push(
        ctx.ind(depth + 1) +
          (i === 0 ? "" : sep) +
          printTypeBody(types[i], ctx, depth + 1),
      );
    }
  }
  return lines.join("\n");
}

function printTypeBody(node: any, ctx: Ctx, depth: number): string {
  const flat = printTypeFlat(node, ctx, depth);
  if (flat !== null) return flat;

  if (node.type === "TSTypeLiteral") return printTypeLiteral(node, ctx, depth);
  if (node.type === "TSUnionType" || node.type === "TSIntersectionType") {
    return printUnionOrIntersection(node, ctx, depth);
  }
  if (node.type === "TSFunctionType" || node.type === "TSConstructorType") {
    const params = (node.params ?? []).map((p: any) =>
      printNode(p, ctx, depth),
    );
    const ret = printTypeBody(node.typeAnnotation?.typeAnnotation, ctx, depth);
    const prefix = node.type === "TSConstructorType" ? "new " : "";
    return `${prefix}(${params.join(", ")}) => ${ret}`;
  }
  return `/* ${node.type} */`;
}

function printTypeParam(p: any, ctx: Ctx, depth: number): string {
  const name = typeof p.name === "string" ? p.name : p.name?.name ?? "";
  const c = p.constraint ? " extends " + (printTypeFlat(p.constraint, ctx, depth) ?? printTypeBody(p.constraint, ctx, depth)) : "";
  const d = p.default ? " = " + (printTypeFlat(p.default, ctx, depth) ?? printTypeBody(p.default, ctx, depth)) : "";
  return name + c + d;
}

function printTypeParams(node: any, ctx: Ctx, depth: number): string {
  const params = node?.params ?? [];
  if (!params.length) return "";
  return "<" + params.map((p: any) => (p.type === "TSTypeParameter" ? printTypeParam(p, ctx, depth) : printTypeFlat(p, ctx, depth) ?? printTypeBody(p, ctx, depth))).join(", ") + ">";
}

export function printTypeAnnotation(
  node: any,
  ctx: Ctx,
  depth: number,
): string {
  if (node?.type === "TSTypeParameterDeclaration" || node?.type === "TSTypeParameterInstantiation") {
    return printTypeParams(node, ctx, depth);
  }
  const inner = node?.typeAnnotation;
  if (!inner) return "";
  return ": " + printTypeBody(inner, ctx, depth);
}

export function printTSInterface(node: any, ctx: Ctx, depth: number): string {
  const name = node.id.name;
  const typeParams = node.typeParameters
    ? printTypeFlat(node.typeParameters, ctx, depth)
    : "";
  const extends_ = node.extends?.length
    ? " extends " +
      node.extends
        .map((e: any) => printTypeFlat(e.expression, ctx, depth))
        .join(", ")
    : "";

  const body = node.body?.body ?? [];
  if (!body.length) {
    return (
      ctx.ind(depth) + `interface ${name}${typeParams ?? ""}${extends_} {}`
    );
  }

  const lines: string[] = [];
  lines.push(
    ctx.ind(depth) + `interface ${name}${typeParams ?? ""}${extends_} {`,
  );
  for (let i = 0; i < body.length; i++) {
    const m = body[i];
    const prefix = ctx.ind(depth + 1) + (i === 0 ? "" : ", ");
    lines.push(prefix + printTypeProperty(m, ctx, depth + 1));
  }
  lines.push(ctx.ind(depth) + "}");
  return lines.join("\n");
}

export function printTSEnum(node: any, ctx: Ctx, depth: number): string {
  const name = node.id.name;
  const members = node.body?.members ?? node.members ?? [];
  if (!members.length) {
    return ctx.ind(depth) + `enum ${name} {}`;
  }

  const lines: string[] = [];
  lines.push(ctx.ind(depth) + `enum ${name} {`);
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const id = m.id?.name ?? m.id?.value ?? "";
    const init = m.initializer
      ? " = " + printNode(m.initializer, ctx, depth + 2)
      : "";
    const prefix = i === 0 ? "  " : ctx.ind(depth + 1) + ", ";
    lines.push(prefix + id + init);
  }
  lines.push(ctx.ind(depth) + "}");
  return lines.join("\n");
}

export function printTSTypeAlias(node: any, ctx: Ctx, depth: number): string {
  const name = node.id.name;
  const typeParams = node.typeParameters
    ? printTypeFlat(node.typeParameters, ctx, depth)
    : "";
  const body = printTypeBody(node.typeAnnotation, ctx, depth);
  return (
    ctx.ind(depth) + `type ${name}${typeParams ?? ""} = ${body}` + semi(ctx)
  );
}

export function printTSModule(node: any, ctx: Ctx, depth: number): string {
  const name = node.id?.name ?? node.id?.value ?? "";
  const body = node.body?.body ?? [];
  if (!body.length) {
    return ctx.ind(depth) + `module ${name} {}`;
  }
  const lines = body.map((s: any) => printNode(s, ctx, depth + 1));
  return (
    ctx.ind(depth) +
    `module ${name} {\n` +
    lines.join("\n") +
    "\n" +
    ctx.ind(depth) +
    "}"
  );
}
