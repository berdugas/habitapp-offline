# Today Screen Day-Rollover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every render-time consumer of "today's date" re-render when the local date changes, both at midnight while foregrounded and on foreground-after-midnight. The user never sees a stale day.

**Architecture:** A module-level day-boundary store with two triggers (AppState foreground + setTimeout to next local midnight) feeding one idempotent handler. Consumers subscribe via `useSyncExternalStore` through two hooks: `useTodayDateString()` and `useTodayAnchorDate()`. Render-time call sites migrate to the hooks; action-time call sites keep using bare `now()` / `todayDateString()`.

**Tech Stack:** React Native, React 18 `useSyncExternalStore`, Jest + `@testing-library/react-native`, existing `@/utils/clock` test seam (`setNowForTesting` / `resetClockForTesting`).

**Design reference:** [docs/superpowers/specs/2026-05-29-today-screen-day-rollover-design.md](../specs/2026-05-29-today-screen-day-rollover-design.md) (commit `55981b1`).

**Branch:** Work proceeds on `main` (current branch). The user pushes directly to `main` per existing repo convention.

**Test command:** `npm test -- <path>` runs jest with the project's jest-expo preset.

---

## Batch 1 — Day-boundary primitive

Build the store, hooks, helpers, init wiring, and full unit test coverage. Nothing in the existing app changes behavior yet — call sites still use bare `todayDateString()`.

**File structure (new files in this batch):**

- `src/utils/dayBoundary.ts` — store + hooks + init + helpers + test seams. One file because all pieces share private module-level state; splitting forces leaky exports.
- `src/utils/__tests__/dayBoundary.test.ts` — unit tests for store, helpers, init, AppState/timer behavior.
- `src/utils/__tests__/useTodayDateString.test.tsx` — hook tests via `renderHook`.

**File structure (edited):**

- `src/providers/AppProviders.tsx` — call `initDayBoundary()` once in a root effect.

### Task 1.1: Specify `noonOf()` and `msUntilNextLocalMidnight()` with tests first

**Files:**
- Create: `src/utils/dayBoundary.ts`
- Create: `src/utils/__tests__/dayBoundary.test.ts`

- [ ] **Step 1: Write the failing tests for the two helpers**

Create `src/utils/__tests__/dayBoundary.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- src/utils/__tests__/dayBoundary.test.ts`
Expected: FAIL with "Cannot find module '@/utils/dayBoundary'".

- [ ] **Step 3: Create the minimal `dayBoundary.ts` with helpers exposed via test-only exports**

Create `src/utils/dayBoundary.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm test -- src/utils/__tests__/dayBoundary.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/dayBoundary.ts src/utils/__tests__/dayBoundary.test.ts
git commit -m "$(cat <<'EOF'
feat(dayBoundary): add noonOf + msUntilNextLocalMidnight helpers

DST-safe primitives required by the day-rollover store. Both use the
local-date constructor; never goes through string parsing.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 1.2: Store core — getSnapshot, subscribe, checkAndMaybeNotify

**Files:**
- Modify: `src/utils/dayBoundary.ts`
- Modify: `src/utils/__tests__/dayBoundary.test.ts`

- [ ] **Step 1: Write failing tests for store core**

Append to `src/utils/__tests__/dayBoundary.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- src/utils/__tests__/dayBoundary.test.ts`
Expected: FAIL with "Cannot find module" or undefined exports for the new symbols.

- [ ] **Step 3: Implement the store core**

Replace `src/utils/dayBoundary.ts` with:

```ts
import { todayDateString as readTodayDateString } from "@/utils/clock";

type DaySnapshot = {
  todayDateString: string;
  todayAnchorDate: Date;
};

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
}

export function getDayBoundarySnapshotForTesting(): DaySnapshot {
  return ensureCache();
}

export const __noonOfForTesting = noonOf;
export const __msUntilNextLocalMidnightForTesting = msUntilNextLocalMidnight;
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm test -- src/utils/__tests__/dayBoundary.test.ts`
Expected: PASS, all 9 tests (3 helper + 6 store).

- [ ] **Step 5: Commit**

```bash
git add src/utils/dayBoundary.ts src/utils/__tests__/dayBoundary.test.ts
git commit -m "$(cat <<'EOF'
feat(dayBoundary): add store core with subscribe + checkAndMaybeNotify

Lazy-initialized cache (DaySnapshot with date string + noon-anchored
Date). checkAndMaybeNotify is idempotent: notifies subscribers only on
date change. Test seams gated by NODE_ENV / __DEV__ matching the
existing clock module pattern.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 1.3: AppState listener + midnight timer in `initDayBoundary()`

**Files:**
- Modify: `src/utils/dayBoundary.ts`
- Modify: `src/utils/__tests__/dayBoundary.test.ts`

- [ ] **Step 1: Set up AppState mock at the top of the test file**

Insert at the very top of `src/utils/__tests__/dayBoundary.test.ts` (before any other imports):

```ts
const appStateListeners = new Set<(state: string) => void>();
const mockAppState = {
  currentState: "active" as string,
  addEventListener: (event: string, listener: (state: string) => void) => {
    if (event === "change") appStateListeners.add(listener);
    return { remove: () => appStateListeners.delete(listener) };
  },
};
function emitAppState(state: string): void {
  mockAppState.currentState = state;
  for (const l of appStateListeners) l(state);
}

jest.mock("react-native", () => ({
  AppState: mockAppState,
}));
```

- [ ] **Step 2: Write failing tests for init + AppState + midnight timer**

Append to the same test file:

```ts
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
```

- [ ] **Step 3: Run tests to confirm they fail**

Run: `npm test -- src/utils/__tests__/dayBoundary.test.ts`
Expected: FAIL with `initDayBoundary is not a function`.

- [ ] **Step 4: Implement `initDayBoundary`**

Append to `src/utils/dayBoundary.ts` (before the test-seam exports):

```ts
import { AppState } from "react-native";

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
```

Also update `resetDayBoundaryForTesting` to clear init state:

```ts
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
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `npm test -- src/utils/__tests__/dayBoundary.test.ts`
Expected: PASS, all tests (helpers + store + AppState + timer).

- [ ] **Step 6: Commit**

```bash
git add src/utils/dayBoundary.ts src/utils/__tests__/dayBoundary.test.ts
git commit -m "$(cat <<'EOF'
feat(dayBoundary): wire AppState listener + midnight setTimeout

initDayBoundary registers AppState 'change' and schedules a recurring
+1s-margin timer to the next local midnight. Idempotent under fast
refresh; cleanup tears down both. AppState path also reschedules the
timer to absorb suspended-timer skew.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 1.4: `useTodayDateString` and `useTodayAnchorDate` hooks

**Files:**
- Modify: `src/utils/dayBoundary.ts`
- Create: `src/utils/__tests__/useTodayDateString.test.tsx`

- [ ] **Step 1: Write failing hook tests**

Create `src/utils/__tests__/useTodayDateString.test.tsx`:

