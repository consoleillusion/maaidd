/**
 * Wider-style printer: comma-first objects/arrays, configurable indent,
 * optional trailing leading-comma on last items, semicolon control.
 */

function makeIndent(options) {
  if (options.indent === "tab") {
    return (n) => "\t".repeat(Math.max(0, n));
  }
  const size = Number(options.indent) || 2;
  return (n) => " ".repeat(Math.max(0, n) * size);
}

/**
 * @param {import('@babel/types').Node} node
 * @param {object} options
 * @returns {string}
 */
export function print(node, options = {}) {
  const opts = {
    indent: 2,
    trailingComma: true,
    semicolons: true,
    ...options,
  };
  const ind = makeIndent(opts);
  const ctx = {
    opts,
    ind,
    // column where current line's content started (for comma-first align)
    alignCol: 0,
  };
  return printNode(node, ctx, 0).replace(/\s+$/m, "") + "\n";
}

function semi(ctx) {
  return ctx.opts.semicolons ? ";" : "";
}


/** Prefix every line of a multi-line string with pad (first line included). */
function reindent(str, pad) {
  if (!str.includes("\n")) return pad + str;
  return str.split("\n").map((ln) => pad + ln).join("\n");
}

/** Indent only continuation lines (leave first line as-is). */
function indentContinuations(str, pad) {
  if (!str.includes("\n")) return str;
  const [first, ...rest] = str.split("\n");
  return [first, ...rest.map((ln) => pad + ln)].join("\n");
}

function printNode(node, ctx, depth) {
  if (!node) return "";
  const t = node.type;

  switch (t) {
    case "File":
      return printNode(node.program, ctx, depth);
    case "Program":
      return node.body.map((s) => printNode(s, ctx, depth)).join("\n");

    case "VariableDeclaration":
      return printVariableDeclaration(node, ctx, depth);
    case "VariableDeclarator":
      return printVariableDeclarator(node, ctx, depth);

    case "FunctionDeclaration":
      return printFunction(node, ctx, depth, true);
    case "FunctionExpression":
      return printFunction(node, ctx, depth, false);
    case "ArrowFunctionExpression":
      return printArrow(node, ctx, depth);

    case "ObjectExpression":
      return printObject(node, ctx, depth);
    case "ArrayExpression":
      return printArray(node, ctx, depth);

    case "BlockStatement":
      return printBlock(node, ctx, depth);
    case "ReturnStatement":
      return (
        ctx.ind(depth) +
        "return" +
        (node.argument ? " " + printNode(node.argument, ctx, depth) : "") +
        semi(ctx)
      );
    case "ExpressionStatement":
      return ctx.ind(depth) + printNode(node.expression, ctx, depth) + semi(ctx);
    case "IfStatement":
      return printIf(node, ctx, depth);
    case "ForStatement":
    case "ForInStatement":
    case "ForOfStatement":
    case "WhileStatement":
    case "DoWhileStatement":
      return printLoop(node, ctx, depth);
    case "BreakStatement":
      return ctx.ind(depth) + "break" + (node.label ? " " + node.label.name : "") + semi(ctx);
    case "ContinueStatement":
      return ctx.ind(depth) + "continue" + (node.label ? " " + node.label.name : "") + semi(ctx);
    case "ThrowStatement":
      return ctx.ind(depth) + "throw " + printNode(node.argument, ctx, depth) + semi(ctx);
    case "TryStatement":
      return printTry(node, ctx, depth);

    case "CallExpression":
    case "NewExpression":
      return printCall(node, ctx, depth);
    case "MemberExpression":
    case "OptionalMemberExpression":
      return printMember(node, ctx, depth);
    case "BinaryExpression":
    case "LogicalExpression":
      return (
        printNode(node.left, ctx, depth) +
        " " +
        node.operator +
        " " +
        printNode(node.right, ctx, depth)
      );
    case "UnaryExpression":
      return (
        node.operator +
        (node.operator === "typeof" || node.operator === "void" || node.operator === "delete"
          ? " "
          : "") +
        printNode(node.argument, ctx, depth)
      );
    case "UpdateExpression":
      return node.prefix
        ? node.operator + printNode(node.argument, ctx, depth)
        : printNode(node.argument, ctx, depth) + node.operator;
    case "AssignmentExpression":
      return (
        printNode(node.left, ctx, depth) +
        " " +
        node.operator +
        " " +
        printNode(node.right, ctx, depth)
      );
    case "ConditionalExpression":
      return (
        printNode(node.test, ctx, depth) +
        " ? " +
        printNode(node.consequent, ctx, depth) +
        " : " +
        printNode(node.alternate, ctx, depth)
      );
    case "SequenceExpression":
      return node.expressions.map((e) => printNode(e, ctx, depth)).join(", ");

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
    case "TemplateLiteral":
      return printTemplate(node, ctx, depth);
    case "TaggedTemplateExpression":
      return printNode(node.tag, ctx, depth) + printTemplate(node.quasi, ctx, depth);

    case "ArrayPattern":
      return printArrayPattern(node, ctx, depth);
    case "ObjectPattern":
      return printObjectPattern(node, ctx, depth);
    case "AssignmentPattern":
      return printNode(node.left, ctx, depth) + " = " + printNode(node.right, ctx, depth);
    case "RestElement":
      return "..." + printNode(node.argument, ctx, depth);
    case "SpreadElement":
      return "..." + printNode(node.argument, ctx, depth);

    case "ClassDeclaration":
    case "ClassExpression":
      return printClass(node, ctx, depth);
    case "ClassBody":
      return printClassBody(node, ctx, depth);
    case "ClassMethod":
    case "ClassPrivateMethod":
      return printClassMethod(node, ctx, depth);
    case "ClassProperty":
    case "ClassPrivateProperty":
      return printClassProperty(node, ctx, depth);

    case "ImportDeclaration":
      return printImport(node, ctx, depth);
    case "ExportNamedDeclaration":
      return printExportNamed(node, ctx, depth);
    case "ExportDefaultDeclaration":
      return printExportDefault(node, ctx, depth);
    case "ExportAllDeclaration":
      return (
        ctx.ind(depth) +
        "export * from " +
        printLiteral(node.source) +
        semi(ctx)
      );

    case "AwaitExpression":
      return "await " + printNode(node.argument, ctx, depth);
    case "YieldExpression":
      return (
        "yield" +
        (node.delegate ? "*" : "") +
        (node.argument ? " " + printNode(node.argument, ctx, depth) : "")
      );
    case "ThisExpression":
      return "this";
    case "Super":
      return "super";
    case "MetaProperty":
      return printNode(node.meta, ctx, depth) + "." + printNode(node.property, ctx, depth);
    case "ImportExpression":
      return "import(" + printNode(node.source, ctx, depth) + ")";

    case "EmptyStatement":
      return "";
    case "DebuggerStatement":
      return ctx.ind(depth) + "debugger" + semi(ctx);

    case "TSTypeAnnotation":
    case "TSTypeParameterDeclaration":
    case "TSTypeParameterInstantiation":
      // TypeScript sugar stripped for now (formatter focuses on JS style)
      return "";
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSTypeAssertion":
      return printNode(node.expression, ctx, depth);
    case "TSNonNullExpression":
      return printNode(node.expression, ctx, depth) + "!";

    default:
      // Fallback: try common fields
      if (node.value != null && typeof node.value !== "object") {
        return String(node.value);
      }
      return `/* unsupported:${t} */`;
  }
}

