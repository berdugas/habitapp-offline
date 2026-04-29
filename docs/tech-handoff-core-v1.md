# Habits App — Technical Handoff for Core v1

> **Status:** Active implementation guidance for Core v1.
> **Date:** April 29, 2026
> **Owner:** Tech Lead
> **Companion documents:** `product-strategy.md`, `core-v1-requirements.md`

This document translates the Core v1 product requirements into engineering work. It is not the spec — the spec is in `core-v1-requirements.md`. This document defines architecture, schema, files, sequencing, and decisions the engineering team needs to ship.

---

## 1. Architecture: local-first

Core v1 is **local-first**. Supabase is used **only** for authentication, account identity, trial validation, and future entitlement. Habit data, habit rules, and habit history live on the user's device.

This is a deliberate architectural choice. Habit rules — forgiving streak, 48-hour retroactive logging, 3-active cap, worst-day gate — are **product rules**, not security rules. There is no business reason to enforce them server-side, and doing so adds complexity without value. The project name (`habits_offline`) and the existing dormant `features/sync/` foundation in the codebase confirm this was the original direction.

### 1.1 Data ownership model

| Data / Rule | Owner |
|---|---|
| Sign-up, login, session | Server (Supabase Auth) |
| Profile (email, etc.) | Server |
| Trial start/end | Server |
| Trial entitlement status | Server |
| Future paid entitlement | Server |
| Account deletion (server side) | Server |
| Habit list | Local (SQLite) |
| Habit logs (Done/Skipped/Missed) | Local |
| Focus / Supporting / Automatic state | Local |
| Status (active / archived / backlog) | Local |
| Backlog | Local |
| 48-hour retroactive logging window | Local (product rule) |
| Forgiving streak math | Local |
| Consistency calculation | Local |
| Heatmap data | Local |
| SRHI responses | Local |
| Graduation eligibility | Local |
| Automatic Library | Local |
| Recovery flow state | Local |
| Weekly reviews | Local |
| Reminder settings | Local |
| Reminder scheduling | Local (expo-notifications) |
| Data export | Local |
| Account deletion (local wipe) | Local |
| Anonymous analytics events | Server (no habit text content) |

### 1.2 Key implications

- **No server validation of habit rules.** The 48-hour retro window, the streak rule, the cap — all enforced in the client.
- **No push tokens.** Reminders are local notifications only.
- **No multi-device sync in Core v1.** If the user reinstalls or switches devices, local data is gone. Cloud backup is a v2 candidate, not Core v1.
- **The existing `features/sync/` foundation stays dormant.** The processor remains a no-op. We may resurrect this if/when cloud backup ships.

## 2. Tech stack

Existing stack preserved per `PROJECT_BRAIN.md`:
- React Native 0.81 / Expo SDK 54
- TypeScript 5.9
- Expo Router v6
- Supabase (Auth + minimal account/entitlement storage; no longer used for habit data)
- TanStack React Query v5 (still useful for server queries: auth, trial validation)
- AsyncStorage (lightweight preferences and onboarding resume state only)
- Jest + React Native Testing Library

**New dependencies for Core v1:**
- `expo-sqlite` — local structured database, the new source of truth for habit data
- `expo-notifications` — local notifications for the reminders feature

## 3. Server schema (Supabase)

The server stores **only** account and entitlement data.

### 3.1 `profiles`

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text NOT NULL,
  account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'pending_deletion', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.2 `trial_entitlements`

