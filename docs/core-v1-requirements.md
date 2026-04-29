# Habits App — Core v1 Product Requirements

> **Status:** Active scope document for Core v1 release.
> **Date:** April 29, 2026
> **Owner:** Product Lead
> **Companion documents:** `product-strategy.md` (the why), `tech-handoff-core-v1.md` (the how)

---

## 1. Scope summary

Core v1 is the first complete non-AI release of the Habits App. It is shipped in two stages:

**Stage 1 — Private Beta (target: 2–3 weeks).** A focused subset of Core v1 delivered to invited testers. Goal: validate the becoming-bridge thesis with real users before completing the full surface.

**Stage 2 — Full Core v1 (target: 5–8 weeks total from start).** The full non-AI product release.

This document defines the full Core v1 surface. The Stage 1 subset is called out in **Section 20**.

The product validates the principles defined in `product-strategy.md`. Every requirement here flows from those principles — if a requirement appears to violate one, that is a defect in the requirement.

## 2. Local-first data and privacy

Core v1 is **local-first**. The user's habit data lives on her device. The server is used only for:

- Authentication (sign-up, sign-in, session)
- Account identity (email, profile)
- Trial start/end and entitlement status
- Future paid entitlement validation
- Account deletion request (server-side)

The server is **not** the source of truth for habit behavior. The following live entirely on the user's device:

- Habits (creation, edits, archive, state, status)
- Habit logs (Done / Skipped / Missed)
- Forgiving streak calculation
- Consistency calculation
- Heatmap data
- 48-hour retroactive logging enforcement
- SRHI graduation responses
- Automatic Library
- Backlog
- Recovery flow state
- Weekly reviews
- Reminder settings and scheduling
- Local user preferences

Habit rules — the 48-hour retroactive window, the forgiving streak rule, the worst-day gate, the 3-active cap — are **product rules enforced locally**, not security rules. If a user manipulates her local data, she is only affecting her own experience. The product respects her autonomy in that domain.

The local data is persisted in a structured local database (the technical handoff specifies SQLite via expo-sqlite). Lightweight preferences and onboarding resume state may use AsyncStorage.

### 2.1 What this means for the user

- **Privacy.** Habit names, identity phrases, cues, logs, and library contents do not leave her device unless she explicitly exports them.
- **Offline-capable.** The app works offline. Sign-in and trial validation require connectivity; daily use does not.
- **Single-device for now.** Core v1 does not sync across devices. If she reinstalls the app or switches phones without a device backup, her local data is gone. Cloud backup is a candidate for a future release.
- **Data is hers.** She can export everything to JSON at any time.

### 2.2 What this means for the server

- The server stores no habit content. No habit names, identity phrases, cues, tiny actions, log statuses, library entries, or SRHI responses are uploaded.
- Optional anonymous analytics events may be transmitted (Section 23), but they never include habit text content.

## 3. Habit architecture

Habits have two orthogonal axes: their **lifecycle state** and their **status**.

### 3.1 Lifecycle state (`habit_state`)

- **Focus** — currently in active formation. Maximum visibility, richest feedback, biggest celebration on graduation.
- **Supporting** — optional companion. Tiny, under ~2 minutes. Rides alongside the Focus habit without depleting self-regulation.
- **Automatic** — confirmed automatic via the SRHI ceremony. Lives in the Automatic Library.

### 3.2 Status (`status`)

- **Active** — the habit is in play (Focus and Supporting habits in active formation; Automatic habits being maintained).
- **Archived** — the habit is set aside. History preserved. Can be reactivated.
- **Backlog** — the habit was created as an idea but is not yet in play. See Section 3.4.

### 3.3 The 3-active cap

The product enforces at most 3 habits with `status = active` and `habit_state` in (`focus`, `supporting`):

- 1 Focus
- Up to 2 Supporting

Attempting to create a 4th active habit gives the user two choices:
- Replace an existing active habit (it gets archived)
- Save the new one to Backlog

This is a **hard cap in Core v1**. The "soft-friction paid override" idea is deferred until monetization is implemented (Section 21).

### 3.4 Backlog

Backlog is where habit ideas are saved for later.

- Backlog habits are not active, not logged, not counted in any streak, and do not appear on Today.
- They are visible in Settings → Habit Management.
- A backlog habit can be promoted to Focus (if the slot is available) or to Supporting (if the slot is available *and* the habit passes the worst-day gate).
- A backlog habit can be deleted at any time.

