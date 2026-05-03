# Habits App — Project Brain

> Single source of truth for anyone picking up this project.
> Last updated: May 3, 2026 (post-S9c — Goal-based architecture locked; Focus/Supporting dissolved; Today screen redesign locked; S10 tickets written)

---

## 1. What this app is

A calm, evidence-informed habit formation product. Full strategy in `product-strategy.md`. In short:

It is **not** a tracker, productivity app, or AI coach. It is a guide that helps users translate who they want to become into a small action they can repeat tomorrow morning, then supports them as they build automaticity — one habit deeply, then another, forever.

**Core architecture:** local-first. Habit data lives on the user's device in SQLite. Supabase handles only authentication, account identity, and trial entitlement. See `tech-handoff-core-v1.md` Section 1.

**Core v1 release plan:**
- **Stage 1 — Private Beta (2–3 weeks):** focused subset for invited testers
- **Stage 2 — Full Core v1 (5–8 weeks total):** complete non-AI release

**Target users:** adult, self-improvement-aware, has tried habit apps before and abandoned them, dislikes gamification, wants calm progress. See `product-strategy.md` Section 3.

**Three core principles** (full list of 12 in strategy):
- Becoming over tracking
- Forgiving momentum (no fragile streaks)
- Private by default (local-first)

---

## 2. Tech stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | React Native | 0.81.5 | |
| Platform | Expo | SDK 54 | |
| Routing | Expo Router (file-based) | v6 | |
| Language | TypeScript | 5.9 | |
| Server | Supabase (Auth + minimal storage) | 2.104.0 | **Auth, profile, trial entitlement only — no habit data** |
| Local DB | SQLite via expo-sqlite | ~16.0.10 | **Source of truth for habit data (Core v1, installed S0)** |
| Server state | TanStack React Query | v5 | Server queries only (auth, entitlement) |
| Local storage | AsyncStorage | 2.2.0 | Cached entitlement, onboarding resume, prefs |
| Notifications | expo-notifications | ~0.32.17 | **Local notifications only — no push tokens (Core v1, installed S0)** |
| Testing | Jest + React Native Testing Library | Jest 29.7 | |
| AI provider | Kimi (deferred) | — | Edge function exists but disabled (`aiRewrite=false`) |

Bold rows reflect Core v1 changes from the original tech stack.

---

## 3. Project structure

Existing feature-based module pattern preserved. New modules added for Core v1 (marked NEW).

```
D:\habits_offline\
├── app/                          # Expo Router file-based routes
├── src/
│   ├── components/               # Shared UI
│   ├── config/featureFlags.ts    # Feature toggles
│   ├── features/
│   │   ├── auth/                 # Existing
│   │   ├── entry/                # Existing
│   │   ├── habits/               # Existing — major rewrite for SQLite
│   │   ├── today/                # Existing — redesigning
│   │   ├── reviews/              # Existing — moves to local DB
│   │   ├── recommendations/      # Existing — AI gated off
│   │   ├── habit-context/        # STUB — returns null (no Core v1 work)
│   │   ├── sync/                 # FOUNDATION — stays dormant in Core v1
│   │   ├── settings/             # Existing — expanding
│   │   ├── trial/                # NEW — entitlement validation + offline grace (S8)
│   │   ├── onboarding/           # NEW — becoming bridge
│   │   ├── library/              # NEW — Automatic Library
│   │   ├── graduation/           # NEW — SRHI ceremony
│   │   ├── recovery/             # NEW — post-streak-break flow
│   │   ├── reminders/            # NEW — local notifications
│   │   ├── account/              # NEW — deletion, export
│   │   └── backlog/              # NEW — backlog management
│   ├── lib/
│   │   ├── db/                   # NEW — SQLite client, repositories, migrations
│   │   ├── storage/              # AsyncStorage keys
│   │   └── supabase.ts           # Supabase client
│   ├── providers/
│   ├── services/
│   ├── tests/
│   ├── theme/
│   └── utils/
├── supabase/
│   ├── config.toml
│   ├── migrations/               # Drop habits/logs/reviews; add profiles + trial_entitlements
│   └── functions/
│       └── generate-habit-rewrite/  # AI edge function — exists, gated off
├── docs/
│   ├── product-strategy.md       # NEW — the why
│   ├── core-v1-requirements.md   # NEW — the what
│   ├── tech-handoff-core-v1.md   # NEW — the how
│   ├── PROJECT_BRAIN.md          # This document
│   ├── product-brief-v2.md       # SUPERSEDED — archive when convenient
│   ├── habits-app-prd-monetization.docx  # Reference for post-Core-v1 monetization
│   └── habits-app-user-flow.html # Stale — regenerate post-Core-v1
└── package.json
```

---

## 4. Current feature inventory

### Already working — stays for Core v1, may need updates

