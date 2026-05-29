# Goal wording fix + goal editing — Design

**Date:** 2026-05-29
**Status:** Approved design, ready for implementation plan

## Problem

Two related problems with goals:

1. **Grammar.** When someone types a goal, the app force-inserts "a"/"an" in front
   of it. This only reads correctly for a bare singular noun. It breaks for
   adjectives and verb phrases:
   - `healthy` → stored as `a healthy` → shown as **"Become a healthy"**
   - `read bible` → `a read bible` → **"Become a read bible"**

   The input's own guidance makes it worse: the create-flow field is labelled
   "Become someone who…" with placeholder "runs regularly, reads daily…", yet
   typing "runs regularly" produced **"Become a runs regularly"**.

2. **No way to edit a goal.** A "goal" is not a record — it is the set of habits
   that share the same `identity_phrase` string. The edit-habit screen shows the
   goal text read-only with the hint *"Part of a goal · change in goal settings"*,
   but the goal page has no edit control. That hint points nowhere, so a goal's
   wording can never be changed once created.

The two are connected: fixing the grammar stops creating bad text; adding an edit
path lets people fix goals they already have.

## Background — the data model

- A goal is identified by its `identity_phrase`. There is no goals table. The
  column is stored in exactly one place, `local_habits`
  ([001_initial.ts:16](../../../src/lib/db/migrations/001_initial.ts), recreated in
  [004](../../../src/lib/db/migrations/004_dissolve_focus_supporting.ts)). So a
  rename's entire DB blast radius is that one column.
- It is displayed everywhere as `Become {identity_phrase}`.
- [`normaliseBecomingPhrase`](../../../src/utils/normalisePhrase.ts) cleans typed
  input: trims, collapses whitespace, lowercases, strips lead-ins ("become",
  "I want to be", …), then (the bug) prepends "a"/"an".
- [`goalIdRegistry`](../../../src/services/goalIdRegistry.ts) maps each exact phrase
  to a random analytics id (case- and whitespace-significant) so goal events can
  ship to PostHog without leaking the goal text.
- Goal-level operations (archive, delete) already cascade across every habit under
  a phrase via a single `WHERE identity_phrase = ?`. Rename follows that mold.
- Weekly reviews and SRHI responses are keyed by `habit_id`, not phrase, so a
  rename does **not** orphan any review history.

## Goals / Non-goals

**Goals**
- Stop the app from mangling typed goal wording.
- Let people edit a goal's wording from the goal page.

**Non-goals**
- Changing the lowercasing of identity phrases (kept — see Part 1).
- Replacing the "Become {phrase}" framing.
- Editing the goal from the habit-edit screen (the read-only field there becomes a
  link to the goal page instead).
- Editing a fully-archived goal from the archived-goal page — v1 adds the edit
  control to the live goal page only (which always has ≥1 active habit, since the
  page redirects otherwise).
- A live "Become …" preview (dropped — the existing on-blur rewrite already shows
  the result once the surprising article-insertion is gone).

---

## Part 1 — Grammar fix

### Behaviour

In [`normaliseBecomingPhrase`](../../../src/utils/normalisePhrase.ts), keep the
trim / collapse / lowercase / strip-lead-ins steps and **remove the step that
prepends "a"/"an"** (the `VOWELS` set and `ARTICLE_PREFIXES` early-return become
unused and are deleted). Whatever remains after cleaning is saved and shown as-is.

- `healthy` → **"Become healthy"**
- `read the bible` → **"Become read the bible"**
- `a runner` → **"Become a runner"** (kept exactly — the user typed the article)

### Lowercasing is kept (explicit decision)

