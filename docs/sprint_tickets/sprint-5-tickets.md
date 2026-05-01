# Sprint 5 — Dev Team Tickets

> **Status:** Ready for assignment.
> **Date:** April 30, 2026
> **Owner:** Tech Lead → Dev Team
> **Companion documents:** `sprint-plan.md` (S5 definition), `core-v1-requirements.md` (especially §5, §7.2, §8.4, §9, §13.4), `tech-handoff-core-v1.md` (architecture), `sprint-4-tickets.md` (the layer this builds on)

S5 redesigns Today around the Focus habit and ships the becoming-bridge's emotional payoff: the user lands on a calm screen where their identity, their cue, their tiny action, and a 30-day visual record of their practice all sit together. Two new presentational components (`Heatmap`, `IdentityStreakDisplay`), one new pure function (`extractIdentityNoun`), and one full screen refactor. Library gets a placeholder tab so the bottom nav matches the §5.1 layout — Library lights up properly in S12.

This sprint is roughly the size of S4. The risk is in two places: making sure the `TodayScreen` refactor doesn't regress the daily-logging mutation flow that's been working since S2, and writing an `identityNoun` extractor that fails gracefully on phrasings outside its lookup. The first is an integration risk (preserve the hooks, replace the chrome); the second is a coverage risk (the test suite is your safety net — write the misses first so the lookup gets the right shape).

---

## 0. Shared context — read before picking up a ticket

### Branching for this sprint

> **⚠️ The very first action of S5 is cutting the sprint branch off `main`.** Do not start any ticket below until this is done.

Per `sprint-plan.md` §8.5, every sprint runs on its own integration branch. Before any ticket below starts:

```bash
git checkout main && git pull
git checkout -b sprint-5
git push -u origin sprint-5
```

Every ticket below branches off `sprint-5` and PRs back into `sprint-5`, **not** `main`. The `Branch suggestion` line on each ticket is the ticket branch:

```bash
git checkout sprint-5 && git pull
git checkout -b s5/identity-noun-and-streak-display
# ... do the work ...
# Open PR: s5/identity-noun-and-streak-display → sprint-5
```

When all four tickets are merged into `sprint-5` and the Definition of S5 done is met, open one final PR: `sprint-5` → `main`.

### What's already done

S0–S4 closed before S5 starts. By the time your S5 code runs:

- The local DB is open, migrated, and the sole source of truth for habit data.
- `local_habits` rows carry `identity_phrase`, `cue`, `tiny_action`, `start_date`, `habit_state`, `status`, and the rest of the fields per `tech-handoff-core-v1.md` §4.1.
- `local_habit_logs` rows carry `log_date` (YYYY-MM-DD, device-local), `status` (`done` / `skipped` / `missed`), and notes.
- The forgiving streak rule with the §8.3 skipped-day removal rule is implemented in `features/today/progress.ts` and tested with 23 named cases.
- `features/today/hooks.ts` exports `useTodayHabits` and `useUpsertTodayHabitStatusMutation`. **Verify the exact field names returned by `useTodayHabits().habits[i]` before relying on them in S5-03** — at minimum it returns `id`, `name`, `formula`, `todayStatus`, `streak`, `consistencyRate`, `skipCount`, `isWeeklyReviewDue`, `startDate`. The Focus card needs `identityPhrase`, `cue`, `tinyAction` as well; if those aren't on the return type, extending the hook is part of S5-03.
- The 48-hour retro window is enforced inside `upsertHabitLog` via `RetroLogError`. Tapping a heatmap cell is **not yet wired** — that interaction lands in S6.
- The onboarding flow ships in S4 — a fresh user lands on `/(app)/(tabs)/today` with one Focus habit, `start_date = today`, no logs yet.
- The current `TodayScreen` (the screen this sprint refactors) is a working S0-era screen that still functions through the SQLite engine. The hooks and mutation wiring are stable. **You're refactoring chrome, not rebuilding plumbing.**

**Note on S4 D10 (post-finalize navigation).** The S4 spec said `useFinalizeOnboardingMutation` should `router.replace("/")` to bounce through `RootEntryScreen`. The shipped implementation does `router.replace("/(app)/(tabs)/today")` directly, with a comment in `hooks.ts` explaining the cache-race reasoning. The tech lead has ratified this as the correct approach — `invalidateQueries` does not await refetch on inactive observers, so bouncing through `/` would risk a brief redirect back to onboarding. S5 should not change this behavior.

### What we are NOT touching in S5

- **Heatmap interaction** (taps to open a log selector). The `Heatmap` component built in S5-02 accepts an optional `onCellPress` prop, but no consumer wires it. S6 builds the retro selector and connects the prop.
- **The 90-day variant on Habit Detail.** The `Heatmap` component supports it (and is tested for both variants), but only the 30-day variant is rendered on Today. S6 ships Habit Detail with `days={90}`.
- **Supporting habit cards.** Core v1 ships only one Focus habit until S13. Supporting cards land in S13.
- **Recovery flow / single-miss reframing copy** (§11). S7.
- **Trial validation read-only mode** (§16). S8.
- **Weekly review prompt re-enablement.** The current `isWeeklyReviewDue` field is dead per PROJECT_BRAIN §11 (the dropped server table is silently swallowed). The redesigned Focus card simply does not render this banner. When reviews migrates to local SQLite later, a new design lands then.
- **The "subtle indicator if the day is unlogged after a certain time" mentioned in §5.2.** Deferred to `sprint-5-followups.md` by product-lead decision — see (D9) below.
- Reminders, library card content (the tab is a placeholder), graduation, backlog, account, export.

### Architectural and product decisions for S5

These nine decisions shape the work. Most are obvious; (D6) and (D7) are the load-bearing ones. All are settled — pushback should go to the Tech Lead, not be resolved unilaterally inside a ticket.

**(D1) Single `Heatmap` component with a `days` prop, not two variants.** S5 ships the 30-day variant on Today; S6 ships the 90-day variant on Habit Detail. The component accepts `days: 30 | 90` and computes its grid layout internally. S6 becomes a one-line prop change rather than a second component build. Standard "design for the next consumer, build for today" call.

**(D2) `Heatmap` is display-only in S5 but accepts an optional `onCellPress` callback.** Cells are non-interactive when `onCellPress` is undefined, pressable when set. S6's retro selector just passes the prop. By stubbing the API now, we avoid redesigning the component twice.

**(D3) Drop the manual `Missed` button from Today.** Per requirements §7.2, Missed is auto-applied at end of day — the streak engine already treats unlogged-past days as Missed in its sequence math (§8.3). The `missed` log status remains in the data model and remains settable via retroactive logging from the heatmap (S6), but the live Today screen offers only Done and Skip. **This is a behavior change; existing tests that assert three buttons or that mutate `missed` from Today will need to be updated or removed.**

**(D4) Done = `PrimaryButton`, Skip = `SecondaryButton`, side-by-side.** Product-lead call: the friction asymmetry §7.2 calls for is delivered through visual hierarchy, not hidden gestures. Long-press is rejected on accessibility and discoverability grounds. Skip is muted, smaller, and to the right of Done.

**(D5) The becoming header is `"Become " + identityPhrase`, hardcoded.** "Become a runner", "Become someone who reads daily", "Become a calmer person" — the prefix reads naturally for all three onboarding patterns. No conditional logic. If the user's `identityPhrase` is empty/null (it shouldn't be after onboarding, but defensively), render nothing for the header rather than `"Become "` alone.

