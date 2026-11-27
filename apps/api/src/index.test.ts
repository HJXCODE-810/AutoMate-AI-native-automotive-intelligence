import { describe, expect, it } from "vitest";
import { healthResponseSchema, vehicleDetailResponseSchema, vehicleListResponseSchema } from "@automate/domain";
import { createApi, handleRequest } from "./index.ts";
import { InMemorySessionRepository } from "./session-repository.ts";

const request = (path: string, method = "GET") => handleRequest(new Request(`http://localhost${path}`, { method }));

describe("API: local foundation contracts", () => {
  it.each(["/health", "/api/health"])("API-01 serves health at %s", async (path) => {
    const response = await request(path);
    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json())).toMatchObject({ status: "ok", simulation: "ready", durability: "in_memory" });
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
    expect(body.simulationStatus).toBe("ready");
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

describe("API: simulation sessions and reports", () => {
  function sessionRequest(api: typeof handleRequest, path: string, method = "GET", body?: unknown) {
    const init: RequestInit = { method };
    if (body !== undefined) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    return api(new Request(`http://localhost/api${path}`, init));
  }

  it("API-SIM-01 creates, advances, and reopens a capability-filtered synthetic session", async () => {
    const api = createApi();
    const created = await sessionRequest(api, "/sessions", "POST", {
      vehicleProfileId: "electric-suv-v1", scenarioId: "normal-idle-v1", seed: 91,
    });
    expect(created.status).toBe(201);
    const initial = await created.json();
    expect(initial).toMatchObject({ vehicleProfileId: "electric-suv-v1", scenarioId: "normal-idle-v1", seed: 91, tick: 0, source: "synthetic" });
    expect(initial.values).toHaveProperty("ev.battery_state_of_charge");
    expect(initial.values).not.toHaveProperty("engine.rpm");

    const advanced = await sessionRequest(api, `/sessions/${initial.id}/advance`, "POST", { ticks: 5 });
    expect(advanced.status).toBe(200);
    const advancedState = await advanced.json();
    expect(advancedState).toMatchObject({ id: initial.id, tick: 5 });
    expect(Object.keys(advancedState.values).sort()).toEqual(Object.keys(initial.values).sort());
    const reopened = await sessionRequest(api, `/sessions/${initial.id}`);
    expect(reopened.status).toBe(200);
    expect(await reopened.json()).toMatchObject({ id: initial.id, tick: 5 });
  });

  it("API-SIM-02 saves a report that appears in repository-backed report history", async () => {
    const api = createApi();
    const created = await sessionRequest(api, "/sessions", "POST", {
      vehicleProfileId: "compact-petrol-v1", scenarioId: "eps-assist-fault-v1", seed: 42,
    });
    const session = await created.json();
    await sessionRequest(api, `/sessions/${session.id}/advance`, "POST", { ticks: 8 });
    const saved = await sessionRequest(api, `/sessions/${session.id}/report`, "POST", {});
    expect(saved.status).toBe(201);
    const report = await saved.json();
    expect(report).toMatchObject({ id: session.id, tick: 8, savedReport: true, durability: "in_memory" });
    expect(report.reportId).toMatch(/^report-/);
    const history = await sessionRequest(api, "/reports");
    expect(await history.json()).toMatchObject({ source: "synthetic", durability: "in_memory", reports: [{ reportId: report.reportId, id: session.id, tick: 8 }] });
    expect(await (await sessionRequest(api, `/sessions/${session.id}`)).json()).toMatchObject({ savedReport: true });
  });

  it("API-SIM-04 shares sessions across API handler instances through the repository boundary", async () => {
    const repository = new InMemorySessionRepository();
    const firstApi = createApi(undefined, undefined, repository);
    const secondApi = createApi(undefined, undefined, repository);
    const created = await sessionRequest(firstApi, "/sessions", "POST", {
      vehicleProfileId: "compact-petrol-v1", scenarioId: "normal-idle-v1", seed: 18,
    });
    const initial = await created.json();
    const advanced = await sessionRequest(firstApi, `/sessions/${initial.id}/advance`, "POST", { ticks: 3 });
    expect((await advanced.json()).tick).toBe(3);
    const reopened = await sessionRequest(secondApi, `/sessions/${initial.id}`);
    expect(reopened.status).toBe(200);
    expect(await reopened.json()).toMatchObject({ id: initial.id, tick: 3, durability: "in_memory" });
  });

  it("API-SIM-03 rejects invalid session inputs, advances, and missing sessions", async () => {
    const api = createApi();
    for (const body of [
      { vehicleProfileId: "missing-profile", scenarioId: "normal-idle-v1", seed: 1 },
      { vehicleProfileId: "electric-suv-v1", scenarioId: "eps-assist-fault-v1", seed: 1 },
      { vehicleProfileId: "compact-petrol-v1", scenarioId: "normal-idle-v1", seed: -1 },
      { vehicleProfileId: "compact-petrol-v1", scenarioId: "normal-idle-v1", seed: 1.5 },
    ]) {
      expect((await sessionRequest(api, "/sessions", "POST", body)).status).toBe(400);
    }
    expect((await sessionRequest(api, "/sessions/not-here")).status).toBe(404);
    const created = await sessionRequest(api, "/sessions", "POST", {
      vehicleProfileId: "compact-petrol-v1", scenarioId: "normal-idle-v1", seed: 1,
    });
    const session = await created.json();
    for (const ticks of [0, 1.5, 1001, 121]) {
      expect((await sessionRequest(api, `/sessions/${session.id}/advance`, "POST", { ticks })).status).toBe(400);
    }
  });
});