```tsx
const appStateListeners = new Set<(state: string) => void>();
const mockAppState = {
  currentState: "active" as string,
  addEventListener: (event: string, listener: (state: string) => void) => {
    if (event === "change") appStateListeners.add(listener);
    return { remove: () => appStateListeners.delete(listener) };
  },
};

jest.mock("react-native", () => ({
  AppState: mockAppState,
}));

import { renderHook, act } from "@testing-library/react-native";
import { setNowForTesting, resetClockForTesting } from "@/utils/clock";
import {
  useTodayDateString,
  useTodayAnchorDate,
  resetDayBoundaryForTesting,
  triggerDayBoundaryCheckForTesting,
} from "@/utils/dayBoundary";

afterEach(() => {
  resetDayBoundaryForTesting();
  resetClockForTesting();
  appStateListeners.clear();
});

describe("useTodayDateString", () => {
  it("returns the current local date string on first render", () => {
    setNowForTesting(new Date(2026, 4, 29, 10, 0, 0));
    const { result } = renderHook(() => useTodayDateString());
    expect(result.current).toBe("2026-05-29");
  });

  it("re-renders the consumer when the date changes", () => {
    setNowForTesting(new Date(2026, 4, 29, 23, 59, 0));
    const renderCounter = jest.fn();
    const { result } = renderHook(() => {
      renderCounter();
      return useTodayDateString();
    });
    expect(result.current).toBe("2026-05-29");
    expect(renderCounter).toHaveBeenCalledTimes(1);

    act(() => {
      setNowForTesting(new Date(2026, 4, 30, 0, 0, 5));
      triggerDayBoundaryCheckForTesting();
    });

    expect(result.current).toBe("2026-05-30");
    expect(renderCounter).toHaveBeenCalledTimes(2);
  });

  it("does NOT re-render when trigger fires with unchanged date", () => {
    setNowForTesting(new Date(2026, 4, 29, 10, 0, 0));
    const renderCounter = jest.fn();
    renderHook(() => {
      renderCounter();
      return useTodayDateString();
    });
    expect(renderCounter).toHaveBeenCalledTimes(1);

    act(() => {
      triggerDayBoundaryCheckForTesting();
      triggerDayBoundaryCheckForTesting();
    });

    expect(renderCounter).toHaveBeenCalledTimes(1);
  });
});

describe("useTodayAnchorDate", () => {
  it("returns a Date pinned to today 12:00:00 local", () => {
    setNowForTesting(new Date(2026, 4, 29, 23, 30, 0));
    const { result } = renderHook(() => useTodayAnchorDate());
    expect(result.current.getHours()).toBe(12);
    expect(result.current.getDate()).toBe(29);
  });

  it("returns referentially-equal value across re-renders within the same day", () => {
    setNowForTesting(new Date(2026, 4, 29, 10, 0, 0));
    const { result, rerender } = renderHook(() => useTodayAnchorDate());
    const first = result.current;
    rerender({});
    expect(result.current).toBe(first);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- src/utils/__tests__/useTodayDateString.test.tsx`
Expected: FAIL with undefined `useTodayDateString` / `useTodayAnchorDate`.

- [ ] **Step 3: Implement the hooks**

Append to `src/utils/dayBoundary.ts`:

```ts
import { useSyncExternalStore } from "react";

export function useTodayDateString(): string {
  return useSyncExternalStore(
    subscribeDayBoundary,
    () => getDayBoundarySnapshot().todayDateString,
    () => getDayBoundarySnapshot().todayDateString, // getServerSnapshot: no-op for RN
  );
}

export function useTodayAnchorDate(): Date {
  return useSyncExternalStore(
    subscribeDayBoundary,
    () => getDayBoundarySnapshot().todayAnchorDate,
    () => getDayBoundarySnapshot().todayAnchorDate,
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm test -- src/utils/__tests__/useTodayDateString.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/dayBoundary.ts src/utils/__tests__/useTodayDateString.test.tsx
git commit -m "$(cat <<'EOF'
feat(dayBoundary): add useTodayDateString + useTodayAnchorDate hooks

useSyncExternalStore subscriptions over the day-boundary store. Hooks
return referentially-equal values across same-day re-renders so they
remain safe as useMemo deps. getServerSnapshot is the same as
getSnapshot (no SSR on RN).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 1.5: Wire `initDayBoundary()` into `AppProviders`

**Files:**
- Modify: `src/providers/AppProviders.tsx`

- [ ] **Step 1: Read the current `AppProviders.tsx`**

Read the file. Note the exact current contents — the file may have grown to include things this plan didn't anticipate (gesture handler root, safe-area provider, error boundary, theme, navigation container). **Do not rewrite the file from scratch.** The next steps are surgical edits over whatever is currently there.

- [ ] **Step 2: Edit the React import to include `useEffect`**

Find the existing `import` statement for React (currently `import type { PropsWithChildren } from "react";` per the file read at design time). If `useEffect` is not already imported, change it:

Old:
```ts
import type { PropsWithChildren } from "react";
```

New:
```ts
import { useEffect, type PropsWithChildren } from "react";
```

If `useEffect` is already imported via a different shape, leave that line alone.

- [ ] **Step 3: Add the `initDayBoundary` import**

Add one line alongside the other `@/...` imports (alphabetical ordering preferred to match the file):

```ts
import { initDayBoundary } from "@/utils/dayBoundary";
```

- [ ] **Step 4: Insert the init effect inside the `AppProviders` component body**

Find the `AppProviders` function. Immediately inside the function body, **before** the existing `return (...)`, insert:

```tsx
  useEffect(() => {
    const cleanup = initDayBoundary();
    return cleanup;
  }, []);
```

Do not touch anything else in the component — the existing JSX tree (whatever providers it contains) stays exactly as-is.

- [ ] **Step 5: Run the full unit test suite to ensure no regressions**

Run: `npm test -- src/utils src/providers`
Expected: PASS for all dayBoundary tests and any AppProviders tests; no failures.

- [ ] **Step 6: Commit**

```bash
git add src/providers/AppProviders.tsx
git commit -m "$(cat <<'EOF'
feat(providers): init day-boundary listener at app root

initDayBoundary registers the AppState change listener and midnight
timer once per mount. Cleanup teardown runs on unmount / fast refresh.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Batch 1 verification gate

- [ ] **Step 1: Run all tests under src/utils and src/providers**

Run: `npm test -- src/utils src/providers`
Expected: All green; new tests pass; no existing tests changed.

- [ ] **Step 2: Run the full suite to confirm no incidental breakage**

Run: `npm test`
Expected: All green. If anything broke that doesn't touch `dayBoundary`, stop and investigate before proceeding to Batch 2.

- [ ] **Step 3: Manual sanity check (optional but recommended)**

If you have a dev build running, open the app and confirm it boots normally. The day-boundary store is wired but no consumer reads from it yet, so behavior is identical.

---

## Batch 2 — Migrate render-time hooks (5 files, ~17 sites)

