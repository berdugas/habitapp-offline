# Sprint 5 — Followups

> Items deferred from S5 or surfaced during smoke. None are blockers for the
> sprint-5 → main merge. Prioritized P1/P2/P3.

---

## F1 — Subtle unlogged-day indicator (P2, deferred per D9)

Per S5 §0 decision (D9), the §5.2 "subtle indicator if the day is unlogged after a
certain time" was deferred from S5. Product-lead decision: ship without it; learn
from beta whether testers miss it.

**If beta surfaces a need:** design a calm indicator (small dot, muted colour change,
or subtle pulsing animation on the today heatmap cell) that triggers after a
configurable device-local time (e.g., 6 pm). Implementation would live in
`TodayScreen` or `FocusCard`, keyed off `todayStatus === null && deviceHour >= 18`.
Ship as a small standalone ticket.

---

## F2 — identityNoun coverage gaps (P2, log during beta)

`extractIdentityNoun` (`src/features/onboarding/identityNoun.ts`) uses a fixed lookup
table (`VERB_TO_AGENT_NOUN`, 15 entries) and three regex patterns. Known gaps:

- Multi-word adjective phrases: "a more patient person" → `null` (pattern 1 requires
  single `\S+` before "person"). Documented intentionally in the test suite.
- Verbs not in the lookup: "someone who jogs", "someone who codes" → `null`. Falls
  back to generic streak copy gracefully.

**Action:** During beta, add logging when `extractIdentityNoun` returns `null` to
identify the most common missed phrases. Grow `VERB_TO_AGENT_NOUN` and optionally
extend pattern 1 to handle "a [word] [word] person" for v1.1.

---

## F3 — Missing tests for both error UI paths in TodayScreen (P3)

`TodayScreen` has two `<ErrorState>` render paths, neither covered by the seven
tests in `src/features/today/__tests__/TodayScreen.test.tsx`:

1. **Load error (preserved from pre-S5):** when `useTodayHabits()` returns
   `{ error: ... }`, the screen renders a full-screen `<ErrorState>` with
   `getLoadHabitsErrorMessage()`. Existing path; never tested.
2. **Save error (added in S5, unspec'd-but-correct):** when
   `upsertTodayHabitStatusMutation.error` is non-null, the screen renders an
   inline `<ErrorState>` with `getSaveTodayStatusErrorMessage()` above the
   FocusCard. New path; not in the original spec.

**Fix (two tests):** mock the respective hook to return an error, assert the
error message renders. Not blocking — both paths were visually verified during
smoke — but closes the gap before S6 adds more error surfaces.

---

## F4 — No integration test for heatmap refresh after logging (P3)

`TodayScreen.test.tsx` mocks both `useHabitLogsForRange` and
`useUpsertTodayHabitStatusMutation` entirely, so the round-trip
"tap Done → invalidation → refetch → heatmap cell turns green" is only proven by the
Appium smoke. This is acceptable while the smoke runs every sprint, but the gap
should be closed with one integration test (real QueryClient, mock only the SQLite
repos) before S6 adds the retro-log selector — at that point the invalidation chain
becomes more complex and harder to catch with smoke alone.

**Home:** `src/features/today/__tests__/TodayScreen.test.tsx` or a new
`TodayScreen.integration.test.tsx` next to it.

---

## F5 — `useTodayHabits` latestReviewQueries dead path (P3, clean up with Reviews)

`src/features/today/hooks.ts` still fires `latestReviewQueries` against the dropped
Supabase `weekly_reviews` table (silently swallowed). The S4-era note in
PROJECT_BRAIN §11 documents this. S5 made it worse: the redesigned `TodayScreen`
no longer reads `isWeeklyReviewDue`, so these queries now fire with zero consumers —
pure console noise with no product effect.

**Action:** When the weekly-reviews feature migrates to local SQLite (no sprint
assigned yet), delete the entire `latestReviewQueries` block in `useTodayHabits` as
part of that migration PR. Do not touch it before then — the no-op behaviour is
preferable to leaving a half-migrated hook.

---

## F6 — sqliteTestAdapter.test.ts migration-count assertion (fixed in S5 close-out)

The test `"returns a DB with migration 001 applied"` in
`src/tests/setup/sqliteTestAdapter.test.ts` asserted exactly one migration was
present in `schema_migrations`. When migration 002 (`002_weekly_reviews`) was
added (S2/S3 era), the test was not updated and silently failed across S3 and
S4. This means the "309 tests passing" (S3) and "325 tests passing" (S4)
claims in PROJECT_BRAIN §11 were each off by one.

**Fixed in S5 close-out:** assertion now compares against the registered
migrations list (`migrations` from `src/lib/db/migrations/index.ts`) rather
than a hardcoded count, so future migrations don't re-break the test. The test
was also renamed to `"returns a DB with all registered migrations applied"`.

**Process lesson:** when adding a migration, run the full suite — the test
that asserts migration state is the one most likely to break and the easiest
to forget.
