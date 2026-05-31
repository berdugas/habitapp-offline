# Consistency Rate — Count Unlogged Past Active Days Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `summarizeHabitProgress` so the consistency rate counts past unlogged active days as missed (matching the streak loop in the same function and the goal-level `pooledConsistencyRate`). Today still excluded; off-days still excluded; skipped still excluded from denominator; days before `start_date` still excluded.

**Architecture:** Single behavior change in `src/features/today/progress.ts`. Add an optional `startDate` parameter, then in the consistency loop count unlogged past active days into `missedCount` (today excepted, pre-startDate excepted). Wire the three callers to pass `habit.start_date`. The streak loop 25 lines below is left alone — under the forgiving-streak rule, trailing pre-creation "missed" entries never change the output (the walk has already broken on two consecutive misses before reaching them, or terminates at sequence end with the same result), so an equivalent gate there would be a no-op.

**Tech Stack:** TypeScript, React Native (Expo), Jest. Repo uses `pnpm`.

**Bug summary:** Today the consistency loop (`src/features/today/progress.ts:108-126`) calls `continue` on any unlogged active day. The app's two log-writing UI paths only ever store `"done"` or `"skipped"` ([RetroLogSelector.tsx:116-122](src/features/habits/components/RetroLogSelector.tsx:116), [TodayScreen.tsx:211](src/features/today/screens/TodayScreen.tsx:211)), so `missedCount` stays at 0 in real usage and the rate degenerates to `done/done = 100%`. A user who taps "done" 5 times over 30 days sees 100% consistency, passes the 75% graduation gate at [eligibility.ts:59](src/features/graduation/eligibility.ts:59), and never triggers the "reduce friction" recommendation at [habitAdjustmentEngine.ts:44](src/features/recommendations/habitAdjustmentEngine.ts:44).

**Scope notes:**
- `pooledConsistencyRate` ([goalMetrics.ts:66-71](src/features/today/goalMetrics.ts:66)) already handles unlogged active days correctly. After this fix, the habit-detail donut and the goal donut agree.
- No DB schema change, no migration. `"missed"` rows continue to be valid (used by recovery / week-summary fixtures and possibly future write paths).

---

## File Structure

**Modified:**
- `src/features/today/progress.ts` — add `startDate?: string` to `SummarizeHabitProgressOptions`; gate consistency loop on `startDate` and on today-vs-past.
- `src/features/today/hooks.ts` — two call sites (one per habit map, one per goal-detail habit map) pass `habit.start_date`.
- `src/features/habits/hooks.ts` — `useHabitDetail` passes `habit.start_date`.
- `src/tests/unit/todayProgress.test.ts` — new tests covering the bug repro and start-date gating. All existing tests stay green.

**No new files.**

---

## Task 1: Add `startDate` parameter (interface change, no behavior change)

**Files:**
- Modify: `src/features/today/progress.ts:7-12`

Pure plumbing step. Adding the optional parameter without using it must keep every existing test green. We thread it through so subsequent steps can use it.

- [ ] **Step 1: Add `startDate` to the options type**

Change [src/features/today/progress.ts:7-12](src/features/today/progress.ts:7):

```ts
type SummarizeHabitProgressOptions = {
  activeDays?: number[];
  endDate?: Date;
  logs: HabitLogRecord[];
  startDate?: string;
  windowDays: number;
};
```

- [ ] **Step 2: Destructure it in the function signature**

Change [src/features/today/progress.ts:68-73](src/features/today/progress.ts:68):

```ts
export function summarizeHabitProgress({
  activeDays,
  endDate = now(),
  logs,
  startDate,
  windowDays,
}: SummarizeHabitProgressOptions): HabitProgressSummary {
```

Do not use `startDate` yet — leave the loops as-is. This step is purely additive plumbing.

- [ ] **Step 3: Run the existing suite — must stay green**

Run: `pnpm jest src/tests/unit/todayProgress.test.ts -- --runInBand`
Expected: PASS — all existing tests still pass because `startDate` is unused.

- [ ] **Step 4: Commit**

```bash
git add src/features/today/progress.ts
git commit -m "refactor(progress): thread optional startDate param through summarizeHabitProgress"
```

