# Sprint 14 — Weekly Review ungating + Beta QA + ship to testers

> **Status:** Planned
> **Estimate:** 3–4 days
> **Depends on:** S13 (active days, Habit Detail redesign, reminders)
> **Branch:** `sprint-14`

## Sprint goal

Ungate weekly reviews with a visual pass and 7-day age gate, run systematic QA against every beta surface, fix what's broken, and ship to testers.

## Scope change from original S14

Original S14 was "pure ship logistics" (1–2 days). This version adds:

- **Weekly review ungating:** route swap, 7-day minimum age gate on `isWeeklyReviewDue()`, visual reskin to Mindful Canvas design system, entry point on Habit Detail, due-date tests with simulated weeks
- **Structured beta acceptance checklist:** exhaustive QA plan covering every beta surface, not just a pointer to §24

Sprint estimate grows from 1–2 to 3–4 days. No downstream sprint plan changes.

---

## Tickets

### S14-01: Weekly Review — ungate, age gate, visual pass

**Type:** Feature ungating + UI reskin
**Estimate:** 1–1.5 days
**Branch:** `s14/weekly-review-ungate`

**Context:**
The entire weekly review stack is built: migration 002, repository, API, hooks, `due.ts`, `WeeklyReviewScreen`, and the `habitAdjustmentEngine`. It was gated in S10 (route redirects to habit detail). We're ungating it for beta with two additions: a 7-day minimum habit age before prompting, and a visual pass to bring the screen in line with The Mindful Canvas.

**A. Route swap:**

Replace the redirect in `app/(app)/reviews/[habitId].tsx`:

Current:
```tsx
export default function DeferredWeeklyReviewRoute() {
  // ... redirects to habit detail or today
}
```

Replace with:
```tsx
export { default } from "@/features/reviews/screens/WeeklyReviewScreen";
```

The screen already reads `habitId` from `useLocalSearchParams`, so routing works as-is.

**B. Age gate — `isWeeklyReviewDue()` update:**

Add a 7-day minimum age check to `src/features/reviews/due.ts`. A habit must have existed for at least 7 days before a weekly review is prompted. This prevents the awkward "review your habit on day 3" experience.

```typescript
const MINIMUM_DAYS_BEFORE_REVIEW = 7;

export function isWeeklyReviewDue({
  currentWeekStart,
  habit,
  latestReview,
  todayDate,
}: WeeklyReviewDueInput) {
  if (!habit || habit.status !== "active" || habit.start_date > todayDate) {
    return false;
  }

  // Don't prompt until the habit is at least 7 days old
  const startDate = new Date(habit.start_date);
  const today = new Date(todayDate);
  const daysSinceStart = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceStart < MINIMUM_DAYS_BEFORE_REVIEW) {
    return false;
  }

  return latestReview?.week_start !== currentWeekStart;
}
```

Export `MINIMUM_DAYS_BEFORE_REVIEW` for use in tests.

**C. Entry point on Habit Detail:**

Add a "Weekly Review" card to `HabitDetailScreen.tsx`, positioned between the streak card and the setup card.

The card uses `isWeeklyReviewDue()` to determine its state:
- **Due:** card shows a gentle prompt — "Time for a quick reflection on this habit." with a "Start review" button that navigates to `/(app)/reviews/${habitId}?returnTo=habitDetail`
- **Not due (completed this week):** card shows "Reviewed this week ✓" with the date, plus a muted "Review again" link
- **Not due (habit too young):** card is hidden entirely — no mention of reviews until 7 days

The card pulls data from the existing `useLatestWeeklyReviewQuery(habitId)` and `useCurrentWeeklyReviewQuery(habitId)` hooks.

Card design follows Habit Detail convention:
```
ZenCard
  Eyebrow: "Weekly Review"
  Body text (due prompt or completed status)
  Button or link
```

**D. Visual reskin of `WeeklyReviewScreen.tsx`:**

The current screen was built pre-S9 and doesn't use the design system atoms. Reskin to match The Mindful Canvas:

