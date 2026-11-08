import type { Ctx } from "./context.ts";

export function isMultiline(text: string): boolean {
  return text.includes("\n");
}

export function lastLine(text: string): string {
  const index = text.lastIndexOf("\n");
  return index === -1 ? text : text.slice(index + 1);
}

/** Prefix every line (including the first) with pad. */
export function indentLines(text: string, pad: string): string {
  if (!text) return text;
  return text
    .split("\n")
    .map((line) => (line.length ? pad + line : line))
    .join("\n");
}

/** Prefix every line except the first with pad. */
export function shiftContinuations(text: string, pad: string): string {
  if (!isMultiline(text)) return text;
  const [first, ...rest] = text.split("\n");
  return [first, ...rest.map((line) => (line.length ? pad + line : line))].join("\n");
}

export function appendToLastLine(text: string, suffix: string): string {
  return text + suffix;
}

export function maxLineWidth(text: string): number {
  return text.split("\n").reduce((max, line) => Math.max(max, line.length), 0);
}

/** Does a single-line rendering fit at the given starting column? */
export function fits(flat: string, ctx: Ctx, column: number): boolean {
  return !isMultiline(flat) && column + flat.length <= ctx.opts.lineWidth;
}

export function joinWithBlankLines(parts: string[]): string {
  return parts.filter((part) => part.length > 0).join("\n\n");
}

export function joinStatements(parts: string[], blank: boolean): string {
  const filtered = parts.filter((part) => part.length > 0);
  if (!blank) return filtered.join("\n");
  return filtered.join("\n\n");
}
