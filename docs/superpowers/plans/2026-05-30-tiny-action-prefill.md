# Tiny-Action Prefill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Now make it tiny" field auto-mirror the daily action until the user types in it, so users who don't want a smaller version don't have to retype. Applies in both `CreateHabitFlow.BuildStep` and the onboarding `ShrinkScreen`.

**Architecture:** Add a `tinyActionTouched: boolean` flag to each draft type. Inside `update()` for each draft, when a patch contains `dailyAction` (and not `tinyAction`) and the flag is `false`, also patch `tinyAction = dailyAction`. The flag flips to `true` when the user types in the tiny field. A migration in `loadOnboardingDraft` infers the flag for old persisted drafts. The dead one-shot prefill in `DailyActionScreen.handleContinue` is removed.

**Tech Stack:** React Native + Expo, TypeScript, Jest, React Native Testing Library, AsyncStorage-backed onboarding draft persistence.

**Spec:** [`docs/superpowers/specs/2026-05-30-tiny-action-prefill-design.md`](../specs/2026-05-30-tiny-action-prefill-design.md)

---

## Task 1: Add `tinyActionTouched` to the onboarding draft type

**Files:**
- Modify: `src/features/onboarding/types.ts`

This task is type-only. No behavior change yet; subsequent tasks read the new field. After this commit, existing tests must still pass because the field defaults to `false` and nothing reads it.

- [ ] **Step 1: Add the field to `OnboardingDraft`, `EMPTY_DRAFT`, and `KNOWN_DRAFT_KEYS`**

Edit `src/features/onboarding/types.ts`:

```ts
export type OnboardingDraft = {
  step: OnboardingStep;
  becomingPhrase: string;
  dailyAction: string;
  tinyAction: string;
  tinyActionTouched: boolean;
  cueExisting: string;
  worstDayPassed: boolean | null;
  habitName: string;
  habitIcon: string | null;
  activeDays: number[];
  reminderEnabled: boolean;
  reminderTime: string;
};

export const EMPTY_DRAFT: OnboardingDraft = {
  step: "welcome",
  becomingPhrase: "",
  dailyAction: "",
  tinyAction: "",
  tinyActionTouched: false,
  cueExisting: "",
  worstDayPassed: null,
  habitName: "",
  habitIcon: null,
  activeDays: [1, 2, 3, 4, 5, 6, 7],
  reminderEnabled: true,
  reminderTime: "07:00",
};

export const KNOWN_DRAFT_KEYS = [
  "step",
  "becomingPhrase",
  "dailyAction",
  "tinyAction",
  "tinyActionTouched",
  "cueExisting",
  "worstDayPassed",
  "habitName",
  "habitIcon",
  "activeDays",
  "reminderEnabled",
  "reminderTime",
] as const satisfies readonly (keyof OnboardingDraft)[];
```

- [ ] **Step 2: Run TypeScript checks and the onboarding test suite**

Run:
```
pnpm typecheck
pnpm test -- src/features/onboarding
```

Expected: typecheck passes; all existing onboarding tests pass. (One existing storage test, "merges a draft saved with an old shape," uses `loaded.tinyAction` and `loaded.worstDayPassed` — both still defaulted from `EMPTY_DRAFT`, so it still passes.)

- [ ] **Step 3: Commit**

```
git add src/features/onboarding/types.ts
git commit -m "feat(onboarding): add tinyActionTouched flag to draft type"
```

---

## Task 2: Migrate old persisted drafts in `loadOnboardingDraft` (TDD)

**Files:**
- Modify: `src/features/onboarding/storage.ts`
- Test: `src/features/onboarding/__tests__/storage.test.ts`

Old persisted drafts (saved before this field existed) have no `tinyActionTouched` key. If we let it default to `false`, the next `dailyAction` edit would silently overwrite the user's typed `tinyAction`. Infer the flag from the loaded `tinyAction`'s length.

- [ ] **Step 1: Add three failing migration tests to `storage.test.ts`**

Locate the existing `describe("loadOnboardingDraft", () => {` block in `src/features/onboarding/__tests__/storage.test.ts` and add these three tests inside it (after the existing "drops unknown keys" test):

