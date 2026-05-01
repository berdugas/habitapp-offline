# Sprint 8 — Dev Team Tickets

> **Status:** Ready for assignment.
> **Date:** May 1, 2026
> **Owner:** Tech Lead → Dev Team
> **Companion documents:** `sprint-plan.md` (S8 definition, §5), `core-v1-requirements.md` (especially §15, §16, §24.12), `tech-handoff-core-v1.md` (architecture — §1, §6.3, §4.7), `sprint-7-followups.md` (the carry-overs this sprint folds in)

S8 is the last loose-ends sprint before the visual design pass (S9) and the beta build (S10). Three deliverables that don't share architecture — they share calendar position. The trial-validation work is the meatiest piece (a new service module, AsyncStorage caching, an app-wide `accessMode` concept, and read-only UI consequences across Today, Habit Detail, and Create Habit). The Settings refresh is deliberately small (email + sign out + app version + privacy/terms placeholders + a quiet trial-status sub-line). Bug #2 is a short engine-and-display fix that's currently inert in production but lands now so we're not racing to ship it during reviews-migration.

The risk in this sprint is concentrated in two places. First, the conceptual one: `accessMode` is derived purely from offline-grace exhaustion, **not** from `entitlement_status`. Trial expiry is tracked but not gated in Core v1 (per requirements §16.4). If the dev team conflates these, we'll over-engineer the gating and have to untangle it later. The "Shared context" section below names this explicitly. Second, the testing one: the grace-period boundary is clock-dependent and needs the same clock-fakes pattern S2 introduced; the existing `setNowForTesting` infra is the right tool, no new fixture is needed.

---

## 0. Shared context — read before picking up a ticket

### Branching for this sprint

> **⚠️ The very first action of S8 is cutting the sprint branch off `main`.** Do not start any ticket below until this is done.

Per `sprint-plan.md` §8.5, every sprint runs on its own integration branch. Before any ticket below starts:

```bash
git checkout main && git pull
git checkout -b sprint-8
git push -u origin sprint-8
```

Every ticket below branches off `sprint-8` and PRs back into `sprint-8`, **not** `main`. The `Branch suggestion` line on each ticket is the ticket branch:

```bash
git checkout sprint-8 && git pull
git checkout -b s8/trial-service
# ... do the work ...
# Open PR: s8/trial-service → sprint-8
```

When all seven tickets are merged into `sprint-8` and the Definition of S8 done is met, open one final PR: `sprint-8` → `main`.

### What's already done

S0–S7 closed before S8 starts. By the time your S8 code runs:

- **Server schema is in place.** Supabase has `profiles` and `trial_entitlements` (tech handoff §3.1, §3.2). `trial_entitlements` is auto-provisioned at signup via the S0 trigger with `trial_started_at = now()`, `trial_ends_at = now() + 14 days`, `entitlement_status = 'trial'`, `last_validated_at = null`. The client has never read this table — S8 is the first time we do.
- **AsyncStorage is wrapped behind a small helper module.** `src/lib/storage/index.ts` exposes `getStoredJson<T>`, `setStoredJson<T>`, `removeStoredItem`. Keys are registered in `src/lib/storage/keys.ts`. **Add new keys in `keys.ts`, not as inline strings.**
- **The clock is testable.** `src/utils/clock.ts` exposes `now()`, `nowIso()`, `todayDateString()`, plus `setNowForTesting(date)` and `resetClockForTesting()`. **Every grace-period computation must use `now()`, never `Date.now()` or `new Date()` directly.**
- **The auth bootstrap layer exists.** `src/providers/AuthBootstrap.tsx` calls `getSession()` on mount, subscribes to `onSupabaseAuthStateChange`, and provides the session via `AuthSessionProvider`. The provider tree is currently `QueryClientProvider → AuthBootstrap → children`. **S8 inserts a new provider between `AuthBootstrap` and `children` so the new provider can read `useAuthSession()`.**
- **The Settings screen exists.** `src/features/settings/screens/SettingsScreen.tsx` already renders Account email, "Foundation status" card (anachronistic — gets removed in S8-05), Inactive habits list, and Sign Out. S8 modifies this screen — it does not rebuild it.
- **The recommendations engine returns a single suggestion.** `src/features/recommendations/habitAdjustmentEngine.ts` exports `getHabitAdjustmentSuggestion(input): HabitAdjustmentSuggestion`. The combined type `fix_trigger_and_tiny_action` is fired when both flags are true. **S8 changes the return shape to an array and removes the combined type.**
- **`HabitDetailScreen` consumes the suggestion as a single card.** It renders one `<View style={styles.suggestionCard}>` block, conditional on `latestReview` being non-null. **S8 changes this to map over the array.** Note: the suggestion card is currently inert in production because the dropped Supabase `weekly_reviews` query fails silently and `latestReview` is always null — see "Inertness note" in DEV-S8-06.
- **The dev-only sign-in path is untouched.** `src/features/auth/api.ts` exposes `signInWithPassword`, `signUpWithPassword`, `signOut`, `getSession`. S8 wraps these flows with trial-validation, but does not modify the auth API itself.

### What we are NOT touching in S8

- **Post-trial gating.** Per requirements §16.4: when a user's `entitlement_status` flips to `expired` (server-side, 14 days after sign-up), **the app continues to grant full access in Core v1.** Trial expiry is *tracked* (we store the status; Settings shows it) but *not gated*. Read-only mode is triggered exclusively by **offline-grace exhaustion**, never by trial expiry. This is the single most important framing point in the sprint — see (D1) below.
- **Paid-tier flows.** Soft-friction paid override and any paywall infrastructure stay deferred until monetization. The `trial_entitlements.entitlement_status` value `'paid'` is acknowledged in the type union but no UI surface treats it specially in Core v1.
- **Account deletion / data export.** S19 / S18 work. Settings has no "Delete account" or "Export data" rows in S8.
- **Anonymous analytics opt-out toggle.** S21 work. `analyticsEnabled: true` in feature flags is fine for now.
- **Reminder settings UI.** S17 work. Settings has no reminder controls in S8.
- **Habit management surface in Settings (per requirements §15.2).** S15 work. The existing "Inactive habits" section stays in place per (D8) below — that's the *only* habit-management presence in Settings until S15 ships.
- **The dropped Supabase `weekly_reviews` query.** Same pattern as documented in PROJECT_BRAIN §11. Bug #2's fix is inert in production until reviews migrates to local SQLite (post-Core-v1 phase). S8 does not migrate reviews.
- **Privacy policy + Terms of service real content.** S20 work. S8 lays placeholder rows that will get linked to real documents in S20.
- **Soft-friction override flag.** Stays unimplemented per requirements §3.3.

### Architectural and product decisions for S8

These eleven decisions shape the work. (D1), (D5), (D6), (D9), and (D11) are the load-bearing ones. All are settled — pushback should go to the Tech Lead, not be resolved unilaterally inside a ticket.

**(D1) `accessMode` is derived from offline-grace exhaustion, NOT from `entitlement_status`.** This is the most important framing point in S8. Per requirements §16.4, post-trial behavior in Core v1 grants full access because monetization is out of scope. So the rule is:

```
accessMode = "full"        if last_validated_at !== null AND (now − last_validated_at) ≤ 7 days
accessMode = "read_only"   otherwise
```

Note what's NOT in this rule: `entitlement_status`. A user whose status is `'expired'` server-side sees zero functional change in Core v1 — same Today, same logging, same heatmap. We *store* the status (it surfaces in Settings as a quiet word), but we don't gate on it. Read-only mode is triggered exclusively by offline-grace exhaustion. **Do not write code that conditions on `entitlement_status === 'expired'`.**

**(D2) Cached entitlement lives in AsyncStorage as a single JSON blob.** Per tech handoff §4.7. Key: `habits.trial.entitlement`. Shape:

```ts
type CachedTrialEntitlement = {
  user_id: string;
  trial_started_at: string;        // ISO 8601 UTC, server-issued
  trial_ends_at: string;           // ISO 8601 UTC, server-issued
  entitlement_status: 'trial' | 'active' | 'expired' | 'paid' | 'cancelled';
  last_validated_at: string;       // ISO 8601 UTC, device-recorded at successful fetch
};
```

`last_validated_at` is **device-recorded** (the moment our client successfully completed the fetch), not server-recorded. The server's `trial_entitlements.last_validated_at` column is informational only — we ignore it for grace math. This is per tech handoff §3.2's note ("`last_validated_at` is informational on the server — the **client** is responsible for tracking its own grace period").

The cache is **per-user**: when a different user signs in (different `user_id`), the cache from the previous user is invalidated. Sign-out clears the cache entirely.

**(D3) Periodic re-validation cadence: 60 minutes since `last_validated_at`, checked at app foreground.** Sign-in always validates regardless. We do not poll while backgrounded. Specifically:

