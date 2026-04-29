# Habits App — Core v1 Sprint Plan

> **Status:** Active sequencing document for Core v1 build.
> **Date:** April 29, 2026
> **Owner:** Tech Lead
> **Companion documents:** `product-strategy.md` (the why), `core-v1-requirements.md` (the what), `tech-handoff-core-v1.md` (the how), `PROJECT_BRAIN.md` (developer reference)

This document sequences Core v1 into small, testable sprints. It does not respecify requirements — when in doubt about scope or behavior, the requirements doc wins. When in doubt about architecture, the tech handoff wins. This document only owns: order, chunking, dependencies, and per-sprint definitions of done.

---

## 1. Sprint planning philosophy

Five rules govern how this plan is shaped. Every deviation from this plan should be tested against these.

**1. Foundations before features.** The local SQLite layer and the forgiving streak algorithm are load-bearing — every later feature depends on them. They get isolated, dedicated sprints before any user-visible work is rebuilt on top.

**2. Each sprint produces something testable.** Either a green test suite, a screen the user can tap through, or a build that runs. A sprint that ends with "in progress" was too big.

**3. Ship the thinnest beta first.** Stage 1 (Private Beta) is the minimum viable becoming-bridge: onboard → log → see streak → recover from a miss. Anything that doesn't directly test the becoming-bridge thesis gets pushed to Stage 2.

**4. Risky things first, polish last.** Streak math, DB migration, trial validation, recovery flow have unknowns and get earlier sprints. Settings polish, empty states, analytics instrumentation come later.

**5. Sprint length: 2–3 days.** Short enough to course-correct, long enough to finish a real piece of work. Sized for a solo dev or very small team.

## 2. Phase structure

Twenty-one sprints grouped into four phases. The phase grouping is for progress reporting and stakeholder communication; sprints are the unit of execution.

| Phase | Sprints | Calendar | Outcome |
|---|---|---|---|
| A — Foundation | S0–S2 | ~1 week | Server cleaned, local DB rails laid, streak algorithm tested. No user-visible work. |
| B — Private Beta surface | S3–S9 | ~3 weeks | Onboarding → log → streak → recover. TestFlight build with invited testers. |
| C — Full Core v1 features | S10–S18 | ~3 weeks | Graduation, Library, Supporting, Backlog, Reminders, Account, Export. |
| D — Polish & ship | S19–S21 | ~1 week | Bug fixes, empty states, analytics, store submission. |

**Total estimate:** ~52 working days ≈ 7–8 calendar weeks for solo dev to "submitted." Add 1–2 weeks for App Store / Play Store review before "live."

**Stage 1 (Private Beta) ends at the close of S9.** Stage 2 (Full Core v1) covers S10–S21.

## 3. Sprint format

Each sprint below specifies:

- **Goal** — one sentence on what changes for the user (or for the codebase) by the end of the sprint.
- **Deliverables** — concrete artifacts the sprint must produce.
- **Depends on** — sprints that must complete first. If a sprint has no dependency listed, it can start immediately after its predecessor.
- **Done means** — the testable bar that says the sprint is finished.
- **Risks** — known sprint-specific risks where they exist.

Tickets are derived from deliverables. Aim for 3–8 tickets per sprint.

---

## 4. Phase A — Foundation

### Sprint 0 — Server schema + dependency install

**Goal.** Clean the server slate and install the new platform dependencies so Phase A can begin without infrastructure surprises.

**Deliverables.**
- Supabase migration: `DROP TABLE IF EXISTS weekly_reviews; DROP TABLE IF EXISTS habit_logs; DROP TABLE IF EXISTS habits;`
- Supabase migration creating `profiles` and `trial_entitlements` per `tech-handoff-core-v1.md` §3.1 and §3.2
- `expo-sqlite` installed and added to `package.json`
- `expo-notifications` installed and added to `package.json`
- App still builds and runs (existing screens may break against missing tables — that is expected and resolved in S1–S2)

**Depends on.** Nothing.

**Done means.** Migrations applied to dev Supabase project. New deps in lockfile. App compiles. Existing tests against Supabase habit tables may fail loudly — acceptable and expected.

**Risks.** Existing dev devices have cached Supabase data references; expect runtime errors on launch until S1 lands. Document that the team should expect this.

---

### Sprint 1 — Local DB rails

