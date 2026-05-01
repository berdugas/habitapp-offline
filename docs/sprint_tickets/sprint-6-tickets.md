# Sprint 6 — Dev Team Tickets

> **Status:** Ready for assignment.
> **Date:** April 30, 2026
> **Owner:** Tech Lead → Dev Team
> **Companion documents:** `sprint-plan.md` (S6 definition, §5), `core-v1-requirements.md` (especially §7.3, §7.4, §9.4, §10), `tech-handoff-core-v1.md` (architecture), `sprint-5-tickets.md` and `sprint-5-followups.md` (the layer this builds on)

S6 takes the components built in S5 — the `Heatmap`, `IdentityStreakDisplay`, `useHabitLogsForRange` hook, `listLogsForHabitInRange` repo function, and the `RetroLogError` from S2's api rewrite — and wires them into the Habit Detail surface and the 48-hour retroactive logging interaction. Two additions to the screen (the 90-day heatmap variant; the consistency line), one new modal-based component (`RetroLogSelector`), one new general-purpose mutation hook, and the integration tests that pin the 48-hour boundary with a midnight-transition case.

This sprint is roughly the size of S5. The risk is concentrated in two places: the day-boundary math at midnight (named risk #4 in `sprint-plan.md` §9 — anchor everything to device-local YYYY-MM-DD, never `Date.now()` arithmetic), and the cell-tap → selector → mutation → invalidation chain that, on success, has to refresh both the heatmap and the consistency / streak numbers in the same screen within one second. Both risks are addressable with the patterns already in the codebase; the work is being deliberate, not inventive.

---

## 0. Shared context — read before picking up a ticket

### Branching for this sprint

> **⚠️ The very first action of S6 is cutting the sprint branch off `main`.** Do not start any ticket below until this is done.

Per `sprint-plan.md` §8.5, every sprint runs on its own integration branch. Before any ticket below starts:

```bash
git checkout main && git pull
git checkout -b sprint-6
git push -u origin sprint-6
```

Every ticket below branches off `sprint-6` and PRs back into `sprint-6`, **not** `main`. The `Branch suggestion` line on each ticket is the ticket branch:

```bash
git checkout sprint-6 && git pull
git checkout -b s6/habit-detail-redesign
# ... do the work ...
# Open PR: s6/habit-detail-redesign → sprint-6
```

When all four tickets are merged into `sprint-6` and the Definition of S6 done is met, open one final PR: `sprint-6` → `main`.

### What's already done

S0–S5 closed before S6 starts. By the time your S6 code runs:

- The local DB is the sole source of truth for habit data. `local_habits`, `local_habit_logs`, `local_user_preferences`, and `local_weekly_reviews` are all live.
- The forgiving streak rule (with §8.3 skipped-day removal) is implemented in `features/today/progress.ts` and tested with 23 named cases.
- `summarizeHabitProgress` already returns `consistencyRate` computed from the §10.2 formula (`done / (done + missed)` over the last 30 days, skipped excluded). **Do not re-derive this in S6.** The detail screen consumes it.
- `features/habits/api.ts` exposes `upsertHabitLog(userId, payload)` which already enforces the 48-hour retro window locally and throws a typed `RetroLogError` with one of four reasons: `outside_window`, `future_date`, `before_start_date`, `habit_archived`. **S6 surfaces this error in the UI; it does not re-enforce the window.**
- `Heatmap` (`src/components/Heatmap.tsx`) supports both 30-day and 90-day variants via the `days: 30 | 90` prop. The 30-day variant ships on Today. The 90-day variant has been built and unit-tested but **has no consumer yet** — that lights up in DEV-S6-01.
- `Heatmap` accepts an optional `onCellPress?: (date: string) => void` prop. When undefined, cells are non-interactive. When set, every cell becomes a `Pressable` that fires `onCellPress(date)`. **S6 wires this prop on Habit Detail; Today's heatmap stays display-only** (per S5 (D2)).
- `useHabitLogsForRange(habitId, days)` hook and `listLogsForHabitInRange(habitId, fromDate, toDate)` repo function exist in `features/today/hooks.ts` and `lib/db/repositories/habit_logs.ts` respectively. **Both are reusable directly by Habit Detail in S6** — no new hook is needed for the heatmap data. (Despite living under `features/today/`, the hook is general-purpose; S6 imports it as-is.)
- `IdentityStreakDisplay` (`src/components/IdentityStreakDisplay.tsx`) takes `{ identityNoun, streak }`. `extractIdentityNoun` (`src/features/onboarding/identityNoun.ts`) returns `string | null`. **S6 reuses both unchanged.**
- The existing `useUpsertTodayHabitStatusMutation` in `features/today/hooks.ts` hardcodes `logDate = todayDateString()`. It is **specifically for today's log** and S6 does not modify it. The retro-log path needs a more general mutation that accepts `logDate`; S6 introduces this as a new hook (see (D7) below).
- The existing `HabitDetailScreen` (`src/features/habits/screens/HabitDetailScreen.tsx`) is a working S0/S2-era screen. It already shows: title, formula, identity phrase, today's status, streak (as raw number), consistency (as raw percentage), 30-day skip count, recent logs, latest weekly review, adjustment suggestion, archive/edit/back buttons. **S6 modifies this screen — it does not rebuild it.** The plumbing is intact; you are layering identity-flavored chrome on top and adding the heatmap and retro-log path.
- `RetroLogError` is the typed error shape. Add user-facing copy for its reasons in `utils/userFacingErrors.ts` (see DEV-S6-02).

### What we are NOT touching in S6

- **Today screen** — no changes. The S5 redesign stands. (DEV-S6-03 *adds* tests for two existing TodayScreen error paths; it does not change behavior.)
- **The Today heatmap** — stays display-only. Tap-to-retro-log is a Habit Detail interaction in Core v1.
- **The dropped Supabase `weekly_reviews` query inside `useHabitDetail`** — same pattern as the `useTodayHabits` no-op call documented in PROJECT_BRAIN §11. Per S5 followup F5, this stays untouched until reviews migrates to local SQLite. The "Latest weekly review" section on Habit Detail continues to show the empty-state copy because the query silently fails — that is expected.
- **Adjustment suggestion section on Habit Detail** — stays as-is. It's driven by the same dead `latestReview` path; when reviews migrates, the suggestion comes back to life automatically.
- **Visual differentiation of pre-start cells in the Heatmap.** A habit started 5 days ago shows 85 cells before its `start_date` in the 90-day heatmap, currently rendered as `heatmapMissed`. Per (D4) below, this stays for S6; the retro-log handler short-circuits taps on those cells so the user never sees a confusing error. Visual fix is a followup.
- **Bottom-sheet modal libraries.** S6 uses RN's built-in `Modal`. See (D5).
- **Migrating `useUpsertTodayHabitStatusMutation` to the new general-purpose hook.** Both coexist. Consolidation is a followup, not S6.
- **Reminders, library content, graduation, supporting habits, recovery flow, trial validation, account, export, weekly review polish** — all later sprints per `sprint-plan.md`.

### Architectural and product decisions for S6

These ten decisions shape the work. (D4), (D5), (D6), and (D7) are the load-bearing ones. All are settled — pushback should go to the Tech Lead, not be resolved unilaterally inside a ticket.

**(D1) The "Become [identity_phrase]" header pattern is reused on Habit Detail.** Same defensive null-handling as `TodayScreen` (S5 (D5)): if `identityPhrase` is empty/null, render no header rather than `"Become "` alone. This keeps a Focus habit's identity visible on its detail surface and reinforces the becoming-bridge thesis past the Today screen. It replaces the existing `<Text style={styles.title}>{habit.title}</Text>` block at the top of the screen.

**(D2) Identity-flavored streak uses `IdentityStreakDisplay` directly.** No first-day copy on Habit Detail — the first-day state (S5 (D7)) was a TodayScreen-specific affordance, not a Habit Detail concern. A user navigating to Habit Detail on Day 1 with `streak === 0` sees *"Day one. Start showing up."* — the standard 0-streak copy from `IdentityStreakDisplay`. That's correct behavior.

**(D3) The 90-day heatmap is display-only in DEV-S6-01; `onCellPress` is wired in DEV-S6-02.** This mirrors the S5 pattern (Heatmap built display-only in S5-02, consumer wired it in S5-03). It lets DEV-S6-01 ship a clean visual rewrite without dragging in the modal/mutation/error work, and lets DEV-S6-02 layer interaction on a known-good display.

**(D4) Pre-start cells stay visually identical to "missed" in S6.** A habit's `start_date` may be more recent than the heatmap window (a habit started 5 days ago shows 85 pre-start cells in a 90-day grid). Per S5's shipped behavior, these render as `heatmapMissed`. **Visual differentiation is deferred to S6 followups.** What S6 *does* fix: the retro-log handler in DEV-S6-02 short-circuits if `date < habit.start_date`, so tapping a pre-start cell silently does nothing (no selector, no error toast). The user never sees a `before_start_date` rejection in normal flow. The error reason is still implemented in `userFacingErrors.ts` defensively in case some other path surfaces it.

**(D5) The retro-log selector is a Modal-based component, not a bottom sheet.** RN's built-in `Modal` is sufficient. Bottom sheets add gesture/animation complexity and a library dependency (`@gorhom/bottom-sheet` or similar) that's not warranted for a single retro-log surface in Core v1. If beta feedback calls for the bottom-sheet feel, that's v1.1 polish. The component lives at `src/features/habits/components/RetroLogSelector.tsx` because it's tied to habit logging — not generic enough for `src/components/` (compare: `Heatmap` is generic; `RetroLogSelector` knows about habit log statuses and the 48-hour window).

**(D6) The selector handles three states cleanly.** The mode is derived from the date and habit, not passed as a prop:

| Cell tapped | What the handler does |
|---|---|
| `date < habit.start_date` | Silently no-op. No selector. (Per (D4).) |
| `date` within 48h window of "now" (today, yesterday, or earlier today within window) | Open selector in **editable** mode. Done | Skip buttons. Pre-selects the current status if any. |
| `date` is older than the 48h window | Open selector in **read-only** mode. Shows date + current status. "This day is locked." Close button only, no Done/Skip. |

The same `RetroLogSelector` component renders both editable and read-only modes via a `canEdit: boolean` prop derived in the parent. Why a single component: keeps the modal lifecycle (open / close / animation) consistent for the user; the visual difference is just whether buttons render. The "is this date in the 48h window?" computation lives in a small helper alongside the existing `isWithinRetroWindow` in `api.ts` — exported for the selector's parent to use, so that two pieces of code don't disagree about the boundary.

**(D7) The retro mutation is a new general-purpose hook, not an extension of the today hook.** `useUpsertTodayHabitStatusMutation` is named for what it does (logs today). A new `useUpsertHabitLogMutation()` accepts `{ habitId, logDate, status }` and is reusable — Habit Detail uses it now; the Today screen could be migrated to use it later (followup, not S6). Both hooks coexist. The new hook's `onSuccess` invalidates **all three** query keys that need to refresh after a retro log:

1. `getHabitLogsRangeQueryKey(habitId, ...)` — the heatmap on this habit's detail screen
2. `getUserHabitLogsRangeQueryKey(userId, ...)` — the today aggregate (so if user retro-logs while detail is open, returning to Today reflects the change)
3. The habit detail query key (so consistency, streak, today's status update on the same screen)

Find the habit detail query key by reading `src/features/habits/hooks.ts` — `useHabitDetail` defines it. Don't guess.

**(D8) The selector dispatches `done` or `skipped`, never `missed`.** Per S5 (D3) and requirements §7.2, Missed is auto-applied at end of day. The retro selector matches the Today buttons. If the user wants to "undo" a Done log, she changes it to Skip. Clearing a log entirely (returning to "no log" / future-Missed) is not a supported action in Core v1; the spec doesn't ask for it, and adding it opens edge cases (does an unlogged past day stay Missed forever, or only after midnight?). Hold the line.

**(D9) `RetroLogError` reasons get user-facing messages in `utils/userFacingErrors.ts`.** Add four functions following the existing `getXxxErrorMessage()` pattern in that file:

- `getRetroLogOutsideWindowErrorMessage()` → *"This day was more than 48 hours ago. It's locked."*
- `getRetroLogBeforeStartDateErrorMessage()` → *"This day is before your habit started."* (defensive only — the handler in (D6) prevents this from surfacing in normal flow)
- `getRetroLogFutureDateErrorMessage()` → *"That day hasn't happened yet."* (defensive only — heatmap doesn't render future dates)
- `getRetroLogHabitArchivedErrorMessage()` → *"This habit is archived. Reactivate it to log."*

A single `getRetroLogErrorMessage(reason: RetroLogReason): string` dispatcher is also added that switches on `reason` and returns the right string. The selector imports the dispatcher; tests can target individual functions.

**(D10) Consistency display copy.** The existing `formatConsistency(consistencyRate)` returns just `"85%"`. Per requirements §10.2, the spec copy is *"[N]% over the last 30 days."* Update the consistency block on Habit Detail to render `formatConsistency(progress.consistencyRate) + " over the last 30 days"`. Don't change `formatConsistency` itself — other callers (if any) might want just the percentage. Compose the suffix at the call site.

### Field mapping reference

For DEV-S6-01, the redesigned Habit Detail header maps from the habit row + progress object:

| Source | Destination |
|---|---|
| `habit.identity_phrase` | "Become" header → `"Become " + habit.identity_phrase` (rendered only if non-empty) |
| `habit.cue` + `habit.tiny_action` | Cue+action subtitle → `"After " + habit.cue + ", " + habit.tiny_action` |
| `extractIdentityNoun(habit.identity_phrase ?? "")` + `progress.streak` | `<IdentityStreakDisplay>` props |
| `progress.consistencyRate` | `formatConsistency(...) + " over the last 30 days"` |
| `useHabitLogsForRange(habit.id, 90).data` | `<Heatmap days={90} logs={...} />` |

For DEV-S6-02, the cell-tap handler uses:

| Input | Use |
|---|---|
| `date` (from `onCellPress`) | Compared to `habit.start_date` and to the 48h window helper |
| `habit.start_date` | Pre-start short-circuit (per (D4)) |
| Existing log for that date (lookup in heatmap logs by `log_date`) | Pre-select current status in editable mode; display in read-only mode |

### File / folder layout

By the end of S6:

```
src/features/habits/
├── api.ts                                     # MODIFIED in S6-02 — export isWithinRetroWindow
├── hooks.ts                                   # MODIFIED in S6-02 — add useUpsertHabitLogMutation
├── components/                                # NEW directory (if not present)
│   ├── RetroLogSelector.tsx                   # NEW in S6-02
│   └── __tests__/
│       └── RetroLogSelector.test.tsx          # NEW in S6-02
├── screens/
│   ├── HabitDetailScreen.tsx                  # MODIFIED in S6-01 (chrome) + S6-02 (cell-tap wire-up)
│   └── __tests__/                             # NEW directory (if not present)
│       └── HabitDetailScreen.test.tsx         # NEW in S6-01, extended in S6-02

src/features/today/__tests__/
└── TodayScreen.test.tsx                       # EXTENDED in S6-03 — add F3 + F4 tests

src/utils/
└── userFacingErrors.ts                        # MODIFIED in S6-02 — add four retro-log error messages + dispatcher

docs/
├── PROJECT_BRAIN.md                           # MODIFIED in S6-04 — §11 update
└── sprint_tickets/
    └── sprint-6-followups.md                  # NEW in S6-04
```

### Conventions

Inherited from S2–S5, applied unchanged in S6.

- `now()` / `nowIso()` / `todayDateString()` from `@/utils/clock`, never `Date.now()` or `new Date()` directly.
- `toDeviceDateString()` / `addDeviceDays()` from `@/utils/dates`.
- Tests use `renderHook` and `render` from `@testing-library/react-native`. The `@testing-library/react-hooks` package is **not** installed.
- Pure functions get unit tests; presentational components get render tests; screens get screen tests asserting rendered copy and mutation/navigation contracts.
- Imports order: external packages → `expo-*` → `@/components/*` → `@/features/*` → `@/lib/*` → `@/services/*` → `@/theme/*` → `@/utils/*` → relative imports.
- All user-facing strings are `selectable` `<Text>`.
- The submit-lock pattern (`activeStateSubmitLockRef` on the existing screen; `retroLogSubmitLockRef` for new mutations) stays. Use a fresh ref for each mutation to avoid cross-blocking.

### Sequencing

```
DEV-S6-01  HabitDetailScreen redesign (display-only chrome + 90-day heatmap)
   ↓
DEV-S6-02  Retro-log selector + mutation hook + onCellPress wire-up + error copy
   ↓
DEV-S6-03  Test gap closure (F4 heatmap-refresh + F3 TodayScreen error paths)
   ↓
DEV-S6-04  Manual smoke + PROJECT_BRAIN update + sprint-6-followups.md
```

Strictly serial. DEV-S6-02 depends on DEV-S6-01's screen redesign being in place. DEV-S6-03 is independent of S6-01/S6-02 in code but waits its turn for review-overhead reasons.

---

## DEV-S6-01 — HabitDetailScreen redesign

**Estimate:** 0.75 day
**Depends on:** S5 closed (sprint-5 merged into main), `sprint-6` branch cut.
**Branch suggestion:** `s6/habit-detail-redesign`

### Context

The Habit Detail screen exists today as a working S0/S2-era surface. It shows the right data (title, identity phrase, formula, today's status, streak, consistency, recent logs, weekly review, adjustment suggestion, archive/edit) but it doesn't speak the becoming-bridge language: streak is a raw number, consistency is a bare percentage, and there's no visual record of the habit's history. S6 layers in three changes that align the surface with requirements §10:

1. **A "Become [identity_phrase]" header** at the top, replacing the current habit-title-only header. Identity drives the screen, not the habit's bookkeeping name.
2. **An identity-flavored streak** via `<IdentityStreakDisplay>`, replacing the raw `[N] day(s)` text in the Progress section.
3. **A 90-day heatmap** between Setup and Today, giving the user a visual record of her history. Display-only in this ticket — onCellPress wiring lands in DEV-S6-02.
4. **Consistency copy** updated to *"[N]% over the last 30 days"* per §10.2.

Everything else on the screen stays as-is. The weekly review section, adjustment suggestion, and archive/edit buttons are all preserved exactly. The three known dead/transitional paths (the dropped weekly_reviews query, the latest-review-driven adjustment suggestion that never fires) stay untouched per S5 followup F5 — they reactivate when reviews migrates to local SQLite later.

The risk in this ticket is mostly visual regression — making sure the redesigned chrome doesn't break the existing recent-logs list, the weekly review block, or the archive button submit-lock. Read the existing screen carefully before drafting; preserve the imperative pieces line-for-line; replace only the JSX you mean to replace.

### Files to read first

- `src/features/habits/screens/HabitDetailScreen.tsx` — the file you're modifying. **Read it fully before drafting.** Note how the screen currently composes section cards and the imperative pieces (`activeStateSubmitLockRef`, `archiveHabitMutation`, `handleArchivePress`).
- `src/features/habits/hooks.ts` — confirm `useHabitDetail(habitId)`'s return shape: `error`, `formula`, `habit`, `isLoading`, `isUpcoming`, `latestReview`, `progress`, `recentLogs`. Note that `progress.consistencyRate` is a 0-1 fraction (not a percentage), `progress.streak` is a number, `progress.skipCount` is a number, `progress.todayStatus` is a `HabitLogStatus | null`.
- `src/features/habits/types.ts` — `Habit` row shape; in particular the `identity_phrase: string | null` field.
- `src/features/today/hooks.ts` — `useHabitLogsForRange(habitId, days)` signature and its query key.
- `src/components/Heatmap.tsx` — confirm the prop shape `{ days, logs, onCellPress? }` and the `HeatmapLog` type.
- `src/components/IdentityStreakDisplay.tsx` — confirm `{ identityNoun, streak }` props.
- `src/features/onboarding/identityNoun.ts` — `extractIdentityNoun(phrase)` returns `string | null`.
- `src/features/today/screens/TodayScreen.tsx` — pattern reference for how the Focus card composes "Become" header + identity streak + heatmap.
- `docs/core-v1-requirements.md` §10 (full Habit Detail spec) and §10.2 (consistency formula and copy).

### Files to modify

- `src/features/habits/screens/HabitDetailScreen.tsx` — the modifications described below.

### Files to create

- `src/features/habits/screens/__tests__/HabitDetailScreen.test.tsx` (the screen has no existing tests; create the `__tests__` directory if it doesn't exist).

### Required changes to `HabitDetailScreen.tsx`

The screen's current structure is `<ScrollView>` containing seven blocks: header, upcoming-info card (conditional), Setup section, Today section, Progress section, Recent history section, Weekly review section, optional Suggestion card, and Actions. Modify this structure:

**1. Replace the `<View style={styles.header}>` block.** The current header shows `habit.title` and `formula`. Replace with:

```tsx
<View style={styles.header}>
  {habit.identity_phrase ? (
    <Text selectable style={styles.becomingHeader}>
      Become {habit.identity_phrase}
    </Text>
  ) : null}
  <Text selectable style={styles.title}>
    {habit.title}
  </Text>
  <Text selectable style={styles.formula}>
    {formula}
  </Text>
</View>
```

The "Become" line goes above the title — the identity phrase is the primary header; the habit title (`habit.title`, often a short noun like "Run" or "Read") becomes a secondary label, and the formula stays as the descriptive line. If `identity_phrase` is null/empty, only title + formula render — same as the current screen for those users.

Add `becomingHeader` to `styles`:

```ts
becomingHeader: {
  color: colors.text,
  fontSize: 22,
  fontWeight: "700",
  lineHeight: 30,
},
```

The existing `title` style (`fontSize: 28, fontWeight: "800"`) keeps its prominence relative to `becomingHeader` — `becomingHeader` is slightly smaller/lighter to act as a contextual eyebrow rather than competing with the title.

**2. Insert a new heatmap block between the Setup section and the Today section.** New section card, no section title (the heatmap is its own visual identity), display-only:

```tsx
{!isUpcoming ? (
  <View style={styles.sectionCard}>
    <HabitDetailHeatmap habitId={habit.id} />
  </View>
) : null}
```

Where `HabitDetailHeatmap` is a small inline component at the bottom of the file:

```tsx
function HabitDetailHeatmap({ habitId }: { habitId: string }) {
  const logsQuery = useHabitLogsForRange(habitId, 90);
  if (!logsQuery.data) return null;
  return <Heatmap days={90} logs={logsQuery.data} />;
}
```

Notes:
- Wrapped in `!isUpcoming` because an upcoming habit (whose `start_date` is in the future) has no past history to render — showing 90 empty cells would be misleading. The existing `<View style={styles.infoCard}>` "Starts on..." banner already covers the upcoming state.
- The component renders nothing while loading (returns `null`). The screen doesn't show a loading spinner specifically for the heatmap — the parent screen's `<LoadingState>` already gates everything. By the time the screen is visible, the heatmap query is fetching in the background; the cells appear when ready (typically <100ms from local SQLite).
- `onCellPress` is **not** passed in this ticket. DEV-S6-02 wires it.

**3. Replace the Progress section's streak display.** Currently:

```tsx
<View style={styles.progressItem}>
  <Text selectable style={styles.progressLabel}>
    Streak
  </Text>
  <Text selectable style={styles.progressValue}>
    {formatStreak(progress.streak)}
  </Text>
</View>
```

The Progress section keeps the 30-day skips and Consistency tiles unchanged. **Drop the Streak tile from the Progress grid** and add a standalone identity-flavored streak block above the Progress grid:

```tsx
<View style={styles.sectionCard}>
  <Text selectable style={styles.sectionTitle}>
    Progress
  </Text>
  <IdentityStreakDisplay
    identityNoun={extractIdentityNoun(habit.identity_phrase ?? "")}
    streak={progress.streak}
  />
  <View style={styles.progressGrid}>
    <View style={styles.progressItem}>
      <Text selectable style={styles.progressLabel}>
        30-day skips
      </Text>
      <Text selectable style={styles.progressValue}>
        {progress.skipCount}
      </Text>
    </View>
    <View style={styles.progressItem}>
      <Text selectable style={styles.progressLabel}>
        Consistency
      </Text>
      <Text selectable style={styles.progressValue}>
        {formatConsistency(progress.consistencyRate)} over the last 30 days
      </Text>
    </View>
  </View>
</View>
```

The `IdentityStreakDisplay` sits above the small-tile grid because it carries the most weight visually and emotionally — it's the user's identity, not a metric. The Consistency tile gets the §10.2 copy suffix.

The `formatStreak` helper at the top of the file becomes unused after this change. **Remove the `formatStreak` function** to keep the file clean. ESLint will catch it; verify no other call sites use it before deleting.

**4. Imports to add.**

```tsx
import { Heatmap } from "@/components/Heatmap";
import { IdentityStreakDisplay } from "@/components/IdentityStreakDisplay";
import { extractIdentityNoun } from "@/features/onboarding/identityNoun";
import { useHabitLogsForRange } from "@/features/today/hooks";
```

Order them per the convention (external → expo → @/components → @/features → @/lib → @/services → @/theme → @/utils → relative).

**5. No other changes.** The Setup section, Today section, Recent history, Weekly review, Suggestion card, and Actions stay byte-for-byte. Verify the archive button still works after the redesign (manual: archive a test habit, see the success state).

### Required tests

**`src/features/habits/screens/__tests__/HabitDetailScreen.test.tsx`** — six cases pinning the redesigned chrome:

```tsx
import { render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import HabitDetailScreen from "@/features/habits/screens/HabitDetailScreen";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ habitId: "habit-1" }),
}));

jest.mock("@/features/habits/hooks", () => ({
  useArchiveHabitMutation: jest.fn(),
  useHabitDetail: jest.fn(),
}));

jest.mock("@/features/today/hooks", () => ({
  useHabitLogsForRange: jest.fn(),
}));

const { useHabitDetail, useArchiveHabitMutation } = jest.requireMock(
  "@/features/habits/hooks",
) as {
  useHabitDetail: jest.Mock;
  useArchiveHabitMutation: jest.Mock;
};

const { useHabitLogsForRange } = jest.requireMock(
  "@/features/today/hooks",
) as { useHabitLogsForRange: jest.Mock };

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function makeHabit(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    archived_at: null,
    created_at: "2026-04-01T00:00:00.000Z",
    cue: "morning coffee",
    habit_state: "focus",
    id: "habit-1",
    identity_phrase: "a runner",
    minimum_viable_action: null,
    preferred_time_window: null,
    start_date: "2026-04-01",
    status: "active",
    tiny_action: "run for 2 minutes",
    title: "Run",
    updated_at: "2026-04-01T00:00:00.000Z",
    user_id: "user-1",
    ...overrides,
  };
}

function makeProgress(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    consistencyRate: 0.85,
    skipCount: 2,
    streak: 12,
    todayStatus: null,
    ...overrides,
  };
}

describe("HabitDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNowForTesting(new Date("2026-04-30T10:00:00.000Z"));
    useArchiveHabitMutation.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      isPending: false,
      error: null,
    });
    useHabitLogsForRange.mockReturnValue({ data: [] });
  });

  afterEach(() => {
    resetClockForTesting();
  });

  it("renders the 'Become [identity_phrase]' header when identity phrase is present", () => {
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: makeHabit(),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress(),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    expect(screen.getByText("Become a runner")).toBeTruthy();
  });

  it("does not render the 'Become' header when identity_phrase is null", () => {
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: makeHabit({ identity_phrase: null }),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress(),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    expect(screen.queryByText(/^Become /)).toBeNull();
  });

  it("renders identity-flavored streak copy with the extracted noun", () => {
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: makeHabit(),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress({ streak: 12 }),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    expect(screen.getByText("You've been a runner for 12 days.")).toBeTruthy();
  });

  it("renders consistency with the §10.2 'over the last 30 days' suffix", () => {
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: makeHabit(),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress({ consistencyRate: 0.85 }),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    expect(screen.getByText("85% over the last 30 days")).toBeTruthy();
  });

  it("renders the 90-day heatmap when logs are loaded", () => {
    useHabitLogsForRange.mockReturnValue({
      data: [
        { log_date: "2026-04-29", status: "done" },
        { log_date: "2026-04-28", status: "skipped" },
      ],
    });
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: makeHabit(),
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: makeProgress(),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    // The heatmap renders 90 cells with accessibilityLabel.
    // We assert one of the logged cells is colored as expected via its label.
    expect(screen.getByLabelText("2026-04-29, done")).toBeTruthy();
    expect(screen.getByLabelText("2026-04-28, skipped")).toBeTruthy();
  });

  it("does not render the heatmap when habit is upcoming", () => {
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: makeHabit({ start_date: "2026-05-15" }),
      isLoading: false,
      isUpcoming: true,
      latestReview: null,
      progress: makeProgress({ streak: 0 }),
      recentLogs: [],
    });
    renderWithClient(<HabitDetailScreen />);
    expect(screen.getByText(/Starts on /)).toBeTruthy();
    // No heatmap cells.
    expect(screen.queryByLabelText("Today, not logged")).toBeNull();
  });
});
```

Six cases cover: (a) "Become" header shows with phrase, (b) hides without, (c) identity-flavored streak with extracted noun, (d) consistency copy suffix, (e) heatmap renders logged cells correctly, (f) heatmap suppressed for upcoming habits. The fallback streak copy ("You've shown up [N] day(s) for this habit.") and 0-streak copy ("Day one. Start showing up.") are already tested in `IdentityStreakDisplay.test.tsx` from S5; no need to duplicate here.

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes — six new HabitDetailScreen tests, plus everything pre-existing.
- Manual: navigate to a habit's detail screen on a simulator (from a working test account with at least one Focus habit and 5+ days of logs). Verify: "Become [identity_phrase]" header at the top, then habit title, then formula. Setup section unchanged. New heatmap section appears between Setup and Today (90 cells, today outlined if unlogged, recent Done/Skipped cells visibly colored). Progress section shows the identity-flavored streak above the skips/consistency tiles. Consistency reads `"[N]% over the last 30 days"`. Recent history, Weekly review section, Adjustment suggestion (if any), and Archive/Edit/Back buttons all unchanged. Tap Archive — habit archives without error.
- No regressions: Today, Edit Habit, Create Habit, Reviews, Library tab, sign-in/sign-up, onboarding all behave as they did at close of S5.

### References

- `docs/core-v1-requirements.md` §10 (Habit Detail), §10.2 (Consistency).
- `sprint-5-tickets.md` DEV-S5-03 (TodayScreen pattern reference for "Become" header + identity streak composition).
- `src/features/today/screens/TodayScreen.tsx` (composition pattern reference).
- `src/components/Heatmap.tsx`, `src/components/IdentityStreakDisplay.tsx`, `src/features/onboarding/identityNoun.ts`.

### Out of scope

- Heatmap cell taps — DEV-S6-02.
- Visual differentiation of pre-start cells — followup F1.
- Touching the weekly review section — stays untouched per S5 F5.
- Touching the adjustment suggestion section — same reasoning.
- Removing the `formatStreak` helper if other call sites turn out to use it — verify before deleting; if it has other callers, leave it.
- Refactoring `HabitDetailScreen` to extract sections into subcomponents — keep the inline structure for now; if the file grows past ~500 lines, extract in a future polish pass.

---

## DEV-S6-02 — Retro-log selector + 48-hour window enforcement

**Estimate:** 1.0 day
**Depends on:** DEV-S6-01 merged into `sprint-6`.
**Branch suggestion:** `s6/retro-log-selector`

### Context

The interaction ticket. The 90-day heatmap shipped in DEV-S6-01 is display-only; this ticket layers the retro-log selector on top so a user can correct yesterday's missed log (or earlier within the 48-hour window). After this ticket: tapping a recent unlogged cell opens a Done | Skip selector; tapping a recent logged cell opens the same selector pre-set to the current status (so the user can change it within the window); tapping a cell older than the 48-hour window opens a read-only display of the date and status; tapping a cell before `habit.start_date` does nothing.

The risk concentration here is the day-boundary math at midnight (named risk #4 in `sprint-plan.md` §9). The existing `isWithinRetroWindow` in `features/habits/api.ts` is correct — it computes `endOfLogDay + 48h` against `now()`. The selector trusts that helper. The trick is in two places: (a) the parent passing the right `canEdit` boolean to the selector based on the same helper, so the UI doesn't show the editor for a cell the API will reject; and (b) testing the boundary at clock values that cross midnight in both directions.

The `RetroLogError` is the single source of truth for window enforcement. The UI exists to surface it cleanly; when it fires, a user-facing error message appears in the selector.

### Files to read first

- `src/features/habits/api.ts` — confirm `RetroLogError`, `RetroLogReason`, the `isWithinRetroWindow` helper (currently file-local — you'll export it), and `upsertHabitLog`'s validation order.
- `src/features/habits/contract.ts` — the `RETRO_LOG_WINDOW_HOURS` constant and any existing log-status enums.
- `src/features/habits/types.ts` — `HabitLogStatus`, `UpsertHabitLogPayload`.
- `src/features/today/hooks.ts` — read `useUpsertTodayHabitStatusMutation` carefully. The new hook borrows its invalidation pattern, then layers in the per-habit range key invalidation already added in S5.
- `src/features/habits/hooks.ts` — find the habit detail query key (used by `useHabitDetail`). The new mutation hook invalidates that key on success.
- `src/utils/userFacingErrors.ts` — pattern reference for the new error-message functions.
- `src/components/buttons/PrimaryButton.tsx` and `SecondaryButton.tsx` — for the Done/Skip row in the selector.
- `docs/core-v1-requirements.md` §7.3 (retroactive logging), §7.4 (editing logs), §9.4 (heatmap interaction).

### Files to create

- `src/features/habits/components/RetroLogSelector.tsx`
- `src/features/habits/components/__tests__/RetroLogSelector.test.tsx`
- `src/features/habits/__tests__/useUpsertHabitLogMutation.test.ts` (integration test for the mutation + retro window)

### Files to modify

- `src/features/habits/api.ts` — export `isWithinRetroWindow` (currently file-local).
- `src/features/habits/hooks.ts` — add `useUpsertHabitLogMutation`.
- `src/features/habits/screens/HabitDetailScreen.tsx` — wire `Heatmap.onCellPress`, integrate the selector, wire the mutation.
- `src/features/habits/screens/__tests__/HabitDetailScreen.test.tsx` — add cell-tap and selector-state tests.
- `src/utils/userFacingErrors.ts` — add four functions + dispatcher per (D9).

### Required exports / signatures

**`src/features/habits/api.ts`** — export the existing helper. Change:

```ts
function isWithinRetroWindow(logDate: string, currentTime: Date): boolean {
```

to:

```ts
export function isWithinRetroWindow(logDate: string, currentTime: Date): boolean {
```

No behavior change.

**`src/utils/userFacingErrors.ts`** — add at the bottom of the file (per the existing convention of one function per facing message):

```ts
import type { RetroLogReason } from "@/features/habits/api";

export function getRetroLogOutsideWindowErrorMessage() {
  return "This day was more than 48 hours ago. It's locked.";
}

export function getRetroLogBeforeStartDateErrorMessage() {
  return "This day is before your habit started.";
}

export function getRetroLogFutureDateErrorMessage() {
  return "That day hasn't happened yet.";
}

export function getRetroLogHabitArchivedErrorMessage() {
  return "This habit is archived. Reactivate it to log.";
}

export function getRetroLogErrorMessage(reason: RetroLogReason): string {
  switch (reason) {
    case "outside_window":
      return getRetroLogOutsideWindowErrorMessage();
    case "before_start_date":
      return getRetroLogBeforeStartDateErrorMessage();
    case "future_date":
      return getRetroLogFutureDateErrorMessage();
    case "habit_archived":
      return getRetroLogHabitArchivedErrorMessage();
  }
}
```

The dispatcher uses an exhaustive switch with no default — if `RetroLogReason` ever gains a fifth member, TypeScript will flag this site immediately. Avoid `default: return "Something went wrong."` — silent fallbacks hide bugs.

**`src/features/habits/hooks.ts`** — add the new mutation hook. Pseudo-shape (verify the exact query keys against what `useHabitDetail` and the Today hooks register):

```ts
import { now, todayDateString } from "@/utils/clock";
import {
  getHabitLogsRangeQueryKey,
  getUserHabitLogsRangeQueryKey,
} from "@/features/today/hooks";
import { TODAY_PROGRESS_WINDOW_DAYS } from "@/features/today/constants";
import {
  addDeviceDays,
  getTrailingDateRangeStrings,
  toDeviceDateString,
} from "@/utils/dates";
import { upsertHabitLog } from "@/features/habits/api";
import { useAuthSession } from "@/features/auth/hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logger } from "@/services/logger";

import type { HabitLog, HabitLogStatus } from "@/features/habits/types";

type UpsertHabitLogVariables = {
  habitId: string;
  logDate: string; // YYYY-MM-DD device-local
  status: HabitLogStatus;
};

export function useUpsertHabitLogMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      habitId,
      logDate,
      status,
    }: UpsertHabitLogVariables): Promise<HabitLog> => {
      if (!user?.id) {
        throw new Error("You need an account session before logging a habit.");
      }
      return upsertHabitLog(user.id, { habitId, logDate, status });
    },
    onSuccess: async (_data, variables) => {
      if (!user?.id) return;

      // 1) Heatmap range query for this habit.
      await queryClient.invalidateQueries({
        queryKey: ["habit_logs", "range", variables.habitId],
      });

      // 2) Today aggregate query.
      const { endDate, startDate } = getTrailingDateRangeStrings(
        TODAY_PROGRESS_WINDOW_DAYS,
      );
      await queryClient.invalidateQueries({
        queryKey: getUserHabitLogsRangeQueryKey(user.id, startDate, endDate),
      });

      // 3) Habit detail query — find its key in features/habits/hooks.ts.
      //    Replace the placeholder below with the actual key shape.
      await queryClient.invalidateQueries({
        queryKey: ["habit-detail", variables.habitId],
      });
    },
    onError: (error, variables) => {
      logger.error("Retro log mutation failed", {
        error,
        habitId: variables.habitId,
        logDate: variables.logDate,
        status: variables.status,
        userId: user?.id ?? null,
      });
    },
  });
}
```

**Verify** the third invalidation key against what `useHabitDetail` registers. If `useHabitDetail` constructs its key as `["habit", habitId]` or `["habit-detail", habitId]` or includes the user id, match the actual shape. If the key isn't exported as a helper, export one (`getHabitDetailQueryKey(habitId)`) for both sides to share — copy-pasted query keys drift.

**`src/features/habits/components/RetroLogSelector.tsx`**

```tsx
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { RetroLogError } from "@/features/habits/api";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getRetroLogErrorMessage } from "@/utils/userFacingErrors";

import type { HabitLogStatus } from "@/features/habits/types";

type RetroLogSelectorProps = {
  canEdit: boolean;
  currentStatus: HabitLogStatus | null;
  date: string; // YYYY-MM-DD device-local
  isVisible: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (status: HabitLogStatus) => Promise<void>;
};

export function RetroLogSelector({
  canEdit,
  currentStatus,
  date,
  isVisible,
  isPending,
  onClose,
  onSubmit,
}: RetroLogSelectorProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handlePress(status: HabitLogStatus) {
    setErrorMessage(null);
    try {
      await onSubmit(status);
      onClose();
    } catch (error) {
      if (error instanceof RetroLogError) {
        setErrorMessage(getRetroLogErrorMessage(error.reason));
      } else {
        setErrorMessage("Something went wrong. Try again.");
      }
    }
  }

  function handleClose() {
    setErrorMessage(null);
    onClose();
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleClose}
      transparent
      visible={isVisible}
    >
      <Pressable accessibilityLabel="Close selector" onPress={handleClose} style={styles.backdrop}>
        <Pressable onPress={() => undefined} style={styles.card}>
          <Text selectable style={styles.dateLabel}>
            {formatDateLabel(date)}
          </Text>
          {currentStatus ? (
            <Text selectable style={styles.statusLabel}>
              Currently {currentStatus}
            </Text>
          ) : null}
          {errorMessage ? <ErrorState message={errorMessage} /> : null}
          {canEdit ? (
            <View style={styles.actionsRow}>
              <PrimaryButton
                disabled={isPending}
                label={currentStatus === "done" ? "Done ✓" : "Done"}
                onPress={() => void handlePress("done")}
              />
              <SecondaryButton
                disabled={isPending}
                label={currentStatus === "skipped" ? "Skipped ✓" : "Skip"}
                onPress={() => void handlePress("skipped")}
              />
            </View>
          ) : (
            <Text selectable style={styles.lockedText}>
              This day is locked. Logs older than 48 hours can't be changed.
            </Text>
          )}
          <SecondaryButton label="Close" onPress={handleClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function formatDateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.lg,
    padding: spacing.xl,
    width: "100%",
  },
  dateLabel: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "700",
  },
  lockedText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  statusLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontStyle: "italic",
  },
});
```

Notes:
- The outer `<Pressable onPress={handleClose}>` over the backdrop dismisses the modal on tap-outside. The inner `<Pressable onPress={() => undefined}>` over the card prevents that tap-outside from firing when tapping the card itself.
- `RetroLogError` is caught **inside the selector**, not in the mutation. The mutation throws on rejection; the selector decides how to surface the error. This keeps the selector self-contained and makes the test surface clean.
- The "Done ✓" / "Skipped ✓" suffix on currently-selected actions matches the TodayScreen pattern from S5 (D-local-1).
- No "Missed" button per (D8).
- The Modal's `animationType="fade"` keeps the iOS/Android transition consistent. `transparent` is required to render the backdrop ourselves.
- `typography.title` is used for the date — verify the token name in `theme/typography.ts`. If the existing token is named differently (e.g., `typography.h2`), use that.

**`src/features/habits/screens/HabitDetailScreen.tsx`** — wire the cell-tap handler, mutation, and selector. Add to the existing screen (between Setup and Today, the heatmap section already exists from S6-01):

```tsx
// Inside the HabitDetailScreen component, after existing hooks:
const upsertHabitLogMutation = useUpsertHabitLogMutation();
const retroLogSubmitLockRef = useRef(false);
const [selectorState, setSelectorState] = useState<{
  visible: boolean;
  date: string;
  currentStatus: HabitLogStatus | null;
  canEdit: boolean;
} | null>(null);

const heatmapLogs = useHabitLogsForRange(habit?.id, 90).data ?? [];

function handleCellPress(date: string) {
  if (!habit) return;

  // (D4) Pre-start cells: silently no-op.
  if (date < habit.start_date) return;

  // Find existing log for this date.
  const existing = heatmapLogs.find((log) => log.log_date === date);
  const currentStatus = existing?.status ?? null;

  // (D6) canEdit derived from window helper.
  const canEdit = isWithinRetroWindow(date, now());

  setSelectorState({ visible: true, date, currentStatus, canEdit });
}

async function handleSelectorSubmit(status: HabitLogStatus) {
  if (!habit || !selectorState || retroLogSubmitLockRef.current) return;
  if (upsertHabitLogMutation.isPending) return;

  retroLogSubmitLockRef.current = true;
  try {
    await upsertHabitLogMutation.mutateAsync({
      habitId: habit.id,
      logDate: selectorState.date,
      status,
    });
  } finally {
    retroLogSubmitLockRef.current = false;
  }
}

function handleSelectorClose() {
  setSelectorState(null);
}
```

Then inside the `HabitDetailHeatmap` subcomponent (defined at the bottom of the file in S6-01), pass `onCellPress`:

```tsx
function HabitDetailHeatmap({
  habitId,
  onCellPress,
}: {
  habitId: string;
  onCellPress?: (date: string) => void;
}) {
  const logsQuery = useHabitLogsForRange(habitId, 90);
  if (!logsQuery.data) return null;
  return <Heatmap days={90} logs={logsQuery.data} onCellPress={onCellPress} />;
}
```

And update the call site:

```tsx
<HabitDetailHeatmap habitId={habit.id} onCellPress={handleCellPress} />
```

And render the selector at the bottom of the ScrollView (or anywhere — Modal renders above its parent regardless of position):

```tsx
{selectorState ? (
  <RetroLogSelector
    canEdit={selectorState.canEdit}
    currentStatus={selectorState.currentStatus}
    date={selectorState.date}
    isVisible={selectorState.visible}
    isPending={upsertHabitLogMutation.isPending}
    onClose={handleSelectorClose}
    onSubmit={handleSelectorSubmit}
  />
) : null}
```

**Imports to add:**

```tsx
import { useState } from "react";
import { isWithinRetroWindow } from "@/features/habits/api";
import { RetroLogSelector } from "@/features/habits/components/RetroLogSelector";
import { useUpsertHabitLogMutation } from "@/features/habits/hooks";
import { now } from "@/utils/clock";

import type { HabitLogStatus } from "@/features/habits/types";
```

**Note on data freshness.** The `heatmapLogs` array on the screen is sourced from `useHabitLogsForRange(habit?.id, 90)`, which is the same query the heatmap consumes. After the mutation succeeds, the heatmap range query is invalidated (per the new mutation hook's `onSuccess`), so the next render shows the updated cell color. The selector closes on success (in the selector's `handlePress` → `onClose()`), and the user sees the updated heatmap.

### Required tests

**`src/features/habits/__tests__/useUpsertHabitLogMutation.test.ts`** — integration test for the mutation against the real SQLite repos:

```ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

import { RetroLogError } from "@/features/habits/api";
import { useUpsertHabitLogMutation } from "@/features/habits/hooks";
import { closeDb, initDb } from "@/lib/db/client";
import { createHabit } from "@/lib/db/repositories/habits";
import { listLogs } from "@/lib/db/repositories/habit_logs";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function seedActiveHabit(startDate: string) {
  await createHabit({
    user_id: "user-1",
    title: "Run",
    identity_phrase: "a runner",
    cue: "morning coffee",
    tiny_action: "run for 2 minutes",
    minimum_viable_action: null,
    preferred_time_window: null,
    start_date: startDate,
    habit_state: "focus",
    status: "active",
  });
}

describe("useUpsertHabitLogMutation — 48-hour retro window", () => {
  beforeEach(async () => {
    await initDb({ inMemory: true });
  });

  afterEach(async () => {
    await closeDb();
    resetClockForTesting();
  });

  it("succeeds for a 36-hour-old day (within window)", async () => {
    setNowForTesting(new Date("2026-04-30T22:00:00.000Z"));
    await seedActiveHabit("2026-04-01");
    const habit = (await listHabitsForUser("user-1"))[0];

    const { result } = renderHook(() => useUpsertHabitLogMutation(), { wrapper });

    await result.current.mutateAsync({
      habitId: habit.id,
      logDate: "2026-04-29",
      status: "done",
    });

    const logs = await listLogs({ habit_id: habit.id });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("done");
    expect(logs[0].log_date).toBe("2026-04-29");
  });

  it("rejects a 60-hour-old day with RetroLogError(outside_window)", async () => {
    setNowForTesting(new Date("2026-04-30T22:00:00.000Z"));
    await seedActiveHabit("2026-04-01");
    const habit = (await listHabitsForUser("user-1"))[0];

    const { result } = renderHook(() => useUpsertHabitLogMutation(), { wrapper });

    await expect(
      result.current.mutateAsync({
        habitId: habit.id,
        logDate: "2026-04-27",
        status: "done",
      }),
    ).rejects.toBeInstanceOf(RetroLogError);

    const logs = await listLogs({ habit_id: habit.id });
    expect(logs).toHaveLength(0);
  });

  it("rejects a date before habit.start_date with RetroLogError(before_start_date)", async () => {
    setNowForTesting(new Date("2026-04-30T10:00:00.000Z"));
    await seedActiveHabit("2026-04-29");
    const habit = (await listHabitsForUser("user-1"))[0];

    const { result } = renderHook(() => useUpsertHabitLogMutation(), { wrapper });

    await expect(
      result.current.mutateAsync({
        habitId: habit.id,
        logDate: "2026-04-28",
        status: "done",
      }),
    ).rejects.toMatchObject({ reason: "before_start_date" });
  });

  it("succeeds at the 48-hour boundary minus one second", async () => {
    // Boundary case (D6): logDate = April 28, now = April 30 23:59:58 local.
    // endOfLogDay = April 28 23:59:59.999, +48h = April 30 23:59:59.999.
    // now is one second before that — should succeed.
    setNowForTesting(new Date("2026-04-30T23:59:58.000"));
    await seedActiveHabit("2026-04-01");
    const habit = (await listHabitsForUser("user-1"))[0];

    const { result } = renderHook(() => useUpsertHabitLogMutation(), { wrapper });

    await result.current.mutateAsync({
      habitId: habit.id,
      logDate: "2026-04-28",
      status: "done",
    });

    const logs = await listLogs({ habit_id: habit.id });
    expect(logs).toHaveLength(1);
  });

  it("rejects at the 48-hour boundary plus one second", async () => {
    setNowForTesting(new Date("2026-05-01T00:00:01.000"));
    await seedActiveHabit("2026-04-01");
    const habit = (await listHabitsForUser("user-1"))[0];

    const { result } = renderHook(() => useUpsertHabitLogMutation(), { wrapper });

    await expect(
      result.current.mutateAsync({
        habitId: habit.id,
        logDate: "2026-04-28",
        status: "done",
      }),
    ).rejects.toMatchObject({ reason: "outside_window" });
  });

  it("crosses midnight cleanly: 23:59 same day vs 00:01 next day", async () => {
    // Verify the day-boundary risk #4.
    // logDate = April 29, log it at April 30 23:59:00 local (within window).
    setNowForTesting(new Date("2026-04-30T23:59:00.000"));
    await seedActiveHabit("2026-04-01");
    const habit = (await listHabitsForUser("user-1"))[0];

    const { result, rerender } = renderHook(() => useUpsertHabitLogMutation(), { wrapper });

    await result.current.mutateAsync({
      habitId: habit.id,
      logDate: "2026-04-29",
      status: "done",
    });

    // Now advance to May 1 00:01 local. April 29 should now be outside window.
    setNowForTesting(new Date("2026-05-01T00:01:00.000"));
    rerender({});

    // Try to change April 29's log to skipped — should now reject.
    await expect(
      result.current.mutateAsync({
        habitId: habit.id,
        logDate: "2026-04-29",
        status: "skipped",
      }),
    ).rejects.toMatchObject({ reason: "outside_window" });

    // Verify the original done log is still in place (unchanged).
    const logs = await listLogs({ habit_id: habit.id });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("done");
  });
});
```

The midnight-boundary tests are the meat of this test file. The boundary cases (`23:59:58` succeeds, `00:00:01` next-next-day rejects) lock down the named risk explicitly. Test 6 covers the "user changes a log just inside the window, then comes back later and tries to change it again" case.

A helper `listHabitsForUser(userId)` may need to be added if the existing `listHabits({ user_id })` repo function isn't a direct match — verify against `lib/db/repositories/habits.ts`. If `listHabits` works with a partial filter, use it directly.

**`src/features/habits/components/__tests__/RetroLogSelector.test.tsx`** — render and interaction tests:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { RetroLogError } from "@/features/habits/api";
import { RetroLogSelector } from "@/features/habits/components/RetroLogSelector";

describe("RetroLogSelector", () => {
  function makeProps(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      canEdit: true,
      currentStatus: null,
      date: "2026-04-29",
      isVisible: true,
      isPending: false,
      onClose: jest.fn(),
      onSubmit: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it("renders Done and Skip when canEdit is true", () => {
    render(<RetroLogSelector {...makeProps()} />);
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("Skip")).toBeTruthy();
  });

  it("renders the locked message and no Done/Skip when canEdit is false", () => {
    render(<RetroLogSelector {...makeProps({ canEdit: false })} />);
    expect(
      screen.getByText("This day is locked. Logs older than 48 hours can't be changed."),
    ).toBeTruthy();
    expect(screen.queryByText("Done")).toBeNull();
    expect(screen.queryByText("Skip")).toBeNull();
  });

  it("shows current status when one exists", () => {
    render(<RetroLogSelector {...makeProps({ currentStatus: "done" })} />);
    expect(screen.getByText("Currently done")).toBeTruthy();
    expect(screen.getByText("Done ✓")).toBeTruthy();
  });

  it("calls onSubmit with 'done' when Done is tapped, then closes", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    render(<RetroLogSelector {...makeProps({ onClose, onSubmit })} />);
    fireEvent.press(screen.getByText("Done"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("done"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("surfaces RetroLogError reason as user-facing copy", async () => {
    const onSubmit = jest
      .fn()
      .mockRejectedValueOnce(new RetroLogError("outside_window"));
    const onClose = jest.fn();
    render(<RetroLogSelector {...makeProps({ onClose, onSubmit })} />);
    fireEvent.press(screen.getByText("Done"));
    await waitFor(() =>
      expect(
        screen.getByText("This day was more than 48 hours ago. It's locked."),
      ).toBeTruthy(),
    );
    expect(onClose).not.toHaveBeenCalled(); // stays open so user can dismiss
  });

  it("renders nothing when isVisible is false", () => {
    render(<RetroLogSelector {...makeProps({ isVisible: false })} />);
    expect(screen.queryByText("Done")).toBeNull();
  });
});
```

**Extensions to `src/features/habits/screens/__tests__/HabitDetailScreen.test.tsx`** — three new tests:

```tsx
it("opens the selector with canEdit=true when an in-window cell is tapped", async () => {
  // Seed: today is April 30. April 29's log is null. Tap April 29's cell.
  // Expected: selector opens with Done | Skip visible.
  // (Use accessibilityLabel "2026-04-29, not logged" to find the cell;
  //  fireEvent.press it; assert Done button is visible.)
});

it("opens the selector with canEdit=false when an out-of-window cell is tapped", async () => {
  // Tap a cell from 5 days ago. Selector should open with the locked-message
  // visible and no Done/Skip buttons.
});

it("does not open the selector when a cell before habit.start_date is tapped", async () => {
  // Set habit.start_date to today minus 3 days. Tap a cell from 5 days ago
  // (which is before start_date). Selector should NOT open.
});
```

Sketch only — fill in the mocking machinery the same way the DEV-S6-01 test file does. Mock `useUpsertHabitLogMutation` similarly. The selector tests above already cover its internal behavior; the screen tests just verify the parent wires the right props.

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes — all new tests, all extensions, all pre-existing.
- Manual on a simulator with a habit that has 5+ days of logs:
  1. Open Habit Detail. Tap today's cell on the heatmap. Selector opens with "Today, not logged" or current status. Tap Done. Selector closes; today's cell turns green within one second; the streak/consistency tiles update.
  2. Tap yesterday's cell (assume it was a Missed day). Selector opens with Done | Skip visible. Tap Skip. Selector closes; yesterday's cell turns soft tan within one second.
  3. Tap a cell from 5 days ago. Selector opens with the "This day is locked" message and no Done/Skip buttons. Tap Close. Selector dismisses.
  4. Tap a cell from before the habit's start date. **Nothing happens** (no selector, no error toast).
  5. Force-close the app and reopen. Yesterday's Skip and today's Done are persisted. The streak number reflects the changes.
- No regressions: archive button still works; weekly review section still renders the empty-state copy; adjustment suggestion still doesn't appear (because latest review is null); navigation back to Today works.

### References

- `docs/core-v1-requirements.md` §7.3, §7.4, §9.4.
- `src/features/habits/api.ts` (the `RetroLogError` and `isWithinRetroWindow` you're surfacing).
- `src/features/today/hooks.ts` (mutation pattern reference + range query key).
- `sprint-5-tickets.md` DEV-S5-03 (the existing today mutation with three-key invalidation).
- `sprint-plan.md` §9 risk #4 (the day-boundary risk this ticket pins down).

### Out of scope

- Migrating `useUpsertTodayHabitStatusMutation` to use the new general-purpose hook — followup, not S6.
- Bottom-sheet UI for the selector — followup if beta asks.
- Visual differentiation of pre-start cells — followup.
- A "clear log" / "remove log" action — not in scope per (D8).
- A "Missed" button on the selector — not in scope per (D8).
- Surface error from the parent screen (red banner) when mutation fails for non-RetroLog reasons — the selector's internal `errorMessage` state is sufficient.

---

## DEV-S6-03 — Test gap closure (F4 pull-up + F3 from S5 followups)

**Estimate:** 0.5 day
**Depends on:** DEV-S6-02 merged into `sprint-6`.
**Branch suggestion:** `s6/test-gap-closure`

### Context

Two test gaps from S5 followups, closed before S6 ships. F4 is the higher-priority closure: S5's TodayScreen tests mock `useHabitLogsForRange` and `useUpsertTodayHabitStatusMutation` entirely, leaving the round-trip "tap Done → invalidate → refetch → cell turns green" proven only by Appium smoke. S6 introduced more mutation surfaces (the retro selector); the smoke alone gets harder as the surface grows. F3 is small bonus closure: two existing TodayScreen error paths that S5 didn't test.

This ticket adds tests but changes no production code. The risk is zero — a failing test exposes a regression, not a regression itself.

### Files to read first

- `sprint-5-followups.md` F3 and F4 — the prose specifications of what these tests should cover.
- `src/features/today/__tests__/TodayScreen.test.tsx` — the existing seven-test file you're extending.
- `src/features/today/screens/TodayScreen.tsx` — confirm the two error paths (load error from `useTodayHabits().error`; save error from `useUpsertTodayHabitStatusMutation.error`).
- `src/features/today/hooks.ts` — the real hooks you'll un-mock for F4's integration test.
- `src/lib/db/repositories/habits.ts` and `habit_logs.ts` — the SQLite repos the F4 test exercises.
- `src/tests/setup/sqliteTestAdapter.ts` and `createTestDb.ts` — the in-memory SQLite test plumbing.

### Files to modify

- `src/features/today/__tests__/TodayScreen.test.tsx` — add F3 tests directly here (small, fits in the existing file).

### Files to create

- `src/features/today/__tests__/TodayScreen.integration.test.tsx` — F4 lives in a new file because it uses the real query hooks and real SQLite, rather than the unit tests' mock-everything approach.

### Required tests

**F3 — TodayScreen error path tests, in the existing test file.** Add these two tests after the seven existing cases:

```tsx
it("renders a load error state when useTodayHabits returns an error", () => {
  useTodayHabits.mockReturnValue({
    habits: [],
    upcomingHabits: [],
    isLoading: false,
    error: new Error("Failed to load"),
  });
  renderWithClient(<TodayScreen />);
  // The error text comes from getLoadHabitsErrorMessage() — assert via that
  // helper rather than a hardcoded string, in case the copy changes.
  expect(screen.getByText(getLoadHabitsErrorMessage())).toBeTruthy();
});

it("renders a save error state when the mutation has an error", () => {
  useUpsertTodayHabitStatusMutation.mockReturnValue({
    mutateAsync: jest.fn().mockRejectedValue(new Error("Save failed")),
    isPending: false,
    error: new Error("Save failed"),
  });
  useTodayHabits.mockReturnValue({
    habits: [makeHabit()],
    upcomingHabits: [],
    isLoading: false,
    error: null,
  });
  renderWithClient(<TodayScreen />);
  expect(screen.getByText(getSaveTodayStatusErrorMessage())).toBeTruthy();
});
```

Add the necessary import:

```tsx
import {
  getLoadHabitsErrorMessage,
  getSaveTodayStatusErrorMessage,
} from "@/utils/userFacingErrors";
```

**F4 — TodayScreen integration test, in a new file.** This one un-mocks the real hooks and uses real in-memory SQLite. The shape:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import TodayScreen from "@/features/today/screens/TodayScreen";
import { closeDb, initDb } from "@/lib/db/client";
import { createHabit } from "@/lib/db/repositories/habits";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("TodayScreen integration — heatmap refresh round-trip", () => {
  beforeEach(async () => {
    setNowForTesting(new Date("2026-04-30T10:00:00.000Z"));
    await initDb({ inMemory: true });
    await createHabit({
      user_id: "user-1",
      title: "Run",
      identity_phrase: "a runner",
      cue: "morning coffee",
      tiny_action: "run for 2 minutes",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-01",
      habit_state: "focus",
      status: "active",
    });
  });

  afterEach(async () => {
    await closeDb();
    resetClockForTesting();
  });

  it("turns today's heatmap cell green when Done is tapped", async () => {
    renderWithClient(<TodayScreen />);

    // Wait for initial render with empty Today cell.
    await waitFor(() => {
      expect(screen.getByLabelText("Today, not logged")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Done"));

    // After mutation + invalidation + refetch, today's cell should be marked done.
    await waitFor(
      () => {
        expect(screen.getByLabelText("Today, done")).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it("turns today's heatmap cell soft tan when Skip is tapped", async () => {
    renderWithClient(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Today, not logged")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Skip"));

    await waitFor(
      () => {
        expect(screen.getByLabelText("Today, skipped")).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });
});
```

Notes:
- The integration test relies on the SQLite test adapter from S1 (`src/tests/setup/sqliteTestAdapter.ts` + `createTestDb.ts`). The `initDb({ inMemory: true })` call is the standard pattern from the S1 repository tests; verify the adapter signature.
- The test mocks `useAuthSession` to return a stable user but **does not** mock `useTodayHabits`, `useUpsertTodayHabitStatusMutation`, or `useHabitLogsForRange`. They run for real.
- The `waitFor` timeouts are generous (3000ms) because the round-trip involves: the mutation, three invalidations, the refetch, and a re-render. Local SQLite is fast but Jest's microtask scheduling adds variance. Keep the timeout if flaky.
- Two cases (Done and Skip) cover both common log paths through the mutation.

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes — F3's two new tests, F4's two new tests, all S6-01 and S6-02 tests, all pre-existing.
- The two F4 tests pass on a clean run AND on a re-run (no flakiness — if either flakes, increase timeout to 5000ms or investigate the underlying race).

### References

- `sprint-5-followups.md` F3 and F4.
- `sprint-1-tickets.md` repository test pattern (in-memory SQLite setup).
- `src/tests/setup/sqliteTestAdapter.ts` (the test plumbing).

### Out of scope

- Changing any production code in TodayScreen, hooks, or repos.
- F5 (the dead `latestReviewQueries` block) — stays untouched per the followup spec.
- F1 / F2 from S5 — neither is closable in S6 (F1 needs beta data, F2 needs beta logging).

---

## DEV-S6-04 — Manual smoke, PROJECT_BRAIN update, S6 followups doc

**Estimate:** 0.25 day
**Depends on:** DEV-S6-03 merged into `sprint-6`.
**Branch suggestion:** `s6/smoke-and-docs`

### Context

Closes the sprint. Manual end-to-end smoke checklist on a real simulator or device, PROJECT_BRAIN §11 update reflecting S6 closure, and a `sprint-6-followups.md` for the deferred items (pre-start cell visual differentiation; consolidation of the today and general-purpose mutation hooks; anything else surfaced during smoke).

### Files to modify

- `docs/PROJECT_BRAIN.md` — update §11 with S6 closure note.

### Files to create

- `docs/sprint_tickets/sprint-6-followups.md`

### Manual smoke checklist

Run on a real simulator or device. Mark each item ✅ before merging `sprint-6` into `main`.

1. **Habit Detail chrome.** From Today, tap a Focus habit (or navigate via Settings → Habit Management → habit row). Verify: "Become [identity_phrase]" header at top; habit title and formula below; Setup card unchanged; new heatmap section appears between Setup and Today; Today's cell is outlined if unlogged; Progress section shows identity-flavored streak above skips/consistency tiles; consistency reads "[N]% over the last 30 days"; Recent history, Weekly review section (empty-state copy), and Archive/Edit/Back buttons all unchanged.
2. **In-window retro log — within 24h.** Hand-craft state: yesterday is Missed (no log). Tap yesterday's cell on the heatmap. Selector opens. "Yesterday, [date]" appears. Done | Skip both visible. Tap Skip. Selector closes. Yesterday's cell turns soft tan within one second. Streak number updates appropriately (Skip is neutral — streak should be unchanged from before).
3. **In-window retro log — change a log.** Tap yesterday's cell again (now Skipped). Selector reopens with "Currently skipped" and "Skipped ✓" highlighted. Tap Done. Selector closes. Cell turns green. Streak increments by 1 (Skipped → Done changes the count).
4. **Today cell via heatmap.** Tap today's cell on the heatmap (currently null or whatever state). Selector opens. Tap Done. Cell turns green. Today's status updates on the screen. Navigate back to Today and confirm: the Focus card on Today shows Done as selected (the mutation's invalidation propagated to the today aggregate).
5. **Out-of-window cell — read-only.** Tap a cell from 5 days ago. Selector opens. "[Date]" label visible. "This day is locked. Logs older than 48 hours can't be changed." text visible. No Done/Skip buttons. Only Close button. Tap Close. Selector dismisses.
6. **Pre-start cell — silent no-op.** Find a cell on the heatmap before the habit's `start_date` (visually identical to a Missed cell since visual differentiation is deferred). Tap it. **Nothing happens.** No selector, no error toast, no console error.
7. **48-hour boundary, real time.** This is hard to truly verify on a device without dev clock manipulation. If the dev clock can be advanced (`setNowForTesting` is a test-only utility, not a runtime control), skip this manual case — the integration tests in DEV-S6-02 cover the boundary. If you have a way to set the device clock 47 hours ahead and back, do the manual check; otherwise rely on the integration suite.
8. **Selector dismissal patterns.** Open the selector. Tap outside the card (on the dimmed backdrop) — selector dismisses. Open again. Tap the X close button — selector dismisses. Open again. On Android, press the hardware back button — selector dismisses (RN's Modal handles this via `onRequestClose`).
9. **Mutation error surfacing.** Hard to hit organically. If you can simulate a mutation failure (e.g., briefly archive the habit while the selector is open — race-condition test), the selector should show "This habit is archived. Reactivate it to log." inline rather than crashing. If you can't simulate, the integration tests in DEV-S6-02 are the safety net.
10. **No regressions.** Visit Today, Library tab, Settings, Reviews, Edit Habit, Create Habit, sign-in/sign-up, onboarding. All behave as they did at end of S5.

### Beta watch-items (post-merge, not check-at-merge)

These are **not** smoke items — they don't gate the `sprint-6 → main` merge. They're observations to actively listen for once the build reaches testers, captured here so we don't forget what to watch for.

- **The heatmap-as-failure read.** Per S6 (D4), pre-start cells on the 90-day heatmap render as `heatmapMissed`. For a tester on Day 7, that's 83 cells that look like missed days. We deferred the visual fix (followup F1), but only on the bet that testers will read the cells as "empty" rather than "failure." If even one tester says anything in the shape of "looks like I already failed," "feels like a wall of red," or "why are there so many missed days?" — F1 is the next sprint's first ticket, no further discussion. Capture the verbatim wording in the beta feedback channel and tag it `f1-trigger`.
- **The retro-log selector feel.** Per S6 (D5), we shipped RN's built-in `Modal` instead of a bottom sheet. Watch for tester language like "feels heavy," "jarring," or any comparison to other habit apps' bottom sheets. F3 picks it up if signal is clear.

### PROJECT_BRAIN update

Update `docs/PROJECT_BRAIN.md` §11 with a 5–8 line note covering:

- S6 moved from "Up next" to "Done."
- Habit Detail redesigned: "Become" header, identity-flavored streak, 90-day heatmap, consistency copy aligned with §10.2.
- New: `RetroLogSelector` component, `useUpsertHabitLogMutation` hook, `getRetroLogErrorMessage` dispatcher and four reason-specific error message functions.
- The Heatmap's `onCellPress` prop is now consumed on Habit Detail; Today still display-only.
- The 48-hour retro window is enforced by the existing `RetroLogError` from S2 — S6 surfaces it in the UI; behavior unchanged.
- Test coverage gaps F3 and F4 from S5 followups closed.
- "Up next" line points at S7 (recovery flow + single-miss reframing).
- Note: `isWithinRetroWindow` is now exported from `features/habits/api.ts` for parents that need to derive `canEdit` consistently with the API.

Confirm whether the `weekly_reviews` console-noise note in §11 still applies — it should (S6 didn't touch reviews on Today or Habit Detail).

### sprint-6-followups.md

Create `docs/sprint_tickets/sprint-6-followups.md` with at minimum:

- **F1 — Pre-start heatmap cells visual differentiation (P1, beta-triggered).** Per S6 (D4), cells before `habit.start_date` currently render as `heatmapMissed` — visually identical to "missed during habit's life." For habits started recently, the 90-day heatmap on Habit Detail shows up to 89 cells that look like failures but aren't. The deferral in S6 is a *bet* that testers read these as empty days rather than missed ones. **If beta feedback even hints at the heatmap reading as failure (see Beta watch-items in DEV-S6-04), F1 is the next sprint's first ticket — promoted ahead of any in-flight feature work.** Action when triggered: extend `Heatmap` with an optional `habitStartDate` prop; render pre-start cells with a distinct subtle "out-of-range" tint (lighter than `heatmapMissed`, no border) and exclude from `onCellPress` at the component level. Apply on both Today's 30-day and Habit Detail's 90-day variants. Small standalone ticket; product-lead to weigh in on the exact tint.
- **F2 — Consolidate today and general-purpose mutation hooks (P3).** S6 added `useUpsertHabitLogMutation` as a general-purpose hook. `useUpsertTodayHabitStatusMutation` is a special case of it (logDate hardcoded to today). Action: migrate Today to use the general hook, then delete the today-specific hook. Defer until there's a reason to touch the today path again (e.g., when reviews migrates).
- **F3 — Bottom-sheet UI for retro selector (P3, beta-driven).** Modal works. If beta feedback indicates the modal feels heavy or non-native, evaluate `@gorhom/bottom-sheet` for the retro selector specifically. Adds a library dep — only if feedback warrants.
- **F4 — Mutation error UX on selector failure (P3).** The selector currently catches `RetroLogError` and surfaces a friendly message inline, then stays open. For non-`RetroLogError` failures (network, DB write failure), it shows "Something went wrong. Try again." and stays open. Consider whether retry-from-selector is the right UX vs. closing and offering a global toast — defer until beta, then decide.
- Anything surfaced during the manual smoke that isn't a blocker.

### Acceptance criteria

- All 10 manual smoke items checked ✅. Paste the checklist (or a brief confirmation per item) into the `sprint-6 → main` PR description.
- `docs/PROJECT_BRAIN.md` §11 reflects S6 closure.
- `docs/sprint_tickets/sprint-6-followups.md` exists with at least F1 through F4.

### References

- The four S6 tickets above.
- `sprint-5-tickets.md` DEV-S5-04 (smoke-checklist pattern reference).
- `sprint-5-followups.md` (the followups format pattern).

### Out of scope

- Anything that's a real bug found during smoke — those get fixed before merge, not pushed to followups.
- Architectural changes to docs other than PROJECT_BRAIN §11.

---

## Definition of S6 done

S6 is complete when **all four tickets** are merged into the `sprint-6` branch AND:

1. `npx tsc --noEmit` is clean on the integration branch.
2. `npm test` passes on the integration branch (all new + existing suites).
3. The 10-item manual smoke checklist in DEV-S6-04 has been run end-to-end on a simulator or device. All items ✅.
4. The end-to-end retro-log flow works: a user can navigate to Habit Detail, see the redesigned chrome (Become header, identity streak, 90-day heatmap, consistency line), tap an in-window cell, change its status via Done/Skip, see the cell update within one second, and see the streak/consistency reflect the change. Out-of-window cells open the read-only selector. Pre-start cells silently no-op.
5. The 48-hour boundary is enforced consistently between the UI's `canEdit` derivation and the API's `RetroLogError` rejection — no path through the app surfaces a confusing rejection on a cell that was tappable.
6. No regressions: Today, Library, Settings, Reviews, Edit Habit, Create Habit, sign-in/sign-up, and the onboarding flow all behave as they did at close of S5.
7. `docs/PROJECT_BRAIN.md` §11 reflects S6 closure.
8. `docs/sprint_tickets/sprint-6-followups.md` exists.

After S6 closes, S7 begins: the recovery flow (modal after 2 consecutive misses), the single-miss reframing copy on Today, and the streak-break detection logic that triggers them.

The `sprint-6` → `main` PR closes the sprint.

---

*End of S6 ticket package.*
