# Habits App — Project Brain

> Single source of truth for anyone picking up this project.
> Last updated: April 29, 2026

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
- `habit_state`: focus | supporting | automatic
- `status`: active | archived | backlog
- `start_date`, `created_at`, `updated_at`, `archived_at`, `automated_at`, `backlog_at`

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

Display: identity-flavored copy on Focus habit (e.g., *"You've been a runner for 12 days"*). Not shown on Supporting habits.

### 7.2 Consistency calculation (formula unchanged, now local)

**Formula:** `done / (done + missed)` over the last 30 days. Skipped days excluded from both numerator and denominator. Deliberate product design — see requirements Section 10.2.

### 7.3 48-hour retroactive logging window

**Local enforcement.** Logs and edits within 48 hours of `log_date` are accepted. Beyond 48 hours, the day is immutable. This is a product rule, not a security rule.

### 7.4 3-active cap (Core v1 — hard cap)

The product enforces at most 3 habits with `status = active` and `habit_state in (focus, supporting)`:
- 1 Focus
- Up to 2 Supporting

A 4th active habit prompts: replace existing or save to Backlog. Soft-friction paid override **deferred** until monetization.

### 7.5 Worst-day gate

Hard block during onboarding (first Focus) and for all Supporting habits. Guidance only for post-onboarding Focus habits. See requirements Section 3.5.

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

### 7.9 Adjustment engine priority (existing, unchanged)

```
1. trigger_worked=false AND tiny_action_too_hard=true → fix both
2. tiny_action_too_hard=true → make action smaller
3. trigger_worked=false → change trigger
4. consistencyRate<0.5 OR skipCount>=3 → reduce friction
5. was_hard has content → plan for obstacle
6. (default) → keep going
```

Bug #2 (dual suggestion display) needs fixing during recommendations work.

---

## 8. Known bugs

| # | Bug | Location | Status |
|---|-----|----------|--------|
| 1 | Reduce friction logic ↔ AI rewrite contradiction | `habitAdjustmentEngine.ts` + AI prompt | **Deferred** (AI off for Core v1) |
| 2 | Dual suggestion shows only one | Suggestion display logic | **In scope** for Core v1 Sprint 2 |
| 3 | Preferred time should be picker, not text | `CreateHabitScreen.tsx` | **In scope** for Core v1 Sprint 7 |
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
| Project Brain | .md | `docs/PROJECT_BRAIN.md` | **Current — this document** |
| Sprint Plan | .md | `docs/sprint_tickets/sprint-plan.md` | **Current — the when (21-sprint roadmap, 4 phases)** |
| Sprint 1 Tickets | .md | `docs/sprint_tickets/sprint-1-tickets.md` | **Current — DEV-S1-01..04 dev packages** |
| Sprint 1 Follow-ups | .md | `docs/sprint_tickets/sprint-1-followups.md` | **Current — DEV-S1-05 polish ticket** |
| PRD Monetization | .docx | `docs/habits-app-prd-monetization.docx` | Reference for post-Core-v1 monetization |
| User Flow | .html | `docs/habits-app-user-flow.html` | Stale — regenerate post-Core-v1 |

---

## 11. Where we are now

Live status of the Core v1 build. For the full 21-sprint plan, see `docs/sprint_tickets/sprint-plan.md`.

### Done

- **S0** — Supabase migration `0005_core_v1_local_first_pivot.sql` applied. Old habit tables dropped; `profiles` + `trial_entitlements` created with auto-provision trigger on signup. `expo-sqlite` and `expo-notifications` installed. `.npmrc` added with `legacy-peer-deps=true`.
- **S1** — Local DB rails complete. `src/lib/db/` foundation (`client.ts`, `migrations.ts`, `migrations/001_initial.ts`, `migrations/index.ts`). Three repositories shipped: `preferences.ts`, `habits.ts`, `habit_logs.ts`. Dev-only `devWipe.ts` utility. Jest test infrastructure with `better-sqlite3` adapter (`src/tests/setup/sqliteTestAdapter.ts`, `createTestDb.ts`, `globals.ts`). Repository unit tests for all three repos. `app/_layout.tsx` gates render until `initDb()` resolves.
- **DEV-S1-05** — Polish round merged. `updateHabit` undefined-guard fix, `listHabits` ORDER BY created_at DESC, `deleteHabit`/`deleteLog` return boolean, `archiveHabit` is idempotent, `CreateHabitInput` type tightened, dead ternary removed from test adapter.

### Up next: S2 — habits API rewrite + forgiving streak

The first sprint where the app starts working again on top of SQLite. Rewrites `src/features/habits/api.ts` against the new repositories. Replaces the strict streak rule with the forgiving streak (including the skipped-day removal edge case per requirements §8). Adds 48-hour retroactive logging window enforcement (local). Comprehensive `src/tests/unit/todayProgress.test.ts` rewrite.

After S2 lands, the daily-logging flow is functional end-to-end against the local DB.

### Transitional state to be aware of

Pre-existing tests under `src/tests/unit/` and `src/tests/screen/` (~30 tests) test the old Supabase-shaped feature modules. They pass green because they mock the Supabase client, but they exercise code paths that hit dropped tables in production. These tests will be deleted or rewritten as part of S2 and beyond, when the feature modules they cover are rewritten. Don't be alarmed by their presence in the suite — they're transitional.

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
| AI prompt (deferred) | `supabase/functions/generate-habit-rewrite/index.ts` |
| Add a screen | Create in `app/` (route) + `src/features/*/screens/` (component) |
| Add a shared component | `src/components/` |
| Add theme tokens | `src/theme/` |
| Weekly review due logic | `src/features/reviews/due.ts` |
| Onboarding flow (planned) | `src/features/onboarding/screens/` |
| Library (planned) | `src/features/library/screens/LibraryScreen.tsx` |
| Graduation eligibility (planned) | `src/features/graduation/eligibility.ts` |
| Recovery modal (planned) | `src/features/recovery/screens/RecoveryModalScreen.tsx` |
| Reminder scheduling (planned) | `src/features/reminders/notifications.ts` |
| Account deletion (planned) | `src/features/account/api.ts` |

---

## 14. New components to build (Core v1)

In `src/components/` per tech handoff Section 9:

- `Heatmap.tsx` — 30-day and 90-day variants
- `IdentityStreakDisplay.tsx` — identity-flavored streak rendering
- `WorstDayCheck.tsx` — reusable check (onboarding + Supporting creation)
- `LibraryCard.tsx` — Automatic Library card
- `RecoveryModal.tsx` — post-streak-break recovery
- `SrhiQuestion.tsx` — single SRHI question with Likert input
- `BacklogList.tsx` — backlog management list

---

*End of project brain. Keep this document updated as decisions are made and features are built.*
