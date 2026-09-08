import * as SQLite from 'expo-sqlite';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase() {
  if (!databasePromise) databasePromise = openDatabase();
  return databasePromise;
}

async function openDatabase() {
  const db = await SQLite.openDatabaseAsync('fasting.db');
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS plan_runs (
      id TEXT PRIMARY KEY NOT NULL,
      protocol_json TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      current_cycle INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS phase_runs (
      id TEXT PRIMARY KEY NOT NULL,
      plan_id TEXT NOT NULL REFERENCES plan_runs(id) ON DELETE CASCADE,
      cycle_number INTEGER NOT NULL,
      phase_index INTEGER NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('fast','refeed')),
      planned_duration_ms INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','active','ended','cancelled')),
      started_at INTEGER,
      target_at INTEGER,
      ended_at INTEGER,
      end_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_phase_order ON phase_runs(plan_id, cycle_number, phase_index);
    CREATE TABLE IF NOT EXISTS active_timer (
      slot INTEGER PRIMARY KEY CHECK(slot = 1),
      phase_id TEXT NOT NULL UNIQUE REFERENCES phase_runs(id) ON DELETE CASCADE,
      notification_id TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS timer_events (
      id TEXT PRIMARY KEY NOT NULL,
      plan_id TEXT NOT NULL REFERENCES plan_runs(id) ON DELETE CASCADE,
      phase_id TEXT REFERENCES phase_runs(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      occurred_at INTEGER NOT NULL,
      payload_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_plans_history ON plan_runs(status, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_plan ON timer_events(plan_id, occurred_at);
    PRAGMA user_version = 1;
  `);
  return db;
}
