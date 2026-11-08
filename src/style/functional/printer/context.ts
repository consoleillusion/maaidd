import type { CommaStyle } from "../../../types.ts";

export interface PrinterOptions {
  indent: number | "tab";
  lineWidth: number;
  semicolons: boolean;
  commaStyle: CommaStyle;
  objectValueIndent: number;
  arrayValueIndent: number;
  forceBlankLines: boolean;
  maxInlineArrayItems: number;
}

export interface Ctx {
  opts: PrinterOptions;
  ind(level: number): string;
  indentWidth: number;
  printedComments: Set<number>;
}

export function makeContext(options: PrinterOptions): Ctx {
  const indentWidth =
    options.indent === "tab" ? 2 : Number(options.indent) || 2;
  const ind =
    options.indent === "tab"
      ? (level: number) => "\t".repeat(Math.max(0, level))
      : (level: number) => " ".repeat(Math.max(0, level) * indentWidth);

  return {
    opts: options,
    ind,
    indentWidth,
    printedComments: new Set<number>(),
  };
}

export function semi(ctx: Ctx): string {
  return ctx.opts.semicolons ? ";" : "";
}
