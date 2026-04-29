# Sprint 3 — Dev Team Tickets

> **Status:** Ready for assignment.
> **Date:** April 29, 2026
> **Owner:** Tech Lead → Dev Team
> **Companion documents:** `sprint-plan.md` (S3 definition), `core-v1-requirements.md` (especially §4 onboarding flow), `tech-handoff-core-v1.md` (architecture, especially §4.6 and §7.1), `sprint-2-tickets.md` (the layer this builds on)

S3 is the first sprint of Phase B. It builds the first half of the onboarding flow — the becoming bridge from a stranger landing on a Welcome screen to a user who has named who they want to become and what that person does daily. No habit gets created in S3; that lands in S4. S3's job is to lay the rails (state machine, persistence, route group, entry routing) and ship three real screens.

This is a low-risk sprint by Phase A standards — there's no math, no engine swap, no contract migration. The risk is in the small details: getting the resume-on-relaunch behavior right, naming things to avoid confusion with the existing pre-auth `WelcomeScreen`, and not breaking the existing entry routing for users who already have habits.

---

## 0. Shared context — read before picking up a ticket

### Branching for this sprint

Per `sprint-plan.md` §8.5, every sprint runs on its own integration branch. **Before any ticket below starts**, cut the sprint branch off `main`:

```bash
git checkout main && git pull
git checkout -b sprint-3
git push -u origin sprint-3
```

Every ticket below branches off `sprint-3` and PRs back into `sprint-3`, not `main`. The `Branch suggestion` line on each ticket (e.g. `s3/state-and-persistence`) is the ticket branch, cut from `sprint-3`:

```bash
git checkout sprint-3 && git pull
git checkout -b s3/state-and-persistence
# ... do the work ...
# Open PR: s3/state-and-persistence → sprint-3
```

When all four tickets are merged into `sprint-3` and the Definition of S3 done is met, open one final PR: `sprint-3` → `main`. Do not open ticket PRs against `main` directly.

### What's already done

Phase A closed at the end of S2. By the time your S3 code runs:

- The local DB is open and migrated. `getDb()` returns a working SQLite connection.
- Three repositories are live: `habits.ts`, `habit_logs.ts`, `preferences.ts` in `src/lib/db/repositories/`.
- The forgiving streak rule is shipped in `features/today/progress.ts`, including the §8.3 skipped-day removal logic.
- `features/habits/api.ts` is fully on SQLite. The 48-hour retroactive window is enforced through `RetroLogError`.
- `assertCanCreateActiveHabit` is in `features/habits/validators.ts` and works against the SQLite repo.
- `useEligibleHabitsQuery` and `useUpcomingActiveHabitsQuery` (used by `RootEntryScreen`) are fully on SQLite and reliable signals.

You should not need to add any new repository functions in S3. If you want one, ask first — it likely belongs in the new `features/onboarding/` module instead of in `lib/db/repositories/`.

### What we are NOT touching in S3

These are out of scope. If you find yourself reaching for them, stop and check.

- `features/today/`, `features/habits/`, `features/reviews/`, `features/recommendations/` — all stay as-is. The Today screen redesign lands in S5; S3's only job in those parts of the tree is to **not break them**.
- `features/auth/` — the auth flow is unchanged. Sign-up, sign-in, session bootstrap all work.
- The existing `features/entry/screens/WelcomeScreen.tsx` — this is the **pre-auth** welcome screen ("Habit Builder MVP / Start Your First Habit"). It stays exactly as it is. **Do not modify it.** S3 introduces a *different* Welcome screen for the post-auth onboarding flow; see decision (3) below.
- AI features (`aiRewrite` flag stays `false`).
- Trial entitlement validation (S8).
- Reminders, library, graduation, recovery (later sprints).

### Architectural decisions for S3 (and why)

These are the decisions that shape the ticket package. They were made by the tech lead and are not up for re-litigation in implementation. If you hit a case where one of them seems wrong, raise it before deviating.

**(1) Multi-route flow with shared state context.** Onboarding is implemented as a new Expo Router route group `app/(onboarding)/`, with one route file per step. S3 ships three steps: `welcome.tsx`, `becoming.tsx`, `daily-action.tsx`. S4 will add `shrink.tsx`, `cue.tsx`, `worst-day.tsx`, `confirm.tsx` under the same group. Shared state lives in a context provider mounted in `app/(onboarding)/_layout.tsx`.

The alternative considered was a single screen with internal step state. Multi-route was chosen because each step is a real screen — native back gestures, hardware back on Android, and Expo Router's transition handling all work without extra code.

**(2) Draft state persists to SQLite via the preferences repo, not AsyncStorage.** The sprint plan's S3 entry says "Onboarding resume state persisted to AsyncStorage via `local_user_preferences`" — that's a writing slip; AsyncStorage and `local_user_preferences` are two different storage layers. The tech lead's resolution is **SQLite via `local_user_preferences`**:

- Single source of truth for onboarding state
- Atomic writes via the existing `setPreference`
- Easy to clear on completion (one `deletePreference` call)
- AsyncStorage is reserved for cached *server* state (entitlement cache, S8) per `tech-handoff-core-v1.md` §4.7

If a future need arises for a non-SQLite onboarding cache (e.g. pre-DB-init state during app cold start), reopen the discussion. For S3, the DB is open before any onboarding screen renders (gated by `app/_layout.tsx`), so SQLite access is safe.

**(3) The S3 "Welcome" is a different screen from the existing `WelcomeScreen`.** The existing `src/features/entry/screens/WelcomeScreen.tsx` is shown to **unauthenticated** users — it's the sign-up / sign-in landing. The S3 Welcome screen is shown to **authenticated** users who haven't completed onboarding — it's the first step of the becoming bridge. They live in different feature modules:

