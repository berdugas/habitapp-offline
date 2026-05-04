# S14 Beta Acceptance Checklist

> **Sprint:** S14  
> **Tester:**  
> **Device(s):**  
> **Build:**  
> **Date:**  

Legend: ✅ Pass · ❌ Fail (blocking) · ⚠️ Fail (non-blocking) · ⏭️ Skip (out of scope)

Blocking failures (crash, data loss, broken daily loop) → fix in S14-03 before ship.  
Non-blocking failures → document in `sprint-14-followups.md`.

---

## A. Auth + Session

| # | Scenario | Result | Notes |
|---|---|---|---|
| A1 | Fresh sign-up: email + password → lands on onboarding welcome | | |
| A2 | Sign-out from Settings → returns to sign-in screen | | |
| A3 | Sign-in with existing account (onboarding complete) → lands on Today | | |
| A4 | Kill app and reopen → session persists, lands on Today | | |

---

## B. Onboarding

| # | Scenario | Result | Notes |
|---|---|---|---|
| B1 | Full flow: welcome → becoming → daily action → shrink → cue → personalize → confirmation | | |
| B2 | Becoming phrase, daily action, cue, tiny action all required — cannot advance without them | | |
| B3 | Worst-day gate: "Probably not" loops back to shrink screen | | |
| B4 | Active days picker defaults to all 7, can be changed to weekdays/custom | | |
| B5 | Icon picker works, selected icon persists | | |
| B6 | Kill app mid-onboarding (e.g. on cue screen) → reopen → resumes on cue screen with text intact | | |
| B7 | On completion: exactly one habit in DB with correct identity phrase, cue, action, icon, active days | | |
| B8 | Lands on Today with habit visible | | |

---

## C. Today Screen

| # | Scenario | Result | Notes |
|---|---|---|---|
| C1 | GoalContainer renders with identity phrase as header ("Become {phrase}") | | |
| C2 | Habit rows show icon, name, cue subtitle, circle, chevron | | |
| C3 | Tap circle → Done: filled gradient circle, strikethrough, reduced opacity, < 1 second | | |
| C4 | Long-press circle → Skip: haptic feedback, visual state change | | |
| C5 | Tap row → navigates to Habit Detail | | |
| C6 | ConsistencyDonut shows percentage, updates after logging | | |
| C7 | Streak copy shows correct identity-flavored text | | |
| C8 | "You showed up today" text appears when all habits logged | | |
| C9 | Off-day rendering: weekday habit shows dimmed on weekend, "Off day" label, circle not tappable | | |
| C10 | "Add a habit" row visible in GoalContainer → navigates to CreateHabitFlow (Path A) | | |
| C11 | "Start a new goal" row visible → navigates to CreateHabitFlow (Path B) | | |
| C12 | Single-miss banner appears after a miss, dismissible, doesn't reappear | | |

---

## D. Habit Creation — CreateHabitFlow

| # | Scenario | Result | Notes |
|---|---|---|---|
| D1 | Path A (add to existing goal): skips goal step, starts at daily action with context chip | | |
| D2 | Path B (new goal): starts at goal anchor (identity phrase) | | |
| D3 | Full flow: goal → daily action → build (shrink + cue + active days) → personalize (icon + worst-day) | | |
| D4 | Worst-day gate: hard block for all habits created post-onboarding | | |
| D5 | Icon picker works, persists | | |
| D6 | Active days picker works, persists | | |
| D7 | 3-per-goal soft cap warning shown when at/above cap (non-blocking) | | |
| D8 | Saved habit appears on Today immediately | | |

---

## E. Habit Editing — EditHabitScreen

| # | Scenario | Result | Notes |
|---|---|---|---|
| E1 | All fields editable: title, cue, tiny action, minimum viable action, preferred time, icon, active days | | |
| E2 | Changes persist after save | | |
| E3 | Editing does not break streak | | |
| E4 | Icon picker works on edit | | |
| E5 | Active days change → streak recalculates, reminder reschedules (if set) | | |

---

## F. Habit Detail

| # | Scenario | Result | Notes |
|---|---|---|---|
| F1 | Header: back chevron, goal label, icon + habit name, schedule label, cue | | |
| F2 | 30-day CalendarGrid: correct day alignment, today in correct column | | |
| F3 | Cell states: done (sage fill), missed (surface fill), skipped (amber), off-day (dashed border), today pending (sage ring) | | |
| F4 | Tap cell within 48h window → RetroLogSelector opens | | |
| F5 | Tap cell outside 48h window → shows date/status, no editing | | |
| F6 | Tap off-day cell → no action | | |
| F7 | Calendar counter: "N of M active days" correct | | |
| F8 | Streak card: correct number, identity-flavored copy, gradient circle | | |
| F9 | Weekly Review card: shows "Start review" if due (habit ≥7 days, current week unreviewed), hidden if too young | | |
| F10 | Setup card: identity, formula, active days, preferred time, edit pencil → EditHabitScreen | | |
| F11 | Reminder card: toggle, type/time display, edit/save flow | | |
| F12 | Archive button works, removes from Today, keeps history | | |