| Feature | Key files | Status / Changes |
|---------|-----------|------------------|
| Authentication | `features/auth/` | Stays. No changes for Core v1. |
| Smart entry routing | `features/entry/RootEntryScreen.tsx` | Stays. May extend for onboarding-incomplete state. |
| Welcome screen | `features/entry/WelcomeScreen.tsx` | Stays. |
| Habit creation | `features/habits/screens/CreateHabitScreen.tsx` | First-time path replaced by onboarding. Post-onboarding form: add worst-day gate, 3-active cap enforcement, time picker (Bug #3). |
| Habit editing | `features/habits/screens/EditHabitScreen.tsx` | Stays. AI rewrite section stays gated off. |
| Habit detail | `features/habits/screens/HabitDetailScreen.tsx` | Add 90-day heatmap, identity-flavored streak, consistency display. |
| Today screen | `features/today/screens/TodayScreen.tsx` | Redesign for Focus emphasis + heatmap + identity-flavored streak. |
| Daily logging | `features/habits/api.ts` (`upsertHabitLog`) | **Rewrite to SQLite. Add 48-hour retro window enforcement locally.** |
| Progress tracking | `features/today/progress.ts` | **Rewrite streak rule from strict to forgiving (with skipped-day edge case).** |
| Weekly reviews | `features/reviews/` | Move to local SQLite. Question structure preserved. |
| Rule-based suggestions | `features/recommendations/habitAdjustmentEngine.ts` | Stays. Sweep copy for identity-flavored language. Bug #2 fix. |
| Edit guidance | `features/recommendations/editGuidance.ts` | Stays. Copy review for voice. |
| Validation & normalization | `features/habits/validators.ts` | Update for new fields (minimum_viable_action). Enforce 3-active cap. |
| Preferred time | `features/habits/preferredTimeWindows.ts` | Replace text input with time picker (Bug #3). |
| Design system | `src/theme/` | Add tokens for heatmap, recovery modal, library card. |
| Shared components | `src/components/` | Keep existing. Add new components (Section 14). |
| Unit tests | `src/tests/unit/` | `progress.test.ts` needs full rewrite for forgiving streak rule. |

### New for Core v1

| Feature module | Responsibility |
|---|---|
| `features/onboarding/` | The 6-screen becoming-bridge flow |
| `features/library/` | Automatic Library tab and detail |
| `features/graduation/` | SRHI ceremony, eligibility, habit state transition |
| `features/recovery/` | Post-streak-break modal and actions |
| `features/reminders/` | Local notifications via expo-notifications |
| `features/account/` | Account deletion (server + local wipe), data export (local JSON) |
| `features/backlog/` | Backlog management UI in Settings |
| `lib/db/` | SQLite client, schema, migrations, repositories |

### AI features — gated off, deferred

| Feature | Key files | Gate |
|---------|-----------|------|
| AI habit rewrite | `features/recommendations/aiRewriteApi.ts` | `FEATURE_FLAGS.aiRewrite === false` |
| AI rewrite hook | `features/recommendations/hooks.ts` | Rejects when flag off |
| AI rewrite UI | `EditHabitScreen.tsx` | Renders null when flag off |
| Edge function | `supabase/functions/generate-habit-rewrite/index.ts` | Unreachable from client when flag off |

For Core v1: no changes. Flag stays off. Revisit post-Core-v1 only if AI clearly improves habit design or reflection.

### Stubs / dormant

| Feature | Status | Notes |
|---------|--------|-------|
| Habit context | Returns `null` | Not in Core v1 scope. Stays as stub. |
| Sync processor | No-op | **Stays dormant for Core v1** — we are local-only. May activate when cloud backup ships. |
| `localAiCoach` flag | `false`, unreferenced | Future feature. |

---

## 5. Feature flags

Location: `src/config/featureFlags.ts`

```typescript
export const FEATURE_FLAGS = {
  aiRewrite: false,        // AI off — deferred
  localAiCoach: false,     // Future feature
  remindersEnabled: true,  // Core v1 — turns on in Sprint 6
  analyticsEnabled: true,  // Core v1 — anonymous events only
} as const;
```

The previous `softFrictionOverride` flag is **not added** — soft-friction paid override is deferred until monetization is implemented.

---

## 6. Database schema

**Core v1 architecture: server + local split.** Habit data lives locally in SQLite. Server stores only account and entitlement.

### 6.1 Server (Supabase)

**`profiles`**
- `id` (FK auth.users), `email`, `account_status` (active/pending_deletion/deleted), `created_at`, `updated_at`

**`trial_entitlements`**
- `user_id` (FK auth.users, PK), `trial_started_at`, `trial_ends_at`, `entitlement_status` (trial/active/expired/paid/cancelled), `last_validated_at`, `created_at`, `updated_at`

**Dropped from server in Core v1 transition:**
```sql
DROP TABLE IF EXISTS weekly_reviews;
DROP TABLE IF EXISTS habit_logs;
DROP TABLE IF EXISTS habits;
```
No real user data exists yet to preserve. Clean slate.

### 6.2 Local (SQLite via expo-sqlite)

**`local_habits`**
- `id` (TEXT PK), `user_id`, `title`, `identity_phrase`, `cue`, `tiny_action`, `minimum_viable_action`, `preferred_time_window`
- `habit_state`: active | automatic
- `status`: active | archived | backlog
- `icon`: Lucide icon component name (e.g., "BookOpen")
- `start_date`, `created_at`, `updated_at`, `archived_at`, `automated_at`, `backlog_at`

**Note (May 3 2026):** `habit_state` values `focus` and `supporting` were dissolved. Migration 004 converts all existing rows to `active`. All habits under a goal (identity phrase) are now equal peers. See design-direction.md §Goal-based architecture.

**`local_habit_logs`**
- `id`, `habit_id` (FK), `user_id`, `log_date` (YYYY-MM-DD), `status` (done/skipped/missed), `note`, `created_at`, `updated_at`
- Unique: (user_id, habit_id, log_date)

**`local_srhi_responses`**
- `id`, `habit_id` (FK), `user_id`, `q1_score`, `q2_score`, `q3_score`, `average_score`, `graduated`, `responded_at`

**`local_weekly_reviews`**
- `id`, `user_id`, `habit_id` (FK), `week_start` (YYYY-MM-DD), `went_well`, `was_hard`, `trigger_worked`, `tiny_action_too_hard`, `adjustment_note`, `created_at`, `updated_at`
- Unique: (user_id, habit_id, week_start)

**`local_reminder_settings`**
- `habit_id` (PK, FK), `reminder_type` (none/backup/daily), `reminder_time` (HH:mm), `enabled`, `snoozed_until`, `disabled_for_date`, `notification_id`, `updated_at`

**`local_user_preferences`**
- `key` (PK), `value`, `updated_at`

Full DDL in `tech-handoff-core-v1.md` Section 4.

### 6.3 AsyncStorage cache

```typescript
{
  trial_entitlement: { status, trial_started_at, trial_ends_at, last_validated_at },
  onboarding_resume_step: number | null,
  feature_flags_overrides: { ... }  // dev only
}
```

---

## 7. Key business logic

### 7.1 Forgiving streak (Core v1 — REPLACES strict rule)

**Location:** `features/today/progress.ts` (rewriting)

Rules:
- Done day → streak increments
- Skipped day → neutral (does not increment, does not break)
- **Skipped days are removed from the sequence before evaluating consecutive misses** (requirements Section 8.3)
- Single Missed day with Done on both sides → streak survives
- Two consecutive Missed days (after skipped removal) → streak resets to 0

Display: generic randomized streak copy per goal (e.g., "12 days and counting" / "Showing up for 12 days" / "12 days strong" / "Day N — keep going" / "N days of building"). See design-direction.md §Today screen redesign for full variant set.

### 7.2 Consistency calculation (formula unchanged, now local)

**Formula:** `done / (done + missed)` over the last 30 days. Skipped days excluded from both numerator and denominator. Deliberate product design — see requirements Section 10.2.

### 7.3 48-hour retroactive logging window

**Local enforcement.** Logs and edits within 48 hours of `log_date` are accepted. Beyond 48 hours, the day is immutable. This is a product rule, not a security rule.

### 7.4 Soft 3-per-goal cap (Core v1 — revised May 3 2026)

Habits belong to a goal (the becoming/identity phrase). All habits under a goal are equal peers — no Focus/Supporting distinction. The system enforces a **soft cap of 3 active habits per goal**:
- On 4th habit attempt under the same identity_phrase, the user sees a gentle warning ("Research suggests more than 3 active habits under one goal can be difficult to sustain. Are you sure?")
- The user can proceed — it’s guidance, not a block

The previous hard cap (1 Focus + 2 Supporting) is dissolved. See design-direction.md §Goal-based architecture.

### 7.5 Worst-day gate

Hard block during onboarding (first habit). For habits added post-onboarding, the worst-day gate is guidance only — the user can proceed even if they answer "no." See requirements Section 3.5.

### 7.6 Graduation eligibility (NEW)

**Location (planned):** `features/graduation/eligibility.ts`

Eligibility opens when both:
- 60+ days tracked since habit creation, AND
- ≥75% consistency over the last 30 days

Checked locally on app open. Triggers SRHI ceremony screen (3 questions, 1–5 Likert, average ≥4.0 → graduate).

### 7.7 Recovery flow trigger (NEW)

When a habit's streak breaks (2 consecutive Missed days), the next app open shows the recovery modal. Three options: Restart as-is, Make it smaller, Pause for now (+ quiet "Just close").

### 7.8 Trial validation with 7-day grace (NEW)

Server validates entitlement at sign-in and periodically. Client caches `last_validated_at`. If offline, full access for 7 days; beyond that, read-only mode until reconnection.

### 7.9 Adjustment engine priority (updated S8)

```
1. trigger_worked=false AND tiny_action_too_hard=true → [make_tiny_action_smaller, change_trigger]
2. tiny_action_too_hard=true → [make_tiny_action_smaller]
3. trigger_worked=false → [change_trigger]
4. consistencyRate<0.5 OR skipCount>=3 → reduce friction
5. was_hard has content → plan for obstacle
6. (default) → keep going
```

Engine now returns `HabitAdjustmentSuggestion[]`. Rule 1 returns both suggestions in priority order (action-fix first per D9). `fix_trigger_and_tiny_action` type removed. Fix is inert until reviews migrates to local SQLite.

---

## 8. Known bugs

| # | Bug | Location | Status |
|---|-----|----------|--------|
| 1 | Reduce friction logic ↔ AI rewrite contradiction | `habitAdjustmentEngine.ts` + AI prompt | **Deferred** (AI off for Core v1) |
| 2 | Dual suggestion shows only one | Suggestion display logic | **Fixed in S8** (inert until reviews migrates to local SQLite) |
| 3 | Preferred time should be picker, not text | `CreateHabitScreen.tsx` | **In scope** for Core v1 Sprint 20 |
| 4 | AI rewrite prompt needs guidelines | `generate-habit-rewrite/index.ts` | **Deferred** (AI off for Core v1) |

---

## 9. Monetization (deferred)

**Status:** all monetization work is **deferred to post-Core-v1.**

Originally planned: 3-tier model (Free Trial / Paid Core $1.99 / AI Upgrade $14.99). See `habits-app-prd-monetization.docx` for the original plan — kept as reference for future work, not current scope.

**Core v1 changes:**
- AI Upgrade tier cut from launch. May be reconsidered post-v1.
- Soft-friction paid override on the 3-active cap is deferred. Cap is currently a hard limit for everyone.
- Beta is **free for invited testers**. No paywall, no tier gating.
- Trial entitlement is tracked server-side from sign-up day. Post-trial behavior in Core v1 grants full access (no gating activates until paid tiers ship).

The previous plan's monetization analytics events (paywall_shown, purchase_completed, etc.) are not instrumented in Core v1.

---

## 10. Documents

Source-of-truth docs live directly in `docs/`. Sprint planning and per-sprint dev ticket packages live in `docs/sprint_tickets/` — add new ticket files there going forward.

| Document | Format | Location | Status |
|----------|--------|----------|--------|
| Product Strategy | .md | `docs/product-strategy.md` | **Current — the why** |
| Core v1 Requirements | .md | `docs/core-v1-requirements.md` | **Current — the what** |
| Technical Handoff Core v1 | .md | `docs/tech-handoff-core-v1.md` | **Current — the how** |
| Design Direction | .md | `docs/design-direction.md` | **Current — the how it looks (visual language for Core v1, paired with `design/habitapp/habit-screens.jsx`)** |
| Icon Set | .md | `docs/icon-set.md` | **Current — curated Lucide icon set (60 icons, 8 categories, rendering rules)** |
| Project Brain | .md | `docs/PROJECT_BRAIN.md` | **Current — this document** |
| Sprint Plan | .md | `docs/sprint_tickets/sprint-plan.md` | **Current — the when (23-sprint roadmap, 5 phases; Phase C resequenced May 3 for revised pre-beta path; S10–S14 → ship to testers)** |
| Sprint Tickets | .md | `docs/sprint_tickets/sprint-N-tickets.md` | **Current — per-sprint dev ticket packages (S1–S8 closed; S9+ to come)** |
| Sprint Follow-ups | .md | `docs/sprint_tickets/sprint-N-followups.md` | **Current — per-sprint deferred items / cleanup notes** |
| PRD Monetization | .docx | `docs/habits-app-prd-monetization.docx` | Reference for post-Core-v1 monetization |
| User Flow | .html | `docs/habits-app-user-flow.html` | Stale — regenerate post-Core-v1 |

---

## 11. Where we are now

Live status of the Core v1 build. For the full 21-sprint plan, see `docs/sprint_tickets/sprint-plan.md`.

### Done

- **S0** — Supabase migration `0005_core_v1_local_first_pivot.sql` applied. Old habit tables dropped; `profiles` + `trial_entitlements` created with auto-provision trigger on signup. `expo-sqlite` and `expo-notifications` installed. `.npmrc` added with `legacy-peer-deps=true`.
- **S1** — Local DB rails complete. `src/lib/db/` foundation (`client.ts`, `migrations.ts`, `migrations/001_initial.ts`, `migrations/index.ts`). Three repositories shipped: `preferences.ts`, `habits.ts`, `habit_logs.ts`. Dev-only `devWipe.ts` utility. Jest test infrastructure with `better-sqlite3` adapter (`src/tests/setup/sqliteTestAdapter.ts`, `createTestDb.ts`, `globals.ts`). Repository unit tests for all three repos. `app/_layout.tsx` gates render until `initDb()` resolves.
- **DEV-S1-05** — Polish round merged. `updateHabit` undefined-guard fix, `listHabits` ORDER BY created_at DESC, `deleteHabit`/`deleteLog` return boolean, `archiveHabit` is idempotent, `CreateHabitInput` type tightened, dead ternary removed from test adapter.
- **S2** — Engine swap to SQLite. Six tickets merged (S2-01 through S2-06): types and contract migrated to point at the repo types and the local-DB rules; testable clock at `src/utils/clock.ts` with `setNowForTesting`/`resetClockForTesting`; forgiving streak rewritten in `features/today/progress.ts` including the §8.3 skipped-day removal rule (23 named test cases); `features/habits/api.ts` rewritten end-to-end against the SQLite repos with the 48-hour retroactive logging window enforced locally and a typed `RetroLogError` (25 integration tests); `assertCanCreateActiveHabit` cap helper in `features/habits/validators.ts`; screen and hook cascade fixes; six obsolete Supabase-mocked unit tests deleted; `habitContract.test.ts` rewritten as a smoke test for the new constants. **Phase A complete.**
- **DEV-S2-07** — Removed dead `upsertUserProfile` call. The S0 trigger handles `profiles` + `trial_entitlements` provisioning server-side; client no longer attempts a redundant (and broken) upsert against the dropped `user_profiles` table.
- **S3** — Onboarding flow (Phase B kickoff). Four tickets merged: state machine + SQLite persistence (`onboarding.draft` / `onboarding.completed_at` via preferences repo, 200ms debounce, flush-on-unmount); `app/(onboarding)/` route group with `OnboardingProvider`; three screens (Welcome, Becoming, Daily Action) with verbatim spec copy; keyword-aware daily-action placeholder; `RootEntryScreen` extended with onboarding routing + one-time backfill for existing accounts. `jest.config.js` extended to cover `src/features/**/__tests__/`. 309 tests passing.
- **S4** — Becoming bridge complete. `cueAction` dropped from `OnboardingDraft`; whitelist-load added to `loadOnboardingDraft`. Four new screens shipped (Shrink, Cue, Worst-day, Confirmation). `WorstDayCheck` shared component extracted for reuse in S13. `finalizeOnboarding` in `completion.ts` atomically writes the Focus habit row, marks onboarding complete, and clears the draft inside a single `withTransactionAsync` transaction. `useFinalizeOnboardingMutation` invalidates three query keys and routes to Today via `RootEntryScreen`. A brand-new user can now complete the full 7-screen flow and land on Today with their first Focus habit. 325 tests passing.
- **S5** — TodayScreen redesigned around the Focus habit card. New components: `Heatmap` (`src/components/Heatmap.tsx`, 30/90-day grid, display-only with optional `onCellPress` stub for S6), `IdentityStreakDisplay` (`src/components/IdentityStreakDisplay.tsx`), and `extractIdentityNoun` (`src/features/onboarding/identityNoun.ts`). First-day copy ("Your first day. Start small.") renders on Day 1 before any log; standard streak copy takes over after first Done/Skip. Library tab placeholder added; bottom nav is now Today | Library | Settings. `useHabitLogsForRange` hook and `listLogsForHabitInRange` repo function added in `features/today/hooks.ts` and `lib/db/repositories/habit_logs.ts` — both reusable for S6's 90-day heatmap on Habit Detail. 8-item Appium smoke checklist passed (April 30 2026). 43 new tests (42 feature tests + migration-count assertion corrected in close-out); 355 passing, all suites green.
- **S6** — Habit Detail redesigned and retro-log interaction complete. `HabitDetailScreen` updated: "Become [identity_phrase]" eyebrow header, `IdentityStreakDisplay` replacing raw streak number, 90-day `Heatmap` between Setup and Today (display-only in DEV-S6-01; `onCellPress` wired in DEV-S6-02), and consistency copy aligned with §10.2 ("N% over the last 30 days"). New: `RetroLogSelector` component (`src/features/habits/components/RetroLogSelector.tsx`) — Modal-based, editable/read-only modes keyed on the 48-hour window; `useUpsertHabitLogMutation` hook (`src/features/habits/hooks.ts`) — general-purpose retro log with three-key invalidation (heatmap, today aggregate, habit detail); `getRetroLogErrorMessage` dispatcher and four reason-specific functions added to `utils/userFacingErrors.ts`; `isWithinRetroWindow` exported from `features/habits/api.ts` for parent `canEdit` derivation. The 48-hour window is enforced by the existing `RetroLogError` from S2 — S6 surfaces it in the UI without re-implementing it. Test gap closures: F3 (TodayScreen load/save error paths) and F4 (heatmap refresh round-trip integration test) from S5 followups. `Heatmap.onCellPress` is now consumed on Habit Detail; Today stays display-only. 25 new tests; 380 passing, all suites green.

- **S7** — Recovery flow + single-miss reframing. S7-01 cleanup: F6 query key naming inconsistency resolved (all range-log keys now use hyphens uniformly); F7 double-fetch on Habit Detail eliminated (single `useHabitLogsForRange` call at screen level, `logs` passed as prop to `HabitDetailHeatmap`). Core feature: streak-break detection in `src/features/recovery/api.ts` — mirrors `progress.ts` day-synthesis pattern (walks newest-first, synthesizes missed for unlogged past days, today included only if logged), §8.3 skip-filter, miss-prefix detection keyed on `breakRunStartDate` (oldest miss in run, not newest — prevents re-triggering the modal every morning during a slump). Two precondition guards: no Done in history → not broken; single-miss banner requires missDate === yesterday. `RecoveryModal` (`src/components/RecoveryModal.tsx`) shows calm §11.1 copy with Restart as-is / Make it smaller / Pause for now / Just close. "Make it smaller" routes to EditHabitScreen with `?from=recovery`; on mount, EditHabitScreen focuses the `tiny_action` TextInput. "Pause for now" guarded by `recoveryActionLockRef` to prevent double-archive. `TextField` adds `forwardRef`. Single-miss banner renders inside FocusCard between streak display and logging buttons; dismissed via setPreference + query invalidation. 35 new tests (18 detection unit tests + 7 RecoveryModal component tests + 10 TodayScreen integration tests, including 6 action-handler tests covering each modal action's setPreference call, the `from=recovery` router.push, the archive-then-mark order on Pause for now, the lock guard against double-archive, and the banner × dismissal); 415 passing, all suites green (2 pre-existing flaky integration tests excluded).

- **S8** — Trial validation + basic Settings + Bug #2. Three independent deliverables. (1) Trial validation: new `src/features/trial/` module (types, grace-period math, AsyncStorage cache, Supabase fetch); `TrialValidationBootstrap` provider inserted between `AuthBootstrap` and children; `useTrialValidation()` hook exposes `accessMode` / `entitlementStatus` / `refresh()`; 7-day offline grace period, 60-minute foreground re-validation. `ReadOnlyBanner` component added (`src/components/ReadOnlyBanner.tsx`) — PrimaryButton reconnect CTA, calm non-dismissible styling with `colors.accent` border. Read-only applied to Today (Done/Skip greyed), HabitDetail (Archive/Edit/RetroLog disabled), Create/Edit Habit (Save disabled + helper text). `RetroLogSelector` extended with `readOnlyReason?: 'window' | 'app'` — window-beats-app tiebreak in HabitDetailScreen's `handleCellPress` so "Reconnect to log on this day." only shows when reconnecting would actually help. Recovery modal and onboarding not gated. (2) Settings refresh: Foundation status card removed; trial status sub-line under email (status word only, no countdown: Trial / Active / Trial ended / Paid / Cancelled); archived habits section copy refreshed (heading "Your archived habits", helper "Pause and resume habits without losing their history.", new empty state copy); About card with `expo-constants` app version and Privacy/Terms placeholder rows. (3) Bug #2: `getHabitAdjustmentSuggestions` (plural) now returns `HabitAdjustmentSuggestion[]`; when both `tiny_action_too_hard` and `trigger_worked === false`, returns `[make_tiny_action_smaller, change_trigger]` in priority order; `fix_trigger_and_tiny_action` type removed from types/copy/editGuidance/EditHabitScreen; `HabitDetailScreen` maps over array (one card per suggestion); fix is inert in production until reviews migrates to local SQLite. Also closes S7-F2: `EditHabitScreen` `?from=recovery` focus path now has Jest coverage. Key `accessMode` rule: derived from offline-grace exhaustion (`lastValidatedAt` age vs 7-day window) only — never from `entitlement_status` (trial expiry not gated in Core v1 per §16.4). 40 new tests across 6 new test files; 453 passing, all suites green (2 pre-existing flaky integration tests excluded). Note: `ReadOnlyBanner` uses `PrimaryButton` per ticket spec (Secondary would be calmer but deviates from spec without product sign-off).

- **S9** — Visual design implementation: The Mindful Canvas. Pure visual sprint — no behavior changes, no schema changes. Brand rebrand from terracotta (`#bb6c3f`) to sage (`#446655`). App renamed from "Habit Builder" to **Habitapp** (`app.json` `expo.name`; slug and bundle ID unchanged). Theme tokens overhauled: 20 colors (sage-based, `primaryGradientEnd`, `dangerSoft`/`dangerSubtle` added), 9 typography sizes, 7 spacing steps, 5 radii, 3 primary-tinted shadows. Full enumeration in `docs/design-direction.md`. Fonts loaded via `expo-font`: Plus Jakarta Sans (display, 700+800) + Manrope (body, 400–800); helper at `src/theme/fontFamilies.ts`; splash holds until both fonts + DB ready. New atoms: `TertiaryButton`, `ZenCard`, `Eyebrow`, `RowLV`, `MissBanner`, `NullableBooleanField` (19 tests). Existing atoms re-skinned: `PrimaryButton` (LinearGradient gradient pill), `SecondaryButton` (surfaceCard + SHADOW_LIFT), `TextField` (animated focus state 180ms), `ChoicePills` (gradient selected), `Heatmap` (inset boxShadow ring on today cell, 0.6 opacity for unlogged), `IdentityStreakDisplay` (Manrope italic), `RecoveryModal` (BlurView glassmorphism), `ReadOnlyBanner` (surface bg, radius.sm), `TabBar` (BlurView glassmorphism via tabBarBackground). Reskin coverage: Auth (2 screens), Onboarding (7 screens), Settings, Habit Detail, Create Habit, Edit Habit, Today (empty state). AI rewrite UI fully removed from EditHabitScreen JSX (flag definition and backing hook remain; no screen renders it). Deferred: Today (populated — OPEN: multi-habit layout), Weekly Review (OPEN: beta scope), Backlog UI, retro-log affordance, replace-or-backlog modal, ReadOnlyBanner refinement, logo asset, account deletion, data export, SRHI, Library, reminder setup. Dead code left intentionally: `latestReviewQueries` block in `useTodayHabits`, `weekly_reviews` query, Bug #2 inert engine fix. 19 new tests (new atoms); 472 passing (474 total; 2 pre-existing TodayScreen integration failures excluded).

### S9b — Onboarding copy & UX review (May 2, 2026)

Product-lead review of all onboarding screens with design system alignment. Copy decisions and new UX patterns documented below. HTML mockups saved externally for reference.

**Copy decisions (locked):**
- Welcome: "Small actions. Real habits." headline, "Takes less than a minute to start" with stopwatch icon
- Sign Up: "The person you want to be starts here." / "One habit at a time."
- Onboarding Intro: logo centered upper-third, "Let's build your first habit." / "We'll walk you through it — step by step."
- Becoming: context line "Habits stick when they connect to who you want to be." / "Who do you want to become?" / chip suggestions: a runner, someone who reads daily, a calmer person, a better partner, someone who saves consistently, a writer, a present parent
- Daily Action: "What action will you take to become who you want to be?" / "Write a concrete action — something small and repeatable you can track." / guidance card with good/bad examples per identity (reader: ✓ Read 10 min / ✗ Read more books; fitness: ✓ Exercise 15 min / ✗ Be healthier)
- Shrink: "Now make the action laughably small." / "The goal is showing up, not achieving. Start so small you can't say no." / before→after examples (Run 10 min → Put on shoes; Read 30 min → Read one page; Meditate 20 min → One breath)
- Cue: "Attach it to something you already do — no willpower needed." / "What will trigger it?" / "After I / I will" compound card / guidance with trigger/action labels
- Worst-Day: two-phase screen — Phase 1: "Personalize your habit" (name + emoji icon picker), Phase 2: "One last check." / "Most people start too big and quit. This check helps you set a habit you'll actually keep." / "Could you still do this on your worst day?" / "Imagine a low-energy day. Would this still feel doable?"
- Confirmation: "Your first habit is ready." / "Everything you need to start becoming who you want to be — one small action at a time." / full habit summary card / "Let's go" button

**New UX patterns:**
- Emoji icon picker: 12 curated emojis for habit identity (🏃📖🧘💰✍️💪🎸🥗💤🌱🎨❤️), stored with habit
- Habit naming: added to onboarding worst-day screen, name + icon personalize the habit before feasibility check
- Two-phase worst-day screen: personalize → lock → feasibility question (single screen, progressive reveal)
- Disabled→active button pattern: greyed (#d3d1c7) until valid input, then Signature Gradient
- "Your action" / "Your answer" / "Your tiny version" input labels with pencil icon in white elevated fields
- Breadcrumb progress bars (5 steps) with back button, no "Step N of N" text
- No dynamic identity linking in suggestions (abandoned — user free-text makes specific suggestions unreliable)
- "Log in" button: secondary pill (surface-container-highest bg), not text-only
- Avoided "daily" language in copy to prevent frequency pressure (Core v1 is daily-only but copy doesn't say so)

**Design system enforcement notes:**
- All bordered cards → tonal shifts (No-Line Rule)
- All flat buttons → Signature Gradient pills
- All boxed inputs → Invisible Input pattern (tonal bg, no borders)
- Header bars with borders → back-button circle + breadcrumb bars

### S9c — Today screen redesign + icon set (May 2, 2026)

Product-lead review of Today screen. Current screen rejected — flat, empty, no visual hierarchy, heatmap confusing, identity line buried.

**Today screen design decisions (locked):**
- Identity (goal) is the card anchor, not individual habits. Card headline = "Become someone who runs daily" (the transformation), habits are actionable rows nested inside
- Goal-level metrics shown on card: consistency % + streak count (sage, quiet)
- Per-habit metrics live on detail screen only (accessed via chevron)
- Habit rows: check circle + Lucide SVG icon + habit name + chevron. Tap circle = Done. Tap row = detail.
- Done state: filled gradient circle + strikethrough + reduced opacity. Pending state: empty circle with sage border + Done/Skip compact pill buttons
- No heatmap on Today card (moved to detail view)
- No Focus/Supporting eyebrow labels on Today — visual distinction via button weight only
- Supporting habit Done button is white with subtle shadow (vs Focus gradient + strong shadow)
- Screen header: logo (top-left) + date (top-right), "Today" headline (Plus Jakarta 800, 28px) + one muted subline

**Icon system decisions (locked):**
- Emoji picker from S9b **replaced** with Lucide SVG line icons
- Package: `lucide-react-native` (v1.14.0+, ISC license, tree-shakable)
- 60 curated icons across 8 categories. Full list in `docs/icon-set.md`
- Categories: Fitness & movement (10), Mind & wellness (8), Reading & learning (7), Food & drink (8), Creative (7), Home & routine (8), Social & connection (6), Nature & outdoors (6)
- Rendering: stroke color `colors.primary` (#446655), strokeWidth 1.8, size 20px in rows / 24px in picker
- Stored in `local_habits` as Lucide component name string (e.g., "BookOpen")
- Icon picker: 4-column grid grouped by category headers, selected state = `primarySoft` bg circle

**Logo orientation (locked):**
- 4-quadrant mark: 3 outlined rounded squares + 1 filled circle
- Filled circle position: **top-right** (not bottom-right)
- Stroke style matching tab bar icon weight

**Architecture implication flagged:**
- Current data model has no "goal" entity — habits are standalone with `habit_state`. Today screen groups habits under the Focus habit's `identityPhrase` visually. No schema change needed for Core v1 beta (1 goal only). Post-v1: consider a `goals` table if multi-goal support ships.

### Up next: S10 — Today screen redesign + goal architecture + beta build prep

S10 ticket package written at `docs/sprint_tickets/sprint-10-tickets.md`. 7 tickets:
- S10-01: Dissolve Focus/Supporting in type system (migration 004, contract, validators, 10 test files)
- S10-02: Recovery hooks — remove Focus-only filter, check all active habits
- S10-03: Today screen rebuild — GoalContainer + ConsistencyDonut + identity anchor
- S10-04: HabitRow component — tap circle=Done, long-press=Skip, tap row=detail
- S10-05: Post-completion state ("You showed up today.") + MissBanner wiring
- S10-06: Gate Weekly Review screen + fix integration test failures
- S10-07: Internal QA + beta build prep

Dev implementation plan reviewed. Key feedback:
- S10-02 recovery hooks have a hooks-in-loop problem — recommend bulk query approach (`listLogsForHabitsInRange`) instead of per-habit hook calls
- S10-03 must include randomized streak copy variants (5 variants, see design-direction.md)
- `useTodayHabits` cleanup (remove `latestReviewQueries` dead code) should happen in S10-03, not S10-06
- `TodayHabitCardData` type needs `icon` added, `isWeeklyReviewDue` and `latestReviewWeekStart` removed
- Empty state copy needs updating (“Focus habit” reference removed)
- `extractIdentityNoun` and `IdentityStreakDisplay` removed from TodayScreen (replaced by generic streak copy)
- Icon picker for Create/Edit Habit moved to S12 (habit creation sprint)

### Transitional state to be aware of

`src/features/reviews/api.ts` still queries the Supabase `weekly_reviews` table, which was dropped in S0. The error is silently swallowed inside `useTodayHabits` (caught but not surfaced in the hook's `error` field), so the app does not crash — but every Today render produces console noise. This is expected and was out of scope for S5. Note: the redesigned TodayScreen no longer reads `isWeeklyReviewDue`, so these queries now fire with no consumer — pure noise. When Reviews migrates to local SQLite, delete the `latestReviewQueries` block in `useTodayHabits` as part of that migration. No sprint assigned yet — likely lands in Phase C alongside whatever sprint surfaces the need first.

---

## 12. Architecture decisions to remember

- **Local-first.** Habit data lives in SQLite on the device. Supabase is auth + entitlement only. See `tech-handoff-core-v1.md` Section 1.
- **Repository pattern.** Feature modules never touch SQL directly. They go through `lib/db/repositories/*`.
- **Forward-only migrations.** Versioned SQL files in `lib/db/migrations/`, executed at app launch.
- **Feature-based modules.** Each feature owns its own api/hooks/types/screens.
- **Contract files** (`features/*/contract.ts`). Document business logic. Update when changing rules.
- **Submit lock pattern.** Use refs (`submitLockRef`) to prevent double-taps in mutation buttons.
- **Centralized error messages.** All user-facing strings in `utils/userFacingErrors.ts`.
- **Logical day = device local day** (`YYYY-MM-DD`), not UTC. See `utils/dates.ts`.
- **Habit rules are product rules, not security rules.** Enforced in the client. The server does not validate the 48-hour window, the streak rule, or the cap.
- **No habit text content leaves the device.** Anonymous analytics may be transmitted, but the allowlist excludes anything the user typed. See requirements Section 23.
- **Reminders are local notifications.** No push tokens stored on the server.
- **`features/sync/` stays dormant in Core v1.** May activate when cloud backup ships.

---

## 13. Key file quick reference

| Need to... | Look at... |
|-----------|-----------|
| Understand entry routing | `src/features/entry/screens/RootEntryScreen.tsx` |
| Add a feature flag | `src/config/featureFlags.ts` |
| Read/write habit data | `src/lib/db/repositories/habits.ts` |
| Read/write logs | `src/lib/db/repositories/habit_logs.ts` |
| Read/write user preferences | `src/lib/db/repositories/preferences.ts` |
| Initialize / get the DB | `src/lib/db/client.ts` (initDb, getDb, closeDb) |
| Add a new local migration | `src/lib/db/migrations/00N_*.ts` + register in `migrations/index.ts` |
| Wipe local DB during dev | `src/lib/db/devWipe.ts` |
| Run repository tests | `npm test` (uses better-sqlite3 adapter at `src/tests/setup/sqliteTestAdapter.ts`) |
| Modify habit form fields | `src/features/habits/types.ts` + `validators.ts` + `api.ts` |
| Modify streak/progress | `src/features/today/progress.ts` |
| Modify suggestion logic | `src/features/recommendations/habitAdjustmentEngine.ts` |
| Edit suggestion copy | `src/features/recommendations/copy.ts` |
| Edit edit-screen guidance | `src/features/recommendations/editGuidance.ts` |
| Trial validation logic | `src/features/trial/grace.ts` (computeAccessMode), `api.ts` (fetch), `storage.ts` (cache), `hooks.tsx` (provider) |
| AI prompt (deferred) | `supabase/functions/generate-habit-rewrite/index.ts` |
| Add a screen | Create in `app/` (route) + `src/features/*/screens/` (component) |
| Add a shared component | `src/components/` |
| Add theme tokens | `src/theme/` |
| Understand visual design intent / language | `docs/design-direction.md` (paired with `design/habitapp/habit-screens.jsx` as visual oracle) |
| Weekly review due logic | `src/features/reviews/due.ts` |
| Onboarding flow (planned) | `src/features/onboarding/screens/` |
| Library (planned) | `src/features/library/screens/LibraryScreen.tsx` |
| Graduation eligibility (planned) | `src/features/graduation/eligibility.ts` |
| Recovery modal | `src/components/RecoveryModal.tsx` (component) + `src/features/recovery/api.ts` + `src/features/recovery/hooks.ts` (logic + hooks) |
| Reminder scheduling (planned) | `src/features/reminders/notifications.ts` |
| Account deletion (planned) | `src/features/account/api.ts` |

---

## 14. Components for Core v1

Per tech handoff Section 9. Status as of S8 close.

### Built

- `src/components/Heatmap.tsx` — 30-day and 90-day variants (S5; 90-day rendered on Habit Detail in S6)
- `src/components/IdentityStreakDisplay.tsx` — identity-flavored streak rendering (S5)
- `src/features/onboarding/components/WorstDayCheck.tsx` — reusable check; originally for onboarding, slated for reuse in Supporting habit creation (S4)
- `src/components/RecoveryModal.tsx` — post-streak-break recovery modal with 4 actions and submit-lock on Pause (S7)
- `src/features/habits/components/RetroLogSelector.tsx` — modal-based retro-log selector with editable/read-only modes; `readOnlyReason` prop added in S8 to distinguish window-locked vs app-locked copy (S6 + S8)
- `src/components/ReadOnlyBanner.tsx` — calm non-dismissible banner with PrimaryButton reconnect CTA, surfaced when offline-grace exhausted (S8)

### To build (S10+)

- `src/features/today/components/GoalContainer.tsx` — Tonal surface wrapping identity anchor + donut + habits card (S10)
- `src/features/today/components/ConsistencyDonut.tsx` — 48px SVG ring, sage gradient, avg consistency across goal (S10)
- `src/features/today/components/HabitRow.tsx` — Tap circle=Done, long-press=Skip, tap row=detail (S10)
- `LibraryCard.tsx` — Automatic Library card (lights up when graduation ships)
- `SrhiQuestion.tsx` — single SRHI question with Likert input
- `BacklogList.tsx` — backlog management list

---

*End of project brain. Keep this document updated as decisions are made and features are built.*