- **At sign-in success** (via `onSupabaseAuthStateChange` transitioning to a non-null session, or initial `getSession` resolving with a session): always fetch and cache entitlement.
- **At app foreground** (using React Native's `AppState` listener with `state === 'active'`): if `last_validated_at` is older than 60 minutes, re-fetch and update cache. If younger, do nothing.
- **At app cold start** (initial mount of `TrialValidationProvider`): same staleness check as foreground.
- **Manually via the read-only banner's "Reconnect" CTA**: always fetch.

The 60-minute threshold is anchored to "validate roughly once per usage session" — most users open the app once or twice per day briefly. Tighter wastes battery and data; looser increases the chance a user with intermittent connectivity slips into the grace countdown unnecessarily.

**(D4) Strict invariant: `last_validated_at === null → accessMode = "read_only"`.** When a user has a session but no cached entitlement (first sign-in offline; new device with cached session token but no entitlement; cache cleared by storage pressure), the safest behavior is read-only mode until validation succeeds. The user sees the read-only banner; tapping "Reconnect" runs validation; if it succeeds, full access is restored.

The trade-off: a user who happens to be offline on first sign-in lands in read-only mode briefly. We accept this as the right default — it's the same UX as the offline-7-days case, and the "Reconnect" affordance is right there. The alternative (lenient default — full access until proven otherwise) would let a revoked account use the app indefinitely without an internet connection, which is the opposite of what trial validation is for.

**(D5) Read-only mode UX: disabled controls with a persistent, non-dismissible banner.** Brand-voice constraints from `product-strategy.md`:

- The banner stays calm and informational. No red, no exclamation marks, no "ACTION REQUIRED" or all-caps urgency. The banner uses the same `colors.surface` / muted text styling as other informational cards on Today, with a slightly elevated `borderColor`.
- The banner is **not dismissible**. Dismissing a banner that affects functionality would later confuse the user when she taps Done and nothing happens. The banner persists until the next successful validation.
- Disabled controls are **visibly disabled, not invisible**. Done/Skip buttons stay rendered, greyed out. Hiding them would be paternalistic — the user is an adult dealing with a temporary inconvenience, not a child being protected from a button.
- The banner copy: **"Reconnect to keep logging."** (heading) — *"We haven't been able to verify your account in a while. Tap to reconnect."* (body) — **"Reconnect"** (button label).

**(D6) Settings shows trial status as a quiet sub-line, status word only — no countdown.** Per the product-lead decision in our S8 planning conversation:

A countdown ("3 days left") is a loss-aversion device. The product strategy explicitly forbids loss-aversion framing. So Settings shows only the status word, no number:

| `entitlement_status` | Sub-line copy |
|---|---|
| `'trial'` | *"Trial"* |
| `'active'` | *"Active"* |
| `'expired'` | *"Trial ended"* |
| `'paid'` | *"Paid"* (defensive — no real users hit this in Core v1) |
| `'cancelled'` | *"Cancelled"* |

The sub-line sits under the email line in the Account card. No CTA. No "Upgrade" button (monetization is deferred). When the user pays attention, she sees it. When she doesn't, it doesn't shout.

This may evolve when monetization ships — at that point a countdown might earn its place because there's a real product action attached to running out of trial. For now: status word only.

**(D7) The "Foundation status" card in Settings is removed.** It currently reads: *"Current version: full non-AI habit builder. Weekly reviews and rule-based suggestions are enabled. AI coaching is planned for a later premium phase."* This is anachronistic — AI is deferred indefinitely per PROJECT_BRAIN §9, "AI coaching is planned for a later premium phase" is no longer accurate, and the framing reads like a placeholder for a tier that's been removed. Drop the entire card in DEV-S8-05.

**(D8) The "Inactive habits" section in Settings stays in place, with a small copy refresh.** Until S15 ships proper habit management (per requirements §15.2), Settings is the *only* surface where a user can find a habit she archived through the Recovery flow's "Pause for now" action (S7 deliverable). Removing the section in S8 would create a multi-sprint regression in user agency. So keep it.

The copy gets a light refresh while we're in the file:

- Section heading: *"Your archived habits"* (was: *"Inactive habits"*)
- Helper line: *"Pause and resume habits without losing their history."* (was: *"Open any inactive habit to reactivate it from Habit Detail."*)
- Empty-state body: *"Habits you've paused will appear here so you can come back to them."* (was: *"Deactivated habits will appear here so you can inspect or reactivate them."*)
- Empty-state title: *"No archived habits"* (was: *"No inactive habits"*)

The actual list rendering and `useInactiveHabitsQuery` consumption stays unchanged.

**(D9) Bug #2: action-fix priority before trigger-fix when both apply; combined type is removed.** When both `tiny_action_too_hard === true` AND `trigger_worked === false`, the engine returns **two separate suggestions in this order**:

1. `make_tiny_action_smaller` (action first)
2. `change_trigger`

Two reasons. First: the existing single-suggestion engine already prioritizes action-fix over trigger-fix when only one flag fires. If the dual case put trigger first, the same situation would give different headline advice depending on whether one or both flags fired — internal inconsistency users can feel without articulating. Second: habit-formation research (Fogg specifically) consistently favors "make it smaller" as the highest-leverage early move. A user with both flags hot is, almost always, attempting a habit too big for her current life. Shrink first; tune the cue once she's reliably starting it.

The `fix_trigger_and_tiny_action` type is **removed entirely** — its job is now done by returning the two separate types in priority order. The dropped type cascades through:

- `src/features/recommendations/types.ts` — drop from `HabitAdjustmentSuggestionType` union and `HABIT_ADJUSTMENT_SUGGESTION_TYPES` array
- `src/features/recommendations/copy.ts` — drop the entry from `HABIT_ADJUSTMENT_SUGGESTIONS` record
- `src/features/recommendations/habitAdjustmentEngine.ts` — drop the `fix_trigger_and_tiny_action` early-return branch; rewrite to return `HabitAdjustmentSuggestion[]`
- `src/features/recommendations/editGuidance.ts` — drop any `case "fix_trigger_and_tiny_action"` in switch statements (verify by following TS compile errors after dropping the union member)
- `src/features/habits/screens/HabitDetailScreen.tsx` — map over the array; one card per suggestion

(D10) Engine return shape: rename `getHabitAdjustmentSuggestion` (singular) to `getHabitAdjustmentSuggestions` (plural) and change return type to `HabitAdjustmentSuggestion[]`. Cap at 2 elements maximum. Empty array is not a valid return — the `keep_going` fallback always provides at least one. The rename is a TS-compiler-driven refactor: change the export, follow the errors.

**(D11) Read-only enforcement is centralized in a context, consumed at the screen level.** A `TrialValidationProvider` exposes `accessMode: "full" | "read_only"` (plus `entitlementStatus`, `lastValidatedAt`, and an `isValidating` flag and `refresh()` callback). Each screen consumes the context via `useTrialValidation()`:

| Screen | Behavior in `read_only` mode |
|---|---|
| Today | Read-only banner at top of ScrollView. Focus card's Done/Skip disabled (greyed, still rendered). Supporting cards' Done/Skip disabled. Single-miss reframing banner from S7 still renders. Recovery modal from S7 still fires; modal actions (Restart, Make smaller, Pause, Just close) work — recovery is a state-correction surface, blocking it makes things worse. Banner is at the top of the ScrollView, above the Focus card. |
| Habit Detail | Read-only banner at top. Heatmap is interactive (cell taps still open the selector — but...). RetroLogSelector is forced into read-only mode by passing `canEdit={false}` regardless of the 48h window check, so Done/Skip don't render and only Close is available. Archive button disabled. Edit habit button disabled. |
| Create Habit | Read-only banner at top. All form fields rendered but the Save button is disabled. Helper text under the disabled button: *"Reconnect to create new habits."* |
| Edit Habit | Read-only banner at top. Form rendered but Save disabled. Same helper as Create. |
| Onboarding | **Not gated.** Onboarding is the becoming bridge — a user reaching it has just signed up (which always validates synchronously). Adding a banner mid-onboarding would derail the most important moment in the product. If validation somehow fails mid-onboarding, the user proceeds; the banner appears the moment they land on Today. |
| Recovery modal | **Not gated.** Recovery actions (Pause for now → archive) work even in read_only — it's a state-correction surface. Restart and Make-smaller route normally. |
| Settings | **Not gated.** Sign-out always works. Trial status sub-line shows the cached status. |

The "Reconnect" button on the banner calls `useTrialValidation().refresh()`, which fetches the entitlement; on success, the cache updates and `accessMode` flips back to `full` (and the banner disappears). On failure, the banner stays visible with its existing copy.

### Field mapping reference

For DEV-S8-02, the Supabase row → cached entitlement mapping:

| Server (`trial_entitlements`) | Cached (`CachedTrialEntitlement`) |
|---|---|
| `user_id` | `user_id` |
| `trial_started_at` (timestamptz) | `trial_started_at` (ISO string) |
| `trial_ends_at` (timestamptz) | `trial_ends_at` (ISO string) |
| `entitlement_status` (text) | `entitlement_status` (literal union) |
| (server's `last_validated_at` — ignored) | `last_validated_at` = `nowIso()` at fetch success |

### File / folder layout

By the end of S8:

```
src/features/trial/                          # NEW — entire module
├── api.ts                                   # NEW — fetch entitlement from Supabase
├── storage.ts                               # NEW — read/write cached entitlement to AsyncStorage
├── grace.ts                                 # NEW — pure function: computeAccessMode({ lastValidatedAt, now })
├── hooks.ts                                 # NEW — useTrialValidation, useTrialValidationContext
├── types.ts                                 # NEW — CachedTrialEntitlement, AccessMode, TrialEntitlementStatus
└── __tests__/
    ├── grace.test.ts                        # NEW — boundary tests (6/7/8 day, missing cache)
    ├── storage.test.ts                      # NEW — round-trip cache reads/writes
    └── api.test.ts                          # NEW — fetch happy path + network-error path

src/providers/
└── TrialValidationBootstrap.tsx             # NEW — wraps children, owns the validation lifecycle, provides context

src/providers/AppProviders.tsx               # MODIFIED — insert TrialValidationBootstrap inside AuthBootstrap

src/lib/storage/keys.ts                      # MODIFIED — add `trialEntitlement` key

src/components/
└── ReadOnlyBanner.tsx                       # NEW — shared banner used by Today, HabitDetail, CreateHabit, EditHabit

src/features/today/screens/TodayScreen.tsx   # MODIFIED — render banner; disable Done/Skip when read_only
src/features/habits/screens/HabitDetailScreen.tsx
                                             # MODIFIED — render banner; force RetroLogSelector canEdit=false; disable Archive/Edit
src/features/habits/screens/CreateHabitScreen.tsx
                                             # MODIFIED — render banner; disable Save
src/features/habits/screens/EditHabitScreen.tsx
                                             # MODIFIED — render banner; disable Save

src/features/settings/screens/SettingsScreen.tsx
                                             # MODIFIED — drop Foundation card; add trial status sub-line; copy refresh on Inactive section; add app version row; add Privacy/Terms placeholder rows

src/features/recommendations/types.ts        # MODIFIED — drop fix_trigger_and_tiny_action
src/features/recommendations/copy.ts         # MODIFIED — drop entry
src/features/recommendations/habitAdjustmentEngine.ts
                                             # MODIFIED — return array, drop combined branch
src/features/recommendations/editGuidance.ts
                                             # MODIFIED — drop combined-type case (if present)
src/features/habits/screens/HabitDetailScreen.tsx
                                             # MODIFIED — map over array of suggestions

src/features/habits/screens/__tests__/EditHabitScreen.test.tsx
                                             # NEW (or extended) — S7 followup F2 case for ?from=recovery focus

docs/
├── PROJECT_BRAIN.md                         # MODIFIED — §11 update
└── sprint_tickets/
    └── sprint-8-followups.md                # NEW
```

### Conventions

Inherited from S2–S7, applied unchanged in S8.

- `now()` / `nowIso()` / `todayDateString()` from `@/utils/clock`, never `Date.now()` or `new Date()` directly.
- `getStoredJson<T>` / `setStoredJson<T>` / `removeStoredItem` from `@/lib/storage` — never call `AsyncStorage` directly from feature modules.
- New storage keys go in `src/lib/storage/keys.ts` as named exports — never inline strings.
- All user-facing strings live in `src/utils/userFacingErrors.ts` (for errors) or inline as `selectable` `<Text>` (for static copy). The S8 banner copy is short enough to inline; if it gets reused beyond the read-only banner, consider extracting.
- Tests use `renderHook` and `render` from `@testing-library/react-native`. The `@testing-library/react-hooks` package is **not** installed.
- Submit-lock pattern: each mutation button gets its own ref. `useTrialValidation().refresh()` doesn't need a lock — it's idempotent on the server side; back-to-back fetches just produce back-to-back cache writes with the same data.
- Imports order: external packages → `expo-*` → `@/components/*` → `@/features/*` → `@/lib/*` → `@/providers/*` → `@/services/*` → `@/theme/*` → `@/utils/*` → relative imports.

### Sequencing

```
DEV-S8-01  S7 followup F2 cleanup (EditHabit recovery focus unit test)
   ↓
DEV-S8-02  Trial entitlement service (api + storage + grace + types)   [pure layer]
   ↓
DEV-S8-03  TrialValidationBootstrap + useTrialValidation hook + sign-in integration   [orchestration]
   ↓
DEV-S8-04  Read-only mode UI across Today / Habit Detail / Create Habit / Edit Habit
   ↓
DEV-S8-05  Settings refresh (drop Foundation card, trial status sub-line, app version, Privacy/Terms placeholders, copy refresh on archived habits)
   ↓
DEV-S8-06  Bug #2 — dual suggestion display
   ↓
DEV-S8-07  Manual smoke + PROJECT_BRAIN update + sprint-8-followups.md
```

Strictly serial. DEV-S8-03 depends on DEV-S8-02's pure layer being solid; DEV-S8-04 depends on the context from DEV-S8-03; DEV-S8-05 reads the context too. DEV-S8-06 is independent of the trial work and could merge in parallel, but stays serial for review-overhead reasons.

---

## DEV-S8-01 — S7 followup F2 cleanup (EditHabit recovery focus unit test)

**Estimate:** 0.25 day
**Depends on:** S7 closed (sprint-7 merged into main), `sprint-8` branch cut.
**Branch suggestion:** `s8/edit-habit-focus-test`

### Context

Per our convention, every sprint opens with a cleanup pass that folds in the previous sprint's small followups. From S7's followups:

- **F1** (recovery modal copy review) — beta-driven, defer until we have signal.
- **F2** (EditHabitScreen `?from=recovery` focus path: smoke-only, no unit test) — fold into S8.
- **F3** (dead `latestReviewQueries` path) — still parked until reviews migrates.

So this ticket closes F2 only. The path is deterministic and DB-free; it's worth a Jest case so a future regression on the focus-after-mount behavior surfaces in CI rather than during manual smoke.

### Files to read first

- `src/features/habits/screens/EditHabitScreen.tsx` — confirm the `useLocalSearchParams` consumption, the `from === 'recovery'` branch, and how the `tiny_action` `TextInput` ref is created and focused via `setTimeout(0)` on mount.
- `src/components/forms/TextField.tsx` — confirm the forwardRef shape; the test asserts `.focus()` is called on the underlying input.
- `src/features/habits/screens/__tests__/` directory — check whether `EditHabitScreen.test.tsx` already exists. If yes, append the new test case; if not, create it from scratch.
- `sprint-7-followups.md` F2 prose for the exact behavior under test.

### Files to create or modify

- `src/features/habits/screens/__tests__/EditHabitScreen.test.tsx` — new file, or new test case appended to an existing file.

### Required test

One case that mocks `useLocalSearchParams` to return `{ habitId: 'habit-1', from: 'recovery' }`, mocks `useHabitDetail` to return a hydrated habit, and asserts that the `tiny_action` `TextInput`'s `.focus()` method is invoked after mount.

```tsx
import { render, waitFor } from "@testing-library/react-native";
import React from "react";

import EditHabitScreen from "@/features/habits/screens/EditHabitScreen";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock("@/features/habits/hooks", () => ({
  useHabitDetail: jest.fn(),
  useUpdateHabitMutation: jest.fn(),
}));

const { useLocalSearchParams } = jest.requireMock("expo-router") as {
  useLocalSearchParams: jest.Mock;
};
const { useHabitDetail, useUpdateHabitMutation } = jest.requireMock(
  "@/features/habits/hooks",
) as {
  useHabitDetail: jest.Mock;
  useUpdateHabitMutation: jest.Mock;
};

describe("EditHabitScreen — recovery focus path", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    useUpdateHabitMutation.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      isPending: false,
      error: null,
    });
    useHabitDetail.mockReturnValue({
      error: null,
      formula: "After morning coffee, run for 2 minutes",
      habit: {
        id: "habit-1",
        title: "Run",
        identity_phrase: "a runner",
        cue: "morning coffee",
        tiny_action: "run for 2 minutes",
        minimum_viable_action: null,
        preferred_time_window: null,
        habit_state: "focus",
        status: "active",
        start_date: "2026-04-01",
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        archived_at: null,
        automated_at: null,
        backlog_at: null,
        user_id: "user-1",
      },
      isLoading: false,
      isUpcoming: false,
      latestReview: null,
      progress: {
        consistencyRate: 0.5,
        skipCount: 0,
        streak: 0,
        todayStatus: null,
      },
      recentLogs: [],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("focuses the tiny_action TextInput when navigated with from=recovery", async () => {
    useLocalSearchParams.mockReturnValue({
      habitId: "habit-1",
      from: "recovery",
    });

    // Spy on the underlying TextInput.prototype.focus.
    // The forwardRef on TextField hands the inner ref through.
    const focusSpy = jest.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("react-native").TextInput.prototype,
      "focus",
    );

    render(<EditHabitScreen />);

    // The screen schedules focus via setTimeout(0).
    jest.runAllTimers();

    await waitFor(() => {
      expect(focusSpy).toHaveBeenCalled();
    });

    focusSpy.mockRestore();
  });

  it("does not focus the tiny_action TextInput when navigated without from=recovery", async () => {
    useLocalSearchParams.mockReturnValue({ habitId: "habit-1" });

    const focusSpy = jest.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("react-native").TextInput.prototype,
      "focus",
    );

    render(<EditHabitScreen />);
    jest.runAllTimers();

    // No assertion that focus was *never* called — the screen may legitimately
    // focus other inputs. Assert specifically that the tiny_action ref was
    // not the one focused. The cleanest signal: focus count is zero.
    expect(focusSpy).not.toHaveBeenCalled();

    focusSpy.mockRestore();
  });
});
```

The second test case (negative case) catches a regression where the focus path fires unconditionally — a real risk if someone later removes the `from === 'recovery'` guard.

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes — both new tests, plus everything pre-existing (S7 closed at 415; this ticket lands ~417).
- No production code changes. EditHabitScreen behavior is unchanged; only test coverage grew.

### References

- `sprint-7-followups.md` F2 (the spec for what to cover).
- `src/features/habits/screens/EditHabitScreen.tsx` (the path under test).

### Out of scope

- Any production code change to EditHabitScreen.
- F1 and F3 from S7 followups (deferred per the followups doc).
- Migrating the existing TextField forwardRef to a different pattern.

---

## DEV-S8-02 — Trial entitlement service (pure layer)

**Estimate:** 0.5 day
**Depends on:** DEV-S8-01 merged into `sprint-8`.
**Branch suggestion:** `s8/trial-service`

### Context

Builds the entire pure layer of the trial validation feature: types, the Supabase fetch, the AsyncStorage cache, and the grace-period computation. **No React, no hooks, no providers, no UI.** Each piece is independently testable. By the end of this ticket, the orchestration ticket (DEV-S8-03) has all the building blocks and only needs to compose them.

The risk is concentrated in the grace-period function: it's clock-dependent, the boundary cases (exactly 7 days) need defensive tests, and the missing-cache case (`last_validated_at === null`) is the strict-invariant gate for read-only mode (per (D4)). Get the function right before anything consumes it.

### Files to read first

- `docs/core-v1-requirements.md` §16 (trial validation spec) and §24.12 (acceptance criteria).
- `docs/tech-handoff-core-v1.md` §3.2 (`trial_entitlements` server schema), §4.7 (cache shape), §6.3 (grace-period decision).
- `src/lib/storage/index.ts` and `src/lib/storage/keys.ts` (the AsyncStorage helpers and key registry).
- `src/lib/supabase/client.ts` (the Supabase client) — confirm the import path and that anonymous `.from('trial_entitlements')` queries work with RLS (they should, since `trial_entitlements` is keyed on `auth.uid()` and the user's session is bound to the client).
- `src/utils/clock.ts` — `now()`, `nowIso()`, `setNowForTesting`, `resetClockForTesting`.

### Files to create

- `src/features/trial/types.ts`
- `src/features/trial/api.ts`
- `src/features/trial/storage.ts`
- `src/features/trial/grace.ts`
- `src/features/trial/__tests__/grace.test.ts`
- `src/features/trial/__tests__/storage.test.ts`
- `src/features/trial/__tests__/api.test.ts`

### Files to modify

- `src/lib/storage/keys.ts` — add `trialEntitlement` key.

### Required exports / signatures

**`src/lib/storage/keys.ts`** — extend the existing record:

```ts
export const storageKeys = {
  authLastUserId: "habits.auth.last-user-id",
  syncQueue: "habits.sync.queue",
  notificationIdsByHabit: "habits.notifications.by-habit",
  trialEntitlement: "habits.trial.entitlement",  // NEW in S8-02
} as const;
```

The string format follows the existing `habits.<feature>.<descriptor>` convention.

**`src/features/trial/types.ts`**

```ts
export type TrialEntitlementStatus =
  | "trial"
  | "active"
  | "expired"
  | "paid"
  | "cancelled";

export const TRIAL_ENTITLEMENT_STATUSES: TrialEntitlementStatus[] = [
  "trial",
  "active",
  "expired",
  "paid",
  "cancelled",
];

export type CachedTrialEntitlement = {
  user_id: string;
  trial_started_at: string;       // ISO 8601 UTC, server-issued
  trial_ends_at: string;          // ISO 8601 UTC, server-issued
  entitlement_status: TrialEntitlementStatus;
  last_validated_at: string;      // ISO 8601 UTC, device-recorded at fetch success
};

export type AccessMode = "full" | "read_only";

export const TRIAL_GRACE_PERIOD_DAYS = 7;

export const TRIAL_REVALIDATION_STALENESS_MINUTES = 60;
```

The constants are exported (not inlined) so tests, the grace function, and the orchestration hook all reference the same numbers. If the cadence changes, one place changes.

**`src/features/trial/grace.ts`** — pure function, no I/O, no clock import inside:

```ts
import { TRIAL_GRACE_PERIOD_DAYS } from "@/features/trial/types";
import type { AccessMode } from "@/features/trial/types";

export type ComputeAccessModeInput = {
  lastValidatedAt: string | null;  // ISO 8601 UTC
  now: Date;                        // caller passes via @/utils/clock now()
};

export function computeAccessMode({
  lastValidatedAt,
  now,
}: ComputeAccessModeInput): AccessMode {
  // (D4) Strict invariant: no cache → read_only.
  if (lastValidatedAt === null) {
    return "read_only";
  }

  const lastValidated = new Date(lastValidatedAt);

  // Defensive: malformed ISO string parses to Invalid Date.
  if (Number.isNaN(lastValidated.getTime())) {
    return "read_only";
  }

  const ageMs = now.getTime() - lastValidated.getTime();
  const graceMs = TRIAL_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

  // ageMs <= graceMs → still in grace → full access.
  // ageMs > graceMs → grace exhausted → read_only.
  return ageMs <= graceMs ? "full" : "read_only";
}
```

The function takes `now: Date` as an explicit argument rather than calling `now()` internally — this makes it pure and trivially testable. Callers pass `now()` from `@/utils/clock`.

Boundary semantics: exactly 7 days (`ageMs === graceMs`) returns `"full"`. The `<=` is deliberate. Reasoning: a user whose last validation was 7 days ago to the millisecond should still be in grace; the 7-day budget is inclusive of its endpoints. The next millisecond after that flips to `read_only`.

**Comparator consistency check.** Before merging, verify the comparator in `features/habits/api.ts`'s `isWithinRetroWindow` (the 48-hour retro-window helper from S2). If that helper uses `<` rather than `<=`, change `grace.ts` to match (`<` here, with the boundary test case adjusted accordingly). Reasoning: one mental model across the codebase beats local correctness debates. The user-visible difference is one millisecond — undetectable in practice — but consistency saves future mental load.

**`src/features/trial/storage.ts`**

```ts
import { getStoredJson, removeStoredItem, setStoredJson } from "@/lib/storage";
import { storageKeys } from "@/lib/storage/keys";

import type { CachedTrialEntitlement } from "@/features/trial/types";

export async function readCachedEntitlement(): Promise<CachedTrialEntitlement | null> {
  return getStoredJson<CachedTrialEntitlement | null>(
    storageKeys.trialEntitlement,
    null,
  );
}

export async function writeCachedEntitlement(
  entitlement: CachedTrialEntitlement,
): Promise<void> {
  await setStoredJson(storageKeys.trialEntitlement, entitlement);
}

export async function clearCachedEntitlement(): Promise<void> {
  await removeStoredItem(storageKeys.trialEntitlement);
}
```

Three exported functions. No business logic — the storage module is a thin typed wrapper around the existing AsyncStorage helpers. The `getStoredJson` wrapper already handles the JSON parse-or-fallback case, so `readCachedEntitlement` returns `null` for missing or corrupt cache, never throws on parse.

**`src/features/trial/api.ts`** — the Supabase fetch:

```ts
import { supabase } from "@/lib/supabase/client";
import { logger } from "@/services/logger";
import { nowIso } from "@/utils/clock";

import type {
  CachedTrialEntitlement,
  TrialEntitlementStatus,
} from "@/features/trial/types";
import { TRIAL_ENTITLEMENT_STATUSES } from "@/features/trial/types";

type TrialEntitlementRow = {
  user_id: string;
  trial_started_at: string;
  trial_ends_at: string;
  entitlement_status: string;
  last_validated_at: string | null;
};

export class TrialEntitlementFetchError extends Error {
  constructor(
    message: string,
    public reason:
      | "network"
      | "missing_row"
      | "invalid_status"
      | "unknown",
  ) {
    super(message);
    this.name = "TrialEntitlementFetchError";
  }
}

export async function fetchTrialEntitlement(
  userId: string,
): Promise<CachedTrialEntitlement> {
  const { data, error } = await supabase
    .from("trial_entitlements")
    .select(
      "user_id, trial_started_at, trial_ends_at, entitlement_status, last_validated_at",
    )
    .eq("user_id", userId)
    .maybeSingle<TrialEntitlementRow>();

  if (error) {
    logger.error("Trial entitlement fetch failed", {
      error,
      userId,
    });
    throw new TrialEntitlementFetchError(
      "Could not reach the server to verify your account.",
      "network",
    );
  }

  if (!data) {
    logger.error("Trial entitlement row missing for user", { userId });
    throw new TrialEntitlementFetchError(
      "Account is missing trial entitlement record.",
      "missing_row",
    );
  }

  if (
    !TRIAL_ENTITLEMENT_STATUSES.includes(
      data.entitlement_status as TrialEntitlementStatus,
    )
  ) {
    logger.error("Trial entitlement returned invalid status", {
      status: data.entitlement_status,
      userId,
    });
    throw new TrialEntitlementFetchError(
      "Account returned unrecognized status.",
      "invalid_status",
    );
  }

  // The server's last_validated_at column is informational; we record our
  // own client-side timestamp here per tech handoff §3.2.
  return {
    user_id: data.user_id,
    trial_started_at: data.trial_started_at,
    trial_ends_at: data.trial_ends_at,
    entitlement_status: data.entitlement_status as TrialEntitlementStatus,
    last_validated_at: nowIso(),
  };
}
```

Notes:
- `.maybeSingle()` returns `null` for "row doesn't exist" without erroring. We treat missing-row as a `TrialEntitlementFetchError("missing_row")` because the S0 trigger guarantees a row at signup; missing here is a data integrity issue worth surfacing in logs.
- The `entitlement_status` validation guards against the server returning a value the client doesn't know about (e.g., a future status added before client deploy).
- `nowIso()` is captured at fetch success — that's the device-recorded validation timestamp, not the server's.
- `TrialEntitlementFetchError` exposes a `reason` for the orchestration layer to log differently / behave differently per cause. None of the reasons change the user-visible UI in S8 — the banner is the same regardless — but the orchestration layer logs them distinctly for diagnosis.

### Required tests

**`src/features/trial/__tests__/grace.test.ts`** — boundary tests for the pure function:

```ts
import { computeAccessMode } from "@/features/trial/grace";

describe("computeAccessMode", () => {
  function isoDaysAgo(days: number, fromNow: Date = new Date()): string {
    return new Date(fromNow.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  it("returns read_only when lastValidatedAt is null", () => {
    expect(
      computeAccessMode({
        lastValidatedAt: null,
        now: new Date("2026-05-01T00:00:00.000Z"),
      }),
    ).toBe("read_only");
  });

  it("returns read_only when lastValidatedAt is malformed", () => {
    expect(
      computeAccessMode({
        lastValidatedAt: "not-a-real-iso-string",
        now: new Date("2026-05-01T00:00:00.000Z"),
      }),
    ).toBe("read_only");
  });

  it("returns full at 0 days (just validated)", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: now.toISOString(),
        now,
      }),
    ).toBe("full");
  });

  it("returns full at 6 days", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: isoDaysAgo(6, now),
        now,
      }),
    ).toBe("full");
  });

  it("returns full at exactly 7 days (boundary inclusive)", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: isoDaysAgo(7, now),
        now,
      }),
    ).toBe("full");
  });

  it("returns read_only at 7 days + 1 millisecond", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    const oneMsAfterBoundary = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000 - 1,
    ).toISOString();
    expect(
      computeAccessMode({
        lastValidatedAt: oneMsAfterBoundary,
        now,
      }),
    ).toBe("read_only");
  });

  it("returns read_only at 8 days", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: isoDaysAgo(8, now),
        now,
      }),
    ).toBe("read_only");
  });

  it("returns read_only at 30 days", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      computeAccessMode({
        lastValidatedAt: isoDaysAgo(30, now),
        now,
      }),
    ).toBe("read_only");
  });

  it("returns full when validation timestamp is in the future (clock skew)", () => {
    // Defensive — if the device clock has drifted backward, the cached
    // timestamp may be slightly ahead of "now". This should NOT flip to
    // read_only — a future timestamp means age is negative, and ageMs <= graceMs
    // holds trivially.
    const now = new Date("2026-05-01T00:00:00.000Z");
    const futureIso = new Date(now.getTime() + 60 * 1000).toISOString();
    expect(
      computeAccessMode({
        lastValidatedAt: futureIso,
        now,
      }),
    ).toBe("full");
  });
});
```

Nine cases. The 7-day boundary case (`isoDaysAgo(7) === full`) and the 7-day-plus-one-ms case (`read_only`) lock the inclusive endpoint. The clock-skew case is defensive — without it, a small backward clock drift on the device could falsely flag the user as out-of-grace.

**`src/features/trial/__tests__/storage.test.ts`** — round-trip tests:

```ts
import {
  clearCachedEntitlement,
  readCachedEntitlement,
  writeCachedEntitlement,
} from "@/features/trial/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { CachedTrialEntitlement } from "@/features/trial/types";

const sampleEntitlement: CachedTrialEntitlement = {
  user_id: "user-1",
  trial_started_at: "2026-04-15T00:00:00.000Z",
  trial_ends_at: "2026-04-29T00:00:00.000Z",
  entitlement_status: "trial",
  last_validated_at: "2026-05-01T00:00:00.000Z",
};

describe("trial storage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("returns null when no entitlement is cached", async () => {
    expect(await readCachedEntitlement()).toBeNull();
  });

  it("round-trips a cached entitlement", async () => {
    await writeCachedEntitlement(sampleEntitlement);
    const result = await readCachedEntitlement();
    expect(result).toEqual(sampleEntitlement);
  });

  it("clearCachedEntitlement removes the cache", async () => {
    await writeCachedEntitlement(sampleEntitlement);
    await clearCachedEntitlement();
    expect(await readCachedEntitlement()).toBeNull();
  });

  it("returns null when cache is corrupt JSON", async () => {
    // Write a malformed JSON string directly via AsyncStorage to simulate
    // corruption. getStoredJson should fall back to null.
    await AsyncStorage.setItem(
      "habits.trial.entitlement",
      "{not-valid-json",
    );
    expect(await readCachedEntitlement()).toBeNull();
  });

  it("overwrites an existing cache on second write", async () => {
    await writeCachedEntitlement(sampleEntitlement);
    const updated: CachedTrialEntitlement = {
      ...sampleEntitlement,
      entitlement_status: "expired",
    };
    await writeCachedEntitlement(updated);
    const result = await readCachedEntitlement();
    expect(result?.entitlement_status).toBe("expired");
  });
});
```

`AsyncStorage` here uses the standard React Native mock from `jest-expo` / the existing test setup. Verify the mock is registered in `jest.config.js`'s `setupFiles` — if it isn't, add it.

**`src/features/trial/__tests__/api.test.ts`** — Supabase fetch tests with the `.from()` chain mocked:

```ts
import { fetchTrialEntitlement, TrialEntitlementFetchError } from "@/features/trial/api";
import { supabase } from "@/lib/supabase/client";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

jest.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockedFrom = supabase.from as jest.Mock;

function mockMaybeSingleResponse(data: unknown, error: unknown = null) {
  mockedFrom.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data, error }),
      }),
    }),
  });
}

describe("fetchTrialEntitlement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNowForTesting(new Date("2026-05-01T12:00:00.000Z"));
  });

  afterEach(() => {
    resetClockForTesting();
  });

  it("returns the cached entitlement on success", async () => {
    mockMaybeSingleResponse({
      user_id: "user-1",
      trial_started_at: "2026-04-15T00:00:00.000Z",
      trial_ends_at: "2026-04-29T00:00:00.000Z",
      entitlement_status: "trial",
      last_validated_at: null,
    });

    const result = await fetchTrialEntitlement("user-1");

    expect(result).toEqual({
      user_id: "user-1",
      trial_started_at: "2026-04-15T00:00:00.000Z",
      trial_ends_at: "2026-04-29T00:00:00.000Z",
      entitlement_status: "trial",
      last_validated_at: "2026-05-01T12:00:00.000Z",  // device-recorded
    });
  });

  it("throws TrialEntitlementFetchError(network) on Supabase error", async () => {
    mockMaybeSingleResponse(null, { message: "network error" });

    await expect(fetchTrialEntitlement("user-1")).rejects.toBeInstanceOf(
      TrialEntitlementFetchError,
    );
    await expect(fetchTrialEntitlement("user-1")).rejects.toMatchObject({
      reason: "network",
    });
  });

  it("throws TrialEntitlementFetchError(missing_row) when no row exists", async () => {
    mockMaybeSingleResponse(null);

    await expect(fetchTrialEntitlement("user-1")).rejects.toMatchObject({
      reason: "missing_row",
    });
  });

  it("throws TrialEntitlementFetchError(invalid_status) on unknown status value", async () => {
    mockMaybeSingleResponse({
      user_id: "user-1",
      trial_started_at: "2026-04-15T00:00:00.000Z",
      trial_ends_at: "2026-04-29T00:00:00.000Z",
      entitlement_status: "future_unknown_status",
      last_validated_at: null,
    });

    await expect(fetchTrialEntitlement("user-1")).rejects.toMatchObject({
      reason: "invalid_status",
    });
  });
});
```

Four cases. The network-error and missing-row cases distinguish the failure reasons so logs are diagnosable. The invalid-status case future-proofs against the server adding a new status before the client knows about it.

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes — three new test files (~18 cases combined), plus everything pre-existing.
- The pure layer is self-contained: nothing in `src/features/trial/` (other than tests) imports React, hooks, or React Query. This is a critical invariant — the orchestration layer in S8-03 will compose these primitives, but a future refactor (e.g., moving validation to a background task) shouldn't be blocked by accidental React coupling here.
- No production behavior change. The trial module is wired up in S8-03; S8-02 just ships the parts.

### References

- `docs/core-v1-requirements.md` §16, §24.12.
- `docs/tech-handoff-core-v1.md` §3.2, §4.7, §6.3.
- `src/lib/storage/index.ts` (the AsyncStorage wrapper pattern).
- `src/utils/clock.ts` (the testable clock — used here only by `api.ts`'s `nowIso()`).

### Out of scope

- The orchestration hook / context / provider — DEV-S8-03.
- Any UI consumption of `accessMode` — DEV-S8-04.
- Settings display of trial status — DEV-S8-05.
- Refactoring the existing AsyncStorage helpers in `src/lib/storage/index.ts`.
- Adding RLS policies or Supabase migrations — server schema is already in place from S0.

---

## DEV-S8-03 — TrialValidationBootstrap + useTrialValidation hook + sign-in integration

**Estimate:** 0.75 day
**Depends on:** DEV-S8-02 merged into `sprint-8`.
**Branch suggestion:** `s8/trial-bootstrap`

### Context

The orchestration layer. Composes the pure pieces from DEV-S8-02 into a React provider that watches the auth session, runs validation at the right moments (sign-in always; foreground when stale), exposes `accessMode` to the rest of the app, and offers a manual `refresh()` callback for the read-only banner.

The risk is concentrated in two places. First, the lifecycle: validation must fire on initial session hydration AND on subsequent auth state changes, AND on app foreground when stale. Getting any of these wrong means a user either sees stale data (state didn't refresh when it should) or sees needless validations (state refreshed when it shouldn't). Second, the provider tree placement: the trial provider must sit *inside* `AuthBootstrap` (so it can read `useAuthSession()`), but *above* the rest of the app (so screens can read `useTrialValidation()`). Placement matters.

### Files to read first

- `src/providers/AppProviders.tsx` — confirm the current provider tree: `QueryClientProvider → AuthBootstrap → children`. The new provider goes between `AuthBootstrap` and `children`.
- `src/providers/AuthBootstrap.tsx` — confirm the lifecycle: `getSession()` on mount, `onSupabaseAuthStateChange` subscription, `AuthSessionProvider` value shape (`isBootstrapping`, `session`, `user`).
- `src/features/auth/hooks.ts` — confirm `useAuthSession()` returns the context value with `user` and `isBootstrapping`.
- `src/features/auth/types.ts` — confirm `AuthSessionState` shape.
- `src/features/trial/api.ts`, `storage.ts`, `grace.ts`, `types.ts` (from S8-02) — the building blocks.
- React Native `AppState` API — confirm the import is `import { AppState, type AppStateStatus } from 'react-native'` and the listener is `AppState.addEventListener('change', listener)`.

### Files to create

- `src/features/trial/hooks.ts` — `useTrialValidation()` (consumer hook); `TrialValidationProvider` (context provider component); internal `useTrialValidationLifecycle()` (hook owning the validation lifecycle, called from the bootstrap).
- `src/providers/TrialValidationBootstrap.tsx` — wraps children, hosts `TrialValidationProvider` with state populated by the lifecycle hook.
- `src/features/trial/__tests__/hooks.test.tsx` — tests for `useTrialValidation` consumption + bootstrap behavior.

### Files to modify

- `src/providers/AppProviders.tsx` — insert `TrialValidationBootstrap` inside `AuthBootstrap`.

### Required exports / signatures

**`src/features/trial/hooks.ts`** — the context, provider component, and consumer hook. The lifecycle hook is the heart of this ticket:

```tsx
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

import { useAuthSession } from "@/features/auth/hooks";
import { fetchTrialEntitlement, TrialEntitlementFetchError } from "@/features/trial/api";
import { computeAccessMode } from "@/features/trial/grace";
import {
  clearCachedEntitlement,
  readCachedEntitlement,
  writeCachedEntitlement,
} from "@/features/trial/storage";
import {
  TRIAL_REVALIDATION_STALENESS_MINUTES,
  type AccessMode,
  type CachedTrialEntitlement,
  type TrialEntitlementStatus,
} from "@/features/trial/types";
import { logger } from "@/services/logger";
import { now } from "@/utils/clock";

export type TrialValidationContextValue = {
  isBootstrapping: boolean;
  isValidating: boolean;
  accessMode: AccessMode;
  entitlementStatus: TrialEntitlementStatus | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  lastValidatedAt: string | null;
  refresh: () => Promise<void>;
};

const TrialValidationContext = createContext<TrialValidationContextValue | null>(
  null,
);

export function useTrialValidation(): TrialValidationContextValue {
  const value = useContext(TrialValidationContext);
  if (!value) {
    throw new Error(
      "useTrialValidation must be used within TrialValidationProvider",
    );
  }
  return value;
}
```

(Note: the import for `useContext` should come from `react`. Adjust the destructure at the top if your project doesn't already include it.)

**The lifecycle hook** owns the state machine:

```tsx
type LifecycleState = {
  cached: CachedTrialEntitlement | null;
  isBootstrapping: boolean;
  isValidating: boolean;
};

function useTrialValidationLifecycle(
  userId: string | null,
  isAuthBootstrapping: boolean,
): {
  state: LifecycleState;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<LifecycleState>({
    cached: null,
    isBootstrapping: true,
    isValidating: false,
  });

  // Latest user id captured for async-safe checks.
  const userIdRef = useRef<string | null>(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Single source of truth for "fetch + cache + update state". Called from:
  // - Initial mount with a session
  // - Auth state change to a non-null session
  // - AppState 'active' transition when cache is stale
  // - Manual refresh from the read-only banner
  const fetchAndCache = useCallback(async (uid: string) => {
    setState((prev) => ({ ...prev, isValidating: true }));
    try {
      const entitlement = await fetchTrialEntitlement(uid);
      // Guard against the user signing out mid-flight.
      if (userIdRef.current !== uid) {
        return;
      }
      await writeCachedEntitlement(entitlement);
      setState({
        cached: entitlement,
        isBootstrapping: false,
        isValidating: false,
      });
    } catch (error) {
      if (error instanceof TrialEntitlementFetchError) {
        logger.error("Trial validation failed", {
          reason: error.reason,
          userId: uid,
        });
      } else {
        logger.error("Trial validation failed (unknown error)", {
          error,
          userId: uid,
        });
      }
      // Keep whatever cache we have; just stop the spinner.
      setState((prev) => ({
        ...prev,
        isBootstrapping: false,
        isValidating: false,
      }));
    }
  }, []);

  // Initial mount + userId change handler.
  useEffect(() => {
    // Wait for auth to settle before reacting. Otherwise the initial render
    // (auth bootstrapping with userId=null) would wipe a perfectly valid
    // cache, force a refetch on every cold start, and — worse — drop a user
    // who's offline at launch into read-only mode despite a fresh cache.
    if (isAuthBootstrapping) return;

    let cancelled = false;

    async function bootstrap() {
      // Always read whatever's in cache first, regardless of whether we have
      // a user id — this populates the state with prior data while we decide
      // whether to fetch.
      const cached = await readCachedEntitlement();
      if (cancelled) return;

      // No user id (signed out or pre-signin) → clear cache, go to a clean
      // bootstrapped state. We don't keep cached entitlement across sign-outs.
      if (!userId) {
        if (cached) {
          await clearCachedEntitlement();
        }
        if (cancelled) return;
        setState({
          cached: null,
          isBootstrapping: false,
          isValidating: false,
        });
        return;
      }

      // User id present, but cache is for a different user → clear and fetch
      // fresh.
      if (cached && cached.user_id !== userId) {
        await clearCachedEntitlement();
        if (cancelled) return;
        setState({
          cached: null,
          isBootstrapping: true,
          isValidating: false,
        });
        await fetchAndCache(userId);
        return;
      }

      // Cache exists for this user. Show it immediately, then decide whether
      // to revalidate based on staleness.
      if (cached) {
        setState({
          cached,
          isBootstrapping: false,
          isValidating: false,
        });
        if (isStale(cached.last_validated_at, now())) {
          await fetchAndCache(userId);
        }
        return;
      }

      // No cache, but we have a user id → first-time validation.
      await fetchAndCache(userId);
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [userId, isAuthBootstrapping, fetchAndCache]);

  // App foreground listener. On every transition to 'active', re-check
  // staleness and fetch if needed.
  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState !== "active") return;
      const uid = userIdRef.current;
      if (!uid) return;

      // Read the latest cache (avoid stale closure on `state.cached`).
      void readCachedEntitlement().then((cached) => {
        if (cached && cached.user_id === uid && isStale(cached.last_validated_at, now())) {
          void fetchAndCache(uid);
        }
      });
    }

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => {
      subscription.remove();
    };
  }, [fetchAndCache]);

  const refresh = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    await fetchAndCache(uid);
  }, [fetchAndCache]);

  return { state, refresh };
}

function isStale(lastValidatedAt: string, currentTime: Date): boolean {
  const last = new Date(lastValidatedAt);
  if (Number.isNaN(last.getTime())) return true;  // malformed → re-validate
  const ageMs = currentTime.getTime() - last.getTime();
  const stalenessMs = TRIAL_REVALIDATION_STALENESS_MINUTES * 60 * 1000;
  return ageMs > stalenessMs;
}
```

**The provider component** wraps children and computes the public context value:

```tsx
export function TrialValidationProvider({ children }: PropsWithChildren) {
  const { user, isBootstrapping: authIsBootstrapping } = useAuthSession();
  const { state, refresh } = useTrialValidationLifecycle(
    user?.id ?? null,
    authIsBootstrapping,
  );

  const value = useMemo<TrialValidationContextValue>(() => {
    const isBootstrapping = authIsBootstrapping || state.isBootstrapping;
    const cached = state.cached;
    const accessMode = computeAccessMode({
      lastValidatedAt: cached?.last_validated_at ?? null,
      now: now(),
    });

    return {
      isBootstrapping,
      isValidating: state.isValidating,
      accessMode: isBootstrapping ? "full" : accessMode,
      // Why "full" while bootstrapping: while we're still hydrating auth or
      // reading cache from disk, showing the read-only banner would be
      // visually noisy and untrue (we don't yet know the user's state).
      // Bootstrapping resolves quickly (typically <100ms); the banner appears
      // accurately once we know.
      entitlementStatus: cached?.entitlement_status ?? null,
      trialStartedAt: cached?.trial_started_at ?? null,
      trialEndsAt: cached?.trial_ends_at ?? null,
      lastValidatedAt: cached?.last_validated_at ?? null,
      refresh,
    };
  }, [
    authIsBootstrapping,
    state.cached,
    state.isBootstrapping,
    state.isValidating,
    refresh,
  ]);

  return (
    <TrialValidationContext.Provider value={value}>
      {children}
    </TrialValidationContext.Provider>
  );
}
```

**`src/providers/TrialValidationBootstrap.tsx`** — thin wrapper that just hosts the provider:

```tsx
import type { PropsWithChildren } from "react";

import { TrialValidationProvider } from "@/features/trial/hooks";

export function TrialValidationBootstrap({ children }: PropsWithChildren) {
  return <TrialValidationProvider>{children}</TrialValidationProvider>;
}
```

This file is intentionally thin — keeping the bootstrap separate from the provider lets us add bootstrap-specific instrumentation later (e.g., a Splash-screen-style render gate while bootstrapping) without touching the hooks file. For S8 the bootstrap is a one-liner; that's fine.

**`src/providers/AppProviders.tsx`** — insert the new bootstrap:

```tsx
import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/query/queryClient";
import { AuthBootstrap } from "@/providers/AuthBootstrap";
import { TrialValidationBootstrap } from "@/providers/TrialValidationBootstrap";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        <TrialValidationBootstrap>{children}</TrialValidationBootstrap>
      </AuthBootstrap>
    </QueryClientProvider>
  );
}
```

Order matters: `TrialValidationBootstrap` is *inside* `AuthBootstrap` so it can read `useAuthSession()`.

### Required tests

**`src/features/trial/__tests__/hooks.test.tsx`** — provider + hook tests. Mocks the auth context, the API, and the storage layer to keep the test focused on the lifecycle:

```tsx
import { render, waitFor, act } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";

import { useAuthSession } from "@/features/auth/hooks";
import {
  TrialValidationProvider,
  useTrialValidation,
} from "@/features/trial/hooks";
import {
  fetchTrialEntitlement,
  TrialEntitlementFetchError,
} from "@/features/trial/api";
import {
  clearCachedEntitlement,
  readCachedEntitlement,
  writeCachedEntitlement,
} from "@/features/trial/storage";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

import type { CachedTrialEntitlement } from "@/features/trial/types";

jest.mock("@/features/auth/hooks");
jest.mock("@/features/trial/api");
jest.mock("@/features/trial/storage");

const mockedUseAuthSession = useAuthSession as jest.Mock;
const mockedFetch = fetchTrialEntitlement as jest.Mock;
const mockedReadCache = readCachedEntitlement as jest.Mock;
const mockedWriteCache = writeCachedEntitlement as jest.Mock;
const mockedClearCache = clearCachedEntitlement as jest.Mock;

function ConsumerProbe({ onRender }: { onRender: (ctx: unknown) => void }) {
  const ctx = useTrialValidation();
  onRender(ctx);
  return <Text>{ctx.accessMode}</Text>;
}

function makeEntitlement(
  overrides: Partial<CachedTrialEntitlement> = {},
): CachedTrialEntitlement {
  return {
    user_id: "user-1",
    trial_started_at: "2026-04-15T00:00:00.000Z",
    trial_ends_at: "2026-04-29T00:00:00.000Z",
    entitlement_status: "trial",
    last_validated_at: "2026-05-01T11:00:00.000Z",  // 1h before "now"
    ...overrides,
  };
}

describe("TrialValidationProvider lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNowForTesting(new Date("2026-05-01T12:00:00.000Z"));
    mockedReadCache.mockResolvedValue(null);
    mockedWriteCache.mockResolvedValue(undefined);
    mockedClearCache.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetClockForTesting();
  });

  it("returns full access while bootstrapping and applies cache once loaded", async () => {
    mockedUseAuthSession.mockReturnValue({
      isBootstrapping: false,
      session: { id: "session-1" },
      user: { id: "user-1" },
    });
    mockedReadCache.mockResolvedValue(makeEntitlement());

    const renders: any[] = [];
    render(
      <TrialValidationProvider>
        <ConsumerProbe onRender={(ctx) => renders.push(ctx)} />
      </TrialValidationProvider>,
    );

    await waitFor(() => {
      expect(renders.at(-1)?.isBootstrapping).toBe(false);
    });
    expect(renders.at(-1)?.accessMode).toBe("full");
    expect(renders.at(-1)?.entitlementStatus).toBe("trial");
  });

  it("fetches entitlement on first sign-in (no cache, has user)", async () => {
    mockedUseAuthSession.mockReturnValue({
      isBootstrapping: false,
      session: { id: "session-1" },
      user: { id: "user-1" },
    });
    mockedReadCache.mockResolvedValue(null);
    mockedFetch.mockResolvedValue(makeEntitlement());

    render(
      <TrialValidationProvider>
        <ConsumerProbe onRender={() => undefined} />
      </TrialValidationProvider>,
    );

    await waitFor(() => {
      expect(mockedFetch).toHaveBeenCalledWith("user-1");
    });
    expect(mockedWriteCache).toHaveBeenCalled();
  });

  it("does not refetch when cache is fresh (<60min old)", async () => {
    mockedUseAuthSession.mockReturnValue({
      isBootstrapping: false,
      session: { id: "session-1" },
      user: { id: "user-1" },
    });
    // 30 minutes old.
    mockedReadCache.mockResolvedValue(
      makeEntitlement({ last_validated_at: "2026-05-01T11:30:00.000Z" }),
    );

    render(
      <TrialValidationProvider>
        <ConsumerProbe onRender={() => undefined} />
      </TrialValidationProvider>,
    );

    await waitFor(() => {
      expect(mockedReadCache).toHaveBeenCalled();
    });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("refetches on mount when cache is stale (>60min old)", async () => {
    mockedUseAuthSession.mockReturnValue({
      isBootstrapping: false,
      session: { id: "session-1" },
      user: { id: "user-1" },
    });
    // 90 minutes old.
    mockedReadCache.mockResolvedValue(
      makeEntitlement({ last_validated_at: "2026-05-01T10:30:00.000Z" }),
    );
    mockedFetch.mockResolvedValue(
      makeEntitlement({ last_validated_at: "2026-05-01T12:00:00.000Z" }),
    );

    render(
      <TrialValidationProvider>
        <ConsumerProbe onRender={() => undefined} />
      </TrialValidationProvider>,
    );

    await waitFor(() => {
      expect(mockedFetch).toHaveBeenCalledWith("user-1");
    });
  });

  it("clears cache and stays empty when there is no session", async () => {
    mockedUseAuthSession.mockReturnValue({
      isBootstrapping: false,
      session: null,
      user: null,
    });
    mockedReadCache.mockResolvedValue(makeEntitlement());

    render(
      <TrialValidationProvider>
        <ConsumerProbe onRender={() => undefined} />
      </TrialValidationProvider>,
    );

    await waitFor(() => {
      expect(mockedClearCache).toHaveBeenCalled();
    });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("clears cache and refetches when user_id changes", async () => {
    mockedUseAuthSession.mockReturnValue({
      isBootstrapping: false,
      session: { id: "session-2" },
      user: { id: "user-2" },
    });
    // Cache from user-1, user signing in is user-2.
    mockedReadCache.mockResolvedValue(makeEntitlement({ user_id: "user-1" }));
    mockedFetch.mockResolvedValue(makeEntitlement({ user_id: "user-2" }));

    render(
      <TrialValidationProvider>
        <ConsumerProbe onRender={() => undefined} />
      </TrialValidationProvider>,
    );

    await waitFor(() => {
      expect(mockedClearCache).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockedFetch).toHaveBeenCalledWith("user-2");
    });
  });

  it("flips to read_only when cache is beyond grace period", async () => {
    mockedUseAuthSession.mockReturnValue({
      isBootstrapping: false,
      session: { id: "session-1" },
      user: { id: "user-1" },
    });
    // 8 days old.
    mockedReadCache.mockResolvedValue(
      makeEntitlement({ last_validated_at: "2026-04-23T12:00:00.000Z" }),
    );
    // Fetch fails — user is offline. Cache stays as-is.
    mockedFetch.mockRejectedValue(
      new TrialEntitlementFetchError("offline", "network"),
    );

    const renders: any[] = [];
    render(
      <TrialValidationProvider>
        <ConsumerProbe onRender={(ctx) => renders.push(ctx)} />
      </TrialValidationProvider>,
    );

    await waitFor(() => {
      expect(renders.at(-1)?.isValidating).toBe(false);
    });
    expect(renders.at(-1)?.accessMode).toBe("read_only");
  });

  it("does not run lifecycle effect while auth is still bootstrapping", async () => {
    // Cold-start case: auth hasn't resolved yet. The lifecycle hook should
    // NOT fire its effect (no cache wipe, no fetch). Once auth settles with
    // a real user, the effect runs and the cached entitlement is preserved.
    mockedUseAuthSession.mockReturnValue({
      isBootstrapping: true,
      session: null,
      user: null,
    });
    mockedReadCache.mockResolvedValue(makeEntitlement());

    const { rerender } = render(
      <TrialValidationProvider>
        <ConsumerProbe onRender={() => undefined} />
      </TrialValidationProvider>,
    );

    // Give any pending promises a chance to resolve. Nothing should happen.
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedClearCache).not.toHaveBeenCalled();
    expect(mockedFetch).not.toHaveBeenCalled();

    // Now auth resolves with a real user.
    mockedUseAuthSession.mockReturnValue({
      isBootstrapping: false,
      session: { id: "session-1" },
      user: { id: "user-1" },
    });

    rerender(
      <TrialValidationProvider>
        <ConsumerProbe onRender={() => undefined} />
      </TrialValidationProvider>,
    );

    // Cache from prior session should be preserved (matching user_id, fresh
    // last_validated_at). No clear, no fetch.
    await waitFor(() => {
      expect(mockedReadCache).toHaveBeenCalled();
    });
    expect(mockedClearCache).not.toHaveBeenCalled();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("refresh() retries the fetch and updates state on success", async () => {
    mockedUseAuthSession.mockReturnValue({
      isBootstrapping: false,
      session: { id: "session-1" },
      user: { id: "user-1" },
    });
    mockedReadCache.mockResolvedValue(
      makeEntitlement({ last_validated_at: "2026-04-23T12:00:00.000Z" }),  // stale + read_only
    );

    // First call (mount) fails; second call (refresh) succeeds.
    mockedFetch
      .mockRejectedValueOnce(new TrialEntitlementFetchError("offline", "network"))
      .mockResolvedValueOnce(
        makeEntitlement({ last_validated_at: "2026-05-01T12:00:00.000Z" }),
      );

    const renders: any[] = [];
    const { rerender } = render(
      <TrialValidationProvider>
        <ConsumerProbe onRender={(ctx) => renders.push(ctx)} />
      </TrialValidationProvider>,
    );

    // Wait for first fail.
    await waitFor(() => expect(renders.at(-1)?.accessMode).toBe("read_only"));

    // Trigger manual refresh.
    await act(async () => {
      await renders.at(-1)?.refresh();
    });

    await waitFor(() => expect(renders.at(-1)?.accessMode).toBe("full"));
  });
});
```

Nine cases. They cover: bootstrap with cache (D2), first-time validation (no cache), no-refetch when fresh (D3 60-min threshold), refetch when stale, sign-out path, user-id change, the grace-exhausted read-only path (D1, D4), the cold-start auth-bootstrapping short-circuit (preventing cache wipe before auth resolves — see the bug this caught in the test plan), and manual refresh. Together they pin the lifecycle's moving parts.

The `AppState` listener is hard to test cleanly without React Native's listener machinery; the manual `refresh()` test is a sufficient proxy for the "user comes back to the app, banner is showing, taps Reconnect, fetch succeeds" path. If a real `AppState`-driven test is desired, mock `AppState.addEventListener` to capture the listener and invoke it manually — that's a test-quality polish for a followup, not a blocker for S8.

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes — eight new tests, plus everything pre-existing.
- The provider tree is correctly ordered: `QueryClientProvider → AuthBootstrap → TrialValidationBootstrap → children`. Verify by booting the simulator: a screen calling `useTrialValidation()` resolves successfully (it would throw "must be used within TrialValidationProvider" if misordered).
- Manual smoke (best done after S8-04 lands UI consumers, but verifiable now via dev-only logging):
  1. Cold start with valid cache <60min old. Verify `fetchTrialEntitlement` is **not** called (in dev console / logger).
  2. Cold start with valid cache >60min old. Verify the fetch fires.
  3. Cold start with no cache + signed-in user. Verify the fetch fires.
  4. Cold start while signed out. Verify cache is cleared if any was present, no fetch.
- No regressions: all existing screens still render, sign-in/sign-up still work, onboarding still completes.

### References

- `docs/core-v1-requirements.md` §16, §24.12.
- `docs/tech-handoff-core-v1.md` §6.3 (grace-period decision), §4.7 (cache shape).
- `src/providers/AuthBootstrap.tsx` (the lifecycle pattern reference).

### Out of scope

- The read-only banner UI — DEV-S8-04.
- Settings displaying `entitlementStatus` — DEV-S8-05.
- Refactoring `AuthBootstrap` to share lifecycle utilities with `TrialValidationBootstrap` — keep them parallel for now; if they accumulate shared logic, extract in a polish pass.
- Adding a Splash-screen-style render gate while bootstrapping. Today's existing render-gate is `app/_layout.tsx`'s `dbReady && fontsLoaded` gate; we're choosing not to extend it to wait for trial bootstrap because (a) the cache typically loads in <100ms and (b) showing "full" mode briefly while bootstrapping is preferable to a flash of read-only banner that immediately disappears.

---

## DEV-S8-04 — Read-only mode UI

**Estimate:** 0.75 day
**Depends on:** DEV-S8-03 merged into `sprint-8`.
**Branch suggestion:** `s8/read-only-ui`

### Context

Wires the `accessMode` from S8-03 into the four screens that mutate user data: Today, Habit Detail, Create Habit, Edit Habit. Per (D11), a shared `ReadOnlyBanner` component renders at the top of each screen; mutation buttons are visibly disabled (greyed, not hidden) when `accessMode === "read_only"`; the banner's "Reconnect" button calls `useTrialValidation().refresh()`.

The risk is that "disabled" needs to be applied consistently across heterogeneous mutation surfaces — Today's Done/Skip, Habit Detail's Archive and the RetroLogSelector, Create Habit's Save, Edit Habit's Save. Each surface has its own existing button and disabled-state pattern; we need to layer the trial-disabled state on top without breaking the existing pending-state or local-validation-disabled paths.

### Files to read first

- `src/features/trial/hooks.ts` (from S8-03) — confirm `useTrialValidation()` return shape.
- `src/components/buttons/PrimaryButton.tsx` and `src/components/buttons/SecondaryButton.tsx` — confirm the existing `disabled` prop.
- `src/features/today/screens/TodayScreen.tsx` — note the FocusCard pattern; the existing `disabled` derivation on Done/Skip (currently driven by mutation pending state and per-status local logic).
- `src/features/today/components/FocusCard.tsx` (or wherever the Focus card lives — verify) — same.
- `src/features/today/components/SupportingHabitsList.tsx` (or equivalent) — note any supporting card mutation buttons.
- `src/features/habits/screens/HabitDetailScreen.tsx` — the RetroLogSelector wiring, the Archive button, the Edit habit button.
- `src/features/habits/components/RetroLogSelector.tsx` — confirm the `canEdit` prop.
- `src/features/habits/screens/CreateHabitScreen.tsx` — confirm the Save button + form layout.
- `src/features/habits/screens/EditHabitScreen.tsx` — same.
- `src/theme/colors.ts` and `src/theme/spacing.ts` — pick tokens for the banner styling.

### Files to create

- `src/components/ReadOnlyBanner.tsx` — the shared banner component.
- `src/components/__tests__/ReadOnlyBanner.test.tsx`
- `src/features/today/screens/__tests__/TodayScreen.readOnly.test.tsx` — extends or accompanies the existing TodayScreen tests with read-only-specific cases.

### Files to modify

- `src/features/today/screens/TodayScreen.tsx` — render banner; disable Focus Done/Skip; disable Supporting Done/Skip.
- `src/features/habits/screens/HabitDetailScreen.tsx` — render banner; derive `canEdit` and `readOnlyReason`; disable Archive; disable Edit.
- `src/features/habits/components/RetroLogSelector.tsx` — accept optional `readOnlyReason?: 'window' | 'app'` prop; branch the locked-day copy.
- `src/features/habits/screens/CreateHabitScreen.tsx` — render banner; disable Save with helper.
- `src/features/habits/screens/EditHabitScreen.tsx` — render banner; disable Save with helper.

### Required: ReadOnlyBanner component

**`src/components/ReadOnlyBanner.tsx`**

```tsx
import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { useTrialValidation } from "@/features/trial/hooks";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";

export function ReadOnlyBanner() {
  const { accessMode, isValidating, refresh } = useTrialValidation();

  if (accessMode !== "read_only") {
    return null;
  }

  return (
    <View style={styles.container} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text selectable style={styles.title}>
        Reconnect to keep logging.
      </Text>
      <Text selectable style={styles.body}>
        We haven't been able to verify your account in a while. Tap to reconnect.
      </Text>
      <PrimaryButton
        disabled={isValidating}
        label={isValidating ? "Reconnecting…" : "Reconnect"}
        onPress={() => void refresh()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
});
```

Notes:
- The component is self-rendering — it renders `null` when `accessMode === "full"` so callers don't need to gate it themselves. They render `<ReadOnlyBanner />` unconditionally.
- The styling uses the same `colors.surface` / `colors.border` palette as other informational cards. **No red, no warning iconography**, per (D5).
- `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"` make screen readers announce the banner when it appears.
- Calling `refresh()` while `isValidating` is true would be redundant; `disabled={isValidating}` prevents this. The button label changes during the in-flight state ("Reconnecting…") so the user gets feedback.

### Required: TodayScreen modifications

Insert the banner at the top of the ScrollView and derive an `isReadOnly` flag for disabling buttons:

```tsx
// At the top of TodayScreen, after existing hook destructuring:
const { accessMode } = useTrialValidation();
const isReadOnly = accessMode === "read_only";

// In the JSX, as the first child of <ScrollView contentContainerStyle={...}>:
<ReadOnlyBanner />

// On the Focus card's Done/Skip buttons (or in the FocusCard component, if
// the buttons live there), pass an additional disabled flag:
<PrimaryButton
  disabled={
    isReadOnly ||
    upsertHabitLogMutation.isPending ||
    /* existing disabled conditions */
  }
  label={...}
  onPress={...}
/>
```

If `FocusCard` is a separate component, pass `isReadOnly` as a prop and apply at the button level inside the component. Same for `SupportingHabitsList` / supporting card components.

**Note on banner placement**: at the top of the ScrollView, above the Focus card. The banner is informational, not blocking — the user can still scroll past it to see her habits, even though she can't log them. This aligns with (D5)'s "treat the user as an adult dealing with a temporary inconvenience."

### Required: RetroLogSelector modification

Currently the selector renders a single locked-day message when `canEdit={false}`: *"This day is locked. Logs older than 48 hours can't be changed."* That's accurate when the user tapped a cell outside the 48-hour retro window. It's misleading when the user is in read-only mode and tapped a cell that's *within* the window — there, the cell isn't locked because of time, it's locked because the app needs to revalidate. "Reconnect" would unlock it; the existing copy implies it never will.

Add an optional `readOnlyReason?: 'window' | 'app'` prop and branch the copy:

```tsx
type RetroLogSelectorProps = {
  canEdit: boolean;
  currentStatus: HabitLogStatus | null;
  date: string;
  isVisible: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (status: HabitLogStatus) => Promise<void>;
  readOnlyReason?: "window" | "app";  // NEW
};
```

In the existing `canEdit ? ... : <locked-text>` block, replace the static copy with:

```tsx
{!canEdit ? (
  <Text selectable style={styles.lockedText}>
    {readOnlyReason === "app"
      ? "Reconnect to log on this day."
      : "This day is locked. Logs older than 48 hours can't be changed."}
  </Text>
) : null}
```

The default branch (no `readOnlyReason` passed, or `readOnlyReason === "window"`) preserves the existing copy. Existing call sites that don't pass the prop are unaffected.

### Required: HabitDetailScreen modifications

```tsx
// At the top, after existing hook destructuring:
const { accessMode } = useTrialValidation();
const isReadOnly = accessMode === "read_only";

// Banner at the top of the ScrollView:
<ReadOnlyBanner />

// In the cell-press handler, derive canEdit and the lock-reason. The reason
// matters for the user-facing copy in the selector — a window-locked day
// stays locked even after reconnecting, so we don't want to mislead.
function handleCellPress(date: string) {
  if (!habit) return;
  if (date < habit.start_date) return;
  const existing = heatmapLogs.find((log) => log.log_date === date);
  const currentStatus = existing?.status ?? null;

  const withinWindow = isWithinRetroWindow(date, now());
  const canEdit = withinWindow && !isReadOnly;
  // Tiebreak when both apply: window beats app. Reconnecting won't unlock an
  // out-of-window day, so the "Reconnect" message would mislead.
  const readOnlyReason: "window" | "app" | undefined = canEdit
    ? undefined
    : !withinWindow
      ? "window"
      : "app";

  setSelectorState({
    visible: true,
    date,
    currentStatus,
    canEdit,
    readOnlyReason,
  });
}
```

**Note on the `selectorState` shape**: the existing state from S6 is `{ visible; date; currentStatus; canEdit }`. Extend it with the new optional field:

```tsx
const [selectorState, setSelectorState] = useState<{
  visible: boolean;
  date: string;
  currentStatus: HabitLogStatus | null;
  canEdit: boolean;
  readOnlyReason?: "window" | "app";  // NEW
} | null>(null);
```

And thread the prop through where the selector renders:

```tsx
<RetroLogSelector
  canEdit={selectorState.canEdit}
  currentStatus={selectorState.currentStatus}
  date={selectorState.date}
  isVisible={selectorState.visible}
  isPending={upsertHabitLogMutation.isPending}
  onClose={handleSelectorClose}
  onSubmit={handleSelectorSubmit}
  readOnlyReason={selectorState.readOnlyReason}
/>

// The Archive button:
<SecondaryButton
  disabled={isReadOnly || archiveHabitMutation.isPending}
  label="Archive habit"
  onPress={...}
/>

// The Edit habit button:
<SecondaryButton
  disabled={isReadOnly}
  label="Edit habit"
  onPress={() => router.push(`/(app)/habits/${habit.id}/edit`)}
/>
```

The forcing of `canEdit={false}` in `handleCellPress` is the simplest change — the existing RetroLogSelector already handles the `canEdit={false}` case correctly (showing the locked-day message and only the Close button). No changes needed inside the selector itself.

### Required: CreateHabitScreen and EditHabitScreen modifications

Both screens get the same treatment:

```tsx
// At the top, after existing hooks:
const { accessMode } = useTrialValidation();
const isReadOnly = accessMode === "read_only";

// Banner at the top of the ScrollView:
<ReadOnlyBanner />

// On the Save / Create button:
<PrimaryButton
  disabled={isReadOnly || /* existing disabled conditions */}
  label="Save"
  onPress={...}
/>

// Helper text under the disabled button (rendered only in read-only):
{isReadOnly ? (
  <Text selectable style={styles.disabledHelper}>
    Reconnect to create new habits.
  </Text>
) : null}
```

For EditHabitScreen, the helper copy reads *"Reconnect to edit habits."* The form fields themselves remain interactive (the user can type, change values) — only the Save button is gated. This matches the brand-voice point in (D5): treat the user as an adult who can prepare her edits while waiting to reconnect.

Add the `disabledHelper` style to each screen's `StyleSheet.create({ ... })`:

```ts
disabledHelper: {
  color: colors.textMuted,
  fontSize: 14,
  lineHeight: 20,
  marginTop: spacing.sm,
  textAlign: "center",
},
```

### Required tests

**`src/components/__tests__/ReadOnlyBanner.test.tsx`**

```tsx
import { fireEvent, render, screen } from "@testing-library/react-native";

import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import { useTrialValidation } from "@/features/trial/hooks";

jest.mock("@/features/trial/hooks");

const mockedUseTrialValidation = useTrialValidation as jest.Mock;

describe("ReadOnlyBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when accessMode is full", () => {
    mockedUseTrialValidation.mockReturnValue({
      accessMode: "full",
      isValidating: false,
      refresh: jest.fn(),
    });
    const { toJSON } = render(<ReadOnlyBanner />);
    expect(toJSON()).toBeNull();
  });

  it("renders the calm banner copy when accessMode is read_only", () => {
    mockedUseTrialValidation.mockReturnValue({
      accessMode: "read_only",
      isValidating: false,
      refresh: jest.fn(),
    });
    render(<ReadOnlyBanner />);
    expect(screen.getByText("Reconnect to keep logging.")).toBeTruthy();
    expect(
      screen.getByText(
        "We haven't been able to verify your account in a while. Tap to reconnect.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Reconnect")).toBeTruthy();
  });

  it("calls refresh when Reconnect is tapped", () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    mockedUseTrialValidation.mockReturnValue({
      accessMode: "read_only",
      isValidating: false,
      refresh,
    });
    render(<ReadOnlyBanner />);
    fireEvent.press(screen.getByText("Reconnect"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("disables the button and shows 'Reconnecting…' label while validating", () => {
    mockedUseTrialValidation.mockReturnValue({
      accessMode: "read_only",
      isValidating: true,
      refresh: jest.fn(),
    });
    render(<ReadOnlyBanner />);
    expect(screen.getByText("Reconnecting…")).toBeTruthy();
  });
});
```

**`src/features/today/screens/__tests__/TodayScreen.readOnly.test.tsx`** — three cases pinning the read-only behavior on Today:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import React from "react";

import TodayScreen from "@/features/today/screens/TodayScreen";
import { useTrialValidation } from "@/features/trial/hooks";

jest.mock("@/features/trial/hooks");
// Plus the existing TodayScreen mock setup — copy from the existing test file.

const mockedUseTrialValidation = useTrialValidation as jest.Mock;

describe("TodayScreen — read-only mode", () => {
  beforeEach(() => {
    // ... existing setup ...
  });

  it("renders the read-only banner when accessMode is read_only", () => {
    mockedUseTrialValidation.mockReturnValue({
      accessMode: "read_only",
      isValidating: false,
      refresh: jest.fn(),
    });
    // ... render TodayScreen with a habit ...
    expect(screen.getByText("Reconnect to keep logging.")).toBeTruthy();
  });

  it("does not render the banner in full mode", () => {
    mockedUseTrialValidation.mockReturnValue({
      accessMode: "full",
      isValidating: false,
      refresh: jest.fn(),
    });
    expect(screen.queryByText("Reconnect to keep logging.")).toBeNull();
  });

  it("disables Done and Skip buttons in read-only mode", () => {
    mockedUseTrialValidation.mockReturnValue({
      accessMode: "read_only",
      isValidating: false,
      refresh: jest.fn(),
    });
    // Render with a Focus habit. Find Done button. Assert its accessibilityState.
    // Use the testing library's getByRole or the disabled prop check.
    const doneButton = screen.getByText("Done");
    expect(doneButton).toBeDisabled?.()
      || expect(doneButton.props.accessibilityState?.disabled).toBe(true);
    // (Whichever assertion shape matches the project's existing test patterns.
    //  Verify by looking at the existing TodayScreen tests for how they assert
    //  disabled state.)
  });
});
```

The existing TodayScreen test file pattern (mock `useTodayHabits`, `useUpsertTodayHabitStatusMutation`, etc.) is the reference for the rest of the setup. Copy that scaffolding; layer the trial validation mock on top.

For HabitDetailScreen, CreateHabitScreen, and EditHabitScreen, the tests are similar in shape — render with `accessMode: "read_only"`, assert the banner is present and the relevant button is disabled. Three small assertions per screen is sufficient; the heavy lifting was done in the unit tests for `ReadOnlyBanner` and the lifecycle hook.

**Extension to `src/features/habits/components/__tests__/RetroLogSelector.test.tsx`** (the file built in DEV-S6-02) — two new cases for the `readOnlyReason` prop:

```tsx
it("renders 'Reconnect to log on this day.' when readOnlyReason is 'app'", () => {
  render(
    <RetroLogSelector
      canEdit={false}
      currentStatus={null}
      date="2026-04-29"
      isVisible
      isPending={false}
      onClose={jest.fn()}
      onSubmit={jest.fn().mockResolvedValue(undefined)}
      readOnlyReason="app"
    />,
  );
  expect(screen.getByText("Reconnect to log on this day.")).toBeTruthy();
  expect(
    screen.queryByText("This day is locked. Logs older than 48 hours can't be changed."),
  ).toBeNull();
});

it("renders the existing window-locked copy when readOnlyReason is omitted", () => {
  render(
    <RetroLogSelector
      canEdit={false}
      currentStatus={null}
      date="2026-04-29"
      isVisible
      isPending={false}
      onClose={jest.fn()}
      onSubmit={jest.fn().mockResolvedValue(undefined)}
    />,
  );
  expect(
    screen.getByText("This day is locked. Logs older than 48 hours can't be changed."),
  ).toBeTruthy();
});
```

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes — banner tests + read-only screen tests + everything pre-existing.
- Manual smoke (this is the first ticket where the user-visible feature actually works):
  1. **Full mode (default).** Sign in normally. App lands on Today with no banner. Done/Skip work. Navigate to Habit Detail; tap a recent cell; selector opens with Done/Skip; logging works. Archive works. Edit Habit works. Create Habit works.
  2. **Read-only mode (forced).** Manually corrupt the cache to simulate >7-day grace exhaustion: in dev console, write a cache entry with `last_validated_at` set to 8 days ago, then reload the app. Expected: banner appears at the top of Today; Done/Skip are visibly disabled (greyed); Habit Detail's heatmap cells still render but the selector opens in read-only mode; Archive and Edit are disabled; Create Habit's Save is disabled. Tap "Reconnect" — if the device is online and validation succeeds, banner disappears and full access returns. If offline, banner stays.
  3. **Reconnect path.** From the read-only state, kill the network connection, then tap Reconnect. Expected: button label changes to "Reconnecting…", brief delay, button returns to "Reconnect" (validation failed). Banner stays. Restore network; tap Reconnect again. Expected: validation succeeds; banner disappears.
- No regressions: full-mode behavior is byte-identical to S7's behavior; the only difference is the absence of the banner and the absence of the trial-disabled state on buttons.

### References

- `docs/core-v1-requirements.md` §16.3 (offline behavior), §24.12.
- `src/features/trial/hooks.ts` (from S8-03 — the context).
- `sprint-7-tickets.md` style for read-only-style screen modifications (the recovery modal lifecycle pattern is the closest reference).

### Out of scope

- Settings displaying entitlement status — DEV-S8-05.
- Banner on Onboarding screens — explicitly excluded per (D11).
- Banner on Settings — explicitly excluded per (D11) (Settings is a service surface, not a mutation surface; the trial status sub-line in S8-05 is the indicator there).
- Banner on Recovery modal or single-miss reframing — explicitly excluded per (D11).
- Animated banner enter/exit transitions — followup if beta wants polish.
- Localizing banner copy — Core v1 is English-only.

---

## DEV-S8-05 — Settings refresh

**Estimate:** 0.5 day
**Depends on:** DEV-S8-04 merged into `sprint-8`.
**Branch suggestion:** `s8/settings-refresh`

### Context

The smallest of the three deliverables, but with the most product-decision touch points. Five changes to `SettingsScreen.tsx`:

1. **Drop the "Foundation status" card entirely** per (D7).
2. **Add a quiet trial status sub-line under Account** per (D6) — status word only, no countdown.
3. **Refresh the Inactive habits section copy** per (D8) — keep the section in place; just update copy.
4. **Add an App version row** showing `expo-constants` version.
5. **Add Privacy policy + Terms of service placeholder rows** — non-functional in S8 (S20 wires real links).

Sequencing inside the file: Account section (with email + status sub-line) at top, then archived habits, then About (app version + privacy + terms), then Sign Out. The sign-out button stays at the bottom — primary destructive action separated from the rest.

### Files to read first

- `src/features/settings/screens/SettingsScreen.tsx` — the entire current file. Note the existing card pattern (`styles.card`), the typography tokens used, the `useInactiveHabitsQuery` consumption, and the `signOut` flow.
- `src/features/trial/hooks.ts` (from S8-03) — confirm `entitlementStatus` is exposed on the context and is `TrialEntitlementStatus | null`.
- `expo-constants` — confirm the import (`import * as Constants from 'expo-constants'`) and the version field (typically `Constants.expoConfig?.version` or `Constants.default.expoConfig?.version` depending on Expo SDK version; verify by checking another file that already reads version, or checking `app.json`'s version field).
- `src/utils/userFacingErrors.ts` — pattern reference for any new copy helpers (none needed in S8-05; copy is inline).

### Files to modify

- `src/features/settings/screens/SettingsScreen.tsx`

### Files to create

- `src/features/settings/screens/__tests__/SettingsScreen.test.tsx` — new file, six cases pinning the new layout.

### Required changes to `SettingsScreen.tsx`

Step 1: drop the Foundation status card entirely. Find this block:

```tsx
<View style={styles.card}>
  <Text selectable style={styles.title}>
    Foundation status
  </Text>
  <Text selectable style={styles.body}>
    Current version: full non-AI habit builder. Weekly reviews and
    rule-based suggestions are enabled. AI coaching is planned for a later
    premium phase.
  </Text>
</View>
```

Delete it.

Step 2: add a trial status sub-line under the Account email. Modify the existing Account card:

```tsx
<View style={styles.card}>
  <Text selectable style={styles.title}>
    Account
  </Text>
  <Text selectable style={styles.body}>
    {user?.email ?? "Signed in"}
  </Text>
  {trialStatusLabel ? (
    <Text selectable style={styles.subBody}>
      {trialStatusLabel}
    </Text>
  ) : null}
</View>
```

Where `trialStatusLabel` is computed at the top of the screen:

```tsx
const { entitlementStatus } = useTrialValidation();

const trialStatusLabel = (() => {
  switch (entitlementStatus) {
    case "trial":
      return "Trial";
    case "active":
      return "Active";
    case "expired":
      return "Trial ended";
    case "paid":
      return "Paid";
    case "cancelled":
      return "Cancelled";
    default:
      return null;
  }
})();
```

The `null` case (when `entitlementStatus` is `null` because cache hasn't loaded yet, or after sign-out) renders no sub-line — that's correct; we don't want to show "Unknown" or a placeholder while bootstrapping.

Add the `subBody` style:

```ts
subBody: {
  color: colors.textMuted,
  fontSize: 14,
  fontWeight: "600",
  lineHeight: 20,
  marginTop: spacing.xs,
},
```

Step 3: refresh the Inactive habits section copy per (D8). Find the existing block:

```tsx
<View style={styles.card}>
  <Text selectable style={styles.title}>
    Inactive habits
  </Text>
  ...
  <Text selectable style={styles.body}>
    Open any inactive habit to reactivate it from Habit Detail.
  </Text>
  ...
  <EmptyState
    body="Deactivated habits will appear here so you can inspect or reactivate them."
    title="No inactive habits"
  />
  ...
</View>
```

Update to:

```tsx
<View style={styles.card}>
  <Text selectable style={styles.title}>
    Your archived habits
  </Text>
  ...
  <Text selectable style={styles.body}>
    Pause and resume habits without losing their history.
  </Text>
  ...
  <EmptyState
    body="Habits you've paused will appear here so you can come back to them."
    title="No archived habits"
  />
  ...
</View>
```

The list rendering inside the card stays unchanged — only the surrounding copy is updated.

Step 4: add an About card with App version + Privacy + Terms placeholder rows. Insert before the Sign Out button:

```tsx
<View style={styles.card}>
  <Text selectable style={styles.title}>
    About
  </Text>
  <View style={styles.aboutRow}>
    <Text selectable style={styles.aboutRowLabel}>
      App version
    </Text>
    <Text selectable style={styles.aboutRowValue}>
      {appVersion}
    </Text>
  </View>
  <View style={styles.aboutRow}>
    <Text selectable style={styles.aboutRowLabel}>
      Privacy policy
    </Text>
    <Text selectable style={styles.aboutRowValuePlaceholder}>
      Coming soon
    </Text>
  </View>
  <View style={styles.aboutRow}>
    <Text selectable style={styles.aboutRowLabel}>
      Terms of service
    </Text>
    <Text selectable style={styles.aboutRowValuePlaceholder}>
      Coming soon
    </Text>
  </View>
</View>
```

Where `appVersion` is computed at the top:

```tsx
import * as Constants from "expo-constants";

const appVersion =
  Constants.expoConfig?.version ?? Constants.default.expoConfig?.version ?? "—";
```

(Verify the exact import path against the Expo SDK 54 API. If a different field is correct — e.g., `Constants.nativeAppVersion` from `expo-application` — use that instead. The em-dash fallback is for cases where the version isn't readable; better than crashing.)

Add the about-row styles:

```ts
aboutRow: {
  alignItems: "center",
  borderColor: colors.border,
  borderTopWidth: 1,
  flexDirection: "row",
  justifyContent: "space-between",
  paddingTop: spacing.md,
},
aboutRowLabel: {
  color: colors.text,
  fontSize: 14,
  fontWeight: "600",
},
aboutRowValue: {
  color: colors.textMuted,
  fontSize: 14,
},
aboutRowValuePlaceholder: {
  color: colors.textMuted,
  fontSize: 14,
  fontStyle: "italic",
},
```

The `borderTopWidth: 1` on each row gives a subtle divider between Privacy/Terms/version. The first row (App version) inherits the border-top from the row pattern; if you don't want a border above the first row, drop the `borderTopWidth` for the first child specifically (e.g., via a `:first-child`-equivalent inline style).

Step 5: imports to add at the top of the file:

```tsx
import * as Constants from "expo-constants";
import { useTrialValidation } from "@/features/trial/hooks";
```

### Required tests

**`src/features/settings/screens/__tests__/SettingsScreen.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react-native";
import React from "react";

import SettingsScreen from "@/features/settings/screens/SettingsScreen";
import { useTrialValidation } from "@/features/trial/hooks";
import { useAuthSession } from "@/features/auth/hooks";
import { useInactiveHabitsQuery } from "@/features/habits/hooks";

jest.mock("@/features/trial/hooks");
jest.mock("@/features/auth/hooks");
jest.mock("@/features/habits/hooks", () => ({
  useInactiveHabitsQuery: jest.fn(),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));
jest.mock("expo-constants", () => ({
  expoConfig: { version: "1.0.0" },
  default: { expoConfig: { version: "1.0.0" } },
}));

const mockedUseTrialValidation = useTrialValidation as jest.Mock;
const mockedUseAuthSession = useAuthSession as jest.Mock;
const mockedUseInactiveHabits = useInactiveHabitsQuery as jest.Mock;

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuthSession.mockReturnValue({
      isBootstrapping: false,
      session: { id: "session-1" },
      user: { id: "user-1", email: "tester@example.com" },
    });
    mockedUseInactiveHabits.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    mockedUseTrialValidation.mockReturnValue({
      accessMode: "full",
      entitlementStatus: "trial",
      isValidating: false,
      refresh: jest.fn(),
    });
  });

  it("renders the user email", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("tester@example.com")).toBeTruthy();
  });

  it("renders 'Trial' sub-line when entitlementStatus is trial", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("Trial")).toBeTruthy();
  });

  it("renders 'Trial ended' sub-line when entitlementStatus is expired", () => {
    mockedUseTrialValidation.mockReturnValue({
      accessMode: "full",
      entitlementStatus: "expired",
      isValidating: false,
      refresh: jest.fn(),
    });
    render(<SettingsScreen />);
    expect(screen.getByText("Trial ended")).toBeTruthy();
  });

  it("renders no trial sub-line when entitlementStatus is null", () => {
    mockedUseTrialValidation.mockReturnValue({
      accessMode: "full",
      entitlementStatus: null,
      isValidating: false,
      refresh: jest.fn(),
    });
    render(<SettingsScreen />);
    // None of the status-word strings should appear.
    expect(screen.queryByText("Trial")).toBeNull();
    expect(screen.queryByText("Trial ended")).toBeNull();
    expect(screen.queryByText("Active")).toBeNull();
  });

  it("renders the refreshed archived-habits section copy", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("Your archived habits")).toBeTruthy();
    expect(screen.getByText("No archived habits")).toBeTruthy();
    expect(
      screen.getByText("Habits you've paused will appear here so you can come back to them."),
    ).toBeTruthy();
  });

  it("does NOT render the dropped 'Foundation status' card", () => {
    render(<SettingsScreen />);
    expect(screen.queryByText("Foundation status")).toBeNull();
  });

  it("renders the About card with version, Privacy, and Terms rows", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("About")).toBeTruthy();
    expect(screen.getByText("App version")).toBeTruthy();
    expect(screen.getByText("1.0.0")).toBeTruthy();
    expect(screen.getByText("Privacy policy")).toBeTruthy();
    expect(screen.getByText("Terms of service")).toBeTruthy();
    // Both placeholders render the same "Coming soon" text — find via getAllByText.
    const placeholders = screen.getAllByText("Coming soon");
    expect(placeholders.length).toBe(2);
  });
});
```

Seven cases. They cover: email rendering (existing baseline), each non-null status word, null status (no sub-line), copy refresh on archived habits, absence of Foundation card, About card content.

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes — seven new tests, plus everything pre-existing.
- Manual smoke:
  1. Open Settings as a normal user (full mode, status `trial`). Verify: Account card shows email + "Trial" sub-line. Archived habits section uses the refreshed copy. About card shows app version (matches `app.json`'s version field), Privacy policy → Coming soon, Terms of service → Coming soon. Foundation status card is gone. Sign Out button at the bottom still works.
  2. Force read-only mode (per S8-04 smoke procedure). Open Settings. **No banner is rendered on Settings** (per (D11)). Trial status sub-line still shows the cached status. Sign Out still works.
  3. Sign out, sign back in. Settings hydrates correctly with the new user's email and (after the trial fetch resolves) the new user's status.
- No regressions: navigating to/from Settings works; the existing Inactive habits list still renders and routes to Habit Detail correctly when a card is tapped.

### References

- `docs/core-v1-requirements.md` §15 (Settings spec).
- `src/features/trial/hooks.ts` (from S8-03).
- The product-strategy decision history captured in (D6), (D7), (D8).

### Out of scope

- Real Privacy policy + Terms content or links — S20 work.
- Reminder master toggle — S17 work.
- Anonymous analytics opt-out toggle — S21 work.
- Habit management (per requirements §15.2 — promote backlog, reactivate archived, etc.) — S15 work.
- Acknowledgments page — S20 polish.
- Support email or contact form — S20 polish.
- Refactoring the existing card pattern into a reusable `<SettingsCard>` component — keep the inline cards for now; if they accumulate, extract in a polish pass.

---

## DEV-S8-06 — Bug #2: dual suggestion display

**Estimate:** 0.5 day
**Depends on:** DEV-S8-05 merged into `sprint-8`.
**Branch suggestion:** `s8/dual-suggestion-display`

### Context

Tracked as Bug #2 in PROJECT_BRAIN §8. The existing `getHabitAdjustmentSuggestion` returns one `HabitAdjustmentSuggestion`; when both `tiny_action_too_hard === true` AND `trigger_worked === false`, it collapses them into a single `fix_trigger_and_tiny_action` suggestion. The bug name "dual suggestion display" implies the user should see them as **two distinct cards**, not one merged card.

Per (D9) and (D10): the engine returns `HabitAdjustmentSuggestion[]` (max 2) in priority order with action-fix first; the combined type is removed entirely; HabitDetailScreen maps over the array.

#### Inertness note (read this before estimating effort up or down)

Bug #2 is **currently inert in production**. The dropped Supabase `weekly_reviews` query in `useHabitDetail` silently fails (per S5/S6/S7 followups), so `latestReview` is always `null` and the entire suggestion card on Habit Detail never renders for any real user. The fix is testable at the engine level and via the screen with a mocked `latestReview`, but real users won't see it until reviews migrates to local SQLite (post-Core-v1 phase).

We land it now anyway because:
1. The engine logic gets tested with full coverage — the next person touching this code (during reviews migration) inherits a clean engine, not a buggy one.
2. The display layer mapping change is co-located with the engine change, keeping the diff coherent.
3. The combined type's removal is a one-time refactor; doing it during reviews migration would distract from the migration itself.

Don't expect to see new behavior in the manual smoke for this ticket — the smoke is checking that nothing regresses, and that the engine tests pass. The display-side change is verified via screen tests with mocked review data.

### Files to read first

- `src/features/recommendations/types.ts` — the `HabitAdjustmentSuggestionType` union, the `HABIT_ADJUSTMENT_SUGGESTION_TYPES` array, the `HabitAdjustmentSuggestion` type, the `normalizeHabitAdjustmentSuggestionType` helper.
- `src/features/recommendations/copy.ts` — the `HABIT_ADJUSTMENT_SUGGESTIONS` record.
- `src/features/recommendations/habitAdjustmentEngine.ts` — the existing single-suggestion engine.
- `src/features/recommendations/editGuidance.ts` — confirm whether it has any switch/lookup on `fix_trigger_and_tiny_action`.
- `src/features/habits/screens/HabitDetailScreen.tsx` — the suggestion card render block (the section near `adjustmentSuggestion = latestReview ? getHabitAdjustmentSuggestion({...}) : null`).
- `src/features/habits/screens/EditHabitScreen.tsx` — confirm how it consumes `suggestionType` from `useLocalSearchParams`.
- `docs/PROJECT_BRAIN.md` §8 (the bug list).
- `docs/tech-handoff-core-v1.md` §8.6 (the recommendations note).

### Files to modify

- `src/features/recommendations/types.ts`
- `src/features/recommendations/copy.ts`
- `src/features/recommendations/habitAdjustmentEngine.ts`
- `src/features/recommendations/editGuidance.ts` (only if it has a `fix_trigger_and_tiny_action` case)
- `src/features/habits/screens/HabitDetailScreen.tsx`
- Any existing test that references `fix_trigger_and_tiny_action` (search the repo; expect at least one in `habitAdjustmentEngine.test.ts` if it exists).

### Files to create

- `src/features/recommendations/__tests__/habitAdjustmentEngine.test.ts` — if it doesn't already exist; otherwise extend.

### Required changes

**Step 1: drop `fix_trigger_and_tiny_action` from the union and array.**

In `src/features/recommendations/types.ts`:

```ts
export type HabitAdjustmentSuggestionType =
  | "make_tiny_action_smaller"
  | "change_trigger"
  | "reduce_friction"
  | "plan_for_obstacle"
  | "keep_going";

