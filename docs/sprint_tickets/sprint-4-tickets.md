# Sprint 4 — Dev Team Tickets

> **Status:** Ready for assignment.
> **Date:** April 29, 2026
> **Owner:** Tech Lead → Dev Team
> **Companion documents:** `sprint-plan.md` (S4 definition), `core-v1-requirements.md` (especially §3.5 and §4), `tech-handoff-core-v1.md` (architecture, especially §4.1, §4.6, §5, §7.1), `sprint-3-tickets.md` (the layer this builds on)

S4 closes the becoming bridge. The user moves from the Daily Action screen (S3's last ship) through Shrink → Cue → Worst-day → Confirmation, and on tapping "Start showing up" we write one Focus habit to `local_habits`, mark onboarding complete, and clear the draft — atomically. After S4 ships, a brand-new user can sign up, complete the full 7-screen flow, and land on Today with their first Focus habit ready to log.

This sprint is bigger than S3. There are four new screens (vs three) and the actual database write at the end. The risk is concentrated in two places: the worst-day loop-back state machine, and the atomicity of the finalize transaction. The rest is shaped exactly like S3 — calm screens with a small amount of state, all draft persistence routed through the layer S3 built.

---

## 0. Shared context — read before picking up a ticket

### Branching for this sprint

Per `sprint-plan.md` §8.5, every sprint runs on its own integration branch. **Before any ticket below starts**, cut the sprint branch off `main`:

```bash
git checkout main && git pull
git checkout -b sprint-4
git push -u origin sprint-4
```

Every ticket below branches off `sprint-4` and PRs back into `sprint-4`, not `main`. The `Branch suggestion` line on each ticket is the ticket branch, cut from `sprint-4`:

```bash
git checkout sprint-4 && git pull
git checkout -b s4/draft-cleanup-and-shrink
# ... do the work ...
# Open PR: s4/draft-cleanup-and-shrink → sprint-4
```

When all four tickets are merged into `sprint-4` and the Definition of S4 done is met, open one final PR: `sprint-4` → `main`.

### What's already done

Phase A (S0–S2) and S3 closed before S4 starts. By the time your S4 code runs:

- The local DB is open and migrated. `getDb()` returns a working SQLite connection.
- `local_habits`, `local_habit_logs`, and `local_user_preferences` all exist and are written to via the repositories in `src/lib/db/repositories/`.
- The forgiving streak rule is shipped.
- `features/habits/api.ts` is fully on SQLite. `assertCanCreateActiveHabit` is in `features/habits/validators.ts` and works.
- The onboarding feature module exists (`src/features/onboarding/`) with `types.ts`, `storage.ts`, `hooks.ts`, `OnboardingProvider.tsx`, `dailyActionPlaceholder.ts`, and three screens (Welcome, Becoming, Daily Action).
- The onboarding route group exists (`app/(onboarding)/`) with `_layout.tsx` (Stack with `OnboardingProvider` + `gestureEnabled: false`), `index.tsx` (resume router), and three route files.
- `(onboarding)` is registered in the root Stack with `headerShown: false` so the parent header doesn't bleed through.
- `RootEntryScreen` routes signed-in users to `/(onboarding)` when they have no habits and onboarding isn't completed.
- `RootEntryScreen.test.tsx` covers all eight routing cases.

You should not need to add any new repository functions in S4. `finalizeOnboarding` (DEV-S4-03) composes existing repo calls inside a transaction.

### What we are NOT touching in S4

These are out of scope. If you find yourself reaching for them, stop and check.

- The pre-auth `src/features/entry/screens/WelcomeScreen.tsx` — still untouched.
- `features/today/`, `features/habits/`, `features/reviews/`, `features/recommendations/` — all stay as-is. The Today screen redesign lands in S5; S4's only job in those parts of the tree is to **not break them**.
- The "Your first day. Start small." Today copy is **deferred to S5** even though the sprint plan lists it as an S4 deliverable. Rationale: S5 fully redesigns TodayScreen; adding a banner now to a screen about to be torn down is churn for no benefit. S5 will include the first-day state copy as part of the redesign. Documented in decision (D7) below.
- `features/auth/` — unchanged.
- AI features stay gated off.
- Trial entitlement validation (S8).
- Reminders, library, graduation, recovery (later sprints).

### Architectural decisions for S4

These ten decisions shape the work. Most are obvious; (D1) and (D7) are the judgment calls. All are settled — pushback should go to the Tech Lead, not be resolved unilaterally inside a ticket.

**(D1) Drop `cueAction` from `OnboardingDraft`.** When S3 baked S4 fields into the draft, both `tinyAction` and `cueAction` were declared. Re-reading the spec, Screen 5's "I will [...]" field is the Screen 4 `tinyAction` displayed in cue context — same concept, two editing surfaces. One field is correct; two creates a sync problem. DEV-S4-01 deletes `cueAction` from the type and `EMPTY_DRAFT`, and tightens `loadOnboardingDraft` to whitelist known keys (so the orphan key in dev-saved drafts is silently dropped on next read).

**(D2) Daily Action's "Saved. More coming next." becomes a real Continue button in S4-01.** When tapped: if `tinyAction` is currently empty, copy `dailyAction` into it (the spec's Screen-4 prefill); otherwise leave `tinyAction` alone. Then `update({ step: "shrink" })` and `router.push("/(onboarding)/shrink")`. Disabled when `dailyAction.trim()` is empty. The seed-only-if-empty rule means navigating back to Daily Action and forward again doesn't clobber Shrink edits.