### 3.5 Worst-day gate

The worst-day gate is a question presented during habit creation:

> If today were your worst day — sick, exhausted, stressed — could you still do this in under two minutes?

**When the gate is a hard block:**
- During onboarding, for the first Focus habit. The user must pass before completing onboarding. If she answers "Probably not," the product loops her back to the shrink step with examples of smaller versions.
- For any Supporting habit, always. Supporting habits are required to be tiny and reliable; failing the gate routes the user to shrink the habit further.

**When the gate is guidance, not a block:**
- For Focus habits created after onboarding, the gate is shown but the user may proceed even if she answers "Probably not." (She has more context than us about her own life.) The product shows a gentle note: *"That's okay. Just know — bigger habits are harder to keep. We'll be here when you need to shrink it."*

## 4. Onboarding (the becoming bridge)

Onboarding is not a tutorial; it is the first delivery of product value. The user comes out of onboarding with one Focus habit she actually believes she can do, anchored to a real cue, sized to her worst day.

### 4.1 Flow

Six screens, no skips:

**Screen 1 — Welcome.** *"This is a tool for becoming. We help you turn who you want to be into something you can do tomorrow morning. Let's start."* One CTA: "Begin."

**Screen 2 — Becoming.** *"Who do you want to become?"* Free text input with examples below: a runner, someone who reads daily, a calmer person, a writer, someone who sleeps well. Captured verbatim. Reflected back throughout the app.

**Screen 3 — Daily action.** *"What does that person do every day?"* Free text. Example placeholders adjust based on common identities.

**Screen 4 — Shrink.** *"That's a great direction. Now let's make it laughably small for tomorrow."* Pre-fills text from screen 3. Below the field, coaching paragraph:

> Habits form through repetition, not intensity. The smaller the action, the more reliable it becomes. Most people start too big and quit. Start absurdly small. You can always do more on the day. The goal is showing up, not achieving.

Three example shrinks shown for inspiration.

**Screen 5 — Cue.** Two-field input:
- "After I [existing routine]"
- "I will [tiny action from Screen 4, prefilled]"

Below: coaching paragraph on why a routine cue beats a clock cue. Example existing routines listed.

**Screen 6 — Worst-day check.** Hard block during onboarding (see Section 3.5):

> If today were your worst day — sick, exhausted, stressed — could you still do this?

- "Yes" → confirmation.
- "No" → loop back to Screen 4 with: *"Let's make it smaller. What would survive a hard day?"*

**Confirmation.** Summary card:
- Your becoming: [identity phrase]
- Your habit: After I [cue], I will [action]
- Starts: today

CTA: "Start showing up."

### 4.2 Onboarding completion

The user lands on the Today screen with her Focus habit ready to log. The first log is celebrated subtly: *"You've shown up once."*

### 4.3 Returning users

Users who have completed onboarding once never see it again. New habits added later go through Sections 3.5 + cue setup, not the full becoming bridge.

### 4.4 Onboarding incomplete state

If the user closes the app mid-onboarding, she resumes on the screen she left. State is persisted locally as fields are completed.

## 5. Today screen

The user's daily home. Calm, focused.

### 5.1 What appears

- The Focus habit card (most prominent)
- Supporting habit cards (smaller, below)
- 30-day heatmap of the Focus habit's recent history
- Today's date, subtle
- Bottom navigation: Today, Library, Settings

### 5.2 Focus habit card content

- Becoming phrase as header: *"Become someone who reads daily"*
- Cue + action: *"After morning coffee, read one page"*
- Forgiving streak in identity-flavored copy: *"You've been a reader for 12 days"*
- One-tap log: Done | Skip
- Subtle indicator if the day is unlogged after a certain time

### 5.3 Supporting habit card content

Smaller. Less prominent. Show:
- Cue + action
- Simple done indicator for today
- One-tap log

No streak number on supporting cards (Section 18). Their value is supportive, not central.

### 5.4 Empty / first-day state

Day 1: card shows the just-created habit, ready for first log. *"Your first day. Start small."*

### 5.5 No habits state

A single CTA inviting the user to start a new Focus habit. No guilt, no nudge.

## 6. Habit creation (post-onboarding)

For users adding habits after onboarding:

- Direct form entry — no becoming bridge.
- Form supports either Focus (if slot available) or Supporting habit.
- Worst-day gate per Section 3.5.
- 3-active hard cap per Section 3.3.

