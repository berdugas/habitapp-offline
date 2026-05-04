# Sprint 12 — Goal-anchored habit creation flow

> **Status:** Planned
> **Depends on:** S11 (merged)
> **Estimate:** 3 days
> **Branch:** `sprint-12` off `main`

---

## Goal

Users can add habits to their existing goal — or start a new goal — through a lightweight step-by-step flow that mirrors the onboarding's becoming-bridge sequence. The goal always comes first. The habit always serves the transformation.

## Product rationale

The onboarding walks users through: *who do you want to become → what does that person do → shrink it → cue it → worst-day check*. That sequence IS the product. Post-onboarding habit creation should follow the same structure, compressed for a returning user who already understands the concepts.

If we drop users into a flat form with "identity phrase" as just another text field, we're saying the bridge was important for your first habit but not for your second. That undermines the thesis.

**Two entry paths, same destination:**

- **Path A — Add to existing goal.** User taps "Add a habit" inside their goal container on Today. Goal is inherited. Flow skips straight to habit steps (action → shrink+cue → personalize+gate).
- **Path B — New goal.** User taps a general "Start a new goal" entry point. Flow opens with the becoming question (who do you want to become?), then continues with the same habit steps.

Path B is Path A with one extra step at the front. The habit-creation steps are identical.

**Why a step flow, not a flat form:**