- Pre-auth: `src/features/entry/screens/WelcomeScreen.tsx` — unchanged
- Post-auth onboarding: `src/features/onboarding/screens/WelcomeScreen.tsx` — new

Path-based imports disambiguate. **Do not rename, merge, or modify the existing pre-auth `WelcomeScreen`.**

**(4) The draft is one JSON blob under one preferences key.** The full draft state — current step plus all field values, including S4 fields defined but not yet used — serializes to a single JSON object stored under the key `onboarding.draft`. Completion is tracked separately under `onboarding.completed_at`. This makes "resume onboarding" a single read and "complete onboarding" two writes (set completed_at, delete draft).

**(5) Persistence is debounced at 200ms.** Every state change writes to SQLite. With raw text input firing on every keystroke, that would be ~10 writes/second per field. SQLite handles it, but it's wasteful and introduces a small race risk. A 200ms debounce is invisible to the user and cuts writes by ~50x. Implementation in DEV-S3-01.

**(6) S3's Daily Action screen has no Continue button.** S3 ships three screens. Daily Action's natural next-step is Shrink, which lands in S4. Rather than wiring stubs for S4 routes, Daily Action renders a calm "Saved. More coming next." line at the bottom of the screen instead of a Continue button. State still persists on every keystroke (per (5)). The button comes back in S4 when there's a real route to advance to.

**(7) One-time onboarding completion backfill in RootEntryScreen.** Existing dev test accounts have habits but no `onboarding.completed_at` flag. Without a backfill, if any of those users archives all their habits in the future, the entry router would send them back into onboarding — confusing and incorrect. The backfill: on first run after S3, if any active habit exists for the current user and `onboarding.completed_at` is null, write it. Five lines of code in DEV-S3-04.

### File / folder layout for the new module

The full `features/onboarding/` shape — what S3 ships and what S4 will fill in:

```
src/features/onboarding/
├── types.ts                    # S3 — OnboardingStep, OnboardingDraft, EMPTY_DRAFT, key constants
├── storage.ts                  # S3 — load/save/clear draft, mark/check completion (calls preferences repo)
├── hooks.ts                    # S3 — useOnboardingDraft hook (state + debounced persist)
├── OnboardingProvider.tsx      # S3 — React context wrapping the hook
├── screens/
│   ├── WelcomeScreen.tsx       # S3 — Screen 1
│   ├── BecomingScreen.tsx      # S3 — Screen 2
│   ├── DailyActionScreen.tsx   # S3 — Screen 3
│   ├── ShrinkScreen.tsx        # S4
│   ├── CueScreen.tsx           # S4
│   ├── WorstDayCheckScreen.tsx # S4
│   └── ConfirmationScreen.tsx  # S4
└── components/                 # (S4 — coaching paragraphs, example lists; S3 inlines its small bits)
```

Plus the route files:

```
app/(onboarding)/
├── _layout.tsx                 # S3 — Stack + OnboardingProvider + resume redirect logic
├── index.tsx                   # S3 — redirect to current step based on draft
├── welcome.tsx                 # S3 — renders OnboardingScreens/WelcomeScreen
├── becoming.tsx                # S3
├── daily-action.tsx            # S3
├── shrink.tsx                  # S4
├── cue.tsx                     # S4
├── worst-day.tsx               # S4
└── confirm.tsx                 # S4
```

### Conventions reminder (carried from S1 / S2)

These are unchanged. Quick refresher:

1. **`getDb()` is the only DB access path.** Feature modules go through repositories.
2. **Repositories never expose SQL.** S3 doesn't need new repo functions.
3. **Timestamps are ISO strings.** `new Date().toISOString()` — but if you're adding logic that depends on "now" for tests, use `now()` from `@/utils/clock` so tests can advance time deterministically.
4. **`log_date` is `YYYY-MM-DD` device-local.** N/A for S3 (no logging here), but the convention applies elsewhere.
5. **IDs are `crypto.randomUUID()`** — S3 doesn't generate any habit IDs (no habit created until S4).
6. **Errors propagate.** Don't swallow.
7. **Habit rules are product rules.** N/A for S3 directly, but onboarding is the rail that delivers users to the rules.

### Path aliases

`@/*` maps to `src/*`. Same as before.

### Sequencing

```
DEV-S3-01  State machine + persistence + context     (foundation)
   ↓
DEV-S3-02  Route group shell + Welcome (Screen 1)
   ↓
DEV-S3-03  Becoming + Daily Action (Screens 2 & 3)
   ↓
DEV-S3-04  Entry routing + backfill + smoke test
```

Strictly serial. -02 needs the persistence layer from -01. -03 builds screens that mount inside the route group from -02. -04's smoke test wants the full S3 flow available to walk.

A determined dev could do -04's RootEntryScreen changes in parallel with -03 (the routing logic only depends on the state shape from -01 and the route group from -02, not the inner screens). But the smoke test would still wait on -03. Treat the sequence as serial unless coordination cost is genuinely high.

---

## DEV-S3-01 — Onboarding state machine, persistence, and context provider

**Estimate:** 0.5 day
**Depends on:** sprint-3 branch cut (no code dependency on S2 work beyond the preferences repo)
**Branch suggestion:** `s3/state-and-persistence`

### Context

The onboarding flow needs a single shared draft — the user's current step plus the values they've entered — that persists across screen mounts, resumes correctly after an app kill, and is cheap to write to. This ticket builds that layer. By the end, no UI exists yet; what exists is a context provider that any onboarding screen can `useOnboarding()` to read and update.

The state shape includes **all** onboarding fields, including ones S4 will fill in. We define the full shape now so S4 doesn't have to refactor the persisted draft format.

### Files to create

```
src/features/onboarding/types.ts
src/features/onboarding/storage.ts
src/features/onboarding/hooks.ts
src/features/onboarding/OnboardingProvider.tsx
src/features/onboarding/__tests__/storage.test.ts
src/features/onboarding/__tests__/hooks.test.ts
```

