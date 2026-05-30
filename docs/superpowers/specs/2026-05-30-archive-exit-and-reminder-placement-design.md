# Archive-delete exit + reminder placement — design

Date: 2026-05-30
Status: Design

## Problems

1. **Delete from Archive feels stuck.** After tapping "Delete permanently" on an archived habit (or archived goal), the user lands on the Backlog (Archive list) screen and has to press the back chevron to exit the archive flow. The action is terminal — there is nothing more to do here — so leaving the user on the Backlog reads as unfinished.

2. **Reminder picker is hidden in the create flow.** The `ReminderPicker` lives at the bottom of the Build step in `CreateHabitFlow`, beneath the tiny-action input, cue input, formula preview card, and active-days picker. On a typical phone screen it's below the fold and users don't realise reminders are available during creation.

## Out of scope

- Reworking the Build or Personalize step structure beyond the picker move.
- Changing reminder semantics (defaults, scheduling, persistence).
- Changing the stale-route redirect logic that fires for non-success cases.
- Changing the restore flow (already exits correctly).

## Fix 1 — Delete from Archive exits to the source tab

### Behaviour change

After a successful permanent-delete:

- **Today's behaviour:** `router.replace("/(app)/habits/backlog")` — user is left on the Backlog list, must press back once to leave the archive flow.
- **New behaviour:** Pop every pushed route back to the active tab root. A user who entered via Settings → Backlog → Archived Detail lands back on Settings. A user who entered via Today → Goal → Archived Goal Detail lands back on Today.

### Deliberate divergence from restore

Restore on both screens does `dismissAll(); router.replace("/(app)/(tabs)/today")` — it force-anchors to Today regardless of the source tab. The existing comments at [ArchivedHabitDetailScreen.tsx:195-202](src/features/habits/screens/ArchivedHabitDetailScreen.tsx:195) and [ArchivedGoalDetailScreen.tsx:228-245](src/features/today/screens/ArchivedGoalDetailScreen.tsx:228) explain why: the restored habit reappears on Today, so anchoring there gives the user "welcome back, here's your identity" payoff.

Delete deliberately does **not** force-replace to Today. A deleted habit has no destination view — Today has nothing new to show. Returning to the source tab (Settings if they came to clean up, Today if they came via a goal) matches the user's mental model: "I came to do a thing, the thing is done, put me back where I was." The next reader should not "fix" this omission to match restore.

So after both fixes ship: restore force-anchors Today; delete returns to source. Both intentional, both documented in code comments at the call sites.

### Implementation

In both screens, replace the success-path `router.replace("/(app)/habits/backlog")` with:

```ts
if (router.canDismiss()) {
  router.dismissAll();
} else {
  router.replace("/(app)/(tabs)/today");
}
```

`dismissAll()` pops every route pushed on top of the current tab. The fallback handles deep-link cases where the detail screen is the only route on the stack — without it, the user would be stranded on a screen showing a habit that no longer exists.

### Files

- `src/features/habits/screens/ArchivedHabitDetailScreen.tsx` — `handleDeleteHabit` (currently line 234).
- `src/features/today/screens/ArchivedGoalDetailScreen.tsx` — `handleDeleteGoal` (currently line 275).

### Guard logic stays intact

Both handlers already wrap the success path in `startExit()` / `cancelExit()` (`ArchivedHabitDetailScreen` lines 228-238, `ArchivedGoalDetailScreen` lines 268-279). The submit-lock and render-suppression behaviour from `isExitingRef` + `isExiting` survives this change unchanged — only the post-`await mutateAsync` line is touched.

### Leave alone

The stale-route `useEffect` redirect (line 180 in `ArchivedHabitDetailScreen`, line 206 in `ArchivedGoalDetailScreen`) still uses `router.replace("/(app)/habits/backlog")`. That fires for non-success cases — habit deleted out-of-band, never-existed deep-linked id — where Backlog is the right landing. Only the user-initiated delete success path changes.

Restore success paths are unchanged.

### Tests

Both screens mock `expo-router` and currently expose only `back`, `replace`, `dismissAll` (and `push` on the goal screen). Neither mock includes `canDismiss`, so the new code path will throw `canDismiss is not a function` the moment a delete-success test runs.

**Mock additions (both files):**

