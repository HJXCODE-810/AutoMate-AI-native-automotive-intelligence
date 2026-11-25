import { describe, expect, it } from "vitest";
import { catalogSchema, signalSchema } from "@automate/domain";
import seed from "../data/catalog-seed.json";
import { createRegistry, parseCatalog } from "./registry.ts";

const valid = () => catalogSchema.parse(seed);

describe("CAT: catalog integrity", () => {
  it("CAT-01 loads three fictional vehicles and 30 canonical signals", () => {
    const catalog = parseCatalog(seed);
    expect(catalog.vehicles.map((vehicle) => vehicle.id)).toEqual(["compact-petrol-v1", "electric-suv-v1", "luxury-diesel-v1"]);
    expect(catalog.vehicles.every((vehicle) => vehicle.fictional)).toBe(true);
    expect(catalog.signals).toHaveLength(30);
    expect(catalog.knowledgeBasis).toBe("fictional_demo");
  });

  it.each(["subsystems", "signals", "vehicles", "warningRules", "scenarios"] as const)("CAT-02 rejects duplicate %s IDs", (key) => {
    const data = valid();
    expect(() => parseCatalog({ ...data, [key]: [...data[key], data[key][0]] })).toThrow(/Duplicate/);
  });

  it.each([
    { validRange: [200, 0] },
    { nominalRange: [-1, 500] },
    { unit: "watts" },
    { updatePeriodMs: 0 },
  ])("CAT-03 rejects invalid numeric signal metadata %j", (patch) => {
    expect(() => signalSchema.parse({ ...valid().signals[0], ...patch })).toThrow();
  });

  it("CAT-03 rejects empty enum definitions", () => {
    expect(() => signalSchema.parse({ id: "test.status", subsystemId: "body.tires", valueType: "enum", unit: "", values: [], updatePeriodMs: 100 })).toThrow();
  });

  it("CAT-04 rejects nonexistent subsystems and signal assignments", () => {
    const data = valid();
    data.signals[0]!.subsystemId = "missing.system";
    expect(() => parseCatalog(data)).toThrow(/Unknown subsystem/);
    const other = valid();
    other.vehicles[0]!.supportedSignalIds.push("missing.signal");
    expect(() => parseCatalog(other)).toThrow(/Unknown signal/);
  });

  it("CAT-04 rejects duplicated and overlapping capability assignments", () => {
    for (const key of ["supportedSignalIds", "unsupportedSignalIds"] as const) {
      const data = valid();
      data.vehicles[0]![key].push("engine.rpm");
      expect(() => parseCatalog(data)).toThrow(/Duplicate capability assignment/);
    }
  });

  it("CAT-04 rejects unknown profile references", () => {
    const data = valid();
    data.scenarios[0]!.profiles.push("missing-profile");
    expect(() => parseCatalog(data)).toThrow(/Unknown profile/);
  });

  it("CAT-05 rejects rules whose signals are unavailable to a profile", () => {
    const data = valid();
    data.warningRules[0]!.profiles.push("electric-suv-v1");
    expect(() => parseCatalog(data)).toThrow(/Unsupported signal/);
  });

  it("CAT-05 rejects nonnumeric rule targets and invalid thresholds", () => {
    const data = valid();
    const original = data.warningRules[0]!;
    const withRule = (candidate: unknown) => ({ ...data, warningRules: data.warningRules.map((entry) => entry.id === original.id ? candidate : entry) });
    expect(() => parseCatalog(withRule({ ...original, signalId: "brakes.abs_status" }))).toThrow(/numeric signal/);
    expect(() => parseCatalog(withRule({ ...original, threshold: 500, clearBelow: 400 }))).toThrow(/outside signal range/);
    expect(() => parseCatalog(withRule({ ...original, threshold: 100, clearBelow: 110 }))).toThrow(/Clear threshold must be below activation/);
  });

  it("CAT-05 validates the lower-threshold rule and its clearing direction", () => {
    const data = valid();
    const rule = data.warningRules.find((entry) => "operator" in entry && entry.operator === "lte");
    if (!rule || !("operator" in rule) || rule.operator !== "lte") throw new Error("Expected lower-threshold baseline rule");
    const withRule = (candidate: unknown) => ({ ...data, warningRules: data.warningRules.map((entry) => entry.id === rule.id ? candidate : entry) });
    expect(() => parseCatalog(data)).not.toThrow();
    for (const clearAbove of [rule.threshold, rule.threshold - 1]) {
      expect(() => parseCatalog(withRule({ ...rule, clearAbove }))).toThrow(/Clear threshold must be above activation/);
    }
    expect(() => parseCatalog(withRule({ ...rule, clearAbove: 2000 }))).toThrow(/threshold outside signal range/);
  });

  it("CAT-06 rejects unsupported scenario targets", () => {
    const data = valid();
    data.scenarios[1]!.profiles.push("electric-suv-v1");
    expect(() => parseCatalog(data)).toThrow(/Unsupported signal/);
  });

  it("CAT-07 rejects scenario events whose rule scope omits a scenario profile", () => {
    const data = valid();
    const rule = data.warningRules.find((entry) => "eventType" in entry && entry.eventType === "abs_wheel_sensor_fault");
    if (!rule) throw new Error("Expected ABS event rule in fixture");
    rule.profiles = ["compact-petrol-v1"];
    expect(() => parseCatalog(data)).toThrow(/Scenario abs-wheel-sensor-v1 event abs_wheel_sensor_fault unsupported on electric-suv-v1/);
  });

  it("CAT-07 accepts event support combined across multiple scoped rules", () => {
    const data = valid();
    const rule = data.warningRules.find((entry) => "eventType" in entry && entry.eventType === "abs_wheel_sensor_fault");
    if (!rule || !("eventType" in rule)) throw new Error("Expected ABS event rule in fixture");
    rule.profiles = ["compact-petrol-v1"];
    data.warningRules.push({ ...rule, id: "warn-abs-other-profiles-v1", profiles: ["electric-suv-v1", "luxury-diesel-v1"] });
    expect(() => parseCatalog(data)).not.toThrow();
  });

  it("CAT-06 accepts the valid baseline before negative scenario mutations", () => {
    const data = valid();
    const scenario = { ...data.scenarios[0], profiles: ["compact-petrol-v1"], actions: [{ atTick: 1, type: "set_signal", signalId: "engine.rpm", value: 900 }] };
    expect(() => parseCatalog({ ...data, scenarios: [scenario] })).not.toThrow();
  });

  it.each([
    { name: "wrong set-value type", actions: [{ atTick: 1, type: "set_signal", signalId: "engine.rpm", value: "fast" }], error: /Invalid scenario value/ },
    { name: "out-of-range ramp", actions: [{ atTick: 1, type: "ramp_signal", signalId: "engine.rpm", from: 900, to: 90000, overTicks: 1 }], error: /Invalid ramp range/ },
    { name: "unknown event", actions: [{ atTick: 1, type: "emit_event", eventType: "missing.event" }], error: /Unknown scenario event/ },
    { name: "unordered actions", actions: [{ atTick: 5, type: "set_signal", signalId: "engine.rpm", value: 900 }, { atTick: 2, type: "set_signal", signalId: "engine.rpm", value: 1000 }], error: /Unordered actions/ },
    { name: "action beyond duration", actions: [{ atTick: 121, type: "set_signal", signalId: "engine.rpm", value: 900 }], error: /Action outside duration/ },
    { name: "ramp beyond duration", actions: [{ atTick: 119, type: "ramp_signal", signalId: "engine.rpm", from: 900, to: 1000, overTicks: 2 }], error: /Ramp outside duration/ },
  ])("CAT-06 rejects $name for the intended reason", ({ actions, error }) => {
    const data = valid();
    const scenario = { ...data.scenarios[0], profiles: ["compact-petrol-v1"], actions };
    expect(() => parseCatalog({ ...data, scenarios: [scenario] })).toThrow(error);
  });
});