- Steps preserve the pedagogical sequence (goal → action → cue → gate) that makes the product work.
- Steps prevent cognitive overload — the user focuses on one question at a time.
- Steps let us enforce the worst-day gate naturally (it's a step, not a checkbox).
- Returning users move through steps quickly because they understand the concepts. The copy is shorter, there are no educational guidance cards, and validation is inline.

**Why a single screen with internal step state, not multiple routes:**

- No need for resume-from-where-you-left-off (onboarding needs that, creation doesn't).
- Simpler navigation (one push, one pop — back button always returns to Today).
- Step transitions can be animated within the screen.
- No sub-stack of create routes cluttering the navigation.

## Context — what already exists

- `CreateHabitScreen` — flat form. Will be replaced by `CreateHabitFlow`.
- `EditHabitScreen` — flat form. Stays as-is (editing doesn't need the ceremony).
- `LucideIconPicker` + `LucideIcon` — in `features/onboarding/components/`. Needs moving to shared.
- `OnboardingLayout` — scroll + footer + keyboard-aware layout. Reusable for create steps.
- `OnboardingInput` — styled text input. Reusable.
- `GuidanceCard` / `GuidanceExample` — educational cards from onboarding. NOT reused in create flow (returning users don't need the education).
- `assertCanCreateActiveHabit` — cap check exists in `validators.ts`.
- `icon` column — exists in DB and repository. Not wired through feature-layer types yet.
- Route: `app/(app)/habits/create.tsx` → `CreateHabitScreen`. Will point to new `CreateHabitFlow`.

## S11 followup cleanup (opening pass)

- §2 stale Focus/Supporting references in sprint-plan.md — P3 cosmetic. Fix inline during S12-07 or defer.
- S17 deliverables stale language — defer, S17 is far out.

---

## Tickets

### S12-01 — Wire `icon` through type system and API layer

**What:** The DB repository supports `icon` on create/update, but the feature-layer types and API functions don't pass it through. Close that gap before building the new flow.

**Changes:**

1. **`features/habits/types.ts`** — Add `icon` to `HabitSetupPayload`:
   ```ts
   export type HabitSetupPayload = {
     identityPhrase: string;
     title: string;
     cue: string;
     tinyAction: string;
     minimumViableAction: string;
     preferredTimeWindow: string;
     icon: string;  // Lucide icon name, empty string = no icon
   };
   ```

2. **`features/habits/api.ts`** — `createHabit`: add `icon: payload.icon?.trim() || null` to `CreateHabitInput`. `updateHabit`: add `icon: payload.icon?.trim() || null` to `UpdateHabitPatch`.

3. **`features/habits/validators.ts`** — `normalizeHabitSetupPayload`: add `icon: payload.icon.trim()`. Add length guard (max 60 chars).

4. **`EditHabitScreen`** — Add `icon` state, hydrate from `ownedHabitQuery.data.icon ?? ""`, include in update payload. Add `LucideIconPicker` (collapsible, same toggle pattern as onboarding). Preview shows selected icon.

5. **Move `LucideIconPicker.tsx`** from `features/onboarding/components/` to `src/components/LucideIconPicker.tsx`. Update all imports: `PersonalizeScreen`, `HabitRow`, `EditHabitScreen`.

**Branch:** `s12/icon-wiring`

**Done means:** `HabitSetupPayload` includes `icon`. Create and update API functions pass it to the repo. Edit screen has a working icon picker. No type errors. Existing tests green.

---

### S12-02 — CreateHabitFlow: step architecture + goal anchor step

**What:** Replace the flat `CreateHabitScreen` with a step-based `CreateHabitFlow` component. This ticket builds the skeleton and the goal-anchor step (Step 0 / Step 1).

**Architecture:**

```
CreateHabitFlow (single screen component)
├── step state: 'goal' | 'action' | 'build' | 'personalize'
├── draft state: { identityPhrase, dailyAction, tinyAction, cue, ... }
├── goalMode: 'existing' | 'new'
│
├── Step: Goal Anchor
│   ├── Path A (existing goal): goal displayed as locked context card
│   └── Path B (new goal): becoming question input
│
├── Step: Daily Action
│   └── "What does this person do every day?"
│
├── Step: Build the Habit (shrink + cue combined)
│   └── Shrink the action + attach a trigger, single screen
│
└── Step: Personalize + Worst-day Gate
    └── Name + icon + "Could you do this on your worst day?"
```

**Route params:**

The route `/(app)/habits/create` accepts optional params:
- `goalIdentityPhrase` — if provided, Path A (existing goal). Flow starts at Step: Daily Action.
- If absent, Path B (new goal). Flow starts at Step: Goal Anchor.

**Step: Goal Anchor (Path B only):**

- Headline: "What kind of person do you want to become?"
- Subline: "This is the transformation your new habits will support."
- Input: identity phrase field ("Become someone who...")
- Soft cap check: if the typed identity phrase matches an existing goal at 3+ habits, show the warning card (S12-05 builds the warning UI — this ticket just wires the query).
- Footer: "Continue" button (enabled when identity phrase ≥ 2 chars trimmed).

**Step: Goal context card (Path A):**

When `goalIdentityPhrase` is passed via route params:
- Skip the goal anchor step entirely.
- All subsequent steps show a **context chip** at the top: the identity phrase displayed as a read-only pill (similar to onboarding's `contextChip` pattern: tonal bg, icon, "Building toward: {identityPhrase}").
- Soft cap check runs on mount with the inherited identity phrase.

**Draft state shape:**

```ts
type CreateHabitDraft = {
  identityPhrase: string;
  dailyAction: string;
  tinyAction: string;
  cue: string;
  habitName: string;
  icon: string;
  minimumViableAction: string;
  preferredTimeWindow: string;
};
```

All state lives in `useState` hooks inside `CreateHabitFlow`. No context provider needed (no resume persistence).

**Step transitions:** Animated with `Animated.timing` (opacity + translateY), matching the `PersonalizeScreen` phase transition pattern. Back button within the flow goes to previous step (not router.back() until Step 1).

**Branch:** `s12/create-flow-skeleton`

**Done means:** Route renders `CreateHabitFlow`. Path A (with `goalIdentityPhrase` param) skips to Daily Action step with context chip. Path B shows the goal anchor step. Step transitions animate. Back navigation between steps works. No save yet — the flow is a skeleton.

---

### S12-03 — CreateHabitFlow: Daily Action + Build steps

**What:** Implement the two middle steps of the flow: Daily Action and Build (shrink + cue).

**Step: Daily Action**

- Context chip at top showing identity phrase (always visible from this step onward).
- Headline: "What's one thing this person does every day?"
- Subline: "Don't worry about making it small yet — we'll do that next."
- Input: daily action field.
- Footer: "Continue" (enabled when daily action ≥ 2 chars trimmed).
- No guidance card — returning users know what a daily action is.

**Step: Build the Habit (shrink + cue combined)**

Onboarding splits shrink and cue into separate screens. Post-onboarding combines them into one step because the user understands both concepts.

Layout:
- Context chip at top.
- Section 1 — Shrink:
  - Headline: "Now make it tiny."
  - Subline: "So small you can't say no, even on your worst day."
  - Read-only pill showing daily action (the user's input from previous step).
  - Input: tiny action field ("Your tiny version").
- Section 2 — Cue:
  - Label: "What triggers it?"
  - Formula card: "After [cue input] I will [tiny action read-only]"
  - Input: cue field.
- Footer: "Continue" (enabled when both tiny action and cue ≥ 2 chars trimmed).

**Copy philosophy:** Shorter than onboarding. No guidance cards, no before/after examples. The user has seen these concepts. The copy reminds, not teaches.

**Branch:** `s12/create-flow-steps`

**Done means:** Full forward navigation through Goal → Daily Action → Build works. All inputs captured in draft state. Back button between steps works. Context chip persists across steps.

---

### S12-04 — CreateHabitFlow: Personalize + worst-day gate + save

**What:** Final step of the flow: name the habit, pick an icon, pass the worst-day check, save.

**Step: Personalize + Gate**

Two-phase step (same pattern as onboarding's `PersonalizeScreen`):

**Phase 1 — Personalize:**
- Context chip at top.
- Habit preview card:
  - Icon circle (tap to toggle icon picker, default `Sparkles`).
  - Habit name input ("Give it a name").
  - Formula preview: "After [cue], I will [tinyAction]".
  - Goal badge: "Becoming [identityPhrase]".
- `LucideIconPicker` (collapsible, same as onboarding).
- Optional fields below the card:
  - Minimum viable action (text input, optional).
  - Preferred time window (`ChoicePills`, same options as current create screen).
- Footer: "Looks good" button (enabled when habit name ≥ 2 chars).

**Phase 2 — Worst-day gate:**
- Preview card locks (dimmed).
- Headline: "One last check."
- Body: "Could you still do **[tinyAction]** on your worst day? Imagine a low-energy day — would this still feel doable?"
- Footer: "Yes, I could" (primary) → save. "Let me make it smaller" (secondary) → go back to Build step with tiny action focused.

**Save logic:**
- "Yes, I could" calls the create mutation:
  - Builds `CreateHabitPayload` from draft state.
  - `habitState: "active"`.
  - `icon` from draft.
  - `identityPhrase` from draft (either inherited or entered).
  - `startDate` = today.
- On success: invalidate eligible habits query, `router.replace("/(app)/(tabs)/today")`.
- On error: show error state, stay on step.

**"Let me make it smaller" routing:**
- Returns to the Build step (Step 3).
- Tiny action field auto-focused.
- User can edit tiny action and cue, then re-advance to Personalize.

**Branch:** `s12/create-flow-save`

**Done means:** Full flow saves a habit to the DB. Habit appears on Today with correct icon, name, cue, identity phrase. Worst-day gate cannot be skipped. "Let me make it smaller" returns to Build step with focus on tiny action.

---

### S12-05 — Soft cap warning + "Add a habit" entry points

**What:** Wire the cap check into the flow and add entry points on Today.

**Cap check integration:**

- In `CreateHabitFlow`, run `assertCanCreateActiveHabit(userId, identityPhrase)` as a `useQuery`:
  - Query key: `['cap-check', userId, identityPhrase.trim()]`
  - Enabled when identity phrase is non-empty and ≥ 2 chars.
  - Debounce the identity phrase (300ms) before triggering for Path B (user typing a new phrase). Path A doesn't need debounce (phrase is pre-set).
- When `capCheckResult.ok === false`, show a warning card:
  - Appears on the goal anchor step (Path B) or the Daily Action step (Path A, on mount).
  - Lucide `AlertTriangle` icon.
  - Copy: "You have [N] active habits for this goal. Research suggests focusing on 3 or fewer for sustainable change. You can still add this one."
  - Tonal warning background. Non-blocking — Continue button stays enabled.
- When under cap: no warning.

**Entry points on Today:**

1. **Inside GoalContainer — "Add a habit":**
   - Below the last `HabitRow` inside the goal container, render a quiet row:
     - Lucide `Plus` icon (20px, `colors.textMuted`) + "Add a habit" text.
     - Taps → `router.push({ pathname: "/(app)/habits/create", params: { goalIdentityPhrase: group.identityPhrase } })`.
     - This is Path A — the goal is passed, flow starts at Daily Action.
   - Hidden when `isReadOnly`.

2. **Below all GoalContainers — "Start a new goal":**
   - A secondary-styled row below the goal container(s):
     - Lucide `Target` icon + "Start a new goal" text.
     - Taps → `router.push("/(app)/habits/create")` (no params).
     - This is Path B — flow starts at Goal Anchor.
   - Hidden when `isReadOnly`.

3. **Empty state** — Existing "Create your first habit" button stays, navigates to Path B.

**Branch:** `s12/cap-check-and-entry`

**Done means:** "Add a habit" visible inside goal container, navigates to Path A. "Start a new goal" visible below containers, navigates to Path B. Cap warning renders at 3+ habits. Warning is non-blocking.

---

### S12-06 — Tests + integration verification

**What:** Test coverage for the new flow and a manual integration check.

**Unit tests to write:**

1. **Cap check** — Seed 3 active habits with same identity phrase → `assertCanCreateActiveHabit` returns `{ ok: false, reason: 'soft_cap_warning', count: 3 }`. Seed 2 → returns `{ ok: true }`.
2. **Icon round-trip** — Create habit with `icon: "BookOpen"` via API → read back → assert `icon === "BookOpen"`.
3. **Icon update** — Create with `icon: "BookOpen"`, update to `icon: "Brain"` → assert `icon === "Brain"`.
4. **Create habit with all fields** — API layer round-trip: create with full payload including icon, identity phrase, MVA, preferred time → read back → all fields match.
5. **Validator: icon length** — `normalizeHabitSetupPayload` with icon > 60 chars → validation error.

**Manual integration checklist:**

Path A (existing goal):
- [ ] From Today → tap "Add a habit" inside goal container
- [ ] Flow opens at Daily Action step with goal context chip showing identity phrase
- [ ] Enter daily action → Continue → Build step shows daily action in read-only pill
- [ ] Enter tiny action + cue → Continue → Personalize step
- [ ] Name habit + pick icon → "Looks good" → worst-day gate appears
- [ ] "Yes, I could" → habit saved → Today shows new habit under same goal with icon
- [ ] Verify streak and consistency recalculate with new habit included

Path B (new goal):
- [ ] From Today → tap "Start a new goal"
- [ ] Flow opens at Goal Anchor step → enter identity phrase → Continue
- [ ] Remaining steps identical to Path A
- [ ] After save → Today shows new goal container with the new habit

Worst-day gate:
- [ ] "Let me make it smaller" → returns to Build step → tiny action focused
- [ ] Edit tiny action → re-advance → pass gate → saves correctly

Cap check:
- [ ] With 3 habits under a goal → "Add a habit" → warning visible on Daily Action step
- [ ] Can still save despite warning

Edge cases:
- [ ] Read-only mode → "Add a habit" and "Start a new goal" hidden
- [ ] Edit screen → icon picker shows current icon → change + save → Today reflects

**Branch:** `s12/tests`

**Done means:** 5+ new tests green. Full suite green. Manual checklist completed.

---

### S12-07 — Clean up old CreateHabitScreen + update sprint plan

**What:** Remove the old flat `CreateHabitScreen` and update documentation.

**Changes:**

1. **Delete** `src/features/habits/screens/CreateHabitScreen.tsx`.
2. **Update** `app/(app)/habits/create.tsx` to export `CreateHabitFlow`.
3. **Sprint plan §2** — fix stale Focus/Supporting references in Phase structure table and Stage 1 paragraph if not yet done.
4. **Sprint plan S12 status** → Done.

**Branch:** `s12/cleanup`

**Done means:** Old screen deleted. Route points to new flow. No dead imports. Sprint plan current.

---

## Definition of done

1. `CreateHabitFlow` replaces `CreateHabitScreen` — step-based, goal-anchored
2. Path A (existing goal) works end-to-end: Today → Add a habit → steps → save → habit appears
3. Path B (new goal) works end-to-end: Today → Start a new goal → goal step → habit steps → save → new group appears
4. Worst-day gate enforced. Cannot skip. "Let me make it smaller" returns to Build step.
5. 3-per-goal soft cap warning renders at limit. Non-blocking.
6. Icon picker on Create and Edit. Icon persists and renders on Today.
7. `icon` wired through type system → API → repository.
8. Old `CreateHabitScreen` deleted.
9. 5+ new tests green. Full suite green. Manual checklist completed.

## Risks

- **Step flow complexity** — 4 steps with animated transitions, back navigation, and a two-phase final step is more complex than a flat form. The `PersonalizeScreen` phase pattern is proven, but extending it to 4 steps means careful state management. Keep state flat (no nested objects), transitions simple (opacity + translateY), and test back-navigation thoroughly.
- **Cap check flicker** — Path B has the user typing a new identity phrase. Debounce the query to avoid rapid re-firing. Path A is pre-set so this doesn't apply.
- **"Start a new goal" on Today for single-goal beta** — Some users may create a second goal, resulting in two GoalContainers on Today. This is architecturally fine (`groupByIdentity` handles it), but we should confirm the visual looks good with 2+ groups. If it looks odd, we can add a followup for multi-goal polish.
- **Scroll position on worst-day gate** — When the gate appears at the bottom of the Personalize step, the user needs to see it. Auto-scroll to the gate card on phase transition.

---

*End of S12 scope. Ticket package ready for implementation.*
