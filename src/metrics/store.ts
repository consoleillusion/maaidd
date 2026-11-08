/**
 * SQLite-backed metrics snapshot store (embedded, Bun sqlite).
 *
 * Replaces per-commit JSON files with `metric/maaidd.db`. Legacy
 * `metric/<commit>.json` and `.pending.json` files are imported
 * automatically (non-destructively) when present.
 */
import { Database } from "bun:sqlite";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { execFileSync } from "node:child_process";
import type { FtaFileMetric } from "./fta.ts";
import type { TestRunSummary } from "./test-runner.ts";
import type { MetricsThresholds } from "../types.ts";

export const SNAPSHOT_SCHEMA_VERSION = 1;
export const DB_FILENAME = "maaidd.db";
/** Legacy pending filename; pending state is stored in the DB. */
export const PENDING_SNAPSHOT = ".pending.json";
const PENDING_COMMIT = "__pending__";

export interface ProjectSnapshot {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  commit: string;
  createdAt: string;
  tests: TestRunSummary | null;
  fta: {
    total: number;
    average: number | null;
    files: FtaFileMetric[];
  };
}

export interface HistoryEntry {
  commit: string;
  timestamp: number;
  createdAt: string | null;
  tests: TestRunSummary | null;
  metrics: FtaFileMetric[];
  average: number | null;
  total: number;
}

/** Aggregated values for a single snapshot, used by the report chart. */
export interface SnapshotAggregate {
  commit: string;
  shortSha: string;
  timestamp: number;
  totalFiles: number;
  totalLines: number;
  /** Source files passing/failing the FTA gate (not test-runner counts). */
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
  /** Replace an existing snapshot for the same commit. */
  force?: boolean;
}

interface SnapshotRow {
  commit: string;
  status: string;
  schema_version: number;
  created_at: string;
  tests_json: string | null;
  fta_total: number;
  fta_average: number | null;
  fta_files_json: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeTests(value: unknown): TestRunSummary | null {
  if (!isRecord(value)) return null;
  const summary: TestRunSummary = {
    command: typeof value.command === "string" ? value.command : "",
    total: nullableNumber(value.total),
    passed: nullableNumber(value.passed),
    failed: nullableNumber(value.failed),
    skipped: nullableNumber(value.skipped),
    todo: nullableNumber(value.todo),
    exitCode: nullableNumber(value.exitCode) ?? 1,
  };
  if (typeof value.error === "string") summary.error = value.error;
  return summary;
}

function averageScore(metrics: FtaFileMetric[]): number | null {
  const scores = metrics.map((m) => m.fta_score).filter(Number.isFinite);
  return scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;
}

function makeSnapshot(
  commit: string,
  metrics: FtaFileMetric[],
  tests: TestRunSummary | null,
  createdAt = new Date().toISOString(),
): ProjectSnapshot {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    commit,
    createdAt,
    tests,
    fta: {
      total: metrics.length,
      average: averageScore(metrics),
      files: metrics,
    },
  };
}

function validateCommit(commit: string): string {
  const normalized = commit.trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(normalized)) {
    throw new Error(`Invalid git commit for metric snapshot: ${commit}`);
  }
  return normalized;
}

/** Resolve the current commit; snapshots are never saved under "unknown". */
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

function dbPath(dir: string): string {
  return join(dir, DB_FILENAME);
}

