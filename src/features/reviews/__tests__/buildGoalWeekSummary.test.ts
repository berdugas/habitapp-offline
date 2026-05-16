import { buildGoalWeekSummary } from "@/features/reviews/buildGoalWeekSummary";

import type { Habit, HabitLog, LogStatus } from "@/features/habits/types";

// Reference week: Monday 2026-04-27 ... Sunday 2026-05-03
const WEEK_START = "2026-04-27";
const TODAY_AFTER_WEEK = "2026-05-04"; // Monday after the week, so all 7 days are "past"

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    user_id: "u1",
    title: "Walk daily",
    identity_phrase: "stoic",
    cue: "after coffee",
    tiny_action: "put on shoes",
    minimum_viable_action: null,
    preferred_time_window: null,
    icon: "Footprints",
    habit_state: "active",
    status: "active",
    active_days: JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
    start_date: "2026-04-01",
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    archived_at: null,
    automated_at: null,
    backlog_at: null,
    ...overrides,
  };
}

function makeLog(
  habitId: string,
  logDate: string,
  status: LogStatus,
): HabitLog {
  return {
    id: `${habitId}-${logDate}`,
    habit_id: habitId,
    user_id: "u1",
    log_date: logDate,
    status,
    note: null,
    created_at: `${logDate}T00:00:00Z`,
    updated_at: `${logDate}T00:00:00Z`,
  };
}

function weekDates(): string[] {
  // 2026-04-27 ... 2026-05-03
  return [
    "2026-04-27",
    "2026-04-28",
    "2026-04-29",
    "2026-04-30",
    "2026-05-01",
    "2026-05-02",
    "2026-05-03",
  ];
}

