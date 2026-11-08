/**
 * HTML report — one uPlot line chart of project measurements per git commit.
 *
 * X = commits in chronological order. Y lines include actual test-runner
 * counts, FTA gate file counts, lines of code, and FTA complexity measures.
 * Missing test data in legacy snapshots is represented by null gaps, not zero.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { loadConfig } from "../config.ts";
import { readAggregatedHistory, type SnapshotAggregate } from "./history.ts";

const require = createRequire(import.meta.url);

function loadUplotJs(): string {
  try {
    const pkgPath = require.resolve("uplot/package.json");
    const candidate = join(dirname(pkgPath), "dist", "uPlot.iife.min.js");
    return readFileSync(candidate, "utf8");
  } catch {
    return '<script src="https://cdn.jsdelivr.net/npm/uplot@1.6.32/dist/uPlot.iife.min.js"></script>';
  }
}

function loadUplotCss(): string {
  try {
    const pkgPath = require.resolve("uplot/package.json");
    const candidate = join(dirname(pkgPath), "dist", "uPlot.min.css");
    return readFileSync(candidate, "utf8");
  } catch {
    return "";
  }
}

type SeriesKey =
  | "testsTotal"
  | "testsPassed"
  | "testsFailed"
  | "testsSkipped"
  | "passing"
  | "failing"
  | "totalFiles"
  | "avgCyclo"
  | "maxCyclo"
  | "avgFtaScore"
  | "avgHalsteadDifficulty"
  | "totalLines"
  | "avgHalsteadVolume"
  | "totalHalsteadBugs";

const series: { key: SeriesKey; label: string; stroke: string; scale: string }[] = [
  { key: "testsTotal", label: "Tests", stroke: "#64748b", scale: "y" },
  { key: "testsPassed", label: "Passing tests", stroke: "#22c55e", scale: "y" },
  { key: "testsFailed", label: "Failing tests", stroke: "#ef4444", scale: "y" },
  { key: "testsSkipped", label: "Skipped tests", stroke: "#94a3b8", scale: "y" },
  { key: "passing", label: "Files passing gate", stroke: "#15803d", scale: "y" },
  { key: "failing", label: "Files failing gate", stroke: "#b91c1c", scale: "y" },
  { key: "totalFiles", label: "Files", stroke: "#a855f7", scale: "y" },
  { key: "avgCyclo", label: "Avg cyclo", stroke: "#f97316", scale: "y" },
  { key: "maxCyclo", label: "Max cyclo", stroke: "#c2410c", scale: "y" },
  { key: "avgFtaScore", label: "Avg FTA score", stroke: "#3b82f6", scale: "y2" },
  { key: "avgHalsteadDifficulty", label: "Avg Halstead difficulty", stroke: "#14b8a6", scale: "y2" },
  { key: "totalHalsteadBugs", label: "Halstead bugs", stroke: "#ec4899", scale: "y2" },
  { key: "totalLines", label: "Lines of code", stroke: "#0ea5e9", scale: "y3" },
  { key: "avgHalsteadVolume", label: "Avg Halstead volume", stroke: "#eab308", scale: "y3" },
];

function chartValue(snapshot: SnapshotAggregate, key: SeriesKey): number | null {
  const value = snapshot[key];
  return value === null ? null : Number(value ?? 0);
}

export function generateReport(metricDir = "."): string {
  const config = loadConfig();
  const snapshots = readAggregatedHistory(metricDir, config.metrics.thresholds);

  if (snapshots.length === 0) {
    return "<!DOCTYPE html>\n<html><body><p>No metric history found (<code>maaidd.db</code>).</p></body></html>";
  }

  const labels = snapshots.map((s) => s.shortSha);
  const x = snapshots.map((_, i) => i);
  const values = series.map((s) => snapshots.map((snap) => chartValue(snap, s.key)));
  const uplotJs = loadUplotJs();
  const uplotCss = loadUplotCss();
  const tableRows = buildTableRows(snapshots);

  const dataJson = JSON.stringify({
    labels,
    series: series.map((s) => ({ label: s.label, stroke: s.stroke, scale: s.scale })),
    values,
    x,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MAAIDD — Metric History</title>
<style>
${uplotCss}
body { font-family: system-ui, -apple-system, sans-serif; margin: 2rem; background: #fafafa; color: #222; }
h1 { font-size: 1.4rem; }
h2 { font-size: 1.1rem; margin-top: 2rem; }
.uplot { width: 100%; max-width: 1100px; }
table { border-collapse: collapse; width: 100%; max-width: 1100px; }
th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #ddd; }
th { font-weight: 600; }
.code { font-family: monospace; }
.legend { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0.5rem 0 1rem; font-size: 0.9rem; }
.legend span { display: inline-flex; align-items: center; gap: 0.3rem; }
.legend i { display: inline-block; width: 1rem; height: 0.25rem; border-radius: 2px; }
</style>
</head>
<body>
<h1>MAAIDD — Metric History</h1>
<p>${snapshots.length} snapshots from <code>maaidd.db</code> · x-axis: git commits in chronological order</p>

<div class="legend" id="legend"></div>
<div id="chart"></div>

<h2>Latest snapshot: <span class="code">${snapshots[snapshots.length - 1].shortSha}</span></h2>
<table>
<thead><tr><th>Commit</th><th>Tests passed</th><th>Tests failed</th><th>Files</th><th>Lines</th><th>Gate passing</th><th>Gate failing</th><th>Avg cyclo</th><th>Max cyclo</th><th>Avg FTA</th></tr></thead>
<tbody>
${tableRows}
</tbody>
</table>

<script>
${uplotJs}
</script>
<script>
const payload = ${dataJson};
const labels = payload.labels;
const x = payload.x;
const series = payload.series;
const values = payload.values;

const chartData = [x, ...values];

const uSeries = [
  {},
  ...series.map((s) => ({
    label: s.label,
    stroke: s.stroke,
    width: 2,
    points: { show: true, size: 4 },
    scale: s.scale,
  })),
];

const uScales = {
  y: { range: (u, min, max) => [Math.floor(min), Math.ceil(max)] },
  y2: { range: (u, min, max) => [Math.floor(min), Math.ceil(max)] },
  y3: { range: (u, min, max) => [Math.floor(min), Math.ceil(max)] },
};

const uAxes = [
  {
    grid: { show: false },
    rotate: -45,
    values: (u, splits) => splits.map((i) => labels[i] ?? ""),
  },
  { scale: "y", side: 3, label: "tests / files / cyclo" },
  { scale: "y2", side: 1, label: "FTA / Halstead" },
  { scale: "y3", side: 1, label: "lines / volume" },
];

const opts = {
  width: 1100,
  height: 480,
  series: uSeries,
  scales: uScales,
  axes: uAxes,
  legend: { show: false },
};

new uPlot(opts, chartData, document.getElementById("chart"));

// Build the legend manually (we disabled uPlot's built-in legend).
const legend = document.getElementById("legend");
for (const s of series) {
  const item = document.createElement("span");
  const swatch = document.createElement("i");
  swatch.style.background = s.stroke;
  item.appendChild(swatch);
  item.appendChild(document.createTextNode(s.label));
  legend.appendChild(item);
}
</script>
</body>
</html>`;
}

function testCount(value: number | null): string {
  return value === null ? "n/a" : String(value);
}

function buildTableRows(snapshots: SnapshotAggregate[]): string {
  return snapshots
    .map(
      (s) =>
        `      <tr><td class="code">${s.shortSha}</td><td>${testCount(s.testsPassed)}${s.testsTotal === null ? "" : ` / ${s.testsTotal}`}</td><td>${testCount(s.testsFailed)}</td><td>${s.totalFiles}</td><td>${s.totalLines}</td><td>${s.passing}</td><td>${s.failing}</td><td>${s.avgCyclo.toFixed(1)}</td><td>${s.maxCyclo}</td><td>${s.avgFtaScore.toFixed(1)}</td></tr>`,
    )
    .join("\n");
}
