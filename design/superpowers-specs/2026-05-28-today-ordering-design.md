# Today screen ordering — design spec

**Date:** 2026-05-28
**Branch:** `claude/thirsty-albattani-8f5456`
**Status:** Design approved, implementation in progress

---

## Problem

The Today screen currently lists goals and habits in implicit order: habits arrive from
the DB as `created_at DESC` (newest first), and `groupByIdentity` in
[src/features/today/screens/TodayScreen.tsx:54-66](src/features/today/screens/TodayScreen.tsx:54)
preserves that traversal order. The result:

- The goal whose most-recent habit was created last appears first.
- Within a goal, habits appear newest-first.
- Done, skipped, and off-day habits stay wherever they were originally placed.

This is not the order users expect. The desired behavior is an **action-first**
ordering where goals and habits needing today's action surface at the top, and
finished items sink. Order should reflect the user's day rhythm via reminder times
at the goal level, and the user's mental list at the habit level.

## Goals

1. Goals with action remaining today float to the top; fully-resolved goals sink.
2. Active goals sort by their earliest habit reminder time (time-of-day order,
   stable across the day).
3. Within a goal, habits sort by creation order (oldest at top), with done /
   skipped / off-day habits sunk to the bottom.
4. State changes (Done, Skip, Undo) trigger a live, animated reorder.
5. Orphan habits (no `identity_phrase`) are filtered out of Today as defensive cleanup.

## Non-goals

- No drag-to-reorder UI for goals or habits.
- No per-user persisted custom order.
- No change to which habits are eligible for Today (still
  `status = "active"` and `start_date <= today`).
- No change to graduation, recovery, or weekly-review behavior — only display order.
- No migration of existing orphan habits; they are silently hidden on Today.

---

## Ordering rules

### 1. Goal ordering (the goal containers)

Two zones, top to bottom:

- **Active zone** — goals where at least one habit still needs action today.
- **Done zone** — goals where every habit today is `done`, `skipped`, or off-day.

A goal is **active** iff `goal.habits.some(h => h.todayStatus === null && !h.offDay)`.
This matches the existing `remainingCount > 0` computation in
[TodayScreen.tsx:281](src/features/today/screens/TodayScreen.tsx:281).

Goal comparator (applied within the active zone, and again within the done zone):

1. **Timed goals first.** A goal is timed iff it has at least one habit with
   `reminderTime !== null`. Timed goals precede untimed goals.
2. **Among timed goals:** ascending `earliestReminderTime`
   (`"07:30" < "12:00" < "19:00"` — see ASCII compare note below).
3. **Among untimed goals:** ascending `oldestHabitCreatedAt`.
4. **Stability tiebreaker (both groups):** ascending `identity_phrase`
   lexicographic.

The zone selection is the outer key: active zone always precedes done zone,
regardless of any of the above.

**Definitions:**
- A habit's reminder is **timed** iff `reminder_type IN ('backup', 'daily')` AND
  `reminder_time IS NOT NULL`. `reminder_type = 'none'` and missing reminder rows
  are both treated as untimed.
- A goal's "earliest reminder" is the min `reminder_time` across its timed
  habits. Goals with **no** timed habits are untimed and fall to the bottom of
  their zone (timed-first rank above).
- **ASCII compare note:** `reminder_time` is stored as `"HH:mm"` with both
  hours and minutes zero-padded (verified at the picker level in
  [src/components/forms/ReminderPicker.tsx:85](src/components/forms/ReminderPicker.tsx:85)
  and [src/features/onboarding/screens/ScheduleScreen.tsx](src/features/onboarding/screens/ScheduleScreen.tsx)).
  ASCII string comparison therefore matches numerical time-of-day order, no
  parsing required.

### 2. Habit ordering (within a goal)

Two zones within each goal:

- **Action-needed zone** — habits where `todayStatus === null && !offDay`.
- **Resolved zone** — habits where `todayStatus !== null` (done or skipped) OR
  `offDay === true`. **Bundled together**; we do not separate skipped/done/off-day.

