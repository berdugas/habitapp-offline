import { countActiveDaysElapsed } from "@/features/habits/activeDays";

import type { HabitLog } from "@/lib/db/repositories/habit_logs";

// Returns the fraction (0..1) of active days between startDate and graduationDate
// (inclusive) on which the habit was logged as "done". If no active days fall in
// the range, returns 0. Pure — safe to unit-test.
export function computePreGraduationConsistency(
  logs: HabitLog[],
  startDate: string,
  graduationDate: string,
  activeDays: number[],
): number {
  if (!graduationDate || graduationDate < startDate) return 0;

  const graduationDay = graduationDate.slice(0, 10); // strip time portion if any
  const activeCount = countActiveDaysElapsed(startDate, activeDays, graduationDay);
  if (activeCount === 0) return 0;

  const doneCount = logs.filter(
    (log) =>
      log.status === "done" &&
      log.log_date >= startDate &&
      log.log_date <= graduationDay,
  ).length;

  return Math.min(1, doneCount / activeCount);
}

// Days between two ISO date strings (YYYY-MM-DD…), inclusive of both endpoints.
// 1 if the dates are identical. Returns 0 if `to` < `from`.
export function inclusiveDayCount(fromDate: string, toDate: string): number {
  const from = fromDate.slice(0, 10);
  const to = toDate.slice(0, 10);
  if (to < from) return 0;
  const start = new Date(`${from}T12:00:00`).getTime();
  const end = new Date(`${to}T12:00:00`).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

// "Automatic since May 2026" / "Saved May 14, 2026" / "Archived Mar 3, 2026"
// Uses the device locale. Pass an ISO string; we read the date portion.
export function formatLibraryDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function formatExactDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