### Files to read first

```
src/lib/db/repositories/preferences.ts        # the storage primitives
src/utils/clock.ts                            # now() for testable timestamps
docs/core-v1-requirements.md §4               # onboarding flow spec
docs/tech-handoff-core-v1.md §4.6             # local_user_preferences purpose
```

### Required exports — `types.ts`

```ts
export type OnboardingStep =
  | "welcome"
  | "becoming"
  | "daily-action"
  | "shrink"        // S4
  | "cue"           // S4
  | "worst-day"     // S4
  | "confirmation"; // S4

export type OnboardingDraft = {
  step: OnboardingStep;
  becomingPhrase: string;
  dailyAction: string;
  // S4 fields — defined now, populated in S4. Default to empty string / null.
  tinyAction: string;
  cueExisting: string;
  cueAction: string;
  worstDayPassed: boolean | null;
};

export const EMPTY_DRAFT: OnboardingDraft = {
  step: "welcome",
  becomingPhrase: "",
  dailyAction: "",
  tinyAction: "",
  cueExisting: "",
  cueAction: "",
  worstDayPassed: null,
};

// Preference keys.
export const ONBOARDING_DRAFT_KEY = "onboarding.draft";
export const ONBOARDING_COMPLETED_AT_KEY = "onboarding.completed_at";
```

Notes:

- `step` is a union, not a number. Named steps survive refactors better and read naturally in logs.
- The S4 fields are present in `EMPTY_DRAFT` so loading a draft saved before they were populated still type-checks.
- Keys are namespaced (`onboarding.*`) to keep `local_user_preferences` tidy as we add more keys in later sprints.

### Required exports — `storage.ts`

```ts
import {
  deletePreference,
  getPreference,
  setPreference,
} from "@/lib/db/repositories/preferences";
import { now } from "@/utils/clock";

import {
  EMPTY_DRAFT,
  ONBOARDING_COMPLETED_AT_KEY,
  ONBOARDING_DRAFT_KEY,
  type OnboardingDraft,
} from "./types";

/**
 * Load the persisted draft, or EMPTY_DRAFT if nothing has been saved.
 * Tolerates partial / malformed JSON by falling back to EMPTY_DRAFT.
 */
export async function loadOnboardingDraft(): Promise<OnboardingDraft>;

/**
 * Persist the full draft as a single JSON blob under ONBOARDING_DRAFT_KEY.
 */
export async function saveOnboardingDraft(draft: OnboardingDraft): Promise<void>;

/**
 * Remove the draft entirely. Called after onboarding completes (S4).
 */
export async function clearOnboardingDraft(): Promise<void>;

/**
 * Returns true iff ONBOARDING_COMPLETED_AT_KEY is present.
 * Used by entry routing in DEV-S3-04.
 */
export async function isOnboardingCompleted(): Promise<boolean>;

/**
 * Set ONBOARDING_COMPLETED_AT_KEY to the current ISO timestamp.
 * Called by S4 confirmation flow and by DEV-S3-04's backfill.
 */
export async function markOnboardingCompleted(): Promise<void>;
```

Behavior notes:

- `loadOnboardingDraft` parses the JSON and merges over `EMPTY_DRAFT`. If parsing throws (corrupted state, manual SQL mucking), return `EMPTY_DRAFT` and log via `@/services/logger.warn`. **Don't throw out of the loader** — a fresh user has no draft and that's normal; corruption is rare and recoverable by starting over.
- `saveOnboardingDraft` writes the entire blob. Don't try to merge or diff; the caller already holds the full state.
- `markOnboardingCompleted` uses `now()` from `@/utils/clock`, not `Date.now()` directly, so tests can advance the clock.

### Required exports — `hooks.ts`

```ts
export function useOnboardingDraft(): {
  draft: OnboardingDraft;
  hydrated: boolean;
  update: (patch: Partial<OnboardingDraft>) => void;
};
```

Behavior:

- On mount, calls `loadOnboardingDraft()` and sets `hydrated=true` once the load resolves. Until hydrated, `draft` reflects `EMPTY_DRAFT`.
- `update(patch)` shallow-merges `patch` into the current draft, sets the new state, and **debounced-writes** to SQLite at 200ms after the last call. Multiple rapid updates collapse into one write.
- The hook owns a single `setTimeout` reference cleared on each new update and on unmount. On unmount, **flush** — synchronously fire the pending write so a navigation-triggered unmount doesn't lose the last keystroke.

Implementation sketch (illustrative — feel free to adjust style, just preserve the semantics):

```ts
export function useOnboardingDraft() {
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);

  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDraft = useRef<OnboardingDraft | null>(null);

  // Hydrate once on mount.
  useEffect(() => {
    let cancelled = false;
    loadOnboardingDraft()
      .then((loaded) => {
        if (!cancelled) {
          setDraft(loaded);
          setHydrated(true);
        }
      })
      .catch((error: unknown) => {
        logger.warn("Failed to load onboarding draft", { error });
        if (!cancelled) setHydrated(true); // proceed with EMPTY_DRAFT
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Flush pending write on unmount.
  useEffect(() => {
    return () => {
      if (pendingTimer.current && pendingDraft.current) {
        clearTimeout(pendingTimer.current);
        void saveOnboardingDraft(pendingDraft.current);
      }
    };
  }, []);

  const update = useCallback((patch: Partial<OnboardingDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      pendingDraft.current = next;
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      pendingTimer.current = setTimeout(() => {
        void saveOnboardingDraft(next);
        pendingTimer.current = null;
        pendingDraft.current = null;
      }, 200);
      return next;
    });
  }, []);

  return { draft, hydrated, update };
}
```

### Required exports — `OnboardingProvider.tsx`