**(D6) `extractIdentityNoun` is a small lookup table + simple regex, not a stemmer.** Three patterns are matched in order:
- `"a [word] person"` → return `[word]` (e.g. "a calmer person" → "calmer")
- `"a [word]"` → return `[word]` (e.g. "a runner" → "runner")
- `"someone who [verb]"` → look `[verb]` up in `VERB_TO_AGENT_NOUN`; return the mapped agent noun or `null`

Pattern 1 runs before pattern 2 because pattern 2 would otherwise match "a calmer" and return "calmer" without the trailing "person" check. A regex stem rule like "strip -s, add -er" generates "runer" and "meditater" — embarrassing failures the user will see. The lookup table is honest about coverage. Anything outside the three patterns or outside the lookup returns `null`, and the streak display falls back to the generic "You've shown up [N] day(s) for this habit." copy. The risks register accepts this — we'll log misses in beta to grow the table for v1.1.

**(D7) First-day copy logic.** On the first day post-onboarding, the streak slot shows *"Your first day. Start small."* instead of the standard *"Day one. Start showing up."* Both strings live in the spec; product-lead chose to keep them distinct because they do different emotional jobs — the first is the consoling handoff from onboarding to product, the second is procedural for a streak counter at zero. The trigger:

```ts
const isFirstDay =
  habit.startDate === todayDateString()
  && habit.todayStatus === null
  && habit.streak === 0;
```

Once the user logs anything (Done or Skipped) on Day 1, `todayStatus` is no longer `null` and the standard streak copy takes over. After Day 1, the first-day copy never appears again — even if the user resets to streak 0 by missing two days, that's a streak-reset state with its own procedural copy ("Day one. Start showing up."), not a beginning-of-product-life state.

**Where it renders:** in place of the `IdentityStreakDisplay` block. Same vertical slot in the card. Logic lives in `TodayScreen` (a small inline conditional), not inside `IdentityStreakDisplay` — keeping the component pure of "is this Day 1?" knowledge.

**(D8) Library tab uses requirements §13.4 verbatim.** Copy: *"Your library will grow as habits become part of who you are. The first one usually takes 60–90 days. Stay with it."* No "coming soon" framing. The empty state today is the empty state tomorrow when S12 ships — no rewrite needed.

**(D9) The "subtle unlogged-day indicator" is deferred to followups.** Product-lead call: ship S5 without it; learn from beta whether testers miss it; add intentionally if needed. Documented here so a dev reading §5.2 doesn't try to bake it in.

### Field mapping reference

For DEV-S5-03, the Focus card maps cleanly from the habit row (verify exact field names against `useTodayHabits` return type):

| Source | Destination |
|---|---|
| `habit.identityPhrase` | Becoming header → `"Become " + identityPhrase` |
| `habit.cue` + `habit.tinyAction` | Cue+action subtitle → `"After [cue], [tinyAction]"` |
| `extractIdentityNoun(identityPhrase)` + `habit.streak` | Identity streak (or first-day copy if (D7) triggers) |
| `habit.todayStatus` | Selected button state (`done` highlights Done; `skipped` highlights Skip) |
| logs from `useHabitLogsForRange(habit.id, 30)` | Heatmap cells |

**Heatmap data sourcing.** `useTodayHabits` returns aggregates (streak, consistency) but not the raw 30-day log array the heatmap needs. Add a new hook `useHabitLogsForRange(habitId, days)` in `features/today/hooks.ts`, backed by a new repo function `listLogsForHabitInRange(habitId, fromDate, toDate)` in `repositories/habit_logs.ts`. This pair is reusable for Habit Detail's 90-day variant in S6 — the right home for it now is the today feature module since Today is its first consumer; S6 can import from there or refactor if needed.

### File / folder layout

By the end of S5:

```
src/components/
├── Heatmap.tsx                              # NEW in S5-02
├── IdentityStreakDisplay.tsx                # NEW in S5-01
└── ...                                      # existing components unchanged

src/components/__tests__/                    # NEW directory if not present
├── Heatmap.test.tsx                         # NEW in S5-02
└── IdentityStreakDisplay.test.tsx           # NEW in S5-01

src/features/library/                        # NEW directory in S5-03
├── screens/
│   └── LibraryScreen.tsx                    # NEW placeholder in S5-03
└── __tests__/
    └── LibraryScreen.test.tsx               # NEW in S5-03

src/features/onboarding/
├── identityNoun.ts                          # NEW in S5-01
└── __tests__/
    └── identityNoun.test.ts                 # NEW in S5-01

src/features/today/
├── hooks.ts                                 # MODIFIED in S5-03 — add useHabitLogsForRange + invalidation
├── screens/
│   └── TodayScreen.tsx                      # REWRITTEN in S5-03
├── progress.ts                              # unchanged
└── __tests__/
    └── TodayScreen.test.tsx                 # NEW in S5-03

src/lib/db/repositories/
└── habit_logs.ts                            # MODIFIED in S5-03 — add listLogsForHabitInRange

src/theme/
└── colors.ts                                # MODIFIED in S5-01 — heatmap tokens

app/(app)/(tabs)/
├── _layout.tsx                              # MODIFIED in S5-03 — Library tab inserted
├── library.tsx                              # NEW in S5-03 — single-line re-export
├── today.tsx                                # unchanged
└── settings.tsx                             # unchanged
```

### Conventions

Inherited from S2–S4, applied unchanged in S5.

- `now()` / `nowIso()` / `todayDateString()` from `@/utils/clock`, never `Date.now()` or `new Date()` directly.
- `toDeviceDateString()` / `addDays()` from `@/utils/dates`. Verify `addDays` exists; if not, add it as a one-liner alongside its first use and write a small test for it.
- Tests use `renderHook` and `render` from `@testing-library/react-native`. The `@testing-library/react-hooks` package is **not** installed.
- Pure functions get unit tests; presentational components get render tests; screens get screen tests asserting both rendered copy and mutation/navigation contracts.
- Imports order: external packages → `expo-*` → `@/components/*` → `@/features/*` → `@/lib/*` → `@/services/*` → `@/theme/*` → `@/utils/*` → relative imports.
- All user-facing strings are `selectable` `<Text>` so tooling can copy them.
- New theme tokens go in `@/theme/colors.ts` (not inlined hex).
- `TodayScreen`'s submit-lock pattern (`statusSubmitLockRef`) stays — the rewrite preserves it.

### Sequencing

```
DEV-S5-01  identityNoun + IdentityStreakDisplay + heatmap theme tokens     ← foundation
   ↓
DEV-S5-02  Heatmap component
   ↓
DEV-S5-03  TodayScreen rewrite + Library tab + first-day copy
   ↓
DEV-S5-04  Manual smoke + PROJECT_BRAIN update + sprint-5-followups.md
```

Strictly serial. Don't parallelize — S5-03 depends on the components from both S5-01 and S5-02.

---

## DEV-S5-01 — Foundations: theme tokens, identityNoun, IdentityStreakDisplay

**Estimate:** 0.5 day
**Depends on:** S4 closed (sprint-4 merged into main), `sprint-5` branch cut.
**Branch suggestion:** `s5/identity-noun-and-streak-display`

### Context

Three pieces of foundation that everything else in S5 depends on. None of them are visible to the user yet — they're integrated in S5-03. Sequencing them first means the higher-risk integration work in S5-03 has stable building blocks.

The three pieces are independent. Build them in the order below, but they can be reviewed independently if needed.