---

## G. Daily Logging Edge Cases

| # | Scenario | Result | Notes |
|---|---|---|---|
| G1 | Day rollover at midnight (device local time): unlogged habit becomes Missed | | |
| G2 | Retroactive logging: Done/Skip within 48h window works | | |
| G3 | After 48h: day is immutable (selector shows status only) | | |
| G4 | Forgiving streak: single miss sandwiched by Done → streak continues | | |
| G5 | Forgiving streak: two consecutive misses → streak resets to 0 | | |
| G6 | Active-days-aware streak: weekday habit, weekend gap → streak unbroken | | |
| G7 | Consistency: denominator = active days in window, not total days | | |

---

## H. Recovery Flow

| # | Scenario | Result | Notes |
|---|---|---|---|
| H1 | Two consecutive misses → next app open → recovery modal appears | | |
| H2 | "Restart as-is" → streak resets, habit continues | | |
| H3 | "Make it smaller" → navigates to edit screen | | |
| H4 | "Pause for now" → habit archived | | |
| H5 | "Just close" → modal dismisses, streak still reset | | |
| H6 | Modal does not trigger on single miss | | |
| H7 | Modal does not trigger repeatedly for same break | | |

---

## I. Weekly Review (new for S14)

| # | Scenario | Result | Notes |
|---|---|---|---|
| I1 | Habit < 7 days old → no review card on Habit Detail | | |
| I2 | Habit ≥ 7 days old, current week unreviewed → review card shows "Start review" | | |
| I3 | Tap "Start review" → navigates to WeeklyReviewScreen | | |
| I4 | Form: "What went well?", "What was hard?", trigger worked (yes/no), tiny action too hard (yes/no), adjustment note | | |
| I5 | Both boolean questions required before save | | |
| I6 | Save → success state → adjustment suggestion shown (if applicable) → auto-navigates back | | |
| I7 | Review card on Habit Detail now shows "Reviewed this week ✓" | | |
| I8 | Screen matches Mindful Canvas (ZenCard, sage palette, correct fonts) | | |
| I9 | Read-only mode → review card hidden on Habit Detail | | |

---

## J. Reminders

| # | Scenario | Result | Notes |
|---|---|---|---|
| J1 | Reminder off by default for new habits | | |
| J2 | Enable reminder from Habit Detail → permission pre-prompt (first time only) | | |
| J3 | Backup type: fires if habit not logged at specified time | | |
| J4 | Daily type: fires regardless | | |
| J5 | Reminder only fires on active days | | |
| J6 | Notification copy: no streak-loss language | | |
| J7 | Snooze from notification → fires again in 1 hour | | |
| J8 | Archive habit → reminder cancelled | | |
| J9 | Change active days → reminder rescheduled | | |

---

## K. Trial Validation

| # | Scenario | Result | Notes |
|---|---|---|---|
| K1 | Valid trial → full access | | |
| K2 | Simulate 8-day offline → read-only mode (no logging, no creating) | | |
| K3 | ReadOnlyBanner appears on Today, Habit Detail, Create, Edit — NOT on Settings, Onboarding | | |
| K4 | Restore network → full access returns | | |
| K5 | Review card hidden in read-only mode | | |

---

## L. Settings

| # | Scenario | Result | Notes |
|---|---|---|---|
| L1 | Account section: email display, sign out | | |
| L2 | Archived habits visible | | |
| L3 | About: app version, support info | | |

---

## M. Visual Consistency — Mindful Canvas

| # | Scenario | Result | Notes |
|---|---|---|---|
| M1 | Sage palette throughout, no stray blues or defaults | | |
| M2 | Plus Jakarta Sans for headlines, Manrope for body | | |
| M3 | ZenCard pattern on all cards (ambient shadow, no 1px borders) | | |
| M4 | No-Line Rule: tonal shifts, no hard borders | | |
| M5 | Signature gradient on primary interactive elements | | |
| M6 | Pill-shaped primary buttons | | |

---

## QA Summary

| Section | Pass | Fail (blocking) | Fail (non-blocking) | Skipped |
|---|---|---|---|---|
| A. Auth + Session | | | | |
| B. Onboarding | | | | |
| C. Today Screen | | | | |
| D. Habit Creation | | | | |
| E. Habit Editing | | | | |
| F. Habit Detail | | | | |
| G. Logging Edge Cases | | | | |
| H. Recovery Flow | | | | |
| I. Weekly Review | | | | |
| J. Reminders | | | | |
| K. Trial Validation | | | | |
| L. Settings | | | | |
| M. Visual Consistency | | | | |
| **Total** | | | | |

---

**Ship decision:** `[ ] Ready for S14-04` · `[ ] Blocked — fix S14-03 first`