Within each zone the sort key is identical:

| Rank | Key             | Direction               |
|------|-----------------|-------------------------|
| 1    | `createdAt`     | Ascending (older first) |
| 2    | `id`            | Ascending (stability)   |

The asymmetry between goal sort (reminder time) and habit sort (creation date) is
deliberate. The reminder time describes when a goal lives in the user's day; the
creation order describes the user's mental list of habits inside that goal.

### 3. Filtered-out habits

Habits with `identity_phrase IS NULL OR identity_phrase = ''` are filtered from
the Today view before grouping. This removes the existing `NO_GOAL_KEY` group
entirely from the Today surface.

The orphan filter lives in `useTodayHabits()` at the hook boundary, before
grouping. With the filter in place, the following sites are dead code and must
be removed in the same change:

- `src/features/today/hooks.ts:42` — `NO_GOAL_KEY` import.
- `src/features/today/hooks.ts:130` — `habitsByIdentity` key fallback.
- `src/features/today/hooks.ts:163` — `allActiveByIdentity` key fallback (also
  includes upcoming habits — upcoming-habit orphans are filtered by the same
  boundary).
- `src/features/today/hooks.ts:171` — `goalGraduatedByIdentity` guard.
- `src/features/today/hooks.ts:178` — `reviewIdentityKeys` filter (becomes a
  no-op).
- `src/features/today/screens/TodayScreen.tsx:39` — import.
- `src/features/today/screens/TodayScreen.tsx:57` — `groupByIdentity` fallback
  (the whole `groupByIdentity` function disappears — see "Sort owner" below).
- `src/features/today/screens/TodayScreen.tsx:265, 288, 294, 303, 307` — five
  `!== NO_GOAL_KEY` guards.

The constant itself in `src/features/today/constants.ts:3` may remain if any
feature outside Today still references it (none found at review time).
Otherwise delete.

---

## Live re-sort

The list reorders **with animation** whenever a habit's `todayStatus` changes:

- Tap **Done** → habit's row leaves the action-needed zone and slides to the
  resolved zone of its goal. If it was the last actionable habit, the goal
  container then slides from the active zone to the done zone.
- Tap **Skip** → same as Done for ordering purposes.
- Tap **Undo** → reverses direction. If the goal was in the done zone and now
  has an action-needed habit again, the goal slides back to the active zone.

**Off-day status** is a function of today's calendar date and the habit's
`active_days`; it is computed once per Today render and never changes
mid-session, so it does not trigger live re-sorts.

A goal's slot uses the current reminder time, not a frozen-at-start-of-day
value. If the user opens a habit and changes its reminder time, the next return
to Today re-sorts accordingly. We do not animate this re-sort — animation is
reserved for Done/Skip/Undo on Today itself.

A goal whose only habits are off-day today is treated as resolved (every habit
`offDay === true` means the goal has no action needed) and sorts into the done
zone. Visual treatment of an "all off-day" goal is unchanged in this change.

### Animation implementation

Use React Native's built-in `LayoutAnimation` for the live re-sort animation.
The library ships in core; no new dependency.

Pattern: call `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)`
synchronously inside the tap handler (`handleStatusPress`, `handleUndo`)
**before** awaiting the mutation. `configureNext` schedules the *next* layout
transaction to animate; the next layout pass is the post-mutation re-render
that picks up the new card status.

**Scoping caveat:** `configureNext` is a process-wide React Native call, not
screen-scoped. If the user navigates away from Today between tap and mutation
resolution, the next layout pass on the navigated-to screen is the one that
animates. In practice mutations resolve in tens of milliseconds and
mid-mutation navigation is rare, so the cross-screen bleed is an acceptable v1
risk and is documented here rather than mitigated. (Mount-aware gating via a
`useRef` is the future polish path if real users hit it.)

