import { catalog as defaultCatalog, registry as defaultRegistry, type Registry } from "@automate/catalog";
import { healthResponseSchema, vehicleDetailResponseSchema, vehicleListResponseSchema } from "@automate/domain";
import { advanceSimulation, createSimulationSession, getSimulationSnapshot, type SimulationSession } from "@automate/simulation";
import type { Catalog } from "@automate/domain";
import { InMemorySessionRepository, type SessionRepository, type StoredSession } from "./session-repository.ts";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
}

/** Web-standard handler; Node is confined to the local dev adapter. */
export function createApi(registry: Registry = defaultRegistry, catalog: Catalog = defaultCatalog, repository: SessionRepository = new InMemorySessionRepository()) {
  function toStoredSession(session: SimulationSession): StoredSession {
    return { id: session.id, vehicleProfileId: session.profile.id, scenarioId: session.scenarioId, seed: session.seed, tick: session.tick,
      events: [...session.events], eventTicks: [...session.eventTicks.entries()], priorIndicators: [...session.priorIndicators.entries()], savedReport: session.savedReport, catalogVersion: registry.version };
  }
  function restoreSession(stored: StoredSession) {
    const session = createSimulationSession(catalog, stored.vehicleProfileId, stored.scenarioId, stored.seed, stored.id);
    session.tick = stored.tick;
    session.events = [...stored.events];
    session.eventTicks = new Map(stored.eventTicks);
    session.priorIndicators = new Map(stored.priorIndicators);
    session.savedReport = stored.savedReport;
    return session;
  }
  return async function fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api(?=\/|$)/, "").replace(/\/$/, "") || "/";
    if (path === "/health" && request.method === "GET") return json(healthResponseSchema.parse({ status: "ok", service: "automate-api", catalogVersion: registry.version, simulation: "ready", durability: repository.durability }));
    if (path === "/sessions" && request.method === "POST") {
      let body: { vehicleProfileId?: unknown; scenarioId?: unknown; seed?: unknown };
      try {
        body = await request.json() as { vehicleProfileId?: unknown; scenarioId?: unknown; seed?: unknown };
      } catch {
        return json({ error: { code: "INVALID_SESSION", message: "Request body must be valid JSON." } }, 400);
      }
      if (typeof body.vehicleProfileId !== "string" || typeof body.scenarioId !== "string" || !Number.isSafeInteger(body.seed)) return json({ error: { code: "INVALID_SESSION", message: "Provide vehicleProfileId, scenarioId, and a nonnegative integer seed." } }, 400);
      let session: SimulationSession;
      try { session = createSimulationSession(catalog, body.vehicleProfileId, body.scenarioId, body.seed as number, `session-${crypto.randomUUID()}`); }
      catch (error) { return json({ error: { code: "SESSION_REJECTED", message: error instanceof Error ? error.message : "Unable to create simulation session." } }, 400); }
      const snapshot = getSimulationSnapshot(session);
      await repository.createSession(toStoredSession(session), snapshot);
      return json({ ...snapshot, durability: repository.durability }, 201);
    }
    if (path === "/reports" && request.method === "GET") {
      const reports = await repository.listReports();
      return json({ source: "synthetic", durability: repository.durability, reports: reports.map(({ reportId, snapshot }) => ({ reportId, ...snapshot })) });
    }
    const sessionMatch = /^\/sessions\/([^/]+)(?:\/(advance|report))?$/.exec(path);
    if (sessionMatch?.[1]) {
      let id: string;
      try { id = decodeURIComponent(sessionMatch[1]); } catch { return json({ error: { code: "INVALID_PATH", message: "Session ID contains invalid encoding." } }, 400); }
      const stored = await repository.getSession(id);
      if (!stored) return json({ error: { code: "SESSION_NOT_FOUND", message: "Simulation session not found." } }, 404);
      const session = restoreSession(stored.session);
      if (!sessionMatch[2] && request.method === "GET") return json({ ...stored.snapshot, durability: repository.durability });
      if (sessionMatch[2] === "advance" && request.method === "POST") {
        let body: { ticks?: unknown };
        try {
          body = await request.json() as { ticks?: unknown };
        } catch { return json({ error: { code: "INVALID_ADVANCE", message: "Request body must be valid JSON." } }, 400); }
        if (!Number.isSafeInteger(body.ticks)) return json({ error: { code: "INVALID_ADVANCE", message: "ticks must be a positive integer." } }, 400);
        let snapshot;
        try { snapshot = advanceSimulation(session, body.ticks as number); }
        catch (error) { return json({ error: { code: "INVALID_ADVANCE", message: error instanceof Error ? error.message : "Advance rejected." } }, 400); }
        await repository.updateSession(toStoredSession(session), snapshot);
        return json({ ...snapshot, durability: repository.durability });
      }
      if (sessionMatch[2] === "report" && request.method === "POST") {
        const reportId = `report-${crypto.randomUUID()}`;
        session.savedReport = true;
        const snapshot = getSimulationSnapshot(session);
        await repository.saveReport(reportId, toStoredSession(session), snapshot);
        return json({ ...snapshot, reportId, savedReport: true, durability: repository.durability }, 201);
      }
    }
    if (request.method !== "GET" && (path === "/health" || path.startsWith("/catalog/"))) return json({ error: { code: "METHOD_NOT_ALLOWED", message: "Catalog endpoints accept GET only." } }, 405, { Allow: "GET" });
    if (request.method !== "GET") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "This API accepts GET and simulation session POST requests." } }, 405, { Allow: "GET, POST" });
    if (path === "/catalog/vehicles") return json(vehicleListResponseSchema.parse(registry.listVehicles()));
    const match = /^\/catalog\/vehicles\/([^/]+)$/.exec(path);
    if (match?.[1]) {
      let vehicleId: string;
      try { vehicleId = decodeURIComponent(match[1]); }
      catch { return json({ error: { code: "INVALID_PATH", message: "Vehicle ID contains invalid encoding." } }, 400); }
      const vehicle = registry.getVehicle(vehicleId);
      return vehicle ? json(vehicleDetailResponseSchema.parse(vehicle))
        : json({ error: { code: "VEHICLE_NOT_FOUND", message: "Fictional vehicle profile not found." } }, 404);
    }
    return json({ error: { code: "NOT_FOUND", message: "Endpoint not found." } }, 404);
  };
}

export const handleRequest = createApi();
export default { fetch: handleRequest };