| Element | Current | Updated |
|---|---|---|
| Container card | `colors.surface` with border | `ZenCard` (no border, ambient shadow) |
| Section labels | Raw `Text` with manual styles | `Eyebrow` component |
| Header title | `fontSize: 28, fontWeight: "800"` | `fontFamily: fontFamilies.displayBold`, `typography.headlineLg` |
| Body text | `color: colors.textMuted, fontSize: 16` | `fontFamily: fontFamilies.body` |
| Boolean toggles | Inline `segmentButton` styles | Restyled to match pill pattern: `radius.pill`, sage fill when selected, no visible border on unselected |
| Save button | `PrimaryButton` | Keep — already matches design system |
| Success card | Green border card | Sage-tinted card (use `colors.primarySoft` background, `colors.primary` text) |
| Suggestion card | Raw surface card | `ZenCard` with `Eyebrow` for "Suggested adjustment" |
| TextField labels | Manual styling | `fontFamily: fontFamilies.bodySemi` |
| Screen background | `colors.bg` | Keep (already correct) |

No structural changes to the form — same fields, same flow, same save logic. Pure visual alignment.

**E. Read-only awareness:**

If the app is in read-only mode (trial expired, offline >7 days), the review screen should be inaccessible. The entry point card on Habit Detail should be hidden when `isReadOnly === true`. If the user navigates directly via deep link while read-only, show a message and back button instead of the form.

**Tests** (`src/features/reviews/__tests__/due.test.ts`):

The tests simulate week boundaries by constructing specific date strings — no clock mocking needed since `isWeeklyReviewDue` takes explicit `todayDate` and `currentWeekStart` parameters.

1. **Habit created today → not due** (day 0 < 7)
2. **Habit created 3 days ago → not due** (day 3 < 7)
3. **Habit created 6 days ago → not due** (day 6 < 7)
4. **Habit created 7 days ago, no review → due** (day 7 = threshold, current week unreviewed)
5. **Habit created 7 days ago, review exists for current week → not due**
6. **Habit created 14 days ago, review exists for last week but not current → due**
7. **Habit created 14 days ago, review exists for current week → not due**
8. **Inactive habit, 10 days old → not due** (status check)
9. **Habit with future start_date → not due**
10. **Habit created 30 days ago, no reviews ever → due** (long gap)

Simulated week scenario (tests 4–7): Use deterministic dates. Example fixture:
- `habit.start_date = '2026-04-20'` (Monday)
- Test "7 days, due": `todayDate = '2026-04-27'`, `currentWeekStart = '2026-04-27'`, `latestReview = null` → `true`
- Test "7 days, reviewed": `todayDate = '2026-04-27'`, `currentWeekStart = '2026-04-27'`, `latestReview = { week_start: '2026-04-27' }` → `false`
- Test "14 days, stale review": `todayDate = '2026-05-04'`, `currentWeekStart = '2026-05-04'`, `latestReview = { week_start: '2026-04-27' }` → `true`

**Done means:** Route serves the real screen. 7-day age gate works. Habit Detail shows the review card when due. Screen matches Mindful Canvas. 10 tests pass. Full suite green.

---

### S14-02: Beta acceptance checklist + systematic QA

**Type:** QA / Validation
**Estimate:** 1 day
**Branch:** `s14/beta-qa`

**Context:**
This is the structured walkthrough of every beta surface. Each section maps to a requirements acceptance criterion scoped to what beta actually ships.

**Checklist — walk each scenario, note pass/fail/fix needed:**

**A. Auth + Session (§24.12 subset)**
- [ ] Fresh sign-up: email + password → lands on onboarding welcome
- [ ] Sign-out from Settings → returns to sign-in
- [ ] Sign-in with existing account → lands on Today (if onboarding complete)
- [ ] Kill app and reopen → session persists, lands on Today

