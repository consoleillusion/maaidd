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
  /** Per-test results for this snapshot (every snapshot when collected). */
  testResults?: TestCaseResult[];
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

export interface ReadHistoryOptions {
  includePending?: boolean;
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

function normResult(r: unknown): TestCaseResult | null {
  if (!isObj(r) || typeof r.name !== "string") return null;
  const status = r.status === "fail" || r.status === "skip" || r.status === "todo" ? r.status : "pass";
  return {
    suite: typeof r.suite === "string" ? r.suite : typeof r.classname === "string" ? r.classname : "",
    name: r.name,
    file: typeof r.file === "string" ? r.file : "",
    status,
    durationMs: num(r.durationMs),
    ...(typeof r.error === "string" && r.error ? { error: r.error } : {}),
  };
}

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
  if (Array.isArray(v.results)) {
    const results = v.results.map(normResult).filter((x): x is TestCaseResult => x !== null);
    if (results.length) t.results = results;
  }
  if (v.resultsDetail === "full" || v.resultsDetail === "counts-only") t.resultsDetail = v.resultsDetail;
  return t;
}

const avg = (m: FtaFileMetric[]) => {
  const s = m.map((x) => x.fta_score).filter(Number.isFinite);
  return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
};
const mean = (a: number[]) =>
  a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const sha = (c: string) => {
  const n = c.trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(n))
    throw new Error(`Invalid git commit for metric snapshot: ${c}`);
  return n;
};

export function currentCommit(cwd = process.cwd()): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error("Cannot save metric snapshot: no git HEAD is available");
  }
}

function ensureTestSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file TEXT NOT NULL DEFAULT '',
      suite TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      UNIQUE(file, suite, name)
    );
    CREATE TABLE IF NOT EXISTS snapshot_tests (
      snapshot_commit TEXT NOT NULL,
      test_case_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      duration_ms INTEGER,
      error TEXT,
      PRIMARY KEY (snapshot_commit, test_case_id)
    );
    CREATE INDEX IF NOT EXISTS idx_snapshot_tests_commit ON snapshot_tests(snapshot_commit);
  `);
}

function saveTestResults(db: Database, commit: string, tests: TestRunSummary | null) {
  db.query("DELETE FROM snapshot_tests WHERE snapshot_commit=$c").run({ $c: commit });
  if (!tests?.results?.length) return;
  const getCase = db.query("SELECT id FROM test_cases WHERE file=$f AND suite=$s AND name=$n");
  const putCase = db.query("INSERT OR IGNORE INTO test_cases (file,suite,name) VALUES ($f,$s,$n)");
  const putResult = db.query("INSERT OR REPLACE INTO snapshot_tests (snapshot_commit,test_case_id,status,duration_ms,error) VALUES ($c,$id,$st,$d,$e)");
  const tx = db.transaction((results: TestCaseResult[]) => {
    for (const r of results) {
      const file = r.file ?? "", suite = r.suite ?? "", name = r.name ?? "";
      putCase.run({ $f: file, $s: suite, $n: name });
      const row = getCase.get({ $f: file, $s: suite, $n: name }) as { id: number } | null;
      if (!row) continue;
      putResult.run({ $c: commit, $id: row.id, $st: r.status, $d: r.durationMs ?? null, $e: r.error ?? null });
    }
  });
  tx(tests.results);
}

function loadTestResults(db: Database, commit: string): TestCaseResult[] | undefined {
  try {
    const rows = db.query(
      `SELECT tc.file, tc.suite, tc.name, st.status, st.duration_ms, st.error
       FROM snapshot_tests st JOIN test_cases tc ON tc.id = st.test_case_id
       WHERE st.snapshot_commit=$c ORDER BY tc.file, tc.suite, tc.name`,
    ).all({ $c: commit }) as any[];
    if (!rows.length) return undefined;
    return rows.map((r) => ({
      file: r.file ?? "",
      suite: r.suite ?? "",
      name: r.name ?? "",
      status: (r.status === "fail" || r.status === "skip" || r.status === "todo" ? r.status : "pass") as any,
      durationMs: typeof r.duration_ms === "number" ? r.duration_ms : null,
      ...(r.error ? { error: String(r.error) } : {}),
    }));
  } catch {
    return undefined;
  }
}

function moveTestResults(db: Database, from: string, to: string) {
  try {
    db.query("DELETE FROM snapshot_tests WHERE snapshot_commit=$to").run({ $to: to });
    db.query("UPDATE snapshot_tests SET snapshot_commit=$to WHERE snapshot_commit=$from").run({ $from: from, $to: to });
  } catch {}
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
  ensureTestSchema(db);
  // legacy import (non-destructive)
  const has = db.query('SELECT 1 FROM snapshots WHERE "commit"=$c');
  const put = db.transaction(
    (
      items: {
        c: string;
        st: string;
        at: string;
        t: TestRunSummary | null;
        m: FtaFileMetric[];
      }[],
    ) => {
      for (const i of items) {
        if (has.get({ $c: i.c })) continue;
        db.query(`INSERT INTO snapshots ("commit",status,schema_version,created_at,tests_json,fta_total,fta_average,fta_files_json)
        VALUES ($c,$s,1,$at,$t,$n,$a,$f)`).run({
          $c: i.c,
          $s: i.st,
          $at: i.at,
          $t: i.t ? JSON.stringify(i.t) : null,
          $n: i.m.length,
          $a: avg(i.m),
          $f: JSON.stringify(i.m),
        });
      }
    },
  );
  const items: {
    c: string;
    st: string;
    at: string;
    t: TestRunSummary | null;
    m: FtaFileMetric[];
  }[] = [];
  for (const d of [dir, join(dir, "metric")]) {
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((x) => x.endsWith(".json"))) {
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(join(d, f), "utf8"));
      } catch {
        continue;
      }
      const name = basename(f, ".json");
      const m = Array.isArray(raw)
        ? (raw as FtaFileMetric[])
        : isObj(raw) && isObj(raw.fta) && Array.isArray(raw.fta.files)
          ? (raw.fta.files as FtaFileMetric[])
          : null;
      if (!m) continue;
      const t = !Array.isArray(raw) && isObj(raw) ? normTests(raw.tests) : null;
      const at =
        !Array.isArray(raw) && isObj(raw) && typeof raw.createdAt === "string"
          ? raw.createdAt
          : new Date().toISOString();
      if (name === ".pending")
        items.push({ c: PENDING, st: "pending", at, t, m });
      else if (/^[0-9a-f]{7,40}$/.test(name))
        items.push({ c: name, st: "final", at, t, m });
    }
  }
  if (items.length) put(items);
  return db;
}

function upsert(
  db: Database,
  commit: string,
  status: "final" | "pending",
  metrics: FtaFileMetric[],
  tests: TestRunSummary | null,
  at = new Date().toISOString(),
  force = true,
) {
  const q = force
    ? `INSERT INTO snapshots ("commit",status,schema_version,created_at,tests_json,fta_total,fta_average,fta_files_json)
       VALUES ($c,$s,1,$at,$t,$n,$a,$f)
       ON CONFLICT("commit") DO UPDATE SET status=excluded.status,created_at=excluded.created_at,tests_json=excluded.tests_json,fta_total=excluded.fta_total,fta_average=excluded.fta_average,fta_files_json=excluded.fta_files_json`
    : `INSERT INTO snapshots ("commit",status,schema_version,created_at,tests_json,fta_total,fta_average,fta_files_json)
       VALUES ($c,$s,1,$at,$t,$n,$a,$f)`;
  db.query(q).run({
    $c: commit,
    $s: status,
    $at: at,
    $t: tests ? JSON.stringify(tests) : null,
    $n: metrics.length,
    $a: avg(metrics),
    $f: JSON.stringify(metrics),
  });
  saveTestResults(db, commit, tests);
}

function exists(db: Database, c: string) {
  const r = db
    .query('SELECT status FROM snapshots WHERE "commit"=$c')
    .get({ $c: c }) as { status: string } | null;
  return r?.status === "final";
}

export function saveSnapshot(
  dir: string,
  commit: string,
  metrics: FtaFileMetric[],
  tests: TestRunSummary | null = null,
  opts: SaveSnapshotOptions = {},
): string {
  const c = sha(commit),
    db = open(dir);
  try {
    if (!opts.force && exists(db, c))
      throw new Error(
        `Metric snapshot already exists for commit ${c} (${join(dir, DB)})`,
      );
    upsert(db, c, "final", metrics, tests);
    return `${join(dir, DB)}#${c}`;
  } finally {
    db.close();
  }
}

export function savePendingSnapshot(
  dir: string,
  metrics: FtaFileMetric[],
  tests: TestRunSummary | null = null,
): string {
  const db = open(dir);
  try {
    upsert(db, PENDING, "pending", metrics, tests);
    return `${join(dir, DB)}#pending`;
  } finally {
    db.close();
  }
}

export function finalizeSnapshot(
  dir: string,
  commit: string,
  opts: SaveSnapshotOptions = {},
): string {
  const c = sha(commit),
    db = open(dir);
  try {
    const p = db
      .query('SELECT * FROM snapshots WHERE "commit"=$c')
      .get({ $c: PENDING }) as Row | null;
    if (!p)
      throw new Error(`No pending metric snapshot found in ${join(dir, DB)}`);
    if (!opts.force && exists(db, c))
      throw new Error(
        `Metric snapshot already exists for commit ${c} (${join(dir, DB)})`,
      );
    const metrics = JSON.parse(p.fta_files_json) as FtaFileMetric[];
    const tests = p.tests_json ? normTests(JSON.parse(p.tests_json)) : null;
    const pendingResults = loadTestResults(db, PENDING);
    if (pendingResults?.length && tests) tests.results = pendingResults;
    db.transaction(() => {
      upsert(db, c, "final", metrics, tests, p.created_at);
      moveTestResults(db, PENDING, c);
      db.query('DELETE FROM snapshots WHERE "commit"=$c').run({ $c: PENDING });
    })();
    return `${join(dir, DB)}#${c}`;
  } finally {
    db.close();
  }
}

