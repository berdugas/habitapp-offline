jest.mock("react-native", () => {
  const listeners = new Set();
  const AppState = {
    currentState: "active",
    addEventListener: (event, listener) => {
      if (event === "change") listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
    __listeners: listeners,
  };
  return { AppState };
});

import { AppState as _MockAppState } from "react-native";
const mockAppState = _MockAppState as unknown as {
  currentState: string;
  __listeners: Set<(state: string) => void>;
};
const appStateListeners = mockAppState.__listeners;

function emitAppState(state: string): void {
  mockAppState.currentState = state;
  for (const l of appStateListeners) l(state);
}

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

import { initDayBoundary } from "@/utils/dayBoundary";

describe("initDayBoundary — AppState listener", () => {
  beforeEach(() => {
    appStateListeners.clear();
    mockAppState.currentState = "active";
  });

  it("registers an AppState change listener and runs checkAndMaybeNotify on 'active'", () => {
    setNowForTesting(new Date(2026, 4, 29, 23, 0, 0));
    getDayBoundarySnapshotForTesting(); // prime
    const listener = jest.fn();
    subscribeDayBoundary(listener);

    const cleanup = initDayBoundary();

    setNowForTesting(new Date(2026, 4, 30, 0, 0, 5));
    emitAppState("active");

    expect(listener).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("does not notify on 'background' or 'inactive' transitions", () => {
    setNowForTesting(new Date(2026, 4, 29, 23, 0, 0));
    getDayBoundarySnapshotForTesting();
    const listener = jest.fn();
    subscribeDayBoundary(listener);

    const cleanup = initDayBoundary();

    setNowForTesting(new Date(2026, 4, 30, 0, 0, 5));
    emitAppState("background");
    emitAppState("inactive");

    expect(listener).not.toHaveBeenCalled();
    cleanup();
  });

  it("cleanup removes the AppState subscription", () => {
    const cleanup = initDayBoundary();
    expect(appStateListeners.size).toBe(1);
    cleanup();
    expect(appStateListeners.size).toBe(0);
  });

  it("init is idempotent: a second call without cleanup does not double-subscribe", () => {
    const cleanup1 = initDayBoundary();
    const cleanup2 = initDayBoundary();
    expect(appStateListeners.size).toBe(1);
    cleanup1();
    cleanup2();
  });
});

describe("initDayBoundary — midnight timer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    appStateListeners.clear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("fires checkAndMaybeNotify at the next local midnight", () => {
    setNowForTesting(new Date(2026, 4, 29, 23, 59, 0));
    getDayBoundarySnapshotForTesting();
    const listener = jest.fn();
    subscribeDayBoundary(listener);

    const cleanup = initDayBoundary();

    setNowForTesting(new Date(2026, 4, 30, 0, 0, 2));
    // Advance past the scheduled timer: 60s + 1s margin
    jest.advanceTimersByTime(62_000);

    expect(listener).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("reschedules the timer after firing", () => {
    setNowForTesting(new Date(2026, 4, 29, 23, 59, 30));
    getDayBoundarySnapshotForTesting();
    const cleanup = initDayBoundary();

    setNowForTesting(new Date(2026, 4, 30, 0, 0, 2));
    jest.advanceTimersByTime(31_000); // fire the first timer

    // A second timer should now be queued for next midnight.
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    cleanup();
  });
});