**Goal.** Build the SQLite foundation so feature modules can read/write habit data through clean repository APIs.

**Deliverables.**
- `src/lib/db/client.ts` — `expo-sqlite` wrapper, opens/initializes `habits.db` in app document directory
- `src/lib/db/schema.ts` — full DDL for `local_habits`, `local_habit_logs`, `local_user_preferences` per tech handoff §4
- `src/lib/db/migrations.ts` — forward-only versioned migration runner; runs on app launch
- `src/lib/db/migrations/001_initial.sql` — initial schema migration
- `src/lib/db/repositories/habits.ts` — CRUD on `local_habits`
- `src/lib/db/repositories/habit_logs.ts` — CRUD on `local_habit_logs`
- `src/lib/db/repositories/preferences.ts` — CRUD on `local_user_preferences`
- One-time wipe utility for dev devices carrying stale state from the old Supabase-shaped flow
- Unit tests for each repository covering happy path + edge cases (constraint violations, missing FKs, unique violations on logs)

**Depends on.** S0.

**Done means.** All repository unit tests pass. App launches without DB errors. Migration runner is idempotent (running twice is safe).

**Risks.** SQLite migration ordering on cold launch — make sure `migrations.ts` runs before any feature module reads data. The `App.tsx` (or root provider) needs to await migration completion before rendering. Block render with a brief loading state.

---

### Sprint 2 — Habit API rewrite + forgiving streak

**Goal.** Move all habit reads/writes off Supabase onto the new repositories, and replace the strict streak rule with the forgiving streak (including the skipped-day edge case). The app still looks the same; the engine underneath is new.

**Deliverables.**
- `src/features/habits/api.ts` rewritten to call repository functions (no direct SQL):
  - `createHabit` → `local_habits` insert
  - `updateHabit` → `local_habits` update
  - `archiveHabit` → status = 'archived', `archived_at` set
  - `upsertHabitLog` → `local_habit_logs` upsert with **48-hour validation rejected here**
  - `listHabits` → query filtered by `user_id`, `status`, `habit_state`
- `src/features/habits/validators.ts` updated for new fields and 3-active cap (cap check queries DB before insert)
- `src/features/today/progress.ts` rewritten for forgiving streak per requirements §8:
  - Skipped days removed from sequence first
  - Increments on Done
  - Tolerates one isolated Missed (sandwiched by Done)
  - Resets on two consecutive Missed (after skipped removal)
- `src/tests/unit/progress.test.ts` rewritten with cases:
  - All-Done sequence (n=1, 7, 30 days)
  - Done with one isolated Missed
  - Done with two consecutive Missed → reset
  - Sequence with Skipped between two Misses → skipped removed, then evaluated
  - Today-only logged
  - Empty sequence
  - Long sequence with multiple isolated misses
- `src/tests/integration/habit-api.test.ts` covering CRUD round-trips through repositories

**Depends on.** S1.

**Done means.** All unit + integration tests green. Existing screens (Today, Habit Detail, Create Habit) still render and work, now reading from SQLite. The displayed streak number reflects forgiving logic — manual smoke test with 3–5 hand-crafted log sequences confirms correctness.

**Risks.** This is the highest-risk sprint of Phase A because the streak rule edge cases are subtle. **The skipped-day rule** (skipped removed *before* evaluating consecutive misses) is the most-reviewed rule in the requirements doc — get the test cases right first, then implement.

---

## 5. Phase B — Private Beta surface

### Sprint 3 — Onboarding screens 1–3

**Goal.** First half of the becoming-bridge — the user can move from welcome through stating who they want to become and what that person does daily.

**Deliverables.**
- `src/features/onboarding/` module scaffold (api, hooks, types, screens, components)
- Screen 1 — `WelcomeScreen` with single CTA: "Begin"
- Screen 2 — `BecomingScreen` with free-text input, example identities below ("a runner, someone who reads daily, a calmer person, a writer, someone who sleeps well")
- Screen 3 — `DailyActionScreen` with free text, example placeholders that adjust based on common identity inputs
- Onboarding resume state persisted to AsyncStorage via `local_user_preferences` key `onboarding_resume_step`
- Field state persisted as user types so reopening the app lands on the right screen with the right data
- Routing: new entry routing in `RootEntryScreen.tsx` checks for incomplete onboarding and routes accordingly

**Depends on.** S2.

