import { todayDateString as readTodayDateString } from "@/utils/clock";

function noonOf(dateString: string): Date {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function msUntilNextLocalMidnight(at: Date = new Date()): number {
  const tomorrow = new Date(
    at.getFullYear(),
    at.getMonth(),
    at.getDate() + 1,
  );
  return tomorrow.getTime() - at.getTime();
}

export const __noonOfForTesting = noonOf;
export const __msUntilNextLocalMidnightForTesting = msUntilNextLocalMidnight;
