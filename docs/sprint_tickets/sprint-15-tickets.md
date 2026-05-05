# Sprint 15 — Goal Detail screen + Habit Detail redesign

> **Status:** Planned
> **Estimate:** 3–4 days
> **Depends on:** S14 (code complete; process items pending but non-blocking)
> **Branch:** `sprint-15`

## Sprint goal

Build a new Goal Detail screen that surfaces goal-level metrics, and redesign the existing Habit Detail screen with the design decisions locked in the S14 product review: formula-first header, compact side-by-side metrics, growing calendar, off-day outlines, and Option C labeling.

## What exists today (scope read, May 5 2026)

Before scoping, we read every relevant source file. Here's what's already built and what isn't:

**Already built (reuse, don't rebuild):**
- `useTodayHabits` groups habits by `identityPhrase` using `groupByIdentity()` in `TodayScreen.tsx`
- `avgConsistencyRate()` and `oldestStreak()` helper functions exist in `TodayScreen.tsx` (need extracting to a shared module)
- `useHabitLogsForHabitsInRange(habitIds, days)` in `today/hooks.ts` — bulk log fetching
- `CalendarGrid` component with done/missed/skipped/off-day/today-pending states
- `ConsistencyDonut` component (48px SVG donut, sage accent)
- `formatHabitFormula(cue, tinyAction)` returns `"After {cue}, I will {action}."`
- `getActiveDaysLabel(days)` returns "Every day" / "Weekdays" / "N days a week"
- `summarizeHabitProgress()` calculates consistency, streak, skip count per habit

**Not yet built (S15 scope):**
- `GoalDetailScreen` — entirely new
- Route `app/(app)/goals/[identityPhrase].tsx` — doesn't exist
- `useGoalDetail(identityPhrase)` hook — doesn't exist
- `MiniHeatmapStrip` component — doesn't exist
- CalendarGrid start-date mode — grid is currently fixed at a 5-week window ending today
- Off-day cell outline style (currently dashed, spec says solid 1px `#e8e3d8`)
- `offDayBorder` color token — `#e8e3d8` not in `colors.ts`
- Natural frequency label (e.g. "Once a week") — `getActiveDaysLabel` returns "N days a week" not natural phrasing
- Habit Detail formula-first header — current header is: goal label → icon + title → schedule → cue
- Compact side-by-side metric cards — current streak card has gradient circle, text column, and is full-width
- Goal breadcrumb on Habit Detail — doesn't exist
- Consistency suppression below 7 days — doesn't exist
- Today screen donut tap → Goal Detail navigation — donut is not tappable currently

---

## Tickets

### S15-01: CalendarGrid v2 — start-date-based + off-day outlines

**Type:** Shared component rework
**Estimate:** 0.5 day
**Branch:** `s15/calendar-grid-v2`

**Context:**
The CalendarGrid is a shared component used by Habit Detail today and potentially reusable on Goal Detail. Two changes are needed: (1) the grid should start at the habit's `start_date` and grow with the user instead of always showing a fixed 5-week window, and (2) off-day cells should change from dashed borders to solid outlined squares matching the design spec.

**A. Add `offDayBorder` color token:**

In `src/theme/colors.ts`, add:

```typescript
offDayBorder: '#e8e3d8',
```

This is a warm outline tone sitting between `surfaceHigh` and `surface` — visible but quiet.

**B. Accept `startDate` prop and build a growing grid:**

The current `buildGrid()` function always builds a 5-row × 7-column grid anchored to the current week. The new version accepts an optional `startDate` string. When provided, the grid starts on the Monday of the week containing `startDate` and extends to the Sunday of the current week. The number of rows adapts — day 1 shows 1 row, day 10 shows 2 rows, etc.

Add prop to `CalendarGridProps`:

```typescript
type CalendarGridProps = {
  activeDays: number[];
  logs: HeatmapLog[];
  onCellPress?: (date: string) => void;
  startDate?: string;   // NEW — habit start_date; if omitted, falls back to 5-week fixed window
};
```

Updated `buildGrid` signature:

```typescript
function buildGrid(
  logs: HeatmapLog[],
  activeDays: number[],
  startDate?: string,
): CalendarCell[]
```

Logic when `startDate` is provided:
1. Parse `startDate` to get its Monday (start of week).
2. Get today's Sunday (end of current week).
3. Calculate total days between Monday-of-start-week and Sunday-of-current-week.
4. Round up to full weeks (multiples of 7) to get row count.
5. Build cells for that range. Cells before `startDate` get state `"empty"` (same as current `"future"` — transparent, not tappable).

When `startDate` is omitted, preserve the current 5-week fixed-window behavior for backward compatibility.

**C. Off-day cell style change:**

In `cellStyle()`, change the `"off-day"` case from:

```typescript
case "off-day":
  return {
    backgroundColor: "transparent",
    borderColor: colors.textFaint,
    borderStyle: "dashed" as const,
    borderWidth: 1,
    opacity: 0.4,
  };
```

To:

```typescript
case "off-day":
  return {
    backgroundColor: "transparent",
    borderColor: colors.offDayBorder,
    borderWidth: 1,
  };
```

No dashed border, no opacity reduction. A clean, quiet outline.

**D. Legend update:**

The current "Off day" legend swatch uses dashed border styling. Update the `LegendItem` for off-day to match the new solid outline:

Replace the `dashed` style logic with a new `outlined` variant:

```typescript
<LegendItem outlined label="Off day" />
```

Add `outlined` style in `LegendItem`:

```typescript
outlined && {
  backgroundColor: 'transparent',
  borderColor: colors.offDayBorder,
  borderWidth: 1,
}
```

Remove the `dashed` prop and style — it's no longer used.

**E. Handle cells before `startDate`:**

When `startDate` is provided, days before `startDate` within the first week should render as `"empty"` — transparent, not tappable, no outline. They're padding to keep the grid aligned to weekdays. The current `"future"` state already has the right visual treatment (transparent), so cells before `startDate` can reuse it.

In `buildGrid`, add a check: `if (startDate && date < startDate) { state = "future"; }` — placed before the active-day and log checks.

**F. HabitDetailScreen update:**

Pass `startDate={habit.start_date}` to `CalendarGrid` in `HabitDetailScreen.tsx`:

```tsx
<CalendarGrid
  activeDays={activeDays}
  logs={calendarLogs as HeatmapLog[]}
  onCellPress={handleCellPress}
  startDate={habit.start_date}
/>
```

Update the calendar header eyebrow label from "Last 30 days" to a dynamic label reflecting the actual range, e.g. "Since {month} {day}" or just "Activity" if you want to keep it simple.

**G. Counter update:**

The `calendarDoneCount` and `calendarActiveDayCount` calculations in HabitDetailScreen currently use a fixed 30-day lookback. These should now count from `habit.start_date` to today when `startDate` is available. The counter text `"{N} of {M} active days"` stays the same.

**Tests** (add to `src/components/__tests__/CalendarGrid.test.ts` or `src/features/habits/__tests__/calendarGrid.test.ts`):

1. **Start-date grid — day 1:** `startDate = today` → grid has 1 row (7 cells), 6 empty + 1 today-pending (or fewer empty depending on weekday)
2. **Start-date grid — day 10:** `startDate = 10 days ago` → grid has 2 rows
3. **Start-date grid — day 30:** 5 rows
4. **Cells before startDate are empty:** first cells in the grid before startDate have state "future"
5. **Off-day cells have solid border, not dashed:** verify `cellStyle("off-day")` returns `borderColor: colors.offDayBorder` without `borderStyle: "dashed"`
6. **Fallback without startDate:** when `startDate` is omitted, grid still shows 5 fixed rows (backward compat)

**Done means:** CalendarGrid on Habit Detail starts at the habit's `start_date` and grows forward. Off-day cells show faint warm outlines. Day-one calendar shows a single row. Legend matches. Tests pass.

---

### S15-02: Habit Detail redesign — formula header + compact metrics

**Type:** Screen redesign
**Estimate:** 1–1.5 days
**Branch:** `s15/habit-detail-redesign`
**Depends on:** S15-01 (CalendarGrid v2 with startDate prop)

**Context:**
The current Habit Detail header shows: goal label → icon + title → schedule label → cue. The streak is displayed in a full-width card with a gradient circle. The S15 design review locked several changes: formula-first header, compact side-by-side metrics, consistency suppression, goal breadcrumb, and Option C labeling.

**A. Add `getFrequencyLabel(activeDays)` formatter:**

Create a new export in `src/features/habits/formatters.ts`:

```typescript
export function getFrequencyLabel(activeDays: number[]): string {
  const sorted = [...activeDays].sort((a, b) => a - b);
  const count = sorted.length;

  if (count === 7) return "Every day";
  if (count === 1) return "Once a week";
  if (count === 2) return "Twice a week";

  // Check for weekdays
  const weekdays = [1, 2, 3, 4, 5];
  if (count === 5 && weekdays.every((d) => sorted.includes(d))) return "Weekdays";

  // Check for weekends
  const weekend = [6, 7];
  if (count === 2 && weekend.every((d) => sorted.includes(d))) return "Weekends";

  return `${count} days a week`;
}
```

The key difference from `getActiveDaysLabel`: this says "Once a week" instead of "1 days a week", and "Twice a week" instead of "2 days a week". The phrasing is more natural for the formula-adjacent display.

**B. Restructure the header:**

Replace the current header layout with:

```
← Back
Become {identity_phrase}               ← goal label (tappable, navigates to GoalDetail)
🏃 {habit title}                       ← icon (22px) + title
After lunch, I will read.              ← full formula (formatHabitFormula)
Once a week                            ← frequency (getFrequencyLabel)
```

Implementation:

```tsx
<View style={styles.header}>
  <Pressable onPress={() => router.back()} style={styles.backButton}>
    <ChevronLeft color={colors.textMuted} size={22} strokeWidth={1.75} />
  </Pressable>
  {habit.identity_phrase ? (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/(app)/goals/[identityPhrase]",
          params: { identityPhrase: habit.identity_phrase },
        })
      }
    >
      <Text selectable style={styles.goalLabel}>
        Become {habit.identity_phrase}
      </Text>
    </Pressable>
  ) : null}
  <View style={styles.habitTitleRow}>
    {habit.icon ? (
      <LucideIcon name={habit.icon} size={22} color={colors.primary} strokeWidth={1.75} />
    ) : null}
    <Text selectable style={styles.habitTitle}>{habit.title}</Text>
  </View>
  <Text selectable style={styles.formulaText}>{formula}</Text>
  <Text selectable style={styles.frequencyText}>{frequencyLabel}</Text>
</View>
```

The icon size drops from 28 → 22px to sit more naturally with the title. The formula text uses `bodyLg` in `textMuted`. The frequency text uses `bodyMd` in `textFaint`.

The goal label becomes tappable — tapping it navigates to the GoalDetailScreen (which S15-03 will create). Until that route exists, this link will soft-fail, so S15-03 should be merged before this is testable end-to-end. During development, the link can temporarily navigate back or be a no-op.

**C. Compact side-by-side metrics:**

Replace the current full-width streak card with two equal-width metric cards side by side:

```
┌──────────────────┐  ┌──────────────────┐
│  Habit consistency │  │  Habit streak    │
│    ┌──────┐       │  │                  │
│    │ 75%  │       │  │     12           │
│    │donut │       │  │                  │
│    └──────┘       │  │                  │
└──────────────────┘  └──────────────────┘
```

Both cards use `ZenCard`. The left card contains a 40px `ConsistencyDonut` (or an inline donut since the component is 48px — we'll make a `size` prop). The right card shows the streak number in `headlineLg` with `displayBold` font.

Create a reusable `CompactDonut` — or better, add a `size` prop to `ConsistencyDonut`:

```typescript
type ConsistencyDonutProps = {
  label?: string;   // NEW — defaults to "Consistency"
  rate: number;
  size?: number;    // NEW — defaults to 48
};
```

Layout:

```tsx
<View style={styles.metricsRow}>
  <ZenCard style={styles.metricCard}>
    <Eyebrow label="Habit consistency" />
    <View style={styles.metricCenter}>
      {activeDaysCount >= 7 ? (
        <ConsistencyDonut rate={progress.consistencyRate} size={40} label="" />
      ) : (
        <Text style={styles.tooEarlyText}>Too early to tell — keep showing up</Text>
      )}
    </View>
  </ZenCard>
  <ZenCard style={styles.metricCard}>
    <Eyebrow label="Habit streak" />
    <View style={styles.metricCenter}>
      <Text style={styles.streakLargeNumber}>{progress.streak}</Text>
    </View>
  </ZenCard>
</View>
```

Key decisions:
- **"Habit consistency" / "Habit streak"** — Option C labeling per the design review. On Today the donut says "Goal consistency"; here it says "Habit consistency".
- **Gradient streak circle removed.** The `LinearGradient` + `streakCircle` style is deleted. The streak number stands alone.
- **Consistency suppression below 7 active days.** If the habit has fewer than 7 active days logged, the donut card shows "Too early to tell — keep showing up" instead of a percentage. This prevents misleading stats on day 1.

To calculate `activeDaysCount`, count how many active days exist between `habit.start_date` and today:

```typescript
const activeDaysCount = (() => {
  if (!habit) return 0;
  const start = new Date(`${habit.start_date}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;
  const d = new Date(start);
  while (d <= today) {
    if (isActiveDay(d, activeDays)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
})();
```

**D. Goal breadcrumb below metrics:**

Below the metric cards, add a faint breadcrumb line:

```tsx
{habit.identity_phrase ? (
  <Text style={styles.goalBreadcrumb}>
    Become {habit.identity_phrase} · {Math.round(goalConsistencyRate * 100)}% overall
  </Text>
) : null}
```

This requires knowing the goal-level consistency. Since loading all sibling habits for a breadcrumb is expensive, use a lightweight query: load all habits with the same `identityPhrase`, compute their average consistency, and cache it. Create a small hook:

```typescript
function useGoalConsistency(identityPhrase: string | undefined) {
  // Returns the average consistency across all habits sharing this identity phrase
  // Implementation: query all active habits → filter by identity_phrase → average consistencyRate
}
```

Or simpler: pass it as a route param from Today or GoalDetail when navigating. If the user navigates directly (e.g., deep link or back button), fall back to showing just "Become {phrase}" without the percentage.

For beta simplicity, **accept the breadcrumb as a route param** when available, and fall back gracefully:

```tsx
const { habitId, goalConsistency } = useLocalSearchParams<{
  habitId?: string | string[];
  goalConsistency?: string;
}>();

// In the breadcrumb:
{habit.identity_phrase ? (
  <Text style={styles.goalBreadcrumb}>
    Become {habit.identity_phrase}{goalConsistencyPct ? ` · ${goalConsistencyPct}% overall` : ''}
  </Text>
) : null}
```

**E. Remove deleted elements:**

- Delete the `streakCircle` style and `LinearGradient` import (no longer needed on this screen)
- Delete the `streakNumber` style
- Remove the old full-width streak `ZenCard` block
- The `consistencyText` line (previously inside the streak card) moves into the donut metric card or is removed (the donut already shows the percentage)
- Skip count display: keep it somewhere visible — add it as a small detail below the streak number: `"{N} skips"` in `textFaint`

**F. Calendar card update:**

The eyebrow label changes from "Last 30 days" to "Activity" (since the grid now grows from start_date, "last 30 days" is inaccurate). The counter `"{N} of {M} active days"` remains, now counting from `start_date`.

**G. Style additions / changes:**

New styles needed:
- `formulaText` — `bodyLg`, `textMuted`, italic Manrope
- `frequencyText` — `bodyMd`, `textFaint`
- `metricsRow` — `flexDirection: "row"`, `gap: spacing.md`
- `metricCard` — `flex: 1` (equal width)
- `metricCenter` — centered content within metric card
- `streakLargeNumber` — `headlineLg`, `displayBold`, `text` color
- `goalBreadcrumb` — `bodyMd`, `textFaint`, centered
- `tooEarlyText` — `bodyMd`, `textMuted`, italic

**Tests:**

1. **Formula renders in header:** verify formula text ("After X, I will Y.") appears in the header section
2. **Frequency label:** `getFrequencyLabel([1])` → "Once a week"; `getFrequencyLabel([1,2,3,4,5,6,7])` → "Every day"; `getFrequencyLabel([1,3])` → "Twice a week"; `getFrequencyLabel([1,2,3])` → "3 days a week"
3. **Compact metrics render side by side:** both metric cards visible
4. **No gradient circle:** verify `LinearGradient` is not rendered in the streak section
5. **Consistency suppressed below 7 days:** when activeDaysCount < 7, donut card shows fallback text
6. **Goal breadcrumb renders with identity phrase**

**Done means:** Habit Detail shows formula-first header, two compact metric cards side by side, no gradient circle, frequency label as natural phrase, consistency suppressed on young habits. Goal breadcrumb visible. No visual regressions. Tests pass.

---

### S15-03: GoalDetailScreen + route + MiniHeatmapStrip

**Type:** New screen + component
**Estimate:** 1.5 days
**Branch:** `s15/goal-detail-screen`
**Depends on:** S15-01 (CalendarGrid v2), S15-02 (ConsistencyDonut size prop)

**Context:**
The GoalDetailScreen is the middle layer in the navigation: Today → GoalDetail → HabitDetail. It surfaces goal-level metrics (aggregated across all habits) and shows how each individual habit is contributing. The screen is reached by tapping the consistency donut or goal header on Today.

**A. Extract goal-level helpers to a shared module:**

The functions `avgConsistencyRate()` and `oldestStreak()` currently live as private functions inside `TodayScreen.tsx`. Extract them to `src/features/today/progress.ts` (or a new `src/features/today/goalMetrics.ts`) so both TodayScreen and GoalDetailScreen can use them.

```typescript
// src/features/today/goalMetrics.ts

import type { HabitProgressSummary } from "@/features/today/progress";

type HabitWithProgress = {
  startDate: string;
  streak: number;
  consistencyRate: number;
};

export function avgConsistencyRate(habits: HabitWithProgress[]): number {
  if (habits.length === 0) return 0;
  return habits.reduce((sum, h) => sum + h.consistencyRate, 0) / habits.length;
}

export function oldestStreak(habits: HabitWithProgress[]): number {
  const sorted = [...habits].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  return sorted[0]?.streak ?? 0;
}
```

Update `TodayScreen.tsx` to import from this shared module instead of using local copies.

**B. Create `useGoalDetail(identityPhrase)` hook:**

Location: `src/features/today/hooks.ts` (alongside `useTodayHabits`) or a new `src/features/goals/hooks.ts`.

```typescript
export function useGoalDetail(identityPhrase: string | undefined) {
  const { user } = useAuthSession();
  const todayDate = toDeviceDateString();
  const { endDate, startDate } = getTrailingDateRangeStrings(TODAY_PROGRESS_WINDOW_DAYS, now());
  const endDateObj = new Date(`${endDate}T12:00:00`);

  // All active habits for this user, filtered by identity phrase
  const allHabitsQuery = useEligibleHabitsQuery();
  const goalHabits = (allHabitsQuery.data ?? []).filter(
    (h) => h.identity_phrase === identityPhrase
  );

  // Bulk logs for all habits in the goal
  const habitIds = goalHabits.map((h) => h.id);
  const logsQuery = useHabitLogsForHabitsInRange(habitIds, TODAY_PROGRESS_WINDOW_DAYS);
  const allLogs = logsQuery.data ?? [];

  // Per-habit progress summaries
  const logsByHabitId = new Map<string, HabitLogRecord[]>();
  for (const log of allLogs) {
    const arr = logsByHabitId.get(log.habit_id) ?? [];
    arr.push(log);
    logsByHabitId.set(log.habit_id, arr);
  }

  const habitsWithProgress = goalHabits.map((habit) => {
    const activeDays = parseActiveDays(habit.active_days);
    const progress = summarizeHabitProgress({
      activeDays,
      endDate: endDateObj,
      logs: logsByHabitId.get(habit.id) ?? [],
      windowDays: TODAY_PROGRESS_WINDOW_DAYS,
    });
    return {
      ...progress,
      activeDays,
      icon: habit.icon ?? null,
      id: habit.id,
      name: habit.title,
      startDate: habit.start_date,
    };
  });

  return {
    error: allHabitsQuery.error ?? logsQuery.error ?? null,
    goalConsistencyRate: avgConsistencyRate(habitsWithProgress),
    goalStreak: oldestStreak(habitsWithProgress),
    habits: habitsWithProgress,
    identityPhrase: identityPhrase ?? "",
    isLoading: allHabitsQuery.isLoading || logsQuery.isLoading,
  };
}
```

This hook reuses existing queries — no new DB queries needed.

**C. Create `MiniHeatmapStrip` component:**

Location: `src/components/MiniHeatmapStrip.tsx`

This is a compressed 30-day timeline showing a single row of tiny colored squares. It gives a quick visual sense of how consistently a habit has been logged without taking up vertical space.

```typescript
type MiniHeatmapStripProps = {
  activeDays: number[];
  logs: HeatmapLog[];
  startDate: string;
};
```

Implementation:
- Show the last 30 days (or from `startDate` if less than 30 days ago) as a horizontal row of small squares (8px × 8px, 2px gap, 2px border radius).
- Same color mapping as CalendarGrid: done → `heatDone`, missed → `heatMissed`, skipped → `heatSkipped`, off-day → `offDayBorder` outline, future → transparent.
- No interactivity (no `onPress`). No day headers. No legend. Pure glanceable pattern.
- The strip aligns right within its container so the most recent days are always visible.

```tsx
export function MiniHeatmapStrip({ activeDays, logs, startDate }: MiniHeatmapStripProps) {
  const cells = buildStripCells(logs, activeDays, startDate);

  return (
    <View style={styles.strip}>
      {cells.map((cell, i) => (
        <View key={i} style={[styles.dot, dotStyle(cell.state)]} />
      ))}
    </View>
  );
}
```

`buildStripCells` is a simplified version of CalendarGrid's `buildGrid` — no week alignment, just a flat sequence of the last 30 days (or fewer if the habit is younger).

**D. Create `GoalDetailScreen`:**

Location: `src/features/today/screens/GoalDetailScreen.tsx` (lives in the `today` feature since it's an extension of the Today experience).

Screen layout (top to bottom):

```
← Back
────────────────────────────────────
Become {identity_phrase}         ← headline (headlineLg, displayBold)
Showing up for 12 days           ← identity streak copy (italic, sage)

┌──────────────┐ ┌──────────────┐
│Goal           │ │Goal          │
│consistency    │ │streak        │
│   72%         │ │   12         │
│  (donut)      │ │              │
└──────────────┘ └──────────────┘

HABITS IN THIS GOAL              ← Eyebrow

┌────────────────────────────────┐
│ 📖 Read before bed             │
│ 85% · 14 days                  │
│ ██████████████████░░░░░░░░░░░░ │ ← mini heatmap strip
│                            ›   │
├────────────────────────────────┤
│ 🏃 Run around the block        │
│ 60% · 8 days                   │
│ ██████░░████░░██████░░░░░░░░░░ │
│                            ›   │
└────────────────────────────────┘

        Back to Today             ← TertiaryBtn
────────────────────────────────
```

Implementation details:

**Header section:**
- Back chevron (same pattern as HabitDetail)
- Becoming phrase: `headlineLg`, `displayBold`
- Identity streak: same copy as Today (`getStreakCopy(goalStreak)`), italic, sage color

**Metric cards:**
- Same side-by-side pattern as the Habit Detail redesign (S15-02), but labeled "Goal consistency" and "Goal streak" (Option C)
- Use `ConsistencyDonut` with `size={40}` and no label (label is the Eyebrow above)
- Apply the same <7-day suppression: if the oldest habit in the goal has fewer than 7 active days, show "Too early to tell"

**Habits section:**
- Eyebrow: "Habits in this goal"
- Habit rows inside a `ZenCard`:
  - Icon (16px) + habit name (`bodySemi`, `text`)
  - Subtitle: `"{consistency%}% · {streak} days"` in `textMuted`
  - `MiniHeatmapStrip` below the subtitle
  - Chevron right → navigates to `/(app)/habits/[habitId]` with `goalConsistency` param
  - Rows separated by `surface` hairline divider
- Tap row → navigate to Habit Detail, passing `goalConsistency` as a search param

**Footer:**
- `SecondaryButton` or `TertiaryBtn`: "Back to Today" → `router.push("/(app)/(tabs)/today")`

**Read-only awareness:**
- The GoalDetailScreen is read-only by nature (no mutations). It should still show the `ReadOnlyBanner` if the app is in read-only mode, consistent with other screens.

**E. Create route file:**

`app/(app)/goals/[identityPhrase].tsx`:

```tsx
export { default } from "@/features/today/screens/GoalDetailScreen";
```

The screen reads the param via:

```typescript
const { identityPhrase } = useLocalSearchParams<{ identityPhrase: string }>();
const decoded = identityPhrase ? decodeURIComponent(identityPhrase as string) : undefined;
```

Expo Router handles URL encoding for path parameters, but we should decode explicitly to be safe with phrases containing spaces or special characters.

**Tests:**

1. **GoalDetailScreen renders with habit list:** given 2 habits with the same identity phrase, screen shows both rows with correct names and metrics
2. **Goal-level metrics aggregate correctly:** consistency = average of habit consistencies; streak = oldest habit's streak
3. **Habit row tap navigates to HabitDetail:** verify `router.push` called with correct habitId
4. **MiniHeatmapStrip renders correct cell count:** habit with 10 days shows 10 cells; habit with 30+ days shows 30 cells
5. **MiniHeatmapStrip cell colors:** done cell uses `heatDone`, missed uses `heatMissed`, off-day uses outline style
6. **Empty state:** if no habits match the identity phrase (shouldn't happen normally), show a fallback message
7. **Identity phrase with spaces/special chars:** URL encoding/decoding roundtrip works correctly

**Done means:** Tapping into GoalDetailScreen (via direct navigation or test) renders the goal header, metric cards, habit rows with mini heatmaps. Tapping a habit row navigates to its detail. All tests pass.

---

### S15-04: Today → GoalDetail navigation wiring + label update

**Type:** Navigation + UI tweak
**Estimate:** 0.5 day
**Branch:** `s15/today-goal-nav`
**Depends on:** S15-03 (GoalDetailScreen must exist)

**Context:**
The final wiring: make the consistency donut and goal header on Today tappable, navigating to the new GoalDetailScreen. Also update the donut caption from "Consistency" to "Goal consistency" per Option C labeling.

**A. Make `ConsistencyDonut` tappable:**

The `ConsistencyDonut` component is currently a pure display component with no press handler. Add an optional `onPress` prop:

```typescript
type ConsistencyDonutProps = {
  label?: string;
  onPress?: () => void;
  rate: number;
  size?: number;
};
```

When `onPress` is provided, wrap the donut in a `Pressable`:

```tsx
const content = (
  <View style={styles.container}>
    {/* existing donut SVG + caption */}
  </View>
);

return onPress ? (
  <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
    {content}
  </Pressable>
) : content;
```

**B. Update donut label:**

Change the `captionText` default from `"Consistency"` to the value of the `label` prop. In `ConsistencyDonut`:

```tsx
<Text style={styles.captionText}>{label ?? "Consistency"}</Text>
```

When the label prop is empty string `""`, hide the caption entirely.

**C. Wire up GoalContainer on TodayScreen:**

In `TodayScreen.tsx`, add an `onGoalPress` handler to `GoalContainer` and pass it through:

Add prop to `GoalContainer`:

```typescript
type GoalContainerProps = {
  // ...existing props
  onGoalPress?: () => void;   // NEW
};
```

In `GoalContainer`, make the becoming text and the donut tappable:

```tsx
<Pressable onPress={onGoalPress} style={styles.anchorSide}>
  <Text style={styles.becomingText}>Become {identityPhrase}</Text>
  <Text style={styles.streakText}>{streakCopy}</Text>
  {/* remaining count pill */}
</Pressable>
<ConsistencyDonut
  label="Goal consistency"
  onPress={onGoalPress}
  rate={consistencyRate}
/>
```

In `TodayScreen.tsx`, pass the navigation handler:

```tsx
<GoalContainer
  // ...existing props
  onGoalPress={() =>
    router.push({
      pathname: "/(app)/goals/[identityPhrase]",
      params: { identityPhrase: encodeURIComponent(group.identityPhrase) },
    })
  }
>
```

**D. Verify navigation roundtrip:**

The full flow should now be:
1. Today: tap donut or goal header → GoalDetailScreen
2. GoalDetail: tap habit row → HabitDetailScreen
3. HabitDetail: tap goal label → GoalDetailScreen (back to goal)
4. HabitDetail: "Back to Today" → TodayScreen
5. GoalDetail: "Back to Today" → TodayScreen
6. GoalDetail: back chevron → TodayScreen (router.back())

**Tests:**

1. **Donut tap navigates to GoalDetail:** verify `router.push` called with correct encoded identityPhrase
2. **Goal header tap navigates to GoalDetail:** same navigation
3. **Label updated:** ConsistencyDonut on Today shows "Goal consistency" not "Consistency"
4. **Navigation roundtrip:** Today → GoalDetail → HabitDetail → back → GoalDetail → back → Today (manual verification during smoke test)

**Done means:** Tapping the donut or goal header on Today navigates to GoalDetailScreen. Donut caption says "Goal consistency". Full navigation chain works. Tests pass.

---

## Ticket dependency graph

```
S15-01 (CalendarGrid v2: startDate + off-day outlines)
  ├── S15-02 (Habit Detail redesign: formula + compact metrics)
  └── S15-03 (GoalDetailScreen + MiniHeatmapStrip + route)
        └── S15-04 (Today → GoalDetail navigation wiring)
```

S15-01 and S15-02 can partially overlap (the CalendarGrid changes and the Habit Detail redesign are in different files until the `startDate` prop is wired in). S15-03 depends on S15-01 for the off-day styling and on S15-02 for the `ConsistencyDonut` size prop and metric card pattern. S15-04 is the final wiring and depends on S15-03.

Recommended execution order: 01 → 02 → 03 → 04

---

## Files created / modified

**New files:**
- `app/(app)/goals/[identityPhrase].tsx` — route file
- `src/features/today/screens/GoalDetailScreen.tsx` — new screen
- `src/features/today/goalMetrics.ts` — extracted goal-level helper functions
- `src/components/MiniHeatmapStrip.tsx` — compact 30-day heatmap strip

**Modified files:**
- `src/components/CalendarGrid.tsx` — `startDate` prop, off-day style, legend update
- `src/features/habits/screens/HabitDetailScreen.tsx` — formula header, compact metrics, removed gradient circle, breadcrumb, consistency suppression
- `src/features/habits/formatters.ts` — add `getFrequencyLabel()`
- `src/features/today/components/ConsistencyDonut.tsx` — `size` + `label` + `onPress` props
- `src/features/today/components/GoalContainer.tsx` — `onGoalPress` prop, tappable header
- `src/features/today/screens/TodayScreen.tsx` — pass `onGoalPress`, import extracted helpers, pass "Goal consistency" label
- `src/theme/colors.ts` — add `offDayBorder` token

**Test files (new or updated):**
- CalendarGrid start-date and off-day tests
- `getFrequencyLabel` unit tests
- GoalDetailScreen render + navigation tests
- MiniHeatmapStrip render tests
- Consistency suppression test

---

## Design system notes for this sprint

- **Off-day cells:** `1px solid #e8e3d8`, no fill, no dashed border, no opacity reduction. This replaces the current dashed + 0.4 opacity treatment.
- **Option C labeling:** Today donut says "Goal consistency". Habit Detail metric cards say "Habit consistency" / "Habit streak". GoalDetail metric cards say "Goal consistency" / "Goal streak".
- **Gradient circle removed from Habit Detail.** Streak is now a plain number in a metric card — same visual weight as the consistency donut. This is a deliberate de-emphasis of streak-as-number in favor of streak-as-identity.
- **Formula is italic.** The habit formula ("After lunch, I will read.") renders in italic Manrope, `bodyLg`, `textMuted`. This visually sets it apart from the title without needing a different size.
- **Consistency suppression copy:** "Too early to tell — keep showing up" — warm, encouraging, no exclamation mark. Shown when fewer than 7 active days have elapsed.
- **MiniHeatmapStrip:** 8px squares, 2px gap, 2px border-radius. No interactivity. Right-aligned so the most recent days are always visible when the strip overflows.

---

## Sprint plan update needed

When S15 closes, update `sprint-plan.md`:
1. S15 status → Done, with summary note
2. Verify S16 (SRHI) scope is still accurate given the new screen structure

---

*End of Sprint 15 ticket package.*