The function continues to lowercase. This is load-bearing for grouping — "Read the
Bible" and "read the bible" must not fragment into two separate goals — and it
matches the established lowercase identity style (e.g. the onboarding chip "someone
who reads daily"). Because the on-blur rewrite stays and there is no separate
preview, the input field itself shows the lowercased result, so what the user sees
is what gets saved.

### Copy

- **Create flow only:** fix the contradictory goal-step field. The label
  "Become someone who…" fights the "Become {phrase}" display
  ([CreateHabitFlow.tsx:241](../../../src/features/habits/screens/CreateHabitFlow.tsx)).
  Replace the label and placeholder with identity-style guidance, e.g. label
  "Become…", examples "a calmer person · healthier · someone who reads daily".
- **Onboarding:** no copy change. Its chips are already identity-style
  ([BecomingScreen.tsx:15-23](../../../src/features/onboarding/screens/BecomingScreen.tsx))
  and the field label is neutral.
- **No live preview.** Keep the existing on-blur rewrite on both screens; it is no
  longer surprising once the article-insertion is gone, and a separate preview
  would just echo it.

### Validation gap to close

With the article-prepend gone, `"become a"` cleans to `"a"` (1 char), and the
create goal step's gate checks the **raw** length ≥ 2
([CreateHabitFlow.tsx:220](../../../src/features/habits/screens/CreateHabitFlow.tsx)),
so it would pass. Validate the **cleaned** result instead: length ≥ 2 and ≤ 240
(240 is the existing `identity_phrase` cap,
[validators.ts:54](../../../src/features/habits/validators.ts) — consistency, not a
new rule).

The onboarding "Who do you want to become?" screen has the **same** raw-length gate
([BecomingScreen.tsx:43](../../../src/features/onboarding/screens/BecomingScreen.tsx))
and normalise-after pattern, so `"become a"` → `"a"` slips through there too. Apply
the cleaned-value validation on **both** screens — they are the matched pair for
goal-phrase entry.

---

## Part 2 — Editing a goal (on the goal page)

### UI

Add a small **edit (pencil) control** next to the "Become …" title on the
[goal detail page](../../../src/features/today/screens/GoalDetailScreen.tsx).
Tapping it turns the title into a text field, pre-filled with the current
`identity_phrase` as-is, with **Save / Cancel**. (The stored phrase never contains
"Become" — that word lives only in the `Become {phrase}` display template, and
`normaliseBecomingPhrase` strips any "become " lead-in at write time — so there is
nothing to strip on pre-fill.) The control is hidden when the account is read-only
(trial expired), the same as the existing Archive button.

### Save behaviour

- Clean the input through `normaliseBecomingPhrase` (same as create).
- Validate the **cleaned** value: ≥ 2 and ≤ 240. Block otherwise.
- **No-op guard:** if the cleaned new phrase equals the old, just close the editor —
  no mutation, no navigation.
- **Merge confirm:** detect whether the cleaned new phrase already names one of the
  user's goals via the `goalExists` lookup (Part 3). If it does, confirm first
  ("You already have a goal called X — saving will combine them"). Saving is
  allowed; the goals merge (see Edge cases).
- On save, rename `identity_phrase` across **every habit under the goal** — active,
  backlog, and archived — matching how archive/delete already behave. Habits with
  no identity phrase are untouched (rename is phrase-scoped).

### Staying on the page (redirect guard)

The goal page derives its habit list by filtering on the phrase
([today/hooks.ts:472](../../../src/features/today/hooks.ts)). After a rename, the old
phrase's list goes empty, which trips `shouldRedirect` → `router.replace(.../today)`
([GoalDetailScreen.tsx:99-164](../../../src/features/today/screens/GoalDetailScreen.tsx)).
Set an `isExitingRef`-style guard **before** mutating — exactly like the archive
flow ([GoalDetailScreen.tsx:182](../../../src/features/today/screens/GoalDetailScreen.tsx)) —
then `router.replace` to the **new** phrase so the user lands on the renamed goal.

### Revive the dead hint

On the edit-habit screen, the "Part of a goal · change in goal settings" hint
([EditHabitScreen.tsx:266](../../../src/features/habits/screens/EditHabitScreen.tsx))
becomes a tappable link that navigates to that goal's page.

---

## Part 3 — Data / plumbing

Follows the existing layering (UI hook → `api.ts` → repo).

### Repo — `renameGoal(userId, oldPhrase, newPhrase)`

In a transaction: `SELECT id FROM local_habits WHERE user_id = ? AND
identity_phrase = ?` (all statuses), then
`UPDATE local_habits SET identity_phrase = ?, updated_at = ? WHERE user_id = ? AND
identity_phrase = ?`, and **return the affected ids**. Same shape as `deleteGoal`
([habits.ts:472](../../../src/lib/db/repositories/habits.ts)). The ids are returned
because the hook needs them to refresh per-habit caches.

### api.ts — `renameGoal` wrapper

Thin wrapper, mirroring the other goal-level api functions.

### Goal-existence lookup (drives the merge confirm)

There is no existing way to ask "does a goal with this phrase exist?" — the repo
only has `listArchivedGoals` (archived-only) and `listGoalHabits` (habits for one
phrase). Add a `goalExists(userId, phrase)` repo/api function:
`SELECT 1 FROM local_habits WHERE user_id = ? AND identity_phrase = ? LIMIT 1`,
**across all statuses** (active, backlog, archived) — an archived-only target still
counts as a merge because it changes grouping. The renamed goal needs no explicit
exclusion: the check runs against the **new** phrase before the mutation, while the
source habits still hold the **old** phrase, so they cannot self-match (the
`new == old` case is already handled by the no-op guard).

### Hook — `useRenameGoalMutation`

`onSuccess(result, { oldPhrase, newPhrase })`, in this order:

1. **`aliasGoalId(oldPhrase, newPhrase)` first** — synchronously, before any
   navigation. (See ordering contract below.)
2. Loop `invalidateHabitSurfaceQueries(userId, habitId, queryClient)` over the
   returned ids. Use **this surface helper, not the delete/list helper**: the
   surface helper does a `fetchQuery(getHabitById)` per id
   ([hooks.ts:284](../../../src/features/habits/hooks.ts)), which is safe for rename
   because the rows still exist (the delete path forbids that fetch). It is the
   archive shape, not the delete shape.
3. `trackEvent("goal_renamed", { goal_id: goalIdFor(newPhrase) })` — fired
   post-alias so the id is continuous, matching the
   `goal_archived`/`goal_restored` shape
   ([hooks.ts:757](../../../src/features/habits/hooks.ts)).
4. Navigation happens on the screen after the mutation resolves (`router.replace`
   to the new phrase, under the redirect guard).

`onError` logs, same as the other goal mutations.

**Why one invalidation loop covers both names + the live page.** The goal-level
caches the surface helper invalidates use **broad-prefix keys that omit the
phrase**: `["habits","goal-count"]`
([hooks.ts:301](../../../src/features/habits/hooks.ts)),
`getArchivedGoalsQueryKey(userId)` (312), `["habits","archived-goal-detail"]` (319),
`["habits","goal-cascade-count"]` (325), `["reviews","goal-status"]` (331). Because
the phrase is not in the key, one pass refetches the old (now empty) and new (now
populated) goals together — no per-name enumeration. The live goal page is covered
too, since `useGoalDetail` derives from the eligible/upcoming lists the helper also
invalidates (289, 292). Exact-key invals are optional tidiness.

### `aliasGoalId(oldPhrase, newPhrase)` in goalIdRegistry

New function. Copy `cachedMap[oldPhrase]` to `cachedMap[newPhrase]` **only if
`newPhrase` is not already mapped** (so on a merge the existing target id wins).
Persist fire-and-forget like the rest of the registry; only the synchronous
in-memory `cachedMap` write is load-bearing. The old id is left orphaned in both
cases — past PostHog events under it are immutable and are not rewritten.

**Ordering contract (load-bearing).** The remounted goal page fires
`goal_detail_viewed` with `goalIdFor(newPhrase)` on mount
([GoalDetailScreen.tsx:140-142](../../../src/features/today/screens/GoalDetailScreen.tsx)).
If the alias's in-memory write has not landed before the `router.replace`/remount,
the new phrase mints a fresh random id and the first event under the new name is
discontinuous — the exact thing the alias prevents. So: **alias (sync in-memory) →
then navigate.**

---

## Edge cases

- **Merge** (rename onto an existing goal): allowed, after the confirm dialog. The
  DB is safe — there is no unique constraint on the phrase; goals are already just
  multiple rows sharing a phrase. Analytics: if the target **already has** an id
  (it had been viewed or mutated), that id wins — `goalIdFor(newPhrase)` resolves to
  it and the alias does not fire because the target is mapped. If the target has
  **no id yet** (never viewed or mutated, so unmapped), the alias fires and the
  merged goal adopts the **source's** id. Either way the goal is consistent going
  forward and past events are immutable. Broad-prefix invalidation refreshes both
  the now-empty source and the now-bigger target for free.
- **No-op:** cleaned new == old → close editor, do nothing.
- **Read-only mode:** edit control hidden, like Archive.
- **Cleaned < 2 chars** (e.g. "become a" → "a"): blocked by validation.
- **Null-phrase habits:** untouched.
- **No DB orphaning:** reviews/SRHI are keyed by `habit_id`.

## Analytics

`goal_renamed` event, payload `{ goal_id: goalIdFor(newPhrase) }`, fired post-alias
so the id is continuous (equals the old id for a plain rename; equals the target id
for a merge). Optional extra fields (`previous_goal_id`, `merged`) could be added
later if funnel analysis wants to distinguish merges; not required for v1.

## Testing

- **`normalisePhrase.test.ts`** — update for no-article behaviour: `"runner"` →
  `"runner"`, `"healthy"` → `"healthy"`, articles preserved (`"a runner"` →
  `"a runner"`), lead-ins still stripped (`"Become a runner"` → `"a runner"`).
- **`renameGoal` repo** — renames all statuses, scoped to the user, returns the
  affected ids; merge (renaming onto an existing phrase groups the rows).
- **`aliasGoalId`** — copies when the target is unmapped; no-ops when the target is
  already mapped (target wins); persists; safe across the hydration race.
- **`useRenameGoalMutation`** — alias-before-navigate ordering; surface-helper
  invalidation; `goal_renamed` fired with the continuous id.
- **`goalExists` repo/api** — true when any habit of any status carries the phrase,
  false otherwise; user-scoped.
- **Goal page edit flow** — Save renames and navigates to the new phrase;
  cleaned-value validation blocks < 2; read-only hides the control; the merge
  confirm fires when `goalExists` returns true (including an archived-only target);
  no-op closes without mutating.
- **Create + onboarding entry** — cleaned-value validation (≥ 2) blocks
  `"become a"` → `"a"` on **both** the create goal step and the onboarding screen.
- **Edit-habit screen** — the goal hint navigates to the goal page.