function ensureSchema(db: Database): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS snapshots (
      "commit" TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'final',
      schema_version INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      tests_json TEXT,
      fta_total INTEGER NOT NULL,
      fta_average REAL,
      fta_files_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS snapshots_status_idx ON snapshots(status);
  `);
}

function parseHistoryFile(raw: unknown): {
  metrics: FtaFileMetric[];
  tests: TestRunSummary | null;
  createdAt: string | null;
} | undefined {
  if (Array.isArray(raw)) {
    return { metrics: raw as FtaFileMetric[], tests: null, createdAt: null };
  }
  if (!isRecord(raw) || !isRecord(raw.fta) || !Array.isArray(raw.fta.files)) {
    return undefined;
  }
  return {
    metrics: raw.fta.files as FtaFileMetric[],
    tests: normalizeTests(raw.tests),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : null,
  };
}

function insertSnapshot(
  db: Database,
  commit: string,
  status: "final" | "pending",
  snapshot: ProjectSnapshot,
  force: boolean,
): void {
  const sql = force
    ? `INSERT INTO snapshots ("commit", status, schema_version, created_at, tests_json, fta_total, fta_average, fta_files_json)
       VALUES ($commit, $status, $schema_version, $created_at, $tests_json, $fta_total, $fta_average, $fta_files_json)
       ON CONFLICT("commit") DO UPDATE SET
         status=excluded.status,
         schema_version=excluded.schema_version,
         created_at=excluded.created_at,
         tests_json=excluded.tests_json,
         fta_total=excluded.fta_total,
         fta_average=excluded.fta_average,
         fta_files_json=excluded.fta_files_json`
    : `INSERT INTO snapshots ("commit", status, schema_version, created_at, tests_json, fta_total, fta_average, fta_files_json)
       VALUES ($commit, $status, $schema_version, $created_at, $tests_json, $fta_total, $fta_average, $fta_files_json)`;
  db.query(sql).run({
    $commit: commit,
    $status: status,
    $schema_version: snapshot.schemaVersion,
    $created_at: snapshot.createdAt,
    $tests_json: snapshot.tests ? JSON.stringify(snapshot.tests) : null,
    $fta_total: snapshot.fta.total,
    $fta_average: snapshot.fta.average,
    $fta_files_json: JSON.stringify(snapshot.fta.files),
  });
}

function importLegacyFiles(db: Database, dir: string): void {
  const dirs = [dir, join(dir, "metric")].filter((d) => existsSync(d));
  let files: { path: string; name: string }[] = [];
  for (const d of dirs) {
    try {
      for (const f of readdirSync(d).filter((x) => x.endsWith(".json"))) {
        files.push({ path: join(d, f), name: basename(f, ".json") });
      }
    } catch {}
  }
  if (!files.length) return;

  const has = db.query(
    'SELECT 1 AS ok FROM snapshots WHERE "commit" = $commit',
  );
  const tx = db.transaction(() => {
    for (const file of files) {
      const name = file.name;
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(file.path, "utf8"));
      } catch {
        continue;
      }

      if (name === ".pending") {
        if (has.get({ $commit: PENDING_COMMIT })) continue;
        const parsed = parseHistoryFile(raw);
        if (!parsed) continue;
        insertSnapshot(
          db,
          PENDING_COMMIT,
          "pending",
          makeSnapshot("", parsed.metrics, parsed.tests, parsed.createdAt ?? undefined),
          false,
        );
        continue;
      }

      if (!/^[0-9a-f]{7,40}$/.test(name)) continue;
      if (has.get({ $commit: name })) continue;
      const parsed = parseHistoryFile(raw);
      if (!parsed) continue;
      insertSnapshot(
        db,
        name,
        "final",
        makeSnapshot(name, parsed.metrics, parsed.tests, parsed.createdAt ?? undefined),
        false,
      );
    }
  });
  tx();
}

function withDb<T>(dir: string, fn: (db: Database) => T): T {
  mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath(dir));
  try {
    ensureSchema(db);
    importLegacyFiles(db, dir);
    return fn(db);
  } finally {
    db.close();
  }
}

function snapshotExists(db: Database, commit: string): boolean {
  const row = db
    .query('SELECT status FROM snapshots WHERE "commit" = $commit')
    .get({ $commit: commit }) as { status: string } | null;
  return row?.status === "final";
}

/** Save an immediately finalized snapshot for a known commit. */
export function saveSnapshot(
  dir: string,
  commit: string,
  metrics: FtaFileMetric[],
  tests: TestRunSummary | null = null,
  options: SaveSnapshotOptions = {},
): string {
  const sha = validateCommit(commit);
  withDb(dir, (db) => {
    if (!options.force && snapshotExists(db, sha)) {
      throw new Error(
        `Metric snapshot already exists for commit ${sha} (${dbPath(dir)})`,
      );
    }
    insertSnapshot(db, sha, "final", makeSnapshot(sha, metrics, tests), true);
  });
  return `${dbPath(dir)}#${sha}`;
}

/** Capture metrics before a commit, when its new SHA is not known yet. */
export function savePendingSnapshot(
  dir: string,
  metrics: FtaFileMetric[],
  tests: TestRunSummary | null = null,
): string {
  withDb(dir, (db) => {
    insertSnapshot(
      db,
      PENDING_COMMIT,
      "pending",
      makeSnapshot("", metrics, tests),
      true,
    );
  });
  return `${dbPath(dir)}#pending`;
}

