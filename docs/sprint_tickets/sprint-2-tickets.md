# Sprint 2 — Dev Team Tickets

> **Status:** Ready for assignment.
> **Date:** April 29, 2026
> **Owner:** Tech Lead → Dev Team
> **Companion documents:** `sprint-plan.md` (S2 definition), `tech-handoff-core-v1.md` (architecture), `core-v1-requirements.md` (product behavior, especially §7 logging and §8 streak rules), `sprint-1-tickets.md` + `sprint-1-followups.md` (the layer this builds on)

S2 is the sprint where the app starts working again on top of SQLite. Nothing user-visible changes — by the end, screens still render, but the engine underneath is new: habit reads/writes go through the repositories from S1, the streak rule is forgiving instead of strict, and retroactive logging is bounded by a 48-hour window enforced locally.

This is the highest-risk sprint in Phase A. The risk is in two places: the **forgiving streak's skipped-day rule** (requirements §8.3), and the **type cascade** that flows from renaming the habit-row fields. Tickets are sequenced so each finishes in a clean state.

---

## 0. Shared context — read before picking up a ticket

### Branching for this sprint

Per `sprint-plan.md` §8.5, every sprint runs on its own integration branch. **Before any ticket below starts**, cut the sprint branch off `main`:

```bash
git checkout main && git pull
git checkout -b sprint-2
git push -u origin sprint-2
```

Every ticket below branches off `sprint-2` and PRs back into `sprint-2`, not `main`. The `Branch suggestion` line on each ticket (e.g. `s2/types-migration`) is the ticket branch, cut from `sprint-2`:

```bash
git checkout sprint-2 && git pull
git checkout -b s2/types-migration
# ... do the work ...
# Open PR: s2/types-migration → sprint-2
```

When all six tickets are merged into `sprint-2` and the Definition of S2 done is met, open one final PR: `sprint-2` → `main`. Do not open ticket PRs against `main` directly.

### What's already done

S1 shipped the local DB rails. By the time your S2 code runs:

- `getDb()` returns an open SQLite connection with foreign keys on and migration `001_initial` applied.
- Three repositories are live: `habits.ts`, `habit_logs.ts`, `preferences.ts` in `src/lib/db/repositories/`.
- DEV-S1-05 polish is merged: `updateHabit` ignores explicit `undefined`, `listHabits` orders by `created_at DESC`, `deleteHabit`/`deleteLog` return booleans, `archiveHabit` is idempotent.
- Jest can talk to SQLite via `better-sqlite3` through `src/tests/setup/sqliteTestAdapter.ts`. Tests that need a DB call `await createTestDb()` in `beforeEach`.

You should not need to add any new repository functions in S2. If you find yourself wanting to, that's a signal to step back and check whether the new function belongs in the feature module instead.

### What the existing code looks like — and what's about to change

The current `src/features/habits/api.ts` is a thin wrapper over Supabase. It uses the old habit row shape:

```
name, identity_statement, stack_trigger, tiny_action, preferred_time_window,
reminder_enabled, reminder_time, start_date, is_active, ...
```

The new shape — already implemented in `repositories/habits.ts` — is:

```
title, identity_phrase, cue, tiny_action, minimum_viable_action,
preferred_time_window, habit_state, status, start_date, ...
```

Field-by-field translation:

| Old | New |
|---|---|
| `name` | `title` |
| `identity_statement` | `identity_phrase` |
| `stack_trigger` | `cue` |
| `tiny_action` | `tiny_action` (unchanged) |
| `preferred_time_window` | `preferred_time_window` (unchanged) |
| `reminder_enabled` + `reminder_time` | **moved out** — go to `local_reminder_settings` (S15) |
| `is_active` (boolean) | `status` (`active`/`archived`/`backlog`) |
| (none) | `habit_state` (`focus`/`supporting`/`automatic`) |
| (none) | `minimum_viable_action` |

**Reminder fields are not in S2.** The `local_reminder_settings` table doesn't exist yet (S15 migration adds it) and the `reminders` feature module doesn't exist either. We drop reminder fields from `HabitSetupPayload` entirely and the screens that referenced them will lose those inputs. They'll come back wired correctly in S15-S16.

### What's expected to break — and what's not

- The app's existing screens (Today, HabitDetail, CreateHabit, EditHabit) read fields like `habit.name` or `habit.is_active`. After DEV-S2-01 lands, those references are TypeScript errors. **Fixing them is in DEV-S2-06**, not in 01-05.
- The existing tests in `src/tests/unit/` that mock Supabase and test the old `api.ts` shape (`habitApi.test.ts`, `habitDetailApi.test.ts`, `habitLogsApi.test.ts`, `habitUpdateApi.test.ts`, `habitUpdateHooks.test.ts`, `habitDetailHooks.test.ts`, `todayHooks.test.ts`) will break or become meaningless when 04 lands. **They get deleted in DEV-S2-06.**
- `npx tsc --noEmit` and `npm test` will be red between tickets. That is expected. Each ticket leaves its *own* slice green; the full repo only goes green again at the end of DEV-S2-06.

If a screen crashes during a manual smoke test before DEV-S2-06 is merged, that's expected.

### Conventions reminder (carried from S1)

These are the same patterns from `sprint-1-tickets.md` §0. Quick refresher:

1. **`getDb()` is the only DB access path.** Feature modules go through repositories.
2. **Repositories never expose SQL.** Don't inline raw queries in `features/`. If you need a query that doesn't exist, ask whether it really belongs in a feature module or in a repo extension (and remember: S2 should not need a new repo function).
3. **Timestamps are ISO strings.** `new Date().toISOString()` — but in S2 prefer the new clock module (DEV-S2-02) so tests can deterministically advance time.
4. **`log_date` is `YYYY-MM-DD` device-local.** `toDeviceDateString()` and friends in `src/utils/dates.ts`.
5. **IDs are `crypto.randomUUID()`** — repositories already do this; feature code doesn't generate IDs, it lets the repo do it.
6. **Errors propagate.** Repositories don't swallow; the API layer surfaces friendly errors, but doesn't hide root causes from the logger.
7. **Habit rules are product rules, not security rules** (per `PROJECT_BRAIN.md` §12). The 48-hour window, the streak rule, and the 3-active cap are enforced in the client. The server does not validate them.

### Path aliases

`@/*` maps to `src/*`. Same as S1.

### Sequencing

```
DEV-S2-01  Type & contract migration         (foundation)
DEV-S2-02  Testable clock module             (independent, tiny)
   │           │
   │           ├──> DEV-S2-03  Forgiving streak (tests-first)
   │
   └────┬──────┘
        │
        v
DEV-S2-04  Habits API rewrite + 48h + integration test
        │
        v
DEV-S2-05  Validators + 3-active cap
        │
        v
DEV-S2-06  Cascade fixes + test cleanup       (final cleanup)
```

