# Sprint 13 — Active days + Habit Detail redesign + Reminders

> **Status:** Planned
> **Estimate:** 5–6 days
> **Depends on:** S12 (goal-anchored creation flow, icon picker)
> **Branch:** `sprint-13`

## Sprint goal

Users can choose which days of the week a habit is active, see a redesigned Habit Detail screen with a 7×5 calendar grid, and set local reminders per habit. The daily loop becomes honest about rest days and gains a lightweight notification layer.

## Why this scope is bundled

Active days, the Habit Detail redesign, and reminders are tightly coupled:

- The new 30-day calendar grid on Habit Detail needs active days to render off-days as a distinct visual state.
- Reminders only fire on active days — scheduling logic depends on the `active_days` column.
- The reminder toggle lives on the redesigned Habit Detail screen.

Building them in separate sprints would mean rebuilding Habit Detail twice.

## Scope change from original S13

Original S13 was reminders-only (~3–4 days). This version adds:

- **Active days:** DB column, onboarding, create flow, edit, streak engine, consistency donut, Today rendering, Heatmap component
- **Habit Detail redesign:** Replacing the current heavy screen (90-day grid, separate Today/Progress/History/Suggestion cards) with a compact version: 7×5 calendar grid, streak card, setup card, reminder card

Sprint estimate grows from 3–4 to 5–6 days. No downstream sprint plan changes — S14 (beta QA + ship) still follows.

## Impact analysis — active days

Every surface that creates, displays, or calculates against habit data was audited. The table below tracks what changes in this sprint vs what's deferred.

| Surface | S13 action | Notes |
|---|---|---|
| DB schema (`local_habits`) | Migration 005: add `active_days` column | Default `[1,2,3,4,5,6,7]` (all days) |
| `Habit` type + repositories | Add field | Read/write |
| `HabitSetupPayload` + `CreateHabitPayload` | Add `activeDays: number[]` | Serialized on write |
| Onboarding — Cue screen | Add `ActiveDaysPicker` below formula card | Keeps screen count unchanged |
| `OnboardingDraft` + `completion.ts` | Add `activeDays` field, pass to `createHabitRepo` | Default all-7 |
| CreateHabitFlow — Build step | Add `ActiveDaysPicker` after cue | Already planned |
| EditHabitScreen | Add `ActiveDaysPicker` after preferred time | Already planned |
| Streak engine (`progress.ts`) | Filter off-days before sequence evaluation | Same pattern as skipped-day filter |
| Consistency donut (goal-level on Today) | Per-habit denominator = active days in window | Avg across habits unchanged |
| Today screen habit rows | Off-day habits get dimmed state, not "pending" | Still visible, not hidden |
| `Heatmap` component | Replaced by new `CalendarGrid` component | Old component kept but unused |
| Habit Detail screen | Full redesign (see S13-06) | Calendar grid, streak card, setup, reminder |
| Reminder scheduling | Only schedule on active days | S13-07 |
| Backup reminder logic | Skip if today is off-day | S13-07 |
| RetroLogSelector on off-days | **Deferred** — allow logging, no special treatment | Post-beta polish |
| Recovery modal edge cases | **Test only** — streak engine fix handles implicitly | Add test in S13-03 |

---

## Tickets

### S13-01: Migration 005 — `active_days` column + utility functions

**Type:** Database / Foundation
**Estimate:** 0.5 day
**Branch:** `s13/active-days-migration`

**Context:**
This is the foundation ticket. Everything else in the sprint reads from the `active_days` column. We're using a JSON array of ISO weekday numbers (1=Monday through 7=Sunday) rather than a bitmask because it's human-readable in SQLite queries and trivially extensible.

**Deliverables:**

1. **Migration file** — `src/lib/db/migrations/005_active_days.ts`:
   ```sql
   ALTER TABLE local_habits ADD COLUMN active_days TEXT NOT NULL DEFAULT '[1,2,3,4,5,6,7]';
   ```
   Register in `migrations/index.ts`.

2. **Type updates:**
   - `Habit` in `repositories/habits.ts`: add `active_days: string`
   - `CreateHabitInput`: add optional `active_days?: string`
   - `UpdateHabitPatch`: add optional `active_days?: string`

