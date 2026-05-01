# Sprint 6 — Followups

> Items deferred from S6 or surfaced during smoke. None are blockers for the
> sprint-6 → main merge. Prioritized P1/P2/P3.

---

## F1 — Pre-start heatmap cells visual differentiation (P1, beta-triggered)

Per S6 (D4), cells before `habit.start_date` currently render as `heatmapMissed` —
visually identical to "missed during habit's life." For a habit started recently, the
90-day heatmap on Habit Detail shows up to 89 cells that look like failures but aren't.
The deferral in S6 is a *bet* that testers read these as empty days rather than missed
ones.

**If beta feedback even hints that the heatmap reads as failure** (any wording like
"looks like I already failed", "wall of red", "why are there so many missed days?"),
F1 is the next sprint's first ticket — promoted ahead of any in-flight feature work.
Capture verbatim wording in the beta feedback channel and tag it `f1-trigger`.

**Action when triggered:** extend `Heatmap` with an optional `habitStartDate` prop;
render pre-start cells with a distinct subtle "out-of-range" tint (lighter than
`heatmapMissed`, no border) and exclude from `onCellPress` at the component level.
Apply on both Today's 30-day and Habit Detail's 90-day variants. Product-lead to weigh
in on the exact tint.

---

## F2 — Consolidate today and general-purpose mutation hooks (P3)

S6 added `useUpsertHabitLogMutation` as a general-purpose retro-log hook.
`useUpsertTodayHabitStatusMutation` in `features/today/hooks.ts` is a special case of
it (logDate hardcoded to today). Both coexist intentionally in S6.

**Action:** when there's a reason to touch the Today logging path again (e.g., when
reviews migrates, or when the recovery flow adds a "re-log" action), migrate Today to
use the general hook and delete `useUpsertTodayHabitStatusMutation`. Don't do it as a
standalone refactor — consolidation is a followup, not urgent.

---

## F3 — Bottom-sheet UI for retro selector (P3, beta-driven)

Per S6 (D5), the `RetroLogSelector` uses RN's built-in `Modal` rather than a
bottom-sheet library. Modal works and keeps dependencies minimal.

**Action:** if beta feedback indicates the modal feels heavy, jarring, or non-native
(any comparison to other habit apps' bottom sheets), evaluate `@gorhom/bottom-sheet`
specifically for the retro selector. Adds a library dependency — only if feedback
clearly warrants it. File under v1.1 polish.

---

## F4 — Mutation error UX on selector failure (P3)

The `RetroLogSelector` catches `RetroLogError` and shows a friendly inline message,
staying open for the user to dismiss. For non-`RetroLogError` failures (network, DB
write failure), it shows "Something went wrong. Try again." and also stays open.

**Action:** consider in beta whether retry-from-selector is the right UX for
non-retro errors, vs. closing the selector and offering a global toast. Decide based
on how often non-retro errors surface in practice. No code change until there's
signal.

---

## F5 — `useTodayHabits` latestReviewQueries dead path (P3, carry-over from S5)

Carried over from S5 F5. The `latestReviewQueries` block in `useTodayHabits`
(`features/today/hooks.ts`) still fires against the dropped Supabase `weekly_reviews`
table. Error silently swallowed; no product effect; pure console noise.

**Action:** when weekly reviews migrates to local SQLite, delete the
`latestReviewQueries` block as part of that migration PR. Do not touch before then.

---

## F6 — Query key naming inconsistency (P3, S7 cleanup)

The codebase has two related range-query key shapes:

- `["habit-logs", userId, startDate, endDate]` (hyphenated) — used by `getUserHabitLogsRangeQueryKey` and `getHabitDetailLogsQueryKey`
- `["habit_logs", "range", habitId, fromDate, toDate]` (underscored) — used by `getHabitLogsRangeQueryKey`

Pre-existing from S5; S6 propagated the inconsistency by correctly invalidating both during retro-log mutations. Functionally correct but cognitively confusing for the next dev grepping for log-related queries.

**Action:** S7 cleanup. Pick one convention (recommend hyphens to match the existing majority) and rename the underscored key + all its consumers in a single small commit. No behavior change; pure rename.

---

## F7 — Double fetch of heatmap data on Habit Detail (P3, S7 cleanup)

`HabitDetailScreen` calls `useHabitLogsForRange(habit?.id, 90)` at the screen level (used by `handleCellPress` to look up the current status of the tapped cell), and the `HabitDetailHeatmap` subcomponent independently calls the same hook to render the grid. React Query dedupes on identical query keys so it works correctly, but it's two subscriptions to the same data — two render passes on invalidation.

**Action:** S7 cleanup. Fetch once at the screen level, pass `logs` as a prop to `HabitDetailHeatmap`. Tiny refactor; no behavior change.