DEV-S2-01 and DEV-S2-02 can run fully in parallel by two devs. DEV-S2-03 needs only DEV-S2-02 (it's purely about progress.ts + its test). DEV-S2-04 needs both 01 and 02. DEV-S2-05 needs 04 (because the cap helper queries the repo via the new api shape). DEV-S2-06 sweeps up after the rest.

---

## DEV-S2-01 — Type & contract migration

**Estimate:** 0.5 day
**Depends on:** DEV-S1-05 (merged)
**Branch suggestion:** `s2/types-migration`

### Context

`src/features/habits/types.ts` currently re-exports Supabase database row types. Those types reference `public.habits` and `public.habit_logs`, which were dropped from the server in S0. The types still compile because the Supabase generated `Database` type still has them — but the shape no longer matches reality.

We're switching the feature-level types over to the SQLite repository types, then updating `contract.ts` so its documented invariants reflect the new architecture. This ticket is purely about types and constants. It does **not** touch `api.ts`, `validators.ts`, `progress.ts`, hooks, or screens — those come later.

When this ticket lands, `types.ts` and `contract.ts` will compile cleanly on their own. Code that imports `HabitRecord.name` from elsewhere will start failing TS checks. That's expected. DEV-S2-04, -05, and -06 fix the rest.

### Files to modify

```
src/features/habits/types.ts
src/features/habits/contract.ts
```

### Files to read first

```
src/lib/db/repositories/habits.ts          # source-of-truth for Habit, HabitState, HabitStatus
src/lib/db/repositories/habit_logs.ts      # source-of-truth for HabitLog, LogStatus
docs/core-v1-requirements.md §7-§8         # what the new contract documents
docs/tech-handoff-core-v1.md §4            # schema reference
```

### Required changes — `types.ts`

Replace the entire file. The new file:

- Re-exports `Habit`, `HabitState`, `HabitStatus`, `CreateHabitInput`, `UpdateHabitPatch` from `@/lib/db/repositories/habits`.
- Re-exports `HabitLog`, `LogStatus`, `UpsertLogInput` from `@/lib/db/repositories/habit_logs`.
- Defines the *feature-level* types — what the form layer and hooks layer pass around — separately from the DB row types.

```ts
import type {
  Habit,
  HabitState,
  HabitStatus,
} from "@/lib/db/repositories/habits";
import type { HabitLog, LogStatus } from "@/lib/db/repositories/habit_logs";

// Re-export DB row shapes so feature code doesn't have to reach into lib/db.
export type {
  Habit,
  HabitState,
  HabitStatus,
  HabitLog,
  LogStatus,
};

// Back-compat aliases. Existing call sites use HabitRecord/HabitLogRecord.
// These will be migrated away from in DEV-S2-06; the alias keeps the cascade
// minimal in this ticket.
export type HabitRecord = Habit;
export type HabitLogRecord = HabitLog;
export type HabitLogStatus = LogStatus;

// Form-layer shape. Used by CreateHabitScreen / EditHabitScreen.
// New fields: minimum_viable_action. Removed fields: reminderEnabled,
// reminderTime (moved out of the habit row to local_reminder_settings — S15).
export type HabitSetupPayload = {
  identityPhrase: string;
  title: string;
  cue: string;
  tinyAction: string;
  minimumViableAction: string;     // optional from user, but field is always present
  preferredTimeWindow: string;
};

export type CreateHabitPayload = HabitSetupPayload & {
  habitState: HabitState;          // 'focus' | 'supporting' | 'backlog-target'
};

export type UpsertHabitLogPayload = {
  habitId: string;
  logDate: string;
  note?: string | null;
  status: LogStatus;
};
```

Notes on the choices:

- `HabitRecord` / `HabitLogRecord` aliases are deliberate. They keep DEV-S2-01 small — downstream code that reads `HabitRecord` keeps compiling at the type level (field references will still error, but the import won't). DEV-S2-06 collapses the aliases.
- `HabitSetupPayload` uses camelCase because it's UI-layer. Repos use snake_case because that's the row shape. The translation between the two lives in `api.ts` (DEV-S2-04).
- `minimumViableAction` is mandatory in the type even though it's optional in the form. Validators will allow empty string and `api.ts` translates empty to null when writing to the DB. We keep it always-present in the type to avoid `string | undefined` polluting downstream code.
- No `reminderEnabled` / `reminderTime`. Don't add them back. If the dev is tempted, point at `tech-handoff-core-v1.md` §4.5 — that's where reminder data lives now.

### Required changes — `contract.ts`

The existing `PHASE_2A_*` constants document the *old* server-table contract. Replace them with constants that document the *new* local-DB contract. The shape and intent of the file stays the same: a single place that documents the rules so they can be referenced and tested.

```ts
import type {
  HabitState,
  HabitStatus,
  LogStatus,
} from "@/features/habits/types";

// Fields persisted on local_habits, in the order the schema declares them.
// Used by tests that round-trip rows through the repo.
export const LOCAL_HABIT_FIELDS = [
  "id",
  "user_id",
  "title",
  "identity_phrase",
  "cue",
  "tiny_action",
  "minimum_viable_action",
  "preferred_time_window",
  "habit_state",
  "status",
  "start_date",
  "created_at",
  "updated_at",
  "archived_at",
  "automated_at",
  "backlog_at",
] as const;

export const LOCAL_HABIT_LOG_FIELDS = [
  "id",
  "habit_id",
  "user_id",
  "log_date",
  "status",
  "note",
  "created_at",
  "updated_at",
] as const;

export const HABIT_STATES = [
  "focus",
  "supporting",
  "automatic",
] as const satisfies readonly HabitState[];

export const HABIT_STATUSES = [
  "active",
  "archived",
  "backlog",
] as const satisfies readonly HabitStatus[];

export const HABIT_LOG_STATUSES = [
  "done",
  "skipped",
  "missed",
] as const satisfies readonly LogStatus[];

export const HABIT_LOG_STATUS_LABELS: Record<LogStatus, string> = {
  done: "Done",
  skipped: "Skipped",
  missed: "Missed",
};

// Product rules — documented here so tests can assert against them.
export const FORGIVING_STREAK_RULES = {
  // "done" extends the streak; "skipped" is neutral; an isolated "missed"
  // is tolerated; two consecutive "missed" (after skipped removal) breaks it.
  doneIncrements: true,
  skippedIsNeutral: true,
  toleratesIsolatedMiss: true,
  breaksOnConsecutiveMisses: true,
  skippedRemovedBeforeMissEvaluation: true,
} as const;

export const RETRO_LOG_WINDOW_HOURS = 48 as const;

// Locked here so multiple feature modules can reference one number.
export const ACTIVE_HABIT_CAP = 3 as const;
export const ACTIVE_FOCUS_LIMIT = 1 as const;
export const ACTIVE_SUPPORTING_LIMIT = 2 as const;

// Logical day reminders.
export const LOGICAL_DAY_FORMAT = "YYYY-MM-DD";
export const LOGICAL_DAY_SOURCE = "device_local_day" as const;
```

Don't keep the `PHASE_2A_*` exports as aliases — delete them. Code that imported `PHASE_2A_HABIT_LOG_ON_CONFLICT` was using it for the Supabase upsert call, which is going away in DEV-S2-04. There is no value in preserving those names.

### Acceptance criteria

- `src/features/habits/types.ts` matches the structure above (file may be reorganized but the exports must exist with these names).
- `src/features/habits/contract.ts` matches the new constants. No `PHASE_2A_*` exports remain.
- `npx tsc --noEmit` passes when the import path `@/features/habits/types` and `@/features/habits/contract` is resolved in isolation. (You can verify by writing a one-line probe in `src/lib/db/_typeprobe.ts`: `import { Habit, ACTIVE_HABIT_CAP } from "@/features/habits/types"; ...` — delete the probe before merging.)
- The full repo's `tsc --noEmit` will fail elsewhere; that is expected and out of scope here.
- Existing tests in `src/lib/db/repositories/__tests__/` pass unchanged. (They import from the repo, not from features.)

### Out of scope

- `api.ts`, `hooks.ts`, `validators.ts`, `progress.ts`, screens — DO NOT TOUCH.
- Deleting the `HabitRecord` / `HabitLogRecord` aliases — that's DEV-S2-06.
- Removing the obsolete `aiRewriteApi.ts` / AI types — those stay. AI is gated off, not deleted.

### References

- `src/lib/db/repositories/habits.ts` — types being re-exported
- `docs/tech-handoff-core-v1.md` §4 — schema
- `docs/core-v1-requirements.md` §3, §7, §8 — the rules contract.ts now documents

---

## DEV-S2-02 — Testable clock module

**Estimate:** 0.25 day
**Depends on:** Nothing (can run in parallel with DEV-S2-01)
**Branch suggestion:** `s2/clock-module`

### Context

Two pieces of S2 logic depend on "what time is it now": the forgiving streak (DEV-S2-03 needs to walk backward from "today") and the 48-hour retroactive window in `upsertHabitLog` (DEV-S2-04). If both call `new Date()` directly, their tests are non-deterministic — the result depends on when CI runs. We extract a tiny clock module so both can be tested cleanly.

This ticket is small but architectural. It earns its own ticket because (a) it's a foundation other tickets rely on, (b) it has a security-flavored concern (test-only escape hatch must not leak into prod), and (c) sneaking it into DEV-S2-03 or DEV-S2-04 hides the decision.

### Files to create

```
src/utils/clock.ts
src/utils/__tests__/clock.test.ts
```

### Required exports

```ts
// src/utils/clock.ts

/**
 * Returns the current device-local time as a Date.
 *
 * Use this everywhere instead of `new Date()` in code that needs to be
 * testable against a fixed clock — streak math, 48-hour retro logging,
 * graduation eligibility, etc.
 *
 * Repositories already use `new Date().toISOString()` directly. That's
 * intentional — repository tests use in-memory DBs, and the timestamps
 * they write are not part of the assertions in S1 tests. We don't migrate
 * repositories to the clock in S2.
 */
export function now(): Date;

/**
 * Equivalent to `now().toISOString()`. Convenience for the common case.
 */
export function nowIso(): string;

/**
 * Equivalent to `toDeviceDateString(now())`. Convenience.
 */
export function todayDateString(): string;

/**
 * TEST-ONLY: replace the underlying clock with a fixed value or a
 * function-of-time. Throws in production builds.
 *
 * Usage in tests:
 *   beforeEach(() => setNowForTesting(new Date("2026-04-23T10:00:00")));
 *   afterEach(() => resetClockForTesting());
 */
export function setNowForTesting(value: Date | (() => Date)): void;

/**
 * TEST-ONLY: restore the default clock (real time). Throws in production.
 */
export function resetClockForTesting(): void;
```

### Implementation notes

- Hold the current provider in a module-level variable, default `() => new Date()`.
- `now()` and friends call the provider.
- `setNowForTesting` accepts either a Date (frozen time) or a `() => Date` (advancing time, e.g. for tests that step through midnight).
- Guard the test-only functions:

```ts
const isTest =
  process.env.NODE_ENV === "test" || (typeof __DEV__ !== "undefined" && __DEV__);

export function setNowForTesting(value: Date | (() => Date)): void {
  if (!isTest) {
    throw new Error(
      "setNowForTesting cannot be called outside of test or dev builds.",
    );
  }
  provider = typeof value === "function" ? value : () => new Date(value);
}
```

The `__DEV__` guard is for safety — even if a dev imports the test hook into a screen by mistake, it'll throw in release builds. Belt and suspenders.

### Test cases (clock.test.ts)

- `now()` returns a Date close to real time when no override is set (within a few ms tolerance).
- `setNowForTesting(new Date("2026-04-23"))` → `now()` returns that fixed date.
- `setNowForTesting(() => new Date(...))` → `now()` calls the function each time (verify by returning different values on successive calls).
- `resetClockForTesting()` restores real-time behavior.
- `todayDateString()` after `setNowForTesting(new Date("2026-04-23T23:59:00"))` returns `"2026-04-23"` (device-local, not UTC).
- The throw-in-production paths can be lightly tested by mocking `process.env.NODE_ENV`. If that's flaky in the test env, skip — the runtime guard is what matters.

### Acceptance criteria

- `src/utils/clock.ts` exports the four functions above.
- `clock.test.ts` covers each of the cases above.
- `npm test` passes for the new test file.
- TypeScript strict passes.
- No code outside `src/utils/clock.ts` and `src/utils/__tests__/clock.test.ts` is touched.

### Out of scope

- Migrating existing `new Date()` call sites to `now()` — the tickets that need the clock will migrate their own callers.
- Repository migration to the clock module — see "Implementation notes" above.

### References

- `src/utils/dates.ts` — existing date helpers; this clock complements them, doesn't replace them.

---

## DEV-S2-03 — Forgiving streak (tests-first)

**Estimate:** 1 day
**Depends on:** DEV-S2-02
**Branch suggestion:** `s2/forgiving-streak`

### Context

The forgiving streak is the trickiest piece of logic in Phase A. Per `core-v1-requirements.md` §8:

- A Done day extends the streak.
- A Skipped day is neutral — it neither extends nor breaks.
- An isolated Missed day (sandwiched by Done) is tolerated; the streak survives.
- Two consecutive Missed days break the streak.
- **§8.3:** Skipped days are removed from the sequence *before* evaluating consecutive misses. So `Done → Missed → Skipped → Missed → Done` becomes `Done → Missed → Missed → Done` after Skipped-removal — two consecutive misses, streak breaks.

The current `progress.ts` implements a strict rule (any non-Done breaks). It also computes `consistencyRate` and `skipCount` over a window — that part is correct and stays.

**This is the only S2 ticket where you write the tests first.** The skipped-day rule is subtle. If implementation leads, tests inherit the implementation's mistakes. So:

1. Write `progress.test.ts` covering every case below. Run them — they'll fail.
2. Then rewrite `progress.ts` until they pass.
3. Then read your `progress.ts` once more, looking for off-by-ones near sequence start and end.

### Files to modify / replace

```
src/features/today/progress.ts                      # rewrite the streak walk
src/tests/unit/todayProgress.test.ts                # rewrite from scratch
```

### Files to read first

```
docs/core-v1-requirements.md §8                     # the rules
docs/core-v1-requirements.md §10.2                  # consistency formula (unchanged)
src/utils/clock.ts                                  # use this for "today"
src/utils/dates.ts                                  # toDeviceDateString, addDeviceDays
```

### Behavior — `progress.ts` rewrite

`summarizeHabitProgress` keeps the same signature and return shape:

```ts
type SummarizeHabitProgressOptions = {
  endDate?: Date;          // defaults to clock.now()
  logs: HabitLogRecord[];
  windowDays: number;
};

type HabitProgressSummary = {
  consistencyRate: number;
  skipCount: number;
  streak: number;
  todayStatus: HabitLogRecord["status"] | null;
};
```

Behavior changes:

1. Default `endDate` to `now()` from the clock module instead of `new Date()`. Streak tests anchor to a fixed end date.
2. `consistencyRate` calculation is unchanged: `done / (done + missed)` over the window, skipped excluded from both numerator and denominator.
3. `skipCount` is unchanged.
4. `todayStatus` is unchanged.
5. **Streak walk is new.** Replace the existing `for (offset = 0; offset < windowDays; ...) { if not Done break; }` loop with the forgiving algorithm.

### Algorithm — the forgiving streak walk

Given a chronological-ascending sequence of `(date, status)` pairs covering up to `windowDays` days back from `endDate`, with at most one entry per date:

1. Starting from `endDate`, walk backward day by day. For each day in the range, look up its status:
   - If a log exists → use that status (`done` / `skipped` / `missed`).
   - If no log exists AND the day is *before* today → treat as `missed` (auto-missed days are not always logged in the test fixtures; whether the production app inserts them or not is a separate question we don't solve here — we infer from absence).
   - If no log exists AND the day *is* today → stop the walk; today doesn't count toward the streak yet (today's slot is "no decision" until logged).
2. Build the sequence backward into an ordered list, oldest-first or newest-first — pick one and document it. (Newest-first is more natural for the walk.)
3. **Remove all Skipped days** from the sequence.
4. Walk the cleaned sequence from the most recent entry backward:
   - If the most recent entry is `done` → streak count starts at 1 and we continue.
   - If the most recent entry is `missed` → streak is 0, return immediately.
   - On each subsequent entry: if `done`, increment and continue; if `missed`, look at the *next* entry (one further back):
     - If the next entry is also `missed` → we've hit two consecutive misses, stop.
     - If the next entry is `done` → the missed was isolated, continue (do not increment for the missed itself); on the next iteration, we'll be looking at that done.

The cleanest way to express step 4 is to walk in pairs: `[i]` and `[i+1]`. A `missed` at `[i]` is fine *only* if `[i+1]` exists and is `done`.

5. Return `streak` as the count of `done` entries traversed before hitting either two consecutive misses or running out of sequence.

### Test cases (todayProgress.test.ts) — write these first

The test file should reset the clock in `afterEach`. Use `setNowForTesting(new Date("2026-04-23T10:00:00"))` in `beforeEach`. Then `endDate` defaults reach this date; logs reference dates like `2026-04-23`, `2026-04-22`, etc.

Cover at minimum:

**Streak — base cases**
- Empty logs → streak 0, today null
- Today logged Done, no other history → streak 1
- Today logged Done, yesterday Done, day-before-yesterday Done → streak 3
- Today not logged, yesterday Done, day-before Done → streak 2 (today is "no decision")
- Today logged Skipped → streak considers prior days only (skipped doesn't break, doesn't extend); if yesterday + day-before were Done → streak 2

**Streak — single missed (tolerated)**
- Today Done, yesterday Missed, day-before Done → streak 2 (the two Dones; the missed is bridged but not counted)
- Today Done, yesterday Done, day-before Missed, day-before-that Done → streak 3
- Today Missed → streak 0 (we hit a miss immediately, the chain hasn't started)

**Streak — two consecutive missed (breaks)**
- Today Done, yesterday Missed, day-before Missed, day-before-that Done → streak 1 (today only; the chain breaks at the two consecutive misses)
- Yesterday Missed, day-before Missed (today not logged) → streak 0
- Today Done, yesterday Done, day-before-yesterday Missed, day-before-that Missed, day-before-that Done → streak 2 (today + yesterday; chain breaks at the two-miss block)

**Streak — skipped neutrality**
- Today Done, yesterday Skipped, day-before Done → streak 2 (skipped removed; sequence is Done → Done)
- Today Done, yesterday Skipped, day-before Skipped, day-before-that Done → streak 2

**Streak — skipped + missed interaction (the §8.3 critical cases)**
- Done → Missed → Skipped → Missed → Done (most recent first) → after skipped removal: Done → Missed → Missed → Done → streak is 1 (today's Done; chain breaks immediately at the two-miss block in the cleaned sequence)
- Done → Skipped → Missed → Done → Done → after skipped removal: Done → Missed → Done → Done → streak is 4 (the two Dones at the end + the Done before the missed + the most recent Done; the missed is isolated)

  Wait — re-walk this carefully:
  - Cleaned sequence (newest-first): Done, Missed, Done, Done
  - i=0: Done → streak=1
  - i=1: Missed. Look at i+1: Done. So this missed is isolated → continue without incrementing.
  - i=2: Done → streak=2
  - i=3: Done → streak=3
  - End. Streak = 3.

  (If your walk gives 4, you double-counted the bridged miss. The miss day is not Done, so it doesn't count toward the streak — it just doesn't break it.)

- Missed → Skipped → Done (most recent first) → after skipped removal: Missed → Done → streak is 0 (most recent in cleaned sequence is missed, returns immediately)

**Edge cases**
- Window larger than the available history (e.g. `windowDays=30` with 5 days of logs) — walk should terminate at sequence end without errors.
- `endDate` provided explicitly (not "today" per the clock) — verify the walk anchors correctly.
- Multiple log rows for the same date (data integrity issue, but possible from network races in older code) — newest-by-`updated_at` wins. The existing `getLogRecency` helper already handles this; preserve its behavior in the rewrite.

**Consistency rate (unchanged behavior — regression cases)**
- All Done in window → consistencyRate = 1
- All Missed → consistencyRate = 0
- All Skipped → consistencyRate = 0 (denominator is 0; existing code returns 0 in this case — preserve)
- 7 Done, 3 Missed, 5 Skipped → consistencyRate = 7 / (7+3) = 0.7

The existing tests for `consistencyRate` are good. Keep them or rewrite them to the new style — your call. The rewrite of streak cases must not regress consistency.

### Acceptance criteria

- `progress.ts` is rewritten to implement the algorithm above. `summarizeHabitProgress`'s signature and return shape are unchanged.
- `progress.ts` calls `now()` from `@/utils/clock` for default `endDate`, not `new Date()`.
- `todayProgress.test.ts` covers every case in the lists above. Test names should be descriptive — `it("breaks the streak on two consecutive misses with a skipped day between them", ...)` not `it("test §8.3 case 1", ...)`.
- `npm test` exits 0 with the new test file.
- TypeScript strict passes.
- No changes outside `progress.ts`, `todayProgress.test.ts`, and (if needed) the test setup file. Specifically: do not touch `api.ts`, `hooks.ts`, screens, or repositories.

### Out of scope

- Identity-flavored streak copy ("You've been a runner for 12 days") — that's S5 (`identityNoun.ts` + `IdentityStreakDisplay.tsx`).
- The single-miss reframing banner — S7.
- The recovery modal trigger — S7.
- Auto-missing days at midnight — separate ticket, future sprint.

### References

- `core-v1-requirements.md` §8 — the rules
- `src/utils/clock.ts` — DEV-S2-02
- `src/utils/dates.ts` — date math helpers
- `src/features/today/constants.ts` — `TODAY_PROGRESS_WINDOW_DAYS`

---

## DEV-S2-04 — Habits API rewrite + 48-hour validation + integration test

**Estimate:** 1.5 days
**Depends on:** DEV-S2-01, DEV-S2-02
**Branch suggestion:** `s2/api-rewrite`

### Context

Replace `src/features/habits/api.ts` with a version that calls the SQLite repositories instead of Supabase. This is the meat of S2. The function names callers use should stay roughly the same — but the input and output shapes change to match the new types from DEV-S2-01.

This ticket also lands the **48-hour retroactive logging window** as a local rule enforced inside `upsertHabitLog`. Per `core-v1-requirements.md` §7.3, logs and edits within 48 hours of `log_date` are accepted; beyond that, the day is immutable.

### Files to replace

```
src/features/habits/api.ts                          # full rewrite
```

### Files to create

```
src/tests/integration/habit-api.test.ts
```

### Files to read first

```
src/lib/db/repositories/habits.ts
src/lib/db/repositories/habit_logs.ts
src/features/habits/types.ts                        # post DEV-S2-01
src/features/habits/contract.ts                     # post DEV-S2-01
src/utils/clock.ts                                  # DEV-S2-02
docs/core-v1-requirements.md §7
docs/tech-handoff-core-v1.md §8.1
```

### Required exports — `api.ts`

The new file should export at minimum:

```ts
import {
  archiveHabit as archiveHabitRow,
  createHabit as createHabitRow,
  getHabit,
  listHabits,
  updateHabit as updateHabitRow,
} from "@/lib/db/repositories/habits";
import { upsertLog, listLogs } from "@/lib/db/repositories/habit_logs";

import type {
  Habit,
  HabitLog,
  HabitState,
  HabitStatus,
  CreateHabitPayload,
  HabitSetupPayload,
  UpsertHabitLogPayload,
} from "@/features/habits/types";

// Listings — replace getEligibleHabits / getUpcomingActiveHabits / getInactiveHabits.
// The Today screen will need to ask "what should I show today?" — that means
// active habits whose start_date <= today. We separate the listing from the
// "is it eligible to log" filtering so callers can compose.

export async function listActiveHabits(userId: string): Promise<Habit[]>;
export async function listEligibleHabitsForToday(
  userId: string,
  todayDate: string,
): Promise<Habit[]>;
export async function listUpcomingHabits(
  userId: string,
  todayDate: string,
): Promise<Habit[]>;
export async function listArchivedHabits(userId: string): Promise<Habit[]>;
export async function listBacklogHabits(userId: string): Promise<Habit[]>;

// CRUD
export async function getHabitById(
  userId: string,
  habitId: string,
): Promise<Habit>;
export async function createHabit(
  userId: string,
  payload: CreateHabitPayload,
): Promise<Habit>;
export async function updateHabit(
  userId: string,
  habitId: string,
  payload: HabitSetupPayload,
): Promise<Habit>;
export async function archiveHabit(userId: string, habitId: string): Promise<void>;

// Logs
export async function getHabitLogsForHabitInRange(
  userId: string,
  habitId: string,
  startDate: string,
  endDate: string,
): Promise<HabitLog[]>;
export async function getHabitLogsInRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<HabitLog[]>;
export async function upsertHabitLog(
  userId: string,
  payload: UpsertHabitLogPayload,
): Promise<HabitLog>;
```

Behavior notes per function follow.

### `listActiveHabits(userId)`

Pass-through to `listHabits({ user_id: userId, status: 'active' })`. No additional filtering.

### `listEligibleHabitsForToday(userId, todayDate)`

Active habits whose `start_date <= todayDate`. Ordering: `created_at DESC` (the repository already does this; preserve).

```ts
const all = await listHabits({ user_id: userId, status: "active" });
return all.filter((h) => h.start_date <= todayDate);
```

The repository can't filter by `start_date <= ?` today — it doesn't expose a date filter on listHabits. Filter in JS. The list of active habits will be small (cap is 3). If we ever lift the cap, add a repo-level query.

### `listUpcomingHabits(userId, todayDate)`

Active habits whose `start_date > todayDate`. Same JS-side filter. Order by `start_date ASC` then `created_at ASC` (use `.sort()`).

### `listArchivedHabits(userId)` / `listBacklogHabits(userId)`

Pass-through with `status: 'archived'` / `status: 'backlog'`. Repo orders by `created_at DESC` already.

### `getHabitById(userId, habitId)`

```ts
const habit = await getHabit(habitId);
if (!habit || habit.user_id !== userId) {
  throw new Error(`Habit not found: ${habitId}`);
}
return habit;
```

The user-id check is the only data-isolation we have locally. Always check it before returning a row.

### `createHabit(userId, payload)`

Translate `CreateHabitPayload` (camelCase, UI-shaped) into `CreateHabitInput` (snake_case, repo-shaped):

```ts
const input: CreateHabitInput = {
  user_id: userId,
  title: payload.title.trim(),
  identity_phrase: payload.identityPhrase.trim() || null,
  cue: payload.cue.trim(),
  tiny_action: payload.tinyAction.trim(),
  minimum_viable_action: payload.minimumViableAction.trim() || null,
  preferred_time_window: payload.preferredTimeWindow.trim() || null,
  start_date: todayDateString(),
  habit_state: payload.habitState,
  status: "active",
};
return createHabitRow(input);
```

`start_date` defaults to today. If the form needs to schedule a future-start habit, that's a separate flow (post-Core-v1) — for now, today.

**Note: this function does not enforce the 3-active cap.** The cap check is its own helper in DEV-S2-05; callers (forms, hooks) call the cap helper *first*, then `createHabit` if it passes. Don't entangle them at the API layer.

### `updateHabit(userId, habitId, payload)`

Verify ownership via `getHabitById(userId, habitId)` first (throws if not found or wrong user). Then translate the patch:

```ts
const patch: UpdateHabitPatch = {
  title: payload.title.trim(),
  identity_phrase: payload.identityPhrase.trim() || null,
  cue: payload.cue.trim(),
  tiny_action: payload.tinyAction.trim(),
  minimum_viable_action: payload.minimumViableAction.trim() || null,
  preferred_time_window: payload.preferredTimeWindow.trim() || null,
};
return updateHabitRow(habitId, patch);
```

We don't allow `habit_state` or `status` changes through this endpoint. Those have their own dedicated functions (`archiveHabit` for status, future graduation flow for habit_state).

### `archiveHabit(userId, habitId)`

```ts
await getHabitById(userId, habitId);   // ownership / existence check
await archiveHabitRow(habitId);
```

The repo's `archiveHabit` is idempotent (DEV-S1-05) and throws if the habit doesn't exist. The ownership pre-check makes the error message useful.

### `upsertHabitLog(userId, payload)` — the 48-hour rule lives here

This is where the retro window is enforced. Three checks before calling the repo:

1. **Habit exists and belongs to user.** `await getHabitById(userId, payload.habitId)`.
2. **Log date is not before habit's start_date.** `if (payload.logDate < habit.start_date) throw new RetroLogError("before_start_date")`.
3. **Log date is not in the future.** `if (payload.logDate > todayDateString()) throw new RetroLogError("future_date")`.
4. **Log date is within the 48-hour retro window.** See algorithm below.

Then call the repo:

```ts
return upsertLog({
  habit_id: payload.habitId,
  user_id: userId,
  log_date: payload.logDate,
  status: payload.status,
  note: payload.note ?? null,
});
```

### 48-hour window algorithm

The product rule (per §7.3 of requirements): a log for `log_date` is editable until 48 hours after `log_date`. Interpretation: from end-of-day of `log_date` in device-local time, add 48 hours. If `now()` is past that point, reject.

```ts
import { now } from "@/utils/clock";
import { addDeviceDays } from "@/utils/dates";
import { RETRO_LOG_WINDOW_HOURS } from "@/features/habits/contract";

function isWithinRetroWindow(logDate: string, currentTime: Date): boolean {
  // logDate is "YYYY-MM-DD" device-local.
  // End of that day in device local time is logDate at 23:59:59.999.
  const [y, m, d] = logDate.split("-").map(Number);
  const endOfLogDay = new Date(y, m - 1, d, 23, 59, 59, 999);
  const windowEnds = new Date(
    endOfLogDay.getTime() + RETRO_LOG_WINDOW_HOURS * 60 * 60 * 1000,
  );
  return currentTime <= windowEnds;
}

// Inside upsertHabitLog:
if (!isWithinRetroWindow(payload.logDate, now())) {
  throw new RetroLogError("outside_window");
}
```

Two pieces of judgment baked in:

- **End-of-day anchoring.** "48 hours after the day occurred" is interpreted as 48 hours after the end of `log_date`, not 48 hours after the start. This is the more generous interpretation and matches how users think — at 11pm on Apr 25, Apr 23 is "still within the window" because Apr 23 ended at midnight on Apr 24, and 48h after that is midnight on Apr 26.
- **Future-date check is separate.** Logging tomorrow with a far-future date would technically pass the retro-window check (you're well within 48h backward of a future endpoint). The explicit `payload.logDate > todayDateString()` check above blocks this.

If the product later wants the window measured from a different anchor, only this function changes — `RETRO_LOG_WINDOW_HOURS` is in `contract.ts` and `isWithinRetroWindow` is one place.

### `RetroLogError`

A small typed error so callers (the eventual hooks layer in DEV-S2-06 and future heatmap-tap interaction in S6) can render the right message:

```ts
export type RetroLogReason =
  | "outside_window"
  | "future_date"
  | "before_start_date"
  | "habit_archived";

export class RetroLogError extends Error {
  reason: RetroLogReason;
  constructor(reason: RetroLogReason) {
    super(`Retro log rejected: ${reason}`);
    this.reason = reason;
  }
}
```

Add `habit_archived` to the same error class for the case "user tries to log against an archived habit." Behavior: reject with `habit_archived` if `habit.status !== 'active'`.

### Logs read functions

`getHabitLogsForHabitInRange(userId, habitId, start, end)`:

```ts
await getHabitById(userId, habitId);    // ownership check
return listLogs({ habit_id: habitId, from_date: startDate, to_date: endDate });
```

`getHabitLogsInRange(userId, startDate, endDate)`:

```ts
return listLogsByUser({ user_id: userId, from_date: startDate, to_date: endDate });
```

Both ordered by `log_date DESC` (the repo's default).

### Integration test — `src/tests/integration/habit-api.test.ts`

Use `createTestDb()` from S1's test infra in `beforeEach`. Use the clock module's `setNowForTesting` to anchor "now."

Cover at minimum:

**Happy paths**
- `createHabit` then `getHabitById` round-trips. Returned habit has `id`, `created_at`, `updated_at`, `status='active'`, `habit_state='focus'`.
- `updateHabit` changes specified fields and bumps `updated_at`.
- `archiveHabit` sets status=archived, archived_at populated.
- `listActiveHabits` returns only active habits for the user.
- `listEligibleHabitsForToday` filters by start_date <= today.
- `listUpcomingHabits` filters by start_date > today, sorted by start_date ASC.
- `upsertHabitLog` (today, status=done) inserts a row.
- Re-`upsertHabitLog` (same date, status=skipped) updates the row in place — same `id`, new `status`, bumped `updated_at`.

**48-hour window — accept**
- Log for today → accepted.
- Log for yesterday → accepted.
- Log for two days ago at noon (clock fixed at 23:00 of today) → accepted (within window).
- Log for two days ago at noon, clock fixed at 00:00 of day-after-tomorrow → still accepted (the window ends at midnight day-after-tomorrow).

**48-hour window — reject**
- Log for three days ago → rejected with `RetroLogError("outside_window")`.
- Log for tomorrow → rejected with `RetroLogError("future_date")`.
- Log for a date before habit's `start_date` → rejected with `RetroLogError("before_start_date")`.
- Log for an archived habit → rejected with `RetroLogError("habit_archived")`.

**Cross-user isolation**
- Habit owned by user A; `getHabitById(userB, habitA.id)` throws.
- Habit owned by user A; `upsertHabitLog(userB, { habitId: habitA.id, ... })` throws (because `getHabitById` is called inside).

### Acceptance criteria

- `src/features/habits/api.ts` is rewritten with the exports above. No `import { supabase }` remains in the file.
- Every function uses `getDb()` indirectly via the repositories — no direct repo bypass, no inline SQL.
- `RetroLogError` is exported and the four reasons are reachable.
- `src/tests/integration/habit-api.test.ts` exists with the cases above. `npm test` exits 0 for the new file.
- TypeScript strict passes for `api.ts` and the test file when imported in isolation.
- Manual smoke test from a debug REPL: `createHabit` → `upsertHabitLog` for today → `getHabitLogsForHabitInRange` returns the log.

### Out of scope

- 3-active cap enforcement — DEV-S2-05.
- Hook layer (`hooks.ts`) updates — DEV-S2-06.
- Screen edits — DEV-S2-06.
- Deleting the obsolete unit tests — DEV-S2-06.
- Auto-applying `missed` at end-of-day — future sprint (it's mostly a UI concern handled at app open).
- Heatmap-tap log selector UI — S6.

### References

- `docs/core-v1-requirements.md` §7 (logging), §10.2 (consistency)
- `docs/tech-handoff-core-v1.md` §8.1 (rewrite scope)
- `src/lib/db/repositories/habits.ts`, `habit_logs.ts`
- `src/utils/clock.ts`

---

## DEV-S2-05 — Validators + 3-active cap

**Estimate:** 0.5 day
**Depends on:** DEV-S2-04
**Branch suggestion:** `s2/validators-cap`

### Context

The current `validators.ts` validates the *old* form fields (`name`, `stackTrigger`, `tinyAction`, `reminderEnabled`, `reminderTime`). Update it for the new field names from DEV-S2-01, and add the 3-active cap helper.

The cap helper is async (it queries the DB through `listActiveHabits`). That's unusual for a validators file — sync field validation usually lives there. The sprint plan asked for it in `validators.ts` and the value of co-locating it (one place to find "what's valid for habit creation") outweighs the awkwardness of one async function. If DEV-S2-04's reviewer disagrees, raise the question — moving it to its own `capCheck.ts` is a five-minute refactor and the rest of this ticket doesn't change.

### Files to modify / replace

```
src/features/habits/validators.ts
src/tests/unit/habitValidators.test.ts              # rewrite to match new fields
```

### Files to create (optional — see below)

```
src/tests/unit/habitCapCheck.test.ts                # if you prefer the cap test in its own file
```

(Keeping it in `habitValidators.test.ts` is also fine. Pick one.)

### Required changes — `validators.ts`

New shape:

```ts
import {
  exceedsLength,
  isBlank,
} from "@/utils/validation";
import { listActiveHabits } from "@/features/habits/api";
import {
  ACTIVE_FOCUS_LIMIT,
  ACTIVE_HABIT_CAP,
  ACTIVE_SUPPORTING_LIMIT,
} from "@/features/habits/contract";

import type {
  HabitSetupPayload,
  HabitState,
} from "@/features/habits/types";

export type HabitValidationErrors = Partial<
  Record<keyof HabitSetupPayload, string>
>;

export function normalizeHabitSetupPayload(
  payload: HabitSetupPayload,
): HabitSetupPayload {
  return {
    title: payload.title.trim(),
    identityPhrase: payload.identityPhrase.trim(),
    cue: payload.cue.trim(),
    tinyAction: payload.tinyAction.trim(),
    minimumViableAction: payload.minimumViableAction.trim(),
    preferredTimeWindow: payload.preferredTimeWindow.trim(),
  };
}

export function validateHabitSetupPayload(
  payload: HabitSetupPayload,
): HabitValidationErrors {
  const normalized = normalizeHabitSetupPayload(payload);
  const errors: HabitValidationErrors = {};

  if (isBlank(normalized.title)) {
    errors.title = "Habit name is required.";
  } else if (exceedsLength(normalized.title, 120)) {
    errors.title = "Habit name must stay under 120 characters.";
  }

  if (isBlank(normalized.cue)) {
    errors.cue = "A cue is required — what comes before this habit?";
  } else if (exceedsLength(normalized.cue, 240)) {
    errors.cue = "Cue must stay under 240 characters.";
  }

  if (isBlank(normalized.tinyAction)) {
    errors.tinyAction = "A tiny action is required.";
  } else if (exceedsLength(normalized.tinyAction, 240)) {
    errors.tinyAction = "Tiny action must stay under 240 characters.";
  }

  if (
    !isBlank(normalized.minimumViableAction) &&
    exceedsLength(normalized.minimumViableAction, 240)
  ) {
    errors.minimumViableAction =
      "Minimum viable action must stay under 240 characters.";
  }

  if (
    !isBlank(normalized.identityPhrase) &&
    exceedsLength(normalized.identityPhrase, 240)
  ) {
    errors.identityPhrase = "Identity phrase must stay under 240 characters.";
  }

  if (
    !isBlank(normalized.preferredTimeWindow) &&
    exceedsLength(normalized.preferredTimeWindow, 80)
  ) {
    errors.preferredTimeWindow =
      "Preferred time window must stay under 80 characters.";
  }

  return errors;
}

export const validateCreateHabitPayload = validateHabitSetupPayload;
```

Notes:

- No more `reminderEnabled` / `reminderTime` validation. Reminder fields don't exist on the form in S2.
- `identityPhrase`, `minimumViableAction`, `preferredTimeWindow` are optional but length-bounded if provided.
- `isValidTimeString` is no longer needed in this file — leave it in `@/utils/validation` if other callers use it; just remove the import here.

### Required changes — cap helper

Append to the same file:

```ts
export type CapCheckResult =
  | { ok: true }
  | {
      ok: false;
      reason: "focus_full" | "supporting_full" | "total_cap_reached";
      counts: { focus: number; supporting: number };
    };

/**
 * Check whether the user can add a new active habit of the given state.
 *
 * Queries the DB for current active habit counts via listActiveHabits,
 * then compares against ACTIVE_HABIT_CAP / ACTIVE_FOCUS_LIMIT /
 * ACTIVE_SUPPORTING_LIMIT.
 *
 * `nextHabitState` is the state the new habit would have:
 *   - "focus"      → checked against focus limit (1)
 *   - "supporting" → checked against supporting limit (2)
 *   - "automatic"  → never blocked (graduated habits do not count toward
 *                    the active cap; this helper still accepts the value
 *                    for API symmetry)
 */
export async function assertCanCreateActiveHabit(
  userId: string,
  nextHabitState: HabitState,
): Promise<CapCheckResult> {
  if (nextHabitState === "automatic") {
    return { ok: true };
  }

  const active = await listActiveHabits(userId);
  const counts = {
    focus: active.filter((h) => h.habit_state === "focus").length,
    supporting: active.filter((h) => h.habit_state === "supporting").length,
  };

  // Total cap is the safety net — focus + supporting limits are stricter,
  // so we check those first for clearer error messages.
  if (nextHabitState === "focus" && counts.focus >= ACTIVE_FOCUS_LIMIT) {
    return { ok: false, reason: "focus_full", counts };
  }
  if (
    nextHabitState === "supporting" &&
    counts.supporting >= ACTIVE_SUPPORTING_LIMIT
  ) {
    return { ok: false, reason: "supporting_full", counts };
  }
  if (counts.focus + counts.supporting >= ACTIVE_HABIT_CAP) {
    return { ok: false, reason: "total_cap_reached", counts };
  }

  return { ok: true };
}
```

This returns a result rather than throwing. Callers — onboarding (S4), post-onboarding habit creation (S13) — will use the result to render the "replace existing or save to backlog" prompt. Throwing would force them into try/catch awkwardness.

### Test cases — `habitValidators.test.ts`

Sync validator tests:
- All required fields blank → errors for `title`, `cue`, `tinyAction`.
- All required fields valid, optional fields blank → no errors.
- Title 121 chars → length error.
- Cue 241 chars → length error.
- Identity phrase 241 chars → length error.
- Minimum viable action 241 chars → length error.
- Preferred time window 81 chars → length error.

Cap helper tests (use `createTestDb` and seed habits via the repo):
- 0 focus, 0 supporting, asking for focus → `{ ok: true }`.
- 1 focus, 0 supporting, asking for focus → `{ ok: false, reason: "focus_full" }`.
- 0 focus, 2 supporting, asking for supporting → `{ ok: false, reason: "supporting_full" }`.
- 1 focus, 2 supporting, asking for either focus or supporting → `total_cap_reached` or the appropriate stricter limit.
- 1 focus, 0 supporting, asking for supporting → `{ ok: true }`.
- Asking for `automatic` always → `{ ok: true }` regardless of counts.
- Cap counts only `status='active'` habits — archived/backlog don't count. Verify by archiving one of the active habits and re-checking.
- Cross-user isolation: another user's active habits don't count toward this user's cap.

### Acceptance criteria

- `validators.ts` is rewritten as above.
- `assertCanCreateActiveHabit` exists and is exported.
- `habitValidators.test.ts` is rewritten to match. All tests pass.
- TypeScript strict passes for the validators file in isolation.
- No changes outside `validators.ts` and its test file. (`api.ts` may need a small import addition if you put the cap helper into a separate module — but the recommended path is to keep it in `validators.ts` and not touch `api.ts`.)

### Out of scope

- Wiring the cap helper into the create-habit form — that's S4 (onboarding) and S13 (post-onboarding habit creation).
- "Save to backlog" or "replace existing" UI — S14.
- Worst-day gate validation — S4 and S13.

### References

- `docs/core-v1-requirements.md` §3.3 — the cap rule
- `docs/core-v1-requirements.md` §6 — post-onboarding creation form fields
- `src/features/habits/api.ts` — `listActiveHabits` from DEV-S2-04
- `src/features/habits/contract.ts` — cap constants from DEV-S2-01

---

## DEV-S2-06 — Cascade fixes + obsolete-test cleanup

**Estimate:** 1 day
**Depends on:** DEV-S2-04, DEV-S2-05
**Branch suggestion:** `s2/cascade-cleanup`

### Context

After DEV-S2-04, two surfaces are broken:

1. **`src/features/habits/hooks.ts`** imports the old api function names (`getEligibleHabits`, `setHabitActiveState`, etc.) and uses old field shapes via the `HabitRecord` alias. Some renames just work because of the back-compat alias from DEV-S2-01; others (field names, function names) need real updates.
2. **Screens that read habit fields** (`Today`, `HabitDetail`, `CreateHabit`, `EditHabit`) reference `habit.name` and `habit.is_active`. Those need mechanical renames to `habit.title` and `habit.status === 'active'`.

And several tests are now obsolete:

```
src/tests/unit/habitApi.test.ts                     # tests old api.ts shape
src/tests/unit/habitDetailApi.test.ts               # ditto
src/tests/unit/habitLogsApi.test.ts                 # ditto
src/tests/unit/habitUpdateApi.test.ts               # ditto
src/tests/unit/habitDetailHooks.test.ts             # tests old hooks shape
src/tests/unit/habitUpdateHooks.test.ts             # ditto
src/tests/unit/todayHooks.test.ts                   # may need rewrite
src/tests/unit/habitContract.test.ts                # tests removed PHASE_2A_* constants
```

This ticket sweeps up. Goal: by the end, `npx tsc --noEmit` is clean and `npm test` passes for the whole repo.

### Files to modify

```
src/features/habits/hooks.ts
src/features/habits/screens/CreateHabitScreen.tsx
src/features/habits/screens/EditHabitScreen.tsx
src/features/habits/screens/HabitDetailScreen.tsx
src/features/today/screens/TodayScreen.tsx
src/features/habits/formatters.ts                   # if it references old field names
src/features/recommendations/* (only if compiler errors point here)
src/features/reviews/* (only if compiler errors point here)
src/providers/AuthBootstrap.tsx                     # the "best-effort user profile upsert" — see below
```

### Files to delete

```
src/tests/unit/habitApi.test.ts
src/tests/unit/habitDetailApi.test.ts
src/tests/unit/habitLogsApi.test.ts
src/tests/unit/habitUpdateApi.test.ts
src/tests/unit/habitDetailHooks.test.ts
src/tests/unit/habitUpdateHooks.test.ts
```

(The new `src/tests/integration/habit-api.test.ts` from DEV-S2-04 covers the API surface area. The deleted tests were testing the Supabase-shaped api.ts that no longer exists.)

### Files to rewrite or skip

```
src/tests/unit/todayHooks.test.ts                   # rewrite or skip
src/tests/unit/habitContract.test.ts                # rewrite or delete
```

`todayHooks.test.ts` tests the React Query hook layer. The hook layer survives in DEV-S2-06 in updated form, so the test could survive too — but the test mocks Supabase, which is no longer involved. Easiest path: delete it. If the dev wants to preserve coverage, rewrite to mock the `api.ts` module instead. Either is fine.

`habitContract.test.ts` tested the old `PHASE_2A_*` constants. Either rewrite to assert the new constants from contract.ts (the lists are stable enough to test once) or delete. Recommendation: rewrite as a small smoke test that asserts `LOCAL_HABIT_FIELDS` includes `title` and not `name`, and `HABIT_LOG_STATUSES` matches `["done", "skipped", "missed"]`. That's enough to catch regressions if someone renames a constant by mistake.

### Field-rename cheat sheet for screens

Search-and-replace targets across `src/features/habits/screens/`, `src/features/today/screens/`, and any other compiler-error sites:

| Old reference | New reference |
|---|---|
| `habit.name` | `habit.title` |
| `habit.identity_statement` | `habit.identity_phrase` |
| `habit.stack_trigger` | `habit.cue` |
| `habit.is_active` | `habit.status === "active"` |
| `habit.reminder_enabled` | (remove all references — feature deferred to S15) |
| `habit.reminder_time` | (remove all references) |
| `payload.name` | `payload.title` |
| `payload.identityStatement` | `payload.identityPhrase` |
| `payload.stackTrigger` | `payload.cue` |
| `payload.reminderEnabled` | (remove from forms) |
| `payload.reminderTime` | (remove from forms) |

For the reminder fields specifically: the form sections that collect them should be commented out or removed. Add a TODO comment pointing to S15 so the dev who picks up reminders knows where to add them back. Form state initialization should drop the reminder defaults.

### `AuthBootstrap.tsx` — the "best-effort profile upsert"

Per `sprint-1-tickets.md` §0, this file currently runs a Supabase upsert against the `habits` table (or its profile equivalent) on auth bootstrap and logs a noisy "could not find table" error. S0 added the `profiles` and `trial_entitlements` tables but didn't update this file. Update it to:

1. Upsert into `profiles` (matching the schema in `tech-handoff-core-v1.md` §3.1).
2. Provision a `trial_entitlements` row if absent (S0's auto-provision trigger may already handle this — check before duplicating).
3. Stop calling the dropped `habits` / `habit_logs` tables.

If this is more than a small fix, scope it to a separate ticket and link from this one. Don't let it expand DEV-S2-06's surface area.

### `hooks.ts` — what stays, what changes

The React Query layer keeps the same query-key conventions, but:

- Function names that shifted in `api.ts`:
  - `getEligibleHabits` → `listEligibleHabitsForToday`
  - `getUpcomingActiveHabits` → `listUpcomingHabits`
  - `getInactiveHabits` → `listArchivedHabits`
  - `setHabitActiveState` (boolean toggle) → `archiveHabit` (the only "deactivate" path; reactivation can be a future ticket — for now, dropping the reactivation hook is fine, no caller needs it in S2).

- Field types come from `Habit` (re-exported as `HabitRecord`). That alias keeps the cascade smaller. You may collapse the alias in this ticket if you wish, but the repo will be cleaner if you do — touch the alias removal only if you have time.

- Mutation hooks that pass `payload: HabitSetupPayload` keep the same call shape, but the inner field names are different. The form components feed in already-translated camelCase, so the hook just hands off to `api.ts` — minimal logic change.

- `useEligibleHabitsQuery` keeps its query key. Only the implementation changes.

### Acceptance criteria

- `npx tsc --noEmit` is clean across the entire repo.
- `npm test` exits 0 across the entire suite.
- The app launches and gets to the Today screen without throwing (manual smoke test).
- Manual smoke test:
  - Create a new habit through the existing CreateHabit form → row appears in `local_habits`.
  - Log Done for today → row appears in `local_habit_logs`.
  - Today screen displays the habit and shows a streak number that respects forgiving rules.
  - Habit Detail opens and renders fields from the new shape.
  - Edit the habit's title and tiny action → changes persist.
  - Archive the habit → it disappears from Today.
- No `import { supabase }` remains in `src/features/habits/`, `src/features/today/`, or related screen files. (Auth and other server-touching code may keep their Supabase imports.)
- The deleted test files are actually deleted, not just emptied.
- The PR description lists deleted tests with a one-line "obsolete because…" for each.

### Out of scope

- Today screen redesign (Focus card emphasis, identity-flavored streak copy, heatmap component) — S5.
- Habit Detail redesign (90-day heatmap, consistency display) — S6.
- Bug #2 fix (dual suggestion display) — S8.
- Bug #3 fix (preferred time picker) — S19 (was S7 in older notes; settled on S19 per the sprint plan).
- Onboarding screens — S3-S4.
- Recommendation copy review — later sprint.

### References

- `sprint-plan.md` §4 (S2 deliverables)
- `core-v1-requirements.md` §5 (Today screen — for understanding what minimal display you're keeping working)
- `tech-handoff-core-v1.md` §8.4-8.5 (existing files affected)

---

## Definition of S2 done

S2 is complete when **all six tickets** are merged AND:

1. `npx tsc --noEmit` is clean.
2. `npm test` passes.
3. The app launches, runs migrations, lands on either the Welcome screen or Today screen depending on auth state.
4. A signed-in user can:
   - Create a habit through the existing form. The row lands in `local_habits` with the new shape.
   - Log Done or Skipped for today on a Focus habit. The row lands in `local_habit_logs`.
   - See a streak number on the Today screen that follows the forgiving rules (verifiable by hand-crafting log sequences and inspecting the displayed number).
   - Try to retro-log a 36-hour-old day → succeeds. Try to retro-log a 60-hour-old day → fails with a clear error.
5. No `import { supabase }` exists in `src/features/habits/api.ts`, `src/features/today/progress.ts`, or anywhere else that touches habit data.
6. The repository tests from S1 still pass unchanged.

After S2 closes, S3 begins: the first three onboarding screens. The becoming-bridge starts to take shape on top of an engine that finally works the way the product wants it to.

---

*End of S2 ticket package.*