Form fields:
- Identity phrase (free text, optional but encouraged)
- Cue ("After...")
- Tiny action ("I will...")
- Type: Focus / Supporting (auto-determined by available slots; can be set to Backlog if no slot)

## 7. Daily logging

### 7.1 States

A day, with respect to a habit, is one of:
- **Done** — user did it (full or minimum viable version, her call)
- **Skipped** — explicit pause (sick, travel, scheduled rest)
- **Missed** — no log, no skip, day passed

### 7.2 Logging interactions

- Done is one tap on the Focus card.
- Skip is a longer interaction (long-press or secondary button) — slightly higher friction so it's not the default.
- Missed is automatic at end of day if no log occurred.

### 7.3 Retroactive logging

A user can log a day Done or Skipped up to **48 hours** after it occurred. After 48 hours, the day locks.

Enforcement is **local** in the app. UI: from heatmap or history view, tapping a recent unlogged day opens a Done/Skip selector. Past 48 hours, the day shows status without selector.

### 7.4 Editing a log

A user can change a Done or Skipped log within the same 48-hour window. After 48 hours, logs are immutable.

## 8. Streak rules

### 8.1 The forgiving streak

The streak counts consecutive Done days for a habit. It tolerates **one isolated miss** in the chain. It breaks only when **two consecutive misses** occur.

Skipped days are **neutral** — they neither extend nor break the streak.

### 8.2 Streak math

- Done day → streak increments.
- Skipped day → streak count is unchanged (does not increment, does not break).
- Single Missed day with Done days on both sides → streak continues; the missed day is "skipped over" in the count.
- Two consecutive Missed days → streak resets to zero.

### 8.3 Skipped-day edge case

To prevent ambiguity in mixed sequences, a clarifying rule:

**Skipped days are removed from the sequence before evaluating consecutive misses.**

Example: a habit's last 5 days were Done → Missed → Skipped → Missed → Done. After removing the Skipped day, the sequence is Done → Missed → Missed → Done. **Two consecutive misses → streak breaks.**

A skipped day does not "shield" the user from the consequences of consecutive missing. This is a stricter rule but cleaner and more honest.

### 8.4 Display

The streak appears on the Focus habit card as identity-flavored copy:
- 0 days: *"Day one. Start showing up."*
- 1+ days: *"You've been a [identity noun] for [N] days."*
- Recent comeback: optionally *"You showed up [N] times this month, including yesterday's comeback."*

If the becoming phrase doesn't yield an identity noun, fall back to: *"You've shown up [N] days for this habit."*

### 8.5 No "longest streak" counter

The heatmap is the visual record of best runs. We don't show a separate "longest streak" metric.

## 9. Heatmap visualization

### 9.1 Purpose

The heatmap is the user's visible truth about her habit. Calmer and more honest than a streak number.

### 9.2 Default view

A 30-day rolling window on Today (compact). A 90-day extended view in habit detail.

### 9.3 Cell colors

- **Green** — Done
- **Soft tan** — Skipped
- **Empty (background tint)** — Missed
- **Subtle outline** — today (if unlogged)

### 9.4 Interaction

Tapping a cell within the 48-hour window opens the log selector. Tapping a cell outside the window shows the date and status.

## 10. Habit detail view

### 10.1 What it contains

- Full becoming phrase
- Cue and tiny action
- Forgiving streak (identity-framed)
- Extended heatmap (90 days)
- Consistency percentage (Section 10.2)
- Recent log history
- Latest weekly review (if any)
- Latest adjustment suggestion (if any)
- Edit / archive / deactivate controls

### 10.2 Consistency

Secondary metric, shown only in detail. Formula: `Done / (Done + Missed)` over the last 30 days. Skipped days excluded from both numerator and denominator. Display: *"[N]% over the last 30 days."*

### 10.3 Edit habit

The user can change cue, tiny action, or identity phrase. Editing does not break the streak.

### 10.4 Archive / deactivate

The user can archive a habit (status = `archived`, removed from Today, history preserved, can be reactivated). Archiving does not transfer to the Automatic Library.

## 11. Recovery flow

When a habit experiences two consecutive missed days, the streak breaks. This is treated as a **product moment**, not a punishment.

### 11.1 What appears

On the user's next app open after a streak break, a calm modal:

> The habit lost some momentum. That happens to everyone — what matters now is what you do next.
>
> What would you like to do?