export const HABIT_ADJUSTMENT_SUGGESTION_TYPES: HabitAdjustmentSuggestionType[] = [
  "make_tiny_action_smaller",
  "change_trigger",
  "reduce_friction",
  "plan_for_obstacle",
  "keep_going",
];
```

`normalizeHabitAdjustmentSuggestionType` requires no logic change — it filters by membership in the array, which now excludes the dropped type.

**Step 2: drop the entry from `copy.ts`.** Remove the entire `fix_trigger_and_tiny_action: { ... }` entry from `HABIT_ADJUSTMENT_SUGGESTIONS`. After this, TypeScript will report errors anywhere the dropped key is referenced — that's the trail to follow.

**Step 3: rewrite the engine to return an array.**

In `src/features/recommendations/habitAdjustmentEngine.ts`:

```ts
import { HABIT_ADJUSTMENT_SUGGESTIONS } from "@/features/recommendations/copy";

import type {
  HabitAdjustmentInput,
  HabitAdjustmentSuggestion,
  HabitAdjustmentSuggestionType,
} from "@/features/recommendations/types";

function getSuggestion(
  type: HabitAdjustmentSuggestionType,
): HabitAdjustmentSuggestion {
  return HABIT_ADJUSTMENT_SUGGESTIONS[type];
}

