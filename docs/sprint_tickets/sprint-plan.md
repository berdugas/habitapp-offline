# Habits App — Core v1 Sprint Plan

> **Status:** Active sequencing document for Core v1 build.
> **Date:** May 5, 2026 (S15 inserted: Goal Detail + Habit Detail redesign; S16–S23 renumbered; 24 total sprints)
> **Owner:** Tech Lead
> **Companion documents:** `product-strategy.md` (the why), `core-v1-requirements.md` (the what), `tech-handoff-core-v1.md` (the how), `PROJECT_BRAIN.md` (developer reference)

This document sequences Core v1 into small, testable sprints. It does not respecify requirements — when in doubt about scope or behavior, the requirements doc wins. When in doubt about architecture, the tech handoff wins. This document only owns: order, chunking, dependencies, and per-sprint definitions of done.

---

## 1. Sprint planning philosophy

Five rules govern how this plan is shaped. Every deviation from this plan should be tested against these.

**1. Foundations before features.** The local SQLite layer and the forgiving streak algorithm are load-bearing — every later feature depends on them. They get isolated, dedicated sprints before any user-visible work is rebuilt on top.

**2. Each sprint produces something testable.** Either a green test suite, a screen the user can tap through, or a build that runs. A sprint that ends with "in progress" was too big.

**3. Ship the thinnest beta first.** Stage 1 (Private Beta) is the minimum viable becoming-bridge: onboard → log → see streak → recover from a miss → add habits to your goal → get reminded. Anything that doesn't directly test the becoming-bridge thesis gets pushed to Stage 2.

**4. Risky things first, polish last.** Streak math, DB migration, trial validation, recovery flow have unknowns and get earlier sprints. Settings polish, empty states, analytics instrumentation come later.

**5. Sprint length: 2–3 days.** Short enough to course-correct, long enough to finish a real piece of work. Sized for a solo dev or very small team.

## 2. Phase structure

Twenty-four sprints grouped into four phases. The phase grouping is for progress reporting and stakeholder communication; sprints are the unit of execution.

| Phase | Sprints | Calendar | Outcome |
|---|---|---|---|
| A — Foundation | S0–S2 | ~1 week | Server cleaned, local DB rails laid, streak algorithm tested. No user-visible work. |
| B — Beta surface + visual design | S3–S9 | ~3.5 weeks | Onboarding → log → streak → recover → visual pass. The Mindful Canvas applied. |
| C — Beta completion + ship to testers | S10–S14 | ~2.5 weeks | Today redesign (S10, done), reviews cleanup, habit creation + icon picker, reminders, weekly review ungating, beta QA + ship to testers. |
| D — Full Core v1 features | S15–S20 | ~3 weeks | Goal Detail, Habit Detail redesign, Graduation, Library, Backlog, Account, Export. |
| E — Polish & ship | S21–S23 | ~1 week | Bug fixes, empty states, analytics, store submission. |

**Total estimate:** ~61 working days ≈ 8–9 calendar weeks for solo dev to "submitted." Add 1–2 weeks for App Store / Play Store review before "live."

**Stage 1 (Private Beta) ships at the close of S14.** Testers get: onboarding → habit goal setup → add multiple habits → reminders → Today with all habits as peer rows → recovery → identity streaks → weekly reviews (after 7 days) — the complete daily loop. Stage 2 (Full Core v1) covers S15–S23.

**What beta does NOT include (deferred to Stage 2):** graduation ceremony, SRHI, Automatic Library, backlog management, account deletion, data export, analytics. These features either require weeks of usage data (graduation), aren't reachable in a 2-week beta window (Library), or are polish/compliance (analytics, export, deletion). Shipping them before tester signal would be building in the dark.

## 3–6. [Phases A–C unchanged — see previous sections]

---

## 7. Phase D — Full Core v1 features

Phase D builds on beta learnings. Sprint contents stay as planned unless beta feedback materially shifts priorities — in which case **the plan changes**, not the sprint sizes.

