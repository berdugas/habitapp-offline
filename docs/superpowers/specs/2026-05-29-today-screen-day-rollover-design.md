# Today screen day-rollover refresh — design

**Date:** 2026-05-29
**Status:** Awaiting user review of written spec
**Scope:** All date-sensitive screens

## Problem

The Today screen — and every other screen whose state depends on "what is today's local date" — does not refresh when the local date changes. There is no clock-watcher, no `AppState` listener for habit data, no `useFocusEffect`, and React Native's window-focus events are unwired. React Query's `staleTime` does not help: the bug is not stale data, it is a stale query *key*, computed once per render via `todayDateString()` and frozen in closure.

Observable consequences when the app sits open across midnight (or is backgrounded across midnight, then foregrounded):

- The `AppHeader` date label still reads yesterday's day-of-week.
- `useEligibleHabitsQuery` reads from the cache entry keyed by yesterday's date string; today's habits never load.
- Recovery and miss-banner checks compare logs against yesterday.
- Habit Detail / Goal Detail use a trailing-30-day window anchored to yesterday.
- Weekly-review-due flags evaluate against yesterday's week-start.

The screen advances to the new day only when something incidental forces a re-render (navigating away and back, foregrounding through a re-mount, logging a habit). If the user simply leaves Today open across midnight and does not interact, it stays on yesterday until they touch it.

## Goal

When the local date changes — either while the app is foregrounded, or because the user opens the app after midnight — every render-time consumer of "today's date" re-renders with the new date. The fix is invisible: the user never sees a stale day.

## Approach

A single source-of-truth module owns the current local date and notifies subscribers when it changes. Two triggers feed the same handler:

1. **`AppState` "change" → "active":** re-read the local date; if different from cached, update and notify. Covers backgrounded-across-midnight.
2. **`setTimeout` aimed at the next local midnight (+1s safety margin):** re-read the local date; update and notify if different; reschedule. Covers midnight-while-foregrounded.

React components and hooks consume the store via `useSyncExternalStore` through two thin hooks. Render-time call sites of `todayDateString()` and `now()` are migrated to these hooks. Action-time call sites (mutation handlers, API helpers, telemetry, notifications) continue to read the bare clock module — they want live wall-clock at the moment of execution, not the rendered day.

### Why a custom store, not React Query alone

The query keys consumers compute encode the date string. Invalidating "yesterday's key" causes a refetch against yesterday's key, not a re-render with a new key. Components must actually re-render to read `todayDateString()` again and produce the new key. A subscription-based store is the smallest primitive that accomplishes this without prop drilling or a provider in the tree.

### Why not a provider + context

Context works but adds ceremony (provider mounted near the root, consumers wrapped in tests). `useSyncExternalStore` over a module-level singleton gives the same observable behavior with less surface area, mirroring the existing `queryClient` singleton pattern.

## Architecture

### The day-boundary store

New module: `src/utils/dayBoundary.ts`.

What it owns:

