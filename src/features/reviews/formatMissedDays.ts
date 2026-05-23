import { getDayName } from "@/utils/dates";

import type { DayEntry } from "@/features/reviews/buildGoalWeekSummary";

export function formatMissedDays(days: DayEntry[]): string {
  const names = days
    .filter((d) => d.status === "missed")
    .map((d) => getDayName(d.dayOfWeek));
  if (names.length === 0) return "";
  if (names.length === 1) return `You missed ${names[0]}.`;
  if (names.length === 2) return `You missed ${names[0]} and ${names[1]}.`;
  const last = names[names.length - 1]!;
  const rest = names.slice(0, -1);
  return `You missed ${rest.join(", ")} and ${last}.`;
}