Three options:
1. **Restart as-is.** Continue the same habit. Streak resets to 0; history preserved.
2. **Make it smaller.** Edit the tiny action. Streak resets; new (smaller) habit.
3. **Pause for now.** Habit moves to archived (status = `archived`). Can be reactivated.

A quiet fourth option: "Just close" — dismiss the modal without action. The streak reset still applies.

### 11.2 Single-miss handling

A single miss does NOT trigger the recovery modal. Single misses are normal. The next-day Today screen shows light reframing copy:

> Yesterday was a miss. The science says it didn't matter. Keep going.

Appears once, dismissible.

### 11.3 Consecutive-miss prevention

If the system detects a habit on day-2-of-missing (yesterday missed, today incomplete by mid-day), an optional gentle reminder fires (if reminders enabled per Section 14). Supportive, not panicked:

> Small action. Same cue. Today still counts.

Never streak-loss-anxiety copy.

## 12. Graduation ceremony (SRHI-inspired)

### 12.1 Trigger

The graduation prompt opens when both:
- 60 days tracked since habit creation, AND
- ≥75% consistency over the last 30 days

The trigger is checked locally on app open.

### 12.2 The ceremony

A dedicated screen appears. Calm, respectful framing:

> [Habit] has been part of your life for 60 days. It's worth pausing to check whether it has truly become automatic — or whether it still needs your attention.
>
> Three quick questions, inspired by behavioral research.

Three questions, agree/disagree, 5-point scale (1 = strongly disagree, 5 = strongly agree):

1. *"I do this without having to consciously remember."*
2. *"It would feel strange not to do this."*
3. *"I do this automatically."*

Adapted from the Self-Report Habit Index (Verplanken & Orbell, 2003). The product copy refers to them as **research-inspired reflection questions**, not as a clinical assessment.

### 12.3 Outcome

- Average score ≥4.0 → **Graduate.** Celebrate visibly. habit_state changes to `automatic`, `automated_at = now`. Open the next-focus prompt.
- Average score <4.0 → **Not yet.** Calm copy:

> Not automatic yet. That's useful information. We'll keep supporting this habit and check again later.

Habit stays in Focus. Re-triggers in 14 days if conditions still met.

All SRHI responses are stored locally only.

### 12.4 Manual graduation request

Users can request graduation from the habit detail menu, even before auto-trigger. Same ceremony.

### 12.5 Manual demote-from-library

If a graduated habit wobbles (consistency drops below 50% over 30 days), the user can promote it back to Focus from the library. A calm action, not a "failure."

## 13. Automatic Library

The library is one of the product's main features, not an archive.

### 13.1 What the library contains

Each automatic habit, displayed as a card. Card shows:
- Habit name / cue / tiny action
- Identity phrase
- Date moved to Automatic Library (`automated_at`)
- Total days practiced (lifetime)
- Last 30-day consistency leading to graduation
- Original cue and minimum viable version
- Action: "Promote back to Focus"

### 13.2 Continued tracking

Automatic habits continue to be loggable from the Library tab. They do **not** appear on Today — they no longer compete for daily attention. By design.

The user can opt to log an automatic habit from the library if she wants to (one-tap from card). History continues to grow.

### 13.3 Library views

For Core v1:
- **List view (default).** Cards in chronological order of graduation.
- **Sort:** by graduation date, by lifetime days, by identity.

Future versions (out of Core v1 scope, designed-for):
- Yearly view, identity grouping, lifetime calendar.

### 13.4 Library empty state

> Your library will grow as habits become part of who you are. The first one usually takes 60–90 days. Stay with it.

### 13.5 Reactivation

A library habit can be promoted back to a Focus slot when:
- The user manually requests it, or
- The Focus slot is available and the user chooses to promote

Promotion preserves all history. The habit re-enters the daily Today screen. The 60-day formation clock starts fresh on promotion.

## 14. Reminders (optional, gentle)

### 14.1 Default

Reminders are **off by default**. The primary cue is always the user's existing routine. Reminders are a backup.

### 14.2 Local-only implementation

Reminders are implemented as **local notifications** via `expo-notifications`. The app schedules them on-device. **No push tokens are stored on the server. No reminder data leaves the user's device.** Reminders work fully offline.

### 14.3 When the user can enable

In habit settings, the user can enable reminders for any habit. Choices:
- **No reminder** (default)
- **Backup reminder** — fires only if the habit hasn't been logged by a chosen time
- **Daily reminder** — fires at a chosen time regardless of log status