```sql
CREATE TABLE trial_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  trial_started_at timestamptz NOT NULL,
  trial_ends_at timestamptz NOT NULL,
  entitlement_status text NOT NULL DEFAULT 'trial'
    CHECK (entitlement_status IN ('trial', 'active', 'expired', 'paid', 'cancelled')),
  last_validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

`last_validated_at` is informational on the server — the **client** is responsible for tracking its own grace period (Section 6.4).

### 3.3 What we are dropping

The existing Supabase tables `habits`, `habit_logs`, and `weekly_reviews` are dropped. Per product decision, no real user data exists yet to preserve.

```sql
DROP TABLE IF EXISTS weekly_reviews;
DROP TABLE IF EXISTS habit_logs;
DROP TABLE IF EXISTS habits;
```

This cleans the slate. All habit data going forward lives on-device.

### 3.4 Existing Edge Function

`supabase/functions/generate-habit-rewrite/` (the AI rewrite function) remains in place but unused — `FEATURE_FLAGS.aiRewrite = false`. Don't delete; we may revisit post-Core-v1.

## 4. Local schema (SQLite)

Core v1 uses SQLite via `expo-sqlite` as the source of truth for habit data. Database file: `habits.db` in the app's document directory.

### 4.1 `local_habits`

```sql
CREATE TABLE local_habits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  identity_phrase TEXT,
  cue TEXT NOT NULL,
  tiny_action TEXT NOT NULL,
  minimum_viable_action TEXT,
  preferred_time_window TEXT,
  habit_state TEXT NOT NULL DEFAULT 'focus'
    CHECK (habit_state IN ('focus', 'supporting', 'automatic')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'backlog')),
  start_date TEXT NOT NULL, -- YYYY-MM-DD
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  automated_at TEXT,
  backlog_at TEXT
);
CREATE INDEX idx_habits_user_state ON local_habits(user_id, habit_state, status);
CREATE INDEX idx_habits_user_status ON local_habits(user_id, status);
```

### 4.2 `local_habit_logs`

```sql
CREATE TABLE local_habit_logs (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  log_date TEXT NOT NULL, -- YYYY-MM-DD, device local day
  status TEXT NOT NULL CHECK (status IN ('done', 'skipped', 'missed')),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, habit_id, log_date),
  FOREIGN KEY (habit_id) REFERENCES local_habits(id) ON DELETE CASCADE
);
CREATE INDEX idx_logs_habit_date ON local_habit_logs(habit_id, log_date DESC);
```

### 4.3 `local_srhi_responses`

```sql
CREATE TABLE local_srhi_responses (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  q1_score INTEGER NOT NULL CHECK (q1_score BETWEEN 1 AND 5),
  q2_score INTEGER NOT NULL CHECK (q2_score BETWEEN 1 AND 5),
  q3_score INTEGER NOT NULL CHECK (q3_score BETWEEN 1 AND 5),
  average_score REAL NOT NULL,
  graduated INTEGER NOT NULL CHECK (graduated IN (0, 1)),
  responded_at TEXT NOT NULL,
  FOREIGN KEY (habit_id) REFERENCES local_habits(id) ON DELETE CASCADE
);
```

### 4.4 `local_weekly_reviews`

```sql
CREATE TABLE local_weekly_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  week_start TEXT NOT NULL, -- YYYY-MM-DD
  went_well TEXT,
  was_hard TEXT,
  trigger_worked INTEGER NOT NULL CHECK (trigger_worked IN (0, 1)),
  tiny_action_too_hard INTEGER NOT NULL CHECK (tiny_action_too_hard IN (0, 1)),
  adjustment_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, habit_id, week_start),
  FOREIGN KEY (habit_id) REFERENCES local_habits(id) ON DELETE CASCADE
);
```

### 4.5 `local_reminder_settings`

```sql
CREATE TABLE local_reminder_settings (
  habit_id TEXT PRIMARY KEY,
  reminder_type TEXT NOT NULL DEFAULT 'none'
    CHECK (reminder_type IN ('none', 'backup', 'daily')),
  reminder_time TEXT, -- HH:mm in device local time
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  snoozed_until TEXT,
  disabled_for_date TEXT,
  notification_id TEXT, -- expo-notifications scheduled id, for cancellation
  updated_at TEXT NOT NULL,
  FOREIGN KEY (habit_id) REFERENCES local_habits(id) ON DELETE CASCADE
);
```

### 4.6 `local_user_preferences`

```sql
CREATE TABLE local_user_preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Used for: onboarding completion flag, becoming phrase (if we want it queryable separately from a habit), analytics opt-out, master reminder toggle, etc.

### 4.7 Cached server state in AsyncStorage

```typescript
// Lightweight, not part of SQLite
{
  trial_entitlement: {
    status: 'trial' | 'active' | 'expired' | 'paid' | 'cancelled',
    trial_started_at: string,
    trial_ends_at: string,
    last_validated_at: string  // device timestamp of last successful server check
  },
  onboarding_resume_step: number | null,
  feature_flags_overrides: { ... }  // dev only
}
```

## 5. Local repository pattern

To isolate the SQLite implementation behind a clean interface, organize each table behind a repository module:

```
src/lib/db/
├── schema.ts            # CREATE TABLE statements + version
├── migrations.ts        # forward-only migration runner
├── client.ts            # expo-sqlite client wrapper
└── repositories/
    ├── habits.ts        # CRUD on local_habits
    ├── habit_logs.ts    # CRUD on local_habit_logs
    ├── srhi.ts
    ├── weekly_reviews.ts
    ├── reminders.ts
    └── preferences.ts
```

