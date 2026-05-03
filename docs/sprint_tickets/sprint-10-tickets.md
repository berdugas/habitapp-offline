# Sprint 10 — Today screen redesign + goal architecture + beta build prep

> **Status:** Planned
> **Depends on:** S9 (merged)
> **Estimate:** 4–5 days
> **Branch:** `sprint-10` off `main`

---

## Goal

Implement the goal-based habit architecture (dissolving Focus/Supporting), rebuild the Today screen around the identity-anchored goal container, and prepare the app for beta distribution. This is the most important sprint in the project — it delivers the screen that testers will see every day.

## Context

Three major changes converge in this sprint:

1. **Architecture shift.** Focus/Supporting distinction dissolved. `habit_state` simplifies from `focus | supporting | automatic` to `active | automatic`. All habits under a goal are equal peers. Soft 3-per-goal cap replaces the 3-active hard cap. (Locked in design-direction.md rev 3, May 3 2026.)

2. **Today screen redesign.** The S8-era FocusCard layout (single-habit card with inline Done/Skip buttons and heatmap) is replaced by the goal container pattern: tonal surface wrapping identity anchor + consistency donut + white habits card with equal habit rows. (Locked in design-direction.md §Today screen redesign.)

3. **Beta build prep.** Internal QA pass, TestFlight build, tester logistics.

## S9 followup cleanup (opening pass)

Per convention: small tech-debt from prior sprints folded into the opening cleanup before main feature work.

- **F1 (Today populated multi-habit reskin)** — absorbed into this sprint's Today redesign; not a separate ticket.
- **F2 (Weekly Review screen reskin)** — OPEN #2 locked as "defer." Remove nav entry point so screen is unreachable. (Small ticket.)
- **F11 (Two pre-existing TodayScreen integration test failures)** — diagnose and fix the `initDb`/`closeDb` ordering issue. (Small ticket.)
- F3–F10 remain deferred per their documented trigger conditions.

---

## Tickets

### S10-01 — Dissolve Focus/Supporting in type system and contract

**What:** Update `habit_state` from `focus | supporting | automatic` to `active | automatic` across the type system, contract constants, and DB schema.

**Changes:**
- `src/features/habits/types.ts` — `HabitState` type becomes `'active' | 'automatic'`
- `src/lib/db/repositories/habits.ts` — same `HabitState` type update
- `src/features/habits/contract.ts`:
  - `HABIT_STATES` array becomes `['active', 'automatic']`
  - Remove `ACTIVE_FOCUS_LIMIT` and `ACTIVE_SUPPORTING_LIMIT` constants
  - Rename `ACTIVE_HABIT_CAP` to `ACTIVE_HABITS_PER_GOAL_SOFT_CAP` (value stays 3)
- `src/lib/db/migrations/` — add migration that updates existing rows: `UPDATE local_habits SET habit_state = 'active' WHERE habit_state IN ('focus', 'supporting')`
- `src/features/habits/validators.ts`:
  - Rewrite `assertCanCreateActiveHabit` to count active habits grouped by `identity_phrase` instead of by Focus/Supporting slots
  - Return a soft warning (not a hard block) when count ≥ 3 for a given identity phrase
  - `CapCheckResult` simplifies: `{ ok: true }` or `{ ok: false, reason: 'soft_cap_warning', count: number }`

**Tests:**
- Existing tests that reference `'focus'` or `'supporting'` updated to use `'active'`
- Migration test: rows with old states correctly migrate to `'active'`
- Cap check: 3 active habits under same identity_phrase → soft warning, 4th creation proceeds
- Cap check: 3 active habits under different identity_phrases → no warning (future multi-goal readiness)

**Branch:** `s10/dissolve-focus-supporting`

**Done means:** No references to `'focus'` or `'supporting'` remain in the codebase outside of migration history and test fixtures that verify the migration itself. All existing tests pass with updated states.

---

### S10-02 — Recovery hooks: remove Focus-only filter

