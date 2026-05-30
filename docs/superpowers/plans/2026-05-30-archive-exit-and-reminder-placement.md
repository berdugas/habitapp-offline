# Archive-delete exit + reminder placement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make permanent-delete on archived detail screens exit the archive flow cleanly (mirroring restore's intent without copying its destination), and move the easily-missed ReminderPicker out of the Build step into Personalize so users actually see it during habit creation.

**Architecture:**
Two independent local changes to existing React Native screens. Fix 1 swaps `router.replace("/(app)/habits/backlog")` for a `canDismiss`/`dismissAll`-with-fallback pattern in two screens. Fix 2 deletes a `<ReminderPicker>` JSX block from `BuildStep` and inserts an equivalent block inside `PersonalizeStep`'s `phase === "personalize"` branch. No data model, schema, or API changes.

**Tech Stack:** React Native, Expo Router, React Query, Jest + @testing-library/react-native.

---

## Reference

- **Spec:** `docs/superpowers/specs/2026-05-30-archive-exit-and-reminder-placement-design.md`
- **Layout assumption (Fix 1):** archive detail routes live under the `(app)/_layout.tsx` `<Stack>`. If anyone has restructured the route group since this plan was written, re-verify `router.canDismiss()` behaves as expected before proceeding. Task 1 Step 0 has a one-line grep to confirm.

## Jest invocation notes

