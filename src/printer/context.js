/**
 * Printer context helpers: indentation and semicolon control.
 */

export function makeIndent(options) {
  if (options.indent === "tab") {
    return (n) => "\t".repeat(Math.max(0, n));
  }
  const size = Number(options.indent) || 2;
  return (n) => " ".repeat(Math.max(0, n) * size);
}

export function semi(ctx) {
  return ctx.opts.semicolons ? ";" : "";
}
