import { setNowForTesting, resetClockForTesting } from "@/utils/clock";
import {
  __noonOfForTesting,
  __msUntilNextLocalMidnightForTesting,
} from "@/utils/dayBoundary";

afterEach(() => {
  resetClockForTesting();
});

describe("noonOf()", () => {
  it("returns a Date pinned to local 12:00:00 for the given YYYY-MM-DD", () => {
    const d = __noonOfForTesting("2026-05-29");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4); // May
    expect(d.getDate()).toBe(29);
    expect(d.getHours()).toBe(12);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });
});

describe("msUntilNextLocalMidnight()", () => {
  it("returns the ms until the next local 00:00 — short window before midnight", () => {
    // 23:30 local on 2026-05-29 → 30 minutes to midnight
    const at = new Date(2026, 4, 29, 23, 30, 0, 0);
    expect(__msUntilNextLocalMidnightForTesting(at)).toBe(30 * 60 * 1000);
  });

  it("returns ~24 hours just after midnight", () => {
    const at = new Date(2026, 4, 29, 0, 0, 1, 0); // 1s past midnight
    const ms = __msUntilNextLocalMidnightForTesting(at);
    expect(ms).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });
});

import {
  getDayBoundarySnapshotForTesting,
  subscribeDayBoundary,
  triggerDayBoundaryCheckForTesting,
  resetDayBoundaryForTesting,
} from "@/utils/dayBoundary";

afterEach(() => {
  resetDayBoundaryForTesting();
});

describe("day-boundary store", () => {
  it("getSnapshot returns the current date string and a noon-anchored Date", () => {
    setNowForTesting(new Date(2026, 4, 29, 10, 0, 0));
    const snap = getDayBoundarySnapshotForTesting();
    expect(snap.todayDateString).toBe("2026-05-29");
    expect(snap.todayAnchorDate.getHours()).toBe(12);
    expect(snap.todayAnchorDate.getDate()).toBe(29);
  });

  it("getSnapshot returns referentially-equal snapshot until rollover", () => {
    setNowForTesting(new Date(2026, 4, 29, 10, 0, 0));
    const a = getDayBoundarySnapshotForTesting();
    const b = getDayBoundarySnapshotForTesting();
    expect(a).toBe(b);
    expect(a.todayAnchorDate).toBe(b.todayAnchorDate);
  });

  it("triggerDayBoundaryCheckForTesting is a no-op when date is unchanged", () => {
    setNowForTesting(new Date(2026, 4, 29, 10, 0, 0));
    const listener = jest.fn();
    subscribeDayBoundary(listener);
    triggerDayBoundaryCheckForTesting();
    expect(listener).not.toHaveBeenCalled();
  });

  it("triggerDayBoundaryCheckForTesting notifies subscribers when date has changed", () => {
    setNowForTesting(new Date(2026, 4, 29, 10, 0, 0));
    getDayBoundarySnapshotForTesting(); // prime the cache
    const listener = jest.fn();
    subscribeDayBoundary(listener);

    setNowForTesting(new Date(2026, 4, 30, 0, 0, 5));
    triggerDayBoundaryCheckForTesting();

    expect(listener).toHaveBeenCalledTimes(1);
    const snap = getDayBoundarySnapshotForTesting();
    expect(snap.todayDateString).toBe("2026-05-30");
  });

  it("subscribe returns an unsubscribe function", () => {
    setNowForTesting(new Date(2026, 4, 29, 10, 0, 0));
    getDayBoundarySnapshotForTesting();
    const listener = jest.fn();
    const unsubscribe = subscribeDayBoundary(listener);
    unsubscribe();

    setNowForTesting(new Date(2026, 4, 30, 0, 0, 5));
    triggerDayBoundaryCheckForTesting();
    expect(listener).not.toHaveBeenCalled();
  });

  it("resetDayBoundaryForTesting clears the listener set", () => {
    setNowForTesting(new Date(2026, 4, 29, 10, 0, 0));
    const listener = jest.fn();
    subscribeDayBoundary(listener);
    resetDayBoundaryForTesting();

    setNowForTesting(new Date(2026, 4, 30, 0, 0, 5));
    triggerDayBoundaryCheckForTesting();
    expect(listener).not.toHaveBeenCalled();
  });
});
