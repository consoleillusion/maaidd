import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { execFileSync } from "node:child_process";
import type { FtaFileMetric } from "./fta.ts";
import type { TestRunSummary } from "./test-runner.ts";
import type { MetricsThresholds } from "../types.ts";

const DB = "maaidd.db";
const PENDING = "__pending__";

export interface HistoryEntry {
  commit: string;
  timestamp: number;
  createdAt: string | null;
  tests: TestRunSummary | null;
  metrics: FtaFileMetric[];
  average: number | null;
  total: number;
}

export interface SnapshotAggregate {
  commit: string;
  shortSha: string;
  timestamp: number;
  totalFiles: number;
  totalLines: number;
  passing: number;
  failing: number;
  testsTotal: number | null;
  testsPassed: number | null;
  testsFailed: number | null;
  testsSkipped: number | null;
  avgCyclo: number;
  maxCyclo: number;
  avgFtaScore: number;
  avgHalsteadVolume: number;
  avgHalsteadDifficulty: number;
  totalHalsteadBugs: number;
}

export interface SaveSnapshotOptions {
  force?: boolean;
}

type Row = {
  commit: string;
  status: string;
  created_at: string;
  tests_json: string | null;
  fta_total: number;
  fta_average: number | null;
  fta_files_json: string;
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function normTests(v: unknown): TestRunSummary | null {
  if (!isObj(v)) return null;
  const t: TestRunSummary = {
    command: typeof v.command === "string" ? v.command : "",
    total: num(v.total),
    passed: num(v.passed),
    failed: num(v.failed),
    skipped: num(v.skipped),
    todo: num(v.todo),
    exitCode: num(v.exitCode) ?? 1,
  };
  if (typeof v.error === "string") t.error = v.error;
  return t;
}

const avg = (m: FtaFileMetric[]) => {
  const s = m.map((x) => x.fta_score).filter(Number.isFinite);
  return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
};
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sha = (c: string) => {
  const n = c.trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(n)) throw new Error(`Invalid git commit for metric snapshot: ${c}`);
  return n;
};

export function currentCommit(cwd = process.cwd()): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error("Cannot save metric snapshot: no git HEAD is available");
  }
}

function open(dir: string): Database {
  mkdirSync(dir, { recursive: true });
  const db = new Database(join(dir, DB));
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      "commit" TEXT PRIMARY KEY, status TEXT NOT NULL, schema_version INTEGER NOT NULL,
      created_at TEXT NOT NULL, tests_json TEXT, fta_total INTEGER NOT NULL,
      fta_average REAL, fta_files_json TEXT NOT NULL
    );
  `);
  // legacy import (non-destructive)
  const has = db.query('SELECT 1 FROM snapshots WHERE "commit"=$c');
  const put = db.transaction((items: { c: string; st: string; at: string; t: TestRunSummary | null; m: FtaFileMetric[] }[]) => {
    for (const i of items) {
      if (has.get({ $c: i.c })) continue;
      db.query(`INSERT INTO snapshots ("commit",status,schema_version,created_at,tests_json,fta_total,fta_average,fta_files_json)
        VALUES ($c,$s,1,$at,$t,$n,$a,$f)`).run({
        $c: i.c, $s: i.st, $at: i.at, $t: i.t ? JSON.stringify(i.t) : null,
        $n: i.m.length, $a: avg(i.m), $f: JSON.stringify(i.m),
      });
    }
  });
  const items: { c: string; st: string; at: string; t: TestRunSummary | null; m: FtaFileMetric[] }[] = [];
  for (const d of [dir, join(dir, "metric")]) {
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((x) => x.endsWith(".json"))) {
      let raw: unknown;
      try { raw = JSON.parse(readFileSync(join(d, f), "utf8")); } catch { continue; }
      const name = basename(f, ".json");
      const m = Array.isArray(raw) ? (raw as FtaFileMetric[]) : isObj(raw) && isObj(raw.fta) && Array.isArray(raw.fta.files) ? (raw.fta.files as FtaFileMetric[]) : null;
      if (!m) continue;
      const t = !Array.isArray(raw) && isObj(raw) ? normTests(raw.tests) : null;
      const at = !Array.isArray(raw) && isObj(raw) && typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString();
      if (name === ".pending") items.push({ c: PENDING, st: "pending", at, t, m });
      else if (/^[0-9a-f]{7,40}$/.test(name)) items.push({ c: name, st: "final", at, t, m });
    }
  }
  if (items.length) put(items);
  return db;
}

function upsert(db: Database, commit: string, status: "final" | "pending", metrics: FtaFileMetric[], tests: TestRunSummary | null, at = new Date().toISOString(), force = true) {
  const q = force
    ? `INSERT INTO snapshots ("commit",status,schema_version,created_at,tests_json,fta_total,fta_average,fta_files_json)
       VALUES ($c,$s,1,$at,$t,$n,$a,$f)
       ON CONFLICT("commit") DO UPDATE SET status=excluded.status,created_at=excluded.created_at,tests_json=excluded.tests_json,fta_total=excluded.fta_total,fta_average=excluded.fta_average,fta_files_json=excluded.fta_files_json`
    : `INSERT INTO snapshots ("commit",status,schema_version,created_at,tests_json,fta_total,fta_average,fta_files_json)
       VALUES ($c,$s,1,$at,$t,$n,$a,$f)`;
  db.query(q).run({ $c: commit, $s: status, $at: at, $t: tests ? JSON.stringify(tests) : null, $n: metrics.length, $a: avg(metrics), $f: JSON.stringify(metrics) });
}

function exists(db: Database, c: string) {
  const r = db.query('SELECT status FROM snapshots WHERE "commit"=$c').get({ $c: c }) as { status: string } | null;
  return r?.status === "final";
}

export function saveSnapshot(dir: string, commit: string, metrics: FtaFileMetric[], tests: TestRunSummary | null = null, opts: SaveSnapshotOptions = {}): string {
  const c = sha(commit), db = open(dir);
  try {
    if (!opts.force && exists(db, c)) throw new Error(`Metric snapshot already exists for commit ${c} (${join(dir, DB)})`);
    upsert(db, c, "final", metrics, tests);
    return `${join(dir, DB)}#${c}`;
  } finally { db.close(); }
}

