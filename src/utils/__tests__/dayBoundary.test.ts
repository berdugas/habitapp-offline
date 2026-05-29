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