export function getHabitAdjustmentSuggestions({
  latestReview,
  progress,
}: HabitAdjustmentInput): HabitAdjustmentSuggestion[] {
  const triggerBroken = latestReview.trigger_worked === false;
  const actionTooHard = latestReview.tiny_action_too_hard === true;

  // (D9) Both flags hot: action-fix first, trigger-fix second.
  if (triggerBroken && actionTooHard) {
    return [
      getSuggestion("make_tiny_action_smaller"),
      getSuggestion("change_trigger"),
    ];
  }

  if (actionTooHard) {
    return [getSuggestion("make_tiny_action_smaller")];
  }

  if (triggerBroken) {
    return [getSuggestion("change_trigger")];
  }

  if (progress.consistencyRate < 0.5 || progress.skipCount >= 3) {
    return [getSuggestion("reduce_friction")];
  }

  if (Boolean(latestReview.was_hard?.trim())) {
    return [getSuggestion("plan_for_obstacle")];
  }

  return [getSuggestion("keep_going")];
}
```

The function is renamed to `getHabitAdjustmentSuggestions` (plural). The array always has at least one element — the `keep_going` fallback ensures this. There's no need for callers to handle empty arrays.

**Step 4: drop any combined-type case in `editGuidance.ts`.** Read the file; if it has a `case "fix_trigger_and_tiny_action":` branch, remove it. The TS compile will flag the dropped key as a type error in any switch statement after step 1; let the compiler guide you.

**Step 5: update HabitDetailScreen to map over the array.**

The current block:

```tsx
const adjustmentSuggestion = latestReview
  ? getHabitAdjustmentSuggestion({
      habit,
      latestReview,
      progress,
    })
  : null;