All `npx jest ...` commands below run without any `--testPathIgnorePatterns` override. Earlier drafts of this plan added `--testPathIgnorePatterns=""` defensively (to escape the project's `<rootDir>/.claude/` ignore when working from inside a worktree under `.claude/worktrees/`). Empirically this **breaks** test discovery: jest 29 interprets `[""]` as a regex matching every path, silently filtering out all tests. Inside a worktree, `<rootDir>` resolves to the worktree path itself — so the project's `<rootDir>/.claude/` pattern targets a non-existent subdirectory and is harmless. Use plain `npx jest <path> --runInBand`.

## Mock-reset note (applies to Tasks 1 and 2)

The mock setup uses `jest.clearAllMocks()` + an explicit `mockCanDismiss.mockReturnValue(true)` reset. **Do not "simplify" this to `jest.resetAllMocks()`** — `resetAllMocks` resets the implementation too, undoing the `() => true` default and leaving `canDismiss` as a bare `jest.fn()` that returns `undefined`. That breaks every main-path delete test (the `if (router.canDismiss())` branch evaluates falsy and triggers the deep-link fallback path instead). The explicit reset pattern is correct as written.

---

## Task 1 — ArchivedHabitDetailScreen: delete exits cleanly

**Files:**
- Modify: `src/features/habits/screens/ArchivedHabitDetailScreen.tsx` — `handleDeleteHabit` (currently around line 234, the post-`await mutateAsync` line)
- Modify: `src/features/habits/screens/__tests__/ArchivedHabitDetailScreen.test.tsx` — expo-router mock (lines 20-30) + the existing delete-success test (lines 338-364)

- [ ] **Step 0: Pre-flight — confirm layout assumption holds**

The `dismissAll` / `canDismiss` semantics depend on archive detail being mounted inside a `<Stack>` navigator. Verify in one command:

```bash
grep -n "Stack" app/\(app\)/_layout.tsx
```

Expected: at least one line shows `import { ... Stack ... } from "expo-router"` and another shows `<Stack>` as the root JSX wrapping the `habits/archived/[habitId]` screen entry. If the layout has been refactored to something else (Drawer, custom navigator, etc.), STOP and re-verify the canDismiss/dismissAll behaviour before proceeding — the plan's navigation assumptions may no longer hold.

- [ ] **Step 1: Add `canDismiss` to the expo-router test mock**

Open `src/features/habits/screens/__tests__/ArchivedHabitDetailScreen.test.tsx`.

Above the existing `mockReplace` / `mockDismissAll` declarations (currently lines 20-21), add a third mock fn. Then expose it on the router object inside `jest.mock("expo-router", ...)`.

Replace the existing block (lines 20-30):

```ts
const mockReplace = jest.fn();
const mockDismissAll = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
    dismissAll: () => mockDismissAll(),
  },
  useLocalSearchParams: () => ({ habitId: "h1" }),
}));
```

with:

```ts
const mockReplace = jest.fn();
const mockDismissAll = jest.fn();
// Default: a back-stack exists (Settings → Backlog → ArchivedDetail). Tests
// that exercise the deep-link case set this to false via mockReturnValueOnce.
const mockCanDismiss = jest.fn(() => true);

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
    dismissAll: () => mockDismissAll(),
    // Lazy lookup so per-test mockReturnValueOnce overrides take effect.
    canDismiss: () => mockCanDismiss(),
  },
  useLocalSearchParams: () => ({ habitId: "h1" }),
}));
```

Also extend the `beforeEach` block (currently starts at line 83) to reset the new mock to its default. Inside the existing `beforeEach`, after `jest.clearAllMocks()`, add:

```ts
  mockCanDismiss.mockReturnValue(true);
```

- [ ] **Step 2: Rewrite the existing delete-success test to assert dismissAll + replace.not.toHaveBeenCalled**

Replace the existing test (currently lines 338-364, `it("uses .replace to /habits/backlog on success ...")`) with two tests — the main path and a deep-link variant.

Replace:

```ts
    it("uses .replace to /habits/backlog on success — direct-open + stale-stack cases are deterministic", async () => {
      const deleteMutate = jest.fn().mockResolvedValue(undefined);
      useDeleteHabitMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: deleteMutate,
        isPending: false,
        error: null,
      });
      const alertSpy = jest
        .spyOn(require("react-native").Alert, "alert")
        .mockImplementation(((_t: string, _m: string, btns: Array<{ text: string; onPress?: () => void }>) => {
          btns.find((b) => b.text === "Delete")?.onPress?.();
        }) as never);

      renderWithClient(<ArchivedHabitDetailScreen />);
      fireEvent.press(
        screen.getByRole("button", { name: "Delete permanently" }),
      );

      await waitFor(() => {
        expect(deleteMutate).toHaveBeenCalledWith({ habitId: "h1" });
      });
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/(app)/habits/backlog");
      });
      alertSpy.mockRestore();
    });
```

with:

```ts
    it("on success pops the pushed stack with dismissAll — does NOT replace (would leave a duplicate Backlog/Today behind)", async () => {
      // Mirrors the restore-success intent (clean exit) but does NOT force-
      // replace to Today: a deleted habit has no destination view, so we
      // return to whichever tab launched the archive flow. dismissAll is
      // gated on canDismiss=true (the default beforeEach value).
      const deleteMutate = jest.fn().mockResolvedValue(undefined);
      useDeleteHabitMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: deleteMutate,
        isPending: false,
        error: null,
      });
      const alertSpy = jest
        .spyOn(require("react-native").Alert, "alert")
        .mockImplementation(((_t: string, _m: string, btns: Array<{ text: string; onPress?: () => void }>) => {
          btns.find((b) => b.text === "Delete")?.onPress?.();
        }) as never);

      renderWithClient(<ArchivedHabitDetailScreen />);
      fireEvent.press(
        screen.getByRole("button", { name: "Delete permanently" }),
      );

      await waitFor(() => {
        expect(deleteMutate).toHaveBeenCalledWith({ habitId: "h1" });
      });
      await waitFor(() => {
        expect(mockDismissAll).toHaveBeenCalledTimes(1);
      });
      // On the main path the stale-route effect can't fire (isFullyArchived
      // is true), so replace shouldn't be called at all. Tighter than
      // "not called with the today route" — catches a wider regression.
      expect(mockReplace).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it("on success with no back-stack (deep-link cold start) falls back to replace(Today)", async () => {
      // canDismiss=false means the archived detail screen is the only route
      // on the stack — happens when the user deep-links straight here.
      // Without the fallback, dismissAll would no-op and the user would be
      // stranded on a screen showing a habit that no longer exists.
      mockCanDismiss.mockReturnValueOnce(false);
      const deleteMutate = jest.fn().mockResolvedValue(undefined);
      useDeleteHabitMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: deleteMutate,
        isPending: false,
        error: null,
      });
      const alertSpy = jest
        .spyOn(require("react-native").Alert, "alert")
        .mockImplementation(((_t: string, _m: string, btns: Array<{ text: string; onPress?: () => void }>) => {
          btns.find((b) => b.text === "Delete")?.onPress?.();
        }) as never);

      renderWithClient(<ArchivedHabitDetailScreen />);
      fireEvent.press(
        screen.getByRole("button", { name: "Delete permanently" }),
      );

      await waitFor(() => {
        expect(deleteMutate).toHaveBeenCalledWith({ habitId: "h1" });
      });
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/(app)/(tabs)/today");
      });
      expect(mockDismissAll).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });
```

- [ ] **Step 3: Run the updated test file — both new tests should FAIL**

Run:

```bash
npx jest src/features/habits/screens/__tests__/ArchivedHabitDetailScreen.test.tsx --runInBand
```

Expected:
- The main-path test fails because the current impl calls `router.replace("/(app)/habits/backlog")` instead of `router.dismissAll()`.
- The deep-link variant test fails because the current impl ignores `canDismiss` entirely.
- All other tests still pass (the new `canDismiss` mock is additive).

- [ ] **Step 4: Update `handleDeleteHabit` in `ArchivedHabitDetailScreen.tsx`**

Open `src/features/habits/screens/ArchivedHabitDetailScreen.tsx`. Replace the body of `handleDeleteHabit` (currently lines 228-238):

```ts
  async function handleDeleteHabit() {
    if (!habit || deleteHabitMutation.isPending) return;
    startExit();
    try {
      // api.ts deleteHabit cancels the OS reminder before deleting the row.
      await deleteHabitMutation.mutateAsync({ habitId: habit.id });
      router.replace("/(app)/habits/backlog");
    } catch {
      cancelExit();
    }
  }
```

with:

```ts
  async function handleDeleteHabit() {
    if (!habit || deleteHabitMutation.isPending) return;
    startExit();
    try {
      // api.ts deleteHabit cancels the OS reminder before deleting the row.
      await deleteHabitMutation.mutateAsync({ habitId: habit.id });
      // Pop every pushed route back to the active tab root — returns the
      // user to whichever tab launched the archive flow (Settings if they
      // came to clean up, Today if they came via a goal). Deliberately
      // does NOT force-replace to Today like restore does: a deleted habit
      // has no destination view, so anchoring there would mislead. The
      // canDismiss fallback covers deep-link cold-starts where this screen
      // is the only route on the stack — without it the user would be
      // stranded on a screen showing the deleted habit.
      if (router.canDismiss()) {
        router.dismissAll();
      } else {
        router.replace("/(app)/(tabs)/today");
      }
    } catch {
      cancelExit();
    }
  }
```

Leave `startExit()` / `cancelExit()` exactly as-is — the submit-lock and `isExiting` render-suppression behaviour must survive unchanged.

- [ ] **Step 5: Run the test file — should now pass**

Run:

```bash
npx jest src/features/habits/screens/__tests__/ArchivedHabitDetailScreen.test.tsx --runInBand
```

Expected: all tests pass, including the two new delete tests and every pre-existing test (restore, stale-route, read-only, etc.).

- [ ] **Step 6: Commit**

```bash
git add src/features/habits/screens/ArchivedHabitDetailScreen.tsx \
        src/features/habits/screens/__tests__/ArchivedHabitDetailScreen.test.tsx
git commit -m "fix(archive): habit delete exits via dismissAll instead of replacing to Backlog

Mirrors restore's clean-exit intent without copying its destination —
deleted habits have no destination view, so we return to the source tab
(Settings if the user came to clean up, Today if they came via a goal)
rather than force-anchoring to Today.

Fallback to replace(Today) covers deep-link cold-starts where canDismiss
is false."
```

---

## Task 2 — ArchivedGoalDetailScreen: delete exits cleanly

**Files:**
- Modify: `src/features/today/screens/ArchivedGoalDetailScreen.tsx` — `handleDeleteGoal` (currently around line 275)
- Modify: `src/features/today/__tests__/ArchivedGoalDetailScreen.test.tsx` — expo-router mock (lines 20-32) + the existing delete-success test (lines 521-550)

- [ ] **Step 1: Add `canDismiss` to the expo-router test mock**

Open `src/features/today/__tests__/ArchivedGoalDetailScreen.test.tsx`.

Replace the existing block (lines 20-32):

```ts
const mockReplace = jest.fn();

const mockPush = jest.fn();
const mockDismissAll = jest.fn();
jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    dismissAll: () => mockDismissAll(),
  },
  useLocalSearchParams: () => ({ identityPhrase: "a%20writer" }),
}));
```

with:

```ts
const mockReplace = jest.fn();

const mockPush = jest.fn();
const mockDismissAll = jest.fn();
// Default: a back-stack exists. Tests that exercise the deep-link case set
// this to false via mockReturnValueOnce.
const mockCanDismiss = jest.fn(() => true);
jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    dismissAll: () => mockDismissAll(),
    // Lazy lookup so per-test mockReturnValueOnce overrides take effect.
    canDismiss: () => mockCanDismiss(),
  },
  useLocalSearchParams: () => ({ identityPhrase: "a%20writer" }),
}));
```

Also extend the `beforeEach` block (currently starts at line 90) to reset the new mock. After `jest.clearAllMocks()`, add:

```ts
  mockCanDismiss.mockReturnValue(true);
```

- [ ] **Step 2: Rewrite the existing delete-success test as two tests**

Replace the existing test (currently lines 521-550, `it("uses .replace (not .back) on success ...")`) with:

```ts
    it("on success pops the pushed stack with dismissAll — does NOT replace (would leave a duplicate Backlog/Today behind)", async () => {
      // Mirrors the restore-success intent (clean exit) but does NOT force-
      // replace to Today: a deleted goal has no destination view, so we
      // return to whichever tab launched the archive flow. dismissAll is
      // gated on canDismiss=true (the default beforeEach value).
      const deleteMutate = jest.fn().mockResolvedValue({
        deletedHabitCount: 1,
        deletedHabitIds: ["h1"],
      });
      useDeleteGoalMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: deleteMutate,
        isPending: false,
        error: null,
      });
      const alertSpy = jest
        .spyOn(require("react-native").Alert, "alert")
        .mockImplementation(((_t: string, _m: string, btns: Array<{ text: string; onPress?: () => void }>) => {
          btns.find((b) => b.text === "Delete")?.onPress?.();
        }) as never);

      renderWithClient(<ArchivedGoalDetailScreen />);
      fireEvent.press(
        screen.getByRole("button", { name: "Delete permanently" }),
      );

      await waitFor(() => {
        expect(deleteMutate).toHaveBeenCalledWith({ identityPhrase: "a writer" });
      });
      await waitFor(() => {
        expect(mockDismissAll).toHaveBeenCalledTimes(1);
      });
      // On the main path the stale-route effect can't fire (the default
      // mock returns a fully-archived goal), so replace shouldn't be
      // called at all. Tighter than "not called with the today route".
      expect(mockReplace).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it("on success with no back-stack (deep-link cold start) falls back to replace(Today)", async () => {
      // canDismiss=false means the archived goal detail screen is the only
      // route on the stack — happens when the user deep-links straight here.
      mockCanDismiss.mockReturnValueOnce(false);
      const deleteMutate = jest.fn().mockResolvedValue({
        deletedHabitCount: 1,
        deletedHabitIds: ["h1"],
      });
      useDeleteGoalMutation.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: deleteMutate,
        isPending: false,
        error: null,
      });
      const alertSpy = jest
        .spyOn(require("react-native").Alert, "alert")
        .mockImplementation(((_t: string, _m: string, btns: Array<{ text: string; onPress?: () => void }>) => {
          btns.find((b) => b.text === "Delete")?.onPress?.();
        }) as never);

      renderWithClient(<ArchivedGoalDetailScreen />);
      fireEvent.press(
        screen.getByRole("button", { name: "Delete permanently" }),
      );

      await waitFor(() => {
        expect(deleteMutate).toHaveBeenCalledWith({ identityPhrase: "a writer" });
      });
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/(app)/(tabs)/today");
      });
      expect(mockDismissAll).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });
```

- [ ] **Step 3: Run the updated test file — both new tests should FAIL**

Run:

```bash
npx jest src/features/today/__tests__/ArchivedGoalDetailScreen.test.tsx --runInBand
```

Expected: the two new delete tests fail (current impl still does `router.replace("/(app)/habits/backlog")`). All other tests still pass.

- [ ] **Step 4: Update `handleDeleteGoal` in `ArchivedGoalDetailScreen.tsx`**

Open `src/features/today/screens/ArchivedGoalDetailScreen.tsx`. Replace the body of `handleDeleteGoal` (currently lines 268-279):

```ts
  async function handleDeleteGoal() {
    if (!identityPhrase || deleteGoalMutation.isPending) return;
    startExit();
    try {
      await deleteGoalMutation.mutateAsync({ identityPhrase });
      // .replace, not .back — direct-open / stale-stack cases make .back
      // non-deterministic, and the destination is always Archive list.
      router.replace("/(app)/habits/backlog");
    } catch {
      cancelExit();
    }
  }
```

with:

```ts
  async function handleDeleteGoal() {
    if (!identityPhrase || deleteGoalMutation.isPending) return;
    startExit();
    try {
      await deleteGoalMutation.mutateAsync({ identityPhrase });
      // Pop every pushed route back to the active tab root — returns the
      // user to whichever tab launched the archive flow. Deliberately does
      // NOT force-replace to Today like restore does: a deleted goal has
      // no destination view, so anchoring there would mislead. The
      // canDismiss fallback covers deep-link cold-starts where this screen
      // is the only route on the stack.
      if (router.canDismiss()) {
        router.dismissAll();
      } else {
        router.replace("/(app)/(tabs)/today");
      }
    } catch {
      cancelExit();
    }
  }
```

Leave `startExit()` / `cancelExit()` exactly as-is.

- [ ] **Step 5: Run the test file — should now pass**

Run:

```bash
npx jest src/features/today/__tests__/ArchivedGoalDetailScreen.test.tsx --runInBand
```

Expected: all tests pass, including the two new delete tests and the existing restore-success / stale-route / flash-guard tests.

- [ ] **Step 6: Commit**

```bash
git add src/features/today/screens/ArchivedGoalDetailScreen.tsx \
        src/features/today/__tests__/ArchivedGoalDetailScreen.test.tsx
git commit -m "fix(archive): goal delete exits via dismissAll instead of replacing to Backlog

Same pattern as habit delete — returns to source tab rather than
force-anchoring to Today (no destination view to anchor on). Fallback
to replace(Today) covers deep-link cold-starts."
```

---

## Task 3 — Move ReminderPicker from Build step to Personalize step

**Files:**
- Modify: `src/features/habits/screens/CreateHabitFlow.tsx` — remove ReminderPicker block from `BuildStep` (around lines 600-603), add equivalent block to `PersonalizeStep` personalize-phase branch (around line 953)
- Modify: `src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx` — relocate the `withReminder` toggle block inside `walkToWorstday` (currently lines 91-101)

- [ ] **Step 1: Update the `walkToWorstday` helper to toggle reminder in the personalize phase**

Open `src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx`. Replace the whole helper body (currently lines 67-121) with:

```ts
async function walkToWorstday(options: { withReminder?: boolean } = {}) {
  // Starts at "action" step because goalIdentityPhrase was injected.
  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText(/Goes for a walk/), "Run");
  });
  await act(async () => {
    fireEvent.press(screen.getByText("Continue"));
  });

  // Build step: tinyAction + cue.
  await screen.findByPlaceholderText(/Make it even smaller/);
  await act(async () => {
    fireEvent.changeText(
      screen.getByPlaceholderText(/Make it even smaller/),
      "run for 2 minutes",
    );
  });
  await act(async () => {
    fireEvent.changeText(
      screen.getByPlaceholderText(/brush my teeth/),
      "morning coffee",
    );
  });

  await act(async () => {
    fireEvent.press(screen.getByText("Continue"));
  });

  // Personalize phase: habit name → optional reminder toggle → "Looks good".
  // The ReminderPicker now lives in the personalize-phase block of
  // PersonalizeStep (moved from BuildStep so users actually see it). It's
  // hidden again once we enter the worstday phase, so the toggle must fire
  // BEFORE pressing "Looks good".
  await screen.findByPlaceholderText("Tap to name");
  await act(async () => {
    fireEvent.changeText(
      screen.getByPlaceholderText("Tap to name"),
      "Morning run",
    );
  });

  if (options.withReminder) {
    // Flip the ReminderPicker's Switch on. It accepts onValueChange with the
    // new boolean; turning it on sets draft.reminderTime to "07:00".
    // UNSAFE_getByType still works because there's exactly one Switch on
    // screen during the personalize phase too.
    await act(async () => {
      const sw = screen.UNSAFE_getByType(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("react-native").Switch,
      );
      fireEvent(sw, "valueChange", true);
    });
  }

  await act(async () => {
    fireEvent.press(screen.getByText("Looks good"));
  });

  // Wait until the worstday phase content appears.
  await screen.findByText(/One last check/);
}
```

- [ ] **Step 2: Run the test file — `withReminder: true` tests should FAIL**

Run:

```bash
npx jest src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx --runInBand
```

Expected: the two tests that call `walkToWorstday({ withReminder: true })` (currently around lines 230 and 253, "active save WITH reminderTime" and "backlog save WITH reminderTime") fail — the helper tries `screen.UNSAFE_getByType(Switch)` in the personalize phase, but the Switch is still in BuildStep. Error message will mention no Switch found / unable to find element of type Switch. The `withReminder: false` tests still pass.

- [ ] **Step 3: Remove ReminderPicker from BuildStep**

Open `src/features/habits/screens/CreateHabitFlow.tsx`. In `BuildStep` (the function returning the build-step JSX), find this block (currently lines 600-603, after the `ActiveDaysPicker` wrapper):

```tsx
      <ReminderPicker
        value={draft.reminderTime}
        onChange={(t) => update({ reminderTime: t })}
      />
```

Delete those four lines. The `ActiveDaysPicker` block above it stays — active days define when the habit applies and remains a Build-step decision.

Leave the `import { ReminderPicker }` at the top of the file untouched — `PersonalizeStep` (same file) needs it in the next step.

- [ ] **Step 4: Add ReminderPicker to PersonalizeStep's personalize-phase block**

Still in `CreateHabitFlow.tsx`. In `PersonalizeStep`, find the existing `micro` text block in the scroll body (currently lines 953-955):

```tsx
        {phase === "personalize" ? (
          <Text style={styles.micro}>You can rename or change the icon anytime.</Text>
        ) : null}
```

Insert a sibling block immediately after it:

```tsx
        {phase === "personalize" ? (
          <Text style={styles.micro}>You can rename or change the icon anytime.</Text>
        ) : null}

        {phase === "personalize" ? (
          <ReminderPicker
            value={draft.reminderTime}
            onChange={(t) => update({ reminderTime: t })}
          />
        ) : null}
```

Do not wrap the picker in any layout container — it has its own internal label ("Add a reminder") and card styling.

- [ ] **Step 5: Run the test file — should now pass**

Run:

```bash
npx jest src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx --runInBand
```

Expected: all tests pass — both reminder-branching tests now find the Switch in the personalize phase, and the no-reminder tests still pass because they never touch the Switch.

- [ ] **Step 6: Run the full test suite for the touched files together**

Belt-and-braces: verify the three modified test files are mutually consistent and nothing else broke.

```bash
npx jest \
  src/features/habits/screens/__tests__/ArchivedHabitDetailScreen.test.tsx \
  src/features/today/__tests__/ArchivedGoalDetailScreen.test.tsx \
  src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx \
  --runInBand
```

Expected: all three files pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/habits/screens/CreateHabitFlow.tsx \
        src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx
git commit -m "fix(create-habit): move ReminderPicker from Build to Personalize step

Reminder was buried at the bottom of BuildStep (after tinyAction, cue,
formula card, and ActiveDaysPicker) and users didn't realise it
existed. Move it into PersonalizeStep's personalize-phase block where
it sits below the preview card and is impossible to miss. Hidden during
the worst-day gate phase, matching how the preview card itself locks.

No data-model change — draft.reminderTime already lives on the shared
draft and handleSave already reads it."
```

---

## Task 4 — Device-eyeball check + remediation if needed

**Files (only if visual remediation is needed):**
- Modify: `src/features/habits/screens/CreateHabitFlow.tsx` — wrap the new ReminderPicker block in a margin-tightening View, OR drop the `micro` style's `marginBottom`

- [ ] **Step 1: Launch the app and walk to the Personalize step**

Use the project's existing launch flow (Metro + simulator/device). Reference `memory/reference_appium_setup.md` if Appium-driven, otherwise just open the app, sign in, tap "Create your first habit" or "Start a new goal" from Today, fill the goal → action → build steps, then land on Personalize.

- [ ] **Step 2: Inspect the spacing between the "You can rename…" micro text and the ReminderPicker**

Computed spacing: `theme.spacing.xl` (micro's marginBottom) + `8` (picker's internal gap above the label) ≈ ~32 px. Verify visually:

- Does the ReminderPicker visually attach to the Preview-card / micro-text cluster?
- Or does it float as a spaced-out orphan disconnected from the cluster above?

If it attaches naturally — no change needed. Skip to Step 4.

- [ ] **Step 3 (only if it floats): Apply the spacing remediation**

In `src/features/habits/screens/CreateHabitFlow.tsx`, wrap the new ReminderPicker block:

```tsx
        {phase === "personalize" ? (
          <View style={{ marginTop: -theme.spacing.lg }}>
            <ReminderPicker
              value={draft.reminderTime}
              onChange={(t) => update({ reminderTime: t })}
            />
          </View>
        ) : null}
```

`theme` is already in scope in `PersonalizeStep` (line 635 declares it). Re-run the test file to confirm no regressions:

```bash
npx jest src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx --runInBand
```

Expected: still passing — the wrapper View doesn't affect any test queries (Switch is still the only one on screen).

- [ ] **Step 4: Commit only if Step 3 was needed**

If a remediation was applied:

```bash
git add src/features/habits/screens/CreateHabitFlow.tsx
git commit -m "style(create-habit): tighten ReminderPicker spacing in PersonalizeStep

Computed micro.marginBottom + picker internal gap was ~32px, reading as
a spaced-out orphan from the preview-card cluster. Pull the picker up
by spacing.lg via a wrapper margin."
```

If no remediation was needed: no commit. Note in the PR description that the device check passed without adjustment.

---

## Out-of-scope reminders (do NOT touch)

- **Stale-route useEffect redirects** in both archive detail screens (currently at `ArchivedHabitDetailScreen.tsx:180` and `ArchivedGoalDetailScreen.tsx:206`). These still correctly land on `/(app)/habits/backlog` for non-success cases (out-of-band delete, never-existed deep-link). Their tests stay unchanged.
- **Restore success paths** on both screens. They already do `dismissAll() + replace(Today)` (+ `push(GoalDetail)` on the goal screen) intentionally.
- **`ActiveDaysPicker`** stays in BuildStep.
- **`CreateHabitDraft.reminderTime`** schema, default, and `handleSave`'s reminder-branching logic — all unchanged.
- **Other invocations of `useDeleteHabitMutation` / `useDeleteGoalMutation`** elsewhere in the app — only the archived-detail success-path lines change. Hooks themselves are not touched.