1. Theme tokens for the heatmap palette (consumed by `Heatmap` in S5-02).
2. `extractIdentityNoun` extractor (consumed by `IdentityStreakDisplay` and by `TodayScreen`).
3. `IdentityStreakDisplay` component (consumed by `TodayScreen`).

### Files to read first

- `src/theme/colors.ts` — current palette.
- `src/features/onboarding/types.ts` — to confirm the shape of `becomingPhrase`.
- `src/features/onboarding/dailyActionPlaceholder.ts` — pattern reference for keyword-aware string utilities.
- `src/features/onboarding/__tests__/dailyActionPlaceholder.test.ts` — pattern reference for keyword-table testing.
- `docs/core-v1-requirements.md` §8.4 (streak display copy) and §9.3 (heatmap colors).

### Files to modify

- `src/theme/colors.ts`

### Files to create

- `src/features/onboarding/identityNoun.ts`
- `src/features/onboarding/__tests__/identityNoun.test.ts`
- `src/components/IdentityStreakDisplay.tsx`
- `src/components/__tests__/IdentityStreakDisplay.test.tsx` (create the `__tests__` directory if it doesn't exist)

### Required exports / signatures

**`src/theme/colors.ts`** — add four heatmap tokens to the existing palette:

```ts
export const colors = {
  // ... existing tokens unchanged ...
  heatmapDone: "#3f7d4d",         // alias of success — green
  heatmapSkipped: "#e6d3a8",      // soft tan, harmonizes with the warm palette
  heatmapMissed: "#f0eadf",       // alias of surfaceMuted — barely-there background tint
  heatmapTodayOutline: "#ded4c6", // alias of border — used for the today cell's outline
};
```

The four tokens map to the four cell states from requirements §9.3. Reusing existing palette values (`success`, `surfaceMuted`, `border`) where they fit keeps the design system coherent. The new value is `heatmapSkipped` — pick a tan that doesn't clash with `accentSoft` (`#f6e1d4`, more pink-orange). The hex above is a starting point; you may adjust ±10 in any channel to match the palette's overall warmth in practice. Visual judgment call.

**`src/features/onboarding/identityNoun.ts`** — pure function with a small lookup:

```ts
const VERB_TO_AGENT_NOUN: Record<string, string> = {
  runs: "runner",
  reads: "reader",
  writes: "writer",
  meditates: "meditator",
  journals: "journaler",
  walks: "walker",
  cooks: "cook",
  exercises: "exerciser",
  swims: "swimmer",
  cycles: "cyclist",
  draws: "drawer",
  paints: "painter",
  stretches: "stretcher",
  practices: "practitioner",
  sleeps: "sleeper",
};

/**
 * Best-effort extraction of an identity noun from a "becoming" phrase.
 * Returns null when the phrase doesn't match any known pattern.
 *
 * Patterns tried in order:
 *   1. "a [word] person"   → [word]    e.g. "a calmer person" → "calmer"
 *   2. "a [word]"          → [word]    e.g. "a runner" → "runner"
 *   3. "someone who [verb]" looked up in VERB_TO_AGENT_NOUN
 *
 * Pattern (1) runs before (2) because (2) would otherwise match
 * "a calmer" and return "calmer" without the trailing "person" check.
 */
export function extractIdentityNoun(phrase: string): string | null {
  const trimmed = phrase.trim().toLowerCase();
  if (trimmed.length === 0) return null;

  const personMatch = trimmed.match(/^a\s+(\S+)\s+person$/);
  if (personMatch) return personMatch[1];

  const articleMatch = trimmed.match(/^a\s+(\S+)$/);
  if (articleMatch) return articleMatch[1];

  const someoneMatch = trimmed.match(/^someone\s+who\s+(\S+)/);
  if (someoneMatch) {
    const verb = someoneMatch[1];
    return VERB_TO_AGENT_NOUN[verb] ?? null;
  }

  return null;
}

// Exported for testing only — lets the test file enumerate the lookup
// without rebuilding it.
export { VERB_TO_AGENT_NOUN };
```

Notes for implementation:
- Match against the **lowercased trimmed** input. Onboarding accepts arbitrary case ("A Runner" vs "a runner"); we normalize before matching.
- The patterns are mutually exclusive given the input forms we expect. A user typing both "a [word]" and "someone who [verb]" doesn't happen.
- The "person" check is anchored at the end (`\s+person$`). "a person" without an adjective is a degenerate case — the regex requires `\S+\s+person`, so it won't match. That's fine; "a person" doesn't yield a useful noun.
- Diacritics, hyphens, and apostrophes inside words pass through `\S+` cleanly.
- This is **not** a stemmer. If the user types "someone who jogs", we return null. That's intentional — the fallback streak copy handles it gracefully.

**`src/components/IdentityStreakDisplay.tsx`** — pure presentational, no hooks, no side effects:

```tsx
import { StyleSheet, Text } from "react-native";

import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

type IdentityStreakDisplayProps = {
  streak: number;
  identityNoun: string | null;
};

export function IdentityStreakDisplay({
  streak,
  identityNoun,
}: IdentityStreakDisplayProps) {
  const copy = getStreakCopy(streak, identityNoun);
  return (
    <Text selectable style={styles.text}>
      {copy}
    </Text>
  );
}

function getStreakCopy(streak: number, identityNoun: string | null): string {
  if (streak === 0) {
    return "Day one. Start showing up.";
  }
  const dayLabel = streak === 1 ? "day" : "days";
  if (identityNoun) {
    return `You've been a ${identityNoun} for ${streak} ${dayLabel}.`;
  }
  return `You've shown up ${streak} ${dayLabel} for this habit.`;
}

const styles = StyleSheet.create({
  text: {
    color: colors.text,
    fontSize: typography.body,
    fontStyle: "italic",
    lineHeight: 24,
  },
});
```

Notes:
- The component takes `identityNoun: string | null` rather than `becomingPhrase: string`. Extraction happens in the parent (`TodayScreen`) so the component stays pure and the test surface is small.
- "day" / "days" pluralization handled inline; no i18n library yet.
- The component does **NOT** handle the first-day copy ("Your first day. Start small.") — per (D7), that's the parent's concern.

### Required tests

**`src/features/onboarding/__tests__/identityNoun.test.ts`** — at least 16 cases covering hits and misses across all three patterns plus case-insensitivity:

```ts
import { extractIdentityNoun } from "../identityNoun";

