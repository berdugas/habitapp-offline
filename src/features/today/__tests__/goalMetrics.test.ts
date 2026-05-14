import { resetClockForTesting, setNowForTesting } from "@/utils/clock";
import {
  avgConsistencyRate,
  computeGoalStreak,
} from "@/features/today/goalMetrics";

import type { GoalStreakHabit } from "@/features/today/goalMetrics";

// 2026-04-23 is a Thursday (ISO weekday 4).
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

beforeEach(() => {
  setNowForTesting(new Date("2026-04-23T10:00:00"));
});

afterEach(() => {
  resetClockForTesting();
});

function daysAgo(n: number): string {
  const d = new Date(2026, 3, 23 - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function habit(
  logs: GoalStreakHabit["logs"],
  overrides: Partial<GoalStreakHabit> = {},
): GoalStreakHabit {
  return {
    activeDays: ALL_DAYS,
    logs,
    startDate: daysAgo(60),
    ...overrides,
  };
}

const consistency = (
  consistencyRate: number,
  consistencyDenominator: number,
) => ({ consistencyDenominator, consistencyRate });

describe("avgConsistencyRate", () => {
  it("returns null for empty array", () => {
    expect(avgConsistencyRate([])).toBeNull();
  });

  it("returns null when all habits have no data (denominator = 0)", () => {
    expect(avgConsistencyRate([consistency(0, 0)])).toBeNull();
  });

  it("excludes no-data habits from the average", () => {
    expect(avgConsistencyRate([consistency(0, 0), consistency(1, 10)])).toBe(1);
  });

  it("averages only habits with data", () => {
    expect(
      avgConsistencyRate([
        consistency(0, 0),
        consistency(0.6, 8),
        consistency(1.0, 5),
      ]),
    ).toBeCloseTo(0.8);
  });
});

describe("computeGoalStreak", () => {
  it("returns 0 for empty habits array", () => {
    expect(computeGoalStreak([], 7)).toBe(0);
  });

  it("single habit with a perfect run — goal streak equals habit streak", () => {
    const h = habit([
      { log_date: daysAgo(1), status: "done" },
      { log_date: daysAgo(2), status: "done" },
      { log_date: daysAgo(3), status: "done" },
    ]);
    expect(computeGoalStreak([h], 7)).toBe(3);
  });

  it("two habits both perfect — goal streak is length of perfect run", () => {
    const a = habit([
      { log_date: daysAgo(1), status: "done" },
      { log_date: daysAgo(2), status: "done" },
      { log_date: daysAgo(3), status: "done" },
    ]);
    const b = habit([
      { log_date: daysAgo(1), status: "done" },
      { log_date: daysAgo(2), status: "done" },
      { log_date: daysAgo(3), status: "done" },
    ]);
    expect(computeGoalStreak([a, b], 7)).toBe(3);
  });

  it("two habits, one missed yesterday — goal streak is 0", () => {
    const a = habit([
      { log_date: daysAgo(1), status: "done" },
      { log_date: daysAgo(2), status: "done" },
      { log_date: daysAgo(3), status: "done" },
    ]);
    const b = habit([
      { log_date: daysAgo(1), status: "missed" },
      { log_date: daysAgo(2), status: "done" },
      { log_date: daysAgo(3), status: "done" },
    ]);
    expect(computeGoalStreak([a, b], 7)).toBe(0);
  });

  it("isolated goal-miss sandwiched between goal-done days — streak continues", () => {
    const a = habit([
      { log_date: daysAgo(1), status: "done" },
      { log_date: daysAgo(2), status: "missed" },
      { log_date: daysAgo(3), status: "done" },
      { log_date: daysAgo(4), status: "done" },
    ]);
    const b = habit([
      { log_date: daysAgo(1), status: "done" },
      { log_date: daysAgo(2), status: "done" },
      { log_date: daysAgo(3), status: "done" },
      { log_date: daysAgo(4), status: "done" },
    ]);
    expect(computeGoalStreak([a, b], 7)).toBe(3);
  });

  it("two consecutive goal-misses from different habits — streak breaks", () => {
    const a = habit([
      { log_date: daysAgo(1), status: "done" },
      { log_date: daysAgo(2), status: "missed" },
      { log_date: daysAgo(3), status: "done" },
      { log_date: daysAgo(4), status: "done" },
    ]);
    const b = habit([
      { log_date: daysAgo(1), status: "missed" },
      { log_date: daysAgo(2), status: "done" },
      { log_date: daysAgo(3), status: "done" },
      { log_date: daysAgo(4), status: "done" },
    ]);
    expect(computeGoalStreak([a, b], 7)).toBe(0);
  });

  it("new habit added mid-streak — counted only from its startDate forward", () => {
    const old = habit(
      [
        { log_date: daysAgo(1), status: "done" },
        { log_date: daysAgo(2), status: "done" },
        { log_date: daysAgo(3), status: "done" },
        { log_date: daysAgo(4), status: "done" },
        { log_date: daysAgo(5), status: "done" },
      ],
      { startDate: daysAgo(60) },
    );
    const fresh = habit(
      [
        { log_date: daysAgo(1), status: "done" },
        { log_date: daysAgo(2), status: "done" },
      ],
      { startDate: daysAgo(2) },
    );
    expect(computeGoalStreak([old, fresh], 7)).toBe(5);
  });

  it("off-day for one habit, others done — day classifies as goal-done", () => {
    // Yesterday = 2026-04-22, Wednesday (ISO weekday 3).
    // Habit B's activeDays exclude Wed, so on Wed only A is on duty.
    const a = habit([{ log_date: daysAgo(1), status: "done" }]);
    const b = habit([], { activeDays: [1, 2, 4, 5, 6, 7] });
    expect(computeGoalStreak([a, b], 3)).toBe(1);
  });

  it("all habits off-day on a day — day omitted entirely", () => {
    // Active only on Thursday (ISO 4). TODAY (2026-04-23) is Thursday — both
    // habits are on duty today but unlogged → today is omitted. Other days in
    // the window are not Thursday → omitted. Empty sequence → 0.
    const a = habit([], { activeDays: [4] });
    const b = habit([], { activeDays: [4] });
    expect(computeGoalStreak([a, b], 3)).toBe(0);
  });

  it("skipped status is neutral", () => {
    const a = habit([
      { log_date: daysAgo(1), status: "skipped" },
      { log_date: daysAgo(2), status: "done" },
    ]);
    const b = habit([
      { log_date: daysAgo(1), status: "done" },
      { log_date: daysAgo(2), status: "done" },
    ]);
    // d1: A skipped (neutral), B done → goal-done. d2: both done → goal-done.
    expect(computeGoalStreak([a, b], 7)).toBe(2);
  });

  it("all on-duty habits skipped on a day — day omitted (not counted as goal-done)", () => {
    const a = habit([
      { log_date: daysAgo(1), status: "skipped" },
      { log_date: daysAgo(2), status: "done" },
      { log_date: daysAgo(3), status: "done" },
    ]);
    const b = habit([
      { log_date: daysAgo(1), status: "skipped" },
      { log_date: daysAgo(2), status: "done" },
      { log_date: daysAgo(3), status: "done" },
    ]);
    expect(computeGoalStreak([a, b], 7)).toBe(2);
  });

  it("today unlogged — today skipped, streak walked back from yesterday", () => {
    const a = habit([
      { log_date: daysAgo(1), status: "done" },
      { log_date: daysAgo(2), status: "done" },
    ]);
    const b = habit([
      { log_date: daysAgo(1), status: "done" },
      { log_date: daysAgo(2), status: "done" },
    ]);
    expect(computeGoalStreak([a, b], 7)).toBe(2);
  });

  it("single-habit goal — matches habit-level forgiving streak (regression)", () => {
    const single = habit([
      { log_date: daysAgo(1), status: "done" },
      { log_date: daysAgo(2), status: "missed" },
      { log_date: daysAgo(3), status: "done" },
      { log_date: daysAgo(4), status: "done" },
    ]);
    expect(computeGoalStreak([single], 7)).toBe(3);
  });
});