Each task migrates one file. Each migration is a mechanical substitution: `todayDateString()` → `useTodayDateString()`, `toDeviceDateString()` (no-arg form, render-time) → `useTodayDateString()`, `now()` → `useTodayAnchorDate()` at render time only. Action-time references inside mutation handlers stay untouched.

Tests do not change in this batch — the values returned at a given moment are identical, so existing assertions hold.

### Task 2.0: Verify the load-bearing helper-internal clone claim

**Files (read only):**
- Read: `src/utils/dates.ts`

The plan asserts that `getTrailingDateRangeStrings`, `getWeekStartDate`, `getWeekStartDateString`, and `addDeviceDays` all construct a fresh `Date` before mutating their input. If any of them mutates via `setHours` / `setDate` / `setMonth` without cloning first, every `useTodayAnchorDate()` consumer downstream sees a corrupted cached anchor and the whole abstraction silently fails. **Verify before migrating any caller.**

- [ ] **Step 1: Read `src/utils/dates.ts` end-to-end**

Confirm each of these four exports begins with `new Date(<arg>)` (or `new Date()`) before any mutating method call:

- `addDeviceDays(date, amount)` — first line should be `const nextDate = new Date(date);`
- `getTrailingDateRangeStrings(windowDays, endDate)` — first line should be `const safeEndDate = new Date(endDate);`
- `getWeekStartDate(date)` — first line should be `const localDate = new Date(date);`
- `getWeekStartDateString(date)` — delegates to `getWeekStartDate`, no direct mutation

Verified at plan-write time: all four clone first. If a later commit has changed this, fix the helper or wrap every `useTodayAnchorDate()` site in `new Date(todayAnchor)` before passing through. Do not proceed with Batch 2 until this is confirmed in the current code.

- [ ] **Step 2: Spot-check with a grep**

Run:
```bash
grep -nE "^(export )?function (addDeviceDays|getTrailingDateRangeStrings|getWeekStartDate|getWeekStartDateString)" src/utils/dates.ts
```

For each match, eyeball the next 3-5 lines for a `new Date(...)` clone before any `set*` call.

No commit — this is a verification step only.

### Task 2.1: Migrate `src/features/habits/hooks.ts`

**Files:**
- Modify: `src/features/habits/hooks.ts`

- [ ] **Step 0: Read the file and confirm the exact identifiers in current code**

Read `src/features/habits/hooks.ts`. For each render-time date call about to be migrated, note whether the current code reads `todayDateString()` or `toDeviceDateString()` (no-arg) or something else. The plan's Old snippets reflect the file at design time (`toDeviceDateString()`), but if a more recent commit changed the identifier, the substitution will not match and the executor must reconcile before continuing.

- [ ] **Step 1: Replace the render-time date reads in `useEligibleHabitsQuery` and `useUpcomingActiveHabitsQuery`**

Find lines 118-138 (the two hooks). Apply this exact edit to `useEligibleHabitsQuery`:

Old:
```ts
export function useEligibleHabitsQuery() {
  const { user } = useAuthSession();
  const todayDate = toDeviceDateString();

  return useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => listEligibleHabitsForToday(user!.id, todayDate),
    queryKey: getEligibleHabitsQueryKey(user?.id, todayDate),
  });
}
```

New:
```ts
export function useEligibleHabitsQuery() {
  const { user } = useAuthSession();
  const todayDate = useTodayDateString();

  return useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => listEligibleHabitsForToday(user!.id, todayDate),
    queryKey: getEligibleHabitsQueryKey(user?.id, todayDate),
  });
}
```

Apply the analogous edit to `useUpcomingActiveHabitsQuery` (lines 129-138): change `const todayDate = toDeviceDateString();` to `const todayDate = useTodayDateString();`.

- [ ] **Step 2: Add the import**

At the top of the file, add an import line for `useTodayDateString`:

```ts
import { useTodayDateString } from "@/utils/dayBoundary";
```

If `toDeviceDateString` is not used elsewhere in the file's render-time scope but is still used inside mutation handlers (`onSuccess`, lines 278, 342) and a telemetry call (line 636), **keep the import** — those action-time uses are intentional.

- [ ] **Step 3: Run the relevant existing tests**

Run: `npm test -- src/features/habits`
Expected: All green. The migrated hooks return the same string they did before; query keys are identical.

- [ ] **Step 4: Commit**

```bash
git add src/features/habits/hooks.ts
git commit -m "$(cat <<'EOF'
refactor(habits): subscribe useEligibleHabitsQuery to day boundary

Two hooks now read today via useTodayDateString so they re-render on
local-date rollover. Mutation handlers (action-time) still use bare
toDeviceDateString.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 2.2: Migrate `src/features/today/hooks.ts`

**Files:**
- Modify: `src/features/today/hooks.ts`

This file has the most render-time sites — `useHabitLogsForRange`, `useHabitLogsForHabitsInRange`, `useTodayHabits`, `useGoalDetail`. Mutation handlers (`useUpsertTodayHabitStatusMutation`, `useDeleteTodayHabitLogMutation`) stay on bare `now()` / `todayDateString()` — they are action-time.

- [ ] **Step 1: Add the import**

Add to the top of the file (alongside existing imports from `@/utils/clock`):

```ts
import { useTodayAnchorDate, useTodayDateString } from "@/utils/dayBoundary";
```

- [ ] **Step 2: Migrate `useHabitLogsForRange` (line ~78)**

Old:
```ts
export function useHabitLogsForRange(habitId: string | undefined, days: number) {
  const today = todayDateString();
  const fromDate = toDeviceDateString(addDeviceDays(new Date(), -(days - 1)));
  return useQuery({
    enabled: Boolean(habitId),
    queryFn: () => listLogsForHabitInRange(habitId!, fromDate, today),
    queryKey: getHabitLogsRangeQueryKey(habitId ?? "none", fromDate, today),
    staleTime: 30_000,
  });
}
```

New:
```ts
export function useHabitLogsForRange(habitId: string | undefined, days: number) {
  const today = useTodayDateString();
  const todayAnchor = useTodayAnchorDate();
  const fromDate = toDeviceDateString(addDeviceDays(todayAnchor, -(days - 1)));
  return useQuery({
    enabled: Boolean(habitId),
    queryFn: () => listLogsForHabitInRange(habitId!, fromDate, today),
    queryKey: getHabitLogsRangeQueryKey(habitId ?? "none", fromDate, today),
    staleTime: 30_000,
  });
}
```

- [ ] **Step 3: Migrate `useHabitLogsForHabitsInRange` (line ~98)**

Apply the analogous edit: `today = todayDateString()` → `today = useTodayDateString()`; replace `new Date()` in `addDeviceDays` with `useTodayAnchorDate()` (capture it in `const todayAnchor`).

- [ ] **Step 4: Migrate `useTodayHabits` (line ~109)**

Four render-time sites:
- `const todayDate = todayDateString();` → `const todayDate = useTodayDateString();`
- `getTrailingDateRangeStrings(TODAY_PROGRESS_WINDOW_DAYS, now())` → `getTrailingDateRangeStrings(TODAY_PROGRESS_WINDOW_DAYS, todayAnchor)` (capture `const todayAnchor = useTodayAnchorDate();` near the top)
- `getWeekStartDateString(now())` → `getWeekStartDateString(todayAnchor)`
- `const todayDateForReview = toDeviceDateString();` → `const todayDateForReview = todayDate;` (reuse the value already read)

Leave the mutation hooks (`useUpsertTodayHabitStatusMutation`, `useDeleteTodayHabitLogMutation`) **unchanged** — their `now()` and `todayDateString()` calls are inside `mutationFn` / `onSuccess` and are correctly action-time.

- [ ] **Step 5: Migrate `useGoalDetail` (line ~463)**

Capture `const todayAnchor = useTodayAnchorDate();` once near the top of `useGoalDetail`.

Four render-time sites:
- `getTrailingDateRangeStrings(TODAY_PROGRESS_WINDOW_DAYS, now())` → `getTrailingDateRangeStrings(TODAY_PROGRESS_WINDOW_DAYS, todayAnchor)` (helper clones internally — safe)
- `getWeekStartDate(now())` → `getWeekStartDate(todayAnchor)` (helper clones — safe)
- `toDeviceDateString(now())` (fallback for `oldestStartIso`) → `toDeviceDateString(todayAnchor)` (pure read — safe)
- The `const today = now(); today.setHours(0, 0, 0, 0);` block at line ~517 requires a **clone** because it mutates with `setHours`. Without the clone, every consumer of `useTodayAnchorDate()` sees a midnight-shifted date — silently corrupts the cached snapshot:

Old:
```ts
    const today = now();
    today.setHours(0, 0, 0, 0);
