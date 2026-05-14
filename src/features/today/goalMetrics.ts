import { isActiveDay } from "@/features/habits/activeDays";
import { computeForgivingStreak } from "@/features/today/progress";
import { now } from "@/utils/clock";
import { addDeviceDays, getWeekStartDate, toDeviceDateString } from "@/utils/dates";

import type { DayStatus } from "@/features/today/progress";

export type GoalDayState =
  | "done"
  | "missed"
  | "skipped"
  | "off"
  | "today"
  | "pre-start";

type HabitForMetrics = {
  consistencyDenominator: number;
  consistencyRate: number;
};

export function avgConsistencyRate(habits: HabitForMetrics[]): number | null {
  const habitsWithData = habits.filter((h) => h.consistencyDenominator > 0);
  if (habitsWithData.length === 0) return null;
  return habitsWithData.reduce((sum, h) => sum + h.consistencyRate, 0) / habitsWithData.length;
}

export type GoalStreakHabit = {
  activeDays: number[];
  logs: { log_date: string; status: "done" | "skipped" | "missed" }[];
  startDate: string;
};

export function computeGoalStreak(
  habits: GoalStreakHabit[],
  windowDays: number,
  endDate?: Date,
): number {
  if (habits.length === 0) return 0;

  const normalizedEndDate = new Date(endDate ?? now());
  normalizedEndDate.setHours(0, 0, 0, 0);
  const todayString = toDeviceDateString(now());

  const logsByHabit = habits.map((h) => {
    const map = new Map<string, "done" | "skipped" | "missed">();
    for (const log of h.logs) {
      map.set(log.log_date, log.status);
    }
    return map;
  });

  const sequence: DayStatus[] = [];

  for (let offset = 0; offset < windowDays; offset++) {
    const dateString = toDeviceDateString(
      addDeviceDays(normalizedEndDate, -offset),
    );

    let anyOnDuty = false;
    let anyMissed = false;
    let anyDone = false;
    let todayUnloggedOnDuty = false;

    for (let i = 0; i < habits.length; i++) {
      const habit = habits[i];

      if (dateString < habit.startDate) continue;
      if (!isActiveDay(dateString, habit.activeDays)) continue;

      const status = logsByHabit[i].get(dateString);

      // Skipped is neutral at the habit level — treat as off-duty for this day.
      if (status === "skipped") continue;

      anyOnDuty = true;

      if (status === "done") {
        anyDone = true;
      } else if (status === "missed") {
        anyMissed = true;
      } else if (dateString === todayString) {
        todayUnloggedOnDuty = true;
      } else {
        // Past active day with no log — counts as missed.
        anyMissed = true;
      }
    }

    if (!anyOnDuty) continue;
    if (dateString === todayString && todayUnloggedOnDuty) continue;

    sequence.push(anyMissed ? "missed" : anyDone ? "done" : "skipped");
  }

  return computeForgivingStreak(sequence);
}

export function computeWeeklyConsistency(
  habits: GoalStreakHabit[],
  startDate: string,
  endDate: Date,
): { weekLabel: string; rate: number }[] {
  if (habits.length === 0) return [];

  const normalizedEnd = new Date(endDate);
  normalizedEnd.setHours(0, 0, 0, 0);
  const endIso = toDeviceDateString(normalizedEnd);
  const endWeekStartIso = toDeviceDateString(getWeekStartDate(normalizedEnd));

  const logsByHabit = habits.map((h) => {
    const map = new Map<string, "done" | "skipped" | "missed">();
    for (const log of h.logs) {
      map.set(log.log_date, log.status);
    }
    return map;
  });

  const results: { rate: number }[] = [];
  let weekStart = new Date(`${startDate}T12:00:00`);
  weekStart.setHours(0, 0, 0, 0);

  while (toDeviceDateString(weekStart) <= endWeekStartIso) {
    const weekStartIso = toDeviceDateString(weekStart);
    const isCurrentWeek = weekStartIso === endWeekStartIso;

    let numerator = 0;
    let denominator = 0;
    let hasLoggedActiveDay = false;

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const day = addDeviceDays(weekStart, dayOffset);
      const dayIso = toDeviceDateString(day);

      if (dayIso > endIso) break;

      for (let i = 0; i < habits.length; i++) {
        const habit = habits[i];
        if (dayIso < habit.startDate) continue;
        if (!isActiveDay(dayIso, habit.activeDays)) continue;

        const status = logsByHabit[i].get(dayIso);

        if (status === "skipped") {
          hasLoggedActiveDay = true;
          continue;
        }

        if (status === "done") {
          numerator++;
          denominator++;
          hasLoggedActiveDay = true;
        } else if (status === "missed") {
          denominator++;
          hasLoggedActiveDay = true;
        } else {
          // Active day, no log, not in the future (future days already broken
          // out above). Counts toward denominator: past unlogged is "missed",
          // today unlogged is "in progress / not yet done" — both depress the
          // bar, which is what we want for a trajectory chart.
          denominator++;
        }
      }
    }

    if (isCurrentWeek && !hasLoggedActiveDay) {
      break;
    }

    const rate = denominator > 0 ? numerator / denominator : 0;
    results.push({ rate });

    weekStart = addDeviceDays(weekStart, 7);
  }

  // Cap to last 12 buckets, then relabel sequentially from W1 so labels are
  // contiguous regardless of how many were trimmed.
  return results
    .slice(-12)
    .map((entry, i) => ({ weekLabel: `W${i + 1}`, rate: entry.rate }));
}

export function computeGoalDailyStates(
  habits: GoalStreakHabit[],
  windowDays: number,
): GoalDayState[] {
  const states: GoalDayState[] = [];
  const today = now();
  today.setHours(0, 0, 0, 0);
  const todayIso = toDeviceDateString(today);

  const logsByHabit = habits.map((h) => {
    const map = new Map<string, "done" | "skipped" | "missed">();
    for (const log of h.logs) {
      map.set(log.log_date, log.status);
    }
    return map;
  });

  for (let offset = windowDays - 1; offset >= 0; offset--) {
    const date = addDeviceDays(today, -offset);
    const dateIso = toDeviceDateString(date);

    const anyStarted = habits.some((h) => dateIso >= h.startDate);
    if (!anyStarted) {
      states.push("pre-start");
      continue;
    }

    let onDutyCount = 0;
    let skippedCount = 0;
    let anyUnloggedToday = false;
    let anyMissed = false;

    for (let i = 0; i < habits.length; i++) {
      const habit = habits[i];
      if (dateIso < habit.startDate) continue;
      if (!isActiveDay(dateIso, habit.activeDays)) continue;

      onDutyCount++;

      const status = logsByHabit[i].get(dateIso);

      if (status === "done") {
        // pass
      } else if (status === "missed") {
        anyMissed = true;
      } else if (status === "skipped") {
        skippedCount++;
      } else if (dateIso === todayIso) {
        anyUnloggedToday = true;
      } else {
        anyMissed = true;
      }
    }

    if (onDutyCount === 0) {
      states.push("off");
      continue;
    }

    if (dateIso === todayIso && anyUnloggedToday) {
      states.push("today");
      continue;
    }

    if (anyMissed) {
      states.push("missed");
      continue;
    }

    if (skippedCount === onDutyCount) {
      states.push("skipped");
      continue;
    }

    states.push("done");
  }

  return states;
}