export function aggregateSnapshot(
  metrics: FtaFileMetric[],
  thresholds: MetricsThresholds,
  tests: TestRunSummary | null = null,
): SnapshotAggregate {
  const cyclos = metrics.map((m) => m.cyclo ?? 0);
  let passing = 0;
  for (const m of metrics)
    if (
      m.cyclo <= thresholds.maxCyclomatic &&
      m.fta_score >= thresholds.minFtaScore
    )
      passing++;
  return {
    commit: "",
    shortSha: "",
    timestamp: 0,
    totalFiles: metrics.length,
    totalLines: metrics.reduce((s, m) => s + (m.line_count ?? 0), 0),
    passing,
    failing: metrics.length - passing,
    testsTotal: tests?.total ?? null,
    testsPassed: tests?.passed ?? null,
    testsFailed: tests?.failed ?? null,
    testsSkipped: tests?.skipped ?? null,
    avgCyclo: mean(cyclos),
    maxCyclo: cyclos.length ? Math.max(...cyclos) : 0,
    avgFtaScore: mean(metrics.map((m) => m.fta_score ?? 0)),
    avgHalsteadVolume: mean(metrics.map((m) => m.halstead?.volume ?? 0)),
    avgHalsteadDifficulty: mean(
      metrics.map((m) => m.halstead?.difficulty ?? 0),
    ),
    totalHalsteadBugs: metrics.reduce((s, m) => s + (m.halstead?.bugs ?? 0), 0),
  };
}

function tsOf(c: string): number {
  try {
    const n = Number(
      execFileSync("git", ["show", "-s", "--format=%ct", c], {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      }).trim(),
    );
    return Number.isFinite(n) ? n * 1000 : 0;
  } catch {
    return 0;
  }
}

function rowToEntry(db: Database, r: Row, commitOverride?: {commit:string,timestamp:number,shortSha?:string}): HistoryEntry & {shortSha?:string} {
  const metrics = JSON.parse(r.fta_files_json) as FtaFileMetric[];
  const tests = r.tests_json ? normTests(JSON.parse(r.tests_json)) : null;
  const results = loadTestResults(db, r.commit);
  if (results?.length && tests) { tests.results = results; tests.resultsDetail = "full"; }
  const commit = commitOverride?.commit ?? r.commit;
  const timestamp = commitOverride?.timestamp ?? tsOf(r.commit);
  return {
    commit,
    timestamp,
    createdAt: r.created_at ?? null,
    tests,
    metrics,
    average: r.fta_average ?? avg(metrics),
    total: r.fta_total ?? metrics.length,
    ...(commitOverride?.shortSha ? { shortSha: commitOverride.shortSha } : {}),
  };
}

export function readHistory(
  dir = ".",
  _thresholdsOrOpts?: MetricsThresholds | ReadHistoryOptions,
  opts?: ReadHistoryOptions,
): HistoryEntry[] {
  const includePending = (opts ?? (isObj(_thresholdsOrOpts) && ("includePending" in (_thresholdsOrOpts as any)) ? (_thresholdsOrOpts as ReadHistoryOptions) : undefined))?.includePending === true;
  if (!existsSync(dir)) return [];
  const db = open(dir);
  try {
    const rows = db
      .query("SELECT * FROM snapshots WHERE status='final' AND \"commit\"!=$p")
      .all({ $p: PENDING }) as Row[];
    const entries = rows
      .filter((r) => /^[0-9a-f]{7,40}$/.test(r.commit))
      .map((r) => rowToEntry(db, r));
    entries.sort((a, b) =>
      a.timestamp && b.timestamp
        ? a.timestamp - b.timestamp
        : a.timestamp
          ? -1
          : b.timestamp
            ? 1
            : a.commit.localeCompare(b.commit),
    );
    if (includePending) {
      const p = db.query('SELECT * FROM snapshots WHERE "commit"=$c').get({ $c: PENDING }) as Row | null;
      if (p) {
        const pt = Date.parse(p.created_at);
        const timestamp = Number.isFinite(pt) ? pt : Date.now();
        entries.push(rowToEntry(db, p, { commit: PENDING, timestamp, shortSha: "current" }));
      }
    }
    return entries;
  } finally {
    db.close();
  }
}

export function readAggregatedHistory(
  dir = ".",
  thresholds: MetricsThresholds,
  opts?: ReadHistoryOptions,
): SnapshotAggregate[] {
  return readHistory(dir, thresholds, opts).map((e: any) => ({
    ...aggregateSnapshot(e.metrics, thresholds, e.tests),
    commit: e.commit,
    shortSha: e.shortSha ?? e.commit.slice(0, 8),
    timestamp: e.timestamp,
    ...(e.tests?.results?.length ? { testResults: e.tests.results } : {}),
  }));
}
