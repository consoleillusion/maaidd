/**
 * TOON (Token-Oriented Object Notation) encoding for metrics output.
 */
import { encode } from "@toon-format/toon";
import type { FtaResult } from "./fta.ts";

export function metricsToToon(result: FtaResult): string {
  return encode({
    average: result.average,
    total: result.total,
    files: result.metrics.map((m) => ({
      file: m.file_name,
      cyclo: m.cyclo,
      fta_score: m.fta_score,
      assessment: m.assessment,
      line_count: m.line_count,
    })),
  });
}
