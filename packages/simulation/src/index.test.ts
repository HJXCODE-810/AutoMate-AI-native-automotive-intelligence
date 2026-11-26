import { describe, expect, it } from "vitest";
import { advanceClock, createClock } from "./index.ts";

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