**Done means.** A new user can sign in, see Welcome, advance through Becoming and Daily Action, and if they kill the app and reopen, they resume on the screen they left with their entered text intact.

**Risks.** None significant. Pure UI + AsyncStorage.

---

### Sprint 4 — Onboarding screens 4–6 + confirmation

**Goal.** Second half of the becoming-bridge — shrink, cue, worst-day check, confirmation, and a real Focus habit written to the local DB.

**Deliverables.**
- Screen 4 — `ShrinkScreen` with pre-fill from screen 3, full coaching paragraph from requirements §4.1, and 3 example shrinks
- Screen 5 — `CueScreen` with two-field input ("After I…" / "I will…"), coaching paragraph on routine vs clock cues, example existing routines list
- Screen 6 — `WorstDayCheckScreen` as **hard block during onboarding**: "No" loops back to Screen 4 with copy *"Let's make it smaller. What would survive a hard day?"*
- `WorstDayCheck` shared component (reusable in S13 for Supporting habit creation)
- `ConfirmationScreen` summary card: identity / cue+action / start date
- On submit:
  - Insert one row into `local_habits` with `habit_state='focus'`, `status='active'`, `start_date=today`
  - Mark onboarding complete in `local_user_preferences`
  - Clear `onboarding_resume_step`
- Empty `Today` state on first land: *"Your first day. Start small."*

**Depends on.** S3.

**Done means.** A new user can complete the full 6-screen flow. After confirmation, exactly one Focus habit exists in `local_habits`. The app routes to Today with that habit visible. Onboarding never appears again for this user.

**Risks.** Worst-day check loop UX needs careful state management — make sure looping back doesn't lose Screen 4 input.

---

### Sprint 5 — Today redesign + heatmap + identity streak

**Goal.** The user lands on a Today screen that emphasizes the Focus habit, shows their identity-flavored streak, and a 30-day heatmap.

**Deliverables.**
- `src/components/Heatmap.tsx` — 30-day variant for Today (90-day variant in S6)
  - Cell colors per requirements §9.3: green Done, soft tan Skipped, empty Missed, outline today
  - Theme tokens added in `src/theme/`
- `src/features/onboarding/identityNoun.ts` — rule-based extractor:
  - "a [noun]" → noun
  - "someone who [verb]" → derive noun (runs → runner; reads → reader; meditates → meditator)
  - "a [adjective] person" → adjective ("calmer")
  - Fallback returns `null`
- `src/components/IdentityStreakDisplay.tsx`:
  - 0 days → *"Day one. Start showing up."*
  - 1+ days with extracted noun → *"You've been a [noun] for [N] days."*
  - 1+ days without extracted noun → *"You've shown up [N] days for this habit."*
- `TodayScreen` refactored:
  - Focus card prominent: becoming phrase header, cue+action, identity streak, Done/Skip buttons, 30-day heatmap below
  - Bottom navigation: Today, Library (placeholder), Settings
  - "No habits" empty state with CTA to start a new Focus habit
- Unit tests for `identityNoun` with 15+ becoming-phrase variants including fallback cases

**Depends on.** S4.

**Done means.** Post-onboarding lands on a Today screen showing the new Focus habit with identity-flavored copy and a heatmap. Logging Done updates the streak and lights up today's cell within one second.

**Risks.** Identity-noun extraction will miss real-user phrasing. Log misses in dev console (and later in analytics) so we can iterate post-launch.

---

### Sprint 6 — Habit detail + 48-hour retro logging

**Goal.** The user can open a habit's detail view, see its full history, and retroactively log within the 48-hour window.

**Deliverables.**
- `HabitDetailScreen` updated:
  - Becoming phrase, cue, tiny action header
  - Identity-flavored streak
  - 90-day heatmap variant
  - Consistency display: *"[N]% over the last 30 days"* (formula: `done / (done + missed)`, skipped excluded)
  - Recent log history list
  - Edit / archive controls
- 48-hour retro logging interaction:
  - Tapping a heatmap cell within 48 hours opens a Done/Skip selector
  - Tapping a cell outside 48 hours shows the date and status as read-only
  - Selector writes via `upsertHabitLog`, which validates the window locally and rejects logs older than 48 hours
- Integration test: retro-log a 36-hour-old day succeeds; retro-log a 60-hour-old day rejects with friendly error