**Error-path caveat:** `configureNext` also stays armed if the mutation
throws. The next layout pass becomes the `<ErrorState>` swap in `TodayScreen.tsx`
(the upsert-mutation-error branch around line 258), so a failed Done tap
animates the error banner sliding in. Mild and accepted as v1.

**New Architecture (Fabric) note:** the project runs with `newArchEnabled: true`
(verified in `app.config.js`). `UIManager.setLayoutAnimationEnabledExperimental(true)`
is deprecated under Fabric and effectively a no-op there — Fabric enables
layout animations by default. The call is added in `app/_layout.tsx`
regardless: harmless on Fabric, correct on Paper. The smoke test runs on the
Fabric-enabled emulator build.

Reanimated remains a possible future polish path, separate from this change.

---

## Sort owner

Sorting lives in a new pure module `src/features/today/ordering.ts`.
`useTodayHabits()` calls it with the merged habit + reminder rows and returns
groups already in display order. `groupByIdentity()` in `TodayScreen.tsx` is
deleted; the screen just maps over `groups` as received.

## Data sources needed

Per-habit additions to `TodayHabitCardData` (`src/features/today/types.ts`):
- `createdAt: string` — needed for habit-level sort within a goal.
- `reminderTime: string | null` — null when the habit has no reminder row OR
  when `reminder_type = 'none'`.
- `reminderType: ReminderType` — exposed for any future use; sort treats
  `'none'` identically to a missing row.

Per-goal-group derived (computed inside the ordering module, not stored):
- `earliestReminderTime: string | null` — `min(reminderTime)` over **all**
  habits in the goal (action-needed, done, skipped, and off-day alike) where
  `reminderTime !== null`. Computing this over all habits — not just
  action-needed ones — keeps a goal's slot in the active zone stable as
  individual habits complete during the day.
- `oldestHabitCreatedAt: string` — `min(createdAt)` over all habits in the
  goal.

### Reminder fetch + edit invalidation

Reminders are not held in React Query today. They are read directly from
SQLite via `src/lib/db/repositories/reminders.ts`. To make reminder data feed
the Today sort, `useTodayHabits()` adds a **sibling React Query** for
reminders, keyed as a prefix-extension of the eligible-habits key.

Specifically: the sibling key is
```
[...getEligibleHabitsQueryKey(userId, todayDate), "reminders"]
// → ["habits", "eligible", userId, todayDate, "reminders"]
```
Because React Query's `invalidateQueries` is prefix-matching by default, every
existing invalidation of `getEligibleHabitsQueryKey(userId, todayDate)` (via
`invalidateHabitSurfaceQueries` in `src/features/habits/hooks.ts`)
automatically invalidates the reminders sibling. No new invalidation wiring is
needed for the create/archive/restore/edit-habit flows that already touch the
surface helper.

There is one race the existing flow does not cover: `EditHabitScreen.handleSave()`
calls `await updateHabitMutation.mutateAsync()` *first* (which triggers
`invalidateHabitSurfaceQueries`), and only *then* calls `scheduleReminder` /
`cancelReminder` for the new reminder. The invalidation fires before the
reminder DB row is written. In the practical user flow (Edit → back to Today →
focus refetch) this works out because Today is unmounted during the edit and
refetches on remount after the reminder write completes. But it is fragile if
Today is ever mounted alongside Edit. The implementation adds a small explicit
invalidation at the end of `handleSave()`, after the reminder block, to close
this race. (Out of scope: refactoring the order of operations in `handleSave`.)

The merge happens inside `useTodayHabits`. Reminders are merged into the
per-habit card shape by `habit_id`. The repo helper is the existing
`listRemindersForUser(userId)` ([src/lib/db/repositories/reminders.ts:75](src/lib/db/repositories/reminders.ts:75))
— cheap, user-scoped, simpler than per-habit-id queries. Client-side filtering
to eligible habit IDs happens during the merge.

## Affected files

