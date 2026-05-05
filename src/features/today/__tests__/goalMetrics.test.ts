import { avgConsistencyRate, oldestStreak } from "@/features/today/goalMetrics";

describe("avgConsistencyRate", () => {
  it("returns 0 for empty array", () => {
    expect(avgConsistencyRate([])).toBe(0);
  });

  it("returns the single value for a one-habit array", () => {
    expect(avgConsistencyRate([{ consistencyRate: 0.8, startDate: "2026-01-01", streak: 5 }])).toBe(0.8);
  });

  it("averages multiple habits", () => {
    const habits = [
      { consistencyRate: 0.6, startDate: "2026-01-01", streak: 3 },
      { consistencyRate: 1.0, startDate: "2026-02-01", streak: 7 },
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
      { consistencyRate: 0.5, startDate: "2026-03-01", streak: 5 },
      { consistencyRate: 0.8, startDate: "2026-01-01", streak: 12 },
      { consistencyRate: 0.7, startDate: "2026-02-01", streak: 8 },
    ];
    expect(oldestStreak(habits)).toBe(12);
  });
});