**What:** `useRecoveryCheck` in `src/features/recovery/hooks.ts` currently filters for `habit_state === 'focus'` and only checks that one habit. Update it to check all active habits and trigger recovery for any habit with two consecutive misses.

**Changes:**
- `RecoveryHabitRef` type: remove `habit_state` field (no longer needed for filtering)
- `useRecoveryCheck` accepts an array of habit refs instead of a single one
- Returns which habit(s) triggered the break, so the modal can name the specific habit
- `RecoveryModal` copy updated: "**[Habit name]** lost some momentum" instead of assuming it's the Focus habit
- `TodayScreen` adapter: pass all active habits to `useRecoveryCheck`, not just `focusHabit`

**Tests:**
- Recovery triggers for any habit with 2 consecutive misses
- Recovery does NOT trigger for habits with 1 isolated miss
- Multiple habits in recovery simultaneously: modal shows for the first one, dismissing reveals the next

**Branch:** `s10/recovery-all-habits`

---

### S10-03 — Today screen: goal container + identity anchor + donut

**What:** Rebuild `TodayScreen` with the new layout structure. This is the largest ticket in the sprint.

**Changes:**
- Replace `SubtleDateHeader` with the quiet header: AppLogo (top-left) + date (top-right)
- Create `GoalContainer` component: tonal surface (`#f3f1eb`, border-radius 20px) wrapping:
  - Identity anchor: becoming phrase (21px, weight 500) on the left
  - Consistency donut (48px SVG) on the right — average consistency across all habits in the goal
  - Identity streak copy below the becoming phrase, sage color
  - White habits card nested inside (border-radius 14px)
- Create `ConsistencyDonut` component: 48px SVG ring, sage gradient stroke, percentage text centered, "Consistency" label below
- Consistency calculation: average of `done / (done + missed)` across all habits in the goal, skipped excluded, last 30 days
- Group habits by `identity_phrase` (for beta, all habits share one identity phrase from onboarding — multi-goal grouping works architecturally but only one group renders)
- Remove the old `FocusCard` component entirely
- Remove heatmap from Today (stays on HabitDetail only)
- Remove `useHabitLogsForRange(habit.id, 30)` call from Today (was feeding the heatmap)

**Branch:** `s10/today-goal-container`

---

### S10-04 — Habit row component + interactions

**What:** Create the `HabitRow` component that renders inside the goal container's habits card. All habits rendered equally.

**Changes:**
- Create `HabitRow` component:
  - 38px circle (2px sage border when pending, sage gradient fill + white checkmark when done)
  - Lucide SVG icon (from `habit.icon` field, fallback to `Sparkles` if null)
  - Habit name (15px, weight 500)
  - Cue text below name (12px, muted)
  - Chevron right
  - Done state: filled circle + strikethrough name + opacity 0.55
- Tap circle = log Done (calls `useUpsertTodayHabitStatusMutation`)
- Long-press circle = log Skip (with brief haptic feedback)
- Tap row (outside circle) = navigate to habit detail screen
- "Long-press circle to skip" hint text below the habits card
- Rows separated by 0.5px `#f3f1eb` dividers
- Install `lucide-react-native` if not already present; render icon by name from habit's `icon` field

**Tests:**
- Tap circle logs Done, circle fills with gradient
- Long-press logs Skip
- Tap row navigates to detail
- Done state renders strikethrough + reduced opacity
- Missing icon field falls back to Sparkles

**Branch:** `s10/habit-row`

---

### S10-05 — Post-completion state + MissBanner wiring

**What:** Wire the completion and miss states into the new Today layout.

**Changes:**
- When all habits in the goal are logged (done or skipped), show "You showed up today." in muted text below the goal container
- Replace inline miss banner `View` with `<MissBanner>` atom from S9
- MissBanner triggers for any habit with a miss yesterday (not Focus-only)
- `useSingleMissBanner` hook updated: accept array of habits, return banner for the first habit with a single miss
- MissBanner placed inside the goal container, above the habits card
- Dismissing the banner persists dismissal per-habit per-date (existing preference key pattern)