describe("extractIdentityNoun", () => {
  describe('pattern: "a [word]"', () => {
    it.each([
      ["a runner", "runner"],
      ["a writer", "writer"],
      ["a reader", "reader"],
      ["a meditator", "meditator"],
    ])("%s → %s", (input, expected) => {
      expect(extractIdentityNoun(input)).toBe(expected);
    });
  });

  describe('pattern: "a [word] person"', () => {
    it.each([
      ["a calmer person", "calmer"],
      ["a kinder person", "kinder"],
      // Multi-word adjective is a known coverage gap — pattern 1's regex
      // requires a single \S+ before "person".
      ["a more patient person", null],
    ])("%s → %s", (input, expected) => {
      expect(extractIdentityNoun(input)).toBe(expected);
    });
  });

  describe('pattern: "someone who [verb]"', () => {
    it.each([
      ["someone who runs", "runner"],
      ["someone who reads", "reader"],
      ["someone who writes", "writer"],
      ["someone who meditates", "meditator"],
      ["someone who walks", "walker"],
      ["someone who exercises", "exerciser"],
    ])("%s → %s", (input, expected) => {
      expect(extractIdentityNoun(input)).toBe(expected);
    });

    it("returns null for verbs not in the lookup table", () => {
      expect(extractIdentityNoun("someone who jogs")).toBeNull();
      expect(extractIdentityNoun("someone who codes")).toBeNull();
    });
  });

  describe("fallbacks", () => {
    it.each([
      ["", null],
      ["   ", null],
      ["I want to be healthy", null],
      ["happy", null],
      ["a", null],
    ])("%s → %s", (input, expected) => {
      expect(extractIdentityNoun(input)).toBe(expected);
    });
  });

  describe("case insensitivity", () => {
    it.each([
      ["A Runner", "runner"],
      ["SOMEONE WHO READS", "reader"],
      ["a Calmer Person", "calmer"],
    ])("%s → %s", (input, expected) => {
      expect(extractIdentityNoun(input)).toBe(expected);
    });
  });
});
```

That's 4 + 3 + 6 + 2 + 5 + 3 = 23 cases — well past the §S5 requirement of 15+. The "more patient person" case explicitly documents a known coverage gap; the test asserts `null` so the gap is intentional and visible.

**`src/components/__tests__/IdentityStreakDisplay.test.tsx`** — five cases covering the copy matrix:

```tsx
import { render, screen } from "@testing-library/react-native";

import { IdentityStreakDisplay } from "@/components/IdentityStreakDisplay";

describe("IdentityStreakDisplay", () => {
  it('renders "Day one. Start showing up." when streak is 0', () => {
    render(<IdentityStreakDisplay streak={0} identityNoun="runner" />);
    expect(screen.getByText("Day one. Start showing up.")).toBeTruthy();
  });

  it("renders identity-flavored copy with singular day for streak === 1", () => {
    render(<IdentityStreakDisplay streak={1} identityNoun="runner" />);
    expect(screen.getByText("You've been a runner for 1 day.")).toBeTruthy();
  });

  it("renders identity-flavored copy with plural days for streak >= 2", () => {
    render(<IdentityStreakDisplay streak={12} identityNoun="reader" />);
    expect(screen.getByText("You've been a reader for 12 days.")).toBeTruthy();
  });

  it("falls back to generic copy when identityNoun is null (singular)", () => {
    render(<IdentityStreakDisplay streak={1} identityNoun={null} />);
    expect(screen.getByText("You've shown up 1 day for this habit.")).toBeTruthy();
  });

  it("falls back to generic copy when identityNoun is null (plural)", () => {
    render(<IdentityStreakDisplay streak={12} identityNoun={null} />);
    expect(screen.getByText("You've shown up 12 days for this habit.")).toBeTruthy();
  });
});
```

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes — both new test suites pass; no existing tests broken.
- Manual: open the app on a simulator. The S5 changes are not yet visible (S5-03 wires them in), but the build runs and existing flows are unchanged.

### References

- `docs/core-v1-requirements.md` §8.4 (streak display copy variants), §9.3 (heatmap colors).
- `src/features/onboarding/dailyActionPlaceholder.ts` (closest pattern reference for keyword-aware string utilities).
- `src/theme/colors.ts` (palette to extend).

### Out of scope

- The `Heatmap` component itself — DEV-S5-02.
- Wiring `IdentityStreakDisplay` into `TodayScreen` — DEV-S5-03.
- First-day copy — DEV-S5-03.
- Adding to `VERB_TO_AGENT_NOUN` beyond the 15 entries listed. Misses logged in beta will inform v1.1 expansion.

---

## DEV-S5-02 — Heatmap component

**Estimate:** 0.75 day
**Depends on:** DEV-S5-01 merged into `sprint-5`.
**Branch suggestion:** `s5/heatmap-component`

### Context

Single component covering both the 30-day variant (consumed by Today in S5-03) and the 90-day variant (consumed by Habit Detail in S6 — built and tested now, not consumed yet). Display-only in S5; accepts an optional `onCellPress` for S6's wire-up.

Two design choices embedded in this ticket:

**Grid shape.** 30 days laid out as 5 rows × 6 columns; 90 days as 9 rows × 10 columns. The grid is **not calendar-aligned** — we don't try to map to weeks/months. Each cell represents one day in chronological order, today in the bottom-right. This is a deliberate simplification. Calendar alignment (GitHub-style 7-row × N-column with day-of-week rows) is more familiar but adds layout complexity (leading empty cells for the start of the visible window) and is harder to read at the 30-day scale where the user just wants a visual sense of the past month. We can revisit calendar alignment in v1.1 if testers ask for it.

**Cell sizing.** Cells are square with a small gap. The 30-day variant uses 36px cells; the 90-day variant uses 28px cells. This isn't elegant but keeps both variants readable in their respective containers (Today's card is ~320–360px wide; Habit Detail's is similar but the 90-cell grid needs smaller cells to fit). Future: switch to calculating from container width.

### Files to read first

- `src/theme/colors.ts` — confirm S5-01 added the four heatmap tokens.
- `src/lib/db/repositories/habit_logs.ts` — what query helpers exist. **Do NOT add a new query helper in this ticket** — the component takes logs as a prop. The query lands in S5-03.
- `src/features/today/progress.ts` — reference for how the codebase reasons about device-local YYYY-MM-DD dates.
- `src/utils/clock.ts` and `src/utils/dates.ts` — date utilities the component will use. **Confirm `addDays` exists.** If not, add it as a one-liner with a small test (this counts as part of S5-02).
- `docs/core-v1-requirements.md` §9 — heatmap purpose, view, colors, interaction.

### Files to create

- `src/components/Heatmap.tsx`
- `src/components/__tests__/Heatmap.test.tsx`

### Files to modify (only if `addDays` is missing)

- `src/utils/dates.ts`
- `src/utils/__tests__/dates.test.ts` (or create if not present)

### Required exports / signatures

**`src/components/Heatmap.tsx`**

```tsx
import { Pressable, StyleSheet, View } from "react-native";

import { colors } from "@/theme/colors";
import { todayDateString } from "@/utils/clock";
import { addDays, toDeviceDateString } from "@/utils/dates";

import type { HabitLogStatus } from "@/features/habits/types";

export type HeatmapLog = {
  log_date: string; // YYYY-MM-DD device-local
  status: HabitLogStatus; // "done" | "skipped" | "missed"
};

type HeatmapProps = {
  logs: HeatmapLog[];
  days: 30 | 90;
  onCellPress?: (date: string) => void;
};

const GRID_CONFIG: Record<30 | 90, { rows: number; cols: number; cellSize: number }> = {
  30: { rows: 5, cols: 6, cellSize: 36 },
  90: { rows: 9, cols: 10, cellSize: 28 },
};

const CELL_GAP = 4;