Each repository exposes async functions that the feature modules call. Feature modules never touch SQL directly. This pattern makes future migration to a different local store (Realm, WatermelonDB, etc.) cheap if needed.

## 6. Architectural decisions

### 6.1 Local DB choice: SQLite via expo-sqlite

Reasoning:
- Logs are structured; queries are needed for streak, heatmap, consistency math.
- Export is straightforward (read all rows, serialize to JSON).
- Future cloud sync (if added) is easier from a structured store.
- Mature ecosystem, familiar SQL.
- Lower memory footprint than alternatives like WatermelonDB for our scale.

### 6.2 No sync queue (for now)

The existing `src/features/sync/` foundation stays dormant in Core v1. The `processSyncQueue` no-op stays as-is. We may resurrect this if/when cloud backup ships.

### 6.3 Trial grace period: 7 days, client-enforced

The server publishes `trial_ends_at` and `entitlement_status`. The client caches the last successful validation timestamp. If the client cannot reach the server, it allows full access for up to 7 days from `last_validated_at`. Beyond 7 days, the app degrades to read-only mode (no new logs, no new habits) until reconnection.

### 6.4 Reminders: local notifications only

`expo-notifications` schedules notifications on-device. No push token storage on the server. Notification IDs are stored in `local_reminder_settings.notification_id` for cancellation. When a habit is archived/deleted, the corresponding notification is canceled.

### 6.5 Analytics: anonymous events only

A thin events module wraps the existing `src/services/analytics`. It validates payloads against an allowlist (Section 23 of requirements) and strips any field containing free text from the user. Habit text content is **never** transmitted.

### 6.6 Identity-noun extraction

For displaying "You've been a [identity noun] for [N] days," we need to extract a noun from the user's becoming phrase ("Become someone who runs" → "runner"). Recommendation: rule-based parser with patterns like:
- "a [noun]" → use the noun (a runner → runner)
- "someone who [verb]" → derive noun (someone who runs → runner; someone who reads → reader)
- "a [adjective] person" → use adjective ("a calmer person" → calmer)

If extraction fails, fall back to: "You've shown up [N] days for this habit."

No AI in this. Rule-based only.

## 7. New feature modules

Per the existing convention (each feature owns api/hooks/types/screens):

### 7.1 `src/features/onboarding/`

```
├── api.ts                  # save becoming phrase, mark onboarding complete (writes to local_user_preferences + local_habits)
├── hooks.ts                # useOnboardingState, useOnboardingNavigation
├── types.ts
├── components/             # ShrinkCoaching, CueExamples, WorstDayCheck
├── screens/                # 6 screens + Confirmation
└── identityNoun.ts         # rule-based extractor
```

### 7.2 `src/features/library/`

```
├── api.ts                  # query local_habits where habit_state='automatic', promote back to focus
├── hooks.ts                # useLibrary, usePromoteFromLibrary
├── types.ts
├── components/             # LibraryCard, LibraryEmptyState
└── screens/                # LibraryScreen, LibraryHabitDetailScreen
```

### 7.3 `src/features/graduation/`

```
├── api.ts                  # write to local_srhi_responses, update habit_state
├── hooks.ts                # useGraduationEligibility, useSubmitSrhi
├── types.ts
├── components/             # SrhiQuestion, GraduationCelebration
├── screens/                # GraduationCeremonyScreen, NotYetAutomaticScreen
└── eligibility.ts          # 60-day + 75% rule
```

### 7.4 `src/features/recovery/`

```
├── api.ts                  # apply recovery action
├── hooks.ts                # useStreakBreakDetection, useRecoveryAction
├── types.ts
└── screens/                # RecoveryModalScreen
```

### 7.5 `src/features/reminders/`

```
├── api.ts                  # CRUD on local_reminder_settings
├── hooks.ts                # useReminders, useScheduleReminder
├── types.ts
├── notifications.ts        # expo-notifications integration (schedule, cancel)
├── copy.ts                 # approved reminder copy templates
└── screens/                # ReminderSettingsScreen
```

### 7.6 `src/features/account/`

```
├── api.ts                  # delete account (server + local wipe), generate local export
├── hooks.ts                # useDeleteAccount, useExportData
├── types.ts
├── components/             # DeleteAccountConfirm, DataExportRequest
└── screens/                # AccountScreen, DeleteAccountScreen, DataExportScreen
```

### 7.7 `src/features/backlog/`

