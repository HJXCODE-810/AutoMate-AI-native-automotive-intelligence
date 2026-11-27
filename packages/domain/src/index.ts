import { z } from "zod";

const id = z.string().min(1).regex(/^[a-z][a-z0-9._-]*$/);
const range = z.tuple([z.number().finite(), z.number().finite()])
  .refine(([min, max]) => min <= max, "Range minimum must not exceed maximum");
const signalBase = {
  id,
  subsystemId: id,
  updatePeriodMs: z.number().int().positive(),
};

export const signalSchema = z.discriminatedUnion("valueType", [
  z.object({
    ...signalBase,
    valueType: z.literal("number"),
    unit: z.enum(["km/h", "km", "rpm", "degC", "kPa", "%", "L/h", "V", "deg", "count", "A"]),
    validRange: range,
    nominalRange: range,
  }).strict().refine((signal) => signal.nominalRange[0] >= signal.validRange[0]
    && signal.nominalRange[1] <= signal.validRange[1], "Nominal range must fit inside valid range"),
  z.object({ ...signalBase, valueType: z.literal("enum"), unit: z.literal(""), values: z.array(z.string().min(1)).min(1) }).strict()
    .refine((signal) => new Set(signal.values).size === signal.values.length, "Duplicate enum values"),
  z.object({ ...signalBase, valueType: z.literal("boolean"), unit: z.literal("") }).strict(),
]);
export type SignalDefinition = z.infer<typeof signalSchema>;

export const vehicleSchema = z.object({
  id,
  displayName: z.string().min(1),
  segment: id,
  powertrain: z.enum(["petrol_ice", "diesel_ice", "battery_electric"]),
  fictional: z.literal(true),
  clusterConfigId: id,
  supportedSignalIds: z.array(id),
  unsupportedSignalIds: z.array(id),
}).strict();
export type VehicleProfile = z.infer<typeof vehicleSchema>;

const ruleBase = { id, severity: z.enum(["warning", "critical"]), indicatorId: id, profiles: z.array(id).min(1) };
export const warningRuleSchema = z.union([
  z.object({ ...ruleBase, signalId: id, operator: z.literal("gte"), threshold: z.number().finite(), clearBelow: z.number().finite() }).strict()
    .refine((rule) => rule.clearBelow < rule.threshold, "Clear threshold must be below activation"),
  z.object({ ...ruleBase, signalId: id, operator: z.literal("lte"), threshold: z.number().finite(), clearAbove: z.number().finite() }).strict()
    .refine((rule) => rule.clearAbove > rule.threshold, "Clear threshold must be above activation"),
  z.object({ ...ruleBase, eventType: id, condition: z.literal("event_present") }).strict(),
]);

export const scenarioActionSchema = z.discriminatedUnion("type", [
  z.object({ atTick: z.number().int().nonnegative(), type: z.literal("set_signal"), signalId: id, value: z.union([z.number().finite(), z.boolean(), z.string()]) }).strict(),
  z.object({ atTick: z.number().int().nonnegative(), type: z.literal("ramp_signal"), signalId: id, from: z.number().finite(), to: z.number().finite(), overTicks: z.number().int().positive() }).strict(),
  z.object({ atTick: z.number().int().nonnegative(), type: z.literal("emit_event"), eventType: id }).strict(),
]);
export const scenarioSchema = z.object({
  id,
  profiles: z.array(id).min(1),
  durationTicks: z.number().int().positive(),
  tickDurationMs: z.number().int().positive(),
  actions: z.array(scenarioActionSchema),
}).strict();

export const catalogSchema = z.object({
  catalogVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  provenance: z.literal("synthetic"),
  notice: z.string().min(1),
  warningRuleNotice: z.string().min(1),
  knowledgeBasis: z.literal("fictional_demo"),
  rangeNotice: z.string().min(1),
  manufacturerEvidenceFile: z.string().min(1),
  manufacturerEvidencePolicy: z.string().min(1),
  subsystems: z.array(z.object({ id, name: z.string().min(1) }).strict()).min(1),
  signals: z.array(signalSchema).min(1),
  vehicles: z.array(vehicleSchema).min(1),
  warningRules: z.array(warningRuleSchema),
  scenarios: z.array(scenarioSchema),
}).strict();
export type Catalog = z.infer<typeof catalogSchema>;

export const capabilitySchema = z.object({
  vehicleProfileId: id,
  signalId: id,
  availability: z.enum(["supported", "unsupported", "unknown"]),
  reason: z.string().min(1),
  definition: signalSchema,
  readingStatus: z.enum(["not_started", "unavailable"]),
  value: z.null(),
}).strict();
export type CapabilityResult = z.infer<typeof capabilitySchema>;

export const vehicleSummarySchema = vehicleSchema.omit({ supportedSignalIds: true, unsupportedSignalIds: true }).extend({
  supportedCount: z.number().int().nonnegative(),
  unsupportedCount: z.number().int().nonnegative(),
  unknownCount: z.number().int().nonnegative(),
});
export type VehicleSummary = z.infer<typeof vehicleSummarySchema>;
export const vehicleListResponseSchema = z.object({
  catalogVersion: z.string(),
  source: z.literal("synthetic"),
  notice: z.string(),
  vehicles: z.array(vehicleSummarySchema),
}).strict();
export const vehicleDetailResponseSchema = z.object({
  catalogVersion: z.string(),
  source: z.literal("synthetic"),
  knowledgeBasis: z.literal("fictional_demo"),
  notice: z.string(),
  rangeNotice: z.string(),
  vehicle: vehicleSummarySchema,
  subsystems: z.array(z.object({ id: z.string(), name: z.string() }).strict()),
  capabilities: z.array(capabilitySchema),
  scenarios: z.array(z.object({ id: z.string(), durationTicks: z.number().int().positive(), tickDurationMs: z.number().int().positive() }).strict()),
  simulationStatus: z.literal("ready"),
}).strict();
export type VehicleDetail = z.infer<typeof vehicleDetailResponseSchema>;
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("automate-api"),
  catalogVersion: z.string(),
  simulation: z.literal("ready"),
  durability: z.enum(["in_memory", "postgresql"]),
}).strict();
