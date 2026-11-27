import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import type { SimulationSnapshot } from "@automate/simulation";
import type { SessionRepository, StoredReport, StoredSession } from "./session-repository.ts";

type DatabaseRow = { session_state: StoredSession; snapshot: SimulationSnapshot };

export async function migrateDatabase(pool: Pool) {
  const migration = await readFile(new URL("../db/migrations/001_initial.sql", import.meta.url), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [734821014]);
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const applied = await client.query<{ version: string }>("SELECT version FROM schema_migrations WHERE version = $1", ["001_initial"]);
    if (applied.rowCount === 0) {
      await client.query(migration);
      await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", ["001_initial"]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function saveSnapshot(client: PoolClient, snapshot: SimulationSnapshot, eventTicks: [string, number][]) {
  await client.query(
    `INSERT INTO session_snapshots(session_id, tick, snapshot) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (session_id, tick) DO UPDATE SET snapshot = EXCLUDED.snapshot, captured_at = now()`,
    [snapshot.id, snapshot.tick, JSON.stringify(snapshot)],
  );
  await client.query("DELETE FROM telemetry_readings WHERE session_id = $1 AND tick = $2", [snapshot.id, snapshot.tick]);
  for (const [signalId, value] of Object.entries(snapshot.values)) {
    await client.query(
      "INSERT INTO telemetry_readings(session_id, tick, signal_id, value) VALUES ($1, $2, $3, $4::jsonb)",
      [snapshot.id, snapshot.tick, signalId, JSON.stringify(value)],
    );
  }
  await client.query("DELETE FROM indicator_states WHERE session_id = $1 AND tick = $2", [snapshot.id, snapshot.tick]);
  for (const indicator of snapshot.indicators) {
    await client.query(
      "INSERT INTO indicator_states(session_id, tick, indicator_id, rule_id, severity, status, explanation) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [snapshot.id, snapshot.tick, indicator.id, indicator.ruleId, indicator.severity, indicator.status, indicator.explanation],
    );
  }
  for (const [eventType, firstTick] of eventTicks) {
    await client.query(
      "INSERT INTO session_events(session_id, event_type, first_tick) VALUES ($1, $2, $3) ON CONFLICT (session_id, event_type) DO NOTHING",
      [snapshot.id, eventType, firstTick],
    );
  }
}

export class PostgresSessionRepository implements SessionRepository {
  readonly durability = "postgresql" as const;
  constructor(private readonly pool: Pool) {}

  async createSession(session: StoredSession, snapshot: SimulationSnapshot) {
    await this.withTransaction(async (client) => {
      await client.query("INSERT INTO simulation_sessions(id, vehicle_profile_id, scenario_id, seed, catalog_version, current_tick, session_state) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)",
        [session.id, session.vehicleProfileId, session.scenarioId, session.seed, session.catalogVersion, session.tick, JSON.stringify(session)]);
      await saveSnapshot(client, snapshot, session.eventTicks);
    });
  }
  async getSession(id: string) {
    const result = await this.pool.query<DatabaseRow>(
      `SELECT s.session_state, p.snapshot FROM simulation_sessions s
       JOIN session_snapshots p ON p.session_id = s.id AND p.tick = s.current_tick WHERE s.id = $1`, [id]);
    const row = result.rows[0];
    return row ? { session: row.session_state, snapshot: row.snapshot } : null;
  }
  async updateSession(session: StoredSession, snapshot: SimulationSnapshot) {
    await this.withTransaction(async (client) => {
      const updated = await client.query(
        "UPDATE simulation_sessions SET current_tick = $2, session_state = $3::jsonb, updated_at = now() WHERE id = $1",
        [session.id, session.tick, JSON.stringify(session)]);
      if (updated.rowCount !== 1) throw new Error("Session disappeared while updating it.");
      await saveSnapshot(client, snapshot, session.eventTicks);
    });
  }
  async saveReport(reportId: string, session: StoredSession, snapshot: SimulationSnapshot) {
    await this.withTransaction(async (client) => {
      await client.query("UPDATE simulation_sessions SET session_state = $2::jsonb, updated_at = now() WHERE id = $1", [session.id, JSON.stringify(session)]);
      await saveSnapshot(client, snapshot, session.eventTicks);
      await client.query("INSERT INTO reports(id, session_id, tick, snapshot) VALUES ($1, $2, $3, $4::jsonb)",
        [reportId, session.id, snapshot.tick, JSON.stringify(snapshot)]);
    });
  }
  async listReports() {
    const result = await this.pool.query<{ id: string; session_id: string; snapshot: SimulationSnapshot }>(
      "SELECT id, session_id, snapshot FROM reports ORDER BY created_at DESC, id");
    return result.rows.map((row): StoredReport => ({ reportId: row.id, sessionId: row.session_id, snapshot: row.snapshot }));
  }
  private async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try { await client.query("BEGIN"); const result = await operation(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}
