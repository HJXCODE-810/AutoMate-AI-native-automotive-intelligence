/** Foundation boundary only: no telemetry, fault execution, or warning evaluation yet. */
export type SimulationClock = Readonly<{ tick: number; tickDurationMs: number }>;

export function createClock(tickDurationMs: number): SimulationClock {
  if (!Number.isSafeInteger(tickDurationMs) || tickDurationMs <= 0) {
    throw new RangeError("Tick duration must be a positive safe integer");
  }
  return { tick: 0, tickDurationMs };
}

export function advanceClock(clock: SimulationClock, ticks: number): SimulationClock {
  if (!Number.isSafeInteger(clock.tick) || clock.tick < 0
    || !Number.isSafeInteger(clock.tickDurationMs) || clock.tickDurationMs <= 0
    || !Number.isSafeInteger(ticks) || ticks < 0 || !Number.isSafeInteger(clock.tick + ticks)) {
    throw new RangeError("Clock and advance must contain valid nonnegative safe integer ticks");
  }
  return { ...clock, tick: clock.tick + ticks };
}