export function Heatmap({ logs, days, onCellPress }: HeatmapProps) {
  const { rows, cols, cellSize } = GRID_CONFIG[days];
  const today = todayDateString();

  // Build a date → status map for O(1) lookup.
  const statusByDate = new Map<string, HabitLogStatus>();
  for (const log of logs) {
    statusByDate.set(log.log_date, log.status);
  }

  // Generate the date sequence: oldest first, today last.
  // Today goes in the bottom-right; date[0] goes in the top-left.
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(toDeviceDateString(addDays(new Date(), -i)));
  }

  return (
    <View style={[styles.grid, { gap: CELL_GAP }]}>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <View key={rowIdx} style={[styles.row, { gap: CELL_GAP }]}>
          {Array.from({ length: cols }).map((__, colIdx) => {
            const cellIdx = rowIdx * cols + colIdx;
            if (cellIdx >= dates.length) {
              // Spacer cell when rows*cols > days (none of the current configs trigger this, but safe).
              return <View key={colIdx} style={{ width: cellSize, height: cellSize }} />;
            }
            const date = dates[cellIdx];
            const status = statusByDate.get(date) ?? null;
            const isToday = date === today;

            const cellStyle = [
              styles.cell,
              { width: cellSize, height: cellSize, backgroundColor: getCellColor(status) },
              isToday && status === null ? styles.todayOutline : null,
            ];

            if (onCellPress) {
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={getCellAccessibilityLabel(date, status, isToday)}
                  key={colIdx}
                  onPress={() => onCellPress(date)}
                  style={cellStyle}
                />
              );
            }
            return (
              <View
                accessibilityLabel={getCellAccessibilityLabel(date, status, isToday)}
                key={colIdx}
                style={cellStyle}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

function getCellColor(status: HabitLogStatus | null): string {
  if (status === "done") return colors.heatmapDone;
  if (status === "skipped") return colors.heatmapSkipped;
  // "missed" and null (no log on a past day) both render as the missed tint.
  return colors.heatmapMissed;
}

function getCellAccessibilityLabel(
  date: string,
  status: HabitLogStatus | null,
  isToday: boolean,
): string {
  const datePart = isToday ? "Today" : date;
  if (status === null) return `${datePart}, not logged`;
  return `${datePart}, ${status}`;
}

const styles = StyleSheet.create({
  cell: {
    borderRadius: 4,
  },
  grid: {
    alignSelf: "center",
  },
  row: {
    flexDirection: "row",
  },
  todayOutline: {
    borderColor: colors.heatmapTodayOutline,
    borderWidth: 2,
  },
});
```

Notes:
- Today's outline only renders when the day is unlogged (`status === null`). A logged today is colored by its status; the outline would compete visually.
- Accessibility: every cell carries a label with date + status. Screen readers can navigate the grid.
- The `Pressable` vs `View` branch is the only behavioral difference between display-mode (S5) and interactive-mode (S6). When `onCellPress` is undefined, cells are non-interactive and don't trigger any feedback ripple.
- If `addDays` is missing from `@/utils/dates`, add it: `export function addDays(date: Date, days: number): Date { return new Date(date.getTime() + days * 86_400_000); }` — and add a test that covers crossing a DST boundary (the simple `* 86_400_000` math is timezone-stable for our YYYY-MM-DD use case but worth pinning).

### Required tests

**`src/components/__tests__/Heatmap.test.tsx`**

```tsx
import { fireEvent, render, screen } from "@testing-library/react-native";

import { Heatmap } from "@/components/Heatmap";
import { setNowForTesting, resetClockForTesting } from "@/utils/clock";

describe("Heatmap", () => {
  beforeEach(() => {
    setNowForTesting(new Date("2026-04-30T10:00:00.000Z"));
  });

  afterEach(() => {
    resetClockForTesting();
  });

  it("renders 30 cells when days=30", () => {
    const { root } = render(<Heatmap logs={[]} days={30} />);
    const cells = root.findAllByProps({ accessibilityLabel: expect.any(String) });
    expect(cells).toHaveLength(30);
  });

  it("renders 90 cells when days=90", () => {
    const { root } = render(<Heatmap logs={[]} days={90} />);
    const cells = root.findAllByProps({ accessibilityLabel: expect.any(String) });
    expect(cells).toHaveLength(90);
  });

  it("colors a Done log green", () => {
    render(<Heatmap logs={[{ log_date: "2026-04-29", status: "done" }]} days={30} />);
    const cell = screen.getByLabelText("2026-04-29, done");
    expect(cell.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: "#3f7d4d" }),
      ]),
    );
  });

  it("outlines today when unlogged", () => {
    render(<Heatmap logs={[]} days={30} />);
    const todayCell = screen.getByLabelText("Today, not logged");
    expect(todayCell.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ borderWidth: 2 }),
      ]),
    );
  });

  it("does not outline today when it has a log", () => {
    render(<Heatmap logs={[{ log_date: "2026-04-30", status: "done" }]} days={30} />);
    const todayCell = screen.getByLabelText("Today, done");
    const styles = (todayCell.props.style as Array<object>).flat().filter(Boolean);
    expect(styles.some((s: { borderWidth?: number }) => s.borderWidth === 2)).toBe(false);
  });

  it("calls onCellPress with the date when a cell is tapped", () => {
    const onCellPress = jest.fn();
    render(
      <Heatmap
        logs={[{ log_date: "2026-04-29", status: "done" }]}
        days={30}
        onCellPress={onCellPress}
      />,
    );
    fireEvent.press(screen.getByLabelText("2026-04-29, done"));
    expect(onCellPress).toHaveBeenCalledWith("2026-04-29");
  });

  it("does not register press handlers when onCellPress is omitted", () => {
    const { root } = render(
      <Heatmap logs={[{ log_date: "2026-04-29", status: "done" }]} days={30} />,
    );
    const buttons = root.findAllByProps({ accessibilityRole: "button" });
    expect(buttons).toHaveLength(0);
  });
});
```

The cell-finding via `accessibilityLabel` is the contract — that's what makes the test resilient to layout changes. The color-hex assertion is a coupling to the theme tokens, but that coupling is the point: if someone changes `heatmapDone` without updating the spec, the test catches it.

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes — all 7 new Heatmap tests, plus everything from S5-01, plus everything pre-existing.
- Manual: not yet visible in the app (no consumer wired). The build runs.

### References

- `docs/core-v1-requirements.md` §9.
- `src/theme/colors.ts` (after S5-01).
- `src/utils/clock.ts`, `src/utils/dates.ts`.
- `src/components/__tests__/IdentityStreakDisplay.test.tsx` (pattern reference for `@testing-library/react-native` render/screen tests).

### Out of scope

- The retro-log selector that opens on cell tap — S6.
- Calendar-aligned grids (week-rows × month-columns) — design choice deferred.
- Dynamic cell sizing based on container width — v1.1 if needed.
- Color-blind-safe palette tuning — track separately if testers raise it.
- Adding a `listLogsForHabitInRange` repo function — that lands in S5-03.

---

## DEV-S5-03 — TodayScreen rewrite, Library tab, first-day copy

**Estimate:** 1.0 day
**Depends on:** DEV-S5-02 merged into `sprint-5`.
**Branch suggestion:** `s5/today-redesign-and-library`

### Context

The integration ticket. `TodayScreen` gets a full visual rewrite while preserving the data hooks and mutation wiring that have been working since S2. Library tab gets a placeholder. First-day copy lights up on Day 1.

The risk concentration here is preserving the daily-logging flow. The current screen has working hooks, error states, loading states, and a submit lock. Rewriting the chrome must not regress any of those. The way to manage the risk: read `TodayScreen.tsx` carefully before drafting, identify the imperative pieces (hooks, refs, handlers), keep them line-for-line, and replace only the JSX and styles.

### Files to read first

- `src/features/today/screens/TodayScreen.tsx` — the file you're rewriting. Read it carefully before drafting.
- `src/features/today/hooks.ts` — confirm the shape of `useTodayHabits()`'s return value, especially whether it includes `identityPhrase`, `cue`, `tinyAction` on each habit. **If they're missing, extending the hook is part of this ticket.**
- `src/features/habits/types.ts` — `Habit` row shape.
- `src/lib/db/repositories/habit_logs.ts` — for adding `listLogsForHabitInRange`.
- `src/components/cards/HabitCard.tsx` — the existing card component. Not extended in S5; see (D-local-1) below.
- `src/components/buttons/PrimaryButton.tsx` and `SecondaryButton.tsx` — for the Done/Skip row.
- `src/components/feedback/EmptyState.tsx` — used by the no-habits state.
- `app/(app)/(tabs)/_layout.tsx` — file you'll modify to insert the Library tab.
- `docs/core-v1-requirements.md` §5 (Today screen) and §13.4 (Library empty state).

### Files to create

- `src/features/library/screens/LibraryScreen.tsx`
- `src/features/library/__tests__/LibraryScreen.test.tsx`
- `app/(app)/(tabs)/library.tsx`
- `src/features/today/__tests__/TodayScreen.test.tsx` (new file; the screen has no existing tests)

### Files to modify

- `src/features/today/screens/TodayScreen.tsx` — full rewrite of the JSX and styles; preserve hooks and handlers
- `src/features/today/hooks.ts` — add `useHabitLogsForRange`, add range-key invalidation in the existing mutation hook
- `src/lib/db/repositories/habit_logs.ts` — add `listLogsForHabitInRange`
- `app/(app)/(tabs)/_layout.tsx` — insert Library tab between Today and Settings

### Local decisions for this ticket

**(D-local-1) The Focus card is bespoke, not built on `HabitCard`.** `HabitCard` was designed for the old flat-list layout where every habit looked the same. The Focus card has a distinct shape (becoming header, cue+action subtitle, identity streak, button row, heatmap below) that doesn't share enough structure with `HabitCard` to justify shared abstraction. Build a new `FocusCard` component inline in `TodayScreen.tsx`, or extract it to `src/components/cards/FocusCard.tsx` if the inline version grows past ~80 lines. When Supporting cards land in S13 they'll use a different smaller component — `HabitCard` may stay as-is or get retired then.

**(D-local-2) The Heatmap reads logs through a new hook + repo function.** Add `useHabitLogsForRange(habitId, days)` in `src/features/today/hooks.ts` and `listLogsForHabitInRange(habitId, fromDate, toDate)` in `src/lib/db/repositories/habit_logs.ts`. Both are reusable for S6's 90-day variant on Habit Detail.

**(D-local-3) "Today" header is the date, subtle.** Replace the current bold "Today" title with a small, muted display: e.g. *"Wednesday, April 30"* in `colors.textMuted` at `typography.body`. Format with `toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })`. Requirements §5.1 says "subtle" — keep it small.

**(D-local-4) Mutation hook gains range-query invalidation.** When the user logs Done/Skip, `useUpsertTodayHabitStatusMutation` must also invalidate the range query so the heatmap re-renders. Find the existing mutation in `src/features/today/hooks.ts` and add invalidation of `getHabitLogsRangeQueryKey(habitId, ...)` alongside whatever it currently invalidates. The exact key shape is up to you; the test for "tap Done turns the heatmap cell green within one second" is what locks it in.

### Required exports / signatures

**`src/lib/db/repositories/habit_logs.ts`** — add:

```ts
export async function listLogsForHabitInRange(
  habitId: string,
  fromDate: string,
  toDate: string,
): Promise<HabitLog[]> {
  const db = getDb();
  const rows = await db.getAllAsync<HabitLog>(
    `SELECT * FROM local_habit_logs
     WHERE habit_id = ? AND log_date BETWEEN ? AND ?
     ORDER BY log_date ASC`,
    [habitId, fromDate, toDate],
  );
  return rows;
}
```

**`src/features/today/hooks.ts`** — add the range query hook + key, and wire invalidation into the existing mutation:

```ts
export function getHabitLogsRangeQueryKey(
  habitId: string,
  fromDate: string,
  toDate: string,
) {
  return ["habit_logs", "range", habitId, fromDate, toDate];
}

