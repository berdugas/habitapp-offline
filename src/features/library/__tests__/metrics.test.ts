import {
  computePreGraduationConsistency,
  formatExactDate,
  formatLibraryDate,
  inclusiveDayCount,
} from "@/features/library/metrics";

import type { HabitLog } from "@/lib/db/repositories/habit_logs";

function makeLog(date: string, status: HabitLog["status"]): HabitLog {
  return {
    id: `log-${date}`,
    habit_id: "habit-1",
    user_id: "user-1",
    log_date: date,
    status,
    note: null,
    created_at: `${date}T12:00:00.000Z`,
    updated_at: `${date}T12:00:00.000Z`,
  };
}

describe("computePreGraduationConsistency", () => {
  const everyday = [1, 2, 3, 4, 5, 6, 7];

  it("returns 1.0 when every active day is done", () => {
    const logs = [
      makeLog("2026-01-01", "done"),
      makeLog("2026-01-02", "done"),
      makeLog("2026-01-03", "done"),
    ];
    const result = computePreGraduationConsistency(
      logs,
      "2026-01-01",
      "2026-01-03",
      everyday,
    );
    expect(result).toBeCloseTo(1.0);
  });

  it("returns 0 when no logs exist in the window", () => {
    const result = computePreGraduationConsistency(
      [],
      "2026-01-01",
      "2026-01-10",
      everyday,
    );
    expect(result).toBe(0);
  });

  it("ignores logs outside the [start, graduation] range", () => {
    const logs = [
      makeLog("2025-12-31", "done"), // before start
      makeLog("2026-01-01", "done"),
      makeLog("2026-01-02", "done"),
      makeLog("2026-01-05", "done"), // after graduation
    ];
    const result = computePreGraduationConsistency(
      logs,
      "2026-01-01",
      "2026-01-03",
      everyday,
    );
    // 2 done / 3 active days
    expect(result).toBeCloseTo(2 / 3);
  });

  it("only counts 'done' status — skipped and missed do not count", () => {
    const logs = [
      makeLog("2026-01-01", "done"),
      makeLog("2026-01-02", "skipped"),
      makeLog("2026-01-03", "missed"),
    ];
    const result = computePreGraduationConsistency(
      logs,
      "2026-01-01",
      "2026-01-03",
      everyday,
    );
    expect(result).toBeCloseTo(1 / 3);
  });

  it("counts only active days in the denominator", () => {
    // Active on weekdays (Mon=1..Fri=5) only.
    // Jan 5 2026 is a Monday; Jan 11 is a Sunday. 5 active days in that window.
    const weekdays = [1, 2, 3, 4, 5];
    const logs = [
      makeLog("2026-01-05", "done"), // Mon
      makeLog("2026-01-06", "done"), // Tue
      makeLog("2026-01-07", "done"), // Wed
    ];
    const result = computePreGraduationConsistency(
      logs,
      "2026-01-05",
      "2026-01-11",
      weekdays,
    );
    expect(result).toBeCloseTo(3 / 5);
  });

  it("returns 0 when graduationDate precedes startDate", () => {
    const result = computePreGraduationConsistency(
      [makeLog("2026-01-01", "done")],
      "2026-01-10",
      "2026-01-01",
      everyday,
    );
    expect(result).toBe(0);
  });

  it("caps result at 1.0 even with duplicate done logs (defensive)", () => {
    const logs = [
      makeLog("2026-01-01", "done"),
      makeLog("2026-01-01", "done"), // duplicate
      makeLog("2026-01-02", "done"),
    ];
    const result = computePreGraduationConsistency(
      logs,
      "2026-01-01",
      "2026-01-02",
      everyday,
    );
    expect(result).toBeLessThanOrEqual(1.0);
  });
});

describe("inclusiveDayCount", () => {
  it("returns 1 for the same day", () => {
    expect(inclusiveDayCount("2026-05-01", "2026-05-01")).toBe(1);
  });

  it("returns the inclusive day delta", () => {
    expect(inclusiveDayCount("2026-05-01", "2026-05-10")).toBe(10);
  });

  it("returns 0 when to-date precedes from-date", () => {
    expect(inclusiveDayCount("2026-05-10", "2026-05-01")).toBe(0);
  });

  it("ignores time portions of ISO strings", () => {
    expect(
      inclusiveDayCount("2026-05-01T12:34:56.000Z", "2026-05-05T00:00:00.000Z"),
    ).toBe(5);
  });
});

describe("formatLibraryDate / formatExactDate", () => {
  it("formatLibraryDate returns Month + Year", () => {
    expect(formatLibraryDate("2026-05-14T12:00:00.000Z")).toMatch(/2026/);
  });

  it("formatExactDate returns short Month Day, Year", () => {
    const result = formatExactDate("2026-05-14T12:00:00.000Z");
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/14/);
  });
});
