/** Public insight API shared by the CLI and MCP server. */
export { resolveInsightsConfig, mergeInsightsConfig } from "./config.ts";
export { loadInsightState, readWorkingTree } from "./state.ts";
export type {
  InsightState,
  SnapshotPoint,
  SnapshotSource,
  WorkingTreeFile,
  WorkingTreeState,
} from "./state.ts";
export { getStatus } from "./status.ts";
export type { StatusOptions } from "./status.ts";
export { getBenchmark, buildBenchmark } from "./benchmark.ts";
export type { BenchmarkOptions } from "./benchmark.ts";
export { getDependencies, buildDependencies } from "./dependencies.ts";
export type {
  DependencyChange,
  DependencyOptions,
  DependencyScope,
} from "./dependencies.ts";
export { getScore, buildScore } from "./score.ts";
export type { ScoreOptions } from "./score.ts";
export { getCommitGuide, buildCommitGuide } from "./commit.ts";
export type { CommitGuideOptions } from "./commit.ts";
export { renderInsight } from "./render.ts";
export type { InsightFormat } from "./render.ts";
