export type Style = "biome" | "functional";
export type Indent = number | "tab";
export type CommaStyle = "leading" | "trailing";
export type QuoteStyle = "double" | "single";
export type TrailingComma = "all" | "es5" | "none";
export interface FunctionalOptions {
  commaStyle: CommaStyle;
  objectValueIndent: number;
  arrayValueIndent: number;
  forceBlankLines: boolean;
  semicolons: boolean;
  maxInlineArrayItems: number;
}
export interface MetricsThresholds {
  maxCyclomatic: number;
  minFtaScore: number;
}
export interface MetricsOptions {
  excludeUnder: number;
  testCommand: string;
  thresholds: MetricsThresholds;
}
export interface McpOptions {
  codegraph: boolean;
  metrics: boolean;
}
export interface InsightBenchmarkTargets {
  minTestPassRate: number;
  maxCyclomaticDelta: number;
  minAvgFtaScoreDelta: number;
  maxHalsteadBugsDelta: number;
  maxTotalLinesDelta: number | null;
}
export interface InsightBenchmarkTolerance {
  testsPassRate: number;
  avgFtaScore: number;
  avgCyclomatic: number;
  halsteadBugs: number;
  totalLines: number;
}
export interface InsightBenchmarkConfig {
  baseline: string;
  targets: InsightBenchmarkTargets;
  tolerance: InsightBenchmarkTolerance;
}
export interface InsightScoreWeights {
  gate: number;
  fta: number;
  complexity: number;
  tests: number;
  trend: number;
  dependencies: number;
}
export interface InsightScoreGrades {
  A: number;
  B: number;
  C: number;
  D: number;
}
export interface InsightScoreConfig {
  weights: InsightScoreWeights;
  grades: InsightScoreGrades;
  missingDataCredit: number;
}
export interface InsightDependencyPenalties {
  runtime: number;
  dev: number;
  optional: number;
  peer: number;
}
export interface InsightDependencyBonuses {
  runtime: number;
  dev: number;
  optional: number;
  peer: number;
}
export interface InsightDependencyOffset {
  minLinesReduced: number;
  minCyclomaticReduced: number;
  bonusPerDependency: number;
}
export interface InsightDependencyConfig {
  manifests: string[];
  penalties: InsightDependencyPenalties;
  removalBonuses: InsightDependencyBonuses;
  offset: InsightDependencyOffset;
  allow: string[];
  deny: string[];
}
export interface InsightCommitConfig {
  requirePendingSnapshot: boolean;
  requireTestsPassing: boolean;
  requireGatePassing: boolean;
  maxChangedFiles: number;
  maxChangedLines: number;
  suggestSplit: boolean;
  dependencyChangesSeparate: boolean;
}
export interface InsightsConfig {
  benchmark: InsightBenchmarkConfig;
  score: InsightScoreConfig;
  dependencies: InsightDependencyConfig;
  commit: InsightCommitConfig;
}
export interface MaidConfig {
  style: Style;
  indent: Indent;
  lineWidth: number;
  semicolons: boolean;
  quoteStyle: QuoteStyle;
  trailingComma: TrailingComma;
  toArrow: boolean;
  biome: boolean;
  functional: FunctionalOptions;
  metrics: MetricsOptions;
  mcp: McpOptions;
  insights: InsightsConfig;
}
export interface FormatOptions {
  style?: Style;
  indent?: Indent;
  lineWidth?: number;
  semicolons?: boolean;
  quoteStyle?: QuoteStyle;
  trailingComma?: TrailingComma;
  toArrow?: boolean;
  biome?: boolean;
  filename?: string;
  typescript?: boolean;
  configPath?: string;
  functional?: Partial<FunctionalOptions>;
}
export interface ResolvedFormatOptions {
  style: Style;
  indent: Indent;
  lineWidth: number;
  semicolons: boolean;
  quoteStyle: QuoteStyle;
  trailingComma: TrailingComma;
  toArrow: boolean;
  biome: boolean;
  filename: string;
  typescript: boolean;
  configPath?: string;
  functional: FunctionalOptions;
}
export const DEFAULT_CONFIG: MaidConfig = {
  style: "biome",
  indent: 2,
  lineWidth: 80,
  semicolons: true,
  quoteStyle: "double",
  trailingComma: "all",
  toArrow: false,
  biome: true,
  functional: {
    commaStyle: "leading",
    objectValueIndent: 1,
    arrayValueIndent: 2,
    forceBlankLines: true,
    semicolons: true,
    maxInlineArrayItems: 3,
  },
  metrics: {
    excludeUnder: 0,
    testCommand: "bun run test",
    thresholds: { maxCyclomatic: 20, minFtaScore: 50 },
  },
  mcp: { codegraph: true, metrics: true },
  insights: {
    benchmark: {
      baseline: "previous",
      targets: {
        minTestPassRate: 1,
        maxCyclomaticDelta: 0,
        minAvgFtaScoreDelta: 0,
        maxHalsteadBugsDelta: 0,
        maxTotalLinesDelta: null,
      },
      tolerance: {
        testsPassRate: 0,
        avgFtaScore: 0.1,
        avgCyclomatic: 0.1,
        halsteadBugs: 0.01,
        totalLines: 0,
      },
    },
    score: {
      weights: {
        gate: 25,
        fta: 20,
        complexity: 15,
        tests: 25,
        trend: 10,
        dependencies: 5,
      },
      grades: { A: 90, B: 80, C: 70, D: 60 },
      missingDataCredit: 0.5,
    },
    dependencies: {
      manifests: ["package.json"],
      penalties: { runtime: 5, dev: 2, optional: 1, peer: 1 },
      removalBonuses: { runtime: 3, dev: 1, optional: 0.5, peer: 0.5 },
      offset: {
        minLinesReduced: 20,
        minCyclomaticReduced: 1,
        bonusPerDependency: 2,
      },
      allow: [],
      deny: [],
    },
    commit: {
      requirePendingSnapshot: true,
      requireTestsPassing: true,
      requireGatePassing: true,
      maxChangedFiles: 10,
      maxChangedLines: 300,
      suggestSplit: true,
      dependencyChangesSeparate: true,
    },
  },
};