```ts
it("migrates an old draft with a non-empty tinyAction by setting tinyActionTouched=true", async () => {
  // Simulate a draft saved before tinyActionTouched existed.
  const oldShape = {
    step: "shrink",
    becomingPhrase: "a writer",
    dailyAction: "Write 500 words",
    tinyAction: "Open my notebook",
  };
  await setPreference(onboardingDraftKey(USER_A), JSON.stringify(oldShape));

  const loaded = await loadOnboardingDraft(USER_A);

  expect(loaded.tinyAction).toBe("Open my notebook");
  expect(loaded.tinyActionTouched).toBe(true);
});

it("migrates an old draft with an empty tinyAction by setting tinyActionTouched=false", async () => {
  const oldShape = {
    step: "daily-action",
    becomingPhrase: "a writer",
    dailyAction: "Write 500 words",
    tinyAction: "",
  };
  await setPreference(onboardingDraftKey(USER_A), JSON.stringify(oldShape));

  const loaded = await loadOnboardingDraft(USER_A);

  expect(loaded.tinyActionTouched).toBe(false);
});

it("preserves tinyActionTouched=false when the persisted draft already has the flag", async () => {
  // A draft persisted AFTER this rollout already has the flag — do not migrate over it.
  const newShape = {
    step: "shrink",
    becomingPhrase: "a writer",
    dailyAction: "Write 500 words",
    tinyAction: "Anything",
    tinyActionTouched: false,
  };
  await setPreference(onboardingDraftKey(USER_A), JSON.stringify(newShape));

  const loaded = await loadOnboardingDraft(USER_A);

  expect(loaded.tinyActionTouched).toBe(false);
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run:
```
pnpm test -- src/features/onboarding/__tests__/storage.test.ts -t "migrates an old draft"
pnpm test -- src/features/onboarding/__tests__/storage.test.ts -t "preserves tinyActionTouched"
```

Expected: The first two tests fail because `tinyActionTouched` defaults to `false` for the non-empty case. The third test passes by accident (defaults match). All three tests need to be running before moving on.

- [ ] **Step 3: Add the migration to `loadOnboardingDraft`**

Edit `src/features/onboarding/storage.ts`, replacing the inside of `loadOnboardingDraft` from `const raw = await getPreference(...)` through the `return` in the try block:

```ts
export async function loadOnboardingDraft(
  userId: string,
): Promise<OnboardingDraft> {
  await dropLegacyRowIfPresent(LEGACY_ONBOARDING_DRAFT_KEY);

  const raw = await getPreference(onboardingDraftKey(userId));
  if (raw === null) {
    return { ...EMPTY_DRAFT };
  }
  try {
    const parsed = JSON.parse(raw);
    const merged = { ...EMPTY_DRAFT, ...pickKnownDraftKeys(parsed) };

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
  } catch (error) {
    logger.warn("Failed to parse onboarding draft — resetting to empty", {
      error,
    });
    return { ...EMPTY_DRAFT };
  }
}
```

- [ ] **Step 4: Re-run the new tests to verify they pass**

Run:
```
pnpm test -- src/features/onboarding/__tests__/storage.test.ts
```

Expected: all storage tests pass.

- [ ] **Step 5: Commit**

```
git add src/features/onboarding/storage.ts src/features/onboarding/__tests__/storage.test.ts
git commit -m "feat(onboarding): migrate old drafts for tinyActionTouched"
```

---

## Task 3: Mirror `dailyAction` into `tinyAction` inside `useOnboardingDraft.update()` (TDD)

**Files:**
- Modify: `src/features/onboarding/hooks.ts`
- Test: `src/features/onboarding/__tests__/hooks.test.ts`

This is the core behavior change for the onboarding flow.

- [ ] **Step 1: Add five failing mirror tests to `hooks.test.ts`**

Append to the existing `describe("useOnboardingDraft", () => { ... })` block in `src/features/onboarding/__tests__/hooks.test.ts`:

```ts
describe("tinyAction mirror behavior", () => {
  it("mirrors dailyAction into tinyAction when tinyActionTouched is false", async () => {
    const { result } = renderHook(() => useOnboardingDraft());
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.update({ dailyAction: "Run for 5 minutes" });
    });

    expect(result.current.draft.dailyAction).toBe("Run for 5 minutes");
    expect(result.current.draft.tinyAction).toBe("Run for 5 minutes");
  });

  it("keeps mirroring on a second dailyAction edit while untouched", async () => {
    const { result } = renderHook(() => useOnboardingDraft());
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.update({ dailyAction: "Run for 5 minutes" });
    });
    act(() => {
      result.current.update({ dailyAction: "Run for 10 minutes" });
    });

    expect(result.current.draft.tinyAction).toBe("Run for 10 minutes");
  });

  it("stops mirroring once the user touches tinyAction", async () => {
    const { result } = renderHook(() => useOnboardingDraft());
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.update({ dailyAction: "Run for 5 minutes" });
    });
    act(() => {
      result.current.update({
        tinyAction: "Put on shoes",
        tinyActionTouched: true,
      });
    });
    act(() => {
      result.current.update({ dailyAction: "Run for 10 minutes" });
    });

    expect(result.current.draft.tinyAction).toBe("Put on shoes");
    expect(result.current.draft.dailyAction).toBe("Run for 10 minutes");
  });

  it("treats clearing the tinyAction as sticky — mirror does not re-engage", async () => {
    const { result } = renderHook(() => useOnboardingDraft());
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.update({
        tinyAction: "Put on shoes",
        tinyActionTouched: true,
      });
    });
    act(() => {
      result.current.update({ tinyAction: "", tinyActionTouched: true });
    });
    act(() => {
      result.current.update({ dailyAction: "Run for 5 minutes" });
    });

    expect(result.current.draft.tinyAction).toBe("");
  });

  it("does not apply the mirror when the same patch sets both dailyAction and tinyAction (defensive — no current caller does this)", async () => {
    const { result } = renderHook(() => useOnboardingDraft());
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.update({
        dailyAction: "Run for 5 minutes",
        tinyAction: "Put on shoes",
      });
    });

    expect(result.current.draft.tinyAction).toBe("Put on shoes");
    expect(result.current.draft.dailyAction).toBe("Run for 5 minutes");
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run:
```
pnpm test -- src/features/onboarding/__tests__/hooks.test.ts -t "tinyAction mirror behavior"
```