---

## Task 2: Write failing tests for the new consistency behavior

**Files:**
- Modify: `src/tests/unit/todayProgress.test.ts` — append a new `describe` block after the existing `consistencyRate — regression tests` block (insert after the closing `});` at line 311).

We write the tests BEFORE the fix so we can see them go red, then green. Each test isolates one slice of behavior.

- [ ] **Step 1: Add the new describe block**

Insert after [src/tests/unit/todayProgress.test.ts:311](src/tests/unit/todayProgress.test.ts:311), before the `// ─── Edge cases ───` comment:

```ts
// ─── Consistency rate — unlogged past active days count as missed ─────────────
// Reproduces the bug where users who only tap "done" on good days and ignore
// the rest see an inflated consistency rate (the app never writes "missed"
// rows, so missedCount stayed at 0 and rate degenerated to done/done = 100%).

describe("consistencyRate — unlogged past active days count as missed", () => {
  const endDate = new Date("2026-04-23T10:00:00");

  it("5 done over 30-day window with 25 unlogged days → consistency 5/30, not 1.0 (bug repro)", () => {
    const logs: HabitLogRecord[] = [
      log(daysAgo(1), "done"),
      log(daysAgo(2), "done"),
      log(daysAgo(3), "done"),
      log(daysAgo(4), "done"),
      log(daysAgo(5), "done"),
    ];
    const result = summarizeHabitProgress({ endDate, logs, windowDays: 30 });
    // 30-day window; today unlogged is excluded from denominator → 29 past
    // active days, 5 done, 24 unlogged-treated-as-missed.
    expect(result.consistencyDenominator).toBe(29);
    expect(result.consistencyRate).toBeCloseTo(5 / 29);
  });

  it("today unlogged does not count against consistency", () => {
    // 3-day window, today unlogged, yesterday and day-before-yesterday done.
    // Today is excluded → denominator is 2, both done → 1.0.
    const result = summarizeHabitProgress({
      endDate,
      logs: [log(daysAgo(1), "done"), log(daysAgo(2), "done")],
      windowDays: 3,
    });
    expect(result.consistencyDenominator).toBe(2);
    expect(result.consistencyRate).toBe(1);
  });

  it("past unlogged active day with no log row counts as missed (matches streak loop)", () => {
    // 3-day window: today done, yesterday unlogged, day-before done.
    // Past active unlogged day (yesterday) counts as missed; today is in denom
    // because it has a log. Denominator = 3 (today done, yesterday missed,
    // day-before done), numerator = 2 → 2/3.
    const result = summarizeHabitProgress({
      endDate,
      logs: [log(TODAY, "done"), log(daysAgo(2), "done")],
      windowDays: 3,
    });
    expect(result.consistencyDenominator).toBe(3);
    expect(result.consistencyRate).toBeCloseTo(2 / 3);
  });

  it("skipped past day stays out of denominator (excluded from consistency)", () => {
    // 4-day window: today unlogged (excluded), yesterday skipped (excluded),
    // day-before done, day-before-that unlogged (now counts as missed).
    // Denominator = 2 (1 done + 1 missed), numerator = 1 → 0.5.
    const result = summarizeHabitProgress({
      endDate,
      logs: [log(daysAgo(1), "skipped"), log(daysAgo(2), "done")],
      windowDays: 4,
    });
    expect(result.consistencyDenominator).toBe(2);
    expect(result.skipCount).toBe(1);
    expect(result.consistencyRate).toBe(0.5);
  });

  it("off-days unlogged stay out of denominator (MWF habit)", () => {
    // 7-day window ending Thu Apr 23. activeDays = MWF (1,3,5).
    // Active days in window: Mon Apr 20, Wed Apr 22, Fri Apr 17.
    // Mon done, Wed done, Fri unlogged-treated-as-missed. Tue/Thu/Sat/Sun
    // skipped as off-days. Today (Thu) is off, excluded. Denominator = 3,
    // done = 2 → 2/3.
    const result = summarizeHabitProgress({
      activeDays: [1, 3, 5],
      endDate,
      logs: [
        log("2026-04-20", "done"), // Mon
        log("2026-04-22", "done"), // Wed
        // Apr 17 (Fri) unlogged → missed
      ],
      windowDays: 7,
    });
    expect(result.consistencyDenominator).toBe(3);
    expect(result.consistencyRate).toBeCloseTo(2 / 3);
  });

  it("startDate gates pre-creation days out of the denominator", () => {
    // 30-day window but habit started 5 days ago. Only 5 days should count
    // (today excluded → 4 past active days within startDate). 4 done →
    // denominator 4, rate 1.0. Without the gate this would inflate the
    // missed count by 25 pre-creation days.
    const startDate = daysAgo(4);
    const result = summarizeHabitProgress({
      endDate,
      logs: [
        log(daysAgo(1), "done"),
        log(daysAgo(2), "done"),
        log(daysAgo(3), "done"),
        log(daysAgo(4), "done"),
      ],
      startDate,
      windowDays: 30,
    });
    expect(result.consistencyDenominator).toBe(4);
    expect(result.consistencyRate).toBe(1);
  });

  it("startDate combined with skipped + unlogged: 7-day-old habit, mixed history", () => {
    // Habit started 6 days ago. 7-day window covers exactly the habit's life.
    // Today unlogged (excluded). Yesterday done. 2 days ago skipped (out of
    // denom). 3 days ago unlogged → missed. 4 days ago done. 5 days ago done.
    // 6 days ago (startDate itself) unlogged → missed.
    // Denominator: 1+1+1+1+1 = 5 (4 days have entries, 2 days unlogged-missed,
    // 1 day skipped excluded). Wait — recount: yesterday done(+1), 2d skipped
    // excluded, 3d missed(+1), 4d done(+1), 5d done(+1), 6d missed(+1) = 5
    // active past days in denom, 3 done → 3/5.
    const startDate = daysAgo(6);
    const result = summarizeHabitProgress({
      endDate,
      logs: [
        log(daysAgo(1), "done"),
        log(daysAgo(2), "skipped"),
        log(daysAgo(4), "done"),
        log(daysAgo(5), "done"),
      ],
      startDate,
      windowDays: 7,
    });
    expect(result.consistencyDenominator).toBe(5);
    expect(result.skipCount).toBe(1);
    expect(result.consistencyRate).toBe(0.6);
  });
});
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `pnpm jest src/tests/unit/todayProgress.test.ts -t "unlogged past active days" -- --runInBand`
Expected: FAIL. The bug-repro test should fail because the current loop returns `consistencyRate = 1` (all-done-of-logged-only) instead of `5/29`. Several others will also fail.

If any of them PASS unexpectedly, stop and re-read the test — likely it doesn't exercise an unlogged past active day. Do not proceed until the suite is genuinely red on these tests.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/tests/unit/todayProgress.test.ts
git commit -m "test(progress): add failing regression tests for unlogged-day consistency bug"
```

