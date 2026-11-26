import { describe, expect, it } from "vitest";
import { catalog } from "@automate/catalog";
import { advanceClock, advanceSimulation, createClock, createSimulationSession, getSimulationSnapshot } from "./index.ts";

describe("CLK: pure simulation-clock boundary", () => {
  it("CLK-01 repeated ordered advances produce the same state without mutating input", () => {
    const clock = createClock(100);
    const first = advanceClock(advanceClock(clock, 5), 10);
    const second = advanceClock(advanceClock(createClock(100), 5), 10);
    expect(first).toEqual(second);
    expect(first).toEqual({ tick: 15, tickDurationMs: 100 });
    expect(clock).toEqual({ tick: 0, tickDurationMs: 100 });
    expect(advanceClock(clock, 0)).toEqual(clock);
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("CLK-02 rejects invalid tick duration %s", (duration) => {
    expect(() => createClock(duration)).toThrow(RangeError);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("CLK-02 rejects invalid advance %s", (ticks) => {
    expect(() => advanceClock(createClock(100), ticks)).toThrow(RangeError);
  });

  it("CLK-02 rejects unsafe overflow and invalid existing state", () => {
    expect(() => advanceClock({ tick: Number.MAX_SAFE_INTEGER, tickDurationMs: 100 }, 1)).toThrow(RangeError);
    expect(() => advanceClock({ tick: -1, tickDurationMs: 100 }, 1)).toThrow(RangeError);
    expect(() => advanceClock({ tick: 0, tickDurationMs: 0 }, 1)).toThrow(RangeError);
  });
});

describe("SIM: deterministic vehicle sessions", () => {
  it("SIM-01 repeats the same supported readings for matching replay inputs", () => {
    const first = createSimulationSession(catalog, "compact-petrol-v1", "eps-assist-fault-v1", 42, "one");
    const second = createSimulationSession(catalog, "compact-petrol-v1", "eps-assist-fault-v1", 42, "two");
    advanceSimulation(first, 10);
    advanceSimulation(second, 10);
    const firstSnapshot = getSimulationSnapshot(first);
    const secondSnapshot = getSimulationSnapshot(second);
    expect(firstSnapshot.values).toEqual(secondSnapshot.values);
    expect(firstSnapshot.events).toEqual(secondSnapshot.events);
    expect(firstSnapshot.indicators).toEqual(secondSnapshot.indicators);
  });

  it("SIM-02 emits values only for supported signals and stays inside each definition's valid range", () => {
    for (const [profileId, scenarioId] of [
      ["compact-petrol-v1", "normal-idle-v1"],
      ["electric-suv-v1", "normal-idle-v1"],
      ["luxury-diesel-v1", "normal-idle-v1"],
    ]) {
      const session = createSimulationSession(catalog, profileId!, scenarioId!, 2026, profileId!);
      const snapshot = getSimulationSnapshot(session);
      const profile = catalog.vehicles.find((vehicle) => vehicle.id === profileId)!;
      expect(Object.keys(snapshot.values).sort()).toEqual([...profile.supportedSignalIds].sort());
      for (const [signalId, value] of Object.entries(snapshot.values)) {
        const signal = catalog.signals.find((entry) => entry.id === signalId)!;
        if (signal.valueType === "number") expect(value).toBeGreaterThanOrEqual(signal.validRange[0]);
        if (signal.valueType === "number") expect(value).toBeLessThanOrEqual(signal.validRange[1]);
        if (signal.valueType === "enum") expect(signal.values).toContain(value);
        if (signal.valueType === "boolean") expect(typeof value).toBe("boolean");
      }
    }
    const ev = getSimulationSnapshot(createSimulationSession(catalog, "electric-suv-v1", "normal-idle-v1", 1, "ev"));
    expect(ev.values).not.toHaveProperty("steering.eps_status");
    expect(ev.values).not.toHaveProperty("engine.rpm");
  });

  it("SIM-03 activates the EPS indicator on the scenario fault tick with a deterministic explanation", () => {
    const session = createSimulationSession(catalog, "compact-petrol-v1", "eps-assist-fault-v1", 7, "eps");
    advanceSimulation(session, 7);
    expect(getSimulationSnapshot(session).indicators.find((entry) => entry.id === "steering.eps")?.status).toBe("clear");
    const snapshot = advanceSimulation(session, 1);
    const eps = snapshot.indicators.find((entry) => entry.id === "steering.eps");
    expect(eps).toMatchObject({ status: "active", ruleId: "warn-eps-assist-event-v1" });
    expect(eps?.explanation).toContain("eps_assist_fault");
    expect(snapshot.values["steering.eps_status"]).toBe("warning");
  });

  it("SIM-04 activates low-voltage and communication indicators from the EV scenario", () => {
    const session = createSimulationSession(catalog, "electric-suv-v1", "low-12v-voltage-v1", 8, "voltage");
    advanceSimulation(session, 18);
    let snapshot = getSimulationSnapshot(session);
    expect(snapshot.values["electrical.system_voltage"]).toBe(10.9);
    expect(snapshot.indicators.find((entry) => entry.id === "electrical.low_voltage")?.status).toBe("active");
    snapshot = advanceSimulation(session, 2);
    expect(snapshot.events).toContain("module_communication_intermittent");
    expect(snapshot.indicators.find((entry) => entry.id === "electrical.module_communication")?.status).toBe("active");
  });

  it("SIM-05 rejects unsupported profile/scenario pairs and invalid seeds", () => {
    expect(() => createSimulationSession(catalog, "electric-suv-v1", "eps-assist-fault-v1", 1, "bad-pair")).toThrow(/unsupported/);
    expect(() => createSimulationSession(catalog, "missing-profile", "normal-idle-v1", 1, "bad-profile")).toThrow(/not found/);
    expect(() => createSimulationSession(catalog, "compact-petrol-v1", "normal-idle-v1", -1, "bad-seed")).toThrow(/seed/i);
    expect(() => createSimulationSession(catalog, "compact-petrol-v1", "normal-idle-v1", 2147483648, "large-seed")).toThrow(/seed/i);
  });

  it("SIM-06 bounds advances to positive ticks within the scenario duration", () => {
    const session = createSimulationSession(catalog, "compact-petrol-v1", "normal-idle-v1", 1, "bounds");
    expect(() => advanceSimulation(session, 0)).toThrow(RangeError);
    expect(() => advanceSimulation(session, 1.5)).toThrow(RangeError);
    expect(() => advanceSimulation(session, 1001)).toThrow(RangeError);
    advanceSimulation(session, 120);
    expect(() => advanceSimulation(session, 1)).toThrow(RangeError);
  });

  it("SIM-07 clears a latched low-voltage warning only after the rule's clear threshold", () => {
    const recoveryCatalog = structuredClone(catalog);
    const scenario = recoveryCatalog.scenarios.find((entry) => entry.id === "low-12v-voltage-v1")!;
    scenario.actions.push({ atTick: 20, type: "set_signal", signalId: "electrical.system_voltage", value: 12 });
    scenario.actions.push({ atTick: 22, type: "set_signal", signalId: "electrical.system_voltage", value: 13 });
    const session = createSimulationSession(recoveryCatalog, "compact-petrol-v1", "low-12v-voltage-v1", 8, "voltage-recovery");
    advanceSimulation(session, 18);
    expect(getSimulationSnapshot(session).indicators.find((entry) => entry.id === "electrical.low_voltage")?.status).toBe("active");
    const intermediate = advanceSimulation(session, 2);
    expect(intermediate.values["electrical.system_voltage"]).toBe(12);
    expect(intermediate.indicators.find((entry) => entry.id === "electrical.low_voltage")?.status).toBe("active");
    const recovered = advanceSimulation(session, 2);
    expect(recovered.values["electrical.system_voltage"]).toBe(13);
    expect(recovered.indicators.find((entry) => entry.id === "electrical.low_voltage")?.status).toBe("clear");
  });
});