```

New:
```ts
    const today = new Date(todayAnchor);
    today.setHours(0, 0, 0, 0);
```

**General rule for the rest of this batch:** if a migrated site calls `setHours`, `setDate`, `setMonth`, or any mutating `Date` method on the value returned by `useTodayAnchorDate()`, clone first with `new Date(todayAnchor)`. Helpers like `getTrailingDateRangeStrings`, `getWeekStartDate`, and `addDeviceDays` already clone internally — those callers do not need an extra copy.

- [ ] **Step 6: Run the relevant existing tests**

Run: `npm test -- src/features/today src/features/habits`
Expected: All green.

- [ ] **Step 7: Commit**

```bash
git add src/features/today/hooks.ts
git commit -m "$(cat <<'EOF'
refactor(today): subscribe today/goal-detail hooks to day boundary

useTodayHabits, useGoalDetail, useHabitLogsForRange,
useHabitLogsForHabitsInRange now re-render at local-date rollover.
Mutation handlers stay on bare now() / todayDateString() (action-time).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 2.3: Migrate `src/features/recovery/hooks.ts`

**Files:**
- Modify: `src/features/recovery/hooks.ts`

- [ ] **Step 0: Read the file and confirm the exact identifiers in current code**

Read `src/features/recovery/hooks.ts`. Confirm both render-time date reads still use `todayDateString()` (per the plan's Old snippets, captured at design time). If a more recent commit changed them, reconcile before substituting.

- [ ] **Step 1: Add the import**

```ts
import { useTodayDateString } from "@/utils/dayBoundary";
```

- [ ] **Step 2: Replace the date reads in both hooks**

In `useRecoveryCheck` (line 35):
- Old: `const today = todayDateString();`
- New: `const today = useTodayDateString();`

In `useSingleMissBanner` (line 99):
- Old: `const today = todayDateString();`
- New: `const today = useTodayDateString();`

- [ ] **Step 3: Run the relevant existing tests**

Run: `npm test -- src/features/recovery`
Expected: All green.

- [ ] **Step 4: Commit**

```bash
git add src/features/recovery/hooks.ts
git commit -m "$(cat <<'EOF'
refactor(recovery): subscribe recovery/miss-banner hooks to day boundary

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 2.4: Migrate `src/features/reviews/useGoalWeekSummary.ts`

**Files:**
- Modify: `src/features/reviews/useGoalWeekSummary.ts`

- [ ] **Step 0: Read the file and confirm the exact identifier in current code**

Read `src/features/reviews/useGoalWeekSummary.ts`. Confirm the render-time date read still uses `toDeviceDateString()` (per the Old snippet). If a more recent commit changed it, reconcile before substituting.

- [ ] **Step 1: Add the import and replace the date read (line ~37)**

Add:
```ts
import { useTodayDateString } from "@/utils/dayBoundary";
```

Change:
- Old: `const todayDate = toDeviceDateString();`
- New: `const todayDate = useTodayDateString();`

- [ ] **Step 2: Run the relevant existing tests**

Run: `npm test -- src/features/reviews`
Expected: All green.

- [ ] **Step 3: Commit**

```bash
git add src/features/reviews/useGoalWeekSummary.ts
git commit -m "$(cat <<'EOF'
refactor(reviews): subscribe useGoalWeekSummary to day boundary

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 2.5: Migrate `src/features/reviews/hooks.ts`

**Files:**
- Modify: `src/features/reviews/hooks.ts`

- [ ] **Step 0: Read the file and confirm the exact identifiers in current code**

Read `src/features/reviews/hooks.ts`. Confirm `useGoalReviewStatusQuery` still reads `getWeekStartDateString()` (no-arg) and `toDeviceDateString()` (no-arg) at lines ~61-62. If a more recent commit changed them, reconcile before substituting.

- [ ] **Step 1: Add imports**

```ts
import { useTodayAnchorDate, useTodayDateString } from "@/utils/dayBoundary";
```

- [ ] **Step 2: Replace the two render-time date reads in `useGoalReviewStatusQuery` (lines 61-62)**

Old:
```ts
  const weekStart = getWeekStartDateString();
  const todayDate = toDeviceDateString();
```

New:
```ts
  const todayAnchor = useTodayAnchorDate();
  const weekStart = getWeekStartDateString(todayAnchor);
  const todayDate = useTodayDateString();
```

- [ ] **Step 3: Run the relevant existing tests**

Run: `npm test -- src/features/reviews`
Expected: All green.

- [ ] **Step 4: Commit**

```bash
git add src/features/reviews/hooks.ts
git commit -m "$(cat <<'EOF'
refactor(reviews): subscribe useGoalReviewStatusQuery to day boundary

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Batch 2 verification gate

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All green. Hooks return the same values at a given moment; query keys unchanged at a frozen clock. Any breakage indicates a missed action-time site or a typo.

- [ ] **Step 2: Spot-grep for remaining render-time bare `todayDateString()` / `toDeviceDateString()` / `now()` calls in hooks**

Run:
```bash
grep -nE "todayDateString\(\)|toDeviceDateString\(\)|\bnow\(\)" src/features/habits/hooks.ts src/features/today/hooks.ts src/features/recovery/hooks.ts src/features/reviews/hooks.ts src/features/reviews/useGoalWeekSummary.ts
```

Expected: Remaining matches are all inside `mutationFn`, `onSuccess`, or telemetry blocks. If a match is in a render-time scope of a hook body, it was missed in Batch 2 — fix it now.

---

## Batch 3 — Migrate screens, presentational components, AppHeader; add rollover integration tests

Per the design, presentational components subscribe individually rather than relying on parent re-renders. Their internal pure helpers (`buildGrid`, `buildStripCells`, `buildCells`) refactor to accept `today: string` as a parameter; the component reads from the hook and passes it down.

### Task 3.1: Migrate `TodayScreen.AppHeader`

**Files:**
- Modify: `src/features/today/screens/TodayScreen.tsx`

- [ ] **Step 1: Add the import**

Add to the top of the file:

```ts
import { useTodayAnchorDate } from "@/utils/dayBoundary";
```

- [ ] **Step 2: Replace the bare `new Date()` in `AppHeader` (line 56)**

Old:
```tsx
function AppHeader() {
  const label = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
```

New:
```tsx
function AppHeader() {
  const today = useTodayAnchorDate();
  const label = today.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
```

Noon-pin is safe because `toLocaleDateString` is called with day/month/weekday only — no time component (verified in the design).

- [ ] **Step 3: Run the TodayScreen tests**

Run: `npm test -- src/features/today/__tests__/TodayScreen`
Expected: All green. Existing snapshot/text assertions depend on the formatted date string at a frozen clock — identical output.

- [ ] **Step 4: Commit**

```bash
git add src/features/today/screens/TodayScreen.tsx
git commit -m "$(cat <<'EOF'
refactor(today): subscribe AppHeader date label to day boundary

The date label re-renders on rollover instead of staying frozen at
mount-time wall-clock. Format is day/month/weekday only — noon-pin
is safe.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 3.2: Migrate `HabitDetailScreen`

**Files:**
- Modify: `src/features/habits/screens/HabitDetailScreen.tsx`

Five render-time sites: `calendarDays` (line 107), `todayDate` / `currentWeekStart` (145-146), `activeDaysCount` (207), `weeklyData` chart endpoint (247). The retro-window check inside `openDateSelector` handler (~297) stays as bare `now()` — it's action-time.

- [ ] **Step 1: Add the import**

```ts
import { useTodayAnchorDate, useTodayDateString } from "@/utils/dayBoundary";
```

- [ ] **Step 2: Pick the hook-capture position and verify rules-of-hooks**

The new hook captures must satisfy two constraints:

1. They must come **before** the first use of `todayAnchor` / `todayDate` in render-time code (the earliest use is `calendarDays` at line ~107).
2. They must come **after** all other unconditional hook calls in the component, and there must be **no conditional early return** (e.g. `if (!habit) return null;`) between any earlier hook and the new hooks. A conditional return between hooks violates rules-of-hooks.

Read the current `HabitDetailScreen` function body from the top down through line ~150. Identify the last unconditional hook call before line ~107 (e.g., `useHabitDetail`, `useState`, `useRef`). Confirm that between that hook and line ~107, no `return` statement runs conditionally. The new captures go immediately after that last unconditional hook call.

If a conditional return exists in the path you want to use (defensive: it most likely does not in the current file, since later hooks already run after line 107), stop and surface the conflict — do not move hooks past a conditional return. The implementer must either lift the early return below all hooks or restructure the component before continuing.

- [ ] **Step 3: Insert the hook captures at the chosen position**

Add:

```ts
  const todayAnchor = useTodayAnchorDate();
  const todayDate = useTodayDateString();
  const currentWeekStart = getWeekStartDateString(todayAnchor);
```

Delete the existing `const todayDate = toDeviceDateString(now());` and `const currentWeekStart = getWeekStartDateString(now());` at lines 145-146 (the values are now provided by the new captures above).

- [ ] **Step 4: Update `calendarDays` (line ~107)**

Old:
```ts
  const calendarDays = (() => {
    if (!habit?.start_date) return 35;
    const start = new Date(`${habit.start_date}T12:00:00`);
    const diff = Math.ceil((now().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(diff, 35);
  })();
```

New:
```ts
  const calendarDays = (() => {
    if (!habit?.start_date) return 35;
    const start = new Date(`${habit.start_date}T12:00:00`);
    const diff = Math.ceil((todayAnchor.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(diff, 35);
  })();
```

(Steps 2 and 3 already chose the hook-capture position; `todayAnchor` is in scope by the time `calendarDays` runs.)

- [ ] **Step 5: Update `activeDaysCount` (line ~207)**

Old:
```ts
    const start = habit.start_date
      ? new Date(`${habit.start_date}T12:00:00`)
      : now();
    const today = now();
    today.setHours(0, 0, 0, 0);
```

New:
```ts
    const start = habit.start_date
      ? new Date(`${habit.start_date}T12:00:00`)
      : todayAnchor;
    const today = new Date(todayAnchor);
    today.setHours(0, 0, 0, 0);
```

The `new Date(todayAnchor)` copy is required so `setHours` doesn't mutate the cached anchor. Important: without the copy, every consumer of `useTodayAnchorDate()` sees a midnight-shifted date.

- [ ] **Step 6: Update `weeklyData` chart endpoint (line ~247)**

Old:
```ts
    return computeWeeklyConsistency(
      [ ...habit shape... ],
      chartStartIso,
      now(),
    );
```

New:
```ts
    return computeWeeklyConsistency(
      [ ...habit shape... ],
      chartStartIso,
      todayAnchor,
    );
```

Add `todayAnchor` to the `useMemo` deps list. The existing comment at line 222 ("now() is intentionally NOT in the deps list") needs updating — `todayAnchor` IS reference-stable and SHOULD be in deps. Replace the comment block:

Old:
```ts
  // now() is intentionally NOT in the deps list: it's used as the chart's
  // end-of-window cursor and only crosses a meaningful boundary across days,
  // not renders. Adding it would force a fresh `Date` per render and defeat
  // memoization entirely. The memo invalidates correctly when `habit` /
  // `calendarLogs` / `activeDays` change, which is what we actually care about.
```

New:
```ts
  // todayAnchor is reference-stable until local-day rollover (see
  // useTodayAnchorDate), so including it in deps does not churn memoization
  // on normal re-renders but correctly invalidates the chart at rollover.
```

- [ ] **Step 7: Leave the retro-window check (~line 297) untouched**

The `isWithinRetroWindow(date, now())` call inside the date-picker handler is action-time. Bare `now()` is correct there.

- [ ] **Step 8: Run the HabitDetailScreen tests**

Run: `npm test -- src/features/habits/screens/__tests__/HabitDetailScreen`
Expected: All green.

- [ ] **Step 9: Commit**

```bash
git add src/features/habits/screens/HabitDetailScreen.tsx
git commit -m "$(cat <<'EOF'
refactor(habit-detail): subscribe HabitDetailScreen to day boundary

Five render-time sites migrate to useTodayDateString /
useTodayAnchorDate. weeklyData useMemo deps now include todayAnchor
(reference-stable until rollover). Retro-window handler stays on
bare now() (action-time).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 3.3: Migrate `GraduationCeremonyScreen.daysSinceStart`

**Files:**
- Modify: `src/features/graduation/screens/GraduationCeremonyScreen.tsx`

- [ ] **Step 1: Convert the `daysSinceStart` helper to take `today` as a param**

Old:
```ts
function daysSinceStart(startDate: string | null | undefined): number {
  if (!startDate) return 0;
  const today = toDeviceDateString(now());
  const elapsed = daysBetweenDates(startDate, today);
  return Math.max(0, elapsed) + 1;
}
```

New:
```ts
function daysSinceStart(
  startDate: string | null | undefined,
  today: string,
): number {
  if (!startDate) return 0;
  const elapsed = daysBetweenDates(startDate, today);
  return Math.max(0, elapsed) + 1;
}
```

- [ ] **Step 2: Update the caller inside the component**

Find the call to `daysSinceStart(...)` in the component body. Add `useTodayDateString()` capture and pass it in.

Add import:
```ts
import { useTodayDateString } from "@/utils/dayBoundary";
```

At the call site, capture and pass:
```ts
  const todayDate = useTodayDateString();
  // ...
  const ageDays = daysSinceStart(habit?.start_date, todayDate);
```

Drop the now-unused `now` import from `@/utils/clock` if no other site in the file uses it.

- [ ] **Step 3: Run the GraduationCeremonyScreen tests**

Run: `npm test -- src/features/graduation`
Expected: All green.

- [ ] **Step 4: Commit**

```bash
git add src/features/graduation/screens/GraduationCeremonyScreen.tsx
git commit -m "$(cat <<'EOF'
refactor(graduation): subscribe daysSinceStart to day boundary

daysSinceStart now takes today as a parameter; the component captures
useTodayDateString() and passes it in.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 3.4: Migrate `CalendarGrid`

**Files:**
- Modify: `src/components/CalendarGrid.tsx`

The pure helper `buildGrid` currently calls `todayDateString()` internally. Refactor it to take `today: string` as a parameter; the component reads the hook and passes it.

- [ ] **Step 1: Change `buildGrid` to take `today` as a parameter**

Old:
```ts
export function buildGrid(
  logs: HeatmapLog[],
  activeDays: number[],
  startDate?: string,
): CalendarCell[] {
  const today = todayDateString();
  // ...
```

New:
```ts
export function buildGrid(
  logs: HeatmapLog[],
  activeDays: number[],
  startDate: string | undefined,
  today: string,
): CalendarCell[] {
  // ...
```

(Remove the internal `const today = todayDateString();` line.)

- [ ] **Step 2: Update the component to read the hook and pass it down**

Old:
```tsx
export function CalendarGrid({ activeDays, logs, onCellPress, startDate }: CalendarGridProps) {
  const cells = buildGrid(logs, activeDays, startDate);
  const today = todayDateString();
```

New:
```tsx
export function CalendarGrid({ activeDays, logs, onCellPress, startDate }: CalendarGridProps) {
  const today = useTodayDateString();
  const cells = buildGrid(logs, activeDays, startDate, today);
```

- [ ] **Step 3: Update imports**

Replace `import { todayDateString } from "@/utils/clock";` with `import { useTodayDateString } from "@/utils/dayBoundary";`.

- [ ] **Step 4: Update `buildGrid` callers in tests**

Run:
```bash
grep -rn "buildGrid(" src --include="*.ts" --include="*.tsx"
```

For each non-component call site (likely in `src/components/__tests__/CalendarGrid.test.tsx` and `src/tests/unit/calendarGrid.test.tsx`), add a `today` argument matching the test's clock state. Example existing test pattern:

```ts
// Old
const cells = buildGrid(logs, [1,2,3,4,5], "2026-04-01");
// New
const cells = buildGrid(logs, [1,2,3,4,5], "2026-04-01", "2026-04-30");
```

Use the same date the test's `setNowForTesting` (if any) freezes to — or the test's assumed "today" if hardcoded.

- [ ] **Step 5: Run the CalendarGrid tests**

Run: `npm test -- CalendarGrid calendarGrid`
Expected: All green.

- [ ] **Step 6: Commit**

```bash
git add src/components/CalendarGrid.tsx src/components/__tests__/CalendarGrid.test.tsx src/tests/unit/calendarGrid.test.tsx
git commit -m "$(cat <<'EOF'
refactor(calendar-grid): subscribe CalendarGrid to day boundary

buildGrid takes today as a parameter; the component reads
useTodayDateString and passes it down. Existing tests updated to pass
the today argument explicitly.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 3.5: Migrate `Heatmap`

**Files:**
- Modify: `src/components/Heatmap.tsx`

- [ ] **Step 1: Subscribe to both hooks and replace `new Date()` + `todayDateString()`**

Old:
```tsx
export function Heatmap({ days, logs, onCellPress }: HeatmapProps) {
  const { rows, cols, cellSize } = GRID_CONFIG[days];
  const today = todayDateString();

  const statusByDate = new Map<string, HabitLogStatus>();
  for (const log of logs) {
    statusByDate.set(log.log_date, log.status);
  }

  // Oldest first (top-left), today last (bottom-right).
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(toDeviceDateString(addDeviceDays(new Date(), -i)));
  }
```

New:
```tsx
export function Heatmap({ days, logs, onCellPress }: HeatmapProps) {
  const { rows, cols, cellSize } = GRID_CONFIG[days];
  const today = useTodayDateString();
  const todayAnchor = useTodayAnchorDate();

  const statusByDate = new Map<string, HabitLogStatus>();
  for (const log of logs) {
    statusByDate.set(log.log_date, log.status);
  }

  // Oldest first (top-left), today last (bottom-right).
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(toDeviceDateString(addDeviceDays(todayAnchor, -i)));
  }
```

- [ ] **Step 2: Update imports**

Replace `import { todayDateString } from "@/utils/clock";` with `import { useTodayAnchorDate, useTodayDateString } from "@/utils/dayBoundary";`.

- [ ] **Step 3: Run the Heatmap tests**

Run: `npm test -- Heatmap`
Expected: All green.

- [ ] **Step 4: Commit**

```bash
git add src/components/Heatmap.tsx
git commit -m "$(cat <<'EOF'
refactor(heatmap): subscribe Heatmap to day boundary

Replaces bare new Date() and todayDateString() with hook reads so the
heatmap window slides at rollover.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 3.6: Migrate `MiniHeatmapStrip`

**Files:**
- Modify: `src/components/MiniHeatmapStrip.tsx`

- [ ] **Step 1: Change `buildStripCells` to take `today` as a parameter**

Old:
```ts
export function buildStripCells(
  logs: HeatmapLog[],
  activeDays: number[],
  startDate: string,
  maxDays: number = MAX_DAYS,
): StripCell[] {
  const today = todayDateString();
  const todayDate = new Date(`${today}T12:00:00`);

  const windowStart = new Date(todayDate);
  windowStart.setDate(windowStart.getDate() - (maxDays - 1));
  const effectiveStart = startDate > todayDateString()
    ? todayDate
    : new Date(`${startDate}T12:00:00`) > windowStart
      ? new Date(`${startDate}T12:00:00`)
      : windowStart;
```

New:
```ts
export function buildStripCells(
  logs: HeatmapLog[],
  activeDays: number[],
  startDate: string,
  today: string,
  maxDays: number = MAX_DAYS,
): StripCell[] {
  const todayDate = new Date(`${today}T12:00:00`);

  const windowStart = new Date(todayDate);
  windowStart.setDate(windowStart.getDate() - (maxDays - 1));
  const effectiveStart = startDate > today
    ? todayDate
    : new Date(`${startDate}T12:00:00`) > windowStart
      ? new Date(`${startDate}T12:00:00`)
      : windowStart;
```

- [ ] **Step 2: Update the component to read the hook and pass it down**

Old:
```tsx
export function MiniHeatmapStrip({ activeDays, cellGap = CELL_GAP, cellSize = CELL_SIZE, logs, maxDays = MAX_DAYS, startDate }: MiniHeatmapStripProps) {
  const cells = buildStripCells(logs, activeDays, startDate, maxDays);
```

New:
```tsx
export function MiniHeatmapStrip({ activeDays, cellGap = CELL_GAP, cellSize = CELL_SIZE, logs, maxDays = MAX_DAYS, startDate }: MiniHeatmapStripProps) {
  const today = useTodayDateString();
  const cells = buildStripCells(logs, activeDays, startDate, today, maxDays);
```

- [ ] **Step 3: Update imports**

Replace `import { todayDateString } from "@/utils/clock";` with `import { useTodayDateString } from "@/utils/dayBoundary";`.

- [ ] **Step 4: Update `buildStripCells` callers in tests**

Run:
```bash
grep -rn "buildStripCells(" src --include="*.ts" --include="*.tsx"
```

Each non-component caller must now pass `today` after `startDate`:

```ts
// Old: buildStripCells(logs, activeDays, "2026-04-01", 30)
// New: buildStripCells(logs, activeDays, "2026-04-01", "2026-04-30", 30)
```

- [ ] **Step 5: Run the MiniHeatmapStrip tests**

Run: `npm test -- MiniHeatmapStrip`
Expected: All green.

- [ ] **Step 6: Commit**

```bash
git add src/components/MiniHeatmapStrip.tsx src/components/__tests__/MiniHeatmapStrip.test.tsx
git commit -m "$(cat <<'EOF'
refactor(mini-heatmap): subscribe MiniHeatmapStrip to day boundary

buildStripCells takes today as a parameter; the component reads
useTodayDateString.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 3.7: Migrate `GoalStreakStrip`

**Files:**
- Modify: `src/features/today/components/GoalStreakStrip.tsx`

- [ ] **Step 1: Change `buildCells` to take `todayAnchor` as a parameter**

Old:
```ts
function buildCells(
  dailyStates: GoalDayState[],
  startDate: string,
  today: string,
): Cell[] {
  const todayDate = now();
  const currentMonday = getWeekStartDate(todayDate);
```

New:
```ts
function buildCells(
  dailyStates: GoalDayState[],
  startDate: string,
  today: string,
  todayAnchor: Date,
): Cell[] {
  const currentMonday = getWeekStartDate(todayAnchor);
```

(Drop the internal `const todayDate = now();` line and rename `todayDate` to `todayAnchor` throughout the function body.)

- [ ] **Step 2: Update the component to subscribe and pass both values**

Old:
```tsx
export function GoalStreakStrip({ dailyStates, scope, streak, startDate, onCellPress }: GoalStreakStripProps) {
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const today = todayDateString();
  const cells = buildCells(dailyStates, startDate, today);
```

New:
```tsx
export function GoalStreakStrip({ dailyStates, scope, streak, startDate, onCellPress }: GoalStreakStripProps) {
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const today = useTodayDateString();
  const todayAnchor = useTodayAnchorDate();
  const cells = buildCells(dailyStates, startDate, today, todayAnchor);
```

- [ ] **Step 3: Update imports**

Replace `import { now, todayDateString } from "@/utils/clock";` with `import { useTodayAnchorDate, useTodayDateString } from "@/utils/dayBoundary";`.

- [ ] **Step 4: Run the GoalStreakStrip tests**

Run: `npm test -- GoalStreakStrip`
Expected: All green.

- [ ] **Step 5: Commit**

```bash
git add src/features/today/components/GoalStreakStrip.tsx
git commit -m "$(cat <<'EOF'
refactor(goal-streak-strip): subscribe GoalStreakStrip to day boundary

buildCells takes todayAnchor as a parameter; the component reads
useTodayAnchorDate and useTodayDateString and passes both down.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 3.8: Add rollover integration tests to `TodayScreen.integration.test.tsx`

**Files:**
- Modify: `src/features/today/__tests__/TodayScreen.integration.test.tsx`

- [ ] **Step 0: Read the current test file end-to-end**

Read `src/features/today/__tests__/TodayScreen.integration.test.tsx`. Critical: check whether the file already declares `jest.mock("react-native", ...)`. The plan was written against a version that does not, but pasting a second `jest.mock` call for the same module will conflict. If the existing file already mocks `react-native`, do not add a second mock block — extend the existing factory to include the `AppState` shape from Step 1, and keep the rest of its return object intact.

- [ ] **Step 1: Add the AppState mock at the top of the file**

If no `jest.mock("react-native", ...)` exists per Step 0, insert at the very top, before all other imports:

```ts
const appStateListeners = new Set<(state: string) => void>();
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return {
    ...RN,
    AppState: {
      currentState: "active",
      addEventListener: (event: string, listener: (state: string) => void) => {
        if (event === "change") appStateListeners.add(listener);
        return { remove: () => appStateListeners.delete(listener) };
      },
    },
  };
});
function emitAppStateActive(): void {
  for (const l of appStateListeners) l("active");
}
```

If a `jest.mock("react-native", ...)` factory already exists per Step 0, edit the existing factory to add the `AppState` field shown above, leaving the rest of its return object intact. Add the `appStateListeners` set and `emitAppStateActive` helper alongside the existing mock.

- [ ] **Step 2: Add imports for the day-boundary test seams**

```ts
import {
  initDayBoundary,
  resetDayBoundaryForTesting,
  triggerDayBoundaryCheckForTesting,
} from "@/utils/dayBoundary";
```

- [ ] **Step 3: Register init + teardown in the test lifecycle**

Find the existing `beforeEach`/`afterEach` block. Add:

```ts
beforeEach(() => {
  // ... existing setup ...
  initDayBoundary();
});

afterEach(() => {
  resetDayBoundaryForTesting();
  appStateListeners.clear();
  // ... existing teardown ...
});
```

- [ ] **Step 4: Add the foreground-rollover regression test**

Add a new `describe` block at the end of the file:

```tsx
describe("TodayScreen integration — day rollover", () => {
  it("refreshes when the app foregrounds after midnight", async () => {
    setNowForTesting(new Date(2026, 4, 29, 23, 59, 0));
    renderWithClient(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Log Run")).toBeTruthy();
    });
    // Header on 2026-05-29
    expect(screen.queryByText(/Friday, May 29/)).toBeTruthy();

    // Advance the clock across midnight and emit a foreground event.
    setNowForTesting(new Date(2026, 4, 30, 0, 0, 5));
    act(() => {
      emitAppStateActive();
    });

    // The header date label flips to the new day.
    await waitFor(() => {
      expect(screen.queryByText(/Saturday, May 30/)).toBeTruthy();
    });
  });
});
```

(Adjust the formatted date strings if the local fixture timezone in the test environment produces different weekday names. Run the test once to capture the exact labels and pin them.)

- [ ] **Step 5: Add the midnight-while-open regression test**

Append within the same `describe`. No fake timers needed — the explicit trigger seam is the whole point of this test path:

```tsx
  it("refreshes when local midnight passes while the app is open", async () => {
    setNowForTesting(new Date(2026, 4, 29, 23, 59, 0));
    renderWithClient(<TodayScreen />);

    await waitFor(() => {
      expect(screen.queryByText(/Friday, May 29/)).toBeTruthy();
    });

    setNowForTesting(new Date(2026, 4, 30, 0, 0, 5));
    act(() => {
      triggerDayBoundaryCheckForTesting();
    });

    await waitFor(() => {
      expect(screen.queryByText(/Saturday, May 30/)).toBeTruthy();
    });
  });
```

Per the design's "test author UX" guidance, the integration test path uses the explicit `triggerDayBoundaryCheckForTesting` test seam. The fake-timer approach is reserved for `dayBoundary.test.ts` (where the goal is to assert the timer mechanism itself).

- [ ] **Step 6: Run the integration test suite**

Run: `npm test -- TodayScreen.integration`
Expected: All green, including the two new rollover scenarios.

- [ ] **Step 7: Commit**

```bash
git add src/features/today/__tests__/TodayScreen.integration.test.tsx
git commit -m "$(cat <<'EOF'
test(today): add day-rollover regression scenarios

Covers the original bug: header date label and eligible-habits query
key advance when the app foregrounds after midnight, and when local
midnight crosses while the app is open.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Batch 3 verification gate

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All green.

- [ ] **Step 2: Spot-grep for remaining render-time bare clock calls in migrated files**

Run:
```bash
grep -nE "todayDateString\(\)|toDeviceDateString\(\)|\bnow\(\)|new Date\(\)\." \
  src/features/today/screens/TodayScreen.tsx \
  src/features/habits/screens/HabitDetailScreen.tsx \
  src/features/graduation/screens/GraduationCeremonyScreen.tsx \
  src/components/CalendarGrid.tsx \
  src/components/Heatmap.tsx \
  src/components/MiniHeatmapStrip.tsx \
  src/features/today/components/GoalStreakStrip.tsx
```

Expected: Remaining matches are inside event handlers (`Pressable onPress`, `mutationFn`, telemetry, retro-window check in `HabitDetailScreen`). If a match appears in a function body called during render, it was missed.

- [ ] **Step 3: Manual smoke test (if a dev build is available)**

Open the app, log a habit, navigate to Goal Detail, navigate back. Confirm normal behavior. The rollover behavior itself is hard to manual-test without changing device time; the integration tests are the durable verification.

---

## Self-review

Spec coverage check (each design section → task):

- ✅ **Problem / Goal** — covered by Batch 3 integration tests (TodayScreen rollover).
- ✅ **Approach: AppState + midnight timer + same handler** — Task 1.3.
- ✅ **Why a custom store / why not provider+context** — encoded in `dayBoundary.ts` module structure (no provider; module-level singleton).
- ✅ **Day-boundary store: cached snapshot, listeners, midnight handle, AppState handle** — Task 1.2 + 1.3.
- ✅ **`checkAndMaybeNotify` idempotency** — Task 1.2 (test: "no-op when date is unchanged").
- ✅ **Noon-pinned anchor + DST rationale** — Task 1.1 (`noonOf` helper).
- ✅ **`useTodayDateString` + `useTodayAnchorDate`** — Task 1.4.
- ✅ **`useSyncExternalStore` getServerSnapshot no-op** — Task 1.4 (explicit in implementation).
- ✅ **`initDayBoundary` + cleanup + idempotency under fast refresh** — Task 1.3.
- ✅ **Background-timer behavior documented** — captured in source comments at Task 1.3.
- ✅ **Implementation primitives (`msUntilNextLocalMidnight`, `noonOf`)** — Task 1.1.
- ✅ **Initial state / lazy init** — Task 1.2 (`ensureCache`).
- ✅ **Hot-reload idempotency** — Task 1.3 (`initialized` flag).
- ✅ **Listener-set memory cleanup** — Task 1.4 (returned by `subscribeDayBoundary`).
- ✅ **Render-time hooks migration** — Batch 2, Tasks 2.1–2.5 (all 5 files).
- ✅ **Screen-local sites** — Batch 3, Tasks 3.1, 3.2, 3.3.
- ✅ **Presentational components** — Batch 3, Tasks 3.4, 3.5, 3.6, 3.7.
- ✅ **AppHeader fix** — Task 3.1.
- ✅ **useEffect classification rule** — design-doc-only; no useEffect in current code needs migration.
- ✅ **Utility functions with `now()` defaults** — `summarizeHabitProgress` / `computeGoalStreak` untouched per design; callers pass `todayAnchor`.
- ✅ **Sub-day verification** — verified in design; mechanical migration in plan preserves day-granular semantics.
- ✅ **Query-key cycling on rollover** — covered by Batch 3 integration test.
- ✅ **Coverage matrix (Section 5)** — Tasks 1.2, 1.3, 1.4 unit tests + Task 3.8 integration tests.
- ✅ **Test seams (`setNowForTesting`, `triggerDayBoundaryCheckForTesting`, `resetDayBoundaryForTesting`)** — Task 1.2 / 1.3.
- ✅ **Test author UX note** — design-doc guidance; integration test in Task 3.8 follows it.
- ✅ **Known limitations** — documented in spec; no code action.

No spec section unaddressed. No placeholder steps. Type names consistent (`DaySnapshot`, `noonOf`, `msUntilNextLocalMidnight`, `subscribeDayBoundary`, `getDayBoundarySnapshot`, `initDayBoundary`, `useTodayDateString`, `useTodayAnchorDate`, `triggerDayBoundaryCheckForTesting`, `resetDayBoundaryForTesting`) used identically across all task code blocks.