- `src/features/today/types.ts` — three new card fields.
- `src/features/today/hooks.ts` — sibling reminders query, merge, call
  ordering module, `NO_GOAL_KEY` removals.
- `src/features/today/screens/TodayScreen.tsx` — delete local `groupByIdentity`,
  drop `NO_GOAL_KEY` guards, render `groups` as received,
  `LayoutAnimation.configureNext` in tap handlers.
- **New:** `src/features/today/ordering.ts` — pure sort module.
- `src/lib/db/repositories/reminders.ts` — reuse `listRemindersForUser`.
- `app/_layout.tsx` — Android `setLayoutAnimationEnabledExperimental` shim.
- `src/features/habits/screens/EditHabitScreen.tsx` — append explicit
  `invalidateQueries({ queryKey: ["habits", "eligible"] })` at end of `handleSave`.

The Today screen uses `ScrollView`, not `FlatList`. We do not migrate to
`FlatList` as part of this change. Real-user goal counts are small; revisit
only if perf complaints surface.

## Tests

Three Today-related test files exist:

- `src/features/today/__tests__/TodayScreen.integration.test.tsx` — integration
  via real SQLite + `createHabit`. Add scenarios for multi-goal ordering,
  reminder-time sort, Done/Skip/Undo zone transitions, orphan filter, and a
  prefix-invalidation contract test (seed habit + reminder via repo, mount
  TodayScreen, mutate reminder row via repo, fire
  `queryClient.invalidateQueries({ queryKey: ["habits", "eligible"] })`,
  assert goal order shifts).
- `src/features/today/__tests__/TodayScreen.test.tsx` — hook-mocked. Update
  the mock factory to include `createdAt`, `reminderTime`, `reminderType` on
  every habit object. For reorder-related tests, set **deterministic**
  `createdAt` ISO strings and varied `reminderTime` values.
- `src/tests/screen/TodayScreen.test.tsx` — legacy duplicate. **Delete in
  this change**, after porting its three unique tests (loading state,
  empty-state CTA route, status-write lock guard) into the modern file.

Plus the new pure-function test file `src/features/today/__tests__/ordering.test.ts`
covering every comparator branch (multi-goal active/done split,
timed-before-untimed, created_at tiebreaker, id stability tiebreaker,
habit-zone split, resolved-zone composition).

---

## Open questions

None at design time.

## Decision log

- **Action-first over stable order** — user wants visible nudge toward
  unfinished work; finished items get out of the way.
- **Live animated re-sort** — chosen over frozen-for-session and
  live-no-animation for polish, accepting that rows can move under the user's
  finger as the cost.
- **`LayoutAnimation` over Reanimated** — Reanimated is not a project
  dependency; adding it costs a native dep, Babel plugin, Jest mock, and a
  fresh prebuild before the next tester drop. `LayoutAnimation` ships in core
  and is adequate for a short Today list.
- **Time-of-day stable, not "next upcoming"** — predictable order across the
  whole day matters more than chasing the clock.
- **Earliest reminder defines a goal's slot** — anchor by the first thing you
  do that day, not the last. Computed over all habits in the goal (not just
  action-needed) so the slot stays stable as habits complete.
- **Habit order is creation date, not reminder time** — within a goal the user
  thinks "habit 1, habit 2, habit 3", not "the 7am one then the 8am one."
- **Skipped, done, and off-day live in one resolved zone** — three states all
  mean "no action needed today"; bundling avoids over-engineering and keeps the
  visual hierarchy "active vs. resolved" rather than fragmented.
- **Orphan habits hidden, no migration** — creation flow already requires
  `identity_phrase`; an orphan would be a data anomaly. Filtering on read is
  enough; no UI surface for it.
- **Merge reminders into sibling query keyed as prefix-extension** —
  piggybacks on existing prefix-matching invalidation of the eligible-habits
  key so no call-site changes are needed in
  `invalidateHabitSurfaceQueries`-touching flows.
