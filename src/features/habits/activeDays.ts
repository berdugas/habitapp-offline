// ISO weekday numbers: Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=7

import { toDeviceDateString } from "@/utils/dates";

export const ALL_DAYS: number[] = [1, 2, 3, 4, 5, 6, 7];

export function isoWeekday(date: Date): number {
  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  return day === 0 ? 7 : day;
}

export function parseActiveDays(json: string): number[] {
  try {
    const parsed = JSON.parse(json);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((n) => typeof n === "number" && n >= 1 && n <= 7)
    ) {
      return parsed;
    }
  } catch {
    // fall through
  }
  return [...ALL_DAYS];
}

export function serializeActiveDays(days: number[]): string {
  return JSON.stringify([...days].sort((a, b) => a - b));
}

export function isActiveDay(
  date: Date | string,
  activeDays: number[],
): boolean {
  const d = typeof date === "string" ? new Date(`${date}T12:00:00`) : date;
  return activeDays.includes(isoWeekday(d));
}

export function countActiveDaysElapsed(
  startDate: string,
  activeDays: number[],
  endDate: string,
): number {
  if (endDate < startDate) return 0;

  let count = 0;
  const cursor = new Date(`${startDate}T12:00:00`);
  const last = new Date(`${endDate}T12:00:00`);

  while (cursor.getTime() <= last.getTime()) {
    const dateStr = toDeviceDateString(cursor);
    if (isActiveDay(dateStr, activeDays)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

export function getActiveDaysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);

  if (sorted.length === 7) return "Every day";

  const weekdays = [1, 2, 3, 4, 5];
  const weekend = [6, 7];

  const isWeekdays =
    sorted.length === 5 && weekdays.every((d) => sorted.includes(d));
  if (isWeekdays) return "Weekdays";

  const isWeekend =
    sorted.length === 2 && weekend.every((d) => sorted.includes(d));
  if (isWeekend) return "Weekends";

  return `${sorted.length} days a week`;
}