Backup is the recommended option (default selection if reminders are turned on).

### 14.4 Copy rules

Approved patterns:
- *"Small action. Same cue. Keep it easy."*
- *"After [their cue], the next thing is [their action]. Whenever you're ready."*
- *"Today still counts. No pressure."*

Forbidden patterns:
- *"Don't lose your streak!"*
- *"[N] days! Don't break it!"*
- Any urgency, punishment, or loss-aversion language.

### 14.5 Reminder frequency cap

Never more than one reminder per habit per day. Multiple-habit reminders consolidate into one notification.

### 14.6 Snooze and disable

A reminder can be snoozed (1 hour) or disabled (for that day) directly from the notification.

## 15. Settings & account

### 15.1 Account section

- Email (display)
- Sign out
- Delete account (Section 17)
- Export data (Section 17)

### 15.2 Habit management

- List of all active, archived, backlog, and library habits
- Promote backlog → Focus / Supporting (slot-permitting)
- Reactivate archived
- Delete backlog
- Bulk archive

### 15.3 Reminders

- Master toggle (on/off)
- Per-habit reminder settings (Section 14)

### 15.4 Privacy

- Privacy policy link
- Terms of service link
- Data usage explanation
- Anonymous analytics opt-out (Section 23)

### 15.5 About

- App version
- Support email or contact form
- Acknowledgments

## 16. Trial validation

### 16.1 What's validated

The server validates:
- Account identity (email, profile)
- Trial start date (set at sign-up)
- Trial end date (start + 14 days)
- Entitlement status: `trial | active | expired | paid | cancelled`

### 16.2 When validation happens

- At sign-in, every time
- Periodically while the app is in use (e.g., once per app open after the first hour)

### 16.3 Offline behavior

The app caches the most recent valid entitlement locally with a `last_validated_at` timestamp.

If the app cannot reach the server:
- **Within 7 days** of last successful validation → app continues to operate normally (grace period).
- **Beyond 7 days** → app prompts the user to reconnect to validate. If she cannot, the app shows her local data in **read-only mode** (no new logs, no new habits) but does not delete anything. Reconnection restores normal operation.

The 7-day grace period covers real-world disruptions (travel, weak signal, server outages) without allowing indefinite use of a stale or revoked account.

### 16.4 Post-trial behavior

When the trial expires server-side, **for Core v1 the app continues to grant full access** because monetization is out of scope. Trial expiry tracking is in place, but no gating activates until paid tiers ship.

This is a deliberate Core v1 simplification.

## 17. Account deletion & data export

### 17.1 Data export

Available from Settings → Privacy → Export My Data.

- Export is generated **locally on the device**.
- Output: a JSON file containing all habits, logs, SRHI responses, library entries, weekly reviews, reminders, and preferences from the local database.
- Saved via the device's standard share/save sheet.
- **No data is transmitted to the server during export.**

### 17.2 Account deletion

Available from Settings → Account → Delete Account. Two-step confirmation.

The deletion has two parts:
1. **Server-side:** the user's profile, trial entitlement record, and auth account are deleted from Supabase.
2. **Local:** the app wipes the local SQLite database and AsyncStorage on the device.

Confirmation copy:

> Deleting your account will remove your account access and permanently delete the habit data stored on this device. Your library — the record of who you've become — will be gone. This cannot be undone. Are you sure?

Two CTAs: "Yes, delete everything" (destructive) and "Cancel" (primary).

A confirmation email is sent **before** the local wipe, since after the wipe the email is the only artifact remaining.

**Caveat:** if the user has the app installed on a second device that has not synced the deletion (Core v1 has no sync), local data on that other device is **not** automatically deleted. She would need to delete it from that device manually. This limitation is mentioned in the deletion confirmation copy and the privacy policy.

## 18. Supporting habit rules

Supporting habits are intentionally lightweight. They behave differently from Focus habits:

- **Logging:** Done / Skip only. (Missed auto-applied at day end.)
- **Streak:** Tracked internally but not emphasized in UI. No identity-flavored copy.
- **Heatmap:** Simple linear history shown in detail view, not on Today.
- **Graduation:** Supporting habits do not trigger the SRHI ceremony.
- **Promotion to Focus:** A supporting habit can be promoted to Focus (if slot available). The 60-day formation clock starts fresh on promotion.

The Focus habit always remains the central focus of the UI. Supporting habits are present but never compete for attention.

