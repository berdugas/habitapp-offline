import { isActiveDay, parseActiveDays } from "@/features/habits/activeDays";
import { addDeviceDays, toDeviceDateString } from "@/utils/dates";

import type { Habit, HabitLog, LogStatus } from "@/features/habits/types";

export type DayEntry = {
  date: string;
  dayOfWeek: number;
  status: LogStatus | null;
  isActiveDay: boolean;
};

export type HabitWeekSummary = {
  habitId: string;
  title: string;
  icon: string | null;
  formula: string;
  identityPhrase: string;
  activeDays: number[];
  weekLogs: DayEntry[];
  doneCount: number;
  missCount: number;
  skipCount: number;
  activeDayCount: number;
  weekConsistency: number;
  isStrong: boolean;
  needsAttention: boolean;
};

export type GoalWeekSummary = {
  identityPhrase: string;
  habits: HabitWeekSummary[];
  overallDoneCount: number;
  overallActiveDayCount: number;
  overallConsistency: number;
  strongHabits: HabitWeekSummary[];
  attentionHabits: HabitWeekSummary[];
  totalActiveDaysInWeek: number;
  totalDaysShowedUp: number;
  oldestActiveDaysCount: number;
};

type BuildInput = {
  identityPhrase: string;
  habits: Habit[];
  logs: HabitLog[];
  weekStartDate: string;
  todayDate: string;
};

function isoWeekdayFromDateString(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

function computeOldestActiveDaysCount(
  habits: Habit[],
  todayDate: string,
): number {
  if (habits.length === 0) return 0;
  const oldest = [...habits].sort((a, b) =>
    a.start_date.localeCompare(b.start_date),
  )[0];
  if (!oldest) return 0;
  if (oldest.start_date > todayDate) return 0;

  const activeDays = parseActiveDays(oldest.active_days);
  const start = new Date(`${oldest.start_date}T12:00:00`);
  start.setHours(0, 0, 0, 0);
  const today = new Date(`${todayDate}T12:00:00`);
  today.setHours(0, 0, 0, 0);

  let count = 0;
  const cursor = new Date(start);
  while (cursor.getTime() <= today.getTime()) {
    if (isActiveDay(cursor, activeDays)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function buildGoalWeekSummary({
  identityPhrase,
  habits,
  logs,
  weekStartDate,
  todayDate,
}: BuildInput): GoalWeekSummary {
  const eligible = habits.filter(
    (h) => h.identity_phrase === identityPhrase && h.start_date <= todayDate,
  );

  const logsByHabit = new Map<string, Map<string, LogStatus>>();
  for (const log of logs) {
    const inner = logsByHabit.get(log.habit_id) ?? new Map<string, LogStatus>();
    inner.set(log.log_date, log.status);
    logsByHabit.set(log.habit_id, inner);
  }

  const weekStart = new Date(`${weekStartDate}T12:00:00`);
  weekStart.setHours(0, 0, 0, 0);

  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    weekDates.push(toDeviceDateString(addDeviceDays(weekStart, i)));
  }

  const habitSummaries: HabitWeekSummary[] = eligible.map((habit) => {
    const activeDays = parseActiveDays(habit.active_days);
    const habitLogs = logsByHabit.get(habit.id) ?? new Map<string, LogStatus>();

    const weekLogs: DayEntry[] = weekDates.map((date) => {
      const dayOfWeek = isoWeekdayFromDateString(date);
      const beforeStart = date < habit.start_date;
      const matchesActive = isActiveDay(date, activeDays);
      const dayIsActive = !beforeStart && matchesActive;

      if (!dayIsActive) {
        return { date, dayOfWeek, status: null, isActiveDay: false };
      }

      const logged = habitLogs.get(date) ?? null;
      if (logged) {
        return { date, dayOfWeek, status: logged, isActiveDay: true };
      }

      if (date < todayDate) {
        return { date, dayOfWeek, status: "missed", isActiveDay: true };
      }

      return { date, dayOfWeek, status: null, isActiveDay: true };
    });

    let doneCount = 0;
    let missCount = 0;
    let skipCount = 0;
    let activeDayCount = 0;
    for (const entry of weekLogs) {
      if (!entry.isActiveDay) continue;
      activeDayCount++;
      if (entry.status === "done") doneCount++;
      else if (entry.status === "missed") missCount++;
      else if (entry.status === "skipped") skipCount++;
    }

    const weekConsistency =
      activeDayCount === 0 ? 0 : doneCount / activeDayCount;
    const isStrong = activeDayCount > 0 && weekConsistency >= 0.8;
    const needsAttention =
      activeDayCount > 0 && (weekConsistency < 0.7 || missCount >= 2);

    return {
      habitId: habit.id,
      title: habit.title,
      icon: habit.icon ?? null,
      formula: `${habit.cue} → ${habit.tiny_action}`,
      identityPhrase: habit.identity_phrase ?? "",
      activeDays,
      weekLogs,
      doneCount,
      missCount,
      skipCount,
      activeDayCount,
      weekConsistency,
      isStrong,
      needsAttention,
    };
  });

  const overallDoneCount = habitSummaries.reduce(
    (n, h) => n + h.doneCount,
    0,
  );
  const overallActiveDayCount = habitSummaries.reduce(
    (n, h) => n + h.activeDayCount,
    0,
  );
  const overallConsistency =
    overallActiveDayCount === 0
      ? 0
      : overallDoneCount / overallActiveDayCount;

  const activeDatesInWeek = new Set<string>();
  const showedUpDatesInWeek = new Set<string>();
  for (const h of habitSummaries) {
    for (const entry of h.weekLogs) {
      if (entry.isActiveDay) activeDatesInWeek.add(entry.date);
      if (entry.status === "done") showedUpDatesInWeek.add(entry.date);
    }
  }

  return {
    identityPhrase,
    habits: habitSummaries,
    overallDoneCount,
    overallActiveDayCount,
    overallConsistency,
    strongHabits: habitSummaries.filter((h) => h.isStrong),
    attentionHabits: habitSummaries.filter((h) => h.needsAttention),
    totalActiveDaysInWeek: activeDatesInWeek.size,
    totalDaysShowedUp: showedUpDatesInWeek.size,
    oldestActiveDaysCount: computeOldestActiveDaysCount(eligible, todayDate),
  };
}