3. **Utility module** — `src/features/habits/activeDays.ts`:
   - `parseActiveDays(json: string): number[]` — parses JSON, validates 1–7 range, returns all-days fallback on malformed input
   - `serializeActiveDays(days: number[]): string` — sorts and stringifies
   - `isActiveDay(date: Date | string, activeDays: number[]): boolean` — converts date to ISO weekday (1–7), checks membership
   - `ALL_DAYS: number[]` — `[1,2,3,4,5,6,7]` constant
   - `getActiveDaysLabel(days: number[]): string` — returns "Every day" | "Weekdays" | "Weekends" | "N days a week"
   - `isoWeekday(date: Date): number` — helper: `((date.getDay() + 6) % 7) + 1` to convert JS Sunday=0 to ISO Monday=1

4. **Tests** (`src/features/habits/__tests__/activeDays.test.ts`):
   - `parseActiveDays('[1,3,5]')` → `[1,3,5]`
   - `parseActiveDays('garbage')` → `[1,2,3,4,5,6,7]` (fallback)
   - `parseActiveDays('[]')` → `[1,2,3,4,5,6,7]` (empty = fallback, can't have zero days)
   - `isActiveDay('2026-05-04', [1,2,3,4,5])` → `true` (May 4 2026 is Monday)
   - `isActiveDay('2026-05-03', [1,2,3,4,5])` → `false` (May 3 2026 is Sunday)
   - `getActiveDaysLabel([1,2,3,4,5])` → `"Weekdays"`
   - `getActiveDaysLabel([6,7])` → `"Weekends"`
   - `getActiveDaysLabel([1,2,3,4,5,6,7])` → `"Every day"`
   - `getActiveDaysLabel([1,3,5])` → `"3 days a week"`
   - Migration test: existing habits get default `[1,2,3,4,5,6,7]`

**Done means:** Migration runs on fresh and existing DBs. Types updated. All utility tests pass. Full suite green.

---

### S13-02: ActiveDaysPicker component

**Type:** UI component
**Estimate:** 0.25 day
**Branch:** `s13/active-days-picker`

**Context:**
Shared component used by onboarding, CreateHabitFlow, and EditHabitScreen. Following the pattern of `LucideIconPicker` — a self-contained component in `src/components/forms/`.

**Design spec:**
- 7 circular toggles in a horizontal row: **M T W T F S S**
- Selected: sage fill (`colors.primary` / `#446655`), white letter
- Unselected: surface fill (`colors.surface` / `#f3f1eb`), muted letter
- Circle size: 38px (meets 44px tap target with gap spacing)
- Gap: 8px between circles
- Below the row: dynamic label in `colors.textMuted`, 12px, centered
  - All 7 → "Every day"
  - 1–5 → "Weekdays"
  - 6–7 → "Weekends"
  - Custom → "N days a week"
- Last remaining active day: toggle is disabled (subtle opacity, no press handler)
- Follows the "Invisible Input" pattern from DESIGN.md — no borders, tonal backgrounds

**Component API:**
```tsx
type ActiveDaysPickerProps = {
  value: number[];           // ISO weekday numbers currently selected
  onChange: (days: number[]) => void;
  disabled?: boolean;        // Disables all toggles (e.g., read-only mode)
};
```

**File:** `src/components/forms/ActiveDaysPicker.tsx`

**Tests:**
- Renders 7 circles, all selected when `value=[1,2,3,4,5,6,7]`
- Tap circle 6 (Saturday) → `onChange` called with `[1,2,3,4,5,7]`
- Tap already-unselected circle → `onChange` called with it added
- When only 1 day selected, that circle is not pressable
- Label updates correctly for all patterns

**Done means:** Component renders correctly in isolation. All interaction tests pass.

---

### S13-03: Streak engine + consistency — active days awareness

**Type:** Logic / Foundation
**Estimate:** 0.5 day
**Branch:** `s13/streak-active-days`

**Context:**
The forgiving streak already has a "filter before evaluate" pattern for skipped days. Active days is a *pre-filter* on which dates even enter the evaluation — a skipped day says "I chose not to do it today," while an off-day says "today doesn't exist for this habit." They compose cleanly: first filter out off-days, then evaluate the remaining sequence (which may itself contain skips).

**Changes to `progress.ts` — `summarizeHabitProgress`:**

Add optional parameter: `activeDays?: number[]`

1. **Day sequence generation:** When building the reverse-chronological day list, skip any date where `isActiveDay(date, activeDays)` returns `false`. Those dates are invisible.
2. **Consistency rate:** denominator = count of active days in the window (not `windowDays`). Numerator = done count (unchanged).
3. **Skip count:** only counts skips on active days (off-day skips don't exist in the sequence).
4. **Today status:** if today is not an active day, return `todayStatus: null`.

**Changes to callers:**
- `useHabitDetail` hook: parse `habit.active_days` and pass to `summarizeHabitProgress`
- Today screen's per-habit progress: pass parsed `active_days`
- Goal-level consistency donut: each habit's consistency is already calculated with its own denominator; the goal-level average across habits is unchanged in formula but now each input reflects active days

**Tests (additions to existing streak test suite):**

- **Weekday-only habit, weekend gap:** Fri=done, Sat+Sun=off, Mon=done → streak = 2 (no break)
- **Weekday-only habit, consistency:** 5 weekdays in a week, 4 done, 1 missed → consistency = 80% (not 4/7 = 57%)
- **MWF habit:** consecutive M/W/F all done across 2 weeks → streak = 6
- **MWF habit, miss on Wednesday:** M=done, W=missed, F=done → streak = 1 (F only; W broke it)
- **Single-day habit (Monday only):** 4 consecutive Mondays done → streak = 4
- **All-days habit:** regression — existing tests pass unchanged
- **Today is off-day:** `todayStatus` = null
- **Recovery edge case:** weekday habit, Fri=done, Mon=missed, Tue=done → streak = 1 (single miss tolerated? No — Fri→Mon is one miss, which IS tolerated by forgiving streak. Streak should be 3: Tue + [tolerated Mon miss] + Fri). Verify this explicitly.
- **Empty active days fallback:** if `activeDays` is undefined/null, behavior = all-days (backward compat)

**Done means:** All new tests pass. All existing streak tests still pass (regression). A weekday-only habit created Friday doesn't show a broken streak on Monday.

---

### S13-04: Wire ActiveDaysPicker into onboarding + create + edit

**Type:** UI wiring
**Estimate:** 0.5 day
**Branch:** `s13/wire-active-days`

**Context:**
Three surfaces need the picker. We're wiring the shared `ActiveDaysPicker` component from S13-02 into each.

**A. Onboarding — Cue screen:**

The Cue screen already asks "when does this happen?" via the cue input. Active days is a natural extension: "which days does this happen?" Place the picker *below* the formula card, above the guidance card.

Changes:
- `OnboardingDraft` type: add `activeDays: number[]` (default: `[1,2,3,4,5,6,7]`)
- `EMPTY_DRAFT`: add `activeDays: [1,2,3,4,5,6,7]`
- `KNOWN_DRAFT_KEYS`: add `"activeDays"`
- `CueScreen.tsx`: add `<ActiveDaysPicker>` below the formula card
- `completion.ts` → `finalizeOnboarding`: pass `serializeActiveDays(draft.activeDays)` to `createHabitRepo`

The picker defaults to all-7 selected, so for users who want daily, they just scroll past it. Zero friction added to the happy path.

**B. CreateHabitFlow — Build step:**

Add `<ActiveDaysPicker>` to the Build step, after the cue field. Wire to `CreateHabitDraft.activeDays` field (add to type, default `[1,2,3,4,5,6,7]`).

On submit, `serializeActiveDays(draft.activeDays)` is passed through `HabitSetupPayload` → `useCreateHabitMutation` → `createHabitRepo`.

Changes to `HabitSetupPayload`:
- Add `activeDays: number[]`

Changes to `useCreateHabitMutation`:
- Serialize `activeDays` to JSON string before calling repo

**C. EditHabitScreen:**

Add `<ActiveDaysPicker>` after the preferred time field. Initialize from `parseActiveDays(habit.active_days)`. On save, include `active_days: serializeActiveDays(activeDays)` in the update patch.

**Tests:**
- Onboarding: complete flow with weekdays selected → created habit has `active_days = '[1,2,3,4,5]'`
- Onboarding: complete flow with default (all 7) → `active_days = '[1,2,3,4,5,6,7]'`
- CreateHabitFlow: create with MWF → `active_days = '[1,3,5]'`
- EditHabitScreen: change from daily to weekdays → `active_days` updated
- Regression: existing create/edit flows still work with default active days

**Done means:** All three surfaces show the picker. Created and edited habits persist `active_days` correctly. Full suite green.

---

### S13-05: Today screen — off-day rendering

**Type:** UI
**Estimate:** 0.25 day
**Branch:** `s13/today-offday`

**Context:**
On an off-day, a habit shouldn't look "pending" — that contradicts the user's own schedule. But we also don't want to *hide* it entirely, because the user should still see their full habit system and be able to tap into detail.

**Behavior:**
- Habits where today is NOT an active day are rendered with an **off-day state:**
  - Circle: empty with dashed border (`borderStyle: 'dashed'`), muted color
  - Name: slightly reduced opacity (0.5)
  - Subtitle: shows "Off day" instead of the cue
  - Row is still tappable → navigates to Habit Detail
  - Circle is NOT tappable (no logging on off-days from Today — keep it clean)
- Habits where today IS an active day: unchanged behavior (pending/done/skipped states)
- Goal-level consistency donut: already handled by S13-03 (per-habit denominator respects active days)

**Implementation notes:**
- The Today screen's habit list already gets habits via query. Add `isActiveDay(today, parseActiveDays(habit.active_days))` check per habit.
- The `HabitRow` component gets a new `offDay?: boolean` prop that triggers the dimmed styling.

**Tests:**
- Snapshot/render test: habit with `active_days=[1,2,3,4,5]` on a Saturday renders off-day state
- Same habit on Monday renders normal pending state
- Off-day habit circle is not pressable
- Off-day habit row is still pressable (navigates to detail)

**Done means:** On a weekend, a weekday-only habit shows dimmed with "Off day" label. On a weekday, it renders normally.

---

### S13-06: Habit Detail screen redesign

**Type:** UI / Major refactor
**Estimate:** 1.5 days
**Branch:** `s13/habit-detail-redesign`

**Context:**
The current `HabitDetailScreen` is heavy — a tall scroll with separate cards for Setup, Heatmap (90-day grid), Today status, Progress, Recent History, and Suggestion cards. We're replacing it with a compact reflection surface: header, 30-day calendar grid, streak card, setup card, and reminder card (wired in S13-07).

**New Habit Detail screen structure (top to bottom):**

1. **Header area:**
   - Back chevron + goal label ("Become Physically Fit") — tapping navigates back
   - Habit icon (36px circle, surface bg) + habit name (17px, semi) + subtitle: schedule label + cue (e.g., "Weekdays · After Lunch")
   - ReadOnlyBanner (if applicable, same logic as current)

2. **30-day calendar card** (white card, 12px radius):
   - Header row: "Last 30 days" label (left) + "N of M active days" counter (right)
   - Day-of-week headers: M T W T F S S — off-day column headers get reduced opacity if habit isn't active that day
   - 7×5 grid (5 rows of 7 days):
     - Grid fills from bottom-right (today) backward. First row may have empty leading cells.
     - Cell states:
       - **Done:** sage fill (`colors.primary`), 6px radius
       - **Missed:** surface fill (`colors.surface` / `#f3f1eb`), 6px radius
       - **Skipped:** warm amber fill (`#d4a574`, 50% opacity), 6px radius
       - **Off-day:** transparent with dashed border (1px, `colors.textMuted` at 15% opacity)
       - **Today (pending):** sage border ring (2px solid `colors.primary`), no fill
       - **Future / empty:** transparent, no border
     - Tapping a cell opens RetroLogSelector (same as current behavior, but only for non-off-day cells within the retro window)
   - Legend row: Done / Missed / Skipped / Off day indicators

3. **Streak card** (white card, 12px radius):
   - Left: "Current streak" label + randomized streak copy (using existing `IdentityStreakDisplay` logic)
   - Right: gradient circle (36px, signature sage gradient) with streak number

4. **Setup card** (white card, 12px radius):
   - "Setup" label + edit icon (pencil) — tapping navigates to EditHabitScreen
   - Identity row (label + value)
   - Formula row (label + value)
   - Active days row (label + "Weekdays" / "Every day" / etc.)

5. **Reminder card** (white card, 12px radius) — placeholder wired in S13-07:
   - "Reminder" label + time display + toggle

6. **Archive action** — keep existing archive button at bottom, same logic

**What's removed vs current screen:**
- 90-day heatmap → replaced by 30-day 7×5 calendar grid
- "Today" card (today status) → removed (logging happens on Today screen)
- "Progress" card (streak, skip count, consistency as separate rows) → consolidated into streak card + calendar counter
- "Recent history" card (log list) → removed (calendar grid IS the history)
- "Suggested adjustment" cards → removed for now (reviews UI is deferred; engine stays, just not rendered)

**New component:** `src/components/CalendarGrid.tsx`

Props:
```tsx
type CalendarGridProps = {
  logs: HeatmapLog[];
  activeDays: number[];
  onCellPress?: (date: string) => void;
};
```

- Computes the 35-cell grid (5 weeks × 7 days), fills from today backward
- Maps each cell to its visual state based on log status + active day membership
- Day headers (M T W T F S S) with dimmed columns for off-days

The old `Heatmap` component is kept but unused after this ticket (cleanup candidate for followups).

**Tests:**
- CalendarGrid renders 35 cells (7×5)
- Correct day alignment: today lands in correct weekday column
- Off-day cells render with dashed border, not "missed"
- Tapping off-day cell does NOT open RetroLogSelector
- Tapping within-window active-day cell opens RetroLogSelector
- Streak card shows correct copy for streak = 0, 1, 5
- Setup card shows active days label
- Screen renders without crash for habit with no logs
- Screen renders correctly for habit with `active_days = '[1,2,3,4,5,6,7]'` (all days, no off-day cells)

**Done means:** Navigating to Habit Detail shows the new compact screen. Calendar grid renders correctly with off-days. Retro logging still works. Edit navigation still works. Archive still works. Full suite green.

---

### S13-07: Reminders — foundation + UI

**Type:** Feature / Full stack
**Estimate:** 1.5 days
**Branch:** `s13/reminders`

**Context:**
Per the original S13 spec. Reminders are local-only via `expo-notifications`. This ticket builds the data layer, scheduling logic, and the UI on Habit Detail.

**A. Data layer:**

Migration `006_reminders.sql` — `src/lib/db/migrations/006_reminders.ts`:
```sql
CREATE TABLE local_reminder_settings (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL UNIQUE,
  reminder_type TEXT NOT NULL DEFAULT 'none'
    CHECK (reminder_type IN ('none', 'backup', 'daily')),
  reminder_time TEXT,  -- HH:mm in device local time
  notification_id TEXT,  -- expo-notifications identifier for cancellation
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (habit_id) REFERENCES local_habits(id) ON DELETE CASCADE
);
```

Repository: `src/lib/db/repositories/reminders.ts`
- `getByHabitId(habitId): ReminderSettings | null`
- `upsert(input: UpsertReminderInput): ReminderSettings`
- `deleteByHabitId(habitId): void`

**B. Notification engine:** `src/features/reminders/notifications.ts`

- `requestPermission()` — wraps `expo-notifications` permission request
- `scheduleReminder(habitId, type, time, activeDays)`:
  - For each active day, schedule a weekly recurring notification at the specified time
  - For `backup` type: notification body includes a check — but since we can't conditionally fire scheduled notifications, backup reminders schedule normally and the notification handler checks if the habit is already logged. If logged, the notification is silently suppressed (cancel before it renders).
  - Stores `notification_id` (or multiple IDs for multi-day schedules) in `local_reminder_settings`
- `cancelReminder(habitId)` — cancels all scheduled notifications for this habit, clears `notification_id`
- `rescheduleAll()` — re-reads all `local_reminder_settings` with `type != 'none'` and reschedules. Called on app launch and timezone change.

**Active days integration:** `scheduleReminder` receives `activeDays: number[]` and only schedules notifications for those weekdays. When active days are changed in EditHabitScreen, reminder is rescheduled.

**C. Notification copy:** `src/features/reminders/copy.ts`
- Approved templates per requirements §14.4
- NO streak-loss language ("Your streak will break!")
- Examples: "Time for [habit name] — you've got this.", "Gentle nudge: [habit name] is waiting."
- Randomized selection per notification

**D. Permission pre-prompt:**
- Soft pre-prompt screen before iOS system dialog
- Shown once on first reminder enable attempt
- Calm copy: explains why notifications help, no pressure
- "Enable reminders" → triggers system permission → on grant, proceed to schedule
- "Not now" → returns to detail, reminder stays set to "none"
- Track `notifications.permission_prompted` in `local_user_preferences` to avoid repeat

**E. Habit Detail — Reminder card:**
Wire into the Habit Detail screen (S13-06):
- Card shows: reminder type label + time + toggle
- Tapping opens a bottom sheet or inline editor:
  - Type picker: None / Backup / Daily
  - Time picker (HH:mm wheel)
  - Save → schedules notification
- Disabling toggle → cancels notification, sets type to "none"

**F. Lifecycle hooks:**
- On habit archive → cancel reminder
- On habit delete → `ON DELETE CASCADE` handles DB; explicit `cancelReminder()` call for notification cleanup
- On active days change (EditHabitScreen) → reschedule reminder if one exists

**G. Frequency cap:**
One notification per habit per day, enforced by scheduling logic (one notification per weekday, not repeating within a day).

**Notification actions:**
- Snooze 1 hour → reschedules for now + 60min (one-time, doesn't affect recurring schedule)
- Disable for today → cancels today's instance, next occurrence fires normally

**Tests:**
- Backup reminder: habit already logged today → notification suppressed
- Backup reminder: habit not logged → notification fires
- Daily reminder fires regardless of log status
- Reminder only scheduled on active days (MWF habit → 3 weekly notifications, not 7)
- Snooze reschedules correctly
- Archive habit → reminder cancelled
- Active days change → reminder rescheduled with new days
- Permission pre-prompt shown only once
- Copy templates contain no streak-loss language

**Done means:** Enable a backup reminder at 12:30 PM on a weekday-only habit. When 12:30 arrives on a weekday and the habit isn't logged, notification fires with approved copy. On Saturday, no notification. Snooze works. Archiving cancels. Full suite green.

---

### S13-08: Sprint integration + cleanup

**Type:** Integration / QA
**Estimate:** 0.5 day
**Branch:** `s13/integration`

**Context:**
Final pass to verify all the pieces work together end-to-end and clean up any loose ends.

**Deliverables:**

1. **End-to-end walkthrough:**
   - Onboarding: create first habit with weekdays-only → lands on Today → habit shows normal state on weekday
   - Today on weekend: weekday-only habit shows off-day state
   - Habit Detail: calendar grid shows off-days correctly for last 30 days
   - CreateHabitFlow: add second habit with MWF schedule → Today renders both habits with correct states
   - EditHabitScreen: change active days → streak recalculates, reminder reschedules
   - Set reminder → notification fires on active day → snooze → fires again

2. **Regression checks:**
   - All-days habit (default): behavior identical to pre-S13. No visual changes, no calculation changes.
   - Existing streak tests pass
   - Onboarding without touching active days picker → daily habit created (default path unchanged)
   - Recovery modal still triggers correctly (2 consecutive misses on active days)

3. **Cleanup:**
   - Remove or mark as unused: old `Heatmap` component (if fully replaced by `CalendarGrid`). If any other screen still references it, keep it but add a TODO comment.
   - Update sprint plan status: S13 → Done
   - Write `sprint-13-followups.md` if any polish items surfaced

4. **Update PROJECT_BRAIN.md:**
   - S13 summary: active days (DB + all surfaces), Habit Detail redesign (7×5 calendar grid), reminders (local notifications)
   - S14 as "Up next"

**Done means:** Full end-to-end walkthrough passes on both iOS and Android. All automated tests green. No regressions. Sprint plan updated.

---

## Sprint plan update needed

When S13 starts, update `sprint-plan.md`:

1. **S13 description** — replace current reminders-only scope with expanded scope (active days + Habit Detail redesign + reminders)
2. **S13 estimate** — update from 3–4 days to 5–6 days
3. **S13 deliverables** — replace current deliverables list with the expanded set
4. **S13 risks** — add:
   - Sprint is larger than typical (5–6 days vs 2–3). Acceptable because features are tightly coupled and can't be cleanly split.
   - Active days touches many surfaces. Risk of cascading test failures — mitigated by foundation-first ticket ordering (migration → utility → engine → UI).
5. **"What testers get" section** — update to include:
   - Active days (schedule which days a habit applies, default daily)
   - Redesigned Habit Detail with 30-day calendar grid
   - Local reminders (backup + daily, per-habit time picker, snooze)

---

## Ticket dependency graph

```
S13-01 (migration + utilities)
  ├── S13-02 (ActiveDaysPicker component)
  │     └── S13-04 (wire into onboarding + create + edit)
  ├── S13-03 (streak engine + consistency)
  │     ├── S13-05 (Today off-day rendering)
  │     └── S13-06 (Habit Detail redesign)
  │           └── S13-07 (reminders — wires into detail screen)
  └── S13-08 (integration + cleanup) — depends on all above
```

Recommended execution order: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08

---

*End of Sprint 13 ticket package.*