## 19. Brand voice & copy guidance

(See `product-strategy.md` for full voice guidelines.)

For requirements work, three rules:

1. **Identity-flavored framing on key moments.** Streak display, graduation, library labels, recovery copy must use becoming-language, not tracking-language.
2. **Every system message is reviewed against the principles.** No urgency, no FOMO, no loss-aversion, no infantilizing tone.
3. **Empty states matter.** Empty Today, empty Library, empty heatmap — all need calm, hopeful copy that respects the user.

## 20. Private Beta cut (Stage 1, 2–3 weeks)

Subset principles: cut features whose absence does not invalidate the becoming-bridge thesis; keep features that test the thesis directly.

### In scope for Private Beta
- Onboarding (the becoming bridge) — full flow
- One Focus habit
- Daily logging (Done / Skipped / Missed)
- 48-hour retroactive logging
- Forgiving streak with identity-framed copy
- Heatmap (30-day)
- Habit detail view (basic)
- Recovery flow (modal after 2 consecutive misses)
- Single-miss reframing copy
- Settings (basic — sign out, app version)
- Auth + trial validation (server)
- **Local SQLite as source of truth for habit data**

### Deferred from Private Beta to full Core v1
- Supporting habits (validate that 1 Focus alone works first)
- Backlog
- SRHI graduation ceremony (60-day requirement makes it untestable in 2–3 weeks)
- Automatic Library (no graduates in 2–3 weeks)
- Reminders (the local-notification work happens in Sprint 6)
- Account deletion + data export
- Weekly review polish
- Polish for empty / edge states

### Beta is free for invited testers

No paywall, no payment, no tier gating during beta.

## 21. Out of scope for Core v1

- AI features
- Cloud sync / multi-device
- Cloud backup of habit data
- Social or community features
- Achievements, levels, badges
- Habit templates or categories
- Habit suggestions
- Pattern insights
- Email verification flow (basic auth only)
- **Subscription pricing & paid tiers (deferred — soft-friction override revisits when implemented)**
- Web version
- Wearables integration
- Localization beyond English
- Accountability features
- **Non-daily habits** (habits scheduled weekly, alternate days, etc.) — Core v1 supports daily habits only

## 22. Success metrics for Core v1

Tracked at launch and reviewed monthly post-Core v1.

### Activation
- **% of users who complete onboarding.** Target: 70%+.
- **% of users who create their first Focus habit.** Target: 65%+.
- **% of users whose tiny action was shrunk during onboarding.** Target: 50%+.

### Habit creation quality
- **% of habits with a non-clock-time cue.** Target: 80%+.
- **% of habits passing the worst-day check on first try.**

### Early retention
- **Day 2 active.** Target: 60%+.
- **Day 7 active.** Target: 40%+.
- **Day 30 active.** Target: 25%+.

### Habit formation
- **% of users with ≥70% consistency at Day 30** on Focus habit.
- **Median streak length at Day 30.**

### Recovery
- **% of users who return after a single miss.** Target: 90%+.
- **% of users who use "Make it smaller"** in recovery flow.

### Graduation
- **% of users who reach the 60-day window.**
- **% of those who pass the SRHI ceremony.**
- **% of users who start a new Focus habit within 30 days of graduating one.** Target: 60%+.

### Library value
- **Median library size at 6 months.**
- **% of returning users who view the library at least once per week.**

### Sentiment
Lightweight in-app micro-survey at Day 14 and Day 60: *"How would you describe this app in one word?"*

Goal cluster: *calm, helpful, adult, guilt-free, becoming, honest*. Red flag cluster: *boring, slow, empty, useless*.

## 23. Local analytics

The app may transmit anonymous event analytics for product improvement. **No habit text content is ever transmitted.**

### 23.1 Allowed events

- `onboarding_started`
- `onboarding_step_completed` (with step number)
- `onboarding_completed`
- `habit_created` (with habit_state and status, no text)
- `tiny_action_shrunk`
- `cue_created`
- `worst_day_check_passed` / `worst_day_check_failed`
- `habit_logged_done`
- `habit_logged_skipped`
- `habit_auto_missed`
- `retro_log_created`
- `streak_broken`
- `recovery_modal_shown`
- `recovery_action_selected` (with action: restart | shrink | pause | dismiss)
- `graduation_prompt_shown`
- `srhi_submitted` (with average_score and graduated outcome)
- `habit_graduated`
- `library_viewed`
- `habit_promoted_from_library`
- `data_export_created`
- `account_deletion_requested`
- `trial_started`
- `trial_validated`
- `trial_grace_active`
- `trial_expired`