export function useHabitLogsForRange(habitId: string | undefined, days: number) {
  const today = todayDateString();
  const fromDate = toDeviceDateString(addDays(new Date(), -(days - 1)));
  return useQuery({
    queryKey: getHabitLogsRangeQueryKey(habitId ?? "none", fromDate, today),
    queryFn: () => listLogsForHabitInRange(habitId!, fromDate, today),
    enabled: Boolean(habitId),
    staleTime: 30_000,
  });
}
```

**`src/features/today/screens/TodayScreen.tsx`** — full rewrite. Key shape (illustrative — implementation details up to the dev as long as the tests pass):

```tsx
export default function TodayScreen() {
  const { error, habits, isLoading } = useTodayHabits();
  const upsertTodayHabitStatusMutation = useUpsertTodayHabitStatusMutation();
  const statusSubmitLockRef = useRef(false);

  // ... preserve existing handleStatusPress logic (submit lock, mutateAsync, finally-unlock) ...

  if (isLoading) return <LoadingState message="Loading your Today view..." />;
  if (error) return <ErrorState message={getLoadHabitsErrorMessage()} />;

  const focusHabit = habits.find((h) => h.habitState === "focus") ?? null;

  if (!focusHabit) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <SubtleDateHeader />
        <EmptyState
          title="No active habits yet"
          body="Start with one Focus habit. Small, repeatable, sized to your worst day."
        />
        <PrimaryButton
          label="Create your first habit"
          onPress={() => router.push("/(app)/habits/create")}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SubtleDateHeader />
      <FocusCard
        habit={focusHabit}
        onLog={handleStatusPress}
        mutation={upsertTodayHabitStatusMutation}
      />
    </ScrollView>
  );
}

function FocusCard({ habit, onLog, mutation }) {
  const identityNoun = extractIdentityNoun(habit.identityPhrase ?? "");
  const isFirstDay =
    habit.startDate === todayDateString()
    && habit.todayStatus === null
    && habit.streak === 0;

  const logsQuery = useHabitLogsForRange(habit.id, 30);

  return (
    <View style={styles.card}>
      {habit.identityPhrase ? (
        <Text selectable style={styles.becomingHeader}>
          Become {habit.identityPhrase}
        </Text>
      ) : null}
      <Text selectable style={styles.cueAction}>
        After {habit.cue}, {habit.tinyAction}
      </Text>

      {isFirstDay ? (
        <Text selectable style={styles.firstDay}>
          Your first day. Start small.
        </Text>
      ) : (
        <IdentityStreakDisplay streak={habit.streak} identityNoun={identityNoun} />
      )}

      <View style={styles.actionsRow}>
        <PrimaryButton
          label={habit.todayStatus === "done" ? "Done ✓" : "Done"}
          disabled={mutation.isPending}
          onPress={() => onLog(habit.id, "done")}
        />
        <SecondaryButton
          label={habit.todayStatus === "skipped" ? "Skipped ✓" : "Skip"}
          disabled={mutation.isPending}
          onPress={() => onLog(habit.id, "skipped")}
        />
      </View>

      {logsQuery.data ? (
        <Heatmap logs={logsQuery.data} days={30} />
      ) : null}
    </View>
  );
}
```

Notes:
- Preserve the existing `handleStatusPress` body (submit lock, mutateAsync, finally-unlock). Just call it with `'done'` or `'skipped'` — never `'missed'` from this screen.
- The selected-state visual on the buttons — the `Done ✓` / `Skipped ✓` label suffix is a simple indicator. If the buttons support a `selected` prop already, prefer that.
- Verify whether `useTodayHabits` returns `null` or `undefined` for unlogged `todayStatus` — the (D7) check uses `=== null`. If the hook returns `undefined`, normalize at the hook level (preferred) rather than checking both in the screen.
- Don't render the becoming header if `identityPhrase` is empty/null — defensively rendering `"Become "` looks broken.
- `FocusCard` is local to `TodayScreen.tsx` for now. If it grows past ~80 lines, extract to `src/components/cards/FocusCard.tsx` with the same props.

**`src/features/library/screens/LibraryScreen.tsx`** — placeholder, requirements §13.4 verbatim:

```tsx
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const EMPTY_COPY =
  "Your library will grow as habits become part of who you are. " +
  "The first one usually takes 60–90 days. Stay with it.";