describe("CAP: capability registry", () => {
  it("CAP-01 distinguishes ICE and EV measurements", () => {
    const registry = createRegistry(seed);
    expect(registry.resolveCapability("compact-petrol-v1", "engine.rpm")?.availability).toBe("supported");
    expect(registry.resolveCapability("electric-suv-v1", "engine.rpm")?.availability).toBe("unsupported");
    expect(registry.resolveCapability("electric-suv-v1", "ev.battery_state_of_charge")?.availability).toBe("supported");
    expect(registry.resolveCapability("compact-petrol-v1", "ev.battery_state_of_charge")?.availability).toBe("unsupported");
  });

  it("CAP-02 treats unassigned signals as unknown and unavailable", () => {
    const data = valid();
    data.vehicles[0]!.supportedSignalIds = data.vehicles[0]!.supportedSignalIds.filter((id) => id !== "engine.rpm");
    const result = createRegistry(data).resolveCapability("compact-petrol-v1", "engine.rpm");
    expect(result).toMatchObject({ availability: "unknown", readingStatus: "unavailable", value: null });
  });

  it("CAP-03 never manufactures a telemetry value", () => {
    const registry = createRegistry(seed);
    for (const vehicle of registry.listVehicles().vehicles) {
      const capabilities = registry.getVehicle(vehicle.id)!.capabilities;
      expect(capabilities).toHaveLength(30);
      for (const capability of capabilities) {
        expect(capability.value).toBeNull();
        expect(capability.readingStatus).toBe(capability.availability === "supported" ? "not_started" : "unavailable");
      }
    }
  });

  it("CAP-04 returned results cannot mutate the canonical catalog", () => {
    const registry = createRegistry(seed);
    const detail = registry.getVehicle("compact-petrol-v1")!;
    detail.vehicle.displayName = "Changed";
    detail.capabilities[0]!.definition.id = "changed.signal";
    detail.subsystems[0]!.name = "Changed";
    registry.listVehicles().vehicles[0]!.displayName = "Changed list";
    const fresh = registry.getVehicle("compact-petrol-v1")!;
    expect(fresh.vehicle.displayName).toBe("City Compact P1");
    expect(fresh.capabilities[0]!.definition.id).toBe("vehicle.speed");
    expect(fresh.subsystems[0]!.name).toBe("Engine");
  });

  it("CAP-05 returns only applicable scenarios and cannot resolve unknown IDs", () => {
    const registry = createRegistry(seed);
    const ids = registry.getVehicle("electric-suv-v1")!.scenarios.map((scenario) => scenario.id);
    expect(ids).toContain("ev-battery-temperature-v1");
    expect(ids).not.toContain("engine-overheat-v1");
    expect(ids).not.toContain("low-oil-pressure-v1");
    expect(registry.getVehicle("missing-vehicle")).toBeUndefined();
    expect(registry.resolveCapability("missing-vehicle", "vehicle.speed")).toBeUndefined();
    expect(registry.resolveCapability("compact-petrol-v1", "missing.signal")).toBeUndefined();
  });
});
