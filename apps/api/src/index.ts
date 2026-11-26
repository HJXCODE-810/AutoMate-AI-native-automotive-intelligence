import { catalog as defaultCatalog, registry as defaultRegistry, type Registry } from "@automate/catalog";
import { healthResponseSchema, vehicleDetailResponseSchema, vehicleListResponseSchema } from "@automate/domain";
import { advanceSimulation, createSimulationSession, getSimulationSnapshot, type SimulationSession } from "@automate/simulation";
import type { Catalog } from "@automate/domain";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
}

/** Web-standard handler; Node is confined to the local dev adapter. */
export function createApi(registry: Registry = defaultRegistry, catalog: Catalog = defaultCatalog) {
  const sessions = new Map<string, SimulationSession>();
  const reports = new Map<string, ReturnType<typeof getSimulationSnapshot>>();
  let nextSession = 1;
  let nextReport = 1;
  return async function fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api(?=\/|$)/, "").replace(/\/$/, "") || "/";
    if (path === "/health" && request.method === "GET") return json(healthResponseSchema.parse({ status: "ok", service: "automate-api", catalogVersion: registry.version, simulation: "ready" }));
    if (path === "/sessions" && request.method === "POST") {
      try {
        const body = await request.json() as { vehicleProfileId?: unknown; scenarioId?: unknown; seed?: unknown };
        if (typeof body.vehicleProfileId !== "string" || typeof body.scenarioId !== "string" || !Number.isSafeInteger(body.seed)) return json({ error: { code: "INVALID_SESSION", message: "Provide vehicleProfileId, scenarioId, and a nonnegative integer seed." } }, 400);
        const session = createSimulationSession(catalog, body.vehicleProfileId, body.scenarioId, body.seed as number, `session-${nextSession++}`);
        sessions.set(session.id, session);
        return json(getSimulationSnapshot(session), 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to create simulation session.";
        return json({ error: { code: "SESSION_REJECTED", message } }, 400);
      }
    }
    if (path === "/reports" && request.method === "GET") return json({ source: "synthetic", durability: "in_memory", reports: [...reports.entries()].map(([reportId, snapshot]) => ({ reportId, ...snapshot })) });
    const sessionMatch = /^\/sessions\/([^/]+)(?:\/(advance|report))?$/.exec(path);
    if (sessionMatch?.[1]) {
      let id: string;
      try { id = decodeURIComponent(sessionMatch[1]); } catch { return json({ error: { code: "INVALID_PATH", message: "Session ID contains invalid encoding." } }, 400); }
      const session = sessions.get(id);
      if (!session) return json({ error: { code: "SESSION_NOT_FOUND", message: "In-memory simulation session not found." } }, 404);
      if (!sessionMatch[2] && request.method === "GET") return json(getSimulationSnapshot(session));
      if (sessionMatch[2] === "advance" && request.method === "POST") {
        try {
          const body = await request.json() as { ticks?: unknown };
          if (!Number.isSafeInteger(body.ticks)) return json({ error: { code: "INVALID_ADVANCE", message: "ticks must be a positive integer." } }, 400);
          return json(advanceSimulation(session, body.ticks as number));
        } catch (error) { return json({ error: { code: "INVALID_ADVANCE", message: error instanceof Error ? error.message : "Advance rejected." } }, 400); }
      }
      if (sessionMatch[2] === "report" && request.method === "POST") {
        const snapshot = getSimulationSnapshot(session);
        const reportId = `report-${nextReport++}`;
        session.savedReport = true;
        reports.set(reportId, getSimulationSnapshot(session));
        return json({ ...snapshot, reportId, savedReport: true, durability: "in_memory" }, 201);
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
