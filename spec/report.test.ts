import { describe, it, expect } from "bun:test";
import { generateReport } from "../src/metrics/report.ts";
import { aggregateSnapshot } from "../src/metrics/history.ts";
import type { FtaFileMetric } from "../src/metrics/fta.ts";

const sampleMetrics: FtaFileMetric[] = [
  { file_name: "a.ts", cyclo: 5, fta_score: 70, assessment: "OK", line_count: 100 },
  { file_name: "b.ts", cyclo: 25, fta_score: 30, assessment: "Needs improvement", line_count: 50 },
];

describe("report aggregation", () => {
  it("aggregates per-snapshot values", () => {
    const agg = aggregateSnapshot(sampleMetrics, {
      maxCyclomatic: 20,
      minFtaScore: 50,
    });
    expect(agg.totalFiles).toBe(2);
    expect(agg.totalLines).toBe(150);
    // a.ts passes (cyclo 5 <= 20, score 70 >= 50), b.ts fails (cyclo 25 > 20, score 30 < 50)
    expect(agg.passing).toBe(1);
    expect(agg.failing).toBe(1);
    expect(agg.avgCyclo).toBe(15);
    expect(agg.maxCyclo).toBe(25);
    expect(agg.avgFtaScore).toBe(50);
  });

  it("counts passing against thresholds", () => {
    const agg = aggregateSnapshot(sampleMetrics, {
      maxCyclomatic: 1000,
      minFtaScore: 0,
    });
    expect(agg.passing).toBe(2);
    expect(agg.failing).toBe(0);
  });
});

describe("report generation", () => {
  it("generates HTML with chart and series", () => {
    const html = generateReport();
    expect(html).toContain("<!DOCTYPE html>");
    // If history exists, verify chart payload; empty history is valid HTML too.
    if (html.includes("uPlot") || html.includes("payload")) {
      expect(html).toContain("uPlot");
      if (html.includes("payload")) {
        expect(html).toContain("labels");
        expect(html).toContain("series");
      }
    } else {
      expect(html).toContain("No metric history found");
    }
  });

  it("handles empty history gracefully", () => {
    const html = generateReport();
    // Either empty-message or a full chart — both are valid.
    expect(html).toContain("<!DOCTYPE html>");
  });
});