### 23.2 What is NEVER transmitted

- Habit names
- Identity phrases
- Cue text
- Tiny action text
- Minimum viable action text
- Log notes
- Weekly review free-text answers
- Anything the user typed

### 23.3 Opt-out

Users can disable anonymous analytics in Settings → Privacy.

## 24. Acceptance criteria summary

For each major feature, the build must meet these acceptance criteria before the feature is considered done.

### 24.1 Onboarding
- User cannot complete onboarding without entering a becoming phrase, daily action, cue, and tiny action.
- The shrink step shows the coaching copy and at least 3 example shrinks.
- The worst-day check is a hard block during onboarding; failing returns the user to the shrink step.
- If the user exits mid-onboarding, the app resumes at the last incomplete step on next open.
- On completion, exactly one Focus habit is created in local SQLite with status `active` and habit_state `focus`.
- The user lands on Today with the new Focus habit visible and ready to log.

### 24.2 Today screen
- Shows the Focus habit with identity-flavored streak copy.
- Shows Supporting habits (up to 2) as smaller cards beneath.
- Shows the 30-day heatmap for the Focus habit.
- One-tap Done logging completes in under 1 second.
- Single-miss reframing copy appears once after a miss day, dismissible.

### 24.3 Daily logging
- Done / Skipped logs persist immediately to local SQLite.
- A day not logged by midnight (device local time) becomes Missed automatically.
- Retroactive logging works for Done and Skipped within 48 hours.
- After 48 hours, days are immutable; tapping shows status without log selector.

### 24.4 Forgiving streak
- Streak increments on Done.
- Streak unaffected by Skipped (skipped days are removed from the sequence before evaluating misses).
- Streak unaffected by isolated single Missed (sandwiched by Done).
- Streak resets to 0 on two consecutive Missed days (after Skipped removal).
- Streak display uses identity-flavored copy on Focus; not shown on Supporting.

### 24.5 Heatmap
- 30-day window on Today; 90-day window in detail.
- Green for Done, soft tan for Skipped, empty for Missed, outlined for today.
- Tapping a cell within the 48-hour window opens log selector.

### 24.6 Recovery flow
- Modal appears on next app open after a 2-consecutive-miss break.
- Three options: Restart as-is, Make it smaller, Pause for now (plus quiet "Just close").
- "Make it smaller" routes to the edit habit screen.
- "Pause for now" archives the habit (status = `archived`).

### 24.7 Graduation ceremony
- Eligibility check runs locally on app open.
- Eligibility = 60+ days tracked AND ≥75% consistency over the last 30 days.
- Ceremony screen presents 3 SRHI-inspired questions on a 1–5 scale.
- Average ≥4.0 → habit_state = `automatic`, `automated_at = now`. Library updates.
- Average <4.0 → habit stays in Focus, ceremony re-triggers in 14 days.
- All SRHI responses persist to `local_srhi_responses` only.

### 24.8 Automatic Library
- Library tab shows all habits with habit_state = `automatic`.
- Each card shows habit name, identity phrase, graduation date, lifetime days, pre-graduation consistency.
- "Promote back to Focus" works if Focus slot is available.
- Empty state copy when library has no habits.

### 24.9 Reminders
- Reminders are off by default for new habits.
- User can enable per habit: backup or daily.
- Reminders use **local notifications via expo-notifications**; no push token is sent to the server.
- Reminder copy follows approved patterns; never streak-loss language.
- Snooze and disable-for-day work from notification.

### 24.10 Data export
- Export generates a JSON file locally containing all user habit data from local SQLite.
- File is shareable via the device's standard share sheet.
- **No data is uploaded to the server during export.**

### 24.11 Account deletion
- Two-step confirmation with honest consequence copy.
- Deletes server account + trial entitlement record + auth.
- Wipes local SQLite + AsyncStorage on the device.
- Sends confirmation email before local wipe.

### 24.12 Trial validation
- Validation occurs at sign-in and periodically while online.
- Local entitlement cache stores `last_validated_at`.
- Offline grace period: 7 days from last successful validation.
- Beyond 7 days offline, app shows local data in read-only mode and prompts to reconnect.

---

*End of requirements. Living document — update as decisions are made or scope shifts.*
