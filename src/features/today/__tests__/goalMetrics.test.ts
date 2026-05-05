import { avgConsistencyRate, oldestStreak } from "@/features/today/goalMetrics";

const habit = (consistencyRate: number, consistencyDenominator: number, startDate = "2026-01-01", streak = 0) => ({
  consistencyDenominator,
  consistencyRate,
  startDate,
  streak,
});

describe("avgConsistencyRate", () => {
  it("returns null for empty array", () => {
    expect(avgConsistencyRate([])).toBeNull();
  });

  it("returns null when all habits have no data (denominator = 0)", () => {
    expect(avgConsistencyRate([habit(0, 0)])).toBeNull();
  });

  it("returns the rate of the single habit with data", () => {
    expect(avgConsistencyRate([habit(0.8, 10)])).toBeCloseTo(0.8);
  });

  it("excludes no-data habits from the average — core bug case", () => {
    // One active habit at 100%, one brand-new habit with no logs
    expect(avgConsistencyRate([habit(0, 0), habit(1, 10)])).toBe(1);
  });

  it("includes a genuinely failing habit (denominator > 0, rate = 0)", () => {
    // A habit that has been active but never done should count as 0%
    expect(avgConsistencyRate([habit(0, 5)])).toBe(0);
  });

  it("averages only the habits that have data", () => {
    const habits = [
      habit(0, 0),   // no data — excluded
      habit(0.6, 8), // has data
      habit(1.0, 5), // has data
    ];
    expect(avgConsistencyRate(habits)).toBeCloseTo(0.8);
  });
});

describe("oldestStreak", () => {
  it("returns 0 for empty array", () => {
    expect(oldestStreak([])).toBe(0);
  });

  it("returns the streak of the oldest habit (earliest startDate)", () => {
    const habits = [
      habit(0.5, 10, "2026-03-01", 5),
      habit(0.8, 10, "2026-01-01", 12),
      habit(0.7, 10, "2026-02-01", 8),
    ];
    expect(oldestStreak(habits)).toBe(12);
  });
});