**B. Onboarding (§24.1)**
- [ ] Full flow: welcome → becoming → daily action → shrink → cue → personalize (icon + active days + worst-day) → confirmation
- [ ] Becoming phrase, daily action, cue, tiny action all required — cannot advance without them
- [ ] Worst-day gate is hard block: "Probably not" loops back to shrink
- [ ] Active days picker defaults to all 7, can be changed to weekdays/custom
- [ ] Icon picker works, selected icon persists
- [ ] Kill app mid-onboarding (e.g., on cue screen) → reopen → resumes on cue screen with entered text intact
- [ ] On completion: exactly one habit in DB with correct identity phrase, cue, action, icon, active days
- [ ] Lands on Today with habit visible

**C. Today screen (§24.2 adapted for goal-based model)**
- [ ] GoalContainer renders with identity phrase as header ("Become {phrase}")
- [ ] Habit rows show icon, name, cue subtitle, circle, chevron
- [ ] Tap circle → Done: filled gradient circle, strikethrough, reduced opacity, < 1 second
- [ ] Long-press circle → Skip: haptic feedback, visual state change
- [ ] Tap row → navigates to Habit Detail
- [ ] ConsistencyDonut shows percentage, updates after logging
- [ ] Streak copy shows correct identity-flavored text
- [ ] "You showed up today" text appears when all habits logged
- [ ] Off-day rendering: habit with weekday-only schedule shows dimmed on weekend, "Off day" label, circle not tappable
- [ ] "Add a habit" row visible in GoalContainer → navigates to CreateHabitFlow (Path A)
- [ ] "Start a new goal" row visible → navigates to CreateHabitFlow (Path B)
- [ ] Single-miss banner appears after a miss, dismissible, doesn't reappear

**D. Habit creation — CreateHabitFlow (§24.1 adapted for post-onboarding)**
- [ ] Path A (add to existing goal): skips goal step, starts at daily action with context chip
- [ ] Path B (new goal): starts at goal anchor (identity phrase)
- [ ] Full flow: goal → daily action → build (shrink + cue + active days) → personalize (icon + worst-day gate)
- [ ] Worst-day gate: hard block for all habits created post-onboarding
- [ ] Icon picker works, persists
- [ ] Active days picker works, persists
- [ ] 3-per-goal soft cap warning shown when at/above cap (non-blocking)
- [ ] Saved habit appears on Today immediately

**E. Habit editing — EditHabitScreen**
- [ ] All fields editable: title, cue, tiny action, minimum viable action, preferred time, icon, active days
- [ ] Changes persist after save
- [ ] Editing does not break streak
- [ ] Icon picker works on edit
- [ ] Active days change → streak recalculates, reminder reschedules (if set)

**F. Habit Detail (§24.5 adapted for S13 redesign)**
- [ ] Header: back chevron, goal label, icon + habit name, schedule label, cue
- [ ] 30-day CalendarGrid: correct day alignment, today in correct column
- [ ] Cell states: done (sage fill), missed (surface fill), skipped (amber), off-day (dashed border), today pending (sage ring)
- [ ] Tap cell within 48h window → RetroLogSelector opens
- [ ] Tap cell outside 48h window → shows date/status, no editing
- [ ] Tap off-day cell → no action
- [ ] Calendar counter: "N of M active days" correct
- [ ] Streak card: correct number, identity-flavored copy, gradient circle
- [ ] Weekly Review card: shows "Start review" prompt if due (habit ≥7 days, current week unreviewed), hidden if too young
- [ ] Setup card: identity, formula, active days, preferred time, edit pencil navigates to EditHabitScreen
- [ ] Reminder card: toggle, type/time display, edit/save flow
- [ ] Archive button works, removes from Today, keeps history

**G. Daily logging edge cases (§24.3, §24.4)**
- [ ] Day rollover at midnight (device local time): unlogged habit becomes Missed
- [ ] Retroactive logging: Done/Skip within 48h window works
- [ ] After 48h: day is immutable (selector shows status only)
- [ ] Forgiving streak: single miss sandwiched by Done → streak continues
- [ ] Forgiving streak: two consecutive misses (after skipped-day removal) → streak resets to 0
- [ ] Active-days-aware streak: weekday habit, weekend gap → streak unbroken
- [ ] Consistency: denominator = active days in window, not total days