Expected: the first two mirror tests fail (`tinyAction` is still `""` after `dailyAction` is patched), the third and fourth pass by accident (no mirror exists yet, so `tinyAction` is left alone), and the fifth passes by accident. All five must be running.

- [ ] **Step 3: Add the mirror to `useOnboardingDraft.update()`**

Edit `src/features/onboarding/hooks.ts`. Replace the body of the `update` callback (currently starts with `const next = { ...draftRef.current, ...patch };`):

```ts
const update = useCallback(
  (patch: Partial<OnboardingDraft>) => {
    const next = { ...draftRef.current, ...patch };
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
    draftRef.current = next;
    setDraft(next);

    if (!userId) {
      return;
    }

    if (pendingTimer.current !== null) {
      clearTimeout(pendingTimer.current);
    }
    pendingUserIdRef.current = userId;
    pendingTimer.current = setTimeout(() => {
      void saveOnboardingDraft(userId, draftRef.current);
      pendingTimer.current = null;
    }, 200);
  },
  [userId],
);
```

- [ ] **Step 4: Re-run the new tests to verify they pass**

Run:
```
pnpm test -- src/features/onboarding/__tests__/hooks.test.ts
```

Expected: all five new tests pass; all existing `useOnboardingDraft` tests still pass.

- [ ] **Step 5: Commit**

```
git add src/features/onboarding/hooks.ts src/features/onboarding/__tests__/hooks.test.ts
git commit -m "feat(onboarding): mirror dailyAction into tinyAction until touched"
```

---

## Task 4: Set `tinyActionTouched` from `ShrinkScreen`'s `onChangeText` (TDD)

**Files:**
- Modify: `src/features/onboarding/screens/ShrinkScreen.tsx`
- Test: `src/features/onboarding/__tests__/screens/ShrinkScreen.test.tsx`

