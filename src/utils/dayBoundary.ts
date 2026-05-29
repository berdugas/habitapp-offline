import { AppState } from "react-native";

import {
  now as readNow,
  todayDateString as readTodayDateString,
} from "@/utils/clock";

type DaySnapshot = {
  todayDateString: string;
  todayAnchorDate: Date;
};

function noonOf(dateString: string): Date {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function msUntilNextLocalMidnight(at: Date = readNow()): number {
  const tomorrow = new Date(
    at.getFullYear(),
    at.getMonth(),
    at.getDate() + 1,
  );
  return tomorrow.getTime() - at.getTime();
}

let cachedSnapshot: DaySnapshot | null = null;
const listeners = new Set<() => void>();

function ensureCache(): DaySnapshot {
  if (cachedSnapshot === null) {
    const ds = readTodayDateString();
    cachedSnapshot = { todayDateString: ds, todayAnchorDate: noonOf(ds) };
  }
  return cachedSnapshot;
}

function checkAndMaybeNotify(): void {
  const next = readTodayDateString();
  const current = ensureCache();
  if (next !== current.todayDateString) {
    cachedSnapshot = { todayDateString: next, todayAnchorDate: noonOf(next) };
    for (const listener of listeners) listener();
  }
}

export function getDayBoundarySnapshot(): DaySnapshot {
  return ensureCache();
}

export function subscribeDayBoundary(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let initialized = false;
let appStateSubscription: { remove: () => void } | null = null;
let midnightTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleMidnightTimer(): void {
  if (midnightTimer !== null) clearTimeout(midnightTimer);
  midnightTimer = setTimeout(() => {
    checkAndMaybeNotify();
    scheduleMidnightTimer();
  }, msUntilNextLocalMidnight() + 1000);
}

export function initDayBoundary(): () => void {
  if (initialized) {
    return () => {
      /* no-op for second-caller cleanup */
    };
  }
  initialized = true;

  appStateSubscription = AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") {
      checkAndMaybeNotify();
      scheduleMidnightTimer();
    }
  });

  scheduleMidnightTimer();

  return () => {
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }
    if (midnightTimer !== null) {
      clearTimeout(midnightTimer);
      midnightTimer = null;
    }
    initialized = false;
  };
}

// --- Test seams (gated below in Task 1.3, but exported here for the unit tests) ---

const isTest =
  process.env.NODE_ENV === "test" ||
  (typeof __DEV__ !== "undefined" && __DEV__);

export function triggerDayBoundaryCheckForTesting(): void {
  if (!isTest) {
    throw new Error(
      "triggerDayBoundaryCheckForTesting cannot be called outside of test or dev builds.",
    );
  }
  checkAndMaybeNotify();
}

export function resetDayBoundaryForTesting(): void {
  if (!isTest) {
    throw new Error(
      "resetDayBoundaryForTesting cannot be called outside of test or dev builds.",
    );
  }
  cachedSnapshot = null;
  listeners.clear();
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  if (midnightTimer !== null) {
    clearTimeout(midnightTimer);
    midnightTimer = null;
  }
  initialized = false;
}

export function getDayBoundarySnapshotForTesting(): DaySnapshot {
  return ensureCache();
}

export const __noonOfForTesting = noonOf;
export const __msUntilNextLocalMidnightForTesting = msUntilNextLocalMidnight;
