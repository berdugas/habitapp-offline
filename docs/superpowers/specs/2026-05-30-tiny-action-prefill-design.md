# Tiny-action prefill — Design

**Date:** 2026-05-30
**Status:** Approved design, ready for implementation plan

## Problem

When creating a habit, the user types their daily action on one screen (e.g.
"Goes for a walk"), then lands on a separate "Now make it tiny" screen and must
re-type a smaller version into a blank field. If they don't actually want a
smaller version — their action is already small enough — they have to type the
same words twice. This is the entire pain the user reported:

> "i dont have to re type the action into the tiny action field"

Same issue exists in two places, because the create-habit flow and the
onboarding flow each have their own "make it tiny" step that share the same
shape but live in different files (see [[personalize-screen-pair]] for the
broader near-clone pattern).

- [`CreateHabitFlow.BuildStep`](../../../src/features/habits/screens/CreateHabitFlow.tsx)
- [`ShrinkScreen`](../../../src/features/onboarding/screens/ShrinkScreen.tsx)

Only `tinyAction` is persisted on save — `dailyAction` is a stepping-stone field
that exists only in form draft state. So this is a UX/draft-state change with no
database impact.

## Goals / Non-goals

**Goals**
- Stop forcing users to re-type the same action when they don't want a smaller
  version.
- Apply consistently in both the regular create flow and the onboarding flow.
- Preserve the existing "make it tiny" prompt and the worst-day gate — the
  philosophy is unchanged, only the friction.

**Non-goals**
- Removing the tiny-action concept from the data model.
- Adding a separate "Skip" button or "Same as my action" link.
- Adding a copy-tweak to the headline ("Now make it tiny.") — kept as-is.
- Changing `EditHabitScreen` — it edits a saved habit's `tinyAction` directly
  with no daily-action stepping stone, so it has no mirror to maintain.

---

## Design

### Approach

Mirror `dailyAction` → `tinyAction` automatically until the user types something
in the tiny field themselves. Once they touch it, the mirror stops permanently
for that draft.

We considered and rejected two alternatives:
- **Prefill once on first arrival** — same behavior on first entry, but if the
  user later goes back and changes the daily action, the tiny field doesn't
  follow. Surprising.
- **Re-prefill on every arrival** — destroys the user's typed tiny version when
  they return to the screen (notably via the "Let me make it smaller" button on
  the worst-day gate, which exists *specifically* to refine the tiny version
  further).

The mirror-until-first-edit approach handles both back-navigation and the
"Let me make it smaller" return path correctly.

### Data model

Add a single boolean to each draft type.

**`CreateHabitDraft`** (in
[`CreateHabitFlow.tsx`](../../../src/features/habits/screens/CreateHabitFlow.tsx)):

```ts
export type CreateHabitDraft = {
  // …existing fields…
  tinyAction: string;
  tinyActionTouched: boolean;   // ← new
  // …existing fields…
};

const EMPTY_DRAFT: CreateHabitDraft = {
  // …existing fields…
  tinyAction: "",
  tinyActionTouched: false,     // ← new
  // …existing fields…
};
```

**`OnboardingDraft`** (in
[`types.ts`](../../../src/features/onboarding/types.ts)): add the same field
with the same default, and add `"tinyActionTouched"` to `KNOWN_DRAFT_KEYS` so
the persistence layer round-trips it.

No database schema change. Neither `dailyAction` nor the new flag are persisted
to the habits table — only the resolved `tinyAction` is.

### Mirror behavior

The whole mirror rule lives in one place per flow: the `update()` function.

**Create flow** — modify the `update` function inside
[`CreateHabitFlow.tsx`](../../../src/features/habits/screens/CreateHabitFlow.tsx):

```ts
function update(patch: Partial<CreateHabitDraft>) {
  setDraft((prev) => {
    const next = { ...prev, ...patch };
    // Mirror only when this patch is a dailyAction-only change and the user
    // hasn't touched the tiny field. The `!("tinyAction" in patch)` guard
    // prevents a combined patch from clobbering a tiny value the same patch
    // is trying to set.
    if (
      "dailyAction" in patch &&
      !("tinyAction" in patch) &&
      !next.tinyActionTouched
    ) {
      next.tinyAction = next.dailyAction;
    }
    return next;
  });
}
```

**Onboarding flow** — modify `update` inside `useOnboardingDraft` in
[`hooks.ts`](../../../src/features/onboarding/hooks.ts). Same logic, applied
against `draftRef.current` + `setDraft`:

```ts
const update = useCallback(
  (patch: Partial<OnboardingDraft>) => {
    const next = { ...draftRef.current, ...patch };
    if (
      "dailyAction" in patch &&
      !("tinyAction" in patch) &&
      !next.tinyActionTouched
    ) {
      next.tinyAction = next.dailyAction;
    }
    draftRef.current = next;
    setDraft(next);
    // …existing persistence/debounce logic unchanged…
  },
  [userId],
);
```