---

## Task 3: Apply the fix to the consistency loop

**Files:**
- Modify: `src/features/today/progress.ts:103-126`

- [ ] **Step 1: Rewrite the consistency loop**

Replace [src/features/today/progress.ts:103-126](src/features/today/progress.ts:103) with:

```ts
  // Consistency rate and skip count. For each active day in the window we
  // look up a log; if the day is unlogged we treat it as missed unless it's
  // today (no decision yet — matches the streak loop below). The app's two
  // log-writing UI paths only ever store "done" or "skipped", so without
  // the unlogged→missed branch missedCount stays at 0 and the rate
  // degenerates to done/done = 100% for any sparsely-logged habit.
  //
  // Note: pooledConsistencyRate in goalMetrics also counts past unlogged
  // active days, but additionally counts today unlogged in its denominator
  // (see goalMetrics.ts:67-69). The two rates therefore differ by 1 in the
  // denominator on days where today is active and unlogged. Bringing the
  // two into exact agreement is a separate decision — out of scope here.
  let doneCount = 0;
  let missedCount = 0;
  let skipCount = 0;

  for (let offset = 0; offset < windowDays; offset++) {
    const dateString = toDeviceDateString(addDeviceDays(normalizedEndDate, -offset));
    if (activeDays && !isActiveDay(dateString, activeDays)) continue;
    if (startDate && dateString < startDate) continue;

    const log = logsByDate.get(dateString);

    if (log) {
      if (log.status === "done") {
        doneCount += 1;
      } else if (log.status === "missed") {
        missedCount += 1;
      } else if (log.status === "skipped") {
        skipCount += 1;
      }
    } else if (dateString !== todayString) {
      // Past active day with no log row — treat as missed.
      missedCount += 1;
    }
    // else: today, unlogged — no decision yet, skip entirely.
  }

  const consistencyDenominator = doneCount + missedCount;
  const consistencyRate =
    consistencyDenominator === 0 ? 0 : doneCount / consistencyDenominator;
```

