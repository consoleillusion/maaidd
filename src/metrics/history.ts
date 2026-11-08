/**
 * Metrics history — per-commit snapshots in embedded SQLite (`maaidd.db`, project root).
 *
 * Legacy JSON snapshots are imported automatically (non-destructive).
 * Pending snapshots are stored in the DB and finalized to the commit SHA.
 */
export {
  aggregateSnapshot,
  currentCommit,
  DB_FILENAME,
  finalizeSnapshot,
  PENDING_SNAPSHOT,
  readAggregatedHistory,
  readHistory,
  savePendingSnapshot,
  saveSnapshot,
  SNAPSHOT_SCHEMA_VERSION,
} from "./store.ts";

export type {
  HistoryEntry,
  ProjectSnapshot,
  SaveSnapshotOptions,
  SnapshotAggregate,
} from "./store.ts";
