# Today screen ordering — design spec

**Date:** 2026-05-28
**Branch:** `claude/thirsty-albattani-8f5456`
**Status:** Design approved, awaiting implementation plan

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

Within each zone the sort key is identical:

| Rank | Key                                                             | Direction        |
|------|-----------------------------------------------------------------|------------------|
| 1    | Earliest `reminder_time` among the goal's habits (timed only)   | Ascending        |
| 2    | "Has any timed reminder?" — timed goals before untimed          | Timed first      |
| 3    | Earliest `created_at` among the goal's habits                   | Ascending (older first) |
| 4    | `identity_phrase` lexicographic                                 | Ascending (stability) |

**Definitions:**
- A habit's reminder is **timed** iff `reminder_type IN ('backup', 'daily')` AND
  `reminder_time IS NOT NULL`. `reminder_type = 'none'` and missing reminder rows are
  both treated as untimed.
- A goal's "earliest reminder" is the min `reminder_time` across its timed habits.
  Goals with **no** timed habits are untimed and fall to the bottom of their zone
  (rank 2 above).
- `reminder_time` is stored as `"HH:mm"`; ASCII string comparison happens to match
  numerical time-of-day for valid 24-hour values. We will sort as strings to avoid
  parsing.

### 2. Habit ordering (within a goal)

Two zones within each goal:

- **Action-needed zone** — habits where `todayStatus === null && !offDay`.
- **Resolved zone** — habits where `todayStatus !== null` (done or skipped) OR
  `offDay === true`. **Bundled together**; we do not separate skipped/done/off-day.

Within each zone the sort key is identical:

| Rank | Key             | Direction               |
|------|-----------------|-------------------------|
| 1    | `created_at`    | Ascending (older first) |
| 2    | `id`            | Ascending (stability)   |

The asymmetry between goal sort (reminder time) and habit sort (creation date) is
deliberate. The reminder time describes when a goal lives in the user's day; the
creation order describes the user's mental list of habits inside that goal.

### 3. Filtered-out habits

Habits with `identity_phrase IS NULL OR identity_phrase = ''` are filtered from the
Today view before grouping. This removes the existing `NO_GOAL_KEY` group entirely.

Implementation note: existing usages of `NO_GOAL_KEY` in `TodayScreen.tsx` and
`useTodayHabits()` should be reviewed — the constant may still be useful elsewhere
(e.g., goal detail), but the Today-screen branching that handles `NO_GOAL_KEY`
becomes unreachable and should be removed.

---

## Live re-sort

The list reorders **with animation** whenever a habit's `todayStatus` changes:

- Tap **Done** → habit's row leaves the action-needed zone and slides to the
  resolved zone of its goal. If it was the last actionable habit, the goal
  container then slides from the active zone to the done zone.
- Tap **Skip** → same as Done for ordering purposes.
- Tap **Undo** → reverses direction. If the goal was in the done zone and now has
  an action-needed habit again, the goal slides back to the active zone.

**Off-day status** is a function of today's calendar date and the habit's
`active_days`; it is computed once per Today render and never changes mid-session,
so it does not trigger live re-sorts.

**Reminder times** can be edited from the habit detail screen. When the user returns
to Today after editing a reminder, the new sort applies on next render. We do not
attempt to live-animate ordering changes caused by reminder edits (out of scope —
no user is editing reminders while staring at Today).

### Animation implementation

Use Reanimated 3's `LinearTransition` layout animation on both the goal container
component and the habit row component. The library is already a project
dependency. This avoids React Native's `LayoutAnimation` which is unreliable
inside `ScrollView`.

Sketch:

```tsx
import Animated, { LinearTransition } from "react-native-reanimated";

// In TodayScreen render:
{goalGroups.map((group) => (
  <Animated.View key={group.identityPhrase} layout={LinearTransition.duration(250)}>
    <GoalContainer ...>
      {group.habits.map((habit) => (
        <Animated.View key={habit.id} layout={LinearTransition.duration(250)}>
          <HabitRow habit={habit} ... />
        </Animated.View>
      ))}
    </GoalContainer>
  </Animated.View>
))}
```

The exact API and duration are implementation-plan-level decisions, not spec-level.

---

## Data sources needed

The current `useTodayHabits()` hook does not query the `local_reminder_settings`
table. Adding reminder-time-based ordering requires either:

- Extending `useTodayHabits` to join reminders for each eligible habit, **or**
- Adding a sibling query keyed on the eligible habit IDs and merging into the
  card data.

Either is fine — the implementation plan will choose. The shape exposed to the
Today screen needs at minimum:

- Per-habit `reminderTime: string | null` and `reminderType: ReminderType`.
- Per-goal-group `earliestReminderTime: string | null` (derived, not stored).
- Per-goal-group `oldestHabitCreatedAt: string` (derived).

These derived fields feed the goal-comparator.

## Affected files

- `src/features/today/hooks.ts` — `useTodayHabits()` needs reminder data + sort.
- `src/features/today/screens/TodayScreen.tsx` — `groupByIdentity()` becomes a
  full sorter; render wraps rows in `Animated.View`. The orphan group branching is
  removed.
- `src/features/today/types.ts` — `TodayHabitCardData` gains reminder fields.
- New helper module (suggested: `src/features/today/ordering.ts`) for the pure
  sort functions, keeping the hook lean and the rules testable in isolation.

## Tests

New unit tests for the pure sort module:

- Two goals, both active, both timed → earlier reminder first.
- Two goals, one timed one untimed → timed first.
- Two untimed goals → older habit first.
- One goal active, one goal done → active first regardless of reminder time.
- Habit zones within a goal — action-needed habits before resolved (done/skipped/off-day).
- Resolved zone is sorted by `created_at` ascending (does not segregate done vs.
  skipped vs. off-day).
- Stable tiebreaker by `id` on identical `created_at`.

Update `TodayScreen.integration.test.tsx`:
- Render with multiple goals + reminders and assert the rendered order.
- Tap Done on the last unfinished habit of an active goal and assert the goal
  moves to the done zone in the next render.
- Tap Undo and assert it returns.
- Render with a habit that has `identity_phrase = null` and assert it is not in
  the tree.

---

## Open questions

None at design time. Implementation-plan decisions (Reanimated API specifics,
where the reminder query lives, whether to introduce a dedicated `ordering.ts`
module vs. inlining the comparator) are deferred to the writing-plans step.

## Decision log

- **Action-first over stable order** — user wants visible nudge toward unfinished
  work; finished items get out of the way.
- **Live animated re-sort** — chosen over frozen-for-session and live-no-animation
  for polish, accepting that rows can move under the user's finger as the cost.
- **Time-of-day stable, not "next upcoming"** — predictable order across the
  whole day matters more than chasing the clock.
- **Earliest reminder defines a goal's slot** — anchor by the first thing you do
  that day, not the last.
- **Habit order is creation date, not reminder time** — within a goal the user
  thinks "habit 1, habit 2, habit 3", not "the 7am one then the 8am one."
- **Skipped, done, and off-day live in one resolved zone** — three states all
  mean "no action needed today"; bundling avoids over-engineering and keeps the
  visual hierarchy "active vs. resolved" rather than fragmented.
- **Orphan habits hidden, no migration** — creation flow already requires
  `identity_phrase`; an orphan would be a data anomaly. Filtering on read is
  enough; no UI surface for it.