- [ ] **Step 2: Run the previously failing tests — must now pass**

Run: `pnpm jest src/tests/unit/todayProgress.test.ts -t "unlogged past active days" -- --runInBand`
Expected: PASS (all 7 tests in the new describe block).

- [ ] **Step 3: Run the full progress test file to catch regressions**

Run: `pnpm jest src/tests/unit/todayProgress.test.ts -- --runInBand`
Expected: PASS for all. All existing tests should stay green.

Note on `"returns 0 for all-missed history"` at [src/tests/unit/todayProgress.test.ts:275-282](src/tests/unit/todayProgress.test.ts:275): this test stays green. TODAY and daysAgo(1) both have "missed" logs, the `if (log)` branch fires before the today-skip, so both get counted: 0 done + 2 missed = 0/2 = 0. If it fails, stop and investigate.

If anything fails, stop and read the failure. Do not proceed.

- [ ] **Step 4: Run the broader test suite to catch downstream effects**

Run: `pnpm jest -- --runInBand`
Expected: PASS for all. Downstream tests (HabitDetailScreen, habitAdjustmentEngine, eligibility) fabricate `consistencyRate` directly without calling `summarizeHabitProgress`, so they should be unaffected.

If any tests fail, read them carefully. Tests that previously codified the buggy behavior (e.g. an integration test asserting a graduation prompt shows for a sparsely-logged habit) need an explicit decision — likely they were wrong and need updating, but flag any surprises before changing them.

- [ ] **Step 5: Commit**

```bash
git add src/features/today/progress.ts
git commit -m "fix(progress): count unlogged past active days as missed in consistency rate

The app's two log-writing UI paths only ever store \"done\" or \"skipped\",
so missedCount stayed at 0 for normal usage and the rate degenerated to
done/done = 100%. Now matches the streak loop and pooledConsistencyRate."
```

---

## Task 4: Wire callers to pass `start_date`

**Files:**
- Modify: `src/features/habits/hooks.ts:248-253`
- Modify: `src/features/today/hooks.ts:264-270`
- Modify: `src/features/today/hooks.ts:495-500`

Three call sites. Each one has the habit row in scope, so the wiring is `startDate: habit.start_date`.

- [ ] **Step 1: Wire `useHabitDetail` (habit-detail screen)**

In [src/features/habits/hooks.ts:248-253](src/features/habits/hooks.ts:248), update the `summarizeHabitProgress` call:

```ts
    progress: summarizeHabitProgress({
      activeDays: habit ? parseActiveDays(habit.active_days) : undefined,
      endDate: endDateObject,
      logs: recentLogs,
      startDate: habit?.start_date,
      windowDays: TODAY_PROGRESS_WINDOW_DAYS,
    }),
```

`habit` is `null` while loading (see surrounding code at line 240) — `startDate: habit?.start_date` is `undefined` in that case, which matches the param's optional default (no gating). Once `habit` resolves, the real `start_date` flows through.

- [ ] **Step 2: Wire the TodayScreen habit mapper**

In [src/features/today/hooks.ts:264-270](src/features/today/hooks.ts:264), update:

```ts
    return {
      ...summarizeHabitProgress({
        activeDays,
        endDate: historyWindowEndDate,
        logs: logsByHabitId.get(habit.id) ?? [],
        startDate: habit.start_date,
        windowDays: TODAY_PROGRESS_WINDOW_DAYS,
      }),
```