/** Finalize a pending snapshot to the new commit's full SHA. */
export function finalizeSnapshot(
  dir: string,
  commit: string,
  options: SaveSnapshotOptions = {},
): string {
  const sha = validateCommit(commit);
  withDb(dir, (db) => {
    const pending = db
      .query('SELECT * FROM snapshots WHERE "commit" = $commit')
      .get({ $commit: PENDING_COMMIT }) as SnapshotRow | null;
    if (!pending) {
      throw new Error(`No pending metric snapshot found in ${dbPath(dir)}`);
    }
    if (!options.force && snapshotExists(db, sha)) {
      throw new Error(
        `Metric snapshot already exists for commit ${sha} (${dbPath(dir)})`,
      );
    }

    const metrics = JSON.parse(pending.fta_files_json) as FtaFileMetric[];
    const tests = pending.tests_json
      ? (normalizeTests(JSON.parse(pending.tests_json)) ?? null)
      : null;
    const snapshot = makeSnapshot(sha, metrics, tests, pending.created_at);

    const tx = db.transaction(() => {
      insertSnapshot(db, sha, "final", snapshot, true);
      db.query('DELETE FROM snapshots WHERE "commit" = $commit').run({
        $commit: PENDING_COMMIT,
      });
    });
    tx();
  });
  return `${dbPath(dir)}#${sha}`;
}

function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Aggregate a snapshot's per-file metrics into trend values. */
export function aggregateSnapshot(
  metrics: FtaFileMetric[],
  thresholds: MetricsThresholds,
  tests: TestRunSummary | null = null,
): SnapshotAggregate {
  const totalFiles = metrics.length;
  const totalLines = metrics.reduce((sum, m) => sum + (m.line_count ?? 0), 0);

  let passing = 0;
  for (const m of metrics) {
    const cycloOk = m.cyclo <= thresholds.maxCyclomatic;
    const scoreOk = m.fta_score >= thresholds.minFtaScore;
    if (cycloOk && scoreOk) passing++;
  }

  const cyclos = metrics.map((m) => m.cyclo ?? 0);
  const scores = metrics.map((m) => m.fta_score ?? 0);
  const volumes = metrics.map((m) => m.halstead?.volume ?? 0);
  const difficulties = metrics.map((m) => m.halstead?.difficulty ?? 0);
  const bugs = metrics.map((m) => m.halstead?.bugs ?? 0);

  return {
    commit: "",
    shortSha: "",
    timestamp: 0,
    totalFiles,
    totalLines,
    passing,
    failing: totalFiles - passing,
    testsTotal: tests?.total ?? null,
    testsPassed: tests?.passed ?? null,
    testsFailed: tests?.failed ?? null,
    testsSkipped: tests?.skipped ?? null,
    avgCyclo: mean(cyclos),
    maxCyclo: cyclos.length ? Math.max(...cyclos) : 0,
    avgFtaScore: mean(scores),
    avgHalsteadVolume: mean(volumes),
    avgHalsteadDifficulty: mean(difficulties),
    totalHalsteadBugs: bugs.reduce((a, b) => a + b, 0),
  };
}

/** Look up a commit's Unix timestamp via git; returns 0 if unavailable. */
function commitTimestamp(sha: string): number {
  try {
    const out = execFileSync("git", ["show", "-s", "--format=%ct", sha], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    const n = Number(out);
    return Number.isFinite(n) ? n * 1000 : 0;
  } catch {
    return 0;
  }
}

function rowToEntry(row: SnapshotRow): HistoryEntry {
  const metrics = JSON.parse(row.fta_files_json) as FtaFileMetric[];
  const tests = row.tests_json
    ? normalizeTests(JSON.parse(row.tests_json))
    : null;
  return {
    commit: row.commit,
    timestamp: commitTimestamp(row.commit),
    createdAt: row.created_at ?? null,
    tests,
    metrics,
    average: row.fta_average ?? averageScore(metrics),
    total: row.fta_total ?? metrics.length,
  };
}

export function readHistory(
  dir: string = ".",
  _thresholds?: MetricsThresholds,
): HistoryEntry[] {
  if (!existsSync(dir)) return [];
  const entries = withDb(dir, (db) => {
    const rows = db
      .query(
        'SELECT * FROM snapshots WHERE status = \'final\' AND "commit" != $pending',
      )
      .all({ $pending: PENDING_COMMIT }) as SnapshotRow[];
    return rows.map(rowToEntry).filter((e) => /^[0-9a-f]{7,40}$/.test(e.commit));
  });

  entries.sort((a, b) => {
    if (a.timestamp && b.timestamp) return a.timestamp - b.timestamp;
    if (a.timestamp) return -1;
    if (b.timestamp) return 1;
    return a.commit.localeCompare(b.commit);
  });
  return entries;
}

/** Aggregate all snapshots, ordered chronologically by commit. */
export function readAggregatedHistory(
  dir: string = ".",
  thresholds: MetricsThresholds,
): SnapshotAggregate[] {
  return readHistory(dir, thresholds).map((entry) => ({
    ...aggregateSnapshot(entry.metrics, thresholds, entry.tests),
    commit: entry.commit,
    shortSha: entry.commit.slice(0, 8),
    timestamp: entry.timestamp,
  }));
}