**Depends on.** S5.

**Done means.** From the heatmap on Today or Detail, the user can correct yesterday's missed log within the window. After 48 hours, that day visibly locks.

**Risks.** Time-zone edge cases at day boundaries — anchor everything to `device local day (YYYY-MM-DD)` per `utils/dates.ts`. Add tests near midnight transitions.

---

### Sprint 7 — Recovery flow + single-miss copy

**Goal.** A streak break feels like a product moment, not a punishment. Single misses get gentle reframing; double misses open the recovery modal.

**Deliverables.**
- Streak-break detection logic (runs on app open):
  - Reads recent logs for active Focus habit
  - Determines if the most recent two consecutive non-skipped days are Missed
  - If yes, marks recovery modal as due
- `src/features/recovery/` module
- `src/components/RecoveryModal.tsx`:
  - Calm copy from requirements §11.1
  - Three actions: Restart as-is, Make it smaller, Pause for now
  - Quiet "Just close" dismiss
- Recovery actions wire-up:
  - Restart as-is → no DB change beyond dismissing the modal; streak stays reset (already 0)
  - Make it smaller → routes to Edit Habit screen
  - Pause for now → archive habit (`status='archived'`, `archived_at=now`)
  - Just close → just dismiss; streak reset already applies
- Single-miss reframing banner on Today:
  - Appears once after a missed day
  - Copy: *"Yesterday was a miss. The science says it didn't matter. Keep going."*
  - Dismissible; persisted as dismissed in `local_user_preferences`
- Tests:
  - Detection logic across log sequences
  - Single miss does NOT trigger modal
  - Two consecutive misses DOES trigger modal
  - Skipped between two misses still triggers modal (per skipped-removal rule)

**Depends on.** S6.

**Done means.** Hand-craft a sequence ending in two consecutive misses; relaunch app; modal appears. Pick "Make it smaller" and the edit screen opens with the current habit loaded.

**Risks.** Modal trigger should fire only once per break, not on every relaunch. Track "last shown for break ending on date X" in preferences.

---

### Sprint 8 — Trial validation + basic Settings + Bug #2

**Goal.** Trial entitlement validates against the server with a 7-day offline grace period. Basic Settings exist. The dual-suggestion display bug is fixed.

**Deliverables.**
- Trial validation service:
  - Validates at sign-in, every time
  - Periodic re-validation while online (e.g., once per app open after the first hour)
  - On success, caches `entitlement_status`, `trial_ends_at`, `last_validated_at` in AsyncStorage
- 7-day grace logic:
  - Within 7 days of `last_validated_at` → full access
  - Beyond 7 days offline → read-only mode (no new logs, no new habits, no archives) with clear "reconnect to validate" prompt
  - On successful re-validation, full access restored
- Read-only mode UI:
  - Today screen log buttons disabled with explanation tooltip
  - Create Habit hidden
  - All existing data still visible
- Settings basic screen:
  - Email display
  - Sign out
  - App version
  - Privacy policy + Terms placeholders (real links wired in S19)
- Bug #2 fix: dual suggestion display now shows both suggestions when adjustment engine returns two
- Tests:
  - Grace period boundary (6 days, 7 days, 8 days offline)
  - Read-only mode disables mutations
  - Re-validation restores full access

**Depends on.** S7.

**Done means.** Manually advance device clock to simulate 8-day offline; app enters read-only mode. Restore network and re-launch; full access returns. Bug #2 verified fixed in recommendation flow.

**Risks.** Clock manipulation in tests requires careful date abstraction — wrap all `Date.now()` calls behind a testable clock module if not already done.

---

### Sprint 9 — Beta build + tester seeding

**Goal.** Ship Stage 1 to invited testers.

**Deliverables.**
- Internal QA pass against requirements §24.1 (onboarding), §24.2 (Today), §24.3 (logging), §24.4 (streak), §24.5 (heatmap), §24.6 (recovery), §24.12 (trial)
- Bug fixes from internal QA
- TestFlight build (iOS) and Internal Testing track build (Android)
- Tester invitation list (target 25–50, psychographic match per `core-v1-requirements.md` §20)
- Feedback channel set up (form, email, or Discord — pick one)
- Welcome message for testers explaining what the beta is and isn't (no AI yet, no Library yet, no reminders yet)

**Depends on.** S8.

