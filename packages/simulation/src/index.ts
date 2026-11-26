import type { Catalog, SignalDefinition, VehicleProfile } from "@automate/domain";

export type TelemetryValue = number | string | boolean;
export type IndicatorState = { id: string; severity: "warning" | "critical"; status: "active" | "clear"; ruleId: string; explanation: string };
export type SimulationSnapshot = {
  id: string; vehicleProfileId: string; scenarioId: string; seed: number; tick: number; tickDurationMs: number;
  values: Record<string, TelemetryValue>; events: string[]; indicators: IndicatorState[]; savedReport: boolean;
  source: "synthetic"; notice: string;
};

export type SimulationSession = { catalog: Catalog; profile: VehicleProfile; scenarioId: string; seed: number; id: string; tick: number; events: string[]; priorIndicators: Map<string, boolean>; savedReport: boolean };

function hashSeed(seed: number, text: string) {
  let hash = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x45d9f3b) >>> 0;
  return hash >>> 0;
}
function seededValue(seed: number, tick: number, signal: SignalDefinition): TelemetryValue {
  if (signal.valueType === "boolean") return hashSeed(seed + tick, signal.id) % 7 !== 0;
  if (signal.valueType === "enum") return signal.values[0]!;
  const [min, max] = signal.nominalRange;
  const known: Record<string, number> = {
    "vehicle.speed": 46, "vehicle.odometer": 18432, "vehicle.trip_distance": 12.4, "engine.rpm": 1450,
    "engine.coolant_temperature": 91, "engine.oil_pressure": 310, "engine.load": 34, "engine.fuel_level": 68,
    "engine.fuel_rate": 2.8, "transmission.temperature": 76, "electrical.system_voltage": 13.8,
    "brakes.wheel_speed_front_left": 46, "steering.angle": 0, "tires.pressure_front_left": 242,
    "body.door_open_count": 0, "ev.battery_state_of_charge": 74, "ev.pack_temperature": 31,
    "ev.pack_voltage": 412, "ev.pack_current": 32, "ev.motor_temperature": 49,
  };
  const base = known[signal.id] ?? (min + max) / 2;
  const jitter = ((hashSeed(seed, `${signal.id}:${tick}`) % 1001) / 1000 - 0.5) * Math.min((max - min) * 0.02, Math.abs(base) * 0.015 + 0.1);
  return Math.max(min, Math.min(max, Math.round((base + jitter) * 10) / 10));
}

export function createSimulationSession(catalog: Catalog, profileId: string, scenarioId: string, seed: number, id: string): SimulationSession {
  const profile = catalog.vehicles.find((vehicle) => vehicle.id === profileId);
  const scenario = catalog.scenarios.find((item) => item.id === scenarioId);
  if (!profile) throw new Error("Vehicle profile not found");
  if (!scenario) throw new Error("Scenario not found");
  if (!scenario.profiles.includes(profileId)) throw new Error("Scenario is unsupported for this vehicle profile");
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 2147483647) throw new Error("Seed must be a nonnegative 32-bit integer");
  return { catalog, profile, scenarioId, seed, id, tick: 0, events: [], priorIndicators: new Map(), savedReport: false };
}

export function advanceSimulation(session: SimulationSession, ticks: number): SimulationSnapshot {
  const scenario = session.catalog.scenarios.find((item) => item.id === session.scenarioId)!;
  if (!Number.isSafeInteger(ticks) || ticks < 1 || ticks > 1000 || session.tick + ticks > scenario.durationTicks) throw new RangeError("Advance must be 1–1000 ticks and stay within the scenario duration");
  session.tick += ticks;
  return getSimulationSnapshot(session);
}

export function getSimulationSnapshot(session: SimulationSession): SimulationSnapshot {
  const scenario = session.catalog.scenarios.find((item) => item.id === session.scenarioId)!;
  const values: Record<string, TelemetryValue> = {};
  for (const signalId of session.profile.supportedSignalIds) {
    const signal = session.catalog.signals.find((item) => item.id === signalId)!;
    values[signalId] = seededValue(session.seed, session.tick, signal);
  }
  for (const action of scenario.actions) {
    if (action.type === "emit_event" && action.atTick <= session.tick && !session.events.includes(action.eventType)) session.events.push(action.eventType);
    if (action.type === "set_signal" && action.atTick <= session.tick) values[action.signalId] = action.value;
    if (action.type === "ramp_signal" && action.atTick <= session.tick) {
      const progress = Math.min(1, Math.max(0, (session.tick - action.atTick) / action.overTicks));
      values[action.signalId] = Math.round((action.from + (action.to - action.from) * progress) * 10) / 10;
    }
  }
  const indicators: IndicatorState[] = [];
  for (const rule of session.catalog.warningRules) {
    if (!rule.profiles.includes(session.profile.id)) continue;
    let active = false;
    if ("signalId" in rule) {
      const reading = values[rule.signalId];
      const wasActive = session.priorIndicators.get(rule.id) ?? false;
      active = typeof reading === "number" ? (wasActive
        ? (rule.operator === "gte" ? reading >= rule.clearBelow : reading <= rule.clearAbove)
        : (rule.operator === "gte" ? reading >= rule.threshold : reading <= rule.threshold)) : false;
      session.priorIndicators.set(rule.id, active);
    } else active = session.events.includes(rule.eventType);
    indicators.push({ id: rule.indicatorId, severity: rule.severity, status: active ? "active" : "clear", ruleId: rule.id,
      explanation: active ? ("signalId" in rule ? `Fictional rule ${rule.id} matched ${rule.signalId} at ${String(values[rule.signalId])}.` : `Fictional event ${rule.eventType} was emitted.`) : "No matching simulated warning is active." });
  }
  return { id: session.id, vehicleProfileId: session.profile.id, scenarioId: session.scenarioId, seed: session.seed,
    tick: session.tick, tickDurationMs: scenario.tickDurationMs, values, events: [...session.events], indicators,
    savedReport: session.savedReport, source: "synthetic", notice: session.catalog.warningRuleNotice };
}

/** Foundation clock retained as a small pure primitive. */
export type SimulationClock = Readonly<{ tick: number; tickDurationMs: number }>;
export function createClock(tickDurationMs: number): SimulationClock {
  if (!Number.isSafeInteger(tickDurationMs) || tickDurationMs <= 0) throw new RangeError("Tick duration must be a positive safe integer");
  return { tick: 0, tickDurationMs };
}
export function advanceClock(clock: SimulationClock, ticks: number): SimulationClock {
  if (!Number.isSafeInteger(clock.tick) || clock.tick < 0 || !Number.isSafeInteger(clock.tickDurationMs) || clock.tickDurationMs <= 0 || !Number.isSafeInteger(ticks) || ticks < 0 || !Number.isSafeInteger(clock.tick + ticks)) throw new RangeError("Clock and advance must contain valid nonnegative safe integer ticks");
  return { ...clock, tick: clock.tick + ticks };
}