**Tests:**
- All habits done → "You showed up today." appears
- 2 of 3 done → message does not appear
- Yesterday miss on any habit → MissBanner shows with correct copy
- Dismissing banner persists across app relaunch

**Branch:** `s10/completion-miss-states`

---

### S10-06 — Gate Weekly Review screen + fix TodayScreen test failures

**What:** Cleanup pass for two deferred items.

**Changes:**
- Remove or gate the nav entry point to `WeeklyReviewScreen` so it's unreachable from Settings/Library (S9-F2)
- Diagnose and fix the 2 pre-existing `TodayScreen.integration.test.tsx` failures (S9-F11) — likely `initDb`/`closeDb` ordering in test harness
- Remove `latestReviewQueries` block from `useTodayHabits` if it hasn't been cleaned up yet (dead code since S5, blocks nothing)

**Tests:**
- Verify no navigation path reaches WeeklyReviewScreen
- 2 previously-failing integration tests now pass consistently

**Branch:** `s10/cleanup-gate-reviews`

---

### S10-07 — Internal QA + beta build prep

**What:** Manual QA pass and build logistics. Not a code ticket — a process checklist.

**Steps:**
- Run full test suite, all green
- Manual QA against requirements §24.1 (onboarding), §24.2 (Today), §24.3 (logging), §24.4 (streak), §24.5 (heatmap on detail), §24.6 (recovery), §24.12 (trial validation)
- Test on both iOS Simulator and Android Emulator
- Fix bugs found during QA (budget 0.5–1 day)
- Build TestFlight (iOS) — upload to App Store Connect Internal Testing
- Build Internal Testing track (Android) — upload to Play Console
- Finalize tester invitation list (25–50 psychographic matches)
- Set up feedback channel (form, email, or Discord)
- Draft welcome message explaining what beta includes and doesn't include

**Done means:** First internal tester opens the app, completes onboarding, and successfully logs a habit on the new Today screen.

**Branch:** No branch — QA runs on the sprint-10 integration branch.

---

## Definition of done

All of the following must be true before `sprint-10` merges to `main`:

1. No references to `'focus'` or `'supporting'` in production code (migration history and migration-test fixtures excepted)
2. Today screen renders the goal container with identity anchor + donut + habit rows
3. All habits render as equal rows — no visual distinction between former Focus/Supporting
4. Tap circle = Done, long-press circle = Skip, tap row = detail — all working
5. Consistency donut shows average across all habits in the goal
6. MissBanner uses the `<MissBanner>` atom, triggers for any habit
7. Recovery modal triggers for any habit with 2 consecutive misses
8. "You showed up today." appears when all habits are logged
9. Weekly Review screen is unreachable
10. Full test suite green (including the 2 previously-failing integration tests)
11. Manual QA pass complete on iOS + Android
12. TestFlight build uploaded

**Note:** Icon picker for Create/Edit Habit moved to S12 (habit creation sprint). Habits created through onboarding already have icons via the LucideIconPicker. Habits without an icon render with the Sparkles fallback in HabitRow until S12 ships.

## Risks

- **This is a large sprint (4–5 days).** The architecture change + screen rebuild + QA is genuinely a lot. Mitigation: tickets are ordered so that S10-01 (type system) and S10-02 (recovery) can merge early, and S10-03/04 (the big visual work) build on a stable foundation.
- **The Focus/Supporting dissolution touches many files.** Every test that creates a habit with `habit_state: 'focus'` needs updating. Mitigation: S10-01 is a focused find-and-replace sprint that lands first, so the rest of the sprint works against clean types.
- **Long-press for Skip is a new interaction pattern.** Users may not discover it. Mitigation: the "Long-press circle to skip" hint text is always visible. If beta feedback says it's too hidden, we can add a brief tooltip on first launch.
- **Consistency donut math across multiple habits is new logic.** Mitigation: unit tests covering 1-habit, 2-habit, 3-habit scenarios with mixed log histories.

---

*End of S10 scope. Ticket package ready for implementation.*
