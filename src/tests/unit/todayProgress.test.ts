import { resetClockForTesting, setNowForTesting } from "@/utils/clock";
import { summarizeHabitProgress } from "@/features/today/progress";

import type { HabitLogRecord } from "@/features/habits/types";

// "today" for all streak tests unless overridden
const TODAY = "2026-04-23";

beforeEach(() => {
  setNowForTesting(new Date("2026-04-23T10:00:00"));
});

afterEach(() => {
  resetClockForTesting();
});

function log(
  logDate: string,
  status: HabitLogRecord["status"],
  overrides: Partial<HabitLogRecord> = {},
): HabitLogRecord {
  return {
    created_at: `${logDate}T00:00:00.000Z`,
    habit_id: "habit-1",
    id: `${logDate}-${status}`,
    log_date: logDate,
    note: null,
    status,
    updated_at: `${logDate}T00:00:00.000Z`,
    user_id: "user-1",
    ...overrides,
  };
}

// Helpers for relative dates from TODAY (2026-04-23)
function daysAgo(n: number): string {
  const d = new Date(2026, 3, 23 - n); // month is 0-based
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// We use windowDays=7 for most streak tests so inferred missed days are bounded
// and the test expectations are easy to reason about.

// ─── Base cases ──────────────────────────────────────────────────────────────

describe("streak — base cases", () => {
  it("returns streak 0 and todayStatus null for empty logs", () => {
    const result = summarizeHabitProgress({ logs: [], windowDays: 7 });
    expect(result.streak).toBe(0);
    expect(result.todayStatus).toBeNull();
  });

  it("returns streak 1 when only today is logged Done", () => {
    const result = summarizeHabitProgress({
      logs: [log(TODAY, "done")],
      windowDays: 7,
    });
    expect(result.streak).toBe(1);
    expect(result.todayStatus).toBe("done");
  });

  it("returns streak 3 for three consecutive done days ending today", () => {
    const result = summarizeHabitProgress({
      logs: [
        log(TODAY, "done"),
        log(daysAgo(1), "done"),
        log(daysAgo(2), "done"),
      ],
      windowDays: 7,
    });
    expect(result.streak).toBe(3);
  });

  it("returns streak 2 when today is not logged but yesterday and day-before are done (today is no-decision)", () => {
    const result = summarizeHabitProgress({
      logs: [log(daysAgo(1), "done"), log(daysAgo(2), "done")],
      windowDays: 7,
    });
    expect(result.streak).toBe(2);
    expect(result.todayStatus).toBeNull();
  });

  it("returns streak 2 when today is Skipped and yesterday + day-before are Done (skipped is neutral)", () => {
    const result = summarizeHabitProgress({
      logs: [
        log(TODAY, "skipped"),
        log(daysAgo(1), "done"),
        log(daysAgo(2), "done"),
      ],
      windowDays: 7,
    });
    expect(result.streak).toBe(2);
    expect(result.todayStatus).toBe("skipped");
  });
});

// ─── Single missed — tolerated ────────────────────────────────────────────────

describe("streak — single missed (tolerated)", () => {
  it("tolerates a missed day sandwiched between two done days: streak 2", () => {
    // Today Done, yesterday Missed, day-before Done → streak 2
    const result = summarizeHabitProgress({
      logs: [
        log(TODAY, "done"),
        log(daysAgo(1), "missed"),
        log(daysAgo(2), "done"),
      ],
      windowDays: 5,
    });
    expect(result.streak).toBe(2);
  });

  it("tolerates a missed day deep in a chain: streak 3", () => {
    // Today Done, yesterday Done, day-before Missed, day-before-that Done → streak 3
    const result = summarizeHabitProgress({
      logs: [
        log(TODAY, "done"),
        log(daysAgo(1), "done"),
        log(daysAgo(2), "missed"),
        log(daysAgo(3), "done"),
      ],
      windowDays: 6,
    });
    expect(result.streak).toBe(3);
  });

  it("returns streak 0 when today itself is Missed (chain hasn't started)", () => {
    const result = summarizeHabitProgress({
      logs: [log(TODAY, "missed"), log(daysAgo(1), "done")],
      windowDays: 7,
    });
    expect(result.streak).toBe(0);
    expect(result.todayStatus).toBe("missed");
  });
});

// ─── Two consecutive missed — breaks ─────────────────────────────────────────

describe("streak — two consecutive missed (breaks)", () => {
  it("breaks the streak at two consecutive missed days: only today counts", () => {
    // Today Done, yesterday Missed, day-before Missed, day-before-that Done → streak 1
    const result = summarizeHabitProgress({
      logs: [
        log(TODAY, "done"),
        log(daysAgo(1), "missed"),
        log(daysAgo(2), "missed"),
        log(daysAgo(3), "done"),
      ],
      windowDays: 6,
    });
    expect(result.streak).toBe(1);
  });

  it("returns streak 0 when today is not logged and the two most recent logged days are both missed", () => {
    // Today not logged, yesterday Missed, day-before Missed → streak 0
    const result = summarizeHabitProgress({
      logs: [log(daysAgo(1), "missed"), log(daysAgo(2), "missed")],
      windowDays: 7,
    });
    expect(result.streak).toBe(0);
  });

  it("counts only the done days before the two-miss block", () => {
    // Today Done, yesterday Done, day-before Missed, day-before-that Missed, further Done → streak 2
    const result = summarizeHabitProgress({
      logs: [
        log(TODAY, "done"),
        log(daysAgo(1), "done"),
        log(daysAgo(2), "missed"),
        log(daysAgo(3), "missed"),
        log(daysAgo(4), "done"),
      ],
      windowDays: 7,
    });
    expect(result.streak).toBe(2);
  });
});

// ─── Skipped neutrality ───────────────────────────────────────────────────────

describe("streak — skipped neutrality", () => {
  it("treats a single skipped day as neutral: streak 2 across it", () => {
    // Today Done, yesterday Skipped, day-before Done → streak 2
    const result = summarizeHabitProgress({
      logs: [
        log(TODAY, "done"),
        log(daysAgo(1), "skipped"),
        log(daysAgo(2), "done"),
      ],
      windowDays: 5,
    });
    expect(result.streak).toBe(2);
  });

  it("treats multiple consecutive skipped days as neutral", () => {
    // Today Done, two skipped days, further Done → streak 2
    const result = summarizeHabitProgress({
      logs: [
        log(TODAY, "done"),
        log(daysAgo(1), "skipped"),
        log(daysAgo(2), "skipped"),
        log(daysAgo(3), "done"),
      ],
      windowDays: 6,
    });
    expect(result.streak).toBe(2);
  });
});

// ─── §8.3 critical cases: skipped + missed interaction ───────────────────────

describe("streak — §8.3 skipped removed before consecutive-miss evaluation", () => {
  it("Done → Missed → Skipped → Missed → Done: after skipped removal two consecutive misses → streak 1", () => {
    // newest-first: Done(Apr23), Missed(Apr22), Skipped(Apr21), Missed(Apr20), Done(Apr19)
    // after skipped removal: Done, Missed, Missed, Done → streak 1
    const result = summarizeHabitProgress({
      logs: [
        log(TODAY, "done"),       // Apr23
        log(daysAgo(1), "missed"), // Apr22
        log(daysAgo(2), "skipped"), // Apr21
        log(daysAgo(3), "missed"), // Apr20
        log(daysAgo(4), "done"),   // Apr19
      ],
      windowDays: 6,
    });
    expect(result.streak).toBe(1);
  });

  it("Done → Skipped → Missed → Done → Done: isolated miss after skipped removal → streak 3", () => {
    // newest-first: Done(Apr23), Skipped(Apr22), Missed(Apr21), Done(Apr20), Done(Apr19)
    // after skipped removal: Done, Missed, Done, Done
    // walk: Done→1, Missed peek→Done isolated; Done→2, Done→3 → streak 3
    const result = summarizeHabitProgress({
      logs: [
        log(TODAY, "done"),        // Apr23
        log(daysAgo(1), "skipped"), // Apr22
        log(daysAgo(2), "missed"),  // Apr21
        log(daysAgo(3), "done"),    // Apr20
        log(daysAgo(4), "done"),    // Apr19
      ],
      windowDays: 6,
    });
    expect(result.streak).toBe(3);
  });

  it("Missed → Skipped → Done: after skipped removal, most recent is missed → streak 0", () => {
    // newest-first: Missed(Apr23), Skipped(Apr22), Done(Apr21)
    // after skipped removal: Missed, Done → most recent is missed → streak 0
    const result = summarizeHabitProgress({
      logs: [
        log(TODAY, "missed"),       // Apr23
        log(daysAgo(1), "skipped"), // Apr22
        log(daysAgo(2), "done"),    // Apr21
      ],
      windowDays: 5,
    });
    expect(result.streak).toBe(0);
  });
});

// ─── Consistency rate (unchanged behavior — regression) ────────────────────────

describe("consistencyRate — regression tests (unchanged behavior)", () => {
  const endDate = new Date("2026-04-23T10:00:00");

  it("returns 1.0 for all-done history", () => {
    const result = summarizeHabitProgress({
      endDate,
      logs: [log(TODAY, "done"), log(daysAgo(1), "done"), log(daysAgo(2), "done")],
      windowDays: 3,
    });
    expect(result.consistencyRate).toBe(1);
  });

  it("returns 0 for all-missed history", () => {
    const result = summarizeHabitProgress({
      endDate,
      logs: [log(TODAY, "missed"), log(daysAgo(1), "missed")],
      windowDays: 2,
    });
    expect(result.consistencyRate).toBe(0);
  });

  it("returns 0 for all-skipped history (zero denominator)", () => {
    const result = summarizeHabitProgress({
      endDate,
      logs: [log(TODAY, "skipped"), log(daysAgo(1), "skipped")],
      windowDays: 2,
    });
    expect(result.consistencyRate).toBe(0);
    expect(result.skipCount).toBe(2);
  });

  it("returns done/(done+missed) excluding skipped: 7 done, 3 missed, 5 skipped → 0.7", () => {
    const endDate2 = new Date("2026-04-23T10:00:00");
    const logs: HabitLogRecord[] = [];
    // Build: 7 done, 3 missed, 5 skipped spread across first 15 days of window
    const pattern: HabitLogRecord["status"][] = [
      "done", "done", "done", "done", "done", "done", "done",
      "missed", "missed", "missed",
      "skipped", "skipped", "skipped", "skipped", "skipped",
    ];
    for (let i = 0; i < pattern.length; i++) {
      const d = new Date(2026, 3, 23 - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      logs.push(log(dateStr, pattern[i]!));
    }
    const result = summarizeHabitProgress({ endDate: endDate2, logs, windowDays: 15 });
    expect(result.consistencyRate).toBeCloseTo(0.7);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("streak — edge cases", () => {
  it("handles windowDays larger than available log history without errors", () => {
    const result = summarizeHabitProgress({
      logs: [
        log(TODAY, "done"),
        log(daysAgo(1), "done"),
      ],
      windowDays: 30,
    });
    // Two done days followed by unlogged (treated as missed) days
    expect(result.streak).toBe(2);
  });

  it("anchors the walk to an explicitly provided endDate rather than now()", () => {
    const customEnd = new Date("2026-04-20T10:00:00");
    const result = summarizeHabitProgress({
      endDate: customEnd,
      logs: [
        log("2026-04-20", "done"),
        log("2026-04-19", "done"),
      ],
      windowDays: 5,
    });
    expect(result.streak).toBe(2);
    expect(result.todayStatus).toBe("done");
  });

  it("uses the newest same-date record when duplicates exist (tie-break by updated_at)", () => {
    const result = summarizeHabitProgress({
      logs: [
        log(TODAY, "done", {
          id: "older",
          updated_at: "2026-04-23T09:00:00.000Z",
        }),
        log(TODAY, "missed", {
          id: "newer",
          updated_at: "2026-04-23T10:00:00.000Z",
        }),
        log(daysAgo(1), "done"),
      ],
      windowDays: 7,
    });
    expect(result.todayStatus).toBe("missed");
    expect(result.streak).toBe(0);
  });
});

// ─── Active days awareness ─────────────────────────────────────────────────────
// TODAY = 2026-04-23 (Thursday, ISO weekday 4)
// Apr17=Fri(5), Apr18=Sat(6), Apr19=Sun(7), Apr20=Mon(1), Apr21=Tue(2),
// Apr22=Wed(3), Apr23=Thu(4)

describe("active days — streak engine", () => {
  // 1. Weekday habit, weekend gap: Fri done → Sat/Sun off → Mon done → streak = 2
  it("weekday habit: Fri done, Sat/Sun off, Mon done → streak 2", () => {
    // endDate = Mon Apr 20 so "today" = Mon (active day, just logged)
    const result = summarizeHabitProgress({
      activeDays: [1, 2, 3, 4, 5],
      endDate: new Date("2026-04-20T12:00:00"),
      logs: [
        log("2026-04-20", "done"), // Mon
        log("2026-04-17", "done"), // Fri — Sat/Sun are off, not in sequence
      ],
      windowDays: 7,
    });
    expect(result.streak).toBe(2);
    expect(result.todayStatus).toBe("done");
  });

  // 2. Weekday consistency denominator: 4/5 active days done = 80%
  it("weekday habit: 4 done + 1 missed out of 5 active days in window → 80% consistency", () => {
    const result = summarizeHabitProgress({
      activeDays: [1, 2, 3, 4, 5],
      logs: [
        log("2026-04-23", "done"),   // Thu
        log("2026-04-22", "done"),   // Wed
        log("2026-04-21", "done"),   // Tue
        log("2026-04-20", "done"),   // Mon
        log("2026-04-17", "missed"), // Fri — only missed active day
        // Apr18 Sat and Apr19 Sun have no logs (off-days — not counted)
      ],
      windowDays: 7,
    });
    expect(result.consistencyRate).toBeCloseTo(0.8);
  });

  // 3. MWF habit across weeks
  it("MWF habit: three done Mon/Wed/Fri → streak 3; today Thu is off-day → todayStatus null", () => {
    // Today = Thu Apr 23 = off-day for MWF habit
    const result = summarizeHabitProgress({
      activeDays: [1, 3, 5],
      logs: [
        log("2026-04-22", "done"), // Wed
        log("2026-04-20", "done"), // Mon
        log("2026-04-17", "done"), // Fri
      ],
      windowDays: 14,
    });
    expect(result.streak).toBe(3);
    expect(result.todayStatus).toBeNull();
  });

  // 4. Monday-only habit, consecutive Mondays → streak 3
  it("Monday-only habit: three consecutive Mondays done → streak 3", () => {
    const result = summarizeHabitProgress({
      activeDays: [1],
      logs: [
        log("2026-04-20", "done"), // Mon
        log("2026-04-13", "done"), // Mon
        log("2026-04-06", "done"), // Mon
      ],
      windowDays: 21,
    });
    expect(result.streak).toBe(3);
    expect(result.todayStatus).toBeNull(); // today = Thu, off-day for Mon-only
  });

  // 5. Today is off-day → todayStatus is null even if a log exists for that date
  it("today is an off-day → todayStatus null regardless of log", () => {
    // today = Thu Apr 23; weekday-only habit (Mon–Fri) but off means Sun would be null
    // Use endDate = Sun Apr 19 to simulate "today is Sunday on a weekday habit"
    const result = summarizeHabitProgress({
      activeDays: [1, 2, 3, 4, 5],
      endDate: new Date("2026-04-19T12:00:00"), // Sunday
      logs: [
        log("2026-04-19", "done"), // logged on a day that's off for this habit
      ],
      windowDays: 7,
    });
    expect(result.todayStatus).toBeNull();
  });

  // 6. Recovery edge case: isolated miss on active day still tolerated across off-day gap
  it("forgiving streak: done×3, isolated miss, [off,off], done — streak 4", () => {
    // Active days = weekdays. windowDays=7 → Apr17(Fri)..Apr23(Thu), off-days Apr18/19 skipped.
    // Active-day sequence newest-first: Thu=done, Wed=done, Tue=done, Mon=missed, Fri=done
    // After off-day removal: [done, done, done, missed, done]
    // Forgiving walk: done=1, done=2, done=3, missed(peek→done → isolated), done=4 → streak 4
    const result = summarizeHabitProgress({
      activeDays: [1, 2, 3, 4, 5],
      logs: [
        log("2026-04-23", "done"),   // Thu (today)
        log("2026-04-22", "done"),   // Wed
        log("2026-04-21", "done"),   // Tue
        log("2026-04-20", "missed"), // Mon — isolated miss (Sat/Sun off-days follow)
        // Apr18 Sat and Apr19 Sun are off-days (skipped from streak sequence)
        log("2026-04-17", "done"),   // Fri — resumes after off-day gap
      ],
      windowDays: 7,
    });
    expect(result.streak).toBe(4);
  });

  // 7. Backward-compat: no activeDays param → all-days behavior unchanged
  it("activeDays omitted → all-days behavior unchanged (regression guard)", () => {
    const result = summarizeHabitProgress({
      logs: [log(TODAY, "done"), log(daysAgo(1), "done")],
      windowDays: 7,
    });
    expect(result.streak).toBe(2);
    expect(result.todayStatus).toBe("done");
  });
});
