import { registry as defaultRegistry, type Registry } from "@automate/catalog";
import { healthResponseSchema, vehicleDetailResponseSchema, vehicleListResponseSchema } from "@automate/domain";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
}

/** Web-standard handler; Node is confined to the local dev adapter. */
export function createApi(registry: Registry = defaultRegistry) {
  return async function fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api(?=\/|$)/, "").replace(/\/$/, "") || "/";
    if (request.method !== "GET") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "This catalog API accepts GET only." } }, 405, { Allow: "GET" });
    if (path === "/health") return json(healthResponseSchema.parse({ status: "ok", service: "automate-api", catalogVersion: registry.version, simulation: "not_implemented" }));
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
