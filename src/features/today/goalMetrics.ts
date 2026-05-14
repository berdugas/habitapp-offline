import { isActiveDay } from "@/features/habits/activeDays";
import { computeForgivingStreak } from "@/features/today/progress";
import { now } from "@/utils/clock";
import { addDeviceDays, toDeviceDateString } from "@/utils/dates";

import type { DayStatus } from "@/features/today/progress";

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