**Tiny field `onChangeText`** in both `BuildStep` (CreateHabitFlow) and
`ShrinkScreen` (onboarding) flips the flag the first time the user types in the
tiny field:

```ts
onChangeText={(text) => update({ tinyAction: text, tinyActionTouched: true })}
```

Mirroring is therefore triggered only by patches to `dailyAction`. Patches to
`tinyAction` set `tinyActionTouched: true` and skip the mirror.

### Remove the existing one-shot prefill in DailyActionScreen

[`DailyActionScreen.handleContinue`](../../../src/features/onboarding/screens/DailyActionScreen.tsx)
already contains a one-shot prefill that runs when the user presses Continue:

```ts
const handleContinue = () => {
  const next: Partial<OnboardingDraft> = { step: "shrink-insight" };
  if (draft.tinyAction.trim().length === 0) {
    next.tinyAction = draft.dailyAction;        // ← prefill
  }
  update(next);
  router.push("/(onboarding)/shrink-insight");
};
```

Two reasons to remove this in the same change:

1. **It becomes dead code.** Once the mirror lives in `useOnboardingDraft.update`,
   `draft.tinyAction` is already populated by the time Continue is pressed — the
   `trim().length === 0` branch never fires.
2. **It bypasses `tinyActionTouched`.** It writes `tinyAction` without setting
   the flag. Harmless under the new mirror (the mirror will keep updating both),
   but semantically wrong and a footgun if anyone later tweaks the flow.

Replace `handleContinue` with the simple form:

```ts
const handleContinue = () => {
  update({ step: "shrink-insight" });
  router.push("/(onboarding)/shrink-insight");
};
```

Note that the user's reported pain ("don't make me re-type") was observed in the
**create-habit** flow, which has never had a prefill. The onboarding flow's
existing one-shot prefill already softened the problem there. The new mirror
unifies behavior across both flows and additionally fixes the back-and-edit case
the one-shot prefill never handled.

### Migration for persisted onboarding drafts

The onboarding draft is persisted to AsyncStorage and can survive across
sessions. An existing user mid-onboarding could load a saved draft that has a
real `tinyAction` but no `tinyActionTouched` field. If we let it default to
`false`, the next edit to their daily action would silently overwrite their
typed tiny version.

Fix in `loadOnboardingDraft` (in
[`storage.ts`](../../../src/features/onboarding/storage.ts)): after the
`{ ...EMPTY_DRAFT, ...pickKnownDraftKeys(parsed) }` merge, detect old drafts and
set the flag based on what's in `tinyAction`:

```ts
const picked = pickKnownDraftKeys(parsed);
const merged = { ...EMPTY_DRAFT, ...picked };
// Migration: drafts saved before tinyActionTouched existed had no flag.
// Treat any non-empty tinyAction as user-authored so the mirror does not
// overwrite it on the next dailyAction edit.
if (
  typeof parsed === "object" &&
  parsed !== null &&
  !("tinyActionTouched" in parsed)
) {
  merged.tinyActionTouched = merged.tinyAction.trim().length > 0;
}
return merged;
```

`CreateHabitFlow`'s draft is session-local `useState`, fresh every time you
start a new habit — no migration needed.

---

## Edge cases

| Case | Behavior |
|---|---|
| Empty `dailyAction` | Mirror copies empty string. Continue stays disabled (`tinyAction.trim().length >= 2`) until either field gets ≥ 2 chars. |
| User clears tiny field *after* touching it | Field stays empty. Mirror does **not** re-engage — `tinyActionTouched` is sticky. They must type something themselves. |
| "Let me make it smaller" return path | By the time this button is reachable, either the user has typed a tiny version (touched=true) or the mirror produced a non-empty value. Returning to BuildStep preserves whatever's there. The existing `focusTinyActionOnBuild` auto-focus still works. |
| User goes back and changes daily action *after* touching tiny | Mirror is off, so tiny stays as-is. They can manually re-sync by clearing tiny and retyping. If this hits users in real usage, we can revisit. |
| Whitespace | Mirror copies the raw `dailyAction` string. Continue gates use `.trim().length >= 2` on the raw value; `stripLeadingIWill` only runs at save time (`CreateHabitFlow.tsx:165`, `EditHabitScreen.tsx:215`, `validators.ts:18`) and in display formatters. The mirror does not need its own normalization step. |
| Worst-day gate copy | Reads "Could you still do {tinyAction} on your worst day?" — works whether the user shrunk or not. The "Let me make it smaller" escape hatch still catches "this is too big for a bad day." |
| Auto-focus on a pre-filled tiny field | When the user taps "Let me make it smaller" and returns to BuildStep, the existing `focusTinyActionOnBuild` focuses the tiny input — which may now hold a mirrored or previously-typed value. Cursor lands at end of existing text, which is the React Native default. Not changed in this spec; flagged as a future polish candidate (auto-select-all on return so the user can immediately overtype with a smaller version). |