// ... later in the JSX:
{adjustmentSuggestion ? (
  <View style={styles.suggestionCard}>
    {/* ... single suggestion render ... */}
  </View>
) : null}
```

Becomes:

```tsx
const adjustmentSuggestions = latestReview
  ? getHabitAdjustmentSuggestions({
      habit,
      latestReview,
      progress,
    })
  : [];

// ... later in the JSX:
{adjustmentSuggestions.map((suggestion, index) => (
  <View key={suggestion.type} style={styles.suggestionCard}>
    {index === 0 ? (
      <Text selectable style={styles.suggestionEyebrow}>
        Suggested adjustment{adjustmentSuggestions.length > 1 ? "s" : ""}
      </Text>
    ) : null}
    <Text selectable style={styles.suggestionTitle}>
      {suggestion.title}
    </Text>
    <Text selectable style={styles.suggestionBody}>
      {suggestion.body}
    </Text>
    <Text selectable style={styles.suggestionReasonLabel}>
      Why this suggestion
    </Text>
    <Text selectable style={styles.suggestionReason}>
      {suggestion.reason}
    </Text>
    <SecondaryButton
      label="Review suggestion"
      onPress={() =>
        router.push({
          pathname: "/(app)/habits/[habitId]/edit",
          params: {
            habitId: habit.id,
            suggestionType: suggestion.type,
          },
        })
      }
    />
  </View>
))}
```

Notes on the rendering:
- The eyebrow ("Suggested adjustment" or "Suggested adjustments") only renders on the first card. Repeating it on each card would feel redundant; pluralizing it on the first card communicates to the user that there are multiple. The pluralization is a small but real product touch — *Suggested adjustment* (singular) for one card, *Suggested adjustments* (plural) for two.
- Each card has its own "Review suggestion" CTA passing its own `suggestionType` param. The user picks which one to act on first; she doesn't have to commit to both. This is the disagreeable-friend principle in action: we name the two issues honestly, then let her decide.
- The `key={suggestion.type}` works because each suggestion type is unique within the array. If we ever return two `make_tiny_action_smaller` cards (we won't, but defensively), this would break — fine for now.

**Step 6: update tests that reference the dropped type.**

Run `npm test` after step 1 — any test importing `fix_trigger_and_tiny_action` as a string literal or referencing `HABIT_ADJUSTMENT_SUGGESTIONS["fix_trigger_and_tiny_action"]` will fail at compile or runtime. Update them to reference the new return shape (now an array) or drop the case entirely if it tested the combined behavior specifically.

### Required tests

**`src/features/recommendations/__tests__/habitAdjustmentEngine.test.ts`** — comprehensive coverage of the new array return:

```ts
import { getHabitAdjustmentSuggestions } from "@/features/recommendations/habitAdjustmentEngine";