### Sprint 15 — Goal Detail screen + Habit Detail redesign ✓ DONE

**Status.** Complete (May 5–6, 2026). Branch: `sprint-15` (merges s15/calendar-grid-v2 → s15/habit-detail-redesign → s15/goal-detail-screen → s15/today-goal-nav).

**Shipped.**
- `CalendarGrid` v2: `startDate` prop (growing grid from habit start), solid off-day borders (`offDayBorder` token), updated legend. `buildGrid` exported for unit testing.
- `ConsistencyDonut`: `size`, `label`, `onPress` props. Label "" hides caption. Used at size=40 in compact metric cards.
- `getFrequencyLabel()` formatter: natural phrasing (Once/Twice a week, Weekdays, Weekends).
- `goalMetrics.ts`: `avgConsistencyRate` + `oldestStreak` extracted from TodayScreen.
- `MiniHeatmapStrip`: 8×8px cells, 30-day max, right-aligned, same color tokens.
- `GoalDetailScreen` + route `app/(app)/goals/[identityPhrase].tsx`: goal headline, streak copy, metric cards (Goal consistency/streak), habit rows with MiniHeatmapStrip + chevron navigation, empty state, ReadOnlyBanner, consistency suppression.
- `useGoalDetail()` hook: reuses `useEligibleHabitsQuery` + `useHabitLogsForHabitsInRange`, no new DB queries.
- `HabitDetailScreen` redesign: formula-first header (goal breadcrumb tappable → GoalDetail), two compact metric cards (Habit consistency/streak), suppression <7 active days, goal breadcrumb with `goalConsistency` route param, gradient streak circle removed.
- `GoalContainer`: `onGoalPress` prop; anchor side + donut both tappable. Label "Goal consistency".
- `TodayScreen`: `onGoalPress` wired with encoded identityPhrase route push.
- 19 new/updated test files; 580 tests green.

**Estimate.** 3–4 days.

---

### Sprint 16 — SRHI repo + eligibility check

**Goal.** The data and logic layer for graduation, ahead of the UI.

**Depends on.** S15.

**Done means.** Calling `checkEligibility(habitId)` returns correct results across 8+ test fixtures.

---

### Sprint 17 — Graduation ceremony

**Goal.** The user can complete the SRHI ceremony and graduate a habit to Automatic.

**Depends on.** S16.

---

### Sprint 18 — Automatic Library + Backlog

**Goal.** Graduated habits live in the Library tab. Backlog provides a home for deferred habit ideas.

**Depends on.** S17.

---

### Sprint 19 — Data export

**Depends on.** S18.

---

### Sprint 20 — Account deletion

**Depends on.** S19.

---

## 8. Phase E — Polish & ship

### Sprint 21 — Bug #3 + empty states + privacy/terms

**Depends on.** S20.

---

### Sprint 22 — Anonymous analytics instrumentation

**Depends on.** S21.

---

### Sprint 23 — Store submission

**Depends on.** S22.

---

## Sprint status

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
| S10 | Done | Today implementation + beta build prep |
| S11 | Done | Reviews cleanup + adjustment validation |
| S12 | Done | Goal-anchored habit creation flow + icon picker |
| S13 | Done | Active days + Habit Detail redesign + Reminders |
| S14 | Done (code) | Weekly Review ungating + Beta QA → **SHIP TO TESTERS** (QA/distribution pending) |
| S15 | Planned | Goal Detail screen + Habit Detail redesign |
| S16 | Planned | SRHI repo + eligibility |
| S17 | Planned | Graduation ceremony |
| S18 | Planned | Library + Backlog |
| S19 | Planned | Data export |
| S20 | Planned | Account deletion |
| S21 | Planned | Bug #3 + empty states + privacy/terms |
| S22 | Planned | Analytics |
| S23 | Planned | Store submission |

---

*End of sprint plan. Living document — update when sequencing or scope shifts.*
