import { detectSingleMiss, detectStreakBreak } from "../api";

import type { HabitLogRecord } from "@/features/habits/types";

const TODAY = "2026-05-01";
const YESTERDAY = "2026-04-30";
const DAY_BEFORE = "2026-04-29";
const DAY_BEFORE_2 = "2026-04-28";
const START = "2026-04-01";

function log(
  log_date: string,
  status: "done" | "missed" | "skipped",
): HabitLogRecord {
  return {
    id: log_date,
    habit_id: "h1",
    user_id: "u1",
    log_date,
    status,
    note: null,
    created_at: `${log_date}T10:00:00.000Z`,
    updated_at: `${log_date}T10:00:00.000Z`,
  };
}

// ---------------------------------------------------------------------------
// detectStreakBreak
// ---------------------------------------------------------------------------

describe("detectStreakBreak", () => {
  it("returns not broken for empty logs", () => {
    expect(detectStreakBreak([], START, TODAY)).toEqual({ broken: false });
  });

  it("returns not broken when only Done days exist", () => {
    expect(
      detectStreakBreak([log(YESTERDAY, "done")], START, TODAY),
    ).toEqual({ broken: false });
  });

  it("returns not broken for a single miss (no consecutive pair)", () => {
    expect(
      detectStreakBreak(
        [log(DAY_BEFORE, "done"), log(YESTERDAY, "missed")],
        START,
        TODAY,
      ),
    ).toEqual({ broken: false });
  });

  it("returns broken for two consecutive misses", () => {
    const result = detectStreakBreak(
      [
        log(DAY_BEFORE_2, "done"),
        log(DAY_BEFORE, "missed"),
        log(YESTERDAY, "missed"),
      ],
      START,
      TODAY,
    );
    expect(result).toEqual({
      broken: true,
      breakRunStartDate: DAY_BEFORE,
    });
  });

  it("returns broken when skipped is between two misses (§8.3 skipped removal)", () => {
    // Sequence newest-first: YESTERDAY missed, DAY_BEFORE skipped, DAY_BEFORE_2 missed.
    // After skip removal: [missed, missed] → prefix length 2 → broken.
    const result = detectStreakBreak(
      [
        log("2026-04-27", "done"),
        log(DAY_BEFORE_2, "missed"),
        log(DAY_BEFORE, "skipped"),
        log(YESTERDAY, "missed"),
      ],
      START,
      TODAY,
    );
    expect(result.broken).toBe(true);
  });

  it("returns not broken for a sandwiched single miss (done-missed-done)", () => {
    expect(
      detectStreakBreak(
        [
          log(DAY_BEFORE_2, "done"),
          log(DAY_BEFORE, "missed"),
          log(YESTERDAY, "done"),
        ],
        START,
        TODAY,
      ),
    ).toEqual({ broken: false });
  });

  it("returns not broken when break is in the past (most recent entry is done)", () => {
    expect(
      detectStreakBreak(
        [
          log(DAY_BEFORE_2, "missed"),
          log(DAY_BEFORE, "missed"),
          log(YESTERDAY, "done"),
        ],
        START,
        TODAY,
      ),
    ).toEqual({ broken: false });
  });

  it("returns not broken when no Done in history (precondition guard)", () => {
    expect(
      detectStreakBreak(
        [log(DAY_BEFORE, "missed"), log(YESTERDAY, "missed")],
        START,
        TODAY,
      ),
    ).toEqual({ broken: false });
  });

  it("returns not broken when habit started today and today is unlogged", () => {
    expect(detectStreakBreak([], TODAY, TODAY)).toEqual({ broken: false });
  });

  it("returns not broken when today is logged Done and yesterday + day-before were missed", () => {
    // today's Done is the head of the cleaned sequence → miss-prefix = 0
    const result = detectStreakBreak(
      [
        log(DAY_BEFORE, "missed"),
        log(YESTERDAY, "missed"),
        log(TODAY, "done"),
      ],
      START,
      TODAY,
    );
    expect(result).toEqual({ broken: false });
  });

  it("returns broken when today is logged Skipped and yesterday + day-before were missed", () => {
    // today's Skipped is removed by skip-filter, leaving two misses as the prefix
    const result = detectStreakBreak(
      [
        log(DAY_BEFORE, "missed"),
        log(YESTERDAY, "missed"),
        log(TODAY, "skipped"),
        // Need at least one Done to pass precondition guard
        log(DAY_BEFORE_2, "done"),
      ],
      START,
      TODAY,
    );
    expect(result.broken).toBe(true);
  });

  it("returns broken for extended absence (synthesized missed days)", () => {
    // Only one Done 30 days ago, all subsequent days unlogged (synthesized missed)
    const longAgoDate = "2026-04-01";
    const result = detectStreakBreak([log(longAgoDate, "done")], longAgoDate, TODAY);
    expect(result.broken).toBe(true);
  });

  it("uses breakRunStartDate of oldest miss in the run, not newest", () => {
    // 3-day miss run: DAY_BEFORE_2, DAY_BEFORE, YESTERDAY
    // breakRunStartDate should be DAY_BEFORE_2 (oldest)
    const result = detectStreakBreak(
      [
        log("2026-04-27", "done"),
        log(DAY_BEFORE_2, "missed"),
        log(DAY_BEFORE, "missed"),
        log(YESTERDAY, "missed"),
      ],
      START,
      TODAY,
    );
    expect(result).toEqual({ broken: true, breakRunStartDate: DAY_BEFORE_2 });
  });
});

// ---------------------------------------------------------------------------
// detectSingleMiss
// ---------------------------------------------------------------------------

describe("detectSingleMiss", () => {
  it("returns single miss when yesterday is the only missed entry", () => {
    expect(
      detectSingleMiss(
        [log(DAY_BEFORE, "done"), log(YESTERDAY, "missed")],
        START,
        TODAY,
      ),
    ).toEqual({ isSingleMiss: true, missDate: YESTERDAY });
  });

  it("returns not single miss when two consecutive misses exist (modal handles it)", () => {
    expect(
      detectSingleMiss(
        [
          log(DAY_BEFORE_2, "done"),
          log(DAY_BEFORE, "missed"),
          log(YESTERDAY, "missed"),
        ],
        START,
        TODAY,
      ),
    ).toEqual({ isSingleMiss: false });
  });

  it("returns single miss when yesterday missed and day-before was skipped (skipped removed)", () => {
    // After skip removal: head is yesterday missed, next is DAY_BEFORE_2 done → single miss
    expect(
      detectSingleMiss(
        [
          log(DAY_BEFORE_2, "done"),
          log(DAY_BEFORE, "skipped"),
          log(YESTERDAY, "missed"),
        ],
        START,
        TODAY,
      ),
    ).toEqual({ isSingleMiss: true, missDate: YESTERDAY });
  });

  it("returns not single miss when latest miss is not yesterday (today's miss edge case)", () => {
    // If somehow TODAY has a missed log it should not trigger the banner
    expect(
      detectSingleMiss(
        [log(DAY_BEFORE, "done"), log(TODAY, "missed")],
        START,
        TODAY,
      ),
    ).toEqual({ isSingleMiss: false });
  });

  it("returns not single miss when no Done in history (precondition guard)", () => {
    expect(
      detectSingleMiss([log(YESTERDAY, "missed")], START, TODAY),
    ).toEqual({ isSingleMiss: false });
  });
});