import type { HabitAdjustmentInput } from "@/features/recommendations/types";

function makeInput(overrides: {
  trigger_worked?: boolean | null;
  tiny_action_too_hard?: boolean | null;
  was_hard?: string | null;
  consistencyRate?: number;
  skipCount?: number;
}): HabitAdjustmentInput {
  return {
    habit: {
      id: "habit-1",
      title: "Run",
      identity_phrase: "a runner",
      cue: "morning coffee",
      tiny_action: "run for 2 minutes",
      minimum_viable_action: null,
      preferred_time_window: null,
      habit_state: "focus",
      status: "active",
      start_date: "2026-04-01",
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-01T00:00:00.000Z",
      archived_at: null,
      automated_at: null,
      backlog_at: null,
      user_id: "user-1",
    },
    latestReview: {
      id: "review-1",
      user_id: "user-1",
      habit_id: "habit-1",
      week_start: "2026-04-26",
      went_well: null,
      was_hard: overrides.was_hard ?? null,
      trigger_worked: overrides.trigger_worked ?? true,
      tiny_action_too_hard: overrides.tiny_action_too_hard ?? false,
      adjustment_note: null,
      created_at: "2026-04-30T00:00:00.000Z",
      updated_at: "2026-04-30T00:00:00.000Z",
    },
    progress: {
      consistencyRate: overrides.consistencyRate ?? 0.85,
      skipCount: overrides.skipCount ?? 0,
      streak: 12,
    },
  };
}