**H. Recovery flow (§24.6)**
- [ ] Two consecutive misses → next app open → recovery modal appears
- [ ] "Restart as-is" → streak resets, habit continues
- [ ] "Make it smaller" → navigates to edit screen
- [ ] "Pause for now" → habit archived
- [ ] "Just close" → modal dismisses, streak still reset
- [ ] Modal does not trigger on single miss
- [ ] Modal does not trigger repeatedly for same break

**I. Weekly Review (new for S14)**
- [ ] Habit < 7 days old → no review card on detail, not due
- [ ] Habit ≥ 7 days old, current week unreviewed → review card shows "Start review"
- [ ] Tap "Start review" → navigates to WeeklyReviewScreen
- [ ] Form: "What went well?", "What was hard?", trigger worked (yes/no), tiny action too hard (yes/no), adjustment note
- [ ] Both boolean questions required before save
- [ ] Save → success state → adjustment suggestion shown (if applicable) → auto-navigates back
- [ ] Review card on detail now shows "Reviewed this week ✓"
- [ ] Screen matches Mindful Canvas design (ZenCard, Eyebrow, sage palette, correct fonts)
- [ ] Read-only mode → review card hidden

**J. Reminders (§24.9)**
- [ ] Reminder off by default for new habits
- [ ] Enable reminder from Habit Detail → permission pre-prompt (first time only)
- [ ] Backup type: fires if habit not logged at specified time
- [ ] Daily type: fires regardless
- [ ] Reminder only fires on active days
- [ ] Notification copy: no streak-loss language
- [ ] Snooze from notification → fires again in 1 hour
- [ ] Archive habit → reminder cancelled
- [ ] Change active days → reminder rescheduled

**K. Trial validation (§24.12)**
- [ ] Valid trial → full access
- [ ] Advance clock to simulate 8-day offline → read-only mode (no logging, no creating)
- [ ] ReadOnlyBanner appears on Today, Habit Detail, Create, Edit — NOT on Settings, Onboarding
- [ ] Restore network → full access returns
- [ ] Review card hidden in read-only mode

**L. Settings**
- [ ] Account section: email display, sign out
- [ ] Archived habits visible
- [ ] About: app version, support info

**M. Visual consistency (Mindful Canvas)**
- [ ] Sage palette throughout, no stray blues or defaults
- [ ] Plus Jakarta Sans for headlines, Manrope for body
- [ ] ZenCard pattern on all cards (no 1px borders, ambient shadows)
- [ ] No-Line Rule: tonal shifts, no hard borders
- [ ] Signature gradient on primary interactive elements
- [ ] Pill-shaped primary buttons

**Done means:** Every item above marked pass or documented as a known issue with severity. Blocking issues (crash, data loss, broken core loop) must be fixed in S14-03. Non-blocking issues documented in `sprint-14-followups.md` for Phase D.

---

### S14-03: Bug fix budget

**Type:** Reactive fixes
**Estimate:** 0.5–1 day
**Branch:** `s14/bugfixes` (or per-bug branches if isolated)

**Context:**
Reserved time for whatever S14-02 surfaces. No pre-defined scope. This ticket is a time budget, not a deliverable list.

**Rules:**
- **Blocking bugs** (crash, data loss, broken daily loop) → fix before ship. If fix takes >1 day, escalate to a scope decision.
- **Non-blocking bugs** (visual glitch, copy typo, edge case) → document in `sprint-14-followups.md`, fix in Phase D.
- **Design polish** (spacing, opacity, animation timing) → followups unless it undermines the Mindful Canvas impression.

**Done means:** All blocking bugs from S14-02 fixed. Non-blocking issues documented.

---

### S14-04: Beta distribution + tester communications

