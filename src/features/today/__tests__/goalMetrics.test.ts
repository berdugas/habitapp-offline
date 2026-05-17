import { resetClockForTesting, setNowForTesting } from "@/utils/clock";
import {
  computeGoalDailyStates,
  computeGoalStreak,
  computeWeeklyConsistency,
  pooledConsistencyRate,
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

describe("pooledConsistencyRate", () => {
  // 2026-04-23 is Thursday (ISO weekday 4).
  const endDate = new Date("2026-04-23T12:00:00");
  const todayIso = iso(2026, 4, 23);
  const OFF_TODAY_DAYS = [1, 2, 3, 5, 6, 7]; // every weekday except Thursday.

  it("returns null for empty habits", () => {
    expect(
      pooledConsistencyRate({ habits: [], endDate, windowDays: 30 }),
    ).toBeNull();
  });

  it("user's screenshot scenario: two daily habits started today, one done, one unlogged → 0.5", () => {
    const done = habit([{ log_date: todayIso, status: "done" }], {
      startDate: todayIso,
    });
    const unlogged = habit([], { startDate: todayIso });
    expect(
      pooledConsistencyRate({
        habits: [done, unlogged],
        endDate,
        windowDays: 30,
      }),
    ).toBe(0.5);
  });

  it("brand-new daily goal, no checks yet → 0 (accepted day-one trade-off)", () => {
    const a = habit([], { startDate: todayIso });
    const b = habit([], { startDate: todayIso });
    expect(
      pooledConsistencyRate({ habits: [a, b], endDate, windowDays: 30 }),
    ).toBe(0);
  });

  it("reachable null: single habit started today is off-duty today → null", () => {
    // M/W/F habit added on a Thursday — eligible by start_date <= today but
    // not active today. No past active days. denominator = 0 → null.
    const offToday = habit([], {
      startDate: todayIso,
      activeDays: OFF_TODAY_DAYS,
    });
    expect(
      pooledConsistencyRate({ habits: [offToday], endDate, windowDays: 30 }),
    ).toBeNull();
  });

  it("pre-start unit edge: every habit's startDate is after the window end → null", () => {
    const future = habit([], { startDate: iso(2026, 5, 1) });
    expect(
      pooledConsistencyRate({ habits: [future], endDate, windowDays: 30 }),
    ).toBeNull();
  });

  it("past active days with no log count toward denominator as misses", () => {
    // 4 days of history, all unlogged. 4 active days, 0 done → 0.
    const h = habit([], { startDate: daysAgo(3) });
    expect(
      pooledConsistencyRate({ habits: [h], endDate, windowDays: 30 }),
    ).toBe(0);
  });

  it("mixed activeDays: one habit on-duty today, one off-duty today", () => {
    // 'on' is daily, started 1 day ago. 'off' is M/W/F (excludes Thu), started today.
    // 'on' contributes: yesterday (Wed, active, unlogged → miss), today (Thu, active, unlogged → miss).
    //    Of yesterday + today: 2 active days, 0 done.
    // 'off' contributes: today off-duty, started today so no past days → 0 active days.
    // Pool: 0 / 2 = 0.
    const on = habit([], { startDate: daysAgo(1) });
    const off = habit([], { startDate: todayIso, activeDays: OFF_TODAY_DAYS });
    expect(
      pooledConsistencyRate({ habits: [on, off], endDate, windowDays: 30 }),
    ).toBe(0);
  });

  it("skipped days are neutral (no num, no denom)", () => {
    const h = habit(
      [
        { log_date: todayIso, status: "skipped" },
        { log_date: daysAgo(1), status: "done" },
      ],
      { startDate: daysAgo(1) },
    );
    // 2 days in window for this habit: today skipped (neutral), yesterday done.
    // 1 done / 1 active = 1.0.
    expect(
      pooledConsistencyRate({ habits: [h], endDate, windowDays: 30 }),
    ).toBe(1);
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

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

describe("computeWeeklyConsistency", () => {
  // For these tests, 2026-04-20 is a Monday (verifiable: 2026-04-23 Thursday in
  // the outer beforeEach implies 2026-04-20 = Monday of the same ISO week).

  it("returns [] for empty habits", () => {
    expect(
      computeWeeklyConsistency([], iso(2026, 4, 20), new Date("2026-04-26T12:00:00")),
    ).toEqual([]);
  });

  it("single complete week with all done → [{W1, 1.0}]", () => {
    setNowForTesting(new Date("2026-04-26T10:00:00")); // Sunday — week is complete
    const h = habit(
      [
        { log_date: iso(2026, 4, 20), status: "done" },
        { log_date: iso(2026, 4, 21), status: "done" },
        { log_date: iso(2026, 4, 22), status: "done" },
        { log_date: iso(2026, 4, 23), status: "done" },
        { log_date: iso(2026, 4, 24), status: "done" },
        { log_date: iso(2026, 4, 25), status: "done" },
        { log_date: iso(2026, 4, 26), status: "done" },
      ],
      { startDate: iso(2026, 4, 20) },
    );
    const result = computeWeeklyConsistency(
      [h],
      iso(2026, 4, 20),
      new Date("2026-04-26T12:00:00"),
    );
    expect(result).toEqual([{ weekLabel: "W1", rate: 1 }]);
  });

  it("two complete weeks with mixed rates", () => {
    setNowForTesting(new Date("2026-04-26T10:00:00")); // Sunday of W2
    const h = habit(
      [
        // W1: 2026-04-13 (Mon) to 2026-04-19 (Sun) — 3 done, 4 missed
        { log_date: iso(2026, 4, 13), status: "done" },
        { log_date: iso(2026, 4, 14), status: "done" },
        { log_date: iso(2026, 4, 15), status: "done" },
        { log_date: iso(2026, 4, 16), status: "missed" },
        { log_date: iso(2026, 4, 17), status: "missed" },
        { log_date: iso(2026, 4, 18), status: "missed" },
        { log_date: iso(2026, 4, 19), status: "missed" },
        // W2: 4 done, 3 missed
        { log_date: iso(2026, 4, 20), status: "done" },
        { log_date: iso(2026, 4, 21), status: "done" },
        { log_date: iso(2026, 4, 22), status: "done" },
        { log_date: iso(2026, 4, 23), status: "done" },
        { log_date: iso(2026, 4, 24), status: "missed" },
        { log_date: iso(2026, 4, 25), status: "missed" },
        { log_date: iso(2026, 4, 26), status: "missed" },
      ],
      { startDate: iso(2026, 4, 13) },
    );
    const result = computeWeeklyConsistency(
      [h],
      iso(2026, 4, 13),
      new Date("2026-04-26T12:00:00"),
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ weekLabel: "W1", rate: 3 / 7 });
    expect(result[1]).toEqual({ weekLabel: "W2", rate: 4 / 7 });
  });

  it("skipped days are excluded from both numerator and denominator", () => {
    setNowForTesting(new Date("2026-04-26T10:00:00"));
    const h = habit(
      [
        { log_date: iso(2026, 4, 20), status: "done" },
        { log_date: iso(2026, 4, 21), status: "skipped" }, // excluded
        { log_date: iso(2026, 4, 22), status: "done" },
        { log_date: iso(2026, 4, 23), status: "skipped" }, // excluded
        { log_date: iso(2026, 4, 24), status: "done" },
        { log_date: iso(2026, 4, 25), status: "done" },
        { log_date: iso(2026, 4, 26), status: "done" },
      ],
      { startDate: iso(2026, 4, 20) },
    );
    const [w1] = computeWeeklyConsistency(
      [h],
      iso(2026, 4, 20),
      new Date("2026-04-26T12:00:00"),
    );
    // 5 done / 5 active (2 skipped excluded entirely) = 1.0
    expect(w1.rate).toBe(1);
  });

  it("midweek goal start (Wed) → W1 counts only from Wed–Sun", () => {
    setNowForTesting(new Date("2026-04-26T10:00:00"));
    const h = habit(
      [
        // Wed-Sun all done; Mon/Tue are pre-start
        { log_date: iso(2026, 4, 22), status: "done" },
        { log_date: iso(2026, 4, 23), status: "done" },
        { log_date: iso(2026, 4, 24), status: "done" },
        { log_date: iso(2026, 4, 25), status: "done" },
        { log_date: iso(2026, 4, 26), status: "done" },
      ],
      { startDate: iso(2026, 4, 22) }, // Wednesday
    );
    const result = computeWeeklyConsistency(
      [h],
      iso(2026, 4, 20), // Monday — caller already snapped
      new Date("2026-04-26T12:00:00"),
    );
    // Only Wed–Sun count: 5 done / 5 = 1.0. Mon/Tue pre-start, not NaN.
    expect(result).toEqual([{ weekLabel: "W1", rate: 1 }]);
  });

  it("current incomplete week with future days excluded (2 done / 3 active = 0.67)", () => {
    setNowForTesting(new Date("2026-04-22T10:00:00")); // Wednesday
    const h = habit(
      [
        { log_date: iso(2026, 4, 20), status: "done" }, // Mon
        { log_date: iso(2026, 4, 21), status: "done" }, // Tue
        // Wed (today) unlogged
        // Thu/Fri/Sat/Sun: future, excluded
      ],
      { startDate: iso(2026, 4, 20) },
    );
    const result = computeWeeklyConsistency(
      [h],
      iso(2026, 4, 20),
      new Date("2026-04-22T12:00:00"),
    );
    // 2 done / 3 active (Mon, Tue, Wed). Thu/Fri/Sat/Sun ignored.
    expect(result).toHaveLength(1);
    expect(result[0].weekLabel).toBe("W1");
    expect(result[0].rate).toBeCloseTo(2 / 3);
  });

  it("current week with zero logged activity is excluded entirely", () => {
    setNowForTesting(new Date("2026-04-22T10:00:00")); // Wednesday of W2
    const h = habit(
      [
        // W1 fully done
        { log_date: iso(2026, 4, 13), status: "done" },
        { log_date: iso(2026, 4, 14), status: "done" },
        { log_date: iso(2026, 4, 15), status: "done" },
        { log_date: iso(2026, 4, 16), status: "done" },
        { log_date: iso(2026, 4, 17), status: "done" },
        { log_date: iso(2026, 4, 18), status: "done" },
        { log_date: iso(2026, 4, 19), status: "done" },
        // W2: no logs at all
      ],
      { startDate: iso(2026, 4, 13) },
    );
    const result = computeWeeklyConsistency(
      [h],
      iso(2026, 4, 13),
      new Date("2026-04-22T12:00:00"),
    );
    // W2 excluded — no logged activity. Only W1 returned.
    expect(result).toEqual([{ weekLabel: "W1", rate: 1 }]);
  });

  it("caps output at 12 entries and relabels sequentially from W1", () => {
    setNowForTesting(new Date("2026-04-26T10:00:00")); // Sunday
    // 15 weeks of done logs ending on the current Sunday
    const logs: GoalStreakHabit["logs"] = [];
    for (let w = 0; w < 15; w++) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(2026, 3, 26 - w * 7 - d);
        logs.push({
          log_date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
          status: "done",
        });
      }
    }
    const h = habit(logs, { startDate: iso(2026, 1, 1) });
    // chartStart is the Monday 14 weeks before the current Sunday
    const chartStart = new Date(2026, 3, 26 - 14 * 7 - 6); // 14 weeks back, Monday
    const chartStartIso = `${chartStart.getFullYear()}-${String(chartStart.getMonth() + 1).padStart(2, "0")}-${String(chartStart.getDate()).padStart(2, "0")}`;
    const result = computeWeeklyConsistency(
      [h],
      chartStartIso,
      new Date("2026-04-26T12:00:00"),
    );
    expect(result.length).toBeLessThanOrEqual(12);
    // Labels must always start at W1 regardless of how many were trimmed.
    expect(result[0].weekLabel).toBe("W1");
    expect(result[result.length - 1].weekLabel).toBe(`W${result.length}`);
  });
});

describe("computeGoalDailyStates", () => {
  // Outer beforeEach sets today = 2026-04-23 (Thursday).
  // 14-day window: 2026-04-10 (Fri) through 2026-04-23 (Thu).

  it("returns exactly windowDays entries (14), oldest first", () => {
    const h = habit([], { startDate: daysAgo(60) });
    const states = computeGoalDailyStates([h], 14);
    expect(states).toHaveLength(14);
  });

  it("all done for 14 days → all 'done' (today is 'today' since unlogged)", () => {
    const logs: GoalStreakHabit["logs"] = [];
    for (let n = 1; n <= 13; n++) {
      logs.push({ log_date: daysAgo(n), status: "done" });
    }
    const h = habit(logs, { startDate: daysAgo(60) });
    const states = computeGoalDailyStates([h], 14);
    expect(states.slice(0, 13)).toEqual(Array(13).fill("done"));
    expect(states[13]).toBe("today");
  });

  it("one missed day → that day is 'missed'", () => {
    const a = habit(
      [
        { log_date: daysAgo(5), status: "done" },
        { log_date: daysAgo(4), status: "done" },
        { log_date: daysAgo(3), status: "missed" },
        { log_date: daysAgo(2), status: "done" },
        { log_date: daysAgo(1), status: "done" },
      ],
      { startDate: daysAgo(60) },
    );
    const states = computeGoalDailyStates([a], 14);
    expect(states[10]).toBe("missed"); // index 10 = daysAgo(3) when oldest-first
  });

  it("partial today (one done, one unlogged) → today is still 'today'", () => {
    const todayIso = iso(2026, 4, 23);
    const a = habit(
      [{ log_date: todayIso, status: "done" }],
      { startDate: daysAgo(60) },
    );
    const b = habit([], { startDate: daysAgo(60) });
    const states = computeGoalDailyStates([a, b], 14);
    expect(states[13]).toBe("today");
  });

  it("weekday-only habits on a Saturday → 'off'", () => {
    // 2026-04-18 = Saturday (ISO weekday 6)
    const a = habit([], {
      startDate: daysAgo(60),
      activeDays: [1, 2, 3, 4, 5],
    });
    const states = computeGoalDailyStates([a], 14);
    // index of 2026-04-18 (5 days ago from Thu 04-23): daysAgo(5) → index 8
    expect(states[8]).toBe("off");
  });

  it("days before any habit's startDate → 'pre-start'", () => {
    const h = habit([], { startDate: daysAgo(5) });
    const states = computeGoalDailyStates([h], 14);
    // Oldest-first: state[N] is (13-N) days ago. startDate = 5 days ago is the
    // first eligible day → state[8]. Days before (state[0]..state[7]) are pre-start.
    expect(states[0]).toBe("pre-start");
    expect(states[7]).toBe("pre-start");
    expect(states[8]).not.toBe("pre-start");
  });

  it("all active habits skipped → 'skipped'", () => {
    const a = habit(
      [{ log_date: daysAgo(3), status: "skipped" }],
      { startDate: daysAgo(60) },
    );
    const b = habit(
      [{ log_date: daysAgo(3), status: "skipped" }],
      { startDate: daysAgo(60) },
    );
    const states = computeGoalDailyStates([a, b], 14);
    expect(states[10]).toBe("skipped"); // daysAgo(3) → index 10
  });
});