function printLiteral(node) {
  if (node.type === "StringLiteral") {
    // Prefer original extra.raw when present
    if (node.extra && typeof node.extra.raw === "string") return node.extra.raw;
    return JSON.stringify(node.value);
  }
  if (node.type === "NumericLiteral") {
    if (node.extra && typeof node.extra.raw === "string") return node.extra.raw;
    return String(node.value);
  }
  if (node.type === "BooleanLiteral") return node.value ? "true" : "false";
  if (node.type === "BigIntLiteral") return (node.value ?? node.bigint) + "n";
  if (node.type === "NullLiteral") return "null";
  return String(node.value ?? "");
}

function printTemplate(node, ctx, depth) {
  let out = "`";
  for (let i = 0; i < node.quasis.length; i++) {
    out += node.quasis[i].value.raw;
    if (i < node.expressions.length) {
      out += "${" + printNode(node.expressions[i], ctx, depth) + "}";
    }
  }
  return out + "`";
}

function printVariableDeclaration(node, ctx, depth) {
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

function printVariableDeclarator(node, ctx, depth) {
  const id = printNode(node.id, ctx, depth);
  if (!node.init) return id;
  const init = printNode(node.init, ctx, depth);
  // Keep first line after `= `; indent Wider continuations under the statement
  return id + " = " + indentContinuations(init, ctx.ind(depth));
}

function printParams(params, ctx, depth) {
  // Always single-line for function arguments
  return params.map((p) => printNode(p, ctx, depth)).join(", ");
}

function printFunction(node, ctx, depth, isDecl) {
  const async = node.async ? "async " : "";
  const gen = node.generator ? "*" : "";
  const name = node.id ? printNode(node.id, ctx, depth) : "";
  const params = printParams(node.params, ctx, depth);
  const body = printNode(node.body, ctx, depth);
  const head = `${async}function${gen}${name ? " " + name : ""}(${params})`;
  if (isDecl) {
    return ctx.ind(depth) + head + " " + body.trimStart();
  }
  return head + " " + body.trimStart();
}

function printArrow(node, ctx, depth) {
  const async = node.async ? "async " : "";
  const params = printParams(node.params, ctx, depth);
  // Single param without defaults/destructure can drop parens — keep parens for consistency
  const paramStr = `(${params})`;
  let body;
  if (node.body.type === "BlockStatement") {
    body = " " + printNode(node.body, ctx, depth).trimStart();
  } else {
    body = " " + printNode(node.body, ctx, depth);
  }
  return `${async}${paramStr} =>${body}`;
}

function printBlock(node, ctx, depth) {
  if (!node.body.length) return "{}";
  const lines = node.body.map((s) => printNode(s, ctx, depth + 1));
  return "{\n" + lines.join("\n") + "\n" + ctx.ind(depth) + "}";
}

/**
 * Comma-first object:
 * { a: 1
 * , b: 2
 * , c: 3
 * }
 */
function printObject(node, ctx, depth) {
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

function printObjectProp(prop, ctx, depth) {
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

function printKey(prop, ctx, depth) {
  if (prop.computed) {
    return "[" + printNode(prop.key, ctx, depth) + "]";
  }
  if (prop.key.type === "Identifier") return prop.key.name;
  return printNode(prop.key, ctx, depth);
}

function printArray(node, ctx, depth) {
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

function printCall(node, ctx, depth) {
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

function printMember(node, ctx, depth) {
  const obj = printNode(node.object, ctx, depth);
  const opt = node.optional ? "?" : "";
  if (node.computed) {
    return obj + opt + "[" + printNode(node.property, ctx, depth) + "]";
  }
  return obj + opt + "." + printNode(node.property, ctx, depth);
}

function printIf(node, ctx, depth) {
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

function printLoop(node, ctx, depth) {
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

function printTry(node, ctx, depth) {
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

function printArrayPattern(node, ctx, depth) {
  return (
    "[" +
    node.elements.map((e) => (e ? printNode(e, ctx, depth) : "")).join(", ") +
    "]"
  );
}

function printObjectPattern(node, ctx, depth) {
  return (
    "{ " +
    node.properties.map((p) => printObjectProp(p, ctx, depth)).join(", ") +
    " }"
  );
}

function printClass(node, ctx, depth) {
  const name = node.id ? " " + printNode(node.id, ctx, depth) : "";
  const superClass = node.superClass
    ? " extends " + printNode(node.superClass, ctx, depth)
    : "";
  const body = printNode(node.body, ctx, depth);
  const head = (node.type === "ClassDeclaration" ? ctx.ind(depth) : "") + "class" + name + superClass;
  return head + " " + body.trimStart();
}

function printClassBody(node, ctx, depth) {
  if (!node.body.length) return "{}";
  const lines = node.body.map((m) => printNode(m, ctx, depth + 1));
  return "{\n" + lines.join("\n") + "\n" + ctx.ind(depth) + "}";
}

function printClassMethod(node, ctx, depth) {
  const static_ = node.static ? "static " : "";
  const async = node.async ? "async " : "";
  const gen = node.generator ? "*" : "";
  const kind =
    node.kind === "get" || node.kind === "set" ? node.kind + " " : "";
  const key = printKey(node, ctx, depth);
  const params = printParams(node.params, ctx, depth);
  const body = printNode(node.body, ctx, depth);
  return (
    ctx.ind(depth) +
    `${static_}${kind}${async}${gen}${key}(${params}) ${body.trimStart()}`
  );
}

function printClassProperty(node, ctx, depth) {
  const static_ = node.static ? "static " : "";
  const key = printKey(node, ctx, depth);
  const val = node.value ? " = " + printNode(node.value, ctx, depth) : "";
  return ctx.ind(depth) + static_ + key + val + semi(ctx);
}

function printImport(node, ctx, depth) {
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

function printExportNamed(node, ctx, depth) {
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

function printExportDefault(node, ctx, depth) {
  return (
    ctx.ind(depth) +
    "export default " +
    printNode(node.declaration, ctx, depth).trimStart() +
    (node.declaration.type.endsWith("Declaration") ? "" : semi(ctx))
  );
}