export default function LibraryScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.empty}>
        <Text selectable style={styles.title}>
          Library
        </Text>
        <Text selectable style={styles.body}>
          {EMPTY_COPY}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  empty: {
    gap: spacing.lg,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
  },
});
```

**`app/(app)/(tabs)/library.tsx`** — single-line re-export:

```tsx
export { default } from "@/features/library/screens/LibraryScreen";
```

**`app/(app)/(tabs)/_layout.tsx`** — insert Library between Today and Settings:

```tsx
<Tabs ...>
  <Tabs.Screen name="today" options={{ title: "Today" }} />
  <Tabs.Screen name="library" options={{ title: "Library" }} />
  <Tabs.Screen name="settings" options={{ title: "Settings" }} />
</Tabs>
```

### Required tests

**`src/features/library/__tests__/LibraryScreen.test.tsx`** — minimal:

```tsx
import { render, screen } from "@testing-library/react-native";

import LibraryScreen from "@/features/library/screens/LibraryScreen";

describe("LibraryScreen", () => {
  it("renders the §13.4 empty-state copy", () => {
    render(<LibraryScreen />);
    expect(
      screen.getByText(/Your library will grow as habits become part of who you are/),
    ).toBeTruthy();
  });
});
```

**`src/features/today/__tests__/TodayScreen.test.tsx`** — seven cases pinning the Focus card contract:

```tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import TodayScreen from "@/features/today/screens/TodayScreen";
import { setNowForTesting, resetClockForTesting } from "@/utils/clock";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock("@/features/today/hooks", () => ({
  useTodayHabits: jest.fn(),
  useUpsertTodayHabitStatusMutation: jest.fn(),
  useHabitLogsForRange: jest.fn(),
}));

const {
  useTodayHabits,
  useUpsertTodayHabitStatusMutation,
  useHabitLogsForRange,
} = jest.requireMock("@/features/today/hooks") as {
  useTodayHabits: jest.Mock;
  useUpsertTodayHabitStatusMutation: jest.Mock;
  useHabitLogsForRange: jest.Mock;
};

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function makeHabit(overrides = {}) {
  return {
    id: "habit-1",
    name: "Run",
    identityPhrase: "a runner",
    cue: "morning coffee",
    tinyAction: "run for 2 minutes",
    habitState: "focus",
    startDate: "2026-04-01",
    streak: 12,
    todayStatus: null,
    ...overrides,
  };
}

