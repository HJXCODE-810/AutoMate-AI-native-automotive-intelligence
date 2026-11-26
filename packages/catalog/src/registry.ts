import { catalogSchema, type Catalog, type CapabilityResult, type SignalDefinition, type VehicleProfile, type VehicleSummary } from "@automate/domain";

function unique(items: readonly string[], label: string) {
  if (new Set(items).size !== items.length) throw new Error(`Duplicate ${label}`);
}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function validValue(signal: SignalDefinition, value: unknown): boolean {
  if (signal.valueType === "number") return typeof value === "number" && Number.isFinite(value)
    && value >= signal.validRange[0] && value <= signal.validRange[1];
  if (signal.valueType === "boolean") return typeof value === "boolean";
  return typeof value === "string" && signal.values.includes(value);
}

/** Validate the fictional catalog only. Manufacturer observations are never imported here. */
export function parseCatalog(input: unknown): Catalog {
  const catalog = catalogSchema.parse(input);
  for (const key of ["subsystems", "signals", "vehicles", "warningRules", "scenarios"] as const) {
    unique(catalog[key].map((item) => item.id), `${key} ID`);
  }
  const signals = new Map(catalog.signals.map((signal) => [signal.id, signal]));
  const profiles = new Map(catalog.vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const subsystemIds = new Set(catalog.subsystems.map((system) => system.id));
  for (const signal of catalog.signals) {
    check(subsystemIds.has(signal.subsystemId), `Unknown subsystem for ${signal.id}`);
  }
  for (const vehicle of catalog.vehicles) {
    const assignments = [...vehicle.supportedSignalIds, ...vehicle.unsupportedSignalIds];
    unique(assignments, `capability assignment for ${vehicle.id}`);
    for (const signalId of assignments) check(signals.has(signalId), `Unknown signal ${signalId} on ${vehicle.id}`);
  }
  const checkProfiles = (ids: string[], signalId?: string) => {
    unique(ids, "profile reference");
    for (const profileId of ids) {
      const profile = profiles.get(profileId);
      check(profile, `Unknown profile ${profileId}`);
      if (signalId) check(profile.supportedSignalIds.includes(signalId), `Unsupported signal ${signalId} on ${profileId}`);
    }
  };
  const eventProfiles = new Map<string, Set<string>>();
  for (const rule of catalog.warningRules) {
    checkProfiles(rule.profiles);
    if ("signalId" in rule) {
      const signal = signals.get(rule.signalId);
      check(signal?.valueType === "number", `Rule ${rule.id} requires a numeric signal`);
      checkProfiles(rule.profiles, rule.signalId);
      const clear = "clearBelow" in rule ? rule.clearBelow : rule.clearAbove;
      check(validValue(signal, rule.threshold) && validValue(signal, clear), `Rule ${rule.id} threshold outside signal range`);
    } else {
      const supportedProfiles = eventProfiles.get(rule.eventType) ?? new Set<string>();
      for (const profileId of rule.profiles) supportedProfiles.add(profileId);
      eventProfiles.set(rule.eventType, supportedProfiles);
    }
  }
  for (const scenario of catalog.scenarios) {
    checkProfiles(scenario.profiles);
    let previousTick = -1;
    for (const action of scenario.actions) {
      check(action.atTick >= previousTick, `Unordered actions in ${scenario.id}`);
      previousTick = action.atTick;
      check(action.atTick <= scenario.durationTicks, `Action outside duration in ${scenario.id}`);
      if (action.type === "emit_event") {
        const supportedProfiles = eventProfiles.get(action.eventType);
        check(supportedProfiles, `Unknown scenario event ${action.eventType}`);
        for (const profileId of scenario.profiles) {
          check(supportedProfiles.has(profileId), `Scenario ${scenario.id} event ${action.eventType} unsupported on ${profileId}`);
        }
      } else {
        const signal = signals.get(action.signalId);
        check(signal, `Unknown scenario signal ${action.signalId}`);
        checkProfiles(scenario.profiles, signal.id);
        if (action.type === "set_signal") {
          check(validValue(signal, action.value), `Invalid scenario value for ${signal.id}`);
        } else {
          check(signal.valueType === "number", `Ramp needs a numeric signal: ${signal.id}`);
          check(action.atTick + action.overTicks <= scenario.durationTicks, `Ramp outside duration in ${scenario.id}`);
          check(validValue(signal, action.from) && validValue(signal, action.to), `Invalid ramp range for ${signal.id}`);
        }
      }
    }
  }
  return catalog;
}

/** Registry methods return detached results so callers cannot mutate the canonical catalog. */
export function createRegistry(input: unknown) {
  const catalog = parseCatalog(input);
  const findVehicle = (id: string) => catalog.vehicles.find((vehicle) => vehicle.id === id);
  function resolve(vehicle: VehicleProfile, signal: SignalDefinition): CapabilityResult {
    const availability = vehicle.supportedSignalIds.includes(signal.id) ? "supported"
      : vehicle.unsupportedSignalIds.includes(signal.id) ? "unsupported" : "unknown";
    return {
      vehicleProfileId: vehicle.id,
      signalId: signal.id,
      availability,
      reason: availability === "supported" ? "Enabled for this fictional simulation profile."
        : availability === "unsupported" ? "Not included in this fictional profile; this is not a real-car equipment claim."
          : "No capability assignment exists; support must not be assumed.",
      definition: structuredClone(signal),
      readingStatus: availability === "supported" ? "not_started" : "unavailable",
      value: null,
    };
  }
  function summary(vehicle: VehicleProfile): VehicleSummary {
    const { supportedSignalIds, unsupportedSignalIds, ...identity } = vehicle;
    return {
      ...identity,
      supportedCount: supportedSignalIds.length,
      unsupportedCount: unsupportedSignalIds.length,
      unknownCount: catalog.signals.length - supportedSignalIds.length - unsupportedSignalIds.length,
    };
  }
  return {
    version: catalog.catalogVersion,
    listVehicles() {
      return { catalogVersion: catalog.catalogVersion, source: catalog.provenance, notice: catalog.notice, vehicles: catalog.vehicles.map(summary) };
    },
    resolveCapability(vehicleId: string, signalId: string): CapabilityResult | undefined {
      const vehicle = findVehicle(vehicleId);
      const signal = catalog.signals.find((item) => item.id === signalId);
      return vehicle && signal ? resolve(vehicle, signal) : undefined;
    },
    getVehicle(vehicleId: string) {
      const vehicle = findVehicle(vehicleId);
      if (!vehicle) return undefined;
      return {
        catalogVersion: catalog.catalogVersion,
        source: catalog.provenance,
        knowledgeBasis: catalog.knowledgeBasis,
        notice: catalog.notice,
        rangeNotice: catalog.rangeNotice,
        vehicle: summary(vehicle),
        subsystems: structuredClone(catalog.subsystems),
        capabilities: catalog.signals.map((signal) => resolve(vehicle, signal)),
        scenarios: catalog.scenarios.filter((scenario) => scenario.profiles.includes(vehicleId))
          .map(({ id, durationTicks, tickDurationMs }) => ({ id, durationTicks, tickDurationMs })),
        simulationStatus: "ready" as const,
      };
    },
  };
}
export type Registry = ReturnType<typeof createRegistry>;
