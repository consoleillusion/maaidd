/**
 * FTA (Fault Trend Analyzer) metrics — spawn `fta` and normalize results.
 */
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export interface FtaFileMetric {
  file_name: string;
  cyclo: number;
  fta_score: number;
  assessment: string;
  line_count: number;
  halstead?: {
    uniq_operators?: number;
    uniq_operands?: number;
    total_operators?: number;
    total_operands?: number;
    program_length?: number;
    vocabulary_size?: number;
    volume?: number;
    difficulty?: number;
    effort?: number;
    time?: number;
    bugs?: number;
  };
}

export interface FtaResult {
  metrics: FtaFileMetric[];
  average: number | null;
  total: number;
}

function resolveFtaBinary(): string {
  const env = process.env.FTA_BIN;
  if (env) return env;

  // Try node_modules/.bin/fta
  const local = join(process.cwd(), "node_modules", ".bin", "fta");
  try {
    statSync(local);
    return local;
  } catch {}

  return "fta";
}

export function runFta(path: string, excludeUnder: number = 0): FtaResult {
  const target = resolve(path);

  try {
    statSync(target);
  } catch {
    throw new Error(`Path not found: ${target}`);
  }

  const result = spawnSync(resolveFtaBinary(), [target, "--json"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`Unable to run fta: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || "").trim();
    throw new Error(`fta failed${details ? `:\n${details}` : ""}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(result.stdout);
  } catch {
    throw new Error("fta produced invalid JSON");
  }

  if (!Array.isArray(raw)) {
    throw new Error("fta output is not an array");
  }

  let metrics = (raw as Record<string, unknown>[]).map((entry) => ({
    file_name: String(entry.file_name ?? ""),
    cyclo: Number(entry.cyclo ?? 0),
    fta_score: Number(entry.fta_score ?? 0),
    assessment: String(entry.assessment ?? ""),
    line_count: Number(entry.line_count ?? 0),
    halstead: entry.halstead as FtaFileMetric["halstead"],
  }));

  if (excludeUnder > 0) {
    metrics = metrics.filter((m) => m.line_count >= excludeUnder);
  }

  const scores = metrics
    .map((m) => m.fta_score)
    .filter((s) => Number.isFinite(s));
  const average =
    scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;

  return { metrics, average, total: metrics.length };
}
