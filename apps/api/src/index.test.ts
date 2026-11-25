import { describe, expect, it } from "vitest";
import { healthResponseSchema, vehicleDetailResponseSchema, vehicleListResponseSchema } from "@automate/domain";
import { handleRequest } from "./index.ts";

const request = (path: string, method = "GET") => handleRequest(new Request(`http://localhost${path}`, { method }));

describe("API: local foundation contracts", () => {
  it.each(["/health", "/api/health"])("API-01 serves health at %s", async (path) => {
    const response = await request(path);
    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json())).toMatchObject({ status: "ok", simulation: "not_implemented" });
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each(["/catalog/vehicles", "/api/catalog/vehicles"])("API-01 serves three fictional profiles at %s", async (path) => {
    const response = await request(path);
    expect(response.status).toBe(200);
    const body = vehicleListResponseSchema.parse(await response.json());
    expect(body.vehicles.map((vehicle) => vehicle.id)).toEqual(["compact-petrol-v1", "electric-suv-v1", "luxury-diesel-v1"]);
    expect(body.source).toBe("synthetic");
    for (const vehicle of body.vehicles) expect(vehicle.supportedCount + vehicle.unsupportedCount + vehicle.unknownCount).toBe(30);
  });

  it("API-01 summary counts match capability rows for all three profiles", async () => {
    const list = vehicleListResponseSchema.parse(await (await request("/api/catalog/vehicles")).json());
    for (const vehicle of list.vehicles) {
      const response = await request(`/api/catalog/vehicles/${vehicle.id}`);
      expect(response.status).toBe(200);
      const detail = vehicleDetailResponseSchema.parse(await response.json());
      const counts = {
        supportedCount: detail.capabilities.filter((entry) => entry.availability === "supported").length,
        unsupportedCount: detail.capabilities.filter((entry) => entry.availability === "unsupported").length,
        unknownCount: detail.capabilities.filter((entry) => entry.availability === "unknown").length,
      };
      expect(vehicle).toMatchObject(counts);
      expect(detail.vehicle).toEqual(vehicle);
      const rpm = detail.capabilities.find((entry) => entry.signalId === "engine.rpm");
      const soc = detail.capabilities.find((entry) => entry.signalId === "ev.battery_state_of_charge");
      expect(rpm?.availability).toBe(vehicle.powertrain === "battery_electric" ? "unsupported" : "supported");
      expect(soc?.availability).toBe(vehicle.powertrain === "battery_electric" ? "supported" : "unsupported");
    }
  });

  it.each(["/catalog/vehicles/electric-suv-v1", "/api/catalog/vehicles/electric-suv-v1"])("API-01/API-03 serves truthful EV capabilities at %s", async (path) => {
    const response = await request(path);
    expect(response.status).toBe(200);
    const raw: unknown = await response.json();
    const body = vehicleDetailResponseSchema.parse(raw);
    expect(body.vehicle.id).toBe("electric-suv-v1");
    expect(body.source).toBe("synthetic");
    expect(body.knowledgeBasis).toBe("fictional_demo");
    expect(body.simulationStatus).toBe("not_implemented");
    expect(body.capabilities.find((entry) => entry.signalId === "engine.rpm")).toMatchObject({ availability: "unsupported", readingStatus: "unavailable", value: null });
    expect(body.capabilities.every((entry) => entry.value === null)).toBe(true);
    expect(raw).not.toHaveProperty("observations");
    expect(raw).not.toHaveProperty("sources");
  });

  it.each([
    ["/api/catalog/vehicles/no-such-vehicle", 404, "VEHICLE_NOT_FOUND"],
    ["/api/does-not-exist", 404, "NOT_FOUND"],
    ["/api/catalog/vehicles/%ZZ", 400, "INVALID_PATH"],
  ])("API-02 rejects invalid path %s", async (path, status, code) => {
    const response = await request(path as string);
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { code } });
  });

  it.each(["POST", "PUT", "DELETE", "PATCH"])("API-02 rejects mutation method %s", async (method) => {
    const response = await request("/api/catalog/vehicles", method);
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    expect(await response.json()).toMatchObject({ error: { code: "METHOD_NOT_ALLOWED" } });
  });
});