describe("getHabitAdjustmentSuggestions", () => {
  it("returns [make_tiny_action_smaller, change_trigger] when both flags fire (action first per D9)", () => {
    const result = getHabitAdjustmentSuggestions(
      makeInput({ trigger_worked: false, tiny_action_too_hard: true }),
    );
    expect(result.map((s) => s.type)).toEqual([
      "make_tiny_action_smaller",
      "change_trigger",
    ]);
  });

  it("returns [make_tiny_action_smaller] when only the action flag fires", () => {
    const result = getHabitAdjustmentSuggestions(
      makeInput({ trigger_worked: true, tiny_action_too_hard: true }),
    );
    expect(result.map((s) => s.type)).toEqual(["make_tiny_action_smaller"]);
  });

  it("returns [change_trigger] when only the trigger flag fires", () => {
    const result = getHabitAdjustmentSuggestions(
      makeInput({ trigger_worked: false, tiny_action_too_hard: false }),
    );
    expect(result.map((s) => s.type)).toEqual(["change_trigger"]);
  });

  it("returns [reduce_friction] when consistency is low and no flag is set", () => {
    const result = getHabitAdjustmentSuggestions(
      makeInput({ consistencyRate: 0.3 }),
    );
    expect(result.map((s) => s.type)).toEqual(["reduce_friction"]);
  });

  it("returns [reduce_friction] when skipCount is high and no flag is set", () => {
    const result = getHabitAdjustmentSuggestions(makeInput({ skipCount: 5 }));
    expect(result.map((s) => s.type)).toEqual(["reduce_friction"]);
  });

  it("returns [plan_for_obstacle] when was_hard is set and other conditions don't fire", () => {
    const result = getHabitAdjustmentSuggestions(
      makeInput({ was_hard: "I had to travel for work this week." }),
    );
    expect(result.map((s) => s.type)).toEqual(["plan_for_obstacle"]);
  });

  it("returns [keep_going] as the default fallback", () => {
    const result = getHabitAdjustmentSuggestions(makeInput({}));
    expect(result.map((s) => s.type)).toEqual(["keep_going"]);
  });

  it("never returns more than 2 suggestions", () => {
    // The dual case is the maximum; verify a few cases stay at 1.
    expect(getHabitAdjustmentSuggestions(makeInput({})).length).toBeLessThanOrEqual(2);
    expect(
      getHabitAdjustmentSuggestions(
        makeInput({ trigger_worked: false, tiny_action_too_hard: true }),
      ).length,
    ).toBeLessThanOrEqual(2);
  });

  it("never returns an empty array (keep_going fallback ensures this)", () => {
    expect(getHabitAdjustmentSuggestions(makeInput({})).length).toBeGreaterThan(0);
  });

  it("does not return the dropped fix_trigger_and_tiny_action type", () => {
    const result = getHabitAdjustmentSuggestions(
      makeInput({ trigger_worked: false, tiny_action_too_hard: true }),
    );
    expect(result.some((s) => s.type === ("fix_trigger_and_tiny_action" as unknown))).toBe(false);
  });
});
```

Ten cases. They cover: each priority branch, the dual-firing case (the bug fix), the array invariants (max 2, never empty), and the explicit confirmation that the dropped type is gone.

For the screen test, extend `HabitDetailScreen.test.tsx` (or a new `.suggestions.test.tsx`) with two cases:

```tsx
it("renders two suggestion cards when the engine returns two suggestions", () => {
  // Mock useHabitDetail to return latestReview with both flags hot.
  // Mock the screen to render. Assert two suggestion cards are rendered.
  // Use a stable identifier — e.g., the body text — to count cards.
  // Expect two "Review suggestion" buttons.
});