export function savePendingSnapshot(dir: string, metrics: FtaFileMetric[], tests: TestRunSummary | null = null): string {
  const db = open(dir);
  try { upsert(db, PENDING, "pending", metrics, tests); return `${join(dir, DB)}#pending`; }
  finally { db.close(); }
}

export function finalizeSnapshot(dir: string, commit: string, opts: SaveSnapshotOptions = {}): string {
  const c = sha(commit), db = open(dir);
  try {
    const p = db.query('SELECT * FROM snapshots WHERE "commit"=$c').get({ $c: PENDING }) as Row | null;
    if (!p) throw new Error(`No pending metric snapshot found in ${join(dir, DB)}`);
    if (!opts.force && exists(db, c)) throw new Error(`Metric snapshot already exists for commit ${c} (${join(dir, DB)})`);
    const metrics = JSON.parse(p.fta_files_json) as FtaFileMetric[];
    const tests = p.tests_json ? normTests(JSON.parse(p.tests_json)) : null;
    db.transaction(() => {
      upsert(db, c, "final", metrics, tests, p.created_at);
      db.query('DELETE FROM snapshots WHERE "commit"=$c').run({ $c: PENDING });
    })();
    return `${join(dir, DB)}#${c}`;
  } finally { db.close(); }
}

export function aggregateSnapshot(metrics: FtaFileMetric[], thresholds: MetricsThresholds, tests: TestRunSummary | null = null): SnapshotAggregate {
  const cyclos = metrics.map((m) => m.cyclo ?? 0);
  let passing = 0;
  for (const m of metrics) if (m.cyclo <= thresholds.maxCyclomatic && m.fta_score >= thresholds.minFtaScore) passing++;
  return {
    commit: "", shortSha: "", timestamp: 0,
    totalFiles: metrics.length,
    totalLines: metrics.reduce((s, m) => s + (m.line_count ?? 0), 0),
    passing, failing: metrics.length - passing,
    testsTotal: tests?.total ?? null, testsPassed: tests?.passed ?? null,
    testsFailed: tests?.failed ?? null, testsSkipped: tests?.skipped ?? null,
    avgCyclo: mean(cyclos), maxCyclo: cyclos.length ? Math.max(...cyclos) : 0,
    avgFtaScore: mean(metrics.map((m) => m.fta_score ?? 0)),
    avgHalsteadVolume: mean(metrics.map((m) => m.halstead?.volume ?? 0)),
    avgHalsteadDifficulty: mean(metrics.map((m) => m.halstead?.difficulty ?? 0)),
    totalHalsteadBugs: metrics.reduce((s, m) => s + (m.halstead?.bugs ?? 0), 0),
  };
}

function tsOf(c: string): number {
  try {
    const n = Number(execFileSync("git", ["show", "-s", "--format=%ct", c], { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim());
    return Number.isFinite(n) ? n * 1000 : 0;
  } catch { return 0; }
}

export function readHistory(dir = ".", _thresholds?: MetricsThresholds): HistoryEntry[] {
  if (!existsSync(dir)) return [];
  const db = open(dir);
  try {
    const rows = db.query('SELECT * FROM snapshots WHERE status=\'final\' AND "commit"!=$p').all({ $p: PENDING }) as Row[];
    const entries = rows.filter((r) => /^[0-9a-f]{7,40}$/.test(r.commit)).map((r) => {
      const metrics = JSON.parse(r.fta_files_json) as FtaFileMetric[];
      return {
        commit: r.commit, timestamp: tsOf(r.commit), createdAt: r.created_at ?? null,
        tests: r.tests_json ? normTests(JSON.parse(r.tests_json)) : null,
        metrics, average: r.fta_average ?? avg(metrics), total: r.fta_total ?? metrics.length,
      };
    });
    entries.sort((a, b) => (a.timestamp && b.timestamp ? a.timestamp - b.timestamp : a.timestamp ? -1 : b.timestamp ? 1 : a.commit.localeCompare(b.commit)));
    return entries;
  } finally { db.close(); }
}

export function readAggregatedHistory(dir = ".", thresholds: MetricsThresholds): SnapshotAggregate[] {
  return readHistory(dir).map((e) => ({ ...aggregateSnapshot(e.metrics, thresholds, e.tests), commit: e.commit, shortSha: e.commit.slice(0, 8), timestamp: e.timestamp }));
}
