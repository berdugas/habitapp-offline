# Sprint 11 — Reviews cleanup + adjustment suggestions validation + sprint plan realignment

> **Status:** Planned
> **Depends on:** S10 (merged)
> **Estimate:** 2 days
> **Branch:** `sprint-11` off `main`

---

## Goal

Clean up the reviews subsystem — the data layer already lives in local SQLite (migration 002, shipped in S1), so no migration is needed. What remains is verifying that the adjustment suggestion cards work with real local data (Bug #2's inert fix from S8), adding missing repository test coverage, and realigning the sprint plan to reflect the goal-based model that S10 implemented.

## Context

The original S11 spec ("Reviews migration to local SQLite") was written when we believed `features/reviews/api.ts` still queried the dropped Supabase `weekly_reviews` table. Investigation during S10 review reveals:

1. **Migration 002** already created `local_weekly_reviews` in S1.
2. **`src/lib/db/repositories/weekly_reviews.ts`** already does full CRUD against local SQLite.
3. **`src/features/reviews/api.ts`** already calls the local repository — no Supabase references remain.
4. **`useHabitDetail`** in `hooks.ts` fetches `latestReview` via the local repo and feeds it to `getHabitAdjustmentSuggestions`.
5. **The WeeklyReviewScreen route** is already gated — `app/(app)/reviews/[habitId].tsx` redirects to habit detail or Today.
6. **`latestReviewQueries`** dead code was already removed from `useTodayHabits` during S10.

So the "migration" part of S11 is already done. What's left:

- **Bug #2 UX validation** — The dual-suggestion-card layout in HabitDetailScreen has never been tested with real review data flowing through local SQLite in a live scenario. The fix was verified with mocked data only (S8-F1). We need to confirm the cards render correctly and the copy reads well.
- **Missing test coverage** — No `weekly_reviews.test.ts` exists in `src/lib/db/repositories/__tests__/`. The other three repos (habits, habit_logs, preferences) all have test files.
- **Sprint plan realignment** — S12 and S14 in `sprint-plan.md` are written for the dissolved Focus/Supporting model. They need rewriting to reflect the goal-based peer-habit architecture. S14's code scope (multi-habit Today) is already implemented in S10 — S14 should become a pure beta-ship sprint.

## S10 followup cleanup (opening pass)

Per convention: small tech-debt from prior sprints folded into opening cleanup.

- **S10-F1 (streak copy variants)** — P3 cosmetic. Defer to post-beta unless product review flags it.
- **S10-F2 (opacity 0.6 vs 0.55)** — P4 cosmetic. Defer.
- **S10-F3 (donut gradient stroke)** — P3 cosmetic. Defer.
- **S10-F4 (Lucide tree-shaking)** — P3 optimization. Defer to S20 polish.
- **S10-F5 (sprint plan S12/S14 stale specs)** — P1 planning debt. Addressed in S11-04 below.

No code cleanup tickets from S10 followups — all are deferred or handled by sprint plan rewrite.

---

## Tickets

### S11-01 — Weekly reviews repository test coverage

**What:** Add `weekly_reviews.test.ts` to `src/lib/db/repositories/__tests__/`. The repository has been live since S1 but has no dedicated tests. All three sibling repositories (habits, habit_logs, preferences) have test files.

**Tests to write:**
- `upsertWeeklyReview` — insert a new review, verify all fields round-trip correctly (including boolean→integer→boolean conversion via `fromRow`)
- `upsertWeeklyReview` — upsert on conflict (same user + habit + weekStart) updates fields and `updated_at`
- `getLatestWeeklyReview` — returns the most recent by `week_start DESC`
- `getLatestWeeklyReview` — returns `null` when no reviews exist for the habit
- `getWeeklyReviewForWeek` — exact match on week_start
- `getWeeklyReviewForWeek` — returns `null` for a week with no review
- Boolean edge cases: `trigger_worked = null` round-trips as `null`, `trigger_worked = true` round-trips as `true`, `trigger_worked = false` round-trips as `false` (verify the `boolToInt` / `fromRow` conversion doesn't coerce falsiness)

**Branch:** `s11/reviews-repo-tests`

**Done means:** 7+ tests covering CRUD + boolean conversion. All green.

---

### S11-02 — Bug #2 end-to-end validation with real review data

**What:** Verify that the dual-suggestion-card layout in `HabitDetailScreen` works correctly when `latestReview` contains real data from local SQLite. The Bug #2 fix (S8) was verified with mocked review data only — it's been inert in production because no review data existed. Now that the WeeklyReviewScreen is gated but the data layer works, we need to manually create a review via the repository and verify the HabitDetail cards render.

**Steps:**
1. In a dev build, manually insert a review via the SQLite repo where `trigger_worked = false` (should trigger the "trigger-fix" suggestion card)
2. Navigate to that habit's detail screen
3. Verify: one suggestion card renders with correct title, body, reason, and "Review suggestion" button
4. Insert a second review where both `trigger_worked = false` AND `tiny_action_too_hard = true`
5. Verify: two suggestion cards render in priority order (action-fix first, then trigger-fix, per D9 rule in `habitAdjustmentEngine.ts`)
6. Verify: "Review suggestion" button navigates to edit screen with `suggestionType` param

**If issues found:** Fix the layout/copy in this sprint. Budget 0.5 day for fixes.

**Branch:** `s11/bug2-validation`

**Done means:** Both single-card and dual-card suggestion layouts verified visually with real local data. Screenshots captured for documentation. Any layout issues fixed.

---

### S11-03 — Verify no stale Supabase review references remain

**What:** A targeted audit to confirm no code paths reference the old Supabase `weekly_reviews` table. This was assumed to be a problem when S11 was originally scoped but may already be clean.

**Audit scope:**
- `grep -r "supabase" src/features/reviews/` — should return nothing
- `grep -r "weekly_reviews" src/` — should only appear in: migration 002, repository, and test fixtures
- Verify `features/reviews/api.ts` imports from `@/lib/db/repositories/weekly_reviews` (local), not from any Supabase client
- Check for console warnings or errors on app launch related to missing Supabase tables

**Branch:** No branch needed if audit is clean. If stale references found, fix on `s11/stale-review-refs`.

**Done means:** Audit complete. No Supabase references in the reviews feature module. No console errors related to dropped tables.

---

### S11-04 — Rewrite sprint plan S12–S14 for goal-based model

**What:** The sprint plan's S12 ("Supporting habit creation") and S14 ("Multi-habit Today") are written for the dissolved Focus/Supporting paradigm. Rewrite them to reflect the current architecture.

**Key changes:**

**S12 becomes "Habit creation + icon picker":**
- Post-onboarding habit creation: user adds a new habit to their goal (no Focus/Supporting distinction)
- Icon picker integrated into Create/Edit screens (reuse `LucideIconPicker` from onboarding)
- 3-per-goal soft cap warning surfaces during creation (uses `assertCanCreateActiveHabit` from S10)
- Worst-day gate applies to all habit creation equally (no Focus vs Supporting distinction)
- No `habit_state` auto-determination — all new habits are `active`

**S13 (Reminders)** — Unchanged. No Focus/Supporting dependency.

**S14 becomes "Beta QA + ship to testers":**
- Multi-habit Today is already implemented (S10 renders all habits as equal rows)
- S14 scope reduces to: final QA pass on the complete beta loop, TestFlight/Play Console builds, tester invitations, feedback channel setup, welcome message
- Estimate drops from 2–3 days to 1–2 days

**Also update:**
- Sprint status table: S10 → Done
- §6 Phase C description to note the collapsed scope
- §10 Locked decisions log: add the Focus/Supporting dissolution decision

**Branch:** No code branch — documentation only. Update `sprint-plan.md` directly.

**Done means:** S12 and S14 rewritten. Sprint status current. Anyone reading the plan understands the goal-based model.

---

## Definition of done

All of the following must be true before `sprint-11` merges to `main`:

1. `weekly_reviews.test.ts` exists with 7+ tests, all green
2. Bug #2 dual-card layout verified with real local review data (both single and dual card scenarios)
3. No Supabase references remain in `src/features/reviews/` (audit documented)
4. Sprint plan S12 and S14 rewritten for goal-based model
5. Full test suite green

## Risks

- **This is a light sprint (2 days).** That's intentional — S10 was heavy, and the reviews migration turned out to be already done. Use the headroom to do thorough Bug #2 validation rather than rushing into S12.
- **Bug #2 validation might surface layout issues.** The dual-card layout was only tested with mocks. Real data could have different field lengths or null patterns. Budget 0.5 day for fixes.

---

*End of S11 scope. Ticket package ready for implementation.*
