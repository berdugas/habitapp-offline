# Habits App — Core v1 Sprint Plan

> **Status:** Active sequencing document for Core v1 build.
> **Date:** May 3, 2026 (Phase C resequenced for revised pre-beta path; OPEN #2 locked)
> **Owner:** Tech Lead
> **Companion documents:** `product-strategy.md` (the why), `core-v1-requirements.md` (the what), `tech-handoff-core-v1.md` (the how), `PROJECT_BRAIN.md` (developer reference)

This document sequences Core v1 into small, testable sprints. It does not respecify requirements — when in doubt about scope or behavior, the requirements doc wins. When in doubt about architecture, the tech handoff wins. This document only owns: order, chunking, dependencies, and per-sprint definitions of done.

---

## 1. Sprint planning philosophy

Five rules govern how this plan is shaped. Every deviation from this plan should be tested against these.

**1. Foundations before features.** The local SQLite layer and the forgiving streak algorithm are load-bearing — every later feature depends on them. They get isolated, dedicated sprints before any user-visible work is rebuilt on top.

**2. Each sprint produces something testable.** Either a green test suite, a screen the user can tap through, or a build that runs. A sprint that ends with "in progress" was too big.

**3. Ship the thinnest beta first.** Stage 1 (Private Beta) is the minimum viable becoming-bridge: onboard → log → see streak → recover from a miss → add supporting habits → get reminded. Anything that doesn't directly test the becoming-bridge thesis gets pushed to Stage 2.

**4. Risky things first, polish last.** Streak math, DB migration, trial validation, recovery flow have unknowns and get earlier sprints. Settings polish, empty states, analytics instrumentation come later.

**5. Sprint length: 2–3 days.** Short enough to course-correct, long enough to finish a real piece of work. Sized for a solo dev or very small team.

## 2. Phase structure

Twenty-three sprints grouped into four phases. The phase grouping is for progress reporting and stakeholder communication; sprints are the unit of execution.

| Phase | Sprints | Calendar | Outcome |
|---|---|---|---|
| A — Foundation | S0–S2 | ~1 week | Server cleaned, local DB rails laid, streak algorithm tested. No user-visible work. |
| B — Beta surface + visual design | S3–S9 | ~3.5 weeks | Onboarding → log → streak → recover → visual pass. The Mindful Canvas applied. |
| C — Beta completion + ship to testers | S10–S14 | ~2 weeks | Today redesign, reviews migration, supporting habits, reminders, multi-habit Today. TestFlight build shipped. |
| D — Full Core v1 features | S15–S19 | ~2.5 weeks | Graduation, Library, Backlog, Account, Export. |
| E — Polish & ship | S20–S22 | ~1 week | Bug fixes, empty states, analytics, store submission. |

**Total estimate:** ~58 working days ≈ 8–9 calendar weeks for solo dev to "submitted." Add 1–2 weeks for App Store / Play Store review before "live."

**Stage 1 (Private Beta) ships at the close of S14.** Testers get: onboarding → Focus habit → supporting habits → reminders → multi-habit Today → recovery → identity streaks — the complete daily loop. Stage 2 (Full Core v1) covers S15–S22.

**What beta does NOT include (deferred to Stage 2):** graduation ceremony, SRHI, Automatic Library, backlog management, account deletion, data export, weekly reviews, analytics. These features either require weeks of usage data (graduation), aren't reachable in a 2-week beta window (Library), or are polish/compliance (analytics, export, deletion). Shipping them before tester signal would be building in the dark.

## 3. Sprint format

Each sprint below specifies:

- **Goal** — one sentence on what changes for the user (or for the codebase) by the end of the sprint.
- **Deliverables** — concrete artifacts the sprint must produce.
- **Depends on** — sprints that must complete first. If a sprint has no dependency listed, it can start immediately after its predecessor.
- **Done means** — the testable bar that says the sprint is finished.
- **Risks** — known sprint-specific risks where they exist.

Tickets are derived from deliverables. Aim for 3–8 tickets per sprint.

---

## 4. Phase A — Foundation (DONE)

### Sprint 0 — Server schema + dependency install ✅

**Goal.** Clean the server slate and install the new platform dependencies so Phase A can begin without infrastructure surprises.

**Deliverables.**
- Supabase migration: `DROP TABLE IF EXISTS weekly_reviews; DROP TABLE IF EXISTS habit_logs; DROP TABLE IF EXISTS habits;`
- Supabase migration creating `profiles` and `trial_entitlements` per `tech-handoff-core-v1.md` §3.1 and §3.2
- `expo-sqlite` installed and added to `package.json`
- `expo-notifications` installed and added to `package.json`
- App still builds and runs (existing screens may break against missing tables — that is expected and resolved in S1–S2)

**Depends on.** Nothing.

**Done means.** Migrations applied to dev Supabase project. New deps in lockfile. App compiles. Existing tests against Supabase habit tables may fail loudly — acceptable and expected.

---

### Sprint 1 — Local DB rails ✅

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

---

### Sprint 2 — Habit API rewrite + forgiving streak ✅

**Goal.** Move all habit reads/writes off Supabase onto the new repositories, and replace the strict streak rule with the forgiving streak (including the skipped-day edge case). The app still looks the same; the engine underneath is new.

**Deliverables.**
- `src/features/habits/api.ts` rewritten to call repository functions (no direct SQL)
- `src/features/habits/validators.ts` updated for new fields and 3-active cap
- `src/features/today/progress.ts` rewritten for forgiving streak per requirements §8
- Unit and integration tests for streak logic and habit CRUD

**Depends on.** S1.

**Done means.** All unit + integration tests green. Existing screens still render and work, now reading from SQLite. The displayed streak number reflects forgiving logic.

---

## 5. Phase B — Beta surface + visual design (DONE)

### Sprint 3 — Onboarding screens 1–3 ✅

**Goal.** First half of the becoming-bridge — the user can move from welcome through stating who they want to become and what that person does daily.

**Depends on.** S2.

**Done means.** A new user can sign in, see Welcome, advance through Becoming and Daily Action, and if they kill the app and reopen, they resume on the screen they left with their entered text intact.

---

### Sprint 4 — Onboarding screens 4–6 + confirmation ✅

**Goal.** Second half of the becoming-bridge — shrink, cue, worst-day check, confirmation, and a real Focus habit written to the local DB.

**Depends on.** S3.

**Done means.** A new user can complete the full onboarding flow. After confirmation, exactly one Focus habit exists in `local_habits`. The app routes to Today with that habit visible. Onboarding never appears again for this user.

---

### Sprint 5 — Today redesign + heatmap + identity streak ✅

**Goal.** The user lands on a Today screen that emphasizes the Focus habit, shows their identity-flavored streak, and a 30-day heatmap.

**Depends on.** S4.

**Done means.** Post-onboarding lands on a Today screen showing the new Focus habit with identity-flavored copy and a heatmap. Logging Done updates the streak and lights up today's cell within one second.

---

### Sprint 6 — Habit detail + 48-hour retro logging ✅

**Goal.** The user can open a habit's detail view, see its full history, and retroactively log within the 48-hour window.

**Depends on.** S5.

**Done means.** From the heatmap on Today or Detail, the user can correct yesterday's missed log within the window. After 48 hours, that day visibly locks.

---

### Sprint 7 — Recovery flow + single-miss copy ✅

**Goal.** A streak break feels like a product moment, not a punishment. Single misses get gentle reframing; double misses open the recovery modal.

**Depends on.** S6.

**Done means.** Hand-craft a sequence ending in two consecutive misses; relaunch app; modal appears. Pick "Make it smaller" and the edit screen opens with the current habit loaded.

---

### Sprint 8 — Trial validation + basic Settings + Bug #2 ✅

**Goal.** Trial entitlement validates against the server with a 7-day offline grace period. Basic Settings exist. The dual-suggestion display bug is fixed.

**Depends on.** S7.

**Done means.** Manually advance device clock to simulate 8-day offline; app enters read-only mode. Restore network and re-launch; full access returns. Bug #2 verified fixed in recommendation flow.

---

### Sprint 9 — Visual design implementation ✅

**Goal.** Beta testers' first impression matches the brand voice. The app reads as a finished, distinctive product on first launch — not a polished prototype.

**Deliverables.** The Mindful Canvas visual language applied: sage palette rebrand, Plus Jakarta Sans + Manrope fonts, new atoms (TertiaryButton, ZenCard, Eyebrow, RowLV, MissBanner, NullableBooleanField), existing atoms re-skinned, auth + onboarding + settings + habit management screens re-skinned. App renamed to Habitapp. Onboarding copy + UX redesign implemented (S9b): breadcrumb progress bars, two-phase personalize/worst-day screen, Lucide icon picker, disabled→active button pattern. Today screen redesign locked (S9c): identity-anchored card, habits-as-rows, goal-level metrics. 472 passing tests.

**Depends on.** S8 closed. Design direction document locked.

**Done means.** All week-1 surfaces match the design direction document. Theme tokens stable. Functional test suite green.

---

## 6. Phase C — Beta completion + ship to testers

Phase C implements the features needed for a complete beta daily loop, then ships to testers. The thesis being tested: *does the becoming-bridge work for real people when they can create supporting habits, get reminded, and see their full habit system on Today?*

**Why this sequence:** Graduation and Library require 60+ days of data — no tester will reach them in 2 weeks. Backlog is a nice-to-have that doesn't affect the core loop. Account deletion and data export are compliance features, not beta-signal features. Weekly Reviews are deferred (OPEN #2 locked: option a — don't ship, don't link) because the Supabase table is dropped and reviews migration is not worth the cost before we know the beta thesis holds.

### Sprint 10 — Today screen implementation + beta build prep

**Goal.** Implement the S9c Today screen redesign (identity-anchored card with habits-as-rows) and prepare the app for beta distribution. The most important screen in the app gets its final form.

**Deliverables.**
- Today screen rebuilt per S9c design decisions:
  - Identity (goal) as card anchor: headline = becoming phrase (the transformation)
  - Habits rendered as actionable rows inside the card: check circle + Lucide SVG icon + habit name + chevron
  - Tap circle = Done. Tap row = detail screen.
  - Done state: filled gradient circle + strikethrough + reduced opacity
  - Pending state: empty circle with sage border
  - Goal-level metrics on card: consistency % + streak count (sage, quiet)
  - Per-habit metrics live on detail screen only
  - No heatmap on Today card (moved to detail view only)
  - Screen header: logo (top-left) + date (top-right), "Today" headline (Plus Jakarta 800, 28px) + one muted subline
- MissBanner atom wired into Today (replacing inline miss banner styling) — uses the `<MissBanner>` component from S9
- Lucide icon rendering in habit rows using `lucide-react-native` with icon name stored in `local_habits`
- `habit_icon` column added to `local_habits` if not already present (migration)
- Icon selection wired into Create Habit and Edit Habit (the LucideIconPicker from S9b onboarding reused)
- Internal QA pass against requirements §24.1–§24.6, §24.12
- Bug fixes from internal QA
- TestFlight build (iOS) and Internal Testing track build (Android) preparation
- Tester invitation list finalized (target 25–50, psychographic match)
- Feedback channel set up (form, email, or Discord)
- Welcome message for testers explaining what the beta is and isn't

**Depends on.** S9.

**Done means.** Today screen renders the identity-anchored card with habit rows. A user with one Focus habit sees the full card with goal metrics, Lucide icon, Done/Skip interaction. Logging Done fills the circle and strikes through the habit name. The app builds for TestFlight. Internal QA pass complete.

**Risks.**
- The Today screen is the highest-visibility surface. Get the interaction right (circle tap vs row tap) before polishing visuals.
- TestFlight provisioning may take 24+ hours on first submission.
- This sprint is larger than typical (3–5 days). Acceptable because it combines the load-bearing screen rebuild with build logistics. Splitting would create a sprint gap where the most important screen is half-finished.

**Estimate.** 3–5 days.

---

### Sprint 11 — Reviews migration to local SQLite

**Goal.** Weekly reviews data moves from the (dropped) Supabase table to local SQLite, silencing console noise and unblocking Bug #2's inert fix.

**Deliverables.**
- `src/lib/db/migrations/00X_reviews.sql` — adds `local_weekly_reviews` table
- `src/lib/db/repositories/reviews.ts` — CRUD for weekly reviews against local SQLite
- `src/features/reviews/api.ts` rewritten to use local repository instead of Supabase queries
- Dead code cleanup:
  - Remove `latestReviewQueries` block from `useTodayHabits` (no consumer post-S5; now no data source either)
  - Remove the Supabase `weekly_reviews` query path entirely
  - Verify console noise is silenced
- Bug #2 UX validation: with reviews now backed by real local data, verify the dual-suggestion-card layout in HabitDetailScreen works with actual review data (not just mocked). If layout or copy needs adjustment, fix in this sprint.
- Weekly Review screen: **not shipped in beta** (OPEN #2 locked: option a). Remove or gate the nav entry point so testers cannot reach it. The data layer exists; the UI is deferred to post-beta.
- Tests:
  - Repository CRUD for local weekly reviews
  - Bug #2 dual-card rendering with real review data
  - Verify no Supabase `weekly_reviews` references remain outside of migration history

**Depends on.** S10.

**Done means.** `features/reviews/api.ts` reads/writes local SQLite. Console noise from dropped Supabase table is gone. Bug #2 dual-card layout verified with real data. Weekly Review screen is unreachable from the app.

**Risks.** Low. The data model for reviews is simple. The main risk is discovering that Bug #2's fix needs more work once real data flows — budget time for that.

**Estimate.** 2–3 days.

---

### Sprint 12 — Supporting habit creation

**Goal.** Users can add up to 2 Supporting habits alongside their Focus, with the 3-active cap enforced.

**Deliverables.**
- Post-onboarding habit creation flow updated (`CreateHabitScreen`):
  - Habit state auto-determined by available slots: if Focus slot empty → Focus; if Focus filled → Supporting
  - Worst-day gate **as hard block** for Supporting (per requirements §3.5) — reuses the two-phase personalize/worst-day pattern from onboarding
  - Worst-day gate **as guidance only** for post-onboarding Focus
  - Lucide icon picker integrated (reused from onboarding `LucideIconPicker`)
- 3-active cap enforcement:
  - Counts `status='active'` AND `habit_state IN ('focus','supporting')`
  - On 4th active habit attempt: show a clear message that the cap is reached, suggest archiving an existing habit first (Backlog UI deferred to post-beta — no "save to backlog" option yet)
- Supporting log behavior: Done/Skip only; Missed auto-applied at day end like Focus
- Tests:
  - 3-active cap blocks 4th creation
  - Supporting worst-day "no" answer blocks creation
  - Focus worst-day "no" allows creation with gentle note
  - Creating a Supporting habit correctly sets `habit_state='supporting'`

**Depends on.** S11 (reviews migration cleans up dead code paths that could interfere with habit creation flow).

**Done means.** User has 1 Focus + 2 Supporting habits. 4th attempt is blocked with a helpful message. Supporting habits appear in the habit list. Creating a Supporting habit walks through the full personalize + worst-day flow.

**Risks.** Without Backlog UI, the cap-exceeded experience is blunt ("you're at the limit"). That's acceptable for beta — testers with 3 habits are engaged users and can archive one if they want a new one. Backlog's graceful handling comes in S17.

**Estimate.** 2–3 days.

---

### Sprint 13 — Reminders

**Goal.** Users can set reminders per habit and receive local notifications. Foundation + UI in one sprint since they're tightly coupled.

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
- `src/features/reminders/copy.ts` — approved copy templates per requirements §14.4 (no streak-loss language allowed)
- Soft pre-prompt screen before iOS system notification permission dialog — explains why, calm tone
- Reminder settings accessible from Habit Detail:
  - Reminder type: None (default) / Backup / Daily
  - Time picker (HH:mm in device local time)
  - Save persists to `local_reminder_settings` and schedules notification
- Notification action buttons:
  - Snooze 1 hour → reschedules
  - Disable for today → suppresses until next day
- Frequency cap: one notification per habit per day maximum
- Tests:
  - Backup reminder skips firing if today is already logged
  - Daily reminder fires regardless of log status
  - Snooze rescheduling
  - Archive cancels reminder

**Depends on.** S12 (supporting habits exist and can have reminders set).

**Done means.** From a habit detail screen, enable backup reminder at a specific time. When the time arrives and the habit isn't logged, notification fires with approved copy. Snooze works. Archiving the habit cancels the reminder.

**Risks.**
- iOS notification permission first-prompt UX — the soft pre-prompt is critical. First system prompt is the only chance.
- `expo-notifications` behavior differences between iOS and Android — test on both.
- Combining foundation + UI into one sprint is tight but acceptable because the UI is simple (one settings screen per habit, not a complex management surface).

**Estimate.** 3–4 days.

---

### Sprint 14 — Multi-habit Today

**Goal.** The Today screen renders 1 Focus + up to 2 Supporting habits inside the identity-anchored card. The complete daily loop is visible on one screen.

**Deliverables.**
- Today screen updated to render multiple habits:
  - Focus habit row: gradient check circle + strong shadow on Done/Skip buttons + identity streak below card
  - Supporting habit rows: white check circle + subtle shadow on Done/Skip buttons
  - All habits grouped inside the single identity-anchored card
  - Visual distinction between Focus and Supporting via button weight only (per S9c decision — no eyebrow labels on Today)
- Done/Skip interaction works independently per habit row
- Habit ordering: Focus always first, Supporting below in creation order
- Card metrics update to reflect all active habits (consistency % is Focus-only; streak count is Focus-only — Supporting habits don't show streak on Today per requirements §18)
- Empty-state transitions: archiving last habit shows empty state; creating first habit shows populated state — no reload required
- MissBanner triggers for Focus habit only (Supporting misses are quiet)
- Tests:
  - Render 1 Focus + 2 Supporting correctly
  - Done on Supporting doesn't affect Focus streak display
  - Archiving middle habit re-renders correctly
  - Focus-only miss banner logic

**Depends on.** S12 (supporting habits must exist to render them on Today).

**Done means.** A user with 1 Focus + 2 Supporting habits sees all three as rows inside the identity card on Today. Each can be logged independently. Focus has gradient treatment; Supporting has subtle treatment. The screen feels like one coherent view of "today's practice."

**Risks.**
- The identity card was designed for single-habit in S9c. Adding 2 more rows changes the card's height and visual balance. May need spacing/padding adjustments.
- Performance with 3 habit rows + goal metrics + header — should be fine, but verify scroll behavior if the card exceeds screen height.

**Estimate.** 2–3 days.

---

### Ship to testers (after S14)

**What testers get:**
- Full onboarding (becoming-bridge, 7 screens with personalize/worst-day, Lucide icon picker)
- Today screen with identity-anchored card, 1 Focus + up to 2 Supporting habits as rows
- Habit detail with 90-day heatmap, identity streak, consistency %, retro-log within 48h
- Create/edit habits with Lucide icons, worst-day gate
- Recovery flow (single-miss reframing, double-miss modal)
- Local reminders (backup + daily, per-habit time picker, snooze)
- Trial validation with 7-day offline grace
- Settings (account, archived habits, about)
- The Mindful Canvas visual language throughout

**What testers do NOT get (and the welcome message says so):**
- No graduation / SRHI ceremony (requires 60+ days of data)
- No Automatic Library (depends on graduation)
- No backlog management (cap-exceeded says "archive one first")
- No weekly reviews (data layer exists; UI deferred)
- No account deletion or data export (compliance features for store launch)
- No AI features (gated off)

---

## 7. Phase D — Full Core v1 features

Phase D builds on beta learnings. Sprint contents stay as planned unless beta feedback materially shifts priorities — in which case **the plan changes**, not the sprint sizes.

### Sprint 15 — SRHI repo + eligibility check

**Goal.** The data and logic layer for graduation, ahead of the UI.

**Deliverables.**
- `src/lib/db/migrations/00X_srhi.sql` — adds `local_srhi_responses` table per tech handoff §4.3
- `src/lib/db/repositories/srhi.ts`
- `src/features/graduation/eligibility.ts`:
  - Returns `{ eligible: boolean, daysTracked: number, consistency: number }`
  - Eligible when `daysTracked >= 60 && consistency >= 0.75`
  - `consistency` calculated from logs over last 30 days, skipped excluded
- Unit tests: 59d/80%, 60d/74%, 60d/75%, 90d/80% with skipped days

**Depends on.** S14 closed (beta in flight).

**Done means.** Calling `checkEligibility(habitId)` returns correct results across 8+ test fixtures.

---

### Sprint 16 — Graduation ceremony

**Goal.** The user can complete the SRHI ceremony and graduate a Focus habit to Automatic.

**Deliverables.**
- Eligibility check runs on app open
- `SrhiQuestion.tsx` — 1–5 Likert scale renderer
- `GraduationCeremonyScreen` with calm intro, three SRHI-inspired questions
- `NotYetAutomaticScreen` for average < 4.0 (re-eligibility in 14 days)
- Graduation success path: `habit_state` → 'automatic', `automated_at` = now, subtle celebration
- Manual graduation request from Habit Detail menu
- Tests for ≥ 4.0 → graduated and < 4.0 → no change

**Depends on.** S15.

**Done means.** Test habit with crafted logs opens ceremony. All 5s graduates it. All 3s leaves it in Focus.

---

### Sprint 17 — Automatic Library + Backlog

**Goal.** Graduated habits live in the Library tab. Backlog provides a home for deferred habit ideas.

**Deliverables.**
- Library tab activated in bottom navigation (Today / Library / Settings)
- `LibraryScreen`: list of `habit_state='automatic'` habits, sort options, empty state
- `LibraryCard`: habit name, identity, graduation date, lifetime days, consistency
- `LibraryHabitDetailScreen`: full card + "Promote back to Focus" (slot-permitting)
- Promote-back logic preserves log history, resets 60-day clock
- Backlog management surface in Settings → Habit Management:
  - `BacklogList` component
  - Promote from backlog to Focus or Supporting (with worst-day gate for Supporting)
  - "Save to backlog" wired into cap-exceeded flow from S12
- Tests for Library promote-back and Backlog promote/delete flows

**Depends on.** S16.

**Done means.** Graduate a test habit → see it in Library. Promote back → appears on Today. Create a 4th habit → "save to backlog" option appears. Promote from backlog when slot opens.

---

### Sprint 18 — Data export

**Goal.** Users can export everything they've put in the app, all locally, no server roundtrip.

**Deliverables.**
- `src/features/account/` module scaffolded (export + delete in S19)
- Export: read all `local_*` tables, serialize to JSON with version + schema metadata, save via share sheet
- Settings → Privacy → Export My Data button
- Tests: round-trip export → parse → verify; no server upload during export

**Depends on.** S17.

**Done means.** From Settings, tap Export My Data → save to device → open the JSON → confirm structure matches local DB.

---

### Sprint 19 — Account deletion

**Goal.** Users can permanently delete their account: server data and local data both wiped.

**Deliverables.**
- `DeleteAccountScreen` — two-step confirmation
- Server-side: confirmation email, delete `trial_entitlements`, delete `profiles`, delete auth user (likely via Supabase Edge Function with service role)
- Local-side: wipe all `local_*` tables, clear AsyncStorage, cancel notifications
- Sign out + return to Welcome
- Tests: server failure doesn't orphan local data; successful delete clears everything

**Depends on.** S18.

**Done means.** Test account: create data, request deletion, confirm. Email arrives. Server records gone. App on Welcome with empty state.

**Risks.** `auth.admin.deleteUser` requires service role — plan a Supabase Edge Function `delete-account`.

---

## 8. Phase E — Polish & ship

### Sprint 20 — Bug #3 + empty states + privacy/terms

**Goal.** Clean up the rough edges before submission.

**Deliverables.**
- Bug #3 fix: replace preferred time free-text with time picker component in habit creation/edit
- Empty-state copy review across all surfaces (Today, Library, Backlog, Heatmap, Habit history)
- Privacy policy + Terms of service hosted and linked in Settings
- Acknowledgments page (open-source attributions)

**Depends on.** S19.

**Done means.** Every empty state shows calm, hopeful copy. Privacy + Terms links open real documents. Time picker replaces text in habit creation.

---

### Sprint 21 — Anonymous analytics instrumentation

**Goal.** Lightweight event analytics for product-improvement signal, with strict allowlist.

**Deliverables.**
- `src/services/analytics` thin wrapper with allowlist enforcement and payload validation
- Event instrumentation across the app (requirements §23.1 events only)
- Settings → Privacy → Anonymous analytics toggle (on by default)
- Test: payload with free-text field is stripped/rejected

**Depends on.** S20.

**Done means.** All events from §23.1 fire. No free-text ever appears in transmitted payloads.

---

### Sprint 22 — Store submission

**Goal.** App submitted to App Store and Play Store.

**Deliverables.**
- App Store + Play Store assets (icons, screenshots, privacy labels, marketing copy)
- Privacy disclosures reflecting local-first posture
- Final QA pass on production builds
- Submit

**Depends on.** S21.

**Done means.** Submission accepted into review on both stores.

**Risks.** First-time App Store review can take 1–2 weeks. The estimate is to "submitted," not "live."

---

## 9. Cross-cutting concerns

### 9.1 Testing rhythm

- **Unit tests** ride with each sprint that introduces logic. No "test sprint" at the end.
- **Integration tests** introduced in S2 and added each time a new repository or DB-touching feature lands.
- **Screen tests** introduced in S5 (Today), S7 (Recovery), S16 (Graduation).
- **Manual QA passes** at S10 (pre-beta, internal), S14 (pre-tester-ship), and S22 (pre-submission). Each pass walks the acceptance criteria in `core-v1-requirements.md` §24.

### 9.2 Beta tester recruitment timeline

Tester recruitment is product work that runs in parallel with engineering:

- **By S6:** define invitation criteria (psychographic match per strategy doc §3) and draft the invitation message ✅
- **By S7:** identify 50–75 candidate testers ✅
- **By S8:** send save-the-date and feedback-channel invite ✅
- **S14 close:** send TestFlight / Internal Testing invites

### 9.3 Store provisioning

- **By S5:** App Store Connect and Play Console accounts created and verified ✅
- **By S7:** TestFlight Internal Testing group provisioned ✅
- **S10:** First internal TestFlight build uploaded (for internal QA, not testers)
- **S14:** Beta TestFlight build shipped to testers
- **S22:** Production submission

### 9.4 What changes if beta reveals a problem

If Private Beta surfaces issues that change the product (becoming-bridge fails, retention is poor, copy is wrong), Phase D re-plans before starting. The sprint structure absorbs change well; the phase boundaries are the natural replan checkpoints.

If Private Beta surfaces issues that don't change the product (bugs, polish gaps), they slot into Phase E's S20 or earlier — don't let them invade S15–S19 feature work.

### 9.5 Branching convention

Every sprint runs on its own integration branch off `main`. Per-ticket work branches off the sprint branch and PRs back into it. The sprint branch only merges to `main` when the sprint's Definition of Done is met.

The flow:

1. **Sprint kickoff.** First action of the sprint — cut `sprint-N` off the current `main`:

   ```bash
   git checkout main && git pull
   git checkout -b sprint-N
   git push -u origin sprint-N
   ```

2. **Ticket work.** Each ticket branches off `sprint-N` and PRs back into it. The branch suggestion on each ticket (e.g. `s2/types-migration`) is a ticket branch, not a sprint branch.

   ```bash
   git checkout sprint-N && git pull
   git checkout -b sN/short-slug
   # ... do the work ...
   # Open PR: sN/short-slug → sprint-N
   ```

3. **Sprint close.** When all tickets are merged into `sprint-N` and the Definition of Done is met, open one PR `sprint-N` → `main`. After review, merge.

Why this rather than ticket PRs straight to `main`:
- `main` stays demo-ready throughout a sprint.
- The sprint can be evaluated cumulatively before it touches `main`. This matters most for high-risk sprints (S2 engine swap, S7 recovery flow, S13 reminders).
- If a sprint reveals a thesis problem and needs replan, the sprint branch can be paused or unwound without disturbing `main`.

Per-ticket PRs stay small and reviewable — they just target the sprint branch instead of `main`.

**Historical note.** S0 and S1 predate this convention and went straight to `main`. No rework needed; the convention applies from S2 forward.

## 10. Locked decisions log

Decisions that were OPEN in `design-direction.md` and have been resolved:

| Decision | Resolution | Date | Sprint impact |
|---|---|---|---|
| OPEN #1 — Multi-habit Today | Identity-anchored card with habits-as-rows (S9c design) | May 2, 2026 | S10 implements, S14 extends to multi-habit |
| OPEN #2 — Weekly Review in beta | Option (a): defer entirely. Don't ship UI, don't link to it. Data layer migrates in S11 but screen is gated. | May 3, 2026 | S11 migrates data; screen unreachable until post-beta decision |

Still open: OPEN #3 (Backlog UI — deferred to S17), OPEN #4 (retro-log affordance — deferred), OPEN #5 (ReadOnlyBanner styling — deferred), OPEN #6 (logo asset — blocks S22 app icon).

## 11. Risks register

| # | Risk | Affects | Mitigation |
|---|---|---|---|
| 1 | SQLite migration ordering on cold launch | S1 onward | Block render until migrations complete; idempotent runner ✅ |
| 2 | Forgiving streak skipped-day rule edge cases | S2 | Write tests before implementation ✅ |
| 3 | Identity-noun extraction misses real phrasing | S5 | Clear fallback copy; log misses for post-launch tuning ✅ |
| 4 | Day-boundary / time-zone bugs in retro logging | S6 | Anchor to device-local-day; test near midnight ✅ |
| 5 | Recovery modal triggers repeatedly | S7 | Track "last shown for break ending date X" in preferences ✅ |
| 6 | iOS notification permission first-prompt UX | S13 | Soft pre-prompt screen explaining why, before system prompt |
| 7 | Server-side `deleteUser` requires admin role | S19 | Plan a Supabase Edge Function with service role for deletion |
| 8 | Free-text leak in anonymous analytics | S21 | Allowlist + payload validation + code review every call site |
| 9 | App Store review delay | S22 | Submit with 1–2 weeks of launch buffer; have rollback plan |
| 10 | Beta tester recruitment slow | S14 | Start in S6; over-recruit by 50% |
| 11 | S10 Today redesign is load-bearing + large | S10 | Budget 3–5 days; get interaction model right before polishing visuals |
| 12 | S13 reminders combines foundation + UI | S13 | UI is simple (one settings screen per habit); test on both iOS + Android |

## 12. Status tracking convention

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

### Sprint status

| Sprint | Status | Notes |
|---|---|---|
| S0 | Done | Server schema cleaned |
| S1 | Done | Local DB rails |
| S2 | Done | Habit API + forgiving streak |
| S3 | Done | Onboarding 1–3 |
| S4 | Done | Onboarding 4–6 + confirmation |
| S5 | Done | Today + heatmap + identity streak |
| S6 | Done | Habit detail + retro logging |
| S7 | Done | Recovery flow + single-miss |
| S8 | Done | Trial validation + Settings + Bug #2 |
| S9 | Done | Visual design (The Mindful Canvas) + S9b onboarding redesign + S9c Today design |
| S10 | Planned | Today implementation + beta build prep |
| S11 | Planned | Reviews migration |
| S12 | Planned | Supporting habit creation |
| S13 | Planned | Reminders |
| S14 | Planned | Multi-habit Today → **SHIP TO TESTERS** |
| S15 | Planned | SRHI repo + eligibility |
| S16 | Planned | Graduation ceremony |
| S17 | Planned | Library + Backlog |
| S18 | Planned | Data export |
| S19 | Planned | Account deletion |
| S20 | Planned | Bug #3 + empty states + privacy/terms |
| S21 | Planned | Analytics |
| S22 | Planned | Store submission |

---

*End of sprint plan. Living document — update when sequencing or scope shifts.*