```ts
import { createContext, use, type ReactNode } from "react";
import { useOnboardingDraft } from "./hooks";

type OnboardingContextValue = ReturnType<typeof useOnboardingDraft>;

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const value = useOnboardingDraft();
  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = use(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return ctx;
}
```

Pattern note: this matches the existing `useAuthSession` shape in `features/auth/hooks.ts` — same `React.use(Context)` idiom, same throw-if-outside-provider behavior. Don't drift from this pattern.

### Required tests

#### `__tests__/storage.test.ts`

Uses the existing test setup (in-memory SQLite via `createTestDb()` per `src/tests/setup/createTestDb.ts`). The preferences repo writes against the same DB.

- `loadOnboardingDraft` returns `EMPTY_DRAFT` when nothing has been saved.
- `saveOnboardingDraft` then `loadOnboardingDraft` round-trips a full draft.
- A draft saved with old shape (e.g. missing `tinyAction`) merges over `EMPTY_DRAFT` and returns a complete draft.
- Manually writing malformed JSON to the key (call `setPreference` directly with `"{not json"`) and then loading returns `EMPTY_DRAFT`. Logger warning is acceptable; the function must not throw.
- `clearOnboardingDraft` removes the row. Subsequent load returns `EMPTY_DRAFT`.
- `markOnboardingCompleted` then `isOnboardingCompleted` returns true.
- Without a completion mark, `isOnboardingCompleted` returns false.

#### `__tests__/hooks.test.ts`

Use `@testing-library/react-hooks` (already a project dep — confirm in `package.json`; if not, use `renderHook` from `@testing-library/react-native`). Use Jest fake timers (`jest.useFakeTimers()`) to control the debounce.

- After mount, `hydrated` flips from false to true.
- `update({ becomingPhrase: "a runner" })` updates `draft.becomingPhrase` synchronously.
- Three rapid updates within the debounce window result in **one** write to storage with the final value (mock `saveOnboardingDraft` and assert call count).
- After the debounce window elapses, the storage write fires.
- Unmount before the debounce fires still flushes the latest write synchronously (mock fires once with the latest state).

### Acceptance criteria

- All six files exist with the exports listed above.
- `npx tsc --noEmit` is clean.
- `npm test` passes — both new test files and the existing repo suites.
- No changes outside `src/features/onboarding/` and its `__tests__/`. Do not touch the preferences repo, the entry screen, or `app/`.
- The hook's debounce semantics are demonstrably correct in tests (one write per quiet period).

### References

- `src/lib/db/repositories/preferences.ts` (the only DB primitives used)
- `src/utils/clock.ts` (testable timestamps)
- `src/features/auth/hooks.ts` (the context-provider pattern to mirror)
- `docs/core-v1-requirements.md` §4

### Out of scope

- Any UI work — no screens, no components, no JSX outside the provider boilerplate
- The route group (`app/(onboarding)/`) — that's DEV-S3-02
- Entry routing changes — that's DEV-S3-04
- The S4 fields on the draft are *defined* here, but no logic uses them. Don't add S4 transitions.

---

## DEV-S3-02 — Onboarding route group + Welcome screen (Screen 1)

**Estimate:** 0.5 day
**Depends on:** DEV-S3-01
**Branch suggestion:** `s3/route-and-welcome`

### Context

This ticket sets up the new Expo Router group `(onboarding)` and ships the first real screen — the post-auth Welcome that begins the becoming bridge. The group's `_layout.tsx` mounts the `OnboardingProvider` from -01 and handles resume-on-mount: if a draft exists with a non-`welcome` step, redirect to that step's route.

The Welcome screen itself is intentionally simple: one piece of copy, one button. The hard work in this ticket is the route plumbing.

### Files to create

```
app/(onboarding)/_layout.tsx
app/(onboarding)/index.tsx
app/(onboarding)/welcome.tsx
src/features/onboarding/screens/WelcomeScreen.tsx
```

### Files to read first

```
app/_layout.tsx                              # how the root Stack is configured
app/(auth)/_layout.tsx                       # for the screenOptions pattern
src/features/onboarding/types.ts             # OnboardingStep
src/features/onboarding/OnboardingProvider.tsx
src/features/entry/screens/WelcomeScreen.tsx # for theme tokens, NOT to copy structure — this is the pre-auth screen
docs/core-v1-requirements.md §4.1            # the Screen 1 spec
```

### Required changes — `app/(onboarding)/_layout.tsx`

```tsx
import { Stack } from "expo-router";

import { OnboardingProvider } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: false,
          gestureEnabled: false, // see note below
        }}
      />
    </OnboardingProvider>
  );
}
```

Notes:

- `gestureEnabled: false` prevents the iOS swipe-back gesture from skipping a step backward without going through the state machine. We don't want the user to swipe back from Becoming to Welcome and find their typed text reset because the step transition wasn't called. Forward navigation goes through buttons; backward navigation (when allowed in S4 — e.g. Worst-day → Shrink) will be explicit. **In S3, the user is not expected to navigate backward at all.**
- Header is hidden across all onboarding screens — they own their own visual chrome.

### Required changes — `app/(onboarding)/index.tsx`

This is the resume router. When something points at `/(onboarding)` without specifying a step, this file decides where to send them.

```tsx
import { Redirect } from "expo-router";

import { LoadingState } from "@/components/feedback/LoadingState";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import type { OnboardingStep } from "@/features/onboarding/types";

const STEP_TO_HREF: Record<OnboardingStep, string> = {
  "welcome": "/(onboarding)/welcome",
  "becoming": "/(onboarding)/becoming",
  "daily-action": "/(onboarding)/daily-action",
  // S4 steps redirect to welcome for now — S4 will replace these entries.
  "shrink": "/(onboarding)/welcome",
  "cue": "/(onboarding)/welcome",
  "worst-day": "/(onboarding)/welcome",
  "confirmation": "/(onboarding)/welcome",
};

export default function OnboardingIndex() {
  const { draft, hydrated } = useOnboarding();

  if (!hydrated) {
    return <LoadingState message="Picking up where you left off..." />;
  }

  return <Redirect href={STEP_TO_HREF[draft.step]} />;
}
```

