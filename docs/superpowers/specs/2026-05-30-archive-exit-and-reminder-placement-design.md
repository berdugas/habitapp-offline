# Archive-delete exit + reminder placement — design

Date: 2026-05-30
Status: Design

## Problems

1. **Delete from Archive feels stuck.** After tapping "Delete permanently" on an archived habit (or archived goal), the user lands on the Backlog (Archive list) screen and has to press the back chevron to exit the archive flow. Restore from the same screens exits cleanly to Today. The asymmetry feels like an unfinished action.

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

### Leave alone

The stale-route `useEffect` redirect (line 180 in `ArchivedHabitDetailScreen`, line 206 in `ArchivedGoalDetailScreen`) still uses `router.replace("/(app)/habits/backlog")`. That fires for non-success cases — habit deleted out-of-band, never-existed deep-linked id — where Backlog is the right landing. Only the user-initiated delete success path changes.

Restore success paths are unchanged.

### Tests

- `src/features/habits/screens/__tests__/ArchivedHabitDetailScreen.test.tsx` — the delete-success test (currently asserts `mockReplace` called with `"/(app)/habits/backlog"`) must instead assert `router.dismissAll` was called. Add a deep-link variant: when `router.canDismiss()` returns false, the fallback `router.replace("/(app)/(tabs)/today")` fires.
- `src/features/today/__tests__/ArchivedGoalDetailScreen.test.tsx` — same updates for `handleDeleteGoal`.
- The stale-route redirect tests stay unchanged.

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

No changes. `CreateHabitDraft.reminderTime` already lives on the shared draft (line 62), and `handleSave` already reads it (lines 181-195). The move is purely visual.

### Tests

- `src/features/habits/screens/__tests__/CreateHabitFlow.test.tsx` — any test that interacts with the reminder picker during the Build step needs to move its interaction to the Personalize step. Any "Build step renders X" assertion that names the reminder picker must drop it; any "Personalize step renders X" assertion gains it.

### Visual scaling concern

The Personalize step is already long when both phases are visible. The picker adds ~120px to the personalize phase. It only shows in personalize phase, not worstday, so the gate phase stays as-is. The existing `personalizeScroll` `ScrollView` absorbs the extra height.

## Error handling

No new failure modes. Delete-mutation error handling and create-mutation error handling are unchanged. The router fallback in Fix 1 covers the only new edge case (deep-link with empty pushable stack).

## Rollout

Single PR. No feature flag, no data migration, no API change. Both fixes are local UI/navigation changes.
