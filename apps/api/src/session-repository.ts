import type { SimulationSnapshot } from "@automate/simulation";

export type StoredSession = {
  id: string;
  vehicleProfileId: string;
  scenarioId: string;
  seed: number;
  tick: number;
  events: string[];
  eventTicks: [string, number][];
  priorIndicators: [string, boolean][];
  savedReport: boolean;
  catalogVersion: string;
};

export type StoredReport = { reportId: string; sessionId: string; snapshot: SimulationSnapshot };

export interface SessionRepository {
  readonly durability: "in_memory" | "postgresql";
  createSession(session: StoredSession, snapshot: SimulationSnapshot): Promise<void>;
  getSession(id: string): Promise<{ session: StoredSession; snapshot: SimulationSnapshot } | null>;
  updateSession(session: StoredSession, snapshot: SimulationSnapshot): Promise<void>;
  saveReport(reportId: string, session: StoredSession, snapshot: SimulationSnapshot): Promise<void>;
  listReports(): Promise<StoredReport[]>;
}

export class InMemorySessionRepository implements SessionRepository {
  readonly durability = "in_memory" as const;
  private readonly sessions = new Map<string, { session: StoredSession; snapshot: SimulationSnapshot }>();
  private readonly reports = new Map<string, StoredReport>();

  async createSession(session: StoredSession, snapshot: SimulationSnapshot) {
    this.sessions.set(session.id, { session: structuredClone(session), snapshot: structuredClone(snapshot) });
  }
  async getSession(id: string) {
    const value = this.sessions.get(id);
    return value ? structuredClone(value) : null;
  }
  async updateSession(session: StoredSession, snapshot: SimulationSnapshot) {
    this.sessions.set(session.id, { session: structuredClone(session), snapshot: structuredClone(snapshot) });
  }
  async saveReport(reportId: string, session: StoredSession, snapshot: SimulationSnapshot) {
    await this.updateSession(session, snapshot);
    this.reports.set(reportId, { reportId, sessionId: session.id, snapshot: structuredClone(snapshot) });
  }
  async listReports() { return structuredClone([...this.reports.values()]); }
}