**Done means.** First tester opens the app, completes onboarding, and successfully logs Day 1 of their first Focus habit.

**Risks.** Beta tester recruitment is product work, not engineering — start lining up testers during S6 or S7, not waiting for S9. Build store provisioning (TestFlight, Internal Testing) early — Apple's approval for TestFlight can take 24+ hours the first time.

---

## 6. Phase C — Full Core v1 features

Phase C builds on Stage 1 learnings. Sprint contents stay as planned unless beta feedback materially shifts priorities — in which case **the plan changes**, not the sprint sizes.

### Sprint 10 — SRHI repo + eligibility check

**Goal.** The data and logic layer for graduation, ahead of the UI.

**Deliverables.**
- `src/lib/db/migrations/00X_srhi.sql` — adds `local_srhi_responses` table per tech handoff §4.3
- `src/lib/db/repositories/srhi.ts`
- `src/features/graduation/eligibility.ts`:
  - Returns `{ eligible: boolean, daysTracked: number, consistency: number }`
  - Eligible when `daysTracked >= 60 && consistency >= 0.75`
  - `consistency` calculated from logs over last 30 days, skipped excluded
- Unit tests:
  - 59 days + 80% → not eligible
  - 60 days + 74% → not eligible
  - 60 days + 75% → eligible
  - 90 days + 80% with skipped days mixed in → consistency calc correct

**Depends on.** S9 closed (beta in flight).

**Done means.** Calling `checkEligibility(habitId)` returns correct `eligible` and metrics across 8+ test fixtures.

---

### Sprint 11 — Graduation ceremony

**Goal.** The user can complete the SRHI ceremony and graduate a Focus habit to Automatic.

**Deliverables.**
- Eligibility check runs on app open (cheap query, no race conditions per tech handoff §13)
- `src/components/SrhiQuestion.tsx` — 1–5 Likert scale renderer
- `GraduationCeremonyScreen`:
  - Calm intro framing per requirements §12.2
  - Three SRHI-inspired questions on 1–5 scale
  - Submit calculates average and writes to `local_srhi_responses`
- `NotYetAutomaticScreen`:
  - Shown when average < 4.0
  - Calm copy: *"Not automatic yet. That's useful information."*
  - Re-eligibility set to 14 days from now
- Graduation success path:
  - Habit `habit_state` → 'automatic'
  - `automated_at` = now
  - Visible celebration (subtle, not gamified)
- Manual graduation request from Habit Detail menu (same ceremony)
- Tests:
  - Average ≥ 4.0 → graduated, state changes
  - Average < 4.0 → no state change, retry timer set

**Depends on.** S10.

**Done means.** A test habit with crafted logs (60+ days, 80% consistency) opens the ceremony on next app launch. Submitting all 5s graduates it. Submitting all 3s leaves it in Focus and re-triggers in 14 days.

---

### Sprint 12 — Automatic Library

**Goal.** Graduated habits live in the Library tab — a growing record of who the user has become.

**Deliverables.**
- Library tab added to bottom navigation (Today / Library / Settings)
- `src/features/library/` module
- `LibraryScreen`:
  - List view of all `habit_state='automatic'` habits
  - Sort options: graduation date (default), lifetime days, identity
  - Empty state copy from requirements §13.4
- `LibraryCard` component:
  - Habit name, identity phrase, graduation date, lifetime days, pre-graduation consistency
- `LibraryHabitDetailScreen`:
  - Full card content
  - Original cue and minimum viable version
  - "Promote back to Focus" action (slot-permitting)
- Promote-back logic:
  - Only allowed if Focus slot is available
  - On promote: `habit_state` → 'focus', `automated_at` cleared, 60-day clock starts fresh
  - Preserves all log history
- Logging from Library: tapping a card from Library can log Done for today (continues lifetime tracking)

**Depends on.** S11.

**Done means.** Manually graduate a test habit, switch to Library tab, see the card. Promote it back to Focus and confirm it appears on Today with reset 60-day clock but preserved heatmap.

---

### Sprint 13 — Supporting habits

**Goal.** Users can add up to 2 Supporting habits alongside their Focus, with the 3-active cap enforced.

**Deliverables.**
- Post-onboarding habit creation flow updated (`CreateHabitScreen`):
  - Type selector: Focus / Supporting (auto-determined by available slots, can save to Backlog if no slot — Backlog UI in S14)
  - Worst-day gate **as hard block** for Supporting (per requirements §3.5)
  - Worst-day gate **as guidance only** for post-onboarding Focus
