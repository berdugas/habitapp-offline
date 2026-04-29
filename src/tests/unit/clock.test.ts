import {
  now,
  nowIso,
  resetClockForTesting,
  setNowForTesting,
  todayDateString,
} from "@/utils/clock";

afterEach(() => {
  resetClockForTesting();
});

describe("now()", () => {
  it("returns a Date close to real time when no override is set", () => {
    const before = Date.now();
    const result = now();
    const after = Date.now();
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

  it("returns the fixed Date when frozen via setNowForTesting(Date)", () => {
    const fixed = new Date("2026-04-23T10:00:00.000Z");
    setNowForTesting(fixed);
    expect(now().toISOString()).toBe(fixed.toISOString());
    // Each call returns a fresh copy (not the same reference)
    expect(now()).not.toBe(now());
  });

  it("calls the provider function on each invocation when set via setNowForTesting(() => Date)", () => {
    let counter = 0;
    const dates = [
      new Date("2026-04-23T10:00:00.000Z"),
      new Date("2026-04-24T10:00:00.000Z"),
    ];
    setNowForTesting(() => dates[counter++] ?? new Date());
    expect(now().toISOString()).toBe(dates[0]!.toISOString());
    expect(now().toISOString()).toBe(dates[1]!.toISOString());
  });
});

describe("nowIso()", () => {
  it("returns now().toISOString()", () => {
    setNowForTesting(new Date("2026-04-23T10:00:00.000Z"));
    expect(nowIso()).toBe("2026-04-23T10:00:00.000Z");
  });
});

describe("resetClockForTesting()", () => {
  it("restores real-time behaviour after a freeze", () => {
    setNowForTesting(new Date("2000-01-01T00:00:00.000Z"));
    expect(now().getFullYear()).toBe(2000);
    resetClockForTesting();
    expect(now().getFullYear()).toBeGreaterThan(2020);
  });
});

describe("todayDateString()", () => {
  it("returns the device-local YYYY-MM-DD for a midnight-adjacent time", () => {
    // 23:59 on Apr 23 in device-local time must still return 2026-04-23
    setNowForTesting(new Date(2026, 3, 23, 23, 59, 0)); // month is 0-based
    expect(todayDateString()).toBe("2026-04-23");
  });

  it("returns the next day's date just after midnight", () => {
    setNowForTesting(new Date(2026, 3, 24, 0, 0, 1));
    expect(todayDateString()).toBe("2026-04-24");
  });
});
