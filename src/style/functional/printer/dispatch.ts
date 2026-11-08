/**
 * Node dispatch: routes each AST node type to its printer.
 *
 * Handler modules import `printNode` from here for recursive printing.
 * The resulting cycles are safe because every import is a hoisted
 * function declaration resolved before any printing happens.
 */
import type { Ctx } from "./context.ts";
import { semi } from "./context.ts";
import { printLiteral, printTemplate } from "./literals.ts";
import { printFunction, printArrow } from "./functions.ts";
import {
  printObject,
  printArray,
  printObjectPattern,
  printArrayPattern,
} from "./objects.ts";
import {
  printVariableDeclaration,
  printVariableDeclarator,
  printBlock,
  printIf,
  printLoop,
  printTry,
  printSwitch,
  printLabeled,
} from "./statements.ts";
import { printCall, printMember } from "./expressions.ts";
import {
  printClass,
  printClassBody,
  printClassMethod,
  printClassProperty,
} from "./classes.ts";
import {
  printImport,
  printExportNamed,
  printExportDefault,
  printExportAll,
} from "./modules.ts";
import {
  printTypeAnnotation,
  printTypeFlat,
  printTSInterface,
  printTSEnum,
  printTSTypeAlias,
  printTSModule,
} from "./typescript.ts";
import { printJsx, printJsxFlat } from "./jsx.ts";
import { takeLeadingComments, takeRemainingComments } from "./comments.ts";

export function printNode(
  node: any,
  ctx: Ctx,
  depth: number,
  column?: number,
): string {
  if (!node) return "";
  const t = node.type;

  switch (t) {
    case "File":
      return printNode(node.program, ctx, depth);
    case "Program": {
      const lines = node.body.flatMap((s: any) => [
        ...takeLeadingComments(s, ctx, depth),
        printNode(s, ctx, depth),
      ]);
      lines.push(...takeRemainingComments(node.comments, ctx));
      return lines.join("\n");
    }

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
      return printObject(node, ctx, depth, { column });
    case "ArrayExpression":
      return printArray(node, ctx, depth, { column });

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
      return (
        ctx.ind(depth) + printNode(node.expression, ctx, depth) + semi(ctx)
      );
    case "IfStatement":
      return printIf(node, ctx, depth);
    case "ForStatement":
    case "ForInStatement":
    case "ForOfStatement":
    case "WhileStatement":
    case "DoWhileStatement":
      return printLoop(node, ctx, depth);
    case "BreakStatement":
      return (
        ctx.ind(depth) +
        "break" +
        (node.label ? " " + node.label.name : "") +
        semi(ctx)
      );
    case "ContinueStatement":
      return (
        ctx.ind(depth) +
        "continue" +
        (node.label ? " " + node.label.name : "") +
        semi(ctx)
      );
    case "ThrowStatement":
      return (
        ctx.ind(depth) +
        "throw " +
        printNode(node.argument, ctx, depth) +
        semi(ctx)
      );
    case "TryStatement":
      return printTry(node, ctx, depth);
    case "SwitchStatement":
      return printSwitch(node, ctx, depth);
    case "LabeledStatement":
      return printLabeled(node, ctx, depth);

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
        (node.operator === "typeof" ||
        node.operator === "void" ||
        node.operator === "delete"
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
      return node.expressions
        .map((e: any) => printNode(e, ctx, depth))
        .join(", ");

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
      return `/${node.pattern}/${node.flags ?? ""}`;
    case "TemplateLiteral":
      return printTemplate(node, ctx, depth);
    case "TaggedTemplateExpression":
      return (
        printNode(node.tag, ctx, depth) + printTemplate(node.quasi, ctx, depth)
      );

    case "ArrayPattern":
      return printArrayPattern(node, ctx, depth);
    case "ObjectPattern":
      return printObjectPattern(node, ctx, depth);
    case "AssignmentPattern":
      return (
        printNode(node.left, ctx, depth) +
        " = " +
        printNode(node.right, ctx, depth)
      );
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
      return printExportAll(node, ctx, depth);

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
      return (
        printNode(node.meta, ctx, depth) +
        "." +
        printNode(node.property, ctx, depth)
      );
    case "ImportExpression":
      return "import(" + printNode(node.source, ctx, depth) + ")";

    case "EmptyStatement":
      return "";
    case "DebuggerStatement":
      return ctx.ind(depth) + "debugger" + semi(ctx);

    // TypeScript — preserved and printed
    case "TSAsExpression":
      return (
        printNode(node.expression, ctx, depth) +
        " as " +
        printTypeFlat(node.typeAnnotation, ctx, depth)
      );
    case "TSSatisfiesExpression":
      return (
        printNode(node.expression, ctx, depth) +
        " satisfies " +
        printTypeFlat(node.typeAnnotation, ctx, depth)
      );
    case "TSTypeAssertion":
      return (
        "<" +
        printTypeFlat(node.typeAnnotation, ctx, depth) +
        ">" +
        printNode(node.expression, ctx, depth)
      );
    case "TSNonNullExpression":
      return printNode(node.expression, ctx, depth) + "!";
    case "TSTypeAnnotation":
      return printTypeAnnotation(node, ctx, depth);
    case "TSTypeParameterDeclaration":
    case "TSTypeParameterInstantiation":
      return printTypeAnnotation(node, ctx, depth);
    case "TSInterfaceDeclaration":
      return printTSInterface(node, ctx, depth);
    case "TSEnumDeclaration":
      return printTSEnum(node, ctx, depth);
    case "TSTypeAliasDeclaration":
      return printTSTypeAlias(node, ctx, depth);
    case "TSModuleDeclaration":
      return printTSModule(node, ctx, depth);
    case "TSImportEqualsDeclaration":
      return (
        ctx.ind(depth) +
        "import " +
        printNode(node.id, ctx, depth) +
        " = " +
        (node.moduleReference
          ? printNode(node.moduleReference, ctx, depth)
          : "") +
        semi(ctx)
      );
    case "TSExportAssignment":
      return (
        ctx.ind(depth) +
        "export = " +
        printNode(node.expression, ctx, depth) +
        semi(ctx)
      );

    // JSX — preserved and printed
    case "JSXElement":
    case "JSXFragment":
      return printJsx(node, ctx, depth);

    default:
      if (node.value != null && typeof node.value !== "object") {
        return String(node.value);
      }
      return `/* unsupported:${t} */`;
  }
}
