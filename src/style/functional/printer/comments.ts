import type { Ctx } from "./context.ts";
import { isMultiline, lastLine } from "./layout.ts";

export interface BabelComment {
  type: "CommentLine" | "CommentBlock";
  value: string;
  start?: number | null;
  end?: number | null;
  loc?: { start: { line: number }; end: { line: number } } | null;
}

export function printComment(comment: BabelComment): string {
  if (comment.type === "CommentBlock") return `/*${comment.value}*/`;
  return `//${comment.value}`;
}

function isPrinted(comment: BabelComment, ctx: Ctx): boolean {
  return (
    typeof comment.start === "number" && ctx.printedComments.has(comment.start)
  );
}

function markPrinted(comment: BabelComment, ctx: Ctx): void {
  if (typeof comment.start === "number") ctx.printedComments.add(comment.start);
}

/** Comments that should appear on their own lines before a statement/property/element. */
export function takeLeadingComments(
  node: any,
  ctx: Ctx,
  depth: number,
): string[] {
  const comments = (node?.leadingComments ?? []) as BabelComment[];
  const lines: string[] = [];
  for (const comment of comments) {
    if (isPrinted(comment, ctx)) continue;
    markPrinted(comment, ctx);
    lines.push(ctx.ind(depth) + printComment(comment));
  }
  return lines;
}

/** A trailing comment on the same source line as the node. */
export function takeTrailingComment(node: any, ctx: Ctx): string {
  const comments = (node?.trailingComments ?? []) as BabelComment[];
  for (const comment of comments) {
    if (isPrinted(comment, ctx)) continue;
    const nodeEnd = node?.loc?.end?.line;
    const commentStart = comment.loc?.start?.line;
    if (
      nodeEnd !== undefined &&
      commentStart !== undefined &&
      nodeEnd === commentStart
    ) {
      markPrinted(comment, ctx);
      return " " + printComment(comment);
    }
  }
  return "";
}

/**
 * Comments attached to an expression. Only block comments are safe to inline;
 * line comments are left for statement/property level handling.
 */
export function inlineLeadingComments(node: any, ctx: Ctx): string {
  const comments = (node?.leadingComments ?? []) as BabelComment[];
  let prefix = "";
  for (const comment of comments) {
    if (isPrinted(comment, ctx)) continue;
    if (comment.type !== "CommentBlock") continue;
    markPrinted(comment, ctx);
    prefix += printComment(comment) + " ";
  }
  return prefix;
}

export function inlineTrailingComments(node: any, ctx: Ctx): string {
  const comments = (node?.trailingComments ?? []) as BabelComment[];
  let suffix = "";
  for (const comment of comments) {
    if (isPrinted(comment, ctx)) continue;
    if (comment.type !== "CommentBlock") continue;
    markPrinted(comment, ctx);
    suffix += " " + printComment(comment);
  }
  return suffix;
}

/** Print comments that were never attached to a node, usually at end of file. */
export function takeRemainingComments(
  comments: BabelComment[] | undefined,
  ctx: Ctx,
): string[] {
  const out: string[] = [];
  for (const comment of comments ?? []) {
    if (isPrinted(comment, ctx)) continue;
    markPrinted(comment, ctx);
    out.push(printComment(comment));
  }
  return out;
}

/** Append a trailing comment without disturbing multi-line indentation. */
export function appendTrailing(text: string, suffix: string): string {
  if (!suffix) return text;
  if (!isMultiline(text)) return text + suffix;
  return lastLine(text) + suffix === text ? text : text + suffix;
}