describe("TodayScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNowForTesting(new Date("2026-04-30T10:00:00.000Z"));
    useUpsertTodayHabitStatusMutation.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      isPending: false,
      error: null,
    });
    useHabitLogsForRange.mockReturnValue({ data: [] });
  });

  afterEach(() => {
    resetClockForTesting();
  });

  it("renders the no-habits empty state with CTA when no Focus habit exists", () => {
    useTodayHabits.mockReturnValue({
      habits: [],
      upcomingHabits: [],
      isLoading: false,
      error: null,
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("No active habits yet")).toBeTruthy();
    expect(screen.getByText("Create your first habit")).toBeTruthy();
  });

  it("renders the Focus card with becoming header and identity streak", () => {
    useTodayHabits.mockReturnValue({
      habits: [makeHabit()],
      upcomingHabits: [],
      isLoading: false,
      error: null,
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("Become a runner")).toBeTruthy();
    expect(screen.getByText("After morning coffee, run for 2 minutes")).toBeTruthy();
    expect(screen.getByText("You've been a runner for 12 days.")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("Skip")).toBeTruthy();
  });

  it("renders the first-day copy when start_date is today, todayStatus is null, and streak is 0", () => {
    useTodayHabits.mockReturnValue({
      habits: [makeHabit({ startDate: "2026-04-30", streak: 0, todayStatus: null })],
      upcomingHabits: [],
      isLoading: false,
      error: null,
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("Your first day. Start small.")).toBeTruthy();
    expect(screen.queryByText("Day one. Start showing up.")).toBeNull();
  });

  it("renders standard streak copy after first log on Day 1", () => {
    useTodayHabits.mockReturnValue({
      habits: [makeHabit({ startDate: "2026-04-30", streak: 1, todayStatus: "done" })],
      upcomingHabits: [],
      isLoading: false,
      error: null,
    });
    renderWithClient(<TodayScreen />);
    expect(screen.queryByText("Your first day. Start small.")).toBeNull();
    expect(screen.getByText("You've been a runner for 1 day.")).toBeTruthy();
  });

  it("calls the mutation with status='done' when Done is tapped", () => {
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    useUpsertTodayHabitStatusMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    });
    useTodayHabits.mockReturnValue({
      habits: [makeHabit()],
      upcomingHabits: [],
      isLoading: false,
      error: null,
    });
    renderWithClient(<TodayScreen />);
    fireEvent.press(screen.getByText("Done"));
    expect(mutateAsync).toHaveBeenCalledWith({ habitId: "habit-1", status: "done" });
  });

  it("calls the mutation with status='skipped' when Skip is tapped", () => {
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    useUpsertTodayHabitStatusMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    });
    useTodayHabits.mockReturnValue({
      habits: [makeHabit()],
      upcomingHabits: [],
      isLoading: false,
      error: null,
    });
    renderWithClient(<TodayScreen />);
    fireEvent.press(screen.getByText("Skip"));
    expect(mutateAsync).toHaveBeenCalledWith({ habitId: "habit-1", status: "skipped" });
  });

  it("does not render a Missed button on Today", () => {
    useTodayHabits.mockReturnValue({
      habits: [makeHabit()],
      upcomingHabits: [],
      isLoading: false,
      error: null,
    });
    renderWithClient(<TodayScreen />);
    expect(screen.queryByText("Missed")).toBeNull();
  });
});
```

The last test (no Missed button) explicitly pins decision (D3) — if a future refactor accidentally adds Missed back, that test breaks immediately.

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes.
- Manual end-to-end: complete onboarding fresh on a simulator. After "Start showing up", land on Today. The redesigned Focus card shows: subtle date header at top; "Become a runner" header; "After morning coffee, run for 2 minutes" subtitle; "Your first day. Start small." copy in the streak slot; Done | Skip buttons; 30-day heatmap with today outlined. Tap Done — the heatmap's today cell turns green within one second; the streak line replaces the first-day copy with "You've been a runner for 1 day." The Library tab is in the bottom nav between Today and Settings; tapping it shows the §13.4 empty-state copy.
- Manual: tap Skip on Day 1 instead of Done. Today's heatmap cell turns soft tan. Streak shows "Day one. Start showing up." (because skipping doesn't increment streak; we're past first-day state because `todayStatus` is no longer null).
- Manual: with no habit (manually clear via dev tools or fresh sign-in pre-onboarding-completion), the no-habits empty state shows with the CTA.
- No regressions: Habit Detail, Edit Habit, Create Habit, Reviews still render. Existing flows still work.

### References

- `docs/core-v1-requirements.md` §5 (Today screen), §7.2 (logging), §8.4 (streak display), §13.4 (Library empty state).
- `src/features/today/screens/TodayScreen.tsx` (the file you're rewriting — read it first).
- `src/features/today/hooks.ts` (existing hooks — verify shape; extend if needed).
- `src/features/onboarding/identityNoun.ts` (S5-01).
- `src/components/IdentityStreakDisplay.tsx` (S5-01).
- `src/components/Heatmap.tsx` (S5-02).

### Out of scope

- Long-press gesture on Skip — rejected per (D4).
- Subtle unlogged-day indicator — deferred per (D9). If you find a clean way to add it during the rewrite that's clearly correct, surface it in the PR; otherwise leave for followups.
- Heatmap cell taps — S6.
- Supporting habit cards — S13.
- Library content — S12.
- Replacing or restoring the weekly review banner — out of scope until reviews migrates to local SQLite.

---

## DEV-S5-04 — Manual smoke, PROJECT_BRAIN update, S5 followups doc

**Estimate:** 0.25 day
**Depends on:** DEV-S5-03 merged into `sprint-5`.
**Branch suggestion:** `s5/smoke-and-docs`

### Context

Closes the sprint. Manual end-to-end smoke checklist on a real simulator or device, PROJECT_BRAIN §11 update reflecting S5 closure, and a `sprint-5-followups.md` for the deferred items (P2 unlogged-day indicator, anything else surfaced during smoke).

### Files to modify

- `docs/PROJECT_BRAIN.md` — update §11 with S5 closure note.

### Files to create

- `docs/sprint_tickets/sprint-5-followups.md`

### Manual smoke checklist

Run on a real simulator or device. Mark each item ✅ before merging `sprint-5` into `main`.

1. **Fresh user happy path.** Wipe local DB. Sign in. Complete onboarding to a Focus habit "a runner" / "After morning coffee, run for 2 minutes". On "Start showing up", land on Today. Verify: subtle date header at top; "Become a runner" header; "After morning coffee, run for 2 minutes" subtitle; "Your first day. Start small." copy in the streak slot; Done | Skip buttons; 30-day heatmap below with today outlined; bottom nav has Today | Library | Settings tabs.
2. **First Done log.** Tap Done. Within one second: heatmap's today cell turns green (outline gone); first-day copy is replaced with "You've been a runner for 1 day." Done button shows selected state.
3. **Skip on Day 1.** Wipe and redo onboarding. On Today, tap Skip first instead of Done. Heatmap cell turns soft tan; streak slot shows "Day one. Start showing up." (NOT first-day copy — `todayStatus` isn't null anymore). Skip button shows selected state.
4. **Library tab placeholder.** Tap Library. Lands on a screen with the §13.4 empty-state copy: "Your library will grow as habits become part of who you are. The first one usually takes 60–90 days. Stay with it." Tap Today — return to Today with state intact.
5. **Identity-noun fallback.** Wipe and redo onboarding with becoming phrase "I want to be healthy" (no recognizable pattern). Confirm streak slot shows the generic fallback "You've shown up [N] day(s) for this habit." after first log. (For "I want to be healthy", `extractIdentityNoun` returns null, so fallback is correct.)
6. **No-habits empty state.** Sign out, sign back in as a new test account but skip past onboarding by manually setting `onboarding.completed_at` via dev REPL with no habits created. Today renders the empty state with "Create your first habit" CTA. Tap CTA → routes to `/(app)/habits/create`.
7. **No regressions.** Visit Habit Detail, Edit Habit, Reviews — all render and function as they did at end of S4. The pre-auth Welcome screen, sign-in, sign-up unchanged.
8. **Tab persistence.** From Today, tap Library, then Settings, then back to Today. State is preserved on each (the Today screen doesn't re-fetch on every visit unless data invalidated).

### PROJECT_BRAIN update

Update `docs/PROJECT_BRAIN.md` §11 with a 4–6 line note covering:

- S5 moved from "Next" to "Done."
- New components: `Heatmap`, `IdentityStreakDisplay`, `extractIdentityNoun`.
- TodayScreen redesigned around the Focus card; first-day copy lights up on Day 1.
- Library tab placeholder added; bottom nav now Today | Library | Settings.
- "Up next" line points at S6 (Habit Detail + 48-hour retro logging).
- Note that `useHabitLogsForRange` hook and `listLogsForHabitInRange` repo function were added — both reusable for S6's 90-day heatmap on Habit Detail.

Confirm whether the transitional `weekly_reviews` console-noise note in §11 is still accurate (it should be — S5 didn't touch reviews). If §11 referenced the weekly review banner on Today, remove that reference; keep the underlying console-noise note.

### sprint-5-followups.md

Create `docs/sprint_tickets/sprint-5-followups.md` with at minimum:

- **F1 — Subtle unlogged-day indicator (P2 deferral).** Per S5 §0 (D9), the §5.2 "subtle indicator if the day is unlogged after a certain time" was deferred from S5 to learn from beta whether testers miss it. If beta surfaces a need, design a calm indicator (small dot, muted text, or subtle animation) and a trigger time (e.g., after 6pm device-local). Ship as a small ticket.
- **F2 — identityNoun coverage gaps.** Log misses from beta and grow the `VERB_TO_AGENT_NOUN` table for v1.1. Multi-word adjectives in pattern 1 ("a more patient person") are a known gap.
- Anything surfaced during the manual smoke that isn't a blocker.

### Acceptance criteria

- All 8 manual smoke items checked ✅. Paste the checklist (or a brief confirmation per item) into the `sprint-5 → main` PR description.
- `docs/PROJECT_BRAIN.md` §11 reflects S5 closure.
- `docs/sprint_tickets/sprint-5-followups.md` exists with at least F1 and F2.

### References

- The four S5 tickets above.
- `sprint-4-tickets.md` DEV-S4-04 (smoke-checklist pattern reference).

### Out of scope

- Anything that's a real bug found during smoke — those get fixed before merge, not pushed to followups.
- Architectural changes to docs other than PROJECT_BRAIN §11.

---

## Definition of S5 done

S5 is complete when **all four tickets** are merged into the `sprint-5` branch AND:

1. `npx tsc --noEmit` is clean on the integration branch.
2. `npm test` passes on the integration branch (all new + existing suites).
3. The 8-item manual smoke checklist in DEV-S5-04 has been run end-to-end on a simulator or device. All items ✅.
4. The end-to-end flow works: a fresh user completes onboarding, lands on the redesigned Today, sees first-day copy, taps Done, sees the heatmap cell light up and the identity streak begin. Library tab opens to the §13.4 placeholder. Settings is unchanged.
5. No regressions: Habit Detail, Edit Habit, Create Habit, Reviews, sign-in/sign-up, and the onboarding flow all behave as they did at close of S4.
6. `docs/PROJECT_BRAIN.md` §11 reflects S5 closure.
7. `docs/sprint_tickets/sprint-5-followups.md` exists.

After S5 closes, S6 begins: Habit Detail screen with the 90-day heatmap variant and the 48-hour retro logging selector wired into the existing `Heatmap` component's `onCellPress` prop.

The `sprint-5` → `main` PR closes the sprint.

---

*End of S5 ticket package.*
