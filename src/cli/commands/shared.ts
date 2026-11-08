/**
 * Shared CLI utilities for file collection, flag detection, and formatting.
 */
import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { format } from "../../index.ts";
import type { FormatOptions } from "../../types.ts";
export const FORMATTABLE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);
export const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  ".code-graph",
  "dist",
  "build",
]);
/** Recursively collect formattable files under dir. */
export function collectFiles(dir: string): string[] {
  const files: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  } catch {
    return files;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...collectFiles(path));
    } else if (
      entry.isFile() &&
      FORMATTABLE_EXTENSIONS.has(extname(entry.name).toLowerCase())
    ) {
      files.push(path);
    }
  }
  return files;
}
/** Check if a path is a directory. */
export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
/** Check if any of the given flag names appear in process.argv. */
export function wasFlagProvided(...names): boolean {
  const argv = process.argv.slice(2);
  return names.some((n) => {
    if (n.length === 1) {
      return argv.includes(`-${n}`) || argv.some((a) => a.startsWith(`-${n}=`));
    }
    return argv.includes(`--${n}`) || argv.some((a) => a.startsWith(`--${n}=`));
  });
}
/** Format a single file, writing to destPath. Returns false for empty input. */
export function formatFile(
  sourcePath: string,
  destPath: string,
  options: FormatOptions,
): boolean {
  const source = readFileSync(sourcePath, "utf8");
  if (!source.trim()) return false;
  const result = format(source, { ...options, filename: sourcePath });
  if (destPath !== sourcePath) {
    mkdirSync(dirname(destPath), { recursive: true });
  }
  writeFileSync(destPath, result, "utf8");
  return true;
}
/** Format stdin, write to stdout. */
export function formatStdin(
  options: FormatOptions,
  stdout: (s: string) => void,
): void {
  const source = readFileSync(0, "utf8");
  if (!source.trim()) return;
  const result = format(source, {
    ...options,
    filename: options.filename ?? "stdin.ts",
  });
  stdout(result);
}
/** Format a single file path, optionally writing to output. */
export function formatSingleFile(
  inputPath: string,
  outputPath: string | undefined,
  options: FormatOptions,
  stdout: (s: string) => void,
  stderr: (s: string) => void,
): void {
  let source: string;
  try {
    source = readFileSync(inputPath, "utf8");
  } catch (err) {
    stderr(
      `Cannot read ${inputPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exitCode = 1;
    return;
  }
  if (!source.trim()) return;
  let result: string;
  try {
    result = format(source, { ...options, filename: inputPath });
  } catch (err) {
    stderr(
      `Format error: ${inputPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exitCode = 1;
    return;
  }
  if (!outputPath) {
    stdout(result);
    return;
  }
  const dest = isDirectory(outputPath)
    ? join(outputPath, basename(inputPath))
    : outputPath;
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, result, "utf8");
}
/** Format a directory, optionally mirroring to output dir. */
export function formatDirectory(
  inputPath: string,
  outputPath: string | undefined,
  options: FormatOptions,
  stderr: (s: string) => void,
): void {
  if (outputPath && !isDirectory(outputPath)) {
    stderr(`Output must be a directory: ${outputPath}`);
    process.exitCode = 1;
    return;
  }
  const files = collectFiles(inputPath);
  if (!files.length) {
    stderr(`No formattable files found in ${inputPath}`);
    return;
  }
  let formatted = 0;
  let failed = 0;
  for (const file of files) {
    const dest = outputPath
      ? join(outputPath, relative(inputPath, file))
      : file;
    try {
      if (formatFile(file, dest, options)) formatted++;
    } catch (err) {
      failed++;
      stderr(
        `Format error: ${file}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  const failedSuffix = failed ? `, ${failed} failed` : "";
  stderr(
    `Formatted ${formatted} file${formatted === 1 ? "" : "s"}${failedSuffix}`,
  );
  if (failed) process.exitCode = 1;
}
/** Format a path (file or directory), or stdin if no path. */
export function formatPaths(
  paths: readonly string[],
  output: string | undefined,
  options: FormatOptions,
  stdout: (s: string) => void,
  stderr: (s: string) => void,
): void {
  if (paths.length === 0) {
    formatStdin(options, stdout);
    return;
  }
  for (const p of paths) {
    if (!exists(p)) {
      stderr(`Input not found: ${p}`);
      process.exitCode = 1;
      continue;
    }
    if (isDirectory(p)) {
      formatDirectory(p, output, options, stderr);
    } else {
      formatSingleFile(p, output, options, stdout, stderr);
    }
  }
}
const exists = (path: string) => {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
};
/** Parse indent string: "2", "4", "8", or "tab". */
export function parseIndent(input: string): number | "tab" {
  if (input === "tab") return "tab";
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return 2;
  return Math.min(8, Math.round(n));
}
/** Parse a positive integer from a string. */
export function parsePositiveInt(input: string): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}
