/**
 * Validation and normalization for `maid.config.json` insights settings.
 *
 * The defaults live in `DEFAULT_CONFIG.insights`. A config patch may be
 * partial; `resolveInsightsConfig` deep-merges it over the defaults and
 * validates the result so every insight tool receives a complete config.
 */
import { z } from "zod";
import { DEFAULT_CONFIG, type InsightsConfig } from "../types.ts";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const mergeDeep = <T>(base: T, patch: unknown): T => {
  if (!isRecord(patch)) return structuredClone(base);
  const out: Record<string, unknown> = {
    ...(structuredClone(base) as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries(patch)) {
    const current = out[key];
    if (isRecord(current) && isRecord(value)) {
      out[key] = mergeDeep(current, value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as T;
};

const nonNegative = z.number().min(0);
const ratio = z.number().min(0).max(1);

export const InsightBenchmarkTargetsSchema = z.object({
  minTestPassRate: ratio,
  maxCyclomaticDelta: z.number(),
  minAvgFtaScoreDelta: z.number(),
  maxHalsteadBugsDelta: z.number(),
  maxTotalLinesDelta: z.number().nullable(),
});

export const InsightBenchmarkToleranceSchema = z.object({
  testsPassRate: nonNegative,
  avgFtaScore: nonNegative,
  avgCyclomatic: nonNegative,
  halsteadBugs: nonNegative,
  totalLines: nonNegative,
});

export const InsightBenchmarkConfigSchema = z.object({
  baseline: z.string().min(1),
  targets: InsightBenchmarkTargetsSchema,
  tolerance: InsightBenchmarkToleranceSchema,
});

export const InsightScoreWeightsSchema = z.object({
  gate: nonNegative,
  fta: nonNegative,
  complexity: nonNegative,
  tests: nonNegative,
  trend: nonNegative,
  dependencies: nonNegative,
});

export const InsightScoreGradesSchema = z.object({
  A: z.number().min(0).max(100),
  B: z.number().min(0).max(100),
  C: z.number().min(0).max(100),
  D: z.number().min(0).max(100),
});

export const InsightScoreConfigSchema = z.object({
  weights: InsightScoreWeightsSchema,
  grades: InsightScoreGradesSchema,
  missingDataCredit: ratio,
});

export const InsightDependencyPenaltiesSchema = z.object({
  runtime: nonNegative,
  dev: nonNegative,
  optional: nonNegative,
  peer: nonNegative,
});

export const InsightDependencyBonusesSchema = z.object({
  runtime: nonNegative,
  dev: nonNegative,
  optional: nonNegative,
  peer: nonNegative,
});

export const InsightDependencyOffsetSchema = z.object({
  minLinesReduced: nonNegative,
  minCyclomaticReduced: nonNegative,
  bonusPerDependency: nonNegative,
});

export const InsightDependencyConfigSchema = z.object({
  manifests: z.array(z.string().min(1)).min(1),
  penalties: InsightDependencyPenaltiesSchema,
  removalBonuses: InsightDependencyBonusesSchema,
  offset: InsightDependencyOffsetSchema,
  allow: z.array(z.string().min(1)),
  deny: z.array(z.string().min(1)),
});

export const InsightCommitConfigSchema = z.object({
  requirePendingSnapshot: z.boolean(),
  requireTestsPassing: z.boolean(),
  requireGatePassing: z.boolean(),
  maxChangedFiles: nonNegative,
  maxChangedLines: nonNegative,
  suggestSplit: z.boolean(),
  dependencyChangesSeparate: z.boolean(),
});

export const InsightsConfigSchema = z.object({
  benchmark: InsightBenchmarkConfigSchema,
  score: InsightScoreConfigSchema,
  dependencies: InsightDependencyConfigSchema,
  commit: InsightCommitConfigSchema,
});

/**
 * Partial patch accepted by `project_update` and `maid init --insights-config`.
 */
export const InsightsConfigPatchSchema = z
  .object({
    benchmark: InsightBenchmarkConfigSchema.partial()
      .extend({
        targets: InsightBenchmarkTargetsSchema.partial().optional(),
        tolerance: InsightBenchmarkToleranceSchema.partial().optional(),
      })
      .optional(),
    score: InsightScoreConfigSchema.partial()
      .extend({
        weights: InsightScoreWeightsSchema.partial().optional(),
        grades: InsightScoreGradesSchema.partial().optional(),
      })
      .optional(),
    dependencies: InsightDependencyConfigSchema.partial()
      .extend({
        penalties: InsightDependencyPenaltiesSchema.partial().optional(),
        removalBonuses: InsightDependencyBonusesSchema.partial().optional(),
        offset: InsightDependencyOffsetSchema.partial().optional(),
      })
      .optional(),
    commit: InsightCommitConfigSchema.partial().optional(),
  })
  .optional();

const validate = (config: InsightsConfig): InsightsConfig => {
  const weightSum = Object.values(config.score.weights).reduce(
    (sum, weight) => sum + weight,
    0,
  );
  if (!Number.isFinite(weightSum) || weightSum <= 0) {
    throw new Error("insights.score.weights must sum to a positive value");
  }
  const grades = config.score.grades;
  if (!(grades.A >= grades.B && grades.B >= grades.C && grades.C >= grades.D)) {
    throw new Error(
      "insights.score.grades must be ordered A >= B >= C >= D (0-100)",
    );
  }
  return config;
};

/** Merge a partial patch over the defaults and validate the result. */
export function resolveInsightsConfig(value?: unknown): InsightsConfig {
  const merged = mergeDeep(DEFAULT_CONFIG.insights, value ?? {});
  return validate(InsightsConfigSchema.parse(merged));
}

/** Merge a patch into an already-resolved insights config. */
export function mergeInsightsConfig(
  base: InsightsConfig,
  patch?: unknown,
): InsightsConfig {
  return resolveInsightsConfig(mergeDeep(base, patch ?? {}));
}