So that the user typing in the tiny field flips the flag and stops the mirror.

- [ ] **Step 1: Update `makeDraft` and add a failing test in `ShrinkScreen.test.tsx`**

Edit `src/features/onboarding/__tests__/screens/ShrinkScreen.test.tsx`. First, extend `makeDraft` so the new field exists in mock state:

```ts
function makeDraft(overrides: object = {}) {
  return {
    step: "shrink",
    becomingPhrase: "a runner",
    dailyAction: "Run for 30 minutes",
    tinyAction: "",
    tinyActionTouched: false,
    cueExisting: "",
    worstDayPassed: null,
    habitName: "",
    habitIcon: null,
    ...overrides,
  };
}
```

Then add a new test inside the `describe("ShrinkScreen", () => { ... })` block (after the existing "Continue button calls update and router.push" test):

```ts
it("typing in the tiny field flips tinyActionTouched", () => {
  const mockUpdate = jest.fn();
  useOnboarding.mockReturnValue({ draft: makeDraft(), update: mockUpdate });

  render(<ShrinkScreen />);

  fireEvent.changeText(
    screen.getByPlaceholderText("Make it even smaller..."),
    "Open my shoes",
  );

  expect(mockUpdate).toHaveBeenCalledWith({
    tinyAction: "Open my shoes",
    tinyActionTouched: true,
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:
```
pnpm test -- src/features/onboarding/__tests__/screens/ShrinkScreen.test.tsx -t "tinyActionTouched"
```

Expected: fails. The current `onChangeText` only sends `{ tinyAction: text }`.

- [ ] **Step 3: Update `ShrinkScreen.tsx`'s `onChangeText`**

In `src/features/onboarding/screens/ShrinkScreen.tsx`, find the tiny-action `OnboardingInput`:

```tsx
<OnboardingInput
  label="Your tiny version"
  placeholder="Make it even smaller..."
  value={draft.tinyAction}
  onChangeText={(text) => update({ tinyAction: text })}
/>
```

Change the `onChangeText` to:

```tsx
<OnboardingInput
  label="Your tiny version"
  placeholder="Make it even smaller..."
  value={draft.tinyAction}
  onChangeText={(text) =>
    update({ tinyAction: text, tinyActionTouched: true })
  }
