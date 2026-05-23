import { formatMissedDays } from "@/features/reviews/formatMissedDays";

import type { DayEntry } from "@/features/reviews/buildGoalWeekSummary";

// Day-of-week numbering matches the rest of the codebase:
// 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun.
function makeDay(
  dayOfWeek: number,
  status: DayEntry["status"],
  date = "2026-05-11",
): DayEntry {
  return { date, dayOfWeek, status, isActiveDay: true };
}

describe("formatMissedDays", () => {
  it("returns an empty string when no days were missed", () => {
    const days: DayEntry[] = [
      makeDay(1, "done"),
      makeDay(2, "done"),
      makeDay(3, null),
    ];

    expect(formatMissedDays(days)).toBe("");
  });

  it("formats a single missed day", () => {
    const days: DayEntry[] = [makeDay(2, "missed")];

    expect(formatMissedDays(days)).toBe("You missed Tuesday.");
  });

  it("formats two missed days with 'and'", () => {
    const days: DayEntry[] = [makeDay(2, "missed"), makeDay(4, "missed")];

    expect(formatMissedDays(days)).toBe("You missed Tuesday and Thursday.");
  });

  it("formats three or more missed days with Oxford-style commas", () => {
    const days: DayEntry[] = [
      makeDay(2, "missed"),
      makeDay(3, "missed"),
      makeDay(5, "missed"),
    ];

    expect(formatMissedDays(days)).toBe(
      "You missed Tuesday, Wednesday and Friday.",
    );
  });

  it("ignores non-missed statuses (done, skipped, null)", () => {
    const days: DayEntry[] = [
      makeDay(1, "done"),
      makeDay(2, "missed"),
      makeDay(3, "skipped"),
      makeDay(4, null),
      makeDay(5, "missed"),
    ];

    expect(formatMissedDays(days)).toBe("You missed Tuesday and Friday.");
  });
});