```
├── api.ts                  # query local_habits where status='backlog', promote
├── hooks.ts                # useBacklog, usePromoteFromBacklog
└── components/             # BacklogList (rendered in Settings → Habit Management)
```

## 8. Existing files affected

### 8.1 `src/features/habits/api.ts` — major rewrite

Currently uses Supabase upserts. Rewrite to use the SQLite habits and habit_logs repositories.

- `createHabit` → write to `local_habits`
- `updateHabit` → update `local_habits`
- `archiveHabit` → set status = 'archived', archived_at = now
- `upsertHabitLog` → write to `local_habit_logs` with **48-hour validation locally** (reject log_date older than 48h)
- `listHabits` → query `local_habits` filtered by user_id, status, habit_state

### 8.2 `src/features/habits/validators.ts`

Update to validate the new fields (minimum_viable_action) and to enforce the 3-active cap on creation. The cap check queries the local DB before allowing `INSERT INTO local_habits` with state focus/supporting and status active.

### 8.3 `src/features/today/progress.ts` — change streak rule

Currently strict (consecutive Done). New logic:

1. Fetch logs for last N days (where N covers the streak we'd realistically display, plus buffer).
2. Walk backward from today.
3. **Step 1:** Remove Skipped days from the sequence (Section 8.3 of requirements).
4. **Step 2:** Counter increments on Done, tolerates one isolated Missed (sandwiched), breaks on two consecutive Missed.

Tests in `src/tests/unit/progress.test.ts` need a complete rewrite. Cases:
- All Done sequence
- Done with one isolated Missed
- Done with two consecutive Missed → reset
- Sequence with Skipped between Misses (skipped removed, then evaluate)
- Today-only logged
- Empty sequence

### 8.4 `src/features/today/screens/TodayScreen.tsx`

- Demote the multi-habit list pattern; emphasize the Focus card.
- Render Supporting cards smaller beneath.
- Add 30-day Heatmap component for the Focus habit.
- Identity-flavored streak copy via `IdentityStreakDisplay` component.
- Single-miss reframing copy appears once after a missed day, dismissible.

### 8.5 `src/features/habits/screens/CreateHabitScreen.tsx`

- For first-time users, this screen is replaced by the onboarding flow.
- For post-onboarding habit creation, integrate the worst-day gate (hard for Supporting, guidance for Focus per Section 3.5 of requirements).
- Enforce the 3-active cap (offer "save to Backlog" or "replace existing" when at cap).
- Bug #3 (preferred time picker): replace free-text input with a time picker component.

### 8.6 `src/features/recommendations/`

Most copy reviewed for identity-flavored language. Logic preserved. AI rewrite stays gated off. Bug #2 (dual suggestion display) fixed during this work.

### 8.7 `src/config/featureFlags.ts`

```typescript
export const FEATURE_FLAGS = {
  aiRewrite: false,        // unchanged
  localAiCoach: false,     // unchanged
  remindersEnabled: true,  // Core v1 — turns on in Sprint 6
  analyticsEnabled: true,  // Core v1 — anonymous events only
} as const;
```

The `softFrictionOverride` flag is **removed** — the feature is out of Core v1 scope (deferred until monetization).

### 8.8 `src/theme/`

Add tokens for: heatmap colors (greens, soft tan, missed tint), recovery modal styling, library card. No structural change.

### 8.9 `src/lib/storage/keys`

Add keys for cached trial entitlement, onboarding resume step, analytics opt-out.

## 9. New components

In `src/components/`:

- `Heatmap.tsx` — 30-day and 90-day variants
- `IdentityStreakDisplay.tsx` — renders identity-flavored streak copy
- `WorstDayCheck.tsx` — reusable check (onboarding + Supporting creation)
- `LibraryCard.tsx` — Automatic Library card display
- `RecoveryModal.tsx` — post-streak-break recovery
- `SrhiQuestion.tsx` — single SRHI question with 1-5 Likert input
- `BacklogList.tsx` — backlog management list

## 10. Bug fixes in scope

From `PROJECT_BRAIN.md` Section 8:

- **Bug #2 (P0):** dual suggestion display. Fix during recommendations work in Sprint 2.
- **Bug #3 (P1):** preferred time picker. Fix during habit creation polish in Sprint 7 alongside reminders work.
- **Bugs #1 (P0) and #4 (P1):** AI-related. Defer — AI is off for Core v1.

## 11. Implementation sequence

### Stage 1 — Private Beta (2–3 weeks)

Goal: ship a thin slice of Core v1 to invited testers. Validate the becoming-bridge thesis.

**Sprint 1 (week 1):**
- Drop existing Supabase habit tables; install new `profiles` and `trial_entitlements`
- Install `expo-sqlite`; build `src/lib/db/` (schema, migrations, client, repositories: habits + habit_logs + preferences)
- Rewrite `src/features/habits/api.ts` against repositories
- Onboarding flow (full 6 screens + persistence to local DB)
- TodayScreen redesign (Focus card with identity-flavored streak)
- Forgiving streak rule rewrite + tests (including skipped-day edge case)
- Heatmap component (30-day variant only)

**Sprint 2 (week 2):**
- Habit detail view (extended heatmap, consistency)
- 48-hour retroactive logging (local enforcement)
- Single-miss reframing copy
- Recovery modal (full)
- Bug #2 fix (dual suggestion display)
- Trial validation flow with 7-day grace period
- Settings basic (sign out, app version)

**Sprint 3 (week 3, partial):**
- Beta tester seeding (define invitation criteria, send invites)
- Bug fixes from internal testing
- TestFlight / Internal track build

### Stage 2 — Full Core v1 (weeks 4–8)

Building on Private Beta learnings.

**Sprint 4:** SRHI repository. Graduation ceremony (full). Automatic Library (basic — list view).

**Sprint 5:** Supporting habits (worst-day gate, lightweight rules per requirements Section 18). Backlog management. Library promote-back-to-focus.

**Sprint 6:** Reminders feature — `expo-notifications` integration, copy templates, settings, scheduling/cancellation logic, snooze/disable-for-day.

**Sprint 7:** Account deletion (server + local wipe). Data export (local JSON). Bug #3 (preferred time picker). Privacy policy + terms links.

**Sprint 8:** Polish, edge cases, empty states. Anonymous analytics instrumentation. App Store / Play Store assets and submission.

This sequence is a guide. The tech lead should adjust based on actual progress and beta feedback after Stage 1.

## 12. Testing strategy

### 12.1 Unit tests
- Forgiving streak math (multiple test cases including skipped-day edge case)
- Eligibility check for graduation
- Identity-noun extraction
- Worst-day check flow logic
- 48-hour retroactive log window validation
- Trial grace period calculation

### 12.2 Integration tests
- Onboarding end-to-end (form submission, local DB persistence, server profile creation)
- Habit creation post-onboarding with 3-active cap enforcement
- Logging round-trips to SQLite
- Graduation ceremony submission (SRHI write + state transition)
- Account deletion (server delete + local wipe)
- Data export (JSON generation from local DB)

### 12.3 Screen tests
- TodayScreen
- HabitDetailScreen
- OnboardingFlowScreen (each step)
- RecoveryModalScreen
- GraduationCeremonyScreen

### 12.4 Manual / beta testing

The Private Beta is the primary qualitative test. Define before Sprint 3:
- Invitation criteria (psychographic match, willingness to give feedback)
- Number of testers (target: 25–50)
- Feedback channels
- Success criteria for advancing to Stage 2

## 13. Open architectural questions for tech lead

These are flagged for tech lead's judgment; product is ready to discuss:

1. **SQLite migration strategy.** Forward-only versioned migrations vs. ORM-managed. *Recommendation:* simple forward-only versioned SQL files in `src/lib/db/migrations/`, executed at app launch.
2. **Graduation eligibility checking.** On app open (recommended) vs. log save. *Recommendation:* on app open. Cheap, no race conditions.
3. **Reminder notification IDs.** Track in `local_reminder_settings.notification_id` so we can cancel on archive/delete. *Confirmed.*
4. **Anonymous analytics transport.** Existing `src/services/analytics` if it has one; or simple Supabase Edge Function endpoint. *Recommendation:* whichever already exists; pick simplest.
5. **Identity-noun extraction edge cases.** Becoming phrases that don't fit the patterns. *Recommendation:* rule-based with explicit fallback copy. Document any failures users hit; iterate post-launch.

## 14. Out of tech handoff scope

These should not show up in Core v1 work tickets:

- Payment integration (deferred per requirements)
- Paywall infrastructure (deferred)
- AI features (`aiRewrite` flag stays false)
- Cloud sync (no Core v1 work; `features/sync/` stays dormant)
- Cloud backup (v2 candidate)
- Web version
- Wearables
- Localization
- Non-daily habit scheduling

If any of these surface in tickets, raise with product.

---

*End of tech handoff. Living document — update as the team learns and decisions are made.*