/>
```

- [ ] **Step 4: Re-run the screen tests to verify they pass**

Run:
```
pnpm test -- src/features/onboarding/__tests__/screens/ShrinkScreen.test.tsx
```

Expected: all `ShrinkScreen` tests pass.

- [ ] **Step 5: Commit**

```
git add src/features/onboarding/screens/ShrinkScreen.tsx src/features/onboarding/__tests__/screens/ShrinkScreen.test.tsx
git commit -m "feat(onboarding): ShrinkScreen sets tinyActionTouched on input"
```

---

## Task 5: Remove the dead one-shot prefill in `DailyActionScreen.handleContinue`

**Files:**
- Modify: `src/features/onboarding/screens/DailyActionScreen.tsx`

With the mirror in `update()`, the `tinyAction.trim().length === 0` branch in `handleContinue` can no longer fire (the gate above requires `dailyAction.trim().length >= 2`, the mirror writes `tinyAction = dailyAction` on every `dailyAction` patch). The branch also bypasses `tinyActionTouched`, which is semantically wrong. Delete it.

There is no existing `DailyActionScreen.test.tsx` — verified via repo search. No tests need updating for this task.

- [ ] **Step 1: Simplify `handleContinue`**

In `src/features/onboarding/screens/DailyActionScreen.tsx`, replace `handleContinue` with the simple form. Also drop the now-unused `OnboardingDraft` type import.

Before:
```tsx
import type { OnboardingDraft } from "@/features/onboarding/types";
// …
const handleContinue = () => {
  const next: Partial<OnboardingDraft> = { step: "shrink-insight" };
  if (draft.tinyAction.trim().length === 0) {
    next.tinyAction = draft.dailyAction;
  }
  update(next);
  router.push("/(onboarding)/shrink-insight");
};
```

After:
```tsx
// …
const handleContinue = () => {
  update({ step: "shrink-insight" });
  router.push("/(onboarding)/shrink-insight");
};
```

Remove the `import type { OnboardingDraft } from "@/features/onboarding/types";` line at the top of the file.

- [ ] **Step 2: Run typecheck and the onboarding suite**

Run:
```
pnpm typecheck
pnpm test -- src/features/onboarding
```

Expected: typecheck passes (no orphan `OnboardingDraft` import); all onboarding tests pass.

- [ ] **Step 3: Commit**

```
git add src/features/onboarding/screens/DailyActionScreen.tsx
git commit -m "refactor(onboarding): remove dead tinyAction prefill in DailyActionScreen"
```

---

## Task 6: Add `tinyActionTouched` to `CreateHabitDraft` and mirror in `CreateHabitFlow.update()`

**Files:**
- Modify: `src/features/habits/screens/CreateHabitFlow.tsx`
- Test: `src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx`

`CreateHabitFlow`'s draft is session-local `useState` — no migration needed.

- [ ] **Step 1: Add a failing screen test for the mirror**

Open `src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx`. Add this test inside the existing `describe("CreateHabitFlow — save-for-later path", () => { ... })` block (its `beforeEach` already wires `queryClient`, `mockMutateAsync`, and `mockUseCreateHabitMutation`):

```ts
it("auto-fills the tiny-action field with the daily action on arrival at BuildStep", async () => {
  mockAssertCanCreateActiveHabit.mockResolvedValue({ ok: true });

  render(<CreateHabitFlow />, { wrapper });

  // ActionStep
  await act(async () => {
    fireEvent.changeText(
      screen.getByPlaceholderText(/Goes for a walk/),
      "Walk to the mailbox",
    );
  });
  await act(async () => {
    fireEvent.press(screen.getByText("Continue"));
  });

  // BuildStep: the tiny input should already hold the daily action.
  const tinyInput = await screen.findByPlaceholderText(/Make it even smaller/);
  expect(tinyInput.props.value).toBe("Walk to the mailbox");
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:
```
pnpm test -- src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx -t "auto-fills the tiny-action field"
```

Expected: fails. The tiny input's `value` is `""`.

- [ ] **Step 3: Add `tinyActionTouched` to `CreateHabitDraft`, `EMPTY_DRAFT`, and the mirror to `update()`**

Edit `src/features/habits/screens/CreateHabitFlow.tsx`:

In the `CreateHabitDraft` type:

```ts
export type CreateHabitDraft = {
  identityPhrase: string;
  dailyAction: string;
  tinyAction: string;
  tinyActionTouched: boolean;
  cue: string;
  habitName: string;
  icon: string;
  activeDays: number[];
  reminderTime: string | null;
};
```

In `EMPTY_DRAFT`:

```ts
const EMPTY_DRAFT: CreateHabitDraft = {
  identityPhrase: "",
  dailyAction: "",
  tinyAction: "",
  tinyActionTouched: false,
  cue: "",
  habitName: "",
  icon: "",
  activeDays: [1, 2, 3, 4, 5, 6, 7],
  reminderTime: null,
};
```

Replace the `update` function:

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

- [ ] **Step 4: Re-run the new test to verify it passes**

Run:
```
pnpm test -- src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx -t "auto-fills the tiny-action field"
```

Expected: passes.

- [ ] **Step 5: Run all CreateHabitFlow tests to confirm no regressions**

Run:
```
pnpm test -- src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx
```

Expected: all tests pass. The existing `walkToWorstday` helper types "run for 2 minutes" into the tiny field — that path still works because typing into tiny is allowed at any time.

- [ ] **Step 6: Commit**

```
git add src/features/habits/screens/CreateHabitFlow.tsx src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx
git commit -m "feat(create-habit): mirror dailyAction into tinyAction until touched"
```

---

## Task 7: Set `tinyActionTouched` from `BuildStep`'s `onChangeText` and verify back-navigation preservation

**Files:**
- Modify: `src/features/habits/screens/CreateHabitFlow.tsx`
- Test: `src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx`

So that typing in the tiny field flips the flag. Without this, if the user types in tiny and then goes back to ActionStep to revise the daily action, the mirror would re-trigger and clobber the typed tiny value.

- [ ] **Step 1: Add a failing screen test for back-nav preservation**

Add this test inside the same `describe("CreateHabitFlow — save-for-later path", () => { ... })` block in `src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx`:

```ts
it("does not clobber a typed tiny version when the user goes back and edits the daily action", async () => {
  mockAssertCanCreateActiveHabit.mockResolvedValue({ ok: true });

  render(<CreateHabitFlow />, { wrapper });

  // ActionStep — type the daily action.
  await act(async () => {
    fireEvent.changeText(
      screen.getByPlaceholderText(/Goes for a walk/),
      "Walk to the mailbox",
    );
  });
  await act(async () => {
    fireEvent.press(screen.getByText("Continue"));
  });

  // BuildStep — user shrinks the tiny version themselves.
  await act(async () => {
    fireEvent.changeText(
      await screen.findByPlaceholderText(/Make it even smaller/),
      "Stand at the door",
    );
  });

  // Press back (BackRow has accessibilityLabel="Go back") → ActionStep.
  await act(async () => {
    fireEvent.press(screen.getByLabelText("Go back"));
  });

  // Edit the daily action.
  await act(async () => {
    fireEvent.changeText(
      await screen.findByPlaceholderText(/Goes for a walk/),
      "Run a mile",
    );
  });

  // Advance back to BuildStep.
  await act(async () => {
    fireEvent.press(screen.getByText("Continue"));
  });

  // Tiny field must still hold the user-typed value — the mirror should have
  // been disabled by the earlier tinyAction edit.
  const tinyInputAgain = await screen.findByPlaceholderText(
    /Make it even smaller/,
  );
  expect(tinyInputAgain.props.value).toBe("Stand at the door");
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:
```
pnpm test -- src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx -t "does not clobber"
```

Expected: fails. After Task 6 the mirror is in place, but `BuildStep`'s `onChangeText` still calls `update({ tinyAction: text })` without setting `tinyActionTouched: true`. So when the user later edits `dailyAction`, the mirror fires and overwrites the tiny field with `"Run a mile"`.

- [ ] **Step 3: Update `BuildStep`'s tiny-field `onChangeText` to flip the flag**

In `src/features/habits/screens/CreateHabitFlow.tsx`, locate the tiny-action `OnboardingInput` inside `BuildStep`:

```tsx
<OnboardingInput
  ref={tinyActionRef}
  label="Your tiny version"
  placeholder="Make it even smaller..."
  value={draft.tinyAction}
  onChangeText={(text) => update({ tinyAction: text })}
/>
```

Change to:

```tsx
<OnboardingInput
  ref={tinyActionRef}
  label="Your tiny version"
  placeholder="Make it even smaller..."
  value={draft.tinyAction}
  onChangeText={(text) =>
    update({ tinyAction: text, tinyActionTouched: true })
  }
/>
```

- [ ] **Step 4: Run the full CreateHabitFlow test suite to confirm no regressions**

Run:
```
pnpm test -- src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx
```

Expected: all tests pass, including the existing `walkToWorstday`-based flows.

- [ ] **Step 5: Commit**

```
git add src/features/habits/screens/CreateHabitFlow.tsx src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx
git commit -m "feat(create-habit): BuildStep sets tinyActionTouched on input"
```

---

## Task 8: Final verification

**Files:** none modified — verification only.

- [ ] **Step 1: Run the full test suite**

Run:
```
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Run the typecheck**

Run:
```
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual smoke (optional but recommended)**

If a local dev environment is available:
1. Start the app and walk through Create Habit (Goal path).
2. Type a daily action on ActionStep, advance — confirm the tiny field on BuildStep is pre-filled with the same text.
3. Go back to ActionStep, change the daily action, advance again — tiny field should follow.
4. Edit the tiny field to a smaller version. Go back to ActionStep, change daily — tiny field should NOT change anymore.
5. Repeat in onboarding: DailyActionScreen → ShrinkScreen. Confirm tiny is pre-filled with the daily action.

No commit for this task.