**(D3) The worst-day "No" path uses `router.replace`, not `router.push`.** Otherwise a user who fails worst-day three times has three Worst-day screens stacked behind them. The Shrink screen reads `draft.worstDayPassed` to switch copy:
- `null` (first visit) → *"That's a great direction. Now let's make it laughably small for tomorrow."*
- `false` (returning from a No) → *"Let's make it smaller. What would survive a hard day?"*
- `true` → unreachable (we'd be on Confirmation).

**(D4) Onboarding finalization is atomic.** A new function `finalizeOnboarding(userId, draft)` in `src/features/onboarding/completion.ts` wraps three writes in `db.withTransactionAsync`:
1. `INSERT INTO local_habits` (the Focus habit) — via the existing `createHabit` repo function.
2. `setPreference(ONBOARDING_COMPLETED_AT_KEY, nowIso())` — mark complete.
3. `deletePreference(ONBOARDING_DRAFT_KEY)` — clear the draft.

If any step throws, all three roll back. Without atomicity, a partial failure (habit created but completion not marked) routes the user back to onboarding on next launch, which would create a duplicate habit. The transaction prevents this without us needing idempotent retry logic.

The repo functions called inside `withTransactionAsync` participate in the open transaction because they share the same `getDb()` singleton. Confirmed against expo-sqlite semantics.

**(D5) Field mapping from draft → habit row:**

| Draft field | Habit column | Notes |
|---|---|---|
| `becomingPhrase` | `identity_phrase` | trimmed; null if empty |
| `cueExisting` | `cue` | trimmed; the "After I [...]" routine |
| `tinyAction` | `tiny_action` | trimmed; the post-shrink action |
| `tinyAction` | `title` | trimmed; same value used as title — user can edit later from Habit Detail |
| (computed) | `start_date` | `todayDateString()` |
| (constant) | `habit_state` | `"focus"` |
| (constant) | `status` | `"active"` |
| — | `minimum_viable_action` | `null` — set later via Edit if user adds a fallback |
| — | `preferred_time_window` | `null` — Bug #3 (S19) wires the time picker |
| `dailyAction` | — | Discarded after onboarding; was a seed for `tinyAction` only |
| `worstDayPassed` | — | Process variable, not a habit attribute |

**(D6) Cap check before the transaction.** Call `assertCanCreateActiveHabit(userId, "focus")` before opening `withTransactionAsync`. For new users this trivially passes (zero active habits). The defensive case: a user re-enters onboarding while already having a Focus habit (shouldn't happen post-S3-04 backfill, but possible in dev). If the cap check fails, throw `OnboardingFinalizationError("cap_failed", …)`, render an inline error on Confirmation, and don't navigate.

**(D7) Defer the "Your first day. Start small." Today copy to S5.** The sprint plan lists it as an S4 deliverable, but S5 fully redesigns TodayScreen. Adding a banner now to a screen about to be torn down is wasted work. S5's TodayScreen redesign will include the first-day state copy as part of the rebuild. **This is a deliberate scope cut from the sprint plan, sanctioned by the Tech Lead.** S4 routes the user to the existing TodayScreen on completion — that's enough for now.

**(D8) New routes follow the S3 pattern.** Four new files in `app/(onboarding)/`: `shrink.tsx`, `cue.tsx`, `worst-day.tsx`, `confirmation.tsx`. Each is a single-line re-export from `src/features/onboarding/screens/`. The `OnboardingProvider` mounted in the existing `_layout.tsx` covers them automatically.

**(D9) The resume map (`app/(onboarding)/index.tsx`'s `STEP_TO_HREF`) is fully populated.** S3 mapped `shrink`, `cue`, `worst-day`, `confirmation` defensively to `/daily-action`. We replace those four lines with their real routes. If a user closes the app on Confirmation and reopens, they resume on Confirmation — the draft is still present, and tapping "Start showing up" runs the transaction normally.

**(D10) Three React Query invalidations on success:** `getIsOnboardingCompletedQueryKey(userId)`, `getEligibleHabitsQueryKey(userId, today)`, and `getUpcomingActiveHabitsQueryKey(userId, today)`. Then `router.replace("/")` to go through `RootEntryScreen`, which redirects to Today. Without the eligible-habits invalidation, RootEntry sees stale "no habits" and bounces the user to `/(app)/habits/create` (case 7 of the routing decision tree).

### File / folder layout

By the end of S4, the onboarding feature module looks like this:

```
src/features/onboarding/
├── types.ts                      # MODIFIED in S4-01: drop cueAction
├── storage.ts                    # MODIFIED in S4-01: whitelist load
├── hooks.ts                      # MODIFIED in S4-03: add useFinalizeOnboardingMutation
├── completion.ts                 # NEW in S4-03: finalizeOnboarding
├── OnboardingProvider.tsx        # unchanged
├── dailyActionPlaceholder.ts     # unchanged
├── components/
│   └── WorstDayCheck.tsx         # NEW in S4-02: shared, reusable in S13
├── screens/
│   ├── WelcomeScreen.tsx         # unchanged
│   ├── BecomingScreen.tsx        # unchanged
│   ├── DailyActionScreen.tsx     # MODIFIED in S4-01: real Continue button
│   ├── ShrinkScreen.tsx          # NEW in S4-01
│   ├── CueScreen.tsx             # NEW in S4-02
│   ├── WorstDayCheckScreen.tsx   # NEW in S4-02
│   └── ConfirmationScreen.tsx    # NEW in S4-03
└── __tests__/
    ├── storage.test.ts           # MODIFIED in S4-01: whitelist case
    ├── hooks.test.ts             # unchanged
    ├── dailyActionPlaceholder.test.ts  # unchanged
    ├── RootEntryScreen.test.tsx  # unchanged
    ├── completion.test.ts        # NEW in S4-03
    └── screens/                  # NEW in S4-04
        ├── ShrinkScreen.test.tsx
        ├── CueScreen.test.tsx
        ├── WorstDayCheckScreen.test.tsx
        └── ConfirmationScreen.test.tsx

app/(onboarding)/
├── _layout.tsx          # unchanged
├── index.tsx            # MODIFIED in S4-01, S4-02, S4-03: STEP_TO_HREF entries
├── welcome.tsx          # unchanged
├── becoming.tsx         # unchanged
├── daily-action.tsx     # unchanged
├── shrink.tsx           # NEW in S4-01
├── cue.tsx              # NEW in S4-02
├── worst-day.tsx        # NEW in S4-02
└── confirmation.tsx     # NEW in S4-03
```

### Conventions

These are inherited from S3 and apply unchanged in S4. Read them again if it's been a while.

- `now()` / `nowIso()` from `@/utils/clock`, never `Date.now()` or `new Date()` directly. The clock is mockable for tests.
- `todayDateString()` from `@/utils/clock` for `start_date` values (device-local YYYY-MM-DD).
- `renderHook` and `render` from `@testing-library/react-native`. The `@testing-library/react-hooks` package is **not** in `package.json`.
- `crypto.randomUUID()` is fine — used by `createHabit` already.
- All screens follow the existing card pattern (heroCard / card with `surface` background, `border` border, `lg` radius, `card` shadow). See `BecomingScreen.tsx` for the closest reference.
- All screens use `selectable` Text where it matters (headers, body, error messages) so tooling can copy strings.
- Continue buttons are `PrimaryButton` with `disabled` driven by trim-length checks.
- The `OnboardingProvider` is mounted once in `app/(onboarding)/_layout.tsx`. Screens consume it via `useOnboarding()` from `OnboardingProvider.tsx`. Don't mount it again per screen.
- Imports order: external packages → `expo-*` → `@/components/*` → `@/features/*` → `@/lib/*` → `@/services/*` → `@/theme/*` → `@/utils/*` → relative imports. Match the existing files.

### Sequencing

```
DEV-S4-01  Draft cleanup + Daily Action Continue + Shrink screen     ← foundation
   ↓
DEV-S4-02  Cue + Worst-day + WorstDayCheck shared component
   ↓
DEV-S4-03  Confirmation + finalizeOnboarding + invalidation hook
   ↓
DEV-S4-04  Per-screen tests + manual smoke + PROJECT_BRAIN update
```

Strictly serial. Don't parallelize.

---

## DEV-S4-01 — Draft cleanup, Daily Action Continue, Shrink screen

**Estimate:** 0.75 day
**Depends on:** S3 closed (sprint-3 merged into main).
**Branch suggestion:** `s4/draft-cleanup-and-shrink`

### Context

This ticket does three things, sequenced from cheapest-and-most-foundational to most-visible:

1. Cleans up the `OnboardingDraft` type by dropping `cueAction` (decision D1) and tightening `loadOnboardingDraft` to whitelist known keys.
2. Replaces the placeholder "Saved. More coming next." line on `DailyActionScreen` with a real Continue button (decision D2), including the seed-tinyAction-from-dailyAction-only-if-empty logic.
3. Builds the Shrink screen (Screen 4 of the onboarding flow), wires its route, and updates the resume map.

Order matters. Doing (1) first means the rest of the ticket is working against the cleaned-up type. Doing (2) before (3) means by the time you build Shrink, Daily Action's Continue button already pushes to `/(onboarding)/shrink` and you can navigate there in the simulator.

### Files to read first

- `src/features/onboarding/types.ts` — current state.
- `src/features/onboarding/storage.ts` — current state, especially `loadOnboardingDraft`.
- `src/features/onboarding/__tests__/storage.test.ts` — to see the existing test patterns.
- `src/features/onboarding/screens/DailyActionScreen.tsx` — current placeholder line you'll replace.
- `src/features/onboarding/screens/BecomingScreen.tsx` — closest template for ShrinkScreen (Continue button, multi-line input, examples list, card layout).
- `app/(onboarding)/index.tsx` — current `STEP_TO_HREF`.
- `app/(onboarding)/becoming.tsx` — pattern for the new `shrink.tsx` re-export.
- `docs/core-v1-requirements.md` §4.1 Screen 4 — the verbatim coaching paragraph.

### Files to modify

- `src/features/onboarding/types.ts`
- `src/features/onboarding/storage.ts`
- `src/features/onboarding/screens/DailyActionScreen.tsx`
- `src/features/onboarding/__tests__/storage.test.ts`
- `app/(onboarding)/index.tsx`

### Files to create

- `src/features/onboarding/screens/ShrinkScreen.tsx`
- `app/(onboarding)/shrink.tsx`

### Required exports / signatures

**`src/features/onboarding/types.ts`** — drop `cueAction` from both `OnboardingDraft` and `EMPTY_DRAFT`. Add a `KNOWN_DRAFT_KEYS` constant for the whitelist:

```ts
export const KNOWN_DRAFT_KEYS = [
  "step",
  "becomingPhrase",
  "dailyAction",
  "tinyAction",
  "cueExisting",
  "worstDayPassed",
] as const satisfies readonly (keyof OnboardingDraft)[];
```

The `as const satisfies` pattern gives you a literal-typed tuple AND a compile-time check that the array contains only valid keys. If a future field is added to `OnboardingDraft` and forgotten here, the build fails — useful safety net.

**`src/features/onboarding/storage.ts`** — replace the spread-merge inside `loadOnboardingDraft`:

```ts
import { EMPTY_DRAFT, KNOWN_DRAFT_KEYS, type OnboardingDraft, ... } from "./types";

function pickKnownDraftKeys(parsed: unknown): Partial<OnboardingDraft> {
  if (typeof parsed !== "object" || parsed === null) {
    return {};
  }
  const result: Partial<OnboardingDraft> = {};
  for (const key of KNOWN_DRAFT_KEYS) {
    if (key in parsed) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = (parsed as any)[key];
    }
  }
  return result;
}

export async function loadOnboardingDraft(): Promise<OnboardingDraft> {
  const raw = await getPreference(ONBOARDING_DRAFT_KEY);
  if (raw === null) {
    return { ...EMPTY_DRAFT };
  }
  try {
    const parsed = JSON.parse(raw);
    return { ...EMPTY_DRAFT, ...pickKnownDraftKeys(parsed) };
  } catch (error) {
    logger.warn("Failed to parse onboarding draft — resetting to empty", {
      error,
    });
    return { ...EMPTY_DRAFT };
  }
}
```

`pickKnownDraftKeys` is intentionally permissive about value types (it copies whatever value is on the parsed object for each known key). Type validation happens implicitly via `EMPTY_DRAFT`'s defaults — if a corrupt value lands on `step`, the rest of the system handles it (the resume router's `STEP_TO_HREF` lookup falls back gracefully because we're a `Record<OnboardingStep, string>`). We're not trying to be a schema validator here; we're trying to drop orphan keys. Keep the logic simple.

**`src/features/onboarding/screens/DailyActionScreen.tsx`** — replace the `Saved. More coming next.` line and its `savedNote` style with a Continue button:

```tsx
import { router } from "expo-router";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import type { OnboardingDraft } from "@/features/onboarding/types";

// ...inside the component, after the existing draft + update destructuring:
const handleContinue = () => {
  const next: Partial<OnboardingDraft> = { step: "shrink" };
  if (draft.tinyAction.trim().length === 0) {
    next.tinyAction = draft.dailyAction;
  }
  update(next);
  router.push("/(onboarding)/shrink");
};

// In the return, replace the savedNote Text with:
<PrimaryButton
  disabled={draft.dailyAction.trim().length === 0}
  label="Continue"
  onPress={handleContinue}
/>
```

Delete the `savedNote` entry from `StyleSheet.create`.

**`src/features/onboarding/screens/ShrinkScreen.tsx`** — new file, modeled on `BecomingScreen.tsx`. Header copy varies by `draft.worstDayPassed`:

```tsx
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const COACHING_PARAGRAPH =
  "Habits form through repetition, not intensity. The smaller the action, " +
  "the more reliable it becomes. Most people start too big and quit. " +
  "Start absurdly small. You can always do more on the day. The goal is " +
  "showing up, not achieving.";

const EXAMPLES = [
  "Run for 2 minutes",
  "Read one page",
  "Sit quietly for one breath",
];

export default function ShrinkScreen() {
  const { draft, update } = useOnboarding();

  const handleContinue = () => {
    update({ step: "cue" });
    router.push("/(onboarding)/cue");
  };

  const headerCopy =
    draft.worstDayPassed === false
      ? "Let's make it smaller. What would survive a hard day?"
      : "That's a great direction. Now let's make it laughably small for tomorrow.";

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      <View style={styles.card}>
        <Text selectable style={styles.header}>
          {headerCopy}
        </Text>
        <TextInput
          autoCorrect
          multiline
          onChangeText={(text) => update({ tinyAction: text })}
          placeholder=""
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={draft.tinyAction}
        />
        <Text selectable style={styles.coaching}>
          {COACHING_PARAGRAPH}
        </Text>
        <View style={styles.examples}>
          <Text selectable style={styles.examplesLabel}>
            For example:
          </Text>
          {EXAMPLES.map((example) => (
            <Text key={example} selectable style={styles.exampleItem}>
              {example}
            </Text>
          ))}
        </View>
      </View>

      <PrimaryButton
        disabled={draft.tinyAction.trim().length === 0}
        label="Continue"
        onPress={handleContinue}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    boxShadow: shadows.card,
    gap: spacing.lg,
    padding: spacing.xxl,
  },
  coaching: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  content: {
    flexGrow: 1,
    gap: spacing.xxl,
    justifyContent: "center",
    padding: spacing.xl,
  },
  exampleItem: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  examples: {
    gap: spacing.md,
  },
  examplesLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "600",
  },
  header: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
    lineHeight: 36,
  },
  input: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
    minHeight: 80,
    padding: spacing.md,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
```

The coaching paragraph is verbatim from `core-v1-requirements.md` §4.1 Screen 4. The three examples are tech-lead-drafted (the spec says "Three example shrinks shown for inspiration" but doesn't prescribe them); product-lead can revise.

**`app/(onboarding)/shrink.tsx`** — single-line re-export:

```tsx
export { default } from "@/features/onboarding/screens/ShrinkScreen";
```

**`app/(onboarding)/index.tsx`** — replace the `shrink` line in `STEP_TO_HREF`:

```ts
"shrink": "/(onboarding)/shrink",
```

Leave `cue`, `worst-day`, and `confirmation` pointing at `/daily-action` for now. S4-02 and S4-03 will replace those lines as their screens come online.

### Required tests

**`src/features/onboarding/__tests__/storage.test.ts`** — add one new case to the existing `loadOnboardingDraft` describe block:

```ts
it("drops unknown keys when loading a draft persisted under an older shape", async () => {
  // Simulate a draft saved before cueAction was removed from the schema.
  const oldShape = {
    step: "cue",
    becomingPhrase: "a writer",
    cueAction: "this field no longer exists",
    bogusField: 12345,
  };
  await setPreference(ONBOARDING_DRAFT_KEY, JSON.stringify(oldShape));

  const loaded = await loadOnboardingDraft();
  expect(loaded.step).toBe("cue");
  expect(loaded.becomingPhrase).toBe("a writer");
  // Unknown keys should not appear on the result.
  expect(loaded).not.toHaveProperty("cueAction");
  expect(loaded).not.toHaveProperty("bogusField");
});
```

The existing `merges a draft saved with an old shape (missing fields) over EMPTY_DRAFT` test still applies and should continue to pass — the whitelist load preserves the EMPTY_DRAFT defaults for missing known keys.

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes — the new whitelist test included; all existing tests still pass.
- Manual: from a fresh sign-in (or after `wipeLocalDb`), navigate through Welcome → Becoming → Daily Action. Type a daily action. The Continue button enables. Tap it. Land on the new Shrink screen. The header reads *"That's a great direction. Now let's make it laughably small for tomorrow."* The input is pre-filled with the daily action text. Edit it. Force-quit. Re-launch. Resume on Shrink with the edited tiny action preserved.
- Manual: open the dev REPL or app inspector after a save and confirm the persisted JSON in `local_user_preferences` for key `onboarding.draft` does **not** contain `cueAction` or any orphan key.

### References

- `docs/core-v1-requirements.md` §4.1 Screen 4 (verbatim coaching paragraph).
- `docs/sprint_tickets/sprint-plan.md` §S4 Goal + Deliverables.
- `src/features/onboarding/screens/BecomingScreen.tsx` (closest template).
- `src/features/onboarding/screens/DailyActionScreen.tsx` (the file you're modifying).

### Out of scope

- Cue screen, Worst-day screen, Confirmation screen — those are S4-02 and S4-03.
- The S4-step entries in `STEP_TO_HREF` for `cue`, `worst-day`, `confirmation` — they stay pointing at `/daily-action` until their screens land.
- Any changes to the Shrink screen's "alternate copy after worst-day No" behavior — the rendering is in this ticket, but the trigger (worst-day flow) ships in S4-02.

---

## DEV-S4-02 — Cue screen, Worst-day check screen, shared WorstDayCheck component

**Estimate:** 0.75 day
**Depends on:** DEV-S4-01 merged into `sprint-4`.
**Branch suggestion:** `s4/cue-and-worst-day`

### Context

Two screens and one shared component. The screens are simple; the worst-day loop-back is the only nontrivial piece, and it's a five-line state machine driven by `draft.worstDayPassed` (decision D3).

The shared `WorstDayCheck` component is a deliberate factor-out per `sprint-plan.md` §S4 Deliverables — it'll be reused in S13 for Supporting habit creation. Keeping it free of onboarding-specific state (it just emits `onPass` / `onFail`) means S13 can drop it into a different flow without rewiring.

### Files to read first

- `src/features/onboarding/screens/BecomingScreen.tsx` — template for CueScreen's two-input layout (one input pattern, replicate).
- `src/features/onboarding/screens/ShrinkScreen.tsx` — built in S4-01; reference for header / coaching / examples pattern.
- `src/components/buttons/PrimaryButton.tsx` and `src/components/buttons/SecondaryButton.tsx` — Yes/No button visuals.
- `app/(onboarding)/index.tsx` — `STEP_TO_HREF` to update.
- `docs/core-v1-requirements.md` §4.1 Screens 5 and 6 (the spec).
- `docs/core-v1-requirements.md` §3.5 (worst-day gate; explains "hard block during onboarding").

### Files to modify

- `app/(onboarding)/index.tsx` — replace `cue` and `worst-day` lines in `STEP_TO_HREF`.

### Files to create

- `src/features/onboarding/components/WorstDayCheck.tsx`
- `src/features/onboarding/screens/CueScreen.tsx`
- `src/features/onboarding/screens/WorstDayCheckScreen.tsx`
- `app/(onboarding)/cue.tsx`
- `app/(onboarding)/worst-day.tsx`

### Required exports / signatures

**`src/features/onboarding/components/WorstDayCheck.tsx`** — pure presentational component. No knowledge of onboarding state, no router calls. Just props in, callbacks out.

```tsx
import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const DEFAULT_QUESTION =
  "If today were your worst day — sick, exhausted, stressed — could you still do this?";

type WorstDayCheckProps = {
  onPass: () => void;
  onFail: () => void;
  passLabel?: string;
  failLabel?: string;
  question?: string;
};

export function WorstDayCheck({
  onPass,
  onFail,
  passLabel = "Yes, I could",
  failLabel = "Probably not",
  question = DEFAULT_QUESTION,
}: WorstDayCheckProps) {
  return (
    <View style={styles.card}>
      <Text selectable style={styles.question}>
        {question}
      </Text>
      <View style={styles.actions}>
        <PrimaryButton label={passLabel} onPress={onPass} />
        <SecondaryButton label={failLabel} onPress={onFail} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    boxShadow: shadows.card,
    gap: spacing.xxl,
    padding: spacing.xxl,
  },
  question: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "700",
    lineHeight: 30,
  },
});
```

The default copy uses the verbatim question from §4.1 Screen 6. The `question` / `passLabel` / `failLabel` props are overridable so S13 can specialize for Supporting creation later without forking the component.

**`src/features/onboarding/screens/CueScreen.tsx`** — two-input layout. Top input binds to `draft.cueExisting` ("After I [...]"). Bottom input binds to `draft.tinyAction` ("I will [...]") — same source-of-truth as Shrink. Continue is enabled when both fields have non-empty trim:

```tsx
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const COACHING_PARAGRAPH =
  "A routine cue beats a clock cue. Tying your habit to something you already " +
  "do every day means you don't have to remember — the previous action " +
  "becomes the reminder. Pick something that happens reliably without effort.";

const EXAMPLE_ROUTINES = [
  "after morning coffee",
  "after I brush my teeth",
  "after my last meeting",
  "before I make dinner",
  "when I sit down at my desk",
];

export default function CueScreen() {
  const { draft, update } = useOnboarding();

  const canContinue =
    draft.cueExisting.trim().length > 0 && draft.tinyAction.trim().length > 0;

  const handleContinue = () => {
    update({ step: "worst-day" });
    router.push("/(onboarding)/worst-day");
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      <View style={styles.card}>
        <Text selectable style={styles.header}>
          What will trigger it?
        </Text>

        <View style={styles.field}>
          <Text selectable style={styles.label}>
            After I
          </Text>
          <TextInput
            autoCorrect
            multiline
            onChangeText={(text) => update({ cueExisting: text })}
            placeholder="my morning coffee"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={draft.cueExisting}
          />
        </View>

        <View style={styles.field}>
          <Text selectable style={styles.label}>
            I will
          </Text>
          <TextInput
            autoCorrect
            multiline
            onChangeText={(text) => update({ tinyAction: text })}
            placeholder=""
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={draft.tinyAction}
          />
        </View>

        <Text selectable style={styles.coaching}>
          {COACHING_PARAGRAPH}
        </Text>

        <View style={styles.examples}>
          <Text selectable style={styles.examplesLabel}>
            Some routines that work well:
          </Text>
          {EXAMPLE_ROUTINES.map((example) => (
            <Text key={example} selectable style={styles.exampleItem}>
              {example}
            </Text>
          ))}
        </View>
      </View>

      <PrimaryButton
        disabled={!canContinue}
        label="Continue"
        onPress={handleContinue}
      />
    </ScrollView>
  );
}

// styles: mirror ShrinkScreen, with field/label additions.
```

The header *"What will trigger it?"*, the coaching paragraph, and the example routines are tech-lead-drafted (the spec describes these abstractly but doesn't give verbatim copy). Product-lead can revise in review. Flag: if the product-lead prefers a different header or coaching paragraph, change here only — the file is self-contained.

**`src/features/onboarding/screens/WorstDayCheckScreen.tsx`** — wires the shared `WorstDayCheck` component to draft + router. Implements decision D3 (replace, not push, on fail):

```tsx
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { WorstDayCheck } from "@/features/onboarding/components/WorstDayCheck";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function WorstDayCheckScreen() {
  const { draft, update } = useOnboarding();

  const handlePass = () => {
    update({ worstDayPassed: true, step: "confirmation" });
    router.push("/(onboarding)/confirmation");
  };

  const handleFail = () => {
    update({ worstDayPassed: false, step: "shrink" });
    // Replace, not push. Otherwise the back stack accumulates a Worst-day
    // screen each time the user fails. See decision D3 in sprint-4-tickets §0.
    router.replace("/(onboarding)/shrink");
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <View style={styles.context}>
        <Text selectable style={styles.contextLabel}>
          Your habit
        </Text>
        <Text selectable style={styles.contextValue}>
          After I {draft.cueExisting}, I will {draft.tinyAction}
        </Text>
      </View>

      <WorstDayCheck onPass={handlePass} onFail={handleFail} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.xxl,
    justifyContent: "center",
    padding: spacing.xl,
  },
  context: {
    gap: spacing.sm,
  },
  contextLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  contextValue: {
    color: colors.text,
    fontSize: typography.body,
    fontStyle: "italic",
    lineHeight: 24,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
```

The "Your habit" context line above the Yes/No question gives the user something to evaluate. Without it, the question is abstract — they're being asked about an action they have to scroll back to remember.

**`app/(onboarding)/cue.tsx`** — single-line re-export:

```tsx
export { default } from "@/features/onboarding/screens/CueScreen";
```

**`app/(onboarding)/worst-day.tsx`** — single-line re-export:

```tsx
export { default } from "@/features/onboarding/screens/WorstDayCheckScreen";
```

**`app/(onboarding)/index.tsx`** — replace the `cue` and `worst-day` lines in `STEP_TO_HREF`:

```ts
"cue": "/(onboarding)/cue",
"worst-day": "/(onboarding)/worst-day",
```

Leave `confirmation` pointing at `/daily-action` for now. S4-03 will fix it.

### Required tests

No new automated tests in this ticket — the screens are mostly presentational and the logic (loop-back via worstDayPassed) is exercised through the manual smoke and through the per-screen tests in S4-04. The shared `WorstDayCheck` component is similarly trivial; we do test it in S4-04 by mocking the onPass/onFail props.

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes — no new tests, no broken existing ones.
- Manual: from Daily Action, navigate to Shrink, type a tiny action, Continue → land on Cue. Both fields are visible. The "I will" field is pre-filled with the tiny action from Shrink. Type into "After I". Continue → land on Worst-day. The context line reads *"After I [your routine], I will [your action]"*. Tap "Probably not" → land back on Shrink with the alternate header *"Let's make it smaller. What would survive a hard day?"*. The tiny action input still shows your previous text. Edit it to something smaller. Continue → Cue → Continue → Worst-day. Tap "Yes, I could" → land on `/(onboarding)/daily-action` (Confirmation isn't built yet — this is expected; S4-03 finishes it).
- Manual: tap "Probably not" three times in a row. Confirm the iOS/Android system back button only walks you back through Cue → Shrink (one step at a time), not through three Worst-day screens. This verifies decision D3 (`router.replace` worked).

### References

- `docs/core-v1-requirements.md` §4.1 Screens 5 and 6.
- `docs/core-v1-requirements.md` §3.5 (worst-day gate semantics).
- `docs/sprint_tickets/sprint-plan.md` §S4 Deliverables — *"WorstDayCheck shared component (reusable in S13 for Supporting habit creation)"*.

### Out of scope

- Confirmation screen — S4-03.
- The "Yes" path's destination — currently routes to confirmation, which doesn't exist as a real screen yet; S4-03 ships it.
- Per-screen unit tests — S4-04.
- Customizing the WorstDayCheck component for S13's Supporting flow — S13 will pass override props at that time.

---

## DEV-S4-03 — Confirmation screen + finalizeOnboarding + invalidation hook

**Estimate:** 0.75 day
**Depends on:** DEV-S4-02 merged into `sprint-4`.
**Branch suggestion:** `s4/confirmation-and-finalize`

### Context

This is the heart of S4. The Confirmation screen is small and presentational; the work is in `finalizeOnboarding` (decision D4) and the mutation hook that calls it. By the end of this ticket, a fresh user can complete the full flow and a Focus habit appears in `local_habits` with onboarding marked complete.

The atomicity is the load-bearing piece. Read decision D4 in §0 carefully. The transaction is:

1. INSERT a habit row (via `createHabit` repo)
2. SET the completion preference
3. DELETE the draft preference

Inside `db.withTransactionAsync`. Repository functions called within the callback share the same `getDb()` singleton, so they participate in the open transaction. If any step throws, the whole thing rolls back.

The cap check (decision D6) runs **before** the transaction opens. It's a read; no need to be inside the atomic block.

### Files to read first

- `src/lib/db/client.ts` — confirm `getDb()` returns the singleton, and `db.withTransactionAsync` is the documented pattern.
- `src/lib/db/repositories/habits.ts` — the `createHabit` signature, especially `CreateHabitInput`.
- `src/lib/db/repositories/preferences.ts` — `setPreference`, `deletePreference`.
- `src/features/habits/validators.ts` — `assertCanCreateActiveHabit` and its return type.
- `src/features/onboarding/storage.ts` — to keep `markOnboardingCompleted` and friends in mind (but `finalizeOnboarding` writes directly via `setPreference` / `deletePreference` to keep all three writes in one transaction, rather than going through the storage helpers).
- `src/features/onboarding/hooks.ts` — current state. You'll add `useFinalizeOnboardingMutation` here.
- `src/features/habits/hooks.ts` — pattern for `useMutation` with `useQueryClient` invalidations. `useUpdateHabitMutation` is the closest reference.
- `src/utils/clock.ts` — `nowIso()` and `todayDateString()`.
- `src/utils/dates.ts` — `toDeviceDateString()` for query-key composition.

### Files to modify

- `src/features/onboarding/hooks.ts` — add `useFinalizeOnboardingMutation`.
- `app/(onboarding)/index.tsx` — replace the `confirmation` line in `STEP_TO_HREF`.

### Files to create

- `src/features/onboarding/completion.ts` — the `finalizeOnboarding` function and its error type.
- `src/features/onboarding/screens/ConfirmationScreen.tsx`
- `app/(onboarding)/confirmation.tsx`
- `src/features/onboarding/__tests__/completion.test.ts`

### Required exports / signatures

**`src/features/onboarding/completion.ts`** — the transactional finalize.

```ts
import { useAuthSession } from "@/features/auth/hooks";  // not used here directly, but keep imports for hooks.ts
import { assertCanCreateActiveHabit } from "@/features/habits/validators";
import { createHabit as createHabitRepo } from "@/lib/db/repositories/habits";
import {
  deletePreference,
  setPreference,
} from "@/lib/db/repositories/preferences";
import { getDb } from "@/lib/db/client";
import { logger } from "@/services/logger";
import { nowIso, todayDateString } from "@/utils/clock";

import type { Habit } from "@/features/habits/types";
import {
  ONBOARDING_COMPLETED_AT_KEY,
  ONBOARDING_DRAFT_KEY,
  type OnboardingDraft,
} from "./types";

export type OnboardingFinalizationReason = "cap_failed" | "write_failed";

export class OnboardingFinalizationError extends Error {
  reason: OnboardingFinalizationReason;
  constructor(reason: OnboardingFinalizationReason, message: string) {
    super(message);
    this.name = "OnboardingFinalizationError";
    this.reason = reason;
  }
}

export async function finalizeOnboarding(
  userId: string,
  draft: OnboardingDraft,
): Promise<Habit> {
  // (D6) Cap check before transaction. Reads only — fine outside the atomic block.
  const capCheck = await assertCanCreateActiveHabit(userId, "focus");
  if (!capCheck.ok) {
    throw new OnboardingFinalizationError(
      "cap_failed",
      `Cannot create Focus habit: ${capCheck.reason}`,
    );
  }

  const db = getDb();
  const today = todayDateString();
  const completedAt = nowIso();

  let createdHabit: Habit | undefined;

  // (D4) Atomic write: habit row + completion mark + draft clear.
  // If any step throws, withTransactionAsync rolls all three back.
  try {
    await db.withTransactionAsync(async () => {
      createdHabit = await createHabitRepo({
        user_id: userId,
        title: draft.tinyAction.trim(),
        identity_phrase: draft.becomingPhrase.trim() || null,
        cue: draft.cueExisting.trim(),
        tiny_action: draft.tinyAction.trim(),
        minimum_viable_action: null,
        preferred_time_window: null,
        habit_state: "focus",
        status: "active",
        start_date: today,
      });
      await setPreference(ONBOARDING_COMPLETED_AT_KEY, completedAt);
      await deletePreference(ONBOARDING_DRAFT_KEY);
    });
  } catch (error) {
    logger.warn("Onboarding finalization transaction failed", { error });
    throw new OnboardingFinalizationError(
      "write_failed",
      "Failed to finalize onboarding. Please try again.",
    );
  }

  if (!createdHabit) {
    // Defensive: if the transaction completed but somehow createdHabit wasn't
    // set, treat as a write failure rather than returning undefined.
    throw new OnboardingFinalizationError(
      "write_failed",
      "Habit was not created.",
    );
  }

  return createdHabit;
}
```

**`src/features/onboarding/hooks.ts`** — add the mutation hook. It must read the draft from context (so we always submit the latest persisted state, not a stale closure) and invalidate three query keys on success per decision D10:

```ts
// Add these imports at the top:
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getEligibleHabitsQueryKey,
  getUpcomingActiveHabitsQueryKey,
} from "@/features/habits/hooks";
import { toDeviceDateString } from "@/utils/dates";
import { finalizeOnboarding } from "./completion";
import { useOnboarding } from "./OnboardingProvider";

// Add this hook below useIsOnboardingCompletedQuery:
export function useFinalizeOnboardingMutation() {
  const { user } = useAuthSession();
  const { draft } = useOnboarding();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error("No user session");
      }
      return finalizeOnboarding(user.id, draft);
    },
    onSuccess: async () => {
      if (!user?.id) {
        return;
      }
      const todayDate = toDeviceDateString();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getIsOnboardingCompletedQueryKey(user.id),
        }),
        queryClient.invalidateQueries({
          queryKey: getEligibleHabitsQueryKey(user.id, todayDate),
        }),
        queryClient.invalidateQueries({
          queryKey: getUpcomingActiveHabitsQueryKey(user.id, todayDate),
        }),
      ]);
      // (D10) Bounce through RootEntryScreen so it routes to Today using the
      // freshly invalidated queries.
      router.replace("/");
    },
  });
}
```

`onError` is intentionally not specified at the hook level — the screen renders the error inline from `mutation.error`. Logger output from inside `finalizeOnboarding` already covers the diagnostic side.

**`src/features/onboarding/screens/ConfirmationScreen.tsx`** — summary card + CTA + error state. Disabled while pending.

```tsx
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { useFinalizeOnboardingMutation } from "@/features/onboarding/hooks";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { OnboardingFinalizationError } from "@/features/onboarding/completion";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

function getFinalizeErrorMessage(error: unknown): string {
  if (error instanceof OnboardingFinalizationError) {
    if (error.reason === "cap_failed") {
      return "You already have a Focus habit. Finish that one first.";
    }
    return "Something went wrong while saving your habit. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

export default function ConfirmationScreen() {
  const { draft } = useOnboarding();
  const finalizeMutation = useFinalizeOnboardingMutation();

  const handleStart = () => {
    finalizeMutation.mutate();
  };

  const buttonLabel = finalizeMutation.isPending
    ? "Starting..."
    : "Start showing up.";

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <View style={styles.card}>
        <View style={styles.field}>
          <Text selectable style={styles.label}>
            Your becoming
          </Text>
          <Text selectable style={styles.value}>
            {draft.becomingPhrase}
          </Text>
        </View>

        <View style={styles.field}>
          <Text selectable style={styles.label}>
            Your habit
          </Text>
          <Text selectable style={styles.value}>
            After I {draft.cueExisting}, I will {draft.tinyAction}
          </Text>
        </View>

        <View style={styles.field}>
          <Text selectable style={styles.label}>
            Starts
          </Text>
          <Text selectable style={styles.value}>
            today
          </Text>
        </View>
      </View>

      {finalizeMutation.isError && (
        <Text selectable style={styles.error}>
          {getFinalizeErrorMessage(finalizeMutation.error)}
        </Text>
      )}

      <PrimaryButton
        disabled={finalizeMutation.isPending}
        label={buttonLabel}
        onPress={handleStart}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    boxShadow: shadows.card,
    gap: spacing.xl,
    padding: spacing.xxl,
  },
  content: {
    flexGrow: 1,
    gap: spacing.xxl,
    justifyContent: "center",
    padding: spacing.xl,
  },
  error: {
    color: colors.danger,
    fontSize: typography.body,
    lineHeight: 22,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  value: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 26,
  },
});
```

If `colors.danger` doesn't exist on the theme yet, use `colors.text` with a slightly different weight, or add a `danger` token to `src/theme/colors.ts` (preferred). Check the theme file before creating.

**`app/(onboarding)/confirmation.tsx`** — single-line re-export:

```tsx
export { default } from "@/features/onboarding/screens/ConfirmationScreen";
```

**`app/(onboarding)/index.tsx`** — replace the `confirmation` line in `STEP_TO_HREF`:

```ts
"confirmation": "/(onboarding)/confirmation",
```

After this change, no S4 step is mapped defensively to `daily-action` anymore. Every step has a real route.

### Required tests

**`src/features/onboarding/__tests__/completion.test.ts`** — three cases for `finalizeOnboarding`. Use `createTestDb()` from `src/tests/setup/createTestDb.ts` (same pattern as `storage.test.ts`).

```ts
import type { SQLiteDatabase } from "expo-sqlite";

import * as habitsValidators from "@/features/habits/validators";
import { listActiveHabits } from "@/features/habits/api";
import { getDb } from "@/lib/db/client";
import * as preferencesRepo from "@/lib/db/repositories/preferences";
import { createTestDb } from "@/tests/setup/createTestDb";
import { setNowForTesting, resetClockForTesting } from "@/utils/clock";

import {
  finalizeOnboarding,
  OnboardingFinalizationError,
} from "../completion";
import {
  isOnboardingCompleted,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from "../storage";
import { EMPTY_DRAFT } from "../types";

jest.mock("@/lib/db/client");
const mockGetDb = getDb as jest.Mock;

const TEST_USER_ID = "user-test-1";

function makeReadyDraft() {
  return {
    ...EMPTY_DRAFT,
    step: "confirmation" as const,
    becomingPhrase: "a runner",
    dailyAction: "Run for 30 minutes",
    tinyAction: "Run for 2 minutes",
    cueExisting: "morning coffee",
    worstDayPassed: true,
  };
}

describe("finalizeOnboarding", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createTestDb();
    mockGetDb.mockReturnValue(db);
    setNowForTesting(new Date("2026-04-29T10:00:00.000Z"));
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    resetClockForTesting();
    await db.closeAsync();
  });

  it("creates a Focus habit, marks completion, and clears the draft on success", async () => {
    const draft = makeReadyDraft();
    await saveOnboardingDraft(draft);

    const habit = await finalizeOnboarding(TEST_USER_ID, draft);

    expect(habit.user_id).toBe(TEST_USER_ID);
    expect(habit.habit_state).toBe("focus");
    expect(habit.status).toBe("active");
    expect(habit.identity_phrase).toBe("a runner");
    expect(habit.cue).toBe("morning coffee");
    expect(habit.tiny_action).toBe("Run for 2 minutes");
    expect(habit.title).toBe("Run for 2 minutes");
    expect(habit.start_date).toBe("2026-04-29");

    // Completion mark present.
    expect(await isOnboardingCompleted()).toBe(true);

    // Draft cleared.
    expect(await loadOnboardingDraft()).toEqual(EMPTY_DRAFT);

    // Active habits list shows the new habit.
    const active = await listActiveHabits(TEST_USER_ID);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(habit.id);
  });

  it("throws cap_failed and writes nothing when the cap helper rejects", async () => {
    const draft = makeReadyDraft();
    await saveOnboardingDraft(draft);

    jest
      .spyOn(habitsValidators, "assertCanCreateActiveHabit")
      .mockResolvedValueOnce({
        ok: false,
        reason: "focus_full",
        counts: { focus: 1, supporting: 0 },
      });

    await expect(finalizeOnboarding(TEST_USER_ID, draft)).rejects.toThrow(
      OnboardingFinalizationError,
    );
    await expect(
      finalizeOnboarding(TEST_USER_ID, draft).catch((e) => e),
    ).resolves.toMatchObject({ reason: "cap_failed" });

    // Completion mark NOT written.
    expect(await isOnboardingCompleted()).toBe(false);
    // Draft preserved.
    const reloaded = await loadOnboardingDraft();
    expect(reloaded.tinyAction).toBe("Run for 2 minutes");
    // No habit row.
    const active = await listActiveHabits(TEST_USER_ID);
    expect(active).toHaveLength(0);
  });

  it("rolls back the habit insert if a later step in the transaction throws", async () => {
    const draft = makeReadyDraft();
    await saveOnboardingDraft(draft);

    // Sabotage the second step in the transaction (setPreference for the
    // completion key) so the transaction rolls back.
    const realSetPreference = preferencesRepo.setPreference;
    jest
      .spyOn(preferencesRepo, "setPreference")
      .mockImplementation(async (key, value) => {
        if (key === "onboarding.completed_at") {
          throw new Error("Simulated write failure");
        }
        return realSetPreference(key, value);
      });

    await expect(finalizeOnboarding(TEST_USER_ID, draft)).rejects.toThrow(
      OnboardingFinalizationError,
    );

    // No habit row — the insert was rolled back.
    const active = await listActiveHabits(TEST_USER_ID);
    expect(active).toHaveLength(0);

    // Completion mark NOT written (the throw on this step is what triggered rollback).
    expect(await isOnboardingCompleted()).toBe(false);

    // Draft preserved (the delete was rolled back).
    const reloaded = await loadOnboardingDraft();
    expect(reloaded.tinyAction).toBe("Run for 2 minutes");
  });
});
```

The third test is the rollback-validation test. It's the one that confirms decision D4 actually delivers atomicity rather than just hopeful sequencing. Don't skip it.

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes — three new completion tests included.
- Manual end-to-end: from a fresh sign-in (or after `wipeLocalDb`), navigate Welcome → Becoming ("a runner") → Daily Action ("Run for 30 minutes") → Shrink ("Run for 2 minutes") → Cue ("morning coffee" / "Run for 2 minutes") → Worst-day "Yes" → Confirmation. The summary card reads correctly: *Your becoming: a runner. Your habit: After I morning coffee, I will Run for 2 minutes. Starts: today.* Tap "Start showing up." → button shows "Starting..." briefly, then the app navigates to Today and shows the new Focus habit ready to log.
- Manual: pre-populate a Focus habit in the DB (via dev REPL), then run the onboarding flow. On Confirmation, tap "Start showing up." → an inline error appears: *"You already have a Focus habit. Finish that one first."* The screen does not navigate. (Verifies cap-fail path.)
- Manual: relaunch the app immediately after a successful finalize. The app lands on Today (via RootEntryScreen) without showing onboarding again. The new habit is visible.

### References

- `docs/core-v1-requirements.md` §4.1 Confirmation.
- `docs/core-v1-requirements.md` §4.2 (post-onboarding land).
- `docs/sprint_tickets/sprint-plan.md` §S4 Deliverables (the on-submit list).
- `docs/tech-handoff-core-v1.md` §5 (repository pattern).
- `src/features/habits/api.ts` (the existing `createHabit` flow that this finalize mirrors).
- `src/features/habits/hooks.ts` `useUpdateHabitMutation` (pattern for invalidations after a mutation).

### Out of scope

- "Your first day. Start small." Today copy — deferred to S5 per decision D7.
- Per-screen unit test for ConfirmationScreen — S4-04.
- Trial entitlement gating around finalize — S8.
- Manual graduation request, weekly reviews, recovery — all later sprints.

---

## DEV-S4-04 — Per-screen tests, manual smoke, PROJECT_BRAIN update

**Estimate:** 0.5 day
**Depends on:** DEV-S4-03 merged into `sprint-4`.
**Branch suggestion:** `s4/screen-tests-and-smoke`

### Context

By the time this ticket starts, the full S4 flow is functional. This ticket locks it down with per-screen unit tests for the four new screens (so future refactors can't silently break the navigation contract), runs the manual end-to-end smoke checklist, and updates `PROJECT_BRAIN.md` §11 with the new sprint state.

The per-screen tests are deliberately lightweight. Each test renders one screen with a controlled draft context and asserts: (a) the screen renders the expected copy, (b) the Continue button has the right enabled/disabled state, (c) tapping the button calls `update` with the expected patch and `router.push` (or `router.replace`) with the expected href. We're testing the navigation contract, not the visual layout.

### Files to read first

- `src/features/onboarding/__tests__/RootEntryScreen.test.tsx` — pattern for mocking `expo-router`'s `Redirect`/`router` and the auth/onboarding hooks.
- `src/features/onboarding/__tests__/hooks.test.ts` — pattern for mocking the draft state and timer.
- The four new screen files from S4-01 / S4-02 / S4-03.

### Files to create

- `src/features/onboarding/__tests__/screens/ShrinkScreen.test.tsx`
- `src/features/onboarding/__tests__/screens/CueScreen.test.tsx`
- `src/features/onboarding/__tests__/screens/WorstDayCheckScreen.test.tsx`
- `src/features/onboarding/__tests__/screens/ConfirmationScreen.test.tsx`

### Files to modify

- `docs/PROJECT_BRAIN.md` — update §11 with the S4 closure note (see "PROJECT_BRAIN update" below).

### Required test cases

**`ShrinkScreen.test.tsx`** — three cases:

1. Renders the default header *"That's a great direction. Now let's make it laughably small for tomorrow."* when `worstDayPassed === null`.
2. Renders the alternate header *"Let's make it smaller. What would survive a hard day?"* when `worstDayPassed === false`.
3. Continue button is disabled when `tinyAction.trim()` is empty; enabled when populated. Tapping it calls `update({ step: "cue" })` and `router.push("/(onboarding)/cue")`.

Mock `useOnboarding` from `OnboardingProvider` to return controlled `{ draft, update }`. Mock `expo-router`'s `router.push` (`jest.mock("expo-router", () => ({ router: { push: jest.fn() } }))`).

**`CueScreen.test.tsx`** — three cases:

1. Renders both fields with values from `draft.cueExisting` and `draft.tinyAction`.
2. Continue button is disabled when either field is empty after trim; enabled when both have content. Tapping it calls `update({ step: "worst-day" })` and `router.push("/(onboarding)/worst-day")`.
3. Typing in the "After I" field calls `update({ cueExisting: <text> })`. Typing in the "I will" field calls `update({ tinyAction: <text> })` — proves the binding is to `tinyAction`, not a stale `cueAction`.

**`WorstDayCheckScreen.test.tsx`** — two cases:

1. Tapping "Yes, I could" calls `update({ worstDayPassed: true, step: "confirmation" })` and `router.push("/(onboarding)/confirmation")`.
2. Tapping "Probably not" calls `update({ worstDayPassed: false, step: "shrink" })` and `router.replace("/(onboarding)/shrink")`. **Critical:** assert `router.replace` was called, not `router.push` — this is the test that pins decision D3.

Mock `expo-router` to expose both `push` and `replace` as separate jest mocks.

**`ConfirmationScreen.test.tsx`** — three cases. This screen is the most logic-heavy.

1. Renders the summary fields with values from the draft. Specifically: *"After I [cueExisting], I will [tinyAction]"* in the habit row, and the becoming phrase in the becoming row.
2. Tapping "Start showing up." calls the mutation's `mutate`. Mock `useFinalizeOnboardingMutation` to return a controllable `{ mutate, isPending, isError, error }`.
3. When the mutation is in error state with `OnboardingFinalizationError("cap_failed", …)`, the screen renders the cap-failed copy *"You already have a Focus habit. Finish that one first."* When the error is `OnboardingFinalizationError("write_failed", …)` (or any other error), the screen renders the generic copy. The button is enabled (so the user can retry).

For mutation mocking: `jest.mock("@/features/onboarding/hooks", () => ({ useFinalizeOnboardingMutation: jest.fn() }))`. The test sets the return value per case.

### Manual smoke checklist

Run this on a real simulator or device. Mark each item ✅ before merging `sprint-4` into `main`.

1. **Happy path.** Wipe local DB. Sign in fresh. Walk Welcome → Becoming ("a runner") → Daily Action ("Run for 30 minutes") → Shrink ("Run for 2 minutes") → Cue ("morning coffee" / unchanged "Run for 2 minutes") → Worst-day "Yes" → Confirmation → "Start showing up." Lands on Today with the new habit. Force-quit and re-launch — still on Today.
2. **Worst-day No, single loop.** Repeat steps 1 through Worst-day. Tap "Probably not." Land on Shrink with alternate copy. Edit the tiny action to something smaller ("Put on running shoes"). Continue → Cue (the "I will" field reflects the new value) → Worst-day "Yes" → Confirmation → habit creates correctly with the smaller action.
3. **Worst-day No, multiple loops.** Repeat the Worst-day No three times in a row, editing the tiny action smaller each time. After the third successful "Yes", confirm: (a) only one habit was created, (b) the system back button on Today walks you back through Cue → Shrink (one screen each), not through three Worst-day screens. (Verifies decision D3 in the wild.)
4. **Resume on Confirmation.** Walk through to Confirmation but don't tap the CTA. Force-quit. Re-launch. Sign back in. Land on Confirmation with all summary fields populated correctly. Tap "Start showing up." → habit creates and you land on Today.
5. **Resume on Shrink after worst-day fail.** Walk through to Worst-day, tap "Probably not", land on Shrink with alternate copy. Force-quit. Re-launch. Sign back in. Land on Shrink with the alternate copy still rendering and the tiny-action input preserving your previous value. (Verifies `worstDayPassed: false` survives the round-trip.)
6. **Cap-fail on finalize.** Pre-create a Focus habit in the DB (via the dev REPL or by completing onboarding once and clearing the completion mark). Run the onboarding flow. On Confirmation, tap "Start showing up." → inline error shows the cap-failed copy. The screen does not navigate. Tap again — same error (the cap is still violated). Manually archive the existing Focus habit, then tap again — the new habit creates correctly.
7. **No regressions on existing flows.** Sign out. Sign back in as an existing test account that already has a habit. Confirm: lands directly on Today (no onboarding shown). The pre-auth Welcome screen is unchanged. The (app) group screens render normally.

### PROJECT_BRAIN update

Open `docs/PROJECT_BRAIN.md` and update §11 (Current state) to reflect S4 closure. Specifically:

- Move S4 from "Next" to "Done."
- Update the "Next" line to point at S5.
- Note that the becoming-bridge is now end-to-end functional from sign-in to first habit log.
- If the §11 section also tracks the transitional `weekly_reviews` console noise (see S2-followups), confirm whether it's still present or has been resolved as a side effect of any S4 work — likely unchanged, but verify and note.

Keep the update tight (3–5 lines). PROJECT_BRAIN is a developer-reference doc, not a changelog.

### Acceptance criteria

- `npx tsc --noEmit` clean on `sprint-4`.
- `npm test` passes — all four new screen tests included.
- The manual smoke checklist above is run on a simulator or device, with all 7 items checked ✅. Paste the checklist (or a brief confirmation) into the PR description for `sprint-4 → main`.
- `docs/PROJECT_BRAIN.md` §11 reflects S4 closure.

### References

- `src/features/onboarding/__tests__/RootEntryScreen.test.tsx` (mocking pattern reference).
- `src/features/onboarding/__tests__/hooks.test.ts` (renderHook + fake timers pattern).
- The four screen files from S4-01 through S4-03.

### Out of scope

- Cross-flow integration tests using a memory router — too heavy for the value at this scale.
- Snapshot tests — we're testing navigation contracts, not visual layout.
- Visual regression tests — out of scope for Core v1.
- Updates to the architectural decisions list in `sprint-plan.md` — the plan is the plan; the decisions live here in `sprint-4-tickets.md` §0.

---

## Definition of S4 done

S4 is complete when **all four tickets** are merged into the `sprint-4` branch AND:

1. `npx tsc --noEmit` is clean on the integration branch.
2. `npm test` passes on the integration branch (all new + existing suites).
3. The manual smoke checklist in DEV-S4-04 has been run end-to-end on a simulator or device. All 7 items are ✅.
4. The end-to-end flow works: a fresh sign-in lands the user on the onboarding Welcome, the user completes all 7 screens (including at least one worst-day No loop-back), and after tapping "Start showing up." the user lands on Today with one Focus habit visible. Re-launching the app sends them to Today, not back to onboarding.
5. The pre-auth `WelcomeScreen` and all existing `(app)` group screens render and behave exactly as they did at the close of S3 — no regressions.
6. `docs/PROJECT_BRAIN.md` §11 reflects S4 closure.

After S4 closes, S5 begins: redesigning Today around the Focus card, shipping the 30-day heatmap and identity-flavored streak, and including the *"Your first day. Start small."* first-day state copy that was deferred from S4 per decision D7.

The `sprint-4` → `main` PR closes the sprint.

---

*End of S4 ticket package.*