```ts
const mockCanDismiss = jest.fn(() => true); // default: stack has pushed routes

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    replace: (...args) => mockReplace(...args),
    dismissAll: () => mockDismissAll(),
    canDismiss: () => mockCanDismiss(),
    // push: (...args) => mockPush(...args),  // goal screen only
  },
  // ... useLocalSearchParams stays the same
}));
```

`beforeEach` should call `mockCanDismiss.mockReturnValue(true)` so the default case is the happy path.

**Test changes:**

- `src/features/habits/screens/__tests__/ArchivedHabitDetailScreen.test.tsx`:
  - Existing delete-success test (currently asserts `mockReplace` called with `"/(app)/habits/backlog"`) must instead assert `mockDismissAll` was called and `mockReplace` was NOT called with the today route.
  - New deep-link variant: set `mockCanDismiss.mockReturnValue(false)` for one test, assert `mockReplace` called with `"/(app)/(tabs)/today"` and `mockDismissAll` NOT called.
- `src/features/today/__tests__/ArchivedGoalDetailScreen.test.tsx` — identical updates for `handleDeleteGoal`.
- Stale-route redirect tests stay unchanged.

## Fix 2 — Move ReminderPicker to the Personalize step

### Behaviour change

The reminder picker moves from the Build step (bottom, easily missed) to the Personalize step where it sits below the preview card. It is visible during the "personalize" phase and hidden during the "worst-day" gate phase, matching how the preview card itself becomes read-only at the gate.

### Implementation

In `src/features/habits/screens/CreateHabitFlow.tsx`:

**Remove from BuildStep:**
- The `<ReminderPicker ... />` block (currently lines 600-603).
- The `ReminderPicker` import at the top of the file stays — `PersonalizeStep` (in the same file) now needs it.

`ActiveDaysPicker` remains in the Build step. Active days define when the habit applies; the reminder is closer to setup/customisation, which fits Personalize.

**Add to PersonalizeStep:**
Inside the personalize-phase block of the scroll body, insert the picker below the existing `micro` "You can rename or change the icon anytime." line:

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

The picker has its own "Add a reminder" label and self-contained card styling — no wrapper needed.

### Data model

No changes. `CreateHabitDraft.reminderTime` already lives on the shared draft (line 61), and `handleSave` already reads it (lines 181-195). The move is purely visual.

### Tests

`src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx` has a `walkToWorstday` helper whose current order is:

1. Fill Build step (tinyAction + cue)
2. **`if (options.withReminder)`: toggle the ReminderPicker Switch** (lines 91-101)
3. Press "Continue" → Personalize phase
4. Fill habit name in "Tap to name" placeholder
5. Press "Looks good" → worstday phase

After the move, the toggle must relocate to **between step 4 (Tap to name) and step 5 (Looks good)** — because the picker is rendered only in the personalize phase of `PersonalizeStep`, not in worstday. The `if (options.withReminder)` block moves wholesale; the existing `screen.UNSAFE_getByType(Switch)` lookup still works because there is exactly one Switch on screen during the personalize phase too.

Any "Build step renders X" assertion that names the reminder picker must drop it; any "Personalize step renders X" assertion gains it.

### Visual scaling concern

The Personalize step is already long when both phases are visible. The picker adds ~120px to the personalize phase. It only shows in personalize phase, not worstday, so the gate phase stays as-is. The existing `personalizeScroll` `ScrollView` absorbs the extra height.

### Device-eyeball check after implementation

The `micro` text (line 721) has `marginBottom: theme.spacing.xl`, and `ReminderPicker` has no outer margin (only an internal `gap: 8` between its label and card). Inserting the picker directly under the micro will give a spacing of `xl + 8 = ~32px` between them. May read naturally; may read as a spaced-out orphan. After implementing, confirm on a device that the picker visually attaches to the preview-card area rather than floating alone. If it floats, the fix is to wrap it in a `<View style={{ marginTop: -theme.spacing.lg }}>` or drop the micro's bottom margin when the picker is present.

## Error handling

No new failure modes. Delete-mutation error handling and create-mutation error handling are unchanged. The router fallback in Fix 1 covers the only new edge case (deep-link with empty pushable stack).

## Rollout

Single PR. No feature flag, no data migration, no API change. Both fixes are local UI/navigation changes.
