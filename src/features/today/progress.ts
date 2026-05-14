import { addDeviceDays, toDeviceDateString } from "@/utils/dates";
import { now } from "@/utils/clock";
import { isActiveDay } from "@/features/habits/activeDays";

import type { HabitLogRecord } from "@/features/habits/types";

type SummarizeHabitProgressOptions = {
  activeDays?: number[];
  endDate?: Date;
  logs: HabitLogRecord[];
  windowDays: number;
};

export type HabitProgressSummary = {
  consistencyDenominator: number;
  consistencyRate: number;
  skipCount: number;
  streak: number;
  todayStatus: HabitLogRecord["status"] | null;
};

function getLogRecency(log: HabitLogRecord) {
  const updatedAt = Date.parse(log.updated_at);

  if (!Number.isNaN(updatedAt)) {
    return updatedAt;
  }

  const createdAt = Date.parse(log.created_at);

  if (!Number.isNaN(createdAt)) {
    return createdAt;
  }

  return 0;
}

export type DayStatus = "done" | "skipped" | "missed";

export function computeForgivingStreak(sequence: DayStatus[]): number {
  // Remove skipped days before evaluating consecutive misses (§8.3)
  const cleaned = sequence.filter((s) => s !== "skipped");

  if (cleaned.length === 0) return 0;

  // Most recent entry is missed — streak never starts
  if (cleaned[0] === "missed") return 0;

  let streak = 0;

  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "done") {
      streak += 1;
    } else {
      // missed — tolerated only if the next entry (further back) is done
      const next = cleaned[i + 1];
      if (next !== "done") {
        // Two consecutive misses (or trailing isolated miss) — stop
        break;
      }
      // Isolated miss: don't increment, continue to next entry
    }
  }

  return streak;
}

export function summarizeHabitProgress({
  activeDays,
  endDate = now(),
  logs,
  windowDays,
}: SummarizeHabitProgressOptions): HabitProgressSummary {
  const normalizedEndDate = new Date(endDate);
  normalizedEndDate.setHours(0, 0, 0, 0);
  const endDateString = toDeviceDateString(normalizedEndDate);
  const startDateString = toDeviceDateString(
    addDeviceDays(normalizedEndDate, -(windowDays - 1)),
  );
  const todayString = toDeviceDateString(now());

  // Build a map of the most recent log per date within the window
  const logsByDate = new Map<string, HabitLogRecord>();

  for (const log of logs) {
    if (log.log_date < startDateString || log.log_date > endDateString) {
      continue;
    }

    const existingLog = logsByDate.get(log.log_date);

    if (!existingLog || getLogRecency(log) >= getLogRecency(existingLog)) {
      logsByDate.set(log.log_date, log);
    }
  }

  // Today status: null if today is an off-day
  const todayIsActive = !activeDays || isActiveDay(endDateString, activeDays);
  const todayStatus = todayIsActive
    ? (logsByDate.get(endDateString)?.status ?? null)
    : null;

  // Consistency rate and skip count — only active days count
  let doneCount = 0;
  let missedCount = 0;
  let skipCount = 0;

  for (let offset = 0; offset < windowDays; offset++) {
    const dateString = toDeviceDateString(addDeviceDays(normalizedEndDate, -offset));
    if (activeDays && !isActiveDay(dateString, activeDays)) continue;

    const log = logsByDate.get(dateString);
    if (!log) continue;

    if (log.status === "done") {
      doneCount += 1;
    } else if (log.status === "missed") {
      missedCount += 1;
    } else if (log.status === "skipped") {
      skipCount += 1;
    }
  }

  const consistencyDenominator = doneCount + missedCount;
  const consistencyRate =
    consistencyDenominator === 0 ? 0 : doneCount / consistencyDenominator;

  // Build the streak sequence: walk backward from endDate over active days only
  const streakSequence: DayStatus[] = [];

  for (let offset = 0; offset < windowDays; offset++) {
    const dateString = toDeviceDateString(
      addDeviceDays(normalizedEndDate, -offset),
    );

    // Skip off-days entirely — they don't affect the streak
    if (activeDays && !isActiveDay(dateString, activeDays)) {
      continue;
    }

    const logEntry = logsByDate.get(dateString);

    if (logEntry) {
      streakSequence.push(logEntry.status);
    } else if (dateString === todayString) {
      // Today has no log yet — no decision made; skip today and keep walking back
      continue;
    } else {
      // Past active day with no log — treat as missed
      streakSequence.push("missed");
    }
  }

  const streak = computeForgivingStreak(streakSequence);

  return {
    consistencyDenominator,
    consistencyRate,
    skipCount,
    streak,
    todayStatus,
  };
}