describe("buildGoalWeekSummary", () => {
  it("flags a 7/7 daily habit as strong with consistency 1.0", () => {
    const habit = makeHabit();
    const logs = weekDates().map((d) => makeLog(habit.id, d, "done"));

    const summary = buildGoalWeekSummary({
      identityPhrase: "stoic",
      habits: [habit],
      logs,
      weekStartDate: WEEK_START,
      todayDate: TODAY_AFTER_WEEK,
    });

    expect(summary.habits).toHaveLength(1);
    const h = summary.habits[0]!;
    expect(h.doneCount).toBe(7);
    expect(h.activeDayCount).toBe(7);
    expect(h.weekConsistency).toBe(1);
    expect(h.isStrong).toBe(true);
    expect(h.needsAttention).toBe(false);
    expect(summary.strongHabits).toHaveLength(1);
    expect(summary.attentionHabits).toHaveLength(0);
  });

  it("flags a 4/7 habit as needsAttention with consistency ≈ 0.57", () => {
    const habit = makeHabit();
    const dates = weekDates();
    const logs = [
      makeLog(habit.id, dates[0]!, "done"),
      makeLog(habit.id, dates[1]!, "done"),
      makeLog(habit.id, dates[2]!, "done"),
      makeLog(habit.id, dates[3]!, "done"),
      // dates[4..6] left unlogged -> missed
    ];

    const summary = buildGoalWeekSummary({
      identityPhrase: "stoic",
      habits: [habit],
      logs,
      weekStartDate: WEEK_START,
      todayDate: TODAY_AFTER_WEEK,
    });

    const h = summary.habits[0]!;
    expect(h.doneCount).toBe(4);
    expect(h.missCount).toBe(3);
    expect(h.weekConsistency).toBeCloseTo(4 / 7, 5);
    expect(h.isStrong).toBe(false);
    expect(h.needsAttention).toBe(true);
  });

  it("treats weekend days as off-days for a weekday-only habit", () => {
    const habit = makeHabit({
      active_days: JSON.stringify([1, 2, 3, 4, 5]),
    });
    const dates = weekDates();
    const logs = dates.slice(0, 5).map((d) => makeLog(habit.id, d, "done"));

    const summary = buildGoalWeekSummary({
      identityPhrase: "stoic",
      habits: [habit],
      logs,
      weekStartDate: WEEK_START,
      todayDate: TODAY_AFTER_WEEK,
    });

    const h = summary.habits[0]!;
    expect(h.activeDayCount).toBe(5);
    expect(h.doneCount).toBe(5);
    expect(h.weekLogs[5]!.isActiveDay).toBe(false);
    expect(h.weekLogs[6]!.isActiveDay).toBe(false);
    expect(h.weekLogs[5]!.status).toBeNull();
    expect(h.weekConsistency).toBe(1);
    expect(h.isStrong).toBe(true);
  });

  it("counts skipped days as skipped, not missed", () => {
    const habit = makeHabit();
    const dates = weekDates();
    const logs = [
      makeLog(habit.id, dates[0]!, "done"),
      makeLog(habit.id, dates[1]!, "skipped"),
      makeLog(habit.id, dates[2]!, "skipped"),
      makeLog(habit.id, dates[3]!, "done"),
      makeLog(habit.id, dates[4]!, "done"),
      makeLog(habit.id, dates[5]!, "done"),
      makeLog(habit.id, dates[6]!, "done"),
    ];

    const summary = buildGoalWeekSummary({
      identityPhrase: "stoic",
      habits: [habit],
      logs,
      weekStartDate: WEEK_START,
      todayDate: TODAY_AFTER_WEEK,
    });

    const h = summary.habits[0]!;
    expect(h.doneCount).toBe(5);
    expect(h.skipCount).toBe(2);
    expect(h.missCount).toBe(0);
  });

  it("averages overallConsistency across habits", () => {
    const habit1 = makeHabit({ id: "h1" });
    const habit2 = makeHabit({ id: "h2" });
    const dates = weekDates();
    const logs = [
      ...dates.map((d) => makeLog(habit1.id, d, "done")), // 7/7
      ...dates.slice(0, 4).map((d) => makeLog(habit2.id, d, "done")), // 4/7
    ];

    const summary = buildGoalWeekSummary({
      identityPhrase: "stoic",
      habits: [habit1, habit2],
      logs,
      weekStartDate: WEEK_START,
      todayDate: TODAY_AFTER_WEEK,
    });

    expect(summary.overallDoneCount).toBe(11);
    expect(summary.overallActiveDayCount).toBe(14);
    expect(summary.overallConsistency).toBeCloseTo(11 / 14, 5);
  });

  it("populates strongHabits / attentionHabits arrays correctly", () => {
    const strong = makeHabit({ id: "strong", title: "Strong" });
    const weak = makeHabit({ id: "weak", title: "Weak" });
    const dates = weekDates();
    const logs = [
      ...dates.map((d) => makeLog(strong.id, d, "done")),
      ...dates.slice(0, 3).map((d) => makeLog(weak.id, d, "done")),
    ];

    const summary = buildGoalWeekSummary({
      identityPhrase: "stoic",
      habits: [strong, weak],
      logs,
      weekStartDate: WEEK_START,
      todayDate: TODAY_AFTER_WEEK,
    });

    expect(summary.strongHabits.map((h) => h.habitId)).toEqual(["strong"]);
    expect(summary.attentionHabits.map((h) => h.habitId)).toEqual(["weak"]);
  });

  it("auto-marks unlogged past active days as missed; future days stay null", () => {
    const habit = makeHabit();
    // Today is Wednesday of the week: Mon/Tue are past, Wed is today, Thu-Sun are future
    const summary = buildGoalWeekSummary({
      identityPhrase: "stoic",
      habits: [habit],
      logs: [],
      weekStartDate: WEEK_START,
      todayDate: "2026-04-29", // Wednesday
    });

    const h = summary.habits[0]!;
    // Mon (2026-04-27), Tue (2026-04-28) are past with no log -> missed
    expect(h.weekLogs[0]!.status).toBe("missed");
    expect(h.weekLogs[1]!.status).toBe("missed");
    // Wed (today) onwards stay null
    expect(h.weekLogs[2]!.status).toBeNull();
    expect(h.weekLogs[3]!.status).toBeNull();
    expect(h.weekLogs[6]!.status).toBeNull();
    expect(h.missCount).toBe(2);
  });

  it("treats pre-start days as off-days even on active weekdays", () => {
    const habit = makeHabit({ start_date: "2026-04-30" }); // Thursday
    const summary = buildGoalWeekSummary({
      identityPhrase: "stoic",
      habits: [habit],
      logs: [],
      weekStartDate: WEEK_START,
      todayDate: TODAY_AFTER_WEEK,
    });

    const h = summary.habits[0]!;
    // Mon-Wed are before start_date -> isActiveDay false, status null
    expect(h.weekLogs[0]!.isActiveDay).toBe(false);
    expect(h.weekLogs[0]!.status).toBeNull();
    expect(h.weekLogs[2]!.isActiveDay).toBe(false);
    // Thu onwards are active -> isActiveDay true, status missed (no log)
    expect(h.weekLogs[3]!.isActiveDay).toBe(true);
    expect(h.weekLogs[3]!.status).toBe("missed");
    expect(h.activeDayCount).toBe(4); // Thu, Fri, Sat, Sun
  });

  it("excludes future-start habits from summary entirely", () => {
    const started = makeHabit({ id: "started", start_date: "2026-04-01" });
    const upcoming = makeHabit({ id: "upcoming", start_date: "2026-06-01" });

    const summary = buildGoalWeekSummary({
      identityPhrase: "stoic",
      habits: [started, upcoming],
      logs: [],
      weekStartDate: WEEK_START,
      todayDate: TODAY_AFTER_WEEK,
    });

    expect(summary.habits.map((h) => h.habitId)).toEqual(["started"]);
  });

  it("computes oldestActiveDaysCount using active days, not calendar days", () => {
    const habit = makeHabit({
      start_date: "2026-04-20", // Monday
      active_days: JSON.stringify([1, 2, 3, 4, 5]), // weekdays only
    });

    // From 2026-04-20 (Mon) through 2026-05-03 (Sun) inclusive:
    // - Weekdays: Apr 20, 21, 22, 23, 24, 27, 28, 29, 30, May 1 = 10
    // - Calendar days: 14
    const summary = buildGoalWeekSummary({
      identityPhrase: "stoic",
      habits: [habit],
      logs: [],
      weekStartDate: WEEK_START,
      todayDate: "2026-05-03",
    });

    expect(summary.oldestActiveDaysCount).toBe(10);
  });

  it("returns oldestActiveDaysCount = 0 when no eligible habits", () => {
    const upcoming = makeHabit({ id: "upcoming", start_date: "2026-06-01" });

    const summary = buildGoalWeekSummary({
      identityPhrase: "stoic",
      habits: [upcoming],
      logs: [],
      weekStartDate: WEEK_START,
      todayDate: TODAY_AFTER_WEEK,
    });

    expect(summary.oldestActiveDaysCount).toBe(0);
  });

  it("totalDaysShowedUp counts unique dates with any habit done", () => {
    const h1 = makeHabit({ id: "h1" });
    const h2 = makeHabit({ id: "h2" });
    const dates = weekDates();
    const logs = [
      makeLog(h1.id, dates[0]!, "done"),
      makeLog(h2.id, dates[0]!, "done"), // same date, two habits — still 1 day
      makeLog(h1.id, dates[1]!, "done"),
      makeLog(h2.id, dates[2]!, "skipped"), // not counted (not done)
    ];

    const summary = buildGoalWeekSummary({
      identityPhrase: "stoic",
      habits: [h1, h2],
      logs,
      weekStartDate: WEEK_START,
      todayDate: TODAY_AFTER_WEEK,
    });

    expect(summary.totalDaysShowedUp).toBe(2);
  });
});
