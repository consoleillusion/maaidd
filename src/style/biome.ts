import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { ResolvedFormatOptions } from "../types.ts";

const require = createRequire(import.meta.url);

let cachedBinary: string | undefined;

/** Locate the Biome executable without assuming a particular package manager layout. */
export function resolveBiomeBinary(): string {
  if (cachedBinary) return cachedBinary;
  const fromEnv = process.env.BIOME_BIN;
  if (fromEnv && existsSync(fromEnv)) {
    cachedBinary = fromEnv;
    return cachedBinary;
  }

  try {
    const packageJson = require.resolve("@biomejs/biome/package.json");
    const candidate = join(dirname(packageJson), "bin", "biome");
    if (existsSync(candidate)) {
      cachedBinary = candidate;
      return cachedBinary;
    }
  } catch {
    // Fall through to the local .bin lookup.
  }

  const local = join(process.cwd(), "node_modules", ".bin", "biome");
  if (existsSync(local)) {
    cachedBinary = local;
    return cachedBinary;
  }

  cachedBinary = "biome";
  return cachedBinary;
}

function indentArgs(options: ResolvedFormatOptions): string[] {
  if (options.indent === "tab") {
    return ["--indent-style=tab", "--indent-width=2"];
  }
  return ["--indent-style=space", `--indent-width=${options.indent}`];
}

function allStyleArgs(options: ResolvedFormatOptions): string[] {
  return [
    ...indentArgs(options),
    `--line-width=${options.lineWidth}`,
    `--semicolons=${options.semicolons ? "always" : "as-needed"}`,
    `--javascript-formatter-quote-style=${options.quoteStyle}`,
    `--trailing-commas=${options.trailingComma}`,
  ];
}

function explicitStyleArgs(
  options: ResolvedFormatOptions,
  explicit: ReadonlySet<string>,
): string[] {
  const args: string[] = [];
  if (explicit.has("indent")) args.push(...indentArgs(options));
  if (explicit.has("line-width"))
    args.push(`--line-width=${options.lineWidth}`);
  if (explicit.has("semicolons")) {
    args.push(`--semicolons=${options.semicolons ? "always" : "as-needed"}`);
  }
  if (explicit.has("quote-style")) {
    args.push(`--javascript-formatter-quote-style=${options.quoteStyle}`);
  }
  if (explicit.has("trailing-comma")) {
    args.push(`--trailing-commas=${options.trailingComma}`);
  }
  return args;
}

export interface BiomeRunOptions {
  /** Force all resolved style options onto the Biome command. */
  forceStyle?: boolean;
  /** Names of CLI flags that were explicitly supplied. */
  explicit?: ReadonlySet<string>;
}

/**
 * Run Biome over a single source string.
 *
 * In standard mode we deliberately let `biome.json` govern defaults: style flags are
 * only forwarded when the caller explicitly supplied them. Functional mode forces a
 * stable normalization pass so the leading-comma printer always sees the same input.
 */
export function formatWithBiome(
  source: string,
  options: ResolvedFormatOptions,
  run: BiomeRunOptions = {},
): string {
  const args = ["format", `--stdin-file-path=${options.filename}`];
  if (run.forceStyle) {
    args.push(...allStyleArgs(options));
  } else if (run.explicit && run.explicit.size > 0) {
    args.push(...explicitStyleArgs(options, run.explicit));
  }
  // `configPath` belongs to maaidd.config.json, not Biome. Biome discovers its
  // own biome.json from the input path; passing MAAIDD's config here is invalid.
  const result = spawnSync(resolveBiomeBinary(), args, {
    input: source,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`Unable to run Biome: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || "").trim();
    throw new Error(
      `Biome failed for ${options.filename}${details ? `:\n${details}` : ""}`,
    );
  }
  return result.stdout;
}

export function biomeVersion(): string | undefined {
  const result = spawnSync(resolveBiomeBinary(), ["--version"], {
    encoding: "utf8",
  });
  if (result.status !== 0) return undefined;
  return result.stdout.trim();
}