---

## Testing

Four test files are touched.

### Onboarding `update()` mirror — `hooks.test.ts`

Extend
[`src/features/onboarding/__tests__/hooks.test.ts`](../../../src/features/onboarding/__tests__/hooks.test.ts):

- `update({ dailyAction: "X" })` mirrors `tinyAction` to `"X"` when
  `tinyActionTouched` is `false`.
- A second `update({ dailyAction: "Y" })` still mirrors (tiny becomes `"Y"`)
  while untouched.
- `update({ tinyAction: "Z", tinyActionTouched: true })` sets the flag, and a
  subsequent `update({ dailyAction: "W" })` does **not** overwrite tiny.
- Clearing tiny after touching (`update({ tinyAction: "", tinyActionTouched:
  true })`) leaves the flag sticky — a later `update({ dailyAction: "V" })`
  still does not overwrite the empty tiny.
- A combined patch `update({ dailyAction: "X", tinyAction: "Y" })` does not
  apply the mirror — tiny is `"Y"`, not `"X"` (guard against clobber).

### CreateHabitFlow screen test — `CreateHabitFlow.test.tsx`

Extend
[`src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx`](../../../src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx):

- After typing the daily action and advancing to BuildStep, the tiny input
  shows the daily action value (mirror via the same `update()` mechanism — no
  separate per-screen prefill).
- Continue on BuildStep is enabled on arrival if cue is also filled.
- "Let me make it smaller" → back to BuildStep preserves the typed tiny version
  (the user touched the field by typing on the first BuildStep visit, so the
  mirror is off).

### ShrinkScreen test — `ShrinkScreen.test.tsx`

Extend
[`src/features/onboarding/__tests__/screens/ShrinkScreen.test.tsx`](../../../src/features/onboarding/__tests__/screens/ShrinkScreen.test.tsx):

- Typing in the tiny field calls `update` with **both** `tinyAction` and
  `tinyActionTouched: true` (not just `{ tinyAction: text }`). Use a mock
  `update` and assert on its argument shape.

Be aware: existing tests in this file mock `useOnboarding` with stub state that
ignores the touched flag — those tests will keep passing without exercising the
new payload. The explicit assertion above closes that gap.

### Onboarding storage migration — `storage.test.ts`

Extend
[`src/features/onboarding/__tests__/storage.test.ts`](../../../src/features/onboarding/__tests__/storage.test.ts):

- Loading a draft persisted **without** `tinyActionTouched` and **non-empty**
  `tinyAction` returns `tinyActionTouched: true`.
- Loading a draft persisted **without** `tinyActionTouched` and **empty**
  `tinyAction` returns `tinyActionTouched: false`.
- Loading a draft that already has `tinyActionTouched: false` round-trips as
  `false` (no migration overwrite).

---

## Files touched

**Production code**

- [`src/features/habits/screens/CreateHabitFlow.tsx`](../../../src/features/habits/screens/CreateHabitFlow.tsx)
  — add field to type + `EMPTY_DRAFT`, update `update()`, update BuildStep's
  `onChangeText`.
- [`src/features/onboarding/types.ts`](../../../src/features/onboarding/types.ts)
  — add field to `OnboardingDraft` + `EMPTY_DRAFT` + `KNOWN_DRAFT_KEYS`.
- [`src/features/onboarding/hooks.ts`](../../../src/features/onboarding/hooks.ts)
  — update `update()` in `useOnboardingDraft`.
- [`src/features/onboarding/screens/ShrinkScreen.tsx`](../../../src/features/onboarding/screens/ShrinkScreen.tsx)
  — update `onChangeText` to pass `tinyActionTouched: true`.
- [`src/features/onboarding/screens/DailyActionScreen.tsx`](../../../src/features/onboarding/screens/DailyActionScreen.tsx)
  — remove the dead one-shot prefill branch from `handleContinue`.
- [`src/features/onboarding/storage.ts`](../../../src/features/onboarding/storage.ts)
  — add migration in `loadOnboardingDraft`.

**Tests**

- [`src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx`](../../../src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx)
- [`src/features/onboarding/__tests__/hooks.test.ts`](../../../src/features/onboarding/__tests__/hooks.test.ts)
- [`src/features/onboarding/__tests__/screens/ShrinkScreen.test.tsx`](../../../src/features/onboarding/__tests__/screens/ShrinkScreen.test.tsx)
- [`src/features/onboarding/__tests__/storage.test.ts`](../../../src/features/onboarding/__tests__/storage.test.ts)