**Type:** Process / Ship logistics
**Estimate:** 0.5 day
**Branch:** N/A (no code)

**Context:**
The logistics of getting the build to testers and setting expectations.

**A. Build submission:**
- TestFlight build (iOS) submitted to App Store Connect
- Internal Testing track build (Android) uploaded to Google Play Console
- Both builds verified installable on test devices

**B. Tester invitations:**
- Invitations sent to 25–50 testers (psychographic match per strategy doc §3)
- TestFlight invite emails (iOS)
- Internal Testing opt-in link (Android)

**C. Feedback channel:**
- Channel active (form, email, or Discord — whichever was set up earlier)
- Link included in welcome message

**D. Welcome message:**

Sent to all testers. Must cover:

1. **What this is:** "You're testing a habit formation app built around the idea of becoming — not tracking. It helps you turn who you want to be into something small enough to do tomorrow."

2. **What to test:** "Use it daily for at least a week. Create a habit during onboarding, log it each day, and notice how the app responds to your consistency — or your misses. After 7 days, you'll get a weekly review prompt."

3. **What's NOT included (and why):**
   - No graduation ceremony (requires 60+ days of data)
   - No Automatic Library (depends on graduation)
   - No backlog management
   - No account deletion or data export (coming before public launch)
   - No AI features

4. **How to give feedback:** Link to feedback channel. Specific prompts:
   - "Did the onboarding make you feel like you'd actually do this habit?"
   - "After a week, does the app feel calm or nagging?"
   - "What made you skip a day vs. what made you come back?"
   - "Does the weekly review feel useful or premature?"

5. **Known limitations:** Single-device only, no cloud sync, beta may have rough edges.

**Done means:** Builds live on TestFlight and Play Console. Invitations sent. Welcome message delivered. Feedback channel active.

---

## Ticket dependency graph

```
S14-01 (weekly review ungate + visual pass)
  └── S14-02 (beta QA checklist — includes review scenarios)
        └── S14-03 (bug fixes from QA)
              └── S14-04 (build + ship)
```

Recommended execution order: 01 → 02 → 03 → 04

---

## Sprint plan updates needed

When S14 starts, update `sprint-plan.md`:

1. **S14 description** — replace "pure ship logistics" with expanded scope (weekly review ungating + QA + ship)
2. **S14 estimate** — update from 1–2 days to 3–4 days
3. **OPEN #2 status** — update locked decisions log: "Option (a) reversed for beta. Weekly review ungated in S14 with 7-day age gate. Screen reskinned to Mindful Canvas."
4. **"What testers get" section** — add: "Weekly reviews (after 7 days of habit usage, with adjustment suggestions)"
5. **"What testers do NOT get" section** — remove weekly reviews from this list

---

## Impact on the "What testers get" summary

Updated list after S14:

**What testers get:**
- Full onboarding (becoming-bridge, 7 screens with personalize/worst-day, icon picker, active days picker)
- Today screen with identity-anchored card; habits as equal peer rows under the identity goal; off-day rendering
- Habit creation: add multiple habits to a goal, 3-per-goal cap, icon picker, active days picker
- Habit detail with 30-day calendar grid, identity streak, consistency %, retro-log within 48h, off-day awareness
- Create/edit habits with Lucide icons, active days, worst-day gate
- Recovery flow (single-miss reframing, double-miss modal)
- **Weekly reviews (prompted after 7 days, with adjustment suggestions)**
- Local reminders (backup + daily, per-habit time picker, snooze, active-day-aware scheduling)
- Trial validation with 7-day offline grace
- Settings (account, archived habits, about)
- The Mindful Canvas visual language throughout

**What testers do NOT get (and the welcome message says so):**
- No graduation / SRHI ceremony (requires 60+ days of data)
- No Automatic Library (depends on graduation)
- No backlog management (cap-exceeded says "archive one first")
- No account deletion or data export (compliance features for store launch)
- No AI features (gated off)

---

*End of Sprint 14 ticket package.*
