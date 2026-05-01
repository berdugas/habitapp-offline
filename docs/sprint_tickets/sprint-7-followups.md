# Sprint 7 — Followups

> Items deferred from S7 or surfaced during implementation. None are blockers for the
> sprint-7 → main merge. Prioritized P1/P2/P3.

---

## F1 — Recovery modal: "Pause for now" double-tap lock not unit-tested (P3)

The `recoveryActionLockRef` guard in TodayScreen prevents a second archive call on
double-tap, but this is not covered by an automated test. The existing tests mock
`useArchiveHabitMutation` and do not exercise the timing path.

**Action:** add a TodayScreen integration test (using a real DB or a controlled async
mock) that fires two "Pause for now" taps in rapid succession and asserts
`mutateAsync` was called exactly once. Lower priority because the lock is a one-liner
and the pattern is identical to `retroLogSubmitLockRef` from S6, which has been
battle-tested.

---

## F2 — "Make it smaller" focus on tiny_action: smoke-only, not unit-tested (P3)

`EditHabitScreen` focuses the `tiny_action` `TextInput` via `setTimeout(0)` when
`params.from === 'recovery'`. This path is covered in the S7 Appium smoke script
(item 3) but not in Jest unit tests.

**Action:** if and when a `from=recovery` regression is suspected, add an
`EditHabitScreen.test.tsx` case that mocks `useLocalSearchParams` with
`{ from: 'recovery' }` and asserts the ref's `focus()` is called after hydration.
Not urgent — the path is deterministic and does not touch the DB.

---

## F3 — Recovery modal copy not reviewed against §11.1 voice tone (P2, beta-driven)

The modal copy ("The habit lost some momentum. That happens to everyone — what
matters now is what you do next. What would you like to do?") is lifted verbatim from
requirements §11.1. It has not been validated with real users.

**Action:** if beta feedback indicates the copy is too formal, too long, or feels
preachy — surface verbatim wording — update `RecoveryModal.tsx` body and hint text.
No code change until there's signal.

---

## F4 — `useTodayHabits` latestReviewQueries dead path (P3, carry-over from S5, S6)

Still fires against the dropped Supabase `weekly_reviews` table. Console noise only;
no product effect.

**Action:** delete the `latestReviewQueries` block in `useTodayHabits`
(`features/today/hooks.ts`) when weekly reviews migrates to local SQLite. No sprint
assigned yet — likely S10–S12.