Notes:

- The S4 step entries point at `welcome` deliberately. In S3, the user can never reach those steps (we don't ship the screens that advance to them). A defensive map entry prevents a runtime crash if a malformed draft somehow lands on the device. S4 will replace those entries with the real step routes.
- `LoadingState` is the existing component at `src/components/feedback/LoadingState.tsx` — same one used in `RootEntryScreen`.

### Required changes — `app/(onboarding)/welcome.tsx`

```tsx
export { default } from "@/features/onboarding/screens/WelcomeScreen";
```

Single-line re-export — matches the pattern in `app/index.tsx`.

### Required changes — `src/features/onboarding/screens/WelcomeScreen.tsx`

The Screen 1 component. Spec from `core-v1-requirements.md` §4.1:

> **Screen 1 — Welcome.** *"This is a tool for becoming. We help you turn who you want to be into something you can do tomorrow morning. Let's start."* One CTA: "Begin."

Implementation requirements:

- Calm, single-card layout. No imagery beyond what the design system provides. No emoji. No gamification.
- Use existing theme tokens: `colors`, `typography`, `spacing`, `radius`, `shadows`. **Do not introduce new theme tokens in S3** — the design system additions for heatmap, library, etc. land in their respective sprints.
- Use the existing `PrimaryButton` from `@/components/buttons/PrimaryButton` for the CTA. The label is `"Begin"`.
- On Begin tap, call `update({ step: "becoming" })` and `router.push("/(onboarding)/becoming")`.

Skeleton:

```tsx
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function WelcomeScreen() {
  const { update } = useOnboarding();

  const handleBegin = () => {
    update({ step: "becoming" });
    router.push("/(onboarding)/becoming");
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <View style={styles.heroCard}>
        <Text selectable style={styles.title}>
          This is a tool for becoming.
        </Text>
        <Text selectable style={styles.body}>
          We help you turn who you want to be into something you can do
          tomorrow morning. Let's start.
        </Text>
      </View>

      <PrimaryButton label="Begin" onPress={handleBegin} />
    </ScrollView>
  );
}

// styles — model on src/features/entry/screens/WelcomeScreen.tsx for spacing/radius/shadow values.
```

The styles can mirror the existing `features/entry/screens/WelcomeScreen.tsx` pattern (heroCard with surface bg, large title, muted body, content gap). Keep the visual language consistent across the two welcome screens — they're different pages but share a brand voice.

### Naming clarification — re-read decision (3)

You will have **two** files named `WelcomeScreen.tsx` in the codebase after this ticket:

- `src/features/entry/screens/WelcomeScreen.tsx` — pre-auth, exists, do not touch
- `src/features/onboarding/screens/WelcomeScreen.tsx` — post-auth, new, this ticket

Path-based imports keep them distinct. If your IDE auto-imports the wrong one, fix the import. Don't rename either file to disambiguate — both names match their feature module conventions.

### Acceptance criteria

- The four files above exist.
- `npx tsc --noEmit` is clean.
- `npm test` passes.
- Manual smoke test: launch the app, manually push `router.push("/(onboarding)")` from a debug REPL or temporarily wire it from the existing pre-auth WelcomeScreen's "Start Your First Habit" button. The app lands on the onboarding Welcome. Tapping Begin advances to `/(onboarding)/becoming` (which won't render anything yet since DEV-S3-03 hasn't shipped — a 404 or blank screen is acceptable for the smoke test, since the navigation succeeded).
- The provider is mounted exactly once (in the layout), not per-screen. Verify by adding a temporary `console.log` in the provider's render — it should fire once when entering `(onboarding)` and stay mounted across step navigations.
- **Do not** modify `RootEntryScreen.tsx`. That's DEV-S3-04.

### References

- `app/_layout.tsx` (root layout pattern)
- `app/(auth)/_layout.tsx` (group layout precedent — confirm the screenOptions look the team uses)
- `src/features/entry/screens/WelcomeScreen.tsx` (style and structure to mirror, but don't copy verbatim — the two welcomes deliver different content)

### Out of scope

- Becoming and Daily Action screens (DEV-S3-03)
- Entry routing (DEV-S3-04)
- Backward-navigation UX — none expected in S3
- Animations / transitions beyond Expo Router defaults

---

## DEV-S3-03 — Becoming and Daily Action screens (Screens 2 + 3)

**Estimate:** 1 day
**Depends on:** DEV-S3-02
**Branch suggestion:** `s3/becoming-and-daily-action`

### Context

Two text-input screens with examples that nudge the user toward a clearer becoming phrase and a clearer daily action. These are the highest-value screens in the becoming bridge for *what we're collecting*; the magic happens in the user's head, not in the code. Our job is to keep the path frictionless and the copy quietly suggestive.

This ticket also introduces a small heuristic — the daily-action placeholder adapts to common patterns in the becoming phrase. It's not full noun extraction (that's a Screen 5 / Today-screen concern in S5); it's a placeholder hint to help the user get started.

### Files to create

```
app/(onboarding)/becoming.tsx
app/(onboarding)/daily-action.tsx
src/features/onboarding/screens/BecomingScreen.tsx
src/features/onboarding/screens/DailyActionScreen.tsx
src/features/onboarding/dailyActionPlaceholder.ts
src/features/onboarding/__tests__/dailyActionPlaceholder.test.ts
```

### Files to read first

```
src/features/onboarding/OnboardingProvider.tsx
src/features/onboarding/types.ts
docs/core-v1-requirements.md §4.1            # Screen 2 + Screen 3 spec
```

### Screen 2 — `BecomingScreen.tsx`

Spec from §4.1:

> **Screen 2 — Becoming.** *"Who do you want to become?"* Free text input with examples below: a runner, someone who reads daily, a calmer person, a writer, someone who sleeps well. Captured verbatim. Reflected back throughout the app.

Implementation:

- Header: *"Who do you want to become?"*
- Multi-line `TextInput` (single line is too cramped — these phrases can be 4–10 words).
- `value` bound to `draft.becomingPhrase`. `onChangeText` calls `update({ becomingPhrase: text })`.
- Below the input: a calm subhead *"For example:"* and a simple list (not bullets — comma-separated or stacked plain text) of the five examples from the spec, captured **verbatim**:
  - a runner
  - someone who reads daily
  - a calmer person
  - a writer
  - someone who sleeps well
- Continue button (PrimaryButton, label `"Continue"`):
  - Disabled when `draft.becomingPhrase.trim().length === 0`
  - On tap: `update({ step: "daily-action" })` + `router.push("/(onboarding)/daily-action")`

The wording matters here — the user is supposed to feel quietly invited, not interrogated. Keep the copy as the spec states it. Do not paraphrase, do not soften, do not "improve."

### Screen 3 — `DailyActionScreen.tsx`

Spec from §4.1:

> **Screen 3 — Daily action.** *"What does that person do every day?"* Free text. Example placeholders adjust based on common identities.

Implementation:

- Header: *"What does that person do every day?"*
- Above the input: a small reflection of the becoming phrase. *"Becoming: [draft.becomingPhrase]"*. Treat this as a quiet, non-editable acknowledgment — small text, muted color. The user sees what they said and feels heard.
- Multi-line `TextInput`. Bound to `draft.dailyAction`. `onChangeText` calls `update({ dailyAction: text })`.
- The input's `placeholder` prop is set by `getDailyActionPlaceholder(draft.becomingPhrase)` (from the helper module described below).
- Below the input: helper text. *"Even one minute counts. We'll make it smaller in the next step."*
- **No Continue button** in S3 (per architectural decision (6) in §0). At the very bottom of the screen, a calm one-liner: *"Saved. More coming next."*

The "no Continue" decision is intentional; do not add a disabled button or a placeholder. The screen is quietly truthful about the state of the build.

### `dailyActionPlaceholder.ts`

A tiny rule-based helper. Maps becoming-phrase keywords to placeholder hints. Pure, no I/O, easy to test.

```ts
/**
 * Returns a placeholder hint for the Daily Action input, chosen from
 * keywords in the becoming phrase. Falls back to a generic invitation.
 *
 * This is NOT identity-noun extraction (that's S5). It's a low-effort
 * nudge to help the user get started. Misses are fine — fallback covers them.
 */
export function getDailyActionPlaceholder(becomingPhrase: string): string;
```

Behavior:

- Lowercase the phrase, then check substrings in order. First match wins.
- Suggested mapping (keyword → placeholder):

  | Keyword (substring match) | Placeholder |
  |---|---|
  | `run` (runner, runs, running) | "Run for 10 minutes" |
  | `read` (reader, reads, reading) | "Read one page" |
  | `writ` (writer, writes, writing) | "Write one sentence" |
  | `medit` (meditate, meditating, meditator) | "Sit quietly for one minute" |
  | `calm` | "Take three slow breaths" |
  | `sleep` | "Be in bed by 10:30pm" |
  | `draw` (drawing, draws) | "Sketch for two minutes" |
  | `walk` | "Walk for ten minutes" |
  | (none) | "Take one small action" |

- Empty/whitespace input → return the generic fallback.

Implementation can be a simple `for` loop over an `[keyword, placeholder]` array. Don't reach for regex or NLP libs.

### Tests — `__tests__/dailyActionPlaceholder.test.ts`

- Each row of the mapping returns the expected placeholder. One assertion per keyword (9 cases).
- Phrases combining multiple keywords return the **first** matching placeholder per the array order. (Document the order explicitly in code so the test is deterministic.)
- Empty string returns the generic fallback.
- Whitespace-only string returns the generic fallback.
- Mixed-case input is matched (e.g. `"A RUNNER"` → run mapping).
- A nonsense phrase ("a more deliberate person") returns the generic fallback.

### Acceptance criteria

- The six files above exist.
- `npx tsc --noEmit` is clean.
- `npm test` passes — including the placeholder tests.
- Manual smoke test:
  - Launch app, navigate manually to `/(onboarding)`. Land on Welcome.
  - Tap Begin. Land on Becoming. Header reads *"Who do you want to become?"* Examples below.
  - Type "a runner" — Continue button enables.
  - Tap Continue. Land on Daily Action. The reflection above the input shows *"Becoming: a runner"*. The placeholder reads *"Run for 10 minutes"*.
  - Type "Run for 5 minutes." Bottom of screen shows *"Saved. More coming next."* — no Continue button.
  - Kill the app cold (force quit, not just background). Re-launch. Manually navigate back to `/(onboarding)`. The flow lands on Daily Action with both fields preserved. (The full RootEntryScreen path lands here too once DEV-S3-04 ships; for this smoke test, manually pushing the route is fine.)
- **Do not** add a Continue button to Daily Action.
- **Do not** modify `RootEntryScreen` or anything outside `src/features/onboarding/` and `app/(onboarding)/`.

### References

- `docs/core-v1-requirements.md` §4.1 (Screens 2 and 3 specs — copy verbatim)
- `src/components/buttons/PrimaryButton.tsx` (the CTA button)
- `src/theme/` (typography, colors, spacing tokens)

### Out of scope

- Identity-noun extraction (that's S5)
- Real Continue button on Daily Action (S4)
- Animations between screens
- Form validation beyond "non-empty trim" for the becoming phrase

---

## DEV-S3-04 — Entry routing, completion backfill, and smoke test

**Estimate:** 0.5 day
**Depends on:** DEV-S3-03
**Branch suggestion:** `s3/entry-routing`

### Context

The final ticket wires the onboarding flow into the existing entry router. After this ticket lands, a freshly signed-up user who has no habits and no completion mark will be sent into onboarding automatically. A user with active habits goes to Today as before. A user who completed onboarding but has no active habits (e.g. archived their last habit) goes to the existing post-onboarding habit creation screen — that's a fallback we keep for graceful degradation.

This ticket also adds a one-time backfill so existing dev test accounts (who have habits but no completion mark) are marked complete on first run. Without it, those accounts would be sent into onboarding the next time they archive all their habits.

The smoke test in this ticket exercises the full S3 flow end-to-end and verifies the entry routing decisions.

### Files to modify / create

```
src/features/entry/screens/RootEntryScreen.tsx       # MODIFY — extend routing
src/features/onboarding/hooks.ts                     # MODIFY — add useIsOnboardingCompletedQuery
src/features/onboarding/__tests__/RootEntryScreen.test.tsx   # CREATE — routing smoke test
```

### Files to read first

```
src/features/entry/screens/RootEntryScreen.tsx       # current routing logic
src/features/habits/hooks.ts                         # useEligibleHabitsQuery / useUpcomingActiveHabitsQuery
src/features/onboarding/storage.ts                   # isOnboardingCompleted, markOnboardingCompleted
src/features/auth/hooks.ts                           # useAuthSession shape
```

### Required changes — `src/features/onboarding/hooks.ts`

Add a new export at the end of the file:

```ts
import { useQuery } from "@tanstack/react-query";

import { isOnboardingCompleted } from "./storage";

export function getIsOnboardingCompletedQueryKey(userId: string | undefined) {
  return ["onboarding", "completed", userId ?? "guest"];
}

export function useIsOnboardingCompletedQuery() {
  const { user } = useAuthSession();
  return useQuery({
    queryKey: getIsOnboardingCompletedQueryKey(user?.id),
    queryFn: isOnboardingCompleted,
    enabled: Boolean(user?.id),
    staleTime: Infinity, // completion is monotonic — once set, never reverts
  });
}
```

Notes:

- `staleTime: Infinity` because the completion flag, once written, never reverts. The only way to "un-complete" onboarding is account deletion (S18), which already wipes the local DB and clears the React Query cache.
- After S4's confirmation flow writes `markOnboardingCompleted`, S4 must invalidate this query — that's an S4 concern, but it's worth flagging here so the S4 author knows the queryKey factory exists.
- `useAuthSession` import gets added; mind the existing import ordering convention.

### Required changes — `RootEntryScreen.tsx`

Replace the body of `RootEntryScreen` with a new routing decision tree. The shape:

```tsx
import { useEffect } from "react";
import { Redirect } from "expo-router";

import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { useAuthSession } from "@/features/auth/hooks";
import {
  useEligibleHabitsQuery,
  useUpcomingActiveHabitsQuery,
} from "@/features/habits/hooks";
import {
  useIsOnboardingCompletedQuery,
  getIsOnboardingCompletedQueryKey,
} from "@/features/onboarding/hooks";
import { markOnboardingCompleted } from "@/features/onboarding/storage";
import { getLoadHabitsErrorMessage } from "@/utils/userFacingErrors";
import WelcomeScreen from "@/features/entry/screens/WelcomeScreen";
import { useQueryClient } from "@tanstack/react-query";
import { logger } from "@/services/logger";

export default function RootEntryScreen() {
  const { isBootstrapping, session, user } = useAuthSession();
  const eligibleHabitsQuery = useEligibleHabitsQuery();
  const upcomingHabitsQuery = useUpcomingActiveHabitsQuery();
  const onboardingCompletedQuery = useIsOnboardingCompletedQuery();
  const queryClient = useQueryClient();

  // One-time backfill: existing accounts with habits but no completion mark.
  // See sprint-3-tickets.md §0 decision (7).
  useEffect(() => {
    const hasHabits =
      (eligibleHabitsQuery.data ?? []).length > 0 ||
      (upcomingHabitsQuery.data ?? []).length > 0;
    const completed = onboardingCompletedQuery.data;

    if (
      user?.id &&
      eligibleHabitsQuery.isSuccess &&
      upcomingHabitsQuery.isSuccess &&
      onboardingCompletedQuery.isSuccess &&
      hasHabits &&
      completed === false
    ) {
      markOnboardingCompleted()
        .then(() => {
          logger.info("Backfilled onboarding completion for existing account");
          void queryClient.invalidateQueries({
            queryKey: getIsOnboardingCompletedQueryKey(user.id),
          });
        })
        .catch((error: unknown) => {
          logger.warn("Failed to backfill onboarding completion", { error });
        });
    }
  }, [
    user?.id,
    eligibleHabitsQuery.isSuccess,
    eligibleHabitsQuery.data,
    upcomingHabitsQuery.isSuccess,
    upcomingHabitsQuery.data,
    onboardingCompletedQuery.isSuccess,
    onboardingCompletedQuery.data,
    queryClient,
  ]);

  if (isBootstrapping) {
    return <LoadingState message="Checking your session..." />;
  }

  if (!session) {
    return <WelcomeScreen />;
  }

  if (
    eligibleHabitsQuery.isLoading ||
    upcomingHabitsQuery.isLoading ||
    onboardingCompletedQuery.isLoading
  ) {
    return <LoadingState message="Loading your habits..." />;
  }

  if (
    eligibleHabitsQuery.error ||
    upcomingHabitsQuery.error ||
    onboardingCompletedQuery.error
  ) {
    return <ErrorState message={getLoadHabitsErrorMessage()} />;
  }

  const hasHabits =
    (eligibleHabitsQuery.data ?? []).length > 0 ||
    (upcomingHabitsQuery.data ?? []).length > 0;

  if (hasHabits) {
    return <Redirect href="/(app)/(tabs)/today" />;
  }

  if (onboardingCompletedQuery.data === true) {
    // Edge case: completed onboarding but no active habits (archived all).
    // Existing post-onboarding habit creation flow handles this.
    return <Redirect href="/(app)/habits/create" />;
  }

  // No habits, no completion mark → into onboarding.
  return <Redirect href="/(onboarding)" />;
}
```

Notes:

- The decision order matters: hasHabits is checked **before** completion. A user with habits goes straight to Today regardless of the completion flag (since the flag may be unset for legacy accounts; the backfill effect will write it on next render, but the first render shouldn't loop them through onboarding).
- The backfill effect runs on every successful render of all three queries. The guard (`hasHabits && completed === false`) ensures it only fires for the specific case it's designed to handle. After it fires once and invalidates the query, the next render sees `completed === true` and the guard skips.
- The error state aggregates all three queries — any failure shows the existing `getLoadHabitsErrorMessage()` to the user. Onboarding-specific errors don't get a new error message; the user can't tell why the load failed and that's acceptable.

### Smoke test — `RootEntryScreen.test.tsx`

A unit-style test using `@testing-library/react-native` and Jest mocks for the three hooks. The test verifies the routing decision tree directly — it does not walk a real onboarding flow.

Cases (one `it` block each):

1. `isBootstrapping=true` → renders `LoadingState`. (Match by accessibility role or test id; existing `LoadingState` exposes `accessibilityRole="alert"` or similar — confirm in the component.)
2. No session → renders the **pre-auth** `WelcomeScreen` (assert by a unique string from that screen, e.g. `"Habit Builder MVP"`).
3. Session + any query loading → renders `LoadingState`.
4. Session + any query error → renders `ErrorState`.
5. Session + active habits exist + onboarding completed → redirect to `/(app)/(tabs)/today`. Assert by mocking `Redirect` to render its `href` as a child element and checking it.
6. Session + active habits exist + onboarding NOT completed → redirect to today (the backfill effect runs but doesn't change the synchronous redirect target on this render).
7. Session + no habits + onboarding completed → redirect to `/(app)/habits/create`.
8. Session + no habits + onboarding not completed → redirect to `/(onboarding)`.

Mock pattern (illustrative):

```ts
import { render } from "@testing-library/react-native";

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: jest.fn(),
}));
jest.mock("@/features/habits/hooks", () => ({
  useEligibleHabitsQuery: jest.fn(),
  useUpcomingActiveHabitsQuery: jest.fn(),
}));
jest.mock("@/features/onboarding/hooks", () => ({
  useIsOnboardingCompletedQuery: jest.fn(),
  getIsOnboardingCompletedQueryKey: () => ["onboarding", "completed"],
}));
jest.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) => <Text testID="redirect">{href}</Text>,
}));
// ...
```

Add a small helper in the test file to set up all four mocks per case to keep each `it` block readable.

### Acceptance criteria

- The three files modified or created.
- `npx tsc --noEmit` is clean.
- `npm test` passes — the new RootEntryScreen smoke test included.
- Manual end-to-end smoke:
  - Wipe local DB via `wipeLocalDb()`.
  - Sign in as a fresh test user (no habits, no completion mark).
  - App lands on the onboarding Welcome.
  - Tap Begin → Becoming. Type "a runner". Continue → Daily Action. Type "Run for 5 minutes."
  - Force-quit the app. Re-launch. Sign back in. The app lands on Daily Action with both fields preserved.
  - Manually call `markOnboardingCompleted()` from a debug REPL, then re-launch. The app lands on `/(app)/habits/create` (since habits are empty and onboarding is now marked complete).
  - Create a habit via that screen. Re-launch. The app lands on Today.
- For an existing test account (already has habits, no onboarding mark): launch the app. The backfill fires; check the logger output for "Backfilled onboarding completion." Re-launch. No backfill fires (already marked).

### References

- `src/features/entry/screens/RootEntryScreen.tsx` (the file you're modifying)
- `src/features/auth/hooks.ts` (useAuthSession returns `{ session, user, isBootstrapping }`)
- `src/features/habits/hooks.ts` (the queries that signal "has habits")
- `docs/sprint_tickets/sprint-plan.md` §S3 "Done means" (the bar this ticket meets)

### Out of scope

- The S4 path (writing `markOnboardingCompleted` from the onboarding flow's confirmation screen)
- React Query cache invalidation for the onboarding queries on completion (S4)
- Any changes to the existing pre-auth `WelcomeScreen`
- Any changes to existing screens behind the `/(app)` group

---

## Definition of S3 done

S3 is complete when **all four tickets** are merged into the `sprint-3` branch AND:

1. `npx tsc --noEmit` is clean on the integration branch.
2. `npm test` passes on the integration branch.
3. The end-to-end manual flow works:
   - Wipe local DB. Sign in fresh. Land on the onboarding Welcome (Screen 1).
   - Tap Begin. Land on Becoming. Enter a phrase. Continue.
   - Land on Daily Action. Field reflects the becoming phrase. Placeholder is keyword-aware. Enter a daily action.
   - Force-quit and re-launch. Resume on Daily Action with both fields intact.
4. The pre-auth `WelcomeScreen` and all existing `(app)` group screens render and behave exactly as they did at the close of S2 — no regressions.
5. The transitional `weekly_reviews` console noise documented in `PROJECT_BRAIN.md` §11 is unchanged. S3 doesn't fix it; S3 doesn't make it worse.

After S3 closes, S4 begins: shipping the rest of the onboarding flow (Shrink, Cue, Worst-day, Confirmation) and writing the first Focus habit on completion.

The `sprint-3` → `main` PR closes the sprint.

---

*End of S3 ticket package.*