it("pluralizes the eyebrow when there are two suggestions", () => {
  // Same setup as above. Assert "Suggested adjustments" is rendered (plural).
});
```

The exact mock setup mirrors the existing HabitDetailScreen test pattern — copy-paste-adjust.

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes — ten new engine tests, two new screen tests, plus all updates to existing tests that referenced the dropped type. Total post-S8-06: ~445 tests.
- The dropped `fix_trigger_and_tiny_action` type appears in zero remaining files (verify with a global search).
- Manual smoke (this ticket has minimal user-facing change because of the inertness note above):
  1. Open Habit Detail for any habit. The screen renders normally — Setup, heatmap, Today, Progress, Recent history, Weekly review (empty state). **No suggestion card appears** because `latestReview` is null. This is the same behavior as before S8-06.
  2. The screen tests above (with mocked `latestReview`) confirm the dual-card path works under controlled conditions.
- No regressions: Edit Habit still works when navigated to with `suggestionType=make_tiny_action_smaller` or `suggestionType=change_trigger` (these existed pre-S8-06). EditHabit's existing handling of `suggestionType=fix_trigger_and_tiny_action` is dead code by definition (no caller can pass it now); if EditHabit had a switch case for it, removing the case is part of step 4.

### References

- `docs/PROJECT_BRAIN.md` §8 (Bug #2 entry).
- `docs/tech-handoff-core-v1.md` §8.6.
- `docs/sprint_tickets/sprint-7-followups.md` F3 (the inertness context — same root cause: dropped weekly_reviews query).

### Out of scope

- Migrating reviews to local SQLite (the underlying cause of the inertness). That's post-Core-v1 work.
- Adding more than 2 suggestion types — the cap stays at 2 per (D9).
- A "Review all suggestions" CTA at the bottom of the suggestion section — each card has its own CTA; aggregating would force a UX choice ("which one to apply first?") that contradicts the per-card design.
- Refactoring the suggestion card rendering into a separate `<SuggestionCard>` component — keep inline for now; if multiple screens consume it later, extract.
- AI-driven suggestions (`aiRewrite` flag stays `false`).

---

## DEV-S8-07 — Manual smoke, PROJECT_BRAIN update, S8 followups doc

**Estimate:** 0.25 day
**Depends on:** DEV-S8-06 merged into `sprint-8`.
**Branch suggestion:** `s8/smoke-and-docs`

### Context

Closes the sprint. End-to-end smoke checklist on a real simulator or device, PROJECT_BRAIN §11 update reflecting S8 closure, and `sprint-8-followups.md` for the deferred items surfaced during S8.

### Files to modify

- `docs/PROJECT_BRAIN.md` — update §11 with S8 closure note.

### Files to create

- `docs/sprint_tickets/sprint-8-followups.md`

### Manual smoke checklist

Run on a real simulator or device. Mark each item ✅ before merging `sprint-8` into `main`.

1. **Cold start, full mode, fresh sign-in.** Sign up a brand-new test account. Expected: trial entitlement is fetched (verify via dev console / logger that `fetchTrialEntitlement` was called); the cache is written to AsyncStorage; `accessMode === "full"`; no read-only banner anywhere; Settings shows "Trial" sub-line under Account.
2. **Cold start, full mode, returning user.** Force-quit the app and relaunch. Expected: cache is read from AsyncStorage; `lastValidatedAt` is <60min old, so no fetch fires (verify via dev console); `accessMode === "full"`; everything works normally.
3. **Cold start, stale cache (>60min).** Manually set the cache's `last_validated_at` to ~70 minutes ago in AsyncStorage. Relaunch. Expected: cache is shown immediately, then a fetch fires in the background; cache is updated with the new timestamp; `accessMode` stays `"full"` throughout.
4. **App foreground after 70 minutes idle.** Open the app, wait through bootstrap, background it. Wait 70+ minutes (or fast-forward via dev tooling). Foreground the app. Expected: `AppState` listener fires, staleness check triggers a fetch, cache updates.
5. **Read-only mode, simulated grace exhaustion.** Manually set `last_validated_at` to ~8 days ago. Relaunch. Expected: read-only banner appears at the top of Today; Done/Skip buttons are visibly disabled (greyed); navigate to a Focus habit's Detail screen, banner appears; tap a heatmap cell within the 48h window, selector opens **in read-only mode** (Close-only, no Done/Skip — verify the cell tap doesn't error); Archive button disabled; Edit Habit button disabled; navigate to Edit Habit (button disabled — find another path or skip if no path exists in current beta surface), banner appears, Save disabled.
6. **Reconnect path, online.** From the read-only state in case 5, ensure the device has network. Tap the "Reconnect" button on the banner. Expected: button label becomes "Reconnecting…", brief delay, validation succeeds, cache updates, banner disappears, all the previously-disabled buttons re-enable.
7. **Reconnect path, offline.** From the read-only state, kill the device's network. Tap "Reconnect". Expected: button shows "Reconnecting…" briefly, then returns to "Reconnect"; the banner stays; all buttons stay disabled. Restore network; tap Reconnect; banner clears.
8. **Sign-out clears cache.** From any state, open Settings, tap Sign Out. Expected: app routes to the Welcome / Sign-in screen; AsyncStorage's `habits.trial.entitlement` key is gone (verify via dev tooling). Sign back in with the same account; cache is rebuilt.
9. **User switch.** Sign out, sign back in with a different test account. Expected: previous user's cache is cleared; new user's entitlement is fetched and cached; trial status sub-line in Settings reflects the new user's status.
10. **Onboarding is not gated.** Force read-only mode (set cache to >7 days). Open the app as a new user (sign up fresh). Expected: onboarding flows normally without any banner; after completing onboarding, the user lands on Today and **then** the banner appears on Today (because the new user's first sign-in validation should have succeeded, so this case is hard to truly hit — note this in the followups if it's not testable in the smoke).
11. **Recovery modal still works in read-only.** Force read-only mode. Hand-craft a streak break (two consecutive missed days) on a test account. Relaunch. Expected: recovery modal appears at the top of the app; modal actions (Restart, Make smaller, Pause for now, Just close) all work — even though Today is read-only beneath. Pause for now archives the habit successfully.
12. **Settings refresh.** Open Settings in any mode. Expected: Account card with email + status sub-line; Foundation status card is **gone**; Archived habits section uses the refreshed copy ("Your archived habits", "Pause and resume habits without losing their history.", "No archived habits"); About card with App version (matches `app.json`'s version), Privacy policy → "Coming soon", Terms of service → "Coming soon"; Sign Out at the bottom.
13. **Bug #2 inertness confirmed.** Open Habit Detail for a real habit. Expected: **no suggestion card** appears (latestReview is null in production). The dual-card behavior is verified by the engine and screen tests, not the manual smoke. Note this in the followups — it's verified-via-test-only and a real test of the dual-card UX will require reviews migration.
14. **No regressions.** Visit Today, Library tab placeholder, Habit Detail, Edit Habit (via the existing entry point), Reviews, Onboarding (via fresh sign-up), Recovery modal, single-miss reframing banner, sign-in/sign-up, sign-out. Everything behaves as it did at close of S7, with the additions of the read-only banner, disabled-button states, refreshed Settings, and trial validation lifecycle.

### Beta watch-items (post-merge, not check-at-merge)

These don't gate the `sprint-8 → main` merge. They're observations to actively listen for once the build reaches testers, captured here so we don't forget what to watch for.

- **The read-only banner appearing unexpectedly.** If a tester reports the banner appearing when they were online and signed in normally, it suggests either (a) an `AppState` listener firing too aggressively, (b) a race between auth bootstrap and trial bootstrap, or (c) a 7-day grace miscalculation. Capture the verbatim wording, the device timezone, and the approximate time-since-last-sign-in. Tag in beta feedback as `s8-banner-false-positive`.
- **The "Trial" sub-line feeling out-of-place.** Per (D6) we shipped status word only, no countdown. If testers ask "how many days do I have?" — that's signal to revisit the decision when monetization ships, not now. Note frequency.
- **Reconnect button feeling like a punishment.** The copy "Reconnect to keep logging" is calm and informational, but if testers describe the experience as anxiety-producing — that's signal that the brand voice needs a copy review on this surface. Per (D5) we made it deliberately quiet; if it isn't quiet enough, revisit.

### PROJECT_BRAIN update

Update `docs/PROJECT_BRAIN.md` §11 with a closure note covering:

- S8 moved from "Up next" to "Done."
- S7 followup F2 closed (EditHabitScreen recovery focus unit test).
- New: `src/features/trial/` module — `api.ts`, `storage.ts`, `grace.ts`, `hooks.ts`, `types.ts`, with unit tests.
- New: `TrialValidationBootstrap` provider added to the tree, sits inside `AuthBootstrap`. Exposes `useTrialValidation()` returning `accessMode`, `entitlementStatus`, `lastValidatedAt`, `isValidating`, `refresh()`.
- New: `ReadOnlyBanner` shared component. Consumed on Today, Habit Detail, Create Habit, Edit Habit. Settings, Onboarding, and Recovery modal are deliberately not gated.
- The `accessMode` is derived purely from offline-grace exhaustion (>7 days since `last_validated_at`), NOT from `entitlement_status`. Per requirements §16.4, post-trial behavior in Core v1 grants full access.
- Settings refreshed: dropped Foundation status card; added quiet trial status sub-line under Account (status word only, no countdown); refreshed copy on archived habits section ("Your archived habits"); added About card with App version + Privacy/Terms placeholders.
- Bug #2 fixed at the engine and display layers. The combined `fix_trigger_and_tiny_action` type is removed; engine now returns `HabitAdjustmentSuggestion[]` (max 2, action-fix first per D9). Display maps over array. **Currently inert in production** because the dropped Supabase `weekly_reviews` query in `useHabitDetail` keeps `latestReview` as null. Will activate when reviews migrates to local SQLite (post-Core-v1).
- "Up next" line points at S9 (visual design implementation), gated on the product-lead design direction document being locked before sprint start.
- Note: the dead `latestReviewQueries` block in `useTodayHabits` STILL stays untouched per S5 followup F5 — same reasoning as before.

Add the new ~test-count line: 415 → ~445 (verify exact number after running suite on the integration branch).

### sprint-8-followups.md

Create `docs/sprint_tickets/sprint-8-followups.md` with at minimum:

- **F1 — Bug #2 dual-card UX validation when reviews migrates (P2, deferred-trigger).** The engine + display fix landed in S8-06 but cannot be exercised by real users until the dropped Supabase `weekly_reviews` query is replaced with a local SQLite path. When that migration ships, run an end-to-end test: hand-craft a weekly review with both `trigger_worked: false` AND `tiny_action_too_hard: true` flags, navigate to Habit Detail, verify two suggestion cards render, action-fix first, with pluralized "Suggested adjustments" eyebrow. Note any UX issues (cards too wide, eyebrow pluralization unclear, "Review suggestion" CTA confusing across cards). Flagged as P2 because it's not a real bug today; the test is the watching-it-when-it-lands cue.
- **F2 — `AppState` listener tested via mock (P3).** The lifecycle hook in S8-03 has an `AppState.addEventListener('change', listener)` that's not directly tested; the manual `refresh()` test covers the same code path indirectly. If we ever suspect a foreground-driven validation bug in beta, add a Jest case that mocks `AppState.addEventListener` to capture the listener and invoke it manually with `'active'`. Small standalone test.
- **F3 — Onboarding behavior under read-only mode (P3, edge-case).** Per (D11), Onboarding is not gated. The smoke case 10 noted that this is hard to actually hit in practice (a fresh sign-up always validates). If beta surfaces a case where a user reaches Onboarding in read-only mode (e.g., signed up, app crashed mid-onboarding, came back days later with stale cache), we may need to either (a) explicitly guard the onboarding completion mutation to allow it through, or (b) trigger validation at onboarding's confirmation step. Defer until a real case appears.
- **F4 — Trial status sub-line copy review post-monetization (P3, deferred-trigger).** Per (D6), Settings shows the status word only. When monetization ships, revisit whether a countdown ("3 days left") earns its place because there's a real product action (paywall) attached. Note: this followup is for the *future* sprint that introduces monetization, not for a Core v1 sprint.
- **F5 — Banner animation polish (P3, beta-driven).** The read-only banner appears/disappears without animation. If beta feedback indicates the appearance feels jarring, add a simple opacity/translateY transition. Defer until signal.
- Anything surfaced during the manual smoke that isn't a blocker.

### Acceptance criteria

- All 14 manual smoke items checked ✅. Paste the checklist (or a brief confirmation per item) into the `sprint-8 → main` PR description.
- `docs/PROJECT_BRAIN.md` §11 reflects S8 closure with the trial-validation, settings-refresh, and Bug-#2 notes above.
- `docs/sprint_tickets/sprint-8-followups.md` exists with at least F1 through F5.

### References

- The six S8 tickets above.
- `sprint-7-tickets.md` DEV-S7-04 (smoke-checklist pattern reference, if it exists; otherwise S6's smoke-checklist pattern).
- `sprint-7-followups.md` (the followups format pattern).

### Out of scope

- Anything that's a real bug found during smoke — those get fixed before merge, not pushed to followups.
- Architectural changes to docs other than PROJECT_BRAIN §11.
- A first-pass at the S9 visual design direction document — that's product-lead work that runs in parallel during S8 close, but it's not a deliverable of this ticket.

---

## Definition of S8 done

S8 is complete when **all seven tickets** are merged into the `sprint-8` branch AND:

1. `npx tsc --noEmit` is clean on the integration branch.
2. `npm test` passes on the integration branch (all new + existing suites; expect ~445 tests).
3. The 14-item manual smoke checklist in DEV-S8-07 has been run end-to-end on a simulator or device. All items ✅.
4. The trial validation lifecycle works end-to-end: a user can sign in, see her trial status in Settings as a quiet sub-line, navigate the app normally; if her cache goes stale (>60min), validation fires silently; if she goes offline for 7+ days, the read-only banner appears; tapping Reconnect re-validates and clears the banner when online.
5. Read-only mode is consistently applied across Today, Habit Detail, Create Habit, and Edit Habit. Settings, Onboarding, and Recovery modal are not gated. Sign-out always works.
6. Settings shows the new layout: Account card with email + trial status sub-line; archived habits with refreshed copy; About card with version + Privacy/Terms placeholders; Sign Out at the bottom. The Foundation status card is gone.
7. Bug #2 is fixed at the engine and display layers. Tests pass; the dropped `fix_trigger_and_tiny_action` type appears in zero remaining files. The fix is currently inert in production (no `latestReview` data) — that's expected and noted in PROJECT_BRAIN.
8. No regressions: Today, Habit Detail, Edit Habit, Create Habit, Reviews, Library tab placeholder, Onboarding, Recovery flow, single-miss reframing banner, sign-in/sign-up — all behave as they did at close of S7, with the additions of the read-only banner and trial validation lifecycle.
9. `docs/PROJECT_BRAIN.md` §11 reflects S8 closure.
10. `docs/sprint_tickets/sprint-8-followups.md` exists.

After S8 closes, the next gating event is the product-lead design direction document being locked. Once locked, S9 begins: visual design implementation across the week-1 surfaces (per `sprint-plan.md` §5, S9 deliverables). Until the design direction is locked, S9 cannot start — engineering capacity is not the bottleneck; design decisions are.

The `sprint-8` → `main` PR closes the sprint.

---

*End of S8 ticket package.*