- Cached `todayDateString` (e.g. `"2026-05-29"`).
- Cached `todayAnchorDate`: a `Date` instance pinned to **today 12:00:00 local**. Cached as a single object so `getSnapshot()` returns referentially-equal values until rollover (`useSyncExternalStore`'s identity requirement).
- A `Set<() => void>` of listeners.
- One scheduled midnight `setTimeout` handle.
- One `AppState` subscription handle.

The handler — one function, called by both triggers:

```ts
function checkAndMaybeNotify() {
  const next = todayDateString();          // bare read through @/utils/clock
  if (next !== cachedDateString) {
    cachedDateString = next;
    cachedAnchorDate = noonOf(next);       // single Date instance for the day
    for (const listener of listeners) listener();
  }
  clearTimeout(midnightTimer);
  midnightTimer = setTimeout(checkAndMaybeNotify, msUntilNextLocalMidnight() + 1000);
}
```

Idempotent by construction: if the cached date already matches, nothing notifies. Back-to-back fires (e.g. an overdue timer firing immediately after a foreground `AppState` change) are safe — the second call is a no-op.

### Why noon for the anchor Date

A `Date` pinned to 12:00:00 local is DST-safe. If a DST transition happens at 02:00 local (spring forward) or 03:00 local (fall back), noon is well clear of the discontinuity. Midnight would land *on* the boundary on transition days and produce off-by-one date conversions in helpers that read `getDate()` after a timezone offset shift. A future contributor who "simplifies" to midnight reintroduces this bug; the rationale lives here so they don't.

### Hooks

```ts
// Returns "YYYY-MM-DD" for today's local date. Consumer re-renders on rollover.
export function useTodayDateString(): string;

// Returns a Date pinned to today 12:00:00 local. Reference-stable until
// rollover (safe to use in query keys and useMemo deps). Re-renders on rollover.
export function useTodayAnchorDate(): Date;
```

Both subscribe to the same store via `useSyncExternalStore`. The store ensures each hook receives a referentially-equal value between rollovers, so consumers using either as a `useMemo` dep do not over-invalidate.

**Constraint on `useTodayAnchorDate`** — documented on the hook signature and in this doc:

> `useTodayAnchorDate()` is anchored to today's 12:00:00 local, not wall-clock time. Render-time code that needs sub-day precision (comparing against timestamps within the same day) MUST use bare `now()` from `@/utils/clock` and subscribe to `useTodayDateString()` separately if it also needs rollover re-renders. Verified at design time: no current render-time `now()` site needs sub-day precision; all use day-granular helpers or explicitly normalize hours via `setHours(0,0,0,0)`.

### Init wiring

`initDayBoundary()` is called once from `src/providers/AppProviders.tsx` via a `useEffect` near the root. It registers the `AppState` listener and schedules the first midnight timer. Returns a cleanup that removes the listener and clears the timeout (only matters for tests and hot reload).

The store reads through the existing clock module — `getCurrentLocalDateString()` internally calls `todayDateString()` from `@/utils/clock`. This keeps `setNowForTesting()` working: freezing the clock and then triggering a foreground or midnight event makes the store re-read the frozen date.

### Background-timer behavior

JavaScript `setTimeout` does not fire reliably while the app is suspended on iOS, and behavior on Android is platform/OEM-dependent. The midnight-while-backgrounded case is therefore caught exclusively by the `AppState` foreground listener, not the timer. On foreground after a long sleep, an overdue timer may fire back-to-back with the `AppState` listener — `checkAndMaybeNotify()` is idempotent so the second call is a no-op.

This is the intentional shape of the fix; a future reader should not try to "fix" the timer to fire while suspended.

## Call-site migration

Approximately 30 sites in total. All edits are mechanical 1–2 line substitutions; no logic changes.

### Render-time hooks (load-bearing — query keys depend on these)

- [useTodayHabits](../../../src/features/today/hooks.ts) — three sites: `todayDate`, the `now()` feeding `getTrailingDateRangeStrings`, the `now()` feeding `getWeekStartDateString`.
- [useEligibleHabitsQuery](../../../src/features/habits/hooks.ts).
- `useUpcomingActiveHabitsQuery` (same file).
- [useHabitLogsForRange](../../../src/features/today/hooks.ts), [useHabitLogsForHabitsInRange](../../../src/features/today/hooks.ts).
- [useGoalDetail](../../../src/features/today/hooks.ts) — four sites: trailing-window `endDate`, `today = now()`, `thisWeekMonday`, fallback `toDeviceDateString(now())`.
- [useRecoveryCheck](../../../src/features/recovery/hooks.ts), [useSingleMissBanner](../../../src/features/recovery/hooks.ts).
- [useGoalWeekSummary](../../../src/features/reviews/useGoalWeekSummary.ts).
- [useGoalReviewStatusQuery](../../../src/features/reviews/hooks.ts) — two sites: `weekStart`, `todayDate`.

### Render-time screen-local derived state

- [HabitDetailScreen](../../../src/features/habits/screens/HabitDetailScreen.tsx) — five sites: `calendarDays`, `todayDate`, `currentWeekStart`, `activeDaysCount`, `weeklyData` chart endpoint.
- [GraduationCeremonyScreen `daysSinceStart`](../../../src/features/graduation/screens/GraduationCeremonyScreen.tsx) helper.
- [TodayScreen `AppHeader`](../../../src/features/today/screens/TodayScreen.tsx) — currently calls `new Date()` directly, bypassing the clock module entirely. Migrate to `useTodayAnchorDate()` so the visible date label flips at rollover. **Easy to overlook; surfaced as its own line in the plan.**

### Render-time presentational components

- [CalendarGrid](../../../src/components/CalendarGrid.tsx), [Heatmap](../../../src/components/Heatmap.tsx), [MiniHeatmapStrip](../../../src/components/MiniHeatmapStrip.tsx), [GoalStreakStrip](../../../src/features/today/components/GoalStreakStrip.tsx).

Each migrates individually rather than relying on parent re-render propagation. Rationale: if a future consumer renders one of these without a date-subscribing parent, the "today" highlight would silently stale. Subscribing per-component removes the implicit coupling.

None of these components is currently wrapped in `React.memo`. If a future PR memoizes one, adding a hook subscription remains correct — `useSyncExternalStore` triggers an internal re-render via the store, independent of prop equality.

### What stays as bare `now()` / `todayDateString()` (action-time)

Action-time code wants live wall-clock at the moment of execution, not the rendered day:

- All [`api.ts`](../../../src/features/habits/api.ts) helpers (called from mutations and side effects).
- Mutation handlers — `mutationFn` and `onSuccess` blocks in `useUpsertTodayHabitStatusMutation`, `useDeleteTodayHabitLogMutation`, `useUpsertHabitLogMutation`, and the create-habit / restore / reactivate paths.
- Telemetry — `daysBetweenDates(variables.logDate, todayDateString())` in `habits/hooks.ts`.
- Notification scheduling in [`reminders/notifications.ts`](../../../src/features/reminders/notifications.ts).
- Export filename in [`settings/exportData.ts`](../../../src/features/settings/exportData.ts).
- Onboarding completion side effect in [`onboarding/completion.ts`](../../../src/features/onboarding/completion.ts).
- Submit handlers (e.g. [`CreateHabitFlow.tsx`](../../../src/features/habits/screens/CreateHabitFlow.tsx)).
- Retro-window check inside the date-picker handler in `HabitDetailScreen`.
- The trial-entitlement millisecond-staleness check in [`trial/hooks.tsx`](../../../src/features/trial/hooks.tsx) — uses `now()` for ms math, correctly action-time.

The plan-time decision rule: **if it runs inside `mutationFn` / `onSuccess` / a `Pressable` handler / a `useEffect` whose correctness does not depend on which day it is, it stays as bare `now()` / `todayDateString()`.**

### useEffect classification

A useEffect body that **acts on a moment-in-time** (mutating, scheduling a one-shot notification, recording analytics, computing wall-clock staleness in ms) is action-time. It reads bare `now()` / `todayDateString()` and does not take the date as a dep.

A useEffect body whose **correctness depends on which day it is** (recomputing whether today's session is done, recomputing today's reminder slot — anything where stale day-state produces a wrong observable result) takes `useTodayDateString()` as a dep and reads the same hook value inside the body. The rollover then re-runs the effect automatically.

Verified at design time: no current useEffect in the codebase falls into the second category. The only useEffect calling `now()` is the trial hook's ms-grained staleness check — action-time, stays as bare `now()`. The rule is written down for future code.

### Utility functions with `now()` defaults

[`summarizeHabitProgress`](../../../src/features/today/progress.ts) and [`computeGoalStreak`](../../../src/features/today/goalMetrics.ts) default `endDate = now()`. **The utilities do not change.** Only their render-time callers are migrated, and those callers pass an explicit `useTodayAnchorDate()` so the default never fires for them. The bare-`now()` default remains correct for non-render callers.

### Sub-day verification (every Section 4 site)

| Site | Pattern | Sub-day safe? |
|---|---|---|
| `useTodayHabits` trailing-range, week-start | `getTrailingDateRangeStrings`, `getWeekStartDate*` | Day-granular helpers. Safe. |
| `useGoalDetail` (all four sites) | `setHours(0,0,0,0)` applied, plus day-granular helpers | Safe. |
| `useRecoveryCheck`, `useSingleMissBanner` | `todayDateString()` string passed to detection helpers | Day-granular string. Safe. |
| `useGoalWeekSummary`, `useGoalReviewStatusQuery` | Day-granular strings only | Safe. |
| `HabitDetailScreen.calendarDays` | `Math.ceil((now - start) / dayMs) + 1` with `start` at noon | Noon-pinning keeps the diff on integer day boundaries. Safe. |
| `HabitDetailScreen.activeDaysCount` | `today.setHours(0,0,0,0)` applied | Safe. |
| `HabitDetailScreen.weeklyData` chart end | `computeWeeklyConsistency` normalizes `endDate` via `setHours(0,0,0,0)` | Safe. |
| `GraduationCeremonyScreen.daysSinceStart` | `toDeviceDateString(now())` then inclusive day-diff | Day-granular string. Safe. |
| `CalendarGrid`, `Heatmap`, `MiniHeatmapStrip`, `GoalStreakStrip` | `todayDateString()` for cell comparisons (`===`, `<`, `>`) | Day-granular strings. Safe. |

No sub-day comparisons in the inventory.

### Query-key cycling on rollover

When the date flips, hooks like `useEligibleHabitsQuery` produce a new query key (`["habits", userId, "2026-05-30"]`). React Query starts a fresh query under that key; the previous key's cache eventually garbage-collects. This is correct behavior. On an offline-first SQLite app the refetch is a fast local read — no UX cost.

## Testing

### New files

- `src/utils/__tests__/dayBoundary.test.ts` — store unit tests.
- `src/utils/__tests__/useTodayDateString.test.tsx` — hook tests.
- Extend `src/features/today/__tests__/TodayScreen.integration.test.tsx` — rollover scenarios.

### Coverage matrix

| Layer | Test | Mechanism |
|---|---|---|
| Store | `getSnapshot()` returns referentially-equal `Date` while date unchanged | Same-instance assertion across two calls |
| Store | `checkAndMaybeNotify()` is idempotent | Call twice with no clock change → listener fires 0 times |
| Store | Date change notifies all subscribers | `setNowForTesting('2026-05-30')` → `triggerDayBoundaryCheckForTesting()` → assert listener called once per subscriber |
| Store | Midnight timer fires and reschedules | `jest.useFakeTimers()`; advance to next local midnight; assert listener fired; assert another timer was scheduled |
| Store | `AppState` `change → active` triggers a check | Mock AppState; emit `"active"`; assert listener fired |
| Store | `background → active` after midnight notifies once | Sequence: foreground at 23:59, background, advance clock past midnight, foreground; assert exactly one notify (idempotency vs overdue timer) |
| Store | `resetDayBoundaryForTesting()` clears listeners and timer | Reset, then verify no further notifies fire |
| Hook | `useTodayDateString()` returns current value | Render consumer, snapshot output |
| Hook | Consumer re-renders on date change | Render counter; trigger; assert renders === 2 |
| Hook | Consumer does *not* re-render when trigger fires with unchanged date | Render counter; trigger twice same day; assert renders === 1 |
| Integration | TodayScreen rollover via foreground (the bug we are fixing) | Mount at 23:59 → `setNowForTesting('next day 00:01')` → emit `AppState` `"active"` → assert `AppHeader` date label updated AND `useEligibleHabitsQuery` re-keyed to new date string |
| Integration | TodayScreen rollover via midnight-while-open | Mount at 23:59 → `jest.advanceTimersByTime(2 * 60 * 1000)` → assert same outcome |
| Regression | DST-transition day still rolls over correctly | Freeze clock to a known DST-spring-forward date; assert noon anchor unaffected and midnight timer fires at local midnight |

### Test seams

- Reuse `setNowForTesting` / `resetClockForTesting` from `src/utils/clock.ts`.
- Add `triggerDayBoundaryCheckForTesting()` and `resetDayBoundaryForTesting()` to `src/utils/dayBoundary.ts`, gated by the same `isTest` check the clock module uses.
- AppState mock: standard `jest.mock("react-native", ...)` pattern with a stub `addEventListener` that exposes an `emit` for tests. Reuse the helper pattern from existing trial-hook tests.

### Test author UX

The explicit `triggerDayBoundaryCheckForTesting()` is only needed for **intra-test rollover** — when the test mutates the clock after the component has already mounted. A test that calls `setNowForTesting('2026-05-30')` *before* mounting reads the new date naturally on first render and does not need to trigger anything. Do not sprinkle the trigger prophylactically.

Existing tests that `jest.mock("@/utils/clock", ...)` continue to work unchanged: the day-boundary store reads through the clock module, so the mocked `todayDateString()` flows through naturally. No test-suite blast radius.

### Out of scope for tests

- Per-call-site rollover tests for each of the ~30 migrated sites — they are mechanical substitutions returning the same value at a given moment, covered by existing assertions plus the new integration tests for the load-bearing screens.
- React Query's behavior on key change — framework behavior, not ours.

## Known limitations

- **Timezone changes mid-session.** If the user changes device timezone while the app is foregrounded, the cached date is recomputed only on the next `AppState` foreground or scheduled midnight. Not in the stated scope; users rarely change timezone mid-session, and the next interaction will re-render correctly via existing paths.
- **Clock running backward.** If the user manually moves the device clock backward across midnight, the store correctly detects the date change (string inequality), but downstream query keys may briefly resolve to a "future" key from earlier in the session. React Query handles this without crashing; no UX action required.

## File layout summary

New files:

- `src/utils/dayBoundary.ts` — store + hooks.
- `src/utils/__tests__/dayBoundary.test.ts`.
- `src/utils/__tests__/useTodayDateString.test.tsx`.

Edited files (mechanical migrations):

- `src/providers/AppProviders.tsx` — call `initDayBoundary()` once.
- ~30 call sites across ~15 files — substitute `todayDateString()` → `useTodayDateString()` and `now()` → `useTodayAnchorDate()` at render time only. Exact enumeration belongs in the implementation plan.
- `src/features/today/__tests__/TodayScreen.integration.test.tsx` — add rollover scenarios.

## Open questions

None. All Section 1–5 review feedback resolved inline.