- 3-active cap enforcement:
  - Counts `status='active'` AND `habit_state IN ('focus','supporting')`
  - On 4th active habit attempt: prompt with "Replace existing" or "Save to backlog" (Backlog action lands fully in S14)
- TodayScreen Supporting cards:
  - Smaller than Focus card
  - Cue + action + Done/Skip
  - **No streak number** (per requirements §18 — supporting tracked internally, not emphasized)
  - **No identity-flavored copy**
- Supporting log behavior: Done/Skip only; Missed auto-applied at day end like Focus
- Tests:
  - 3-active cap blocks 4th creation
  - Supporting worst-day "no" answer blocks creation
  - Focus worst-day "no" allows creation with gentle note

**Depends on.** S12. (Library tab provides infrastructure that makes Today's reduced-prominence Supporting cards make sense.)

**Done means.** User has 1 Focus + 2 Supporting on Today; 4th attempt prompts replacement/backlog choice; Supporting cards render compactly and don't show streak.

---

### Sprint 14 — Backlog

**Goal.** Backlog is a real surface — habit ideas can be saved, reviewed, and promoted when slots open.

**Deliverables.**
- `src/features/backlog/` module
- `BacklogList` component, rendered in Settings → Habit Management
- Backlog promote logic:
  - Promote → Focus (slot available)
  - Promote → Supporting (slot available **and** passes worst-day gate)
  - Cap-blocked promotion shows the "replace existing" / "save again" choice
- Backlog delete (any backlog habit)
- "Save to backlog" wired up from S13's cap-exceeded flow
- Backlog habits never appear on Today, never logged, never counted in streak
- Tests:
  - Backlog → Focus promotion succeeds when slot open
  - Backlog → Supporting fails worst-day gate with helpful error
  - Cap-exceeded prompt offers backlog as a real option

**Depends on.** S13.

**Done means.** Create a 4th habit, choose "Save to backlog," see it in Settings → Habit Management → Backlog. Delete an active habit, then promote the backlog habit to Focus. Verify it appears on Today.

---

### Sprint 15 — Reminders foundation

**Goal.** The local-notification machinery — schedule, cancel, lifecycle — is in place, decoupled from the UI.

**Deliverables.**
- `src/lib/db/migrations/00X_reminders.sql` — adds `local_reminder_settings` table
- `src/lib/db/repositories/reminders.ts`
- `src/features/reminders/notifications.ts`:
  - `expo-notifications` setup with permission request flow
  - `scheduleReminder(habitId, type, time)` — schedules and stores `notification_id`
  - `cancelReminder(habitId)` — cancels and clears `notification_id`
  - `rescheduleAll()` — utility for app updates / time-zone changes
- Lifecycle hooks:
  - On habit archive → cancel reminder
  - On habit delete → cancel reminder
  - On habit `habit_state` → 'automatic' → cancel reminder (Library habits are not reminded by default)
- `src/features/reminders/copy.ts` — approved copy templates per requirements §14.4 (no streak-loss language allowed)
- `FEATURE_FLAGS.remindersEnabled` confirmed `true`

**Depends on.** S14.

**Done means.** From a developer console / dev-only screen, scheduling a reminder for a habit fires a real local notification at the chosen time. Archiving the habit cancels it.

**Risks.** Notification permissions on iOS require careful UX — first prompt is the only chance. Plan a soft pre-prompt screen that explains why before the system prompt fires.

---

### Sprint 16 — Reminders settings UI + snooze

**Goal.** Users can configure reminders per habit and act on notifications when they fire.

**Deliverables.**
- `ReminderSettingsScreen` accessible from each habit's detail view:
  - Reminder type: None (default) / Backup / Daily
  - Time picker (HH:mm in device local time)
  - Save persists to `local_reminder_settings` and reschedules notification
- Settings → Reminders master toggle (default on; off disables all reminders globally)
- Notification action buttons:
  - Snooze 1 hour → reschedules `snoozed_until = now + 1h`
  - Disable for today → sets `disabled_for_date = today`
- Reminder fire-time logic respects `snoozed_until` and `disabled_for_date` — both fields cleared at next day boundary
- Frequency cap: never more than one notification per habit per day (multiple-habit reminders consolidate into one; Stage 1 keeps single-habit-per-notification, multi-habit consolidation is acceptable to defer if needed)
- Tests:
  - Backup reminder skips firing if today is already logged
  - Daily reminder fires regardless of log status
  - Snooze rescheduling

**Depends on.** S15.

**Done means.** From a habit detail screen, enable backup reminder at 8:30 AM. Don't log the habit. At 8:30 AM the next morning, notification fires with approved copy. Tap "Snooze" → it reappears at 9:30 AM. Tap "Disable for today" → it does not reappear today.

---

### Sprint 17 — Data export

**Goal.** Users can export everything they've put in the app, all locally, no server roundtrip.

**Deliverables.**
- `src/features/account/` module scaffolded (export + delete in S18)
- Export logic:
  - Read all rows from every `local_*` table for the current user
  - Serialize to a single JSON file with version + schema metadata
  - Save via device share sheet (iOS Files / Android system share)
- Settings → Privacy → Export My Data button
- Empty-data edge case handled gracefully
- Tests:
  - Round-trip: export → parse → verify all habits, logs, SRHI, weekly reviews, reminders, preferences are present
  - No data uploaded to server during export (network-mock test)

**Depends on.** S16.

**Done means.** From Settings, tap Export My Data → save to device → open the JSON → confirm structure matches local DB.

---

### Sprint 18 — Account deletion

**Goal.** Users can permanently delete their account: server data and local data both wiped.

**Deliverables.**
- `DeleteAccountScreen` — two-step confirmation with destructive copy from requirements §17.2
- Server-side delete sequence:
  - Send confirmation email **before** wipe (since after wipe, email is the only artifact remaining)
  - Delete `trial_entitlements` row
  - Delete `profiles` row
  - Call `supabase.auth.admin.deleteUser()` (or equivalent client-safe approach)
- Local-side delete sequence:
  - Wipe all `local_*` tables
  - Clear all AsyncStorage keys
  - Cancel all scheduled notifications
- Sign out + return to Welcome screen
- Caveat copy mentions: data on other devices not auto-deleted (per Core v1 single-device limitation)
- Tests:
  - Server delete failure does not orphan local data — fail loud, don't proceed
  - Successful delete sequence: server first, then local

**Depends on.** S17.

**Done means.** Test account: create some data, request deletion, two-step confirm. Email arrives. Server records gone. App lands on Welcome with empty state. Re-sign-in attempt fails gracefully.

**Risks.** Calling `auth.admin.deleteUser` from the client is not allowed by Supabase. Likely needs a Supabase Edge Function `delete-account` that runs with service role. Plan for this — it's a small additional ticket.

---

## 7. Phase D — Polish & ship

### Sprint 19 — Bug #3 + empty states + privacy/terms

**Goal.** Clean up the rough edges before submission.

**Deliverables.**
- Bug #3 fix: replace preferred time free-text with time picker component in habit creation/edit
- Empty-state copy review across:
  - Today (no habits)
  - Library (no graduates)
  - Backlog (empty)
  - Heatmap (no logs yet)
  - Habit history (none)
- Privacy policy + Terms of service hosted somewhere stable (likely a simple static page); links wired into Settings
- Acknowledgments page (open-source attributions for `expo-sqlite`, `expo-notifications`, etc.)

**Depends on.** S18.

**Done means.** Every empty state shows calm, hopeful copy. Privacy + Terms links open real documents. Time picker replaces text in habit creation.

---

### Sprint 20 — Anonymous analytics instrumentation

**Goal.** Lightweight event analytics for product-improvement signal, with strict allowlist.

**Deliverables.**
- `src/services/analytics` thin wrapper around the existing analytics service (or new minimal Supabase Edge Function endpoint if no existing service):
  - Allowlist enforcement (events from requirements §23.1 only)
  - Payload validation strips any field containing free-user-text
  - Opt-out check: respects `local_user_preferences.analytics_opt_out`
- Event instrumentation across the app, exactly the events listed in requirements §23.1
- Settings → Privacy → Anonymous analytics toggle (on by default)
- Test: payload with free-text field is stripped/rejected before transmission

**Depends on.** S19.

**Done means.** All events from §23.1 fire from their respective interaction points. No habit name, identity phrase, cue, action, note, or weekly-review free-text ever appears in transmitted payloads — verified by network capture in dev.

**Risks.** Easy to leak free-text accidentally. Code-review every event call site for fields that shouldn't be there.

---

### Sprint 21 — Store submission

**Goal.** App submitted to App Store and Play Store.

**Deliverables.**
- App Store assets: icons (all sizes), screenshots (5–8 per device size), privacy nutrition labels, marketing copy (description, keywords, what's new)
- Play Store assets: equivalent for Android
- Privacy disclosures on both stores reflect local-first posture (data not collected: habit content; data collected: account email, anonymous analytics if opted in)
- Final QA pass on production builds
- Submit

**Depends on.** S20.

**Done means.** Submission accepted into review on both stores.

**Risks.** First-time App Store review can take 1–2 weeks. The 7–8 week sprint estimate is to "submitted," not "live." Plan launch comms with that buffer.

---

## 8. Cross-cutting concerns

### 8.1 Testing rhythm

- **Unit tests** ride with each sprint that introduces logic. No "test sprint" at the end — that always slips.
- **Integration tests** introduced in S2 and added each time a new repository or DB-touching feature lands.
- **Screen tests** introduced in S5 (Today), S7 (Recovery), S11 (Graduation), S16 (Reminder Settings).
- **Manual QA passes** at S9 (pre-beta) and S21 (pre-submission). Each pass walks the acceptance criteria in `core-v1-requirements.md` §24.

### 8.2 Beta tester recruitment timeline

Tester recruitment is product work that runs in parallel with engineering:

- **By S6:** define invitation criteria (psychographic match per strategy doc §3) and draft the invitation message
- **By S7:** identify 50–75 candidate testers (over-recruit; not all will engage)
- **By S8:** send save-the-date and feedback-channel invite
- **S9:** send TestFlight / Internal Testing invites

### 8.3 Store provisioning

- **By S5:** App Store Connect and Play Console accounts created and verified
- **By S7:** TestFlight Internal Testing group provisioned (24+ hour Apple approval the first time)
- **S9:** First TestFlight build uploaded
- **S21:** Production submission

### 8.4 What changes if Stage 1 reveals a problem

If Private Beta surfaces issues that change the product (becoming-bridge fails, retention is poor, copy is wrong), Phase C re-plans before starting. The sprint structure absorbs change well; the phase boundaries are the natural replan checkpoints.

If Private Beta surfaces issues that don't change the product (bugs, polish gaps), they slot into Phase D's S19 or earlier — don't let them invade S10–S18 feature work.

## 9. Risks register

| # | Risk | Affects | Mitigation |
|---|---|---|---|
| 1 | SQLite migration ordering on cold launch | S1 onward | Block render until migrations complete; idempotent runner |
| 2 | Forgiving streak skipped-day rule edge cases | S2 | Write tests before implementation; cover every example in requirements §8 |
| 3 | Identity-noun extraction misses real phrasing | S5 | Clear fallback copy; log misses for post-launch tuning |
| 4 | Day-boundary / time-zone bugs in retro logging | S6 | Anchor to device-local-day; test near midnight |
| 5 | Recovery modal triggers repeatedly | S7 | Track "last shown for break ending date X" in preferences |
| 6 | iOS notification permission first-prompt UX | S15 | Soft pre-prompt screen explaining why, before system prompt |
| 7 | Server-side `deleteUser` requires admin role | S18 | Plan a Supabase Edge Function with service role for deletion |
| 8 | Free-text leak in anonymous analytics | S20 | Allowlist + payload validation + code review every call site |
| 9 | App Store review delay | S21 | Submit with 1–2 weeks of launch buffer; have rollback plan |
| 10 | Beta tester recruitment slow | S9 | Start in S6; over-recruit by 50% |

## 10. Status tracking convention

Each sprint moves through these states:

- **Planned** — sprint defined, not yet started
- **In progress** — work has begun
- **In review** — deliverables done, awaiting QA / acceptance check
- **Done** — done means met; ready for next sprint to start

The "Done means" line in each sprint definition is the bar. A sprint isn't Done until the bar is met.

Update this document when:
- A sprint changes scope materially
- A sprint is split or merged
- The phase plan changes
- A risk turns into reality (note in the register, link to the response)

---

*End of sprint plan. Living document — update when sequencing or scope shifts.*