`habit` is non-null here (it's a loop variable over `eligibleHabits.map(...)`).

- [ ] **Step 3: Wire the goal-detail habit mapper**

In [src/features/today/hooks.ts:495-500](src/features/today/hooks.ts:495), update:

```ts
    const progress = summarizeHabitProgress({
      activeDays,
      endDate: endDateObj,
      logs: habitLogs,
      startDate: habit.start_date,
      windowDays: TODAY_PROGRESS_WINDOW_DAYS,
    });
```

- [ ] **Step 4: Run the full test suite**

Run: `pnpm jest -- --runInBand`
Expected: PASS for all. Caller-level tests typically mock the hooks rather than the underlying function, so this should be a no-op at the test level. If a test fails, it likely fabricates a habit row without a `start_date` field — read the failure and fill the fixture rather than reverting the wiring.

- [ ] **Step 5: Run the type-checker**

Run: `pnpm tsc --noEmit`
Expected: no errors. The new `startDate?: string` is optional, so omitting it is still valid. Callers passing `habit?.start_date` (which is `string | undefined`) match the optional param.

- [ ] **Step 6: Commit**

```bash
git add src/features/habits/hooks.ts src/features/today/hooks.ts
git commit -m "fix(progress): pass habit.start_date to summarizeHabitProgress at all three call sites"
```

---

## Task 5: Manual smoke check (optional but recommended)

The bug was user-visible (habit donut showed inflated consistency, graduation gate fired wrongly). A quick check in the running app confirms the math agrees with the goal donut.

- [ ] **Step 1: Start the app**

Run: `pnpm start` (or your usual launch command for the simulator/device).

- [ ] **Step 2: Pick a habit with sparse logs**

Open a habit-detail screen for an existing habit that has only a handful of "done" logs over a stretch of days. Note the consistency donut percentage.

- [ ] **Step 3: Open the goal that contains this habit**

The goal-level "pooled consistency" donut should now show the same percentage (give or take rounding) for a single-habit goal, and a sensible weighted blend for multi-habit goals. Before the fix the habit donut was inflated to ~100% while the goal donut showed the true sparser number; they should now agree.

- [ ] **Step 4: Verify a sparsely-logged habit no longer offers graduation**

For a habit older than 60 active days with only a few "done" taps, the "Graduation prompt" card on the habit-detail screen should now be hidden (consistency < 75% → `consistency_too_low`). Before the fix it would have shown.

If the donut or the prompt look wrong, capture the habit's logs and re-check against the unit tests — likely a missing case in the fix.

- [ ] **Step 5: Commit nothing (smoke check only)**

No code change. If you found a bug, write a new failing test and fix it; do not patch the smoke output.

---

## Self-Review Checklist

After execution, the following should all be true:

1. **Bug fixed:** A habit with 5 "done" taps over 30 days reports `consistencyRate ≈ 0.17`, not `1.0`.
2. **No double-counting today:** Today unlogged is not in the denominator. Today logged (any status) follows the existing logged-day rules.
3. **Off-days unaffected:** A weekday-only habit's Sat/Sun do not change the rate.
4. **Skipped unaffected:** Skipped days continue to be excluded from the denominator (they're not failures, just opt-outs).
5. **Pre-creation days excluded:** A 7-day-old habit in a 30-day window doesn't get 23 pre-creation days counted as missed in the consistency rate.
6. **Habit-detail donut ≈ goal donut** for a single-habit goal with no skipped days (agrees to within 1 day in the denominator — `pooledConsistencyRate` counts today unlogged, summarize does not; visually indistinguishable on a donut). Bringing them to exact equality is a separate, out-of-scope decision.
7. **Graduation gate correct:** A habit with 5/30 consistency over 60+ active days fails `consistency_too_low`, not `eligible`.
8. **All tests green:** `pnpm jest` is clean; `pnpm tsc --noEmit` is clean.
9. **No new files:** Only the four files listed in File Structure were touched.
10. **Consistency loop treats past unlogged active days as missed** (matching the streak loop's existing behavior) and ignores pre-startDate days.
