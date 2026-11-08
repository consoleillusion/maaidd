/**
 * Metrics gate — enforce thresholds; exit non-zero on violations.
 */
import type { FtaResult, FtaFileMetric } from "./fta.ts";
import type { MetricsThresholds } from "../types.ts";

export interface GateViolation {
  file: string;
  metric: string;
  value: number;
  threshold: number;
  message: string;
}

export function checkGate(
  result: FtaResult,
  thresholds: MetricsThresholds,
): GateViolation[] {
  const violations: GateViolation[] = [];

  for (const m of result.metrics) {
    if (m.cyclo > thresholds.maxCyclomatic) {
      violations.push({
        file: m.file_name,
        metric: "cyclomatic",
        value: m.cyclo,
        threshold: thresholds.maxCyclomatic,
        message: `${m.file_name}: cyclomatic complexity ${m.cyclo} > ${thresholds.maxCyclomatic}`,
      });
    }
    if (m.fta_score < thresholds.minFtaScore) {
      violations.push({
        file: m.file_name,
        metric: "fta_score",
        value: m.fta_score,
        threshold: thresholds.minFtaScore,
        message: `${m.file_name}: FTA score ${m.fta_score} < ${thresholds.minFtaScore}`,
      });
    }
  }

  return violations;
